// stocks/stocks-enrichment.js
// ENRICHMENT LAYER — sits between Tier 1 and Tier 2.
// Pulls FMP Starter endpoints to build a rich analyst-style brief
// for each Tier 1 candidate before it goes to OpenAI.
//
// Data collected per ticker:
//   - Price context (90-day + 5-day historical, vs moving averages)
//   - Analyst consensus (price targets, upgrades/downgrades)
//   - Fundamentals (key metrics: P/E, margins, debt)
//   - Earnings history (last 4 quarters: beat/miss + surprise %)
//   - Income trend (last 4 quarters: revenue + net income)
//   - Upcoming earnings date
//
// Writes enriched fields back onto the Firestore candidate doc
// and returns the enriched object for immediate Tier 2 use.

(function () {
  "use strict";

  function getFMPKey() { return (window.STOCKS_CONFIG || {}).FMP_KEY || ""; }
  function delay(ms)   { return new Promise(r => setTimeout(r, ms)); }

  // Small helper — fetch JSON from FMP, return null on any error
  async function fmpGet(path) {
    const key = getFMPKey();
    if (!key) return null;
    try {
      const res = await fetch("https://financialmodelingprep.com/api/v3" + path + (path.includes("?") ? "&" : "?") + "apikey=" + key);
      if (!res.ok) return null;
      const data = await res.json();
      return data || null;
    } catch { return null; }
  }

  // -----------------------------------------------------------
  // 1. PRICE CONTEXT — 90-day history for trend + avg comparison
  // -----------------------------------------------------------
  async function fetchPriceContext(ticker, currentPrice) {
    const data = await fmpGet("/historical-price-full/" + ticker + "?timeseries=90");
    if (!data || !data.historical || data.historical.length < 5) return null;

    const history = data.historical; // newest first
    const prices  = history.map(d => d.close);

    const high90  = Math.max(...prices);
    const low90   = Math.min(...prices);
    const pct90   = prices.length >= 90 ? (((currentPrice - prices[89]) / prices[89]) * 100).toFixed(1) : null;
    const pct30   = prices.length >= 30 ? (((currentPrice - prices[29]) / prices[29]) * 100).toFixed(1) : null;
    const pct5    = prices.length >= 5  ? (((currentPrice - prices[4])  / prices[4])  * 100).toFixed(1) : null;

    // Simple moving averages
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const sma20 = prices.length >= 20 ? parseFloat(avg(prices.slice(0, 20)).toFixed(2)) : null;
    const sma50 = prices.length >= 50 ? parseFloat(avg(prices.slice(0, 50)).toFixed(2)) : null;

    // Days above SMA20 streak
    let aboveSMA20Streak = 0;
    if (sma20) {
      for (let i = 0; i < Math.min(prices.length, 30); i++) {
        if (prices[i] > sma20) aboveSMA20Streak++;
        else break;
      }
    }

    // Volume trend: avg volume last 5 days vs avg last 20 days
    const vols     = history.map(d => d.volume || 0);
    const vol5avg  = vols.length >= 5  ? parseFloat(avg(vols.slice(0, 5)).toFixed(0))  : null;
    const vol20avg = vols.length >= 20 ? parseFloat(avg(vols.slice(0, 20)).toFixed(0)) : null;
    const volRatio = (vol5avg && vol20avg && vol20avg > 0) ? parseFloat((vol5avg / vol20avg).toFixed(2)) : null;

    return { high90, low90, pct5, pct30, pct90, sma20, sma50, aboveSMA20Streak, vol5avg, vol20avg, volRatio };
  }

  // -----------------------------------------------------------
  // 2. ANALYST TARGETS — price targets + consensus
  // -----------------------------------------------------------
  async function fetchAnalystTargets(ticker) {
    const data = await fmpGet("/price-target-consensus/" + ticker);
    if (!data) return null;
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      targetHigh:    d.targetHigh    || null,
      targetLow:     d.targetLow     || null,
      targetMean:    d.targetMean    || null,
      targetMedian:  d.targetMedian  || null,
      consensus:     d.consensus     || null
    };
  }

  // -----------------------------------------------------------
  // 3. UPGRADES / DOWNGRADES — last 5 analyst rating changes
  // -----------------------------------------------------------
  async function fetchRatingChanges(ticker) {
    const data = await fmpGet("/upgrades-downgrades/" + ticker + "?limit=5");
    if (!Array.isArray(data) || !data.length) return [];
    return data.slice(0, 5).map(r => ({
      date:         r.publishedDate ? r.publishedDate.slice(0, 10) : "",
      firm:         r.gradingCompany || "",
      action:       r.action || "",           // upgrade / downgrade / initiation
      fromGrade:    r.previousGrade || "",
      toGrade:      r.newGrade || ""
    }));
  }

  // -----------------------------------------------------------
  // 4. KEY METRICS — last 4 quarters (P/E, margins, debt)
  // -----------------------------------------------------------
  async function fetchKeyMetrics(ticker) {
    const data = await fmpGet("/key-metrics/" + ticker + "?limit=4&period=quarter");
    if (!Array.isArray(data) || !data.length) return [];
    return data.map(q => ({
      date:              q.date || "",
      peRatio:           q.peRatio           != null ? parseFloat(q.peRatio.toFixed(1))           : null,
      priceToSales:      q.priceToSalesRatio != null ? parseFloat(q.priceToSalesRatio.toFixed(2)) : null,
      debtToEquity:      q.debtToEquity      != null ? parseFloat(q.debtToEquity.toFixed(2))      : null,
      returnOnEquity:    q.roe               != null ? parseFloat((q.roe * 100).toFixed(1))        : null,
      freeCashFlowYield: q.freeCashFlowYield != null ? parseFloat((q.freeCashFlowYield * 100).toFixed(2)) : null
    }));
  }

  // -----------------------------------------------------------
  // 5. EARNINGS SURPRISES — last 4 quarters beat/miss
  // -----------------------------------------------------------
  async function fetchEarningsSurprises(ticker) {
    const data = await fmpGet("/earnings-surprises/" + ticker);
    if (!Array.isArray(data) || !data.length) return [];
    return data.slice(0, 4).map(e => ({
      date:          e.date || "",
      estimated:     e.estimatedEps != null ? parseFloat(e.estimatedEps.toFixed(2)) : null,
      actual:        e.actualEps    != null ? parseFloat(e.actualEps.toFixed(2))    : null,
      surprisePct:   (e.estimatedEps && e.estimatedEps !== 0)
                       ? parseFloat((((e.actualEps - e.estimatedEps) / Math.abs(e.estimatedEps)) * 100).toFixed(1))
                       : null,
      beat:          e.actualEps != null && e.estimatedEps != null && e.actualEps > e.estimatedEps
    }));
  }

  // -----------------------------------------------------------
  // 6. INCOME TREND — last 4 quarters revenue + net income
  // -----------------------------------------------------------
  async function fetchIncomeTrend(ticker) {
    const data = await fmpGet("/income-statement/" + ticker + "?limit=4&period=quarter");
    if (!Array.isArray(data) || !data.length) return [];
    return data.map(q => ({
      date:              q.date        || "",
      revenue:           q.revenue     || null,
      netIncome:         q.netIncome   || null,
      grossMarginPct:    q.grossProfit && q.revenue ? parseFloat(((q.grossProfit / q.revenue) * 100).toFixed(1)) : null,
      revenueGrowthYoY:  null  // filled in below if 4 quarters available
    }));
  }

  // -----------------------------------------------------------
  // MASTER ENRICHMENT — runs all 6 fetches (parallel where safe)
  // Returns enrichedData object + updates Firestore candidate doc
  // -----------------------------------------------------------
  async function enrichCandidate(db, candidate) {
    const ticker = candidate.ticker;
    const price  = candidate.price || 0;
    const key    = getFMPKey();

    if (!key) {
      console.warn("[Enrichment] FMP key not set — skipping enrichment for " + ticker);
      return candidate;
    }

    console.log("[Enrichment] Enriching " + ticker + "...");

    // Run independent fetches in parallel to save time
    const [priceCtx, targets, ratings, metrics, surprises, income] = await Promise.all([
      fetchPriceContext(ticker, price),
      fetchAnalystTargets(ticker),
      fetchRatingChanges(ticker),
      fetchKeyMetrics(ticker),
      fetchEarningsSurprises(ticker),
      fetchIncomeTrend(ticker)
    ]);

    // Calculate YoY revenue growth if we have 4 quarters
    if (income && income.length === 4 && income[0].revenue && income[3].revenue) {
      const yoyGrowth = (((income[0].revenue - income[3].revenue) / Math.abs(income[3].revenue)) * 100).toFixed(1);
      income[0].revenueGrowthYoY = parseFloat(yoyGrowth);
    }

    // Derive upside % from analyst mean target
    let analystUpsidePct = null;
    if (targets && targets.targetMean && price > 0) {
      analystUpsidePct = parseFloat((((targets.targetMean - price) / price) * 100).toFixed(1));
    }

    // Count beat/miss streak
    let beatStreak = 0;
    if (surprises && surprises.length) {
      for (const s of surprises) {
        if (s.beat) beatStreak++;
        else break;
      }
    }

    // Most recent analyst action summary
    let latestRating = null;
    if (ratings && ratings.length) {
      const r = ratings[0];
      latestRating = r.firm + " " + r.action + " → " + r.toGrade + " (" + r.date + ")";
    }

    const enriched = {
      // Spread existing candidate fields
      ...candidate,

      // Price context
      sma20:             priceCtx?.sma20            ?? null,
      sma50:             priceCtx?.sma50            ?? null,
      pct5d:             priceCtx?.pct5             ?? null,
      pct30d:            priceCtx?.pct30            ?? null,
      pct90d:            priceCtx?.pct90            ?? null,
      high90d:           priceCtx?.high90           ?? null,
      low90d:            priceCtx?.low90            ?? null,
      aboveSMA20Streak:  priceCtx?.aboveSMA20Streak ?? null,
      volRatio5v20:      priceCtx?.volRatio         ?? null,

      // Analyst
      analystTargetMean:   targets?.targetMean   ?? null,
      analystTargetHigh:   targets?.targetHigh   ?? null,
      analystConsensus:    targets?.consensus    ?? null,
      analystUpsidePct,
      latestRating,
      ratingChanges:       ratings  || [],

      // Fundamentals
      keyMetrics:          metrics  || [],
      peRatioCurrent:      metrics && metrics[0] ? metrics[0].peRatio      : null,
      debtToEquity:        metrics && metrics[0] ? metrics[0].debtToEquity : null,
      roePct:              metrics && metrics[0] ? metrics[0].returnOnEquity : null,

      // Earnings
      earningsSurprises:   surprises || [],
      beatStreak,
      lastSurprisePct:     surprises && surprises[0] ? surprises[0].surprisePct : null,

      // Income
      incomeTrend:         income   || [],
      revenueGrowthYoY:    income && income[0] ? income[0].revenueGrowthYoY : null,
      grossMarginPct:      income && income[0] ? income[0].grossMarginPct   : null,

      enrichedAt: new Date().toISOString()
    };

    // Write enriched fields back to Firestore candidate doc
    // FIX: use enriched.sma20 / enriched.sma50 instead of bare sma20/sma50
    // (those were local vars inside fetchPriceContext, not in scope here)
    try {
      const cfg = window.STOCKS_CONFIG || {};
      const updatePayload = {
        sma20:            enriched.sma20,
        sma50:            enriched.sma50,
        pct5d:            enriched.pct5d,
        pct30d:           enriched.pct30d,
        pct90d:           enriched.pct90d,
        aboveSMA20Streak: enriched.aboveSMA20Streak,
        volRatio5v20:     enriched.volRatio5v20,
        analystTargetMean:  enriched.analystTargetMean,
        analystUpsidePct:   enriched.analystUpsidePct,
        analystConsensus:   enriched.analystConsensus,
        latestRating:       enriched.latestRating,
        peRatioCurrent:     enriched.peRatioCurrent,
        debtToEquity:       enriched.debtToEquity,
        roePct:             enriched.roePct,
        beatStreak:         enriched.beatStreak,
        lastSurprisePct:    enriched.lastSurprisePct,
        revenueGrowthYoY:   enriched.revenueGrowthYoY,
        grossMarginPct:     enriched.grossMarginPct,
        enrichedAt:         firebase.firestore.FieldValue.serverTimestamp()
      };

      // Remove undefined/null keys so Firestore doesn't complain
      Object.keys(updatePayload).forEach(k => { if (updatePayload[k] == null) delete updatePayload[k]; });

      await db
        .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
        .doc(ticker)
        .update(updatePayload);

      console.log("[Enrichment] \u2705 " + ticker + " enriched | " +
        "90d: " + enriched.pct90d + "% | " +
        "analyst target: $" + enriched.analystTargetMean + " (" + enriched.analystUpsidePct + "% upside) | " +
        "beat streak: " + enriched.beatStreak + " | " +
        "latest rating: " + (enriched.latestRating || "none")
      );
    } catch (e) {
      console.warn("[Enrichment] Firestore update error for " + ticker + ":", e);
    }

    return enriched;
  }

  // Expose
  window.enrichCandidate = enrichCandidate;
  console.log("[Stocks] Enrichment module loaded.");
})();
