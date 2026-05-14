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
  const __processing  = new Set();

  // -----------------------------------------------------------
  // Fetch LIVE price + changePct via Vercel proxy (bypasses Yahoo CORS block)
  // -----------------------------------------------------------
  async function fetchLivePrice(ticker) {
    try {
      const url = `/api/price?ticker=${encodeURIComponent(ticker)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      if (!meta) return null;
      const price     = meta.regularMarketPrice ?? null;
      const prevClose = meta.chartPreviousClose  ?? meta.previousClose ?? null;
      const changePct = (price && prevClose && prevClose !== 0)
        ? parseFloat((((price - prevClose) / prevClose) * 100).toFixed(2))
        : null;
      return { price: price ? parseFloat(price.toFixed(2)) : null, changePct };
    } catch (e) {
      console.warn(`[Stocks Tier2] fetchLivePrice failed for ${ticker}:`, e);
      return null;
    }
  }

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
      fetchNewsHeadlines._lastUrl    = articles[0]?.url    || "";
      fetchNewsHeadlines._lastSource = articles[0]?.source || "";
      return articles.slice(0, 3).map((a, i) => `[${i + 1}] ${a.headline}`).join(" | ");
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

    lines.push(`TICKER: ${t.ticker} | Price: $${t.price} | Today: ${t.changePct > 0 ? "+" : ""}${t.changePct}%`);
    if (t.pct5d  != null) lines.push(`5-day trend: ${t.pct5d > 0 ? "+" : ""}${t.pct5d}%`);
    if (t.pct30d != null) lines.push(`30-day trend: ${t.pct30d > 0 ? "+" : ""}${t.pct30d}%`);
    if (t.pct90d != null) lines.push(`90-day trend: ${t.pct90d > 0 ? "+" : ""}${t.pct90d}%`);
    if (t.sma20  != null) lines.push(`SMA20: $${t.sma20} | SMA50: $${t.sma50 || "N/A"} | Price vs SMA20: ${t.price > t.sma20 ? "ABOVE" : "BELOW"}`);
    if (t.aboveSMA20Streak != null && t.aboveSMA20Streak > 0) lines.push(`Days above SMA20 streak: ${t.aboveSMA20Streak}`);
    if (t.high90d != null) lines.push(`90-day range: $${t.low90d} \u2013 $${t.high90d} | Current vs range: ${(((t.price - t.low90d) / (t.high90d - t.low90d)) * 100).toFixed(0)}% of range`);
    if (t.volRatio5v20 != null) lines.push(`Volume ratio (5d vs 20d avg): ${t.volRatio5v20}x`);
    if (t.rsi != null) lines.push(`RSI(14): ${t.rsi}${t.rsi > 70 ? " (OVERBOUGHT)" : t.rsi < 30 ? " (OVERSOLD)" : ""}`);
    if (t.macdHist != null) {
      const dir = t.macdBullish ? "BULLISH CROSS" : t.macdBearish ? "BEARISH CROSS" : "no cross";
      lines.push(`MACD histogram: ${t.macdHist} | Signal: ${dir}`);
    }
    if (t.analystConsensus) lines.push(`Analyst consensus: ${t.analystConsensus}`);
    if (t.analystTargetMean != null) {
      lines.push(`Analyst price target: mean $${t.analystTargetMean}` +
        (t.analystUpsidePct != null ? ` (${t.analystUpsidePct > 0 ? "+" : ""}${t.analystUpsidePct}% upside)` : "") +
        (t.analystTargetHigh != null ? `, high $${t.analystTargetHigh}` : "")
      );
    }
    if (t.latestRating) lines.push(`Latest analyst action: ${t.latestRating}`);
    if (t.beatStreak != null) lines.push(`EPS beat streak: ${t.beatStreak} of last ${Math.min(t.earningsSurprises?.length || 0, 4)} quarters`);
    if (t.lastSurprisePct != null) lines.push(`Most recent EPS surprise: ${t.lastSurprisePct > 0 ? "+" : ""}${t.lastSurprisePct}% vs estimate`);
    if (t.earningsDate) lines.push(`Next earnings date: ${t.earningsDate}`);
    if (t.peRatioCurrent != null) lines.push(`P/E ratio: ${t.peRatioCurrent}`);
    if (t.debtToEquity   != null) lines.push(`Debt/Equity: ${t.debtToEquity}`);
    if (t.roePct         != null) lines.push(`Return on Equity: ${t.roePct}%`);
    if (t.grossMarginPct != null) lines.push(`Gross margin: ${t.grossMarginPct}%`);
    if (t.revenueGrowthYoY != null) lines.push(`Revenue growth YoY: ${t.revenueGrowthYoY > 0 ? "+" : ""}${t.revenueGrowthYoY}%`);
    lines.push(`Recent news: ${newsHeadlines}`);
    return lines.join("\n");
  }

  // -----------------------------------------------------------
  // Build the explicit AI prompt that asks for ALL fields
  // including entry zone, target, stop loss, and risk/reward.
  // This is sent as extra context to the Cloud Function so it
  // can pass it straight through to OpenAI.
  // -----------------------------------------------------------
  function buildFullPrompt(enriched, brief) {
    const price = enriched.price;
    return `You are a professional stock analyst generating a trade signal card.

Here is the data for this stock:
${brief}

Based on all of the above data, provide a complete trade signal in the following JSON format.
You MUST calculate and fill in entry_zone, target, stop_loss, and risk_reward based on the current price of $${price} and the technical/fundamental context. Do NOT leave these blank.

Rules for trade levels:
- entry_zone: The recommended price range to enter the trade (e.g. "$152.00 - $154.00")
- target: The price target where you would take profit (e.g. "$165.00")
- stop_loss: The price where the trade thesis is invalidated and you exit (e.g. "$148.50")
- risk_reward: The risk-to-reward ratio as a string (e.g. "2.5:1")
- For BULLISH signals: target should be above entry, stop_loss below entry
- For BEARISH signals: target should be below entry, stop_loss above entry
- Base these levels on support/resistance implied by SMA20, SMA50, 90-day range, and RSI
- time_horizon should be "Intraday", "1-3 days", "1-2 weeks", or "1 month"
- confidence should be a number 0-100

Respond ONLY with valid JSON, no extra text:
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": <number 0-100>,
  "signal_type": "<momentum|reversal|breakout|breakdown|earnings_play|value>",
  "entry_zone": "<price range string>",
  "target": "<price string>",
  "stop_loss": "<price string>",
  "risk_reward": "<ratio string like 2.5:1>",
  "time_horizon": "<timeframe string>",
  "summary": "<2-3 sentence reasoning using the actual data points above>",
  "news_impact": "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "NONE",
  "expires_note": "<optional string, e.g. 'Before earnings on May 20'>"
}`;
  }

  // -----------------------------------------------------------
  // Call the stocksAISignal Cloud Function
  // -----------------------------------------------------------
  async function callAISignal(enriched, newsHeadlines) {
    try {
      const brief      = buildAnalystBrief(enriched, newsHeadlines);
      const fullPrompt = buildFullPrompt(enriched, brief);

      console.log(`[Stocks Tier2] Sending AI request for ${enriched.ticker}...`);

      const res = await fetch(AI_SIGNAL_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ticker:       enriched.ticker,
          price:        enriched.price,
          rsi:          enriched.rsi,
          macd:         enriched.macdHist,
          macdSignal:   enriched.macdBullish ? "bullish" : enriched.macdBearish ? "bearish" : null,
          ema20:        enriched.sma20,
          ema50:        enriched.sma50,
          sentiment:    enriched.changePct,
          pe:           enriched.peRatioCurrent,
          earningsDate: enriched.earningsDate || "",
          newsHeadline: newsHeadlines,
          analystBrief: brief,
          // Full structured prompt — Cloud Function should pass this as the user message to OpenAI
          fullPrompt
        })
      });

      if (!res.ok) {
        console.error("[Stocks Tier2] Cloud Function HTTP error:", res.status, await res.text());
        return null;
      }

      const data = await res.json();
      console.log(`[Stocks Tier2] Raw response for ${enriched.ticker}:`, JSON.stringify(data));

      // Support both { analysis: {...} } and flat { signal, entry_zone, ... } shapes
      const analysis = data?.analysis || data || null;
      if (!analysis || typeof analysis !== "object") {
        console.warn(`[Stocks Tier2] Unexpected response shape for ${enriched.ticker}:`, data);
        return null;
      }
      return analysis;
    } catch (e) {
      console.error("[Stocks Tier2] callAISignal failed:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // Safely extract a string field — never write empty strings
  // -----------------------------------------------------------
  function safeField(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (!s || s === "null" || s === "undefined") return null;
    return s;
  }

  // -----------------------------------------------------------
  // Last-resort fallback: calculate trade levels from price.
  // Only used if AI STILL doesn't return them after the explicit prompt.
  // BULLISH: +5% target, -2.5% stop = 2:1 R/R
  // BEARISH: -5% target, +2.5% stop = 2:1 R/R
  // -----------------------------------------------------------
  function calcFallbackLevels(price, direction) {
    if (!price) return {};
    const p   = parseFloat(price);
    const dir = String(direction || "").toUpperCase();
    const fmt = n => "$" + n.toFixed(2);

    if (dir === "BULLISH") {
      return {
        entry_zone:  fmt(p),
        target:      fmt(p * 1.05),
        stop_loss:   fmt(p * 0.975),
        risk_reward: "2.0:1"
      };
    }
    if (dir === "BEARISH") {
      return {
        entry_zone:  fmt(p),
        target:      fmt(p * 0.95),
        stop_loss:   fmt(p * 1.025),
        risk_reward: "2.0:1"
      };
    }
    return { entry_zone: fmt(p) };
  }

  // -----------------------------------------------------------
  // Write the final signal card to Firestore
  // -----------------------------------------------------------
  async function writeSignalCard(db, enriched, signal, newsHeadlines, livePrice) {
    try {
      const cfg = window.STOCKS_CONFIG || {};

      const finalPrice     = (livePrice?.price)     ?? enriched.price;
      const finalChangePct = (livePrice?.changePct != null) ? livePrice.changePct : enriched.changePct;
      const newsUrl        = fetchNewsHeadlines._lastUrl    || "";
      const newsSource     = fetchNewsHeadlines._lastSource || "";
      const direction      = safeField(signal.signal || signal.direction) || "NEUTRAL";
      const confidence     = signal.confidence ?? null;

      // Use AI-provided levels, fall back to calculated if missing
      let entry_zone  = safeField(signal.entry_zone);
      let target      = safeField(signal.target);
      let stop_loss   = safeField(signal.stop_loss);
      let risk_reward = safeField(signal.risk_reward);

      if (!entry_zone || !target || !stop_loss) {
        console.warn(`[Stocks Tier2] AI did not return trade levels for ${enriched.ticker} — using price-based fallback.`);
        const fb = calcFallbackLevels(finalPrice, direction);
        entry_zone  = entry_zone  || fb.entry_zone  || null;
        target      = target      || fb.target      || null;
        stop_loss   = stop_loss   || fb.stop_loss   || null;
        risk_reward = risk_reward || fb.risk_reward || null;
      }

      const card = {
        ticker:       enriched.ticker,
        price:        finalPrice,
        changePct:    finalChangePct,
        rsi:          enriched.rsi         ?? null,
        macdCrossed:  enriched.macdCrossed ?? null,
        newsHeadline: newsHeadlines,
        newsUrl,
        newsSource,
        pct90d:           enriched.pct90d           ?? null,
        analystConsensus: enriched.analystConsensus  || null,
        analystUpsidePct: enriched.analystUpsidePct  ?? null,
        latestRating:     enriched.latestRating      || null,
        beatStreak:       enriched.beatStreak        ?? null,
        lastSurprisePct:  enriched.lastSurprisePct   ?? null,
        revenueGrowthYoY: enriched.revenueGrowthYoY  ?? null,
        peRatioCurrent:   enriched.peRatioCurrent    ?? null,
        generatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
        direction,
        confidence,
        signal_type:  safeField(signal.signal_type),
        entry_zone,
        target,
        stop_loss,
        risk_reward,
        time_horizon: safeField(signal.time_horizon),
        reasoning:    safeField(signal.summary || signal.reasoning),
        news_impact:  safeField(signal.news_impact) || "NONE",
        expires_note: safeField(signal.expires_note)
      };

      await db.collection(cfg.SIGNALS_COLLECTION || "stockSignals").add(card);
      await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(enriched.ticker).update({
        tier2Processed: true
      });

      console.log(`[Stocks Tier2] \u2705 ${enriched.ticker} | ${direction} ${confidence}% | Entry: ${entry_zone} | Target: ${target} | Stop: ${stop_loss} | RR: ${risk_reward} | $${finalPrice}`);
    } catch (e) {
      console.error("[Stocks Tier2] writeSignalCard error:", e);
    }
  }

  // -----------------------------------------------------------
  // Process a single candidate through Enrichment + Tier 2
  // -----------------------------------------------------------
  async function processCandidateTier2(db, candidate) {
    const ticker = candidate.ticker;
    if (__processing.has(ticker)) {
      console.log(`[Stocks Tier2] Skipping ${ticker} — already processing.`);
      return;
    }
    __processing.add(ticker);
    try {
      console.log(`[Stocks Tier2] Processing: ${ticker}`);

      let enriched = candidate;
      if (typeof window.enrichCandidate === "function") {
        enriched = await window.enrichCandidate(db, candidate);
      } else {
        console.warn("[Stocks Tier2] enrichCandidate not available.");
      }

      const [newsHeadlines, livePrice] = await Promise.all([
        fetchNewsHeadlines(ticker),
        fetchLivePrice(ticker)
      ]);

      if (livePrice?.price) {
        console.log(`[Stocks Tier2] Live price: ${ticker} $${livePrice.price} (${livePrice.changePct}%)`);
      }

      const signal = await callAISignal(enriched, newsHeadlines);
      if (!signal) {
        console.warn(`[Stocks Tier2] No signal returned for ${ticker}`);
        return;
      }

      await writeSignalCard(db, enriched, signal, newsHeadlines, livePrice);
    } finally {
      __processing.delete(ticker);
    }
  }

  // -----------------------------------------------------------
  // Start Tier 2 listener
  // -----------------------------------------------------------
  function startTier2Listener(db) {
    if (__tier2Listener) { __tier2Listener(); __tier2Listener = null; }
    __processing.clear();
    const cfg = window.STOCKS_CONFIG || {};
    console.log("[Stocks Tier2] Listener started.");

    __tier2Listener = db
      .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
      .where("tier2Processed", "==", false)
      .onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            if (!data.tier2Processed) await processCandidateTier2(db, data);
          }
        }
      }, (err) => console.error("[Stocks Tier2] Listener error:", err));
  }

  function stopTier2Listener() {
    if (__tier2Listener) { __tier2Listener(); __tier2Listener = null; }
    console.log("[Stocks Tier2] Listener stopped.");
  }

  window.startTier2Listener    = startTier2Listener;
  window.stopTier2Listener     = stopTier2Listener;
  window.processCandidateTier2 = processCandidateTier2;

  console.log("[Stocks] Signals (Tier2) module loaded.");
})();
