// stocks/stocks-signals.js
// TIER 2 — LLM Signal Reasoning
// Listens to Firestore for new Tier 1 candidates (tier2Processed: false),
// runs the Enrichment layer (FMP historical + fundamentals),
// then calls the stocksAISignal Cloud Function with a full analyst brief.
// The Cloud Function holds the OpenAI key in Secret Manager — key never touches the browser.

(function () {
  "use strict";

  const AI_SIGNAL_URL = "https://us-central1-the-shop-chat.cloudfunctions.net/stocksAISignal";

  let __tier2Listener = null;

  // In-flight dedup guard — prevents the same ticker from being processed
  // multiple times when onSnapshot fires while a previous run is still in progress.
  const __processing = new Set();

  // -----------------------------------------------------------
  // Fetch latest news headlines (up to 3) from Finnhub
  // -----------------------------------------------------------
  async function fetchNewsHeadlines(ticker) {
    try {
      const key = (window.STOCKS_CONFIG || {}).FINNHUB_KEY || "";
      if (!key) return "No recent news found.";
      const to   = new Date();
      const from = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const fmt  = d => d.toISOString().split("T")[0];
      const res  = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`
      );
      if (!res.ok) return "No recent news found.";
      const articles = await res.json();
      if (!articles || !articles.length) return "No recent news found.";
      return articles
        .slice(0, 3)
        .map((a, i) => `[${i + 1}] ${a.headline}`)
        .join(" | ");
    } catch {
      return "No recent news found.";
    }
  }

  // -----------------------------------------------------------
  // Build the enriched analyst brief string for the AI prompt
  // -----------------------------------------------------------
  function buildAnalystBrief(enriched, newsHeadlines) {
    const t = enriched;
    const lines = [];

    // --- Price action ---
    lines.push(`TICKER: ${t.ticker} | Price: $${t.price} | Today: ${t.changePct > 0 ? "+" : ""}${t.changePct}%`);

    if (t.pct5d  != null) lines.push(`5-day trend: ${t.pct5d > 0 ? "+" : ""}${t.pct5d}%`);
    if (t.pct30d != null) lines.push(`30-day trend: ${t.pct30d > 0 ? "+" : ""}${t.pct30d}%`);
    if (t.pct90d != null) lines.push(`90-day trend: ${t.pct90d > 0 ? "+" : ""}${t.pct90d}%`);
    if (t.sma20  != null) lines.push(`SMA20: $${t.sma20} | SMA50: $${t.sma50 || "N/A"} | Price vs SMA20: ${t.price > t.sma20 ? "ABOVE" : "BELOW"}`);
    if (t.aboveSMA20Streak != null && t.aboveSMA20Streak > 0) lines.push(`Days above SMA20 streak: ${t.aboveSMA20Streak}`);
    if (t.high90d != null) lines.push(`90-day range: $${t.low90d} \u2013 $${t.high90d} | Current vs range: ${(((t.price - t.low90d) / (t.high90d - t.low90d)) * 100).toFixed(0)}% of range`);
    if (t.volRatio5v20 != null) lines.push(`Volume (5d avg vs 20d avg): ${t.volRatio5v20}x`);

    // --- Technical indicators ---
    if (t.rsi != null) lines.push(`RSI(14): ${t.rsi}${t.rsi > 70 ? " \u26a0\ufe0f OVERBOUGHT" : t.rsi < 30 ? " \u26a0\ufe0f OVERSOLD" : ""}`);
    if (t.macdHist != null) {
      const dir = t.macdBullish ? "BULLISH CROSS" : t.macdBearish ? "BEARISH CROSS" : "no cross";
      lines.push(`MACD histogram: ${t.macdHist} | Signal: ${dir}`);
    }

    // --- Analyst opinion ---
    if (t.analystConsensus) lines.push(`Analyst consensus: ${t.analystConsensus}`);
    if (t.analystTargetMean != null) {
      lines.push(`Price target \u2014 mean: $${t.analystTargetMean}` +
        (t.analystUpsidePct != null ? ` (${t.analystUpsidePct > 0 ? "+" : ""}${t.analystUpsidePct}% upside)` : "") +
        (t.analystTargetHigh != null ? ` | high: $${t.analystTargetHigh}` : "")
      );
    }
    if (t.latestRating) lines.push(`Latest analyst action: ${t.latestRating}`);
    if (t.ratingChanges && t.ratingChanges.length > 1) {
      const recent = t.ratingChanges.slice(1, 4).map(r => `${r.firm} ${r.action} (${r.date})`).join(", ");
      lines.push(`Other recent ratings: ${recent}`);
    }

    // --- Earnings ---
    if (t.beatStreak != null) {
      lines.push(`EPS beat streak: ${t.beatStreak} of last ${Math.min(t.earningsSurprises?.length || 0, 4)} quarters`);
    }
    if (t.lastSurprisePct != null) {
      lines.push(`Most recent earnings surprise: ${t.lastSurprisePct > 0 ? "+" : ""}${t.lastSurprisePct}% vs estimate`);
    }
    if (t.earningsSurprises && t.earningsSurprises.length > 1) {
      const hist = t.earningsSurprises.map(e => (e.surprisePct != null ? (e.surprisePct > 0 ? "+" : "") + e.surprisePct + "%" : "N/A")).join(", ");
      lines.push(`EPS surprise history (newest first): ${hist}`);
    }
    if (t.earningsDate) lines.push(`Next earnings date: ${t.earningsDate}`);

    // --- Fundamentals ---
    if (t.peRatioCurrent != null)  lines.push(`P/E ratio: ${t.peRatioCurrent}`);
    if (t.debtToEquity   != null)  lines.push(`Debt/Equity: ${t.debtToEquity}`);
    if (t.roePct         != null)  lines.push(`Return on Equity: ${t.roePct}%`);
    if (t.grossMarginPct != null)  lines.push(`Gross margin: ${t.grossMarginPct}%`);
    if (t.revenueGrowthYoY != null) lines.push(`Revenue growth YoY (latest quarter): ${t.revenueGrowthYoY > 0 ? "+" : ""}${t.revenueGrowthYoY}%`);

    // --- Income trend ---
    if (t.incomeTrend && t.incomeTrend.length >= 2) {
      const trend = t.incomeTrend.map(q => {
        const rev = q.revenue ? "$" + (q.revenue / 1e9).toFixed(2) + "B" : "N/A";
        const margin = q.grossMarginPct != null ? q.grossMarginPct + "% margin" : "";
        return `${q.date.slice(0, 7)}: ${rev}${margin ? " (" + margin + ")" : ""}`;
      }).join(" | ");
      lines.push(`Revenue trend (newest first): ${trend}`);
    }

    // --- News ---
    lines.push(`Recent news: ${newsHeadlines}`);

    return lines.join("\n");
  }

  // -----------------------------------------------------------
  // Call the stocksAISignal Cloud Function
  // -----------------------------------------------------------
  async function callAISignal(enriched, newsHeadlines) {
    try {
      const brief = buildAnalystBrief(enriched, newsHeadlines);
      console.log(`[Stocks Tier2] AI brief for ${enriched.ticker}:\n${brief}`);

      const res = await fetch(AI_SIGNAL_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ticker:       enriched.ticker,
          price:        enriched.price,
          // Core technicals (backward-compat with Cloud Function)
          rsi:          enriched.rsi,
          macd:         enriched.macdHist,
          macdSignal:   enriched.macdBullish ? "bullish" : enriched.macdBearish ? "bearish" : null,
          ema20:        enriched.sma20,
          ema50:        enriched.sma50,
          sentiment:    enriched.changePct,
          pe:           enriched.peRatioCurrent,
          earningsDate: enriched.earningsDate || "",
          newsHeadline: newsHeadlines,
          // Full enriched brief — Cloud Function uses this for the system prompt
          analystBrief: brief
        })
      });

      if (!res.ok) {
        console.error("[Stocks Tier2] Cloud Function error:", await res.text());
        return null;
      }
      const data = await res.json();
      return data?.analysis || null;
    } catch (e) {
      console.error("[Stocks Tier2] callAISignal failed:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // Write the final signal card to Firestore
  // -----------------------------------------------------------
  async function writeSignalCard(db, enriched, signal, newsHeadlines) {
    try {
      const cfg  = window.STOCKS_CONFIG || {};
      const card = {
        ticker:       enriched.ticker,
        price:        enriched.price,
        changePct:    enriched.changePct,
        rsi:          enriched.rsi,
        macdCrossed:  enriched.macdCrossed,
        newsHeadline: newsHeadlines,
        // Enrichment snapshot on the card
        pct90d:           enriched.pct90d           || null,
        analystConsensus: enriched.analystConsensus || null,
        analystUpsidePct: enriched.analystUpsidePct || null,
        latestRating:     enriched.latestRating     || null,
        beatStreak:       enriched.beatStreak       != null ? enriched.beatStreak : null,
        lastSurprisePct:  enriched.lastSurprisePct  || null,
        revenueGrowthYoY: enriched.revenueGrowthYoY || null,
        peRatioCurrent:   enriched.peRatioCurrent   || null,
        generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // LLM output
        direction:    signal.signal      || signal.direction   || "NEUTRAL",
        confidence:   signal.confidence,
        signal_type:  signal.signal_type  || "",
        entry_zone:   signal.entry_zone   || "",
        target:       signal.target       || "",
        stop_loss:    signal.stop_loss    || "",
        risk_reward:  signal.risk_reward  || "",
        time_horizon: signal.time_horizon || "",
        reasoning:    signal.summary      || signal.reasoning  || "",
        news_impact:  signal.news_impact  || "NONE",
        expires_note: signal.expires_note || ""
      };

      await db.collection(cfg.SIGNALS_COLLECTION || "stockSignals").add(card);
      await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(enriched.ticker).update({
        tier2Processed: true
      });

      console.log(`[Stocks Tier2] \u2705 Signal card: ${enriched.ticker} \u2014 ${card.direction} (${card.confidence})`);
    } catch (e) {
      console.error("[Stocks Tier2] writeSignalCard error:", e);
    }
  }

  // -----------------------------------------------------------
  // Process a single candidate through Enrichment + Tier 2
  // -----------------------------------------------------------
  async function processCandidateTier2(db, candidate) {
    const ticker = candidate.ticker;

    // Dedup guard: skip if already in-flight for this ticker
    if (__processing.has(ticker)) {
      console.log(`[Stocks Tier2] Skipping ${ticker} — already processing.`);
      return;
    }
    __processing.add(ticker);

    try {
      console.log(`[Stocks Tier2] Processing: ${ticker}`);

      // 1. Enrich with FMP historical + fundamentals
      let enriched = candidate;
      if (typeof window.enrichCandidate === "function") {
        enriched = await window.enrichCandidate(db, candidate);
      } else {
        console.warn("[Stocks Tier2] enrichCandidate not available — stocks-enrichment.js loaded?");
      }

      // 2. Fetch news headlines (Finnhub)
      const newsHeadlines = await fetchNewsHeadlines(enriched.ticker);

      // 3. Call OpenAI via Cloud Function
      const signal = await callAISignal(enriched, newsHeadlines);
      if (!signal) {
        console.warn(`[Stocks Tier2] No signal returned for ${ticker}`);
        return;
      }

      // 4. Write signal card to Firestore
      await writeSignalCard(db, enriched, signal, newsHeadlines);
    } finally {
      // Always release the lock so future re-runs (e.g. next day) can proceed
      __processing.delete(ticker);
    }
  }

  // -----------------------------------------------------------
  // Start Tier 2 listener
  // -----------------------------------------------------------
  function startTier2Listener(db) {
    if (__tier2Listener) { __tier2Listener(); __tier2Listener = null; }
    __processing.clear(); // Reset in-flight set on fresh start
    const cfg = window.STOCKS_CONFIG || {};
    console.log("[Stocks Tier2] Listener started — watching for new candidates...");

    __tier2Listener = db
      .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
      .where("tier2Processed", "==", false)
      .onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            if (!data.tier2Processed) {
              await processCandidateTier2(db, data);
            }
          }
        }
      }, (err) => {
        console.error("[Stocks Tier2] Listener error:", err);
      });
  }

  function stopTier2Listener() {
    if (__tier2Listener) {
      __tier2Listener();
      __tier2Listener = null;
      console.log("[Stocks Tier2] Listener stopped.");
    }
  }

  window.startTier2Listener    = startTier2Listener;
  window.stopTier2Listener     = stopTier2Listener;
  window.processCandidateTier2 = processCandidateTier2;

  console.log("[Stocks] Signals (Tier2) module loaded.");
})();
