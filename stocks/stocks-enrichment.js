// stocks/stocks-enrichment.js
// ENRICHMENT LAYER — FMP removed entirely.
// Technicals (RSI, SMA, EMA) computed locally from Yahoo Finance EOD via Vercel proxy.
// Analyst targets, profile, price changes now handled by OpenAI web search in stocks-signals.js.

(function () {
  "use strict";

  // -----------------------------------------------------------
  // LOCAL INDICATOR MATH
  // -----------------------------------------------------------
  function computeRSI(closes, period) {
    if (!closes || closes.length < period + 1) return null;
    const c = closes.slice(0, period + 1).reverse();
    let gains = 0, losses = 0;
    for (let i = 1; i < c.length; i++) {
      const d = c[i] - c[i - 1];
      if (d > 0) gains += d; else losses -= d;
    }
    const avgG = gains / period;
    const avgL = losses / period;
    if (avgL === 0) return 100;
    return parseFloat((100 - 100 / (1 + avgG / avgL)).toFixed(1));
  }

  function computeSMA(closes, period) {
    if (!closes || closes.length < period) return null;
    return parseFloat((closes.slice(0, period).reduce((a, b) => a + b, 0) / period).toFixed(2));
  }

  function computeEMA(closes, period) {
    if (!closes || closes.length < period) return null;
    const c = closes.slice(0, period * 2).reverse();
    const k = 2 / (period + 1);
    let ema = c.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < c.length; i++) ema = c[i] * k + ema * (1 - k);
    return parseFloat(ema.toFixed(2));
  }

  // -----------------------------------------------------------
  // TECHNICALS from Yahoo EOD history via Vercel proxy
  // GET /api/history?ticker=AAPL  → Yahoo v8 chart, 3mo daily
  // -----------------------------------------------------------
  async function fetchTechnicals(ticker) {
    try {
      const res = await fetch(`/api/history?ticker=${encodeURIComponent(ticker)}`);
      if (!res.ok) {
        console.warn("[Enrichment] History proxy " + res.status + " for " + ticker);
        return null;
      }
      const json = await res.json();
      // Yahoo v8 chart response shape
      const quotes = json?.chart?.result?.[0]?.indicators?.quote?.[0];
      const rawCloses = quotes?.close || [];
      const closes = rawCloses.filter(v => v != null && !isNaN(v)).map(v => parseFloat(v));

      if (closes.length < 20) {
        console.warn("[Enrichment] Not enough EOD history for " + ticker + " (" + closes.length + " bars)");
        return null;
      }

      const rsiVal = computeRSI(closes, 14);
      const sma20  = computeSMA(closes, 20);
      const sma50  = computeSMA(closes, 50);
      const ema20  = computeEMA(closes, 20);

      return {
        rsi14:     rsiVal,
        sma20,
        sma50,
        ema20,
        rsiSignal: rsiVal != null
          ? (rsiVal >= 70 ? "OVERBOUGHT" : rsiVal <= 30 ? "OVERSOLD" : "NEUTRAL")
          : null
      };
    } catch (e) {
      console.warn("[Enrichment] fetchTechnicals error for " + ticker + ":", e.message);
      return null;
    }
  }

  // -----------------------------------------------------------
  // MASTER ENRICHMENT
  // -----------------------------------------------------------
  async function enrichCandidate(db, candidate) {
    const ticker = candidate.ticker;
    const price  = candidate.price || 0;

    console.log("[Enrichment] Enriching " + ticker + "...");

    const technicals = await fetchTechnicals(ticker);

    const aboveSMA20 = (technicals?.sma20 && price > 0) ? price > technicals.sma20 : null;

    const enriched = {
      ...candidate,
      rsi14:      technicals?.rsi14      ?? null,
      rsiSignal:  technicals?.rsiSignal  ?? null,
      sma20:      technicals?.sma20      ?? null,
      sma50:      technicals?.sma50      ?? null,
      ema20:      technicals?.ema20      ?? null,
      aboveSMA20,
      enrichedAt: new Date().toISOString()
    };

    try {
      const cfg = window.STOCKS_CONFIG || {};
      const payload = {
        rsi14:      enriched.rsi14,
        rsiSignal:  enriched.rsiSignal,
        sma20:      enriched.sma20,
        sma50:      enriched.sma50,
        ema20:      enriched.ema20,
        aboveSMA20: enriched.aboveSMA20,
        enrichedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      Object.keys(payload).forEach(k => { if (payload[k] == null) delete payload[k]; });
      await db
        .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
        .doc(ticker)
        .update(payload);

      console.log("[Enrichment] ✅ " + ticker +
        " | RSI: " + (enriched.rsi14 ?? "null") + " (" + (enriched.rsiSignal || "?") + ")" +
        " | SMA20: $" + (enriched.sma20 ?? "null") +
        " | EMA20: $" + (enriched.ema20 ?? "null")
      );
    } catch (e) {
      console.warn("[Enrichment] Firestore update error for " + ticker + ":", e.message);
    }

    return enriched;
  }

  window.enrichCandidate = enrichCandidate;
  console.log("[Stocks] Enrichment module loaded.");
})();
