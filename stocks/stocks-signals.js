// stocks/stocks-signals.js
// TIER 2 — LLM Signal Reasoning
// Calls /api/stocks-signal (Vercel + GPT-4o web search).
// Deletes candidate docs after processing so they never replay on next page load.

(function () {
  "use strict";

  const AI_SIGNAL_URL = "/api/stocks-signal";

  let __tier2Listener = null;
  const __processing  = new Set();

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

  // Returns { headlines: string, articles: [{headline, url, source}] }
  async function fetchNewsHeadlines(ticker) {
    try {
      const key = (window.STOCKS_CONFIG || {}).FINNHUB_KEY || "";
      if (!key) return { headlines: "No recent news found.", articles: [] };
      const to   = new Date();
      const from = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const fmt  = d => d.toISOString().split("T")[0];
      const res  = await fetch(
        `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`
      );
      if (!res.ok) return { headlines: "No recent news found.", articles: [] };
      const raw = await res.json();
      if (!raw || !raw.length) return { headlines: "No recent news found.", articles: [] };
      const top      = raw.slice(0, 3);
      const articles = top.map(a => ({ headline: a.headline || "", url: a.url || "", source: a.source || "" }));
      const headlines = articles.map((a, i) => `[${i + 1}] ${a.headline}`).join(" | ");
      return { headlines, articles };
    } catch {
      return { headlines: "No recent news found.", articles: [] };
    }
  }

  async function callAISignal(enriched, newsHeadlines) {
    try {
      console.log(`[Stocks Tier2] Sending AI request for ${enriched.ticker}...`);

      const res = await fetch(AI_SIGNAL_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ticker:    enriched.ticker,
          price:     enriched.price,
          rsi14:     enriched.rsi14,
          sma20:     enriched.sma20,
          sma50:     enriched.sma50,
          ema20:     enriched.ema20,
          rsiSignal: enriched.rsiSignal
        })
      });

      if (!res.ok) {
        console.error("[Stocks Tier2] API error:", res.status, await res.text());
        return null;
      }

      const data = await res.json();
      console.log(`[Stocks Tier2] Raw response for ${enriched.ticker}:`, JSON.stringify(data));

      const analysis = data?.analysis || data || null;
      if (!analysis || typeof analysis !== "object") {
        console.warn(`[Stocks Tier2] Unexpected response shape for ${enriched.ticker}:`, data);
        return null;
      }

      if (analysis.analystConsensus)  enriched.analystConsensus  = analysis.analystConsensus;
      if (analysis.analystTargetMean) enriched.analystTargetMean = analysis.analystTargetMean;
      if (analysis.analystUpsidePct)  enriched.analystUpsidePct  = analysis.analystUpsidePct;
      if (analysis.sector)            enriched.sector            = analysis.sector;
      if (analysis.pe)                enriched.peRatio           = analysis.pe;
      if (analysis.earningsDate)      enriched.earningsDate      = analysis.earningsDate;
      if (analysis.newsHeadline && newsHeadlines === "No recent news found.") {
        return { ...analysis, _newsFromAI: true };
      }

      return analysis;
    } catch (e) {
      console.error("[Stocks Tier2] callAISignal failed:", e);
      return null;
    }
  }

  function safeField(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (!s || s === "null" || s === "undefined") return null;
    return s;
  }

  function calcFallbackLevels(price, direction) {
    if (!price) return {};
    const p   = parseFloat(price);
    const dir = String(direction || "").toUpperCase();
    const fmt = n => "$" + n.toFixed(2);
    if (dir === "BULLISH") return { entry_zone: fmt(p), target: fmt(p * 1.05), stop_loss: fmt(p * 0.975), risk_reward: "2.0:1" };
    if (dir === "BEARISH") return { entry_zone: fmt(p), target: fmt(p * 0.95), stop_loss: fmt(p * 1.025), risk_reward: "2.0:1" };
    return { entry_zone: fmt(p) };
  }

  async function writeSignalCard(db, enriched, signal, newsData, livePrice) {
    try {
      const cfg = window.STOCKS_CONFIG || {};

      const finalPrice     = (livePrice?.price)     ?? enriched.price;
      const finalChangePct = (livePrice?.changePct != null) ? livePrice.changePct : enriched.changePct;
      const direction      = safeField(signal.signal || signal.direction) || "NEUTRAL";
      const confidence     = signal.confidence ?? null;

      // Support both new array format and legacy string format
      const newsArticles   = newsData.articles || [];
      const newsHeadline   = signal._newsFromAI ? signal.newsHeadline : newsData.headlines;
      const newsUrl        = newsArticles[0]?.url    || "";
      const newsSource     = newsArticles[0]?.source || "";

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
        ticker:           enriched.ticker,
        price:            finalPrice,
        changePct:        finalChangePct,
        rsi14:            enriched.rsi14             ?? null,
        rsiSignal:        enriched.rsiSignal          ?? null,
        sma20:            enriched.sma20              ?? null,
        sma50:            enriched.sma50              ?? null,
        ema20:            enriched.ema20              ?? null,
        pct1m:            enriched.pct1m              ?? null,
        pct3m:            enriched.pct3m              ?? null,
        // Legacy single-headline fields (kept for backward compat)
        newsHeadline,
        newsUrl,
        newsSource,
        // New: full articles array for multi-story rendering
        newsArticles,
        analystConsensus: enriched.analystConsensus   || null,
        analystTargetMean:enriched.analystTargetMean  ?? null,
        analystUpsidePct: enriched.analystUpsidePct   ?? null,
        revenueGrowthYoY: enriched.revenueGrowthYoY   ?? null,
        peRatio:          enriched.peRatio             ?? null,
        earningsDate:     enriched.earningsDate        || null,
        sector:           enriched.sector              || null,
        beta:             enriched.beta                ?? null,
        generatedAt:      firebase.firestore.FieldValue.serverTimestamp(),
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

      console.log(`[Stocks Tier2] ✅ ${enriched.ticker} | ${direction} ${confidence}% | Entry: ${entry_zone} | Target: ${target} | Stop: ${stop_loss} | RR: ${risk_reward} | $${finalPrice}`);
    } catch (e) {
      console.error("[Stocks Tier2] writeSignalCard error:", e);
    }
  }

  async function processCandidateTier2(db, candidate, docId) {
    const ticker = candidate.ticker;
    if (__processing.has(ticker)) {
      console.log(`[Stocks Tier2] Skipping ${ticker} — already processing.`);
      return;
    }
    __processing.add(ticker);

    const cfg = window.STOCKS_CONFIG || {};

    try {
      console.log(`[Stocks Tier2] Processing: ${ticker}`);

      let enriched = candidate;
      if (typeof window.enrichCandidate === "function") {
        enriched = await window.enrichCandidate(db, candidate);
      } else {
        console.warn("[Stocks Tier2] enrichCandidate not available.");
      }

      const [newsData, livePrice] = await Promise.all([
        fetchNewsHeadlines(ticker),
        fetchLivePrice(ticker)
      ]);

      if (livePrice?.price) {
        console.log(`[Stocks Tier2] Live price: ${ticker} $${livePrice.price} (${livePrice.changePct}%)`);
      }

      const signal = await callAISignal(enriched, newsData.headlines);
      if (!signal) {
        console.warn(`[Stocks Tier2] No signal returned for ${ticker}`);
        return;
      }

      await writeSignalCard(db, enriched, signal, newsData, livePrice);

      // Delete the candidate doc so it never replays on next page load.
      try {
        await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(docId || ticker).delete();
        console.log(`[Stocks Tier2] 🗑 Candidate ${ticker} removed after processing.`);
      } catch (delErr) {
        console.warn(`[Stocks Tier2] Could not delete candidate ${ticker}:`, delErr.message);
      }
    } finally {
      __processing.delete(ticker);
    }
  }

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
          if (change.type === "added") {
            const data  = change.doc.data();
            const docId = change.doc.id;
            if (!data.tier2Processed) await processCandidateTier2(db, data, docId);
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
