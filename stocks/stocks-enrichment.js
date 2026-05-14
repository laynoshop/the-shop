// stocks/stocks-enrichment.js
// ENRICHMENT LAYER — sits between Tier 1 and Tier 2.
// Updated endpoint paths to FMP /stable/ API (replaces deprecated /v3/ routes
// that return 403 on paid plans after FMP's 2024 API migration).

(function () {
  "use strict";

  function getFMPKey() { return (window.STOCKS_CONFIG || {}).FMP_KEY || ""; }
  function delay(ms)   { return new Promise(r => setTimeout(r, ms)); }

  // Small helper — fetch JSON from FMP, return null on any error
  // Uses /stable/ base which works for Starter plan and above
  async function fmpGet(path) {
    const key = getFMPKey();
    if (!key) return null;
    try {
      // Try /stable/ first (new FMP API), fall back to /api/v3/ if 404
      const baseStable = "https://financialmodelingprep.com/stable";
      const baseV3     = "https://financialmodelingprep.com/api/v3";
      const sep        = path.includes("?") ? "&" : "?";

      let res = await fetch(baseStable + path + sep + "apikey=" + key);
      if (res.status === 404) {
        // Endpoint not on /stable/ yet — fall back to v3
        res = await fetch(baseV3 + path + sep + "apikey=" + key);
      }
      if (!res.ok) {
        console.warn("[Enrichment] FMP 403/error on", path, "status:", res.status);
        return null;
      }
      const data = await res.json();
      return data || null;
    } catch (e) {
      console.warn("[Enrichment] fmpGet fetch error:", e.message);
      return null;
    }
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

    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const sma20 = prices.length >= 20 ? parseFloat(avg(prices.slice(0, 20)).toFixed(2)) : null;
    const sma50 = prices.length >= 50 ? parseFloat(avg(prices.slice(0, 50)).toFixed(2)) : null;

    let aboveSMA20Streak = 0;
    if (sma20) {
      for (let i = 0; i < Math.min(prices.length, 30); i++) {
        if (prices[i] > sma20) aboveSMA20Streak++;
        else break;
      }
    }

    const vols     = history.map(d => d.volume || 0);
    const vol5avg  = vols.length >= 5  ? parseFloat(avg(vols.slice(0, 5)).toFixed(0))  : null;
    const vol20avg = vols.length >= 20 ? parseFloat(avg(vols.slice(0, 20)).toFixed(0)) : null;
    const volRatio = (vol5avg && vol20avg && vol20avg > 0) ? parseFloat((vol5avg / vol20avg).toFixed(2)) : null;

    return { high90, low90, pct5, pct30, pct90, sma20, sma50, aboveSMA20Streak, vol5avg, vol20avg, volRatio };
  }

  // -----------------------------------------------------------
  // 2. ANALYST TARGETS
  // -----------------------------------------------------------
  async function fetchAnalystTargets(ticker) {
    const data = await fmpGet("/price-target-consensus?symbol=" + ticker);
    if (!data) return null;
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      targetHigh:   d.targetHigh   || null,
      targetLow:    d.targetLow    || null,
      targetMean:   d.targetMean   || null,
      targetMedian: d.targetMedian || null,
      consensus:    d.consensus    || null
    };
  }

  // -----------------------------------------------------------
  // 3. UPGRADES / DOWNGRADES
  // -----------------------------------------------------------
  async function fetchRatingChanges(ticker) {
    const data = await fmpGet("/upgrades-downgrades?symbol=" + ticker + "&limit=5");
    if (!Array.isArray(data) || !data.length) return [];
    return data.slice(0, 5).map(r => ({
      date:      r.publishedDate ? r.publishedDate.slice(0, 10) : "",
      firm:      r.gradingCompany || "",
      action:    r.action || "",
      fromGrade: r.previousGrade || "",
      toGrade:   r.newGrade || ""
    }));
  }

  // -----------------------------------------------------------
  // 4. KEY METRICS
  // -----------------------------------------------------------
  async function fetchKeyMetrics(ticker) {
    const data = await fmpGet("/key-metrics?symbol=" + ticker + "&limit=4&period=quarter");
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
  // 5. EARNINGS SURPRISES
  // -----------------------------------------------------------
  async function fetchEarningsSurprises(ticker) {
    const data = await fmpGet("/earnings-surprises?symbol=" + ticker);
    if (!Array.isArray(data) || !data.length) return [];
    return data.slice(0, 4).map(e => ({
      date:        e.date || "",
      estimated:   e.estimatedEps != null ? parseFloat(e.estimatedEps.toFixed(2)) : null,
      actual:      e.actualEps    != null ? parseFloat(e.actualEps.toFixed(2))    : null,
      surprisePct: (e.estimatedEps && e.estimatedEps !== 0)
                     ? parseFloat((((e.actualEps - e.estimatedEps) / Math.abs(e.estimatedEps)) * 100).toFixed(1))
                     : null,
      beat: e.actualEps != null && e.estimatedEps != null && e.actualEps > e.estimatedEps
    }));
  }

  // -----------------------------------------------------------
  // 6. INCOME TREND
  // -----------------------------------------------------------
  async function fetchIncomeTrend(ticker) {
    const data = await fmpGet("/income-statement?symbol=" + ticker + "&limit=4&period=quarter");
    if (!Array.isArray(data) || !data.length) return [];
    return data.map(q => ({
      date:             q.date      || "",
      revenue:          q.revenue   || null,
      netIncome:        q.netIncome || null,
      grossMarginPct:   q.grossProfit && q.revenue ? parseFloat(((q.grossProfit / q.revenue) * 100).toFixed(1)) : null,
      revenueGrowthYoY: null
    }));
  }

  // -----------------------------------------------------------
  // MASTER ENRICHMENT
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

    const [priceCtx, targets, ratings, metrics, surprises, income] = await Promise.all([
      fetchPriceContext(ticker, price),
      fetchAnalystTargets(ticker),
      fetchRatingChanges(ticker),
      fetchKeyMetrics(ticker),
      fetchEarningsSurprises(ticker),
      fetchIncomeTrend(ticker)
    ]);

    if (income && income.length === 4 && income[0].revenue && income[3].revenue) {
      const yoyGrowth = (((income[0].revenue - income[3].revenue) / Math.abs(income[3].revenue)) * 100).toFixed(1);
      income[0].revenueGrowthYoY = parseFloat(yoyGrowth);
    }

    let analystUpsidePct = null;
    if (targets && targets.targetMean && price > 0) {
      analystUpsidePct = parseFloat((((targets.targetMean - price) / price) * 100).toFixed(1));
    }

    let beatStreak = 0;
    if (surprises && surprises.length) {
      for (const s of surprises) {
        if (s.beat) beatStreak++;
        else break;
      }
    }

    let latestRating = null;
    if (ratings && ratings.length) {
      const r = ratings[0];
      latestRating = r.firm + " " + r.action + " \u2192 " + r.toGrade + " (" + r.date + ")";
    }

    const enriched = {
      ...candidate,
      sma20:            priceCtx?.sma20            ?? null,
      sma50:            priceCtx?.sma50            ?? null,
      pct5d:            priceCtx?.pct5             ?? null,
      pct30d:           priceCtx?.pct30            ?? null,
      pct90d:           priceCtx?.pct90            ?? null,
      high90d:          priceCtx?.high90           ?? null,
      low90d:           priceCtx?.low90            ?? null,
      aboveSMA20Streak: priceCtx?.aboveSMA20Streak ?? null,
      volRatio5v20:     priceCtx?.volRatio         ?? null,
      analystTargetMean:  targets?.targetMean  ?? null,
      analystTargetHigh:  targets?.targetHigh  ?? null,
      analystConsensus:   targets?.consensus   ?? null,
      analystUpsidePct,
      latestRating,
      ratingChanges:      ratings  || [],
      keyMetrics:         metrics  || [],
      peRatioCurrent:     metrics && metrics[0] ? metrics[0].peRatio      : null,
      debtToEquity:       metrics && metrics[0] ? metrics[0].debtToEquity : null,
      roePct:             metrics && metrics[0] ? metrics[0].returnOnEquity : null,
      earningsSurprises:  surprises || [],
      beatStreak,
      lastSurprisePct:    surprises && surprises[0] ? surprises[0].surprisePct : null,
      incomeTrend:        income   || [],
      revenueGrowthYoY:   income && income[0] ? income[0].revenueGrowthYoY : null,
      grossMarginPct:     income && income[0] ? income[0].grossMarginPct   : null,
      enrichedAt: new Date().toISOString()
    };

    try {
      const cfg = window.STOCKS_CONFIG || {};
      const updatePayload = {
        sma20:             enriched.sma20,
        sma50:             enriched.sma50,
        pct5d:             enriched.pct5d,
        pct30d:            enriched.pct30d,
        pct90d:            enriched.pct90d,
        aboveSMA20Streak:  enriched.aboveSMA20Streak,
        volRatio5v20:      enriched.volRatio5v20,
        analystTargetMean: enriched.analystTargetMean,
        analystUpsidePct:  enriched.analystUpsidePct,
        analystConsensus:  enriched.analystConsensus,
        latestRating:      enriched.latestRating,
        peRatioCurrent:    enriched.peRatioCurrent,
        debtToEquity:      enriched.debtToEquity,
        roePct:            enriched.roePct,
        beatStreak:        enriched.beatStreak,
        lastSurprisePct:   enriched.lastSurprisePct,
        revenueGrowthYoY:  enriched.revenueGrowthYoY,
        grossMarginPct:    enriched.grossMarginPct,
        enrichedAt:        firebase.firestore.FieldValue.serverTimestamp()
      };

      Object.keys(updatePayload).forEach(k => { if (updatePayload[k] == null) delete updatePayload[k]; });

      await db
        .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
        .doc(ticker)
        .update(updatePayload);

      console.log("[Enrichment] \u2705 " + ticker + " enriched | " +
        "90d: " + enriched.pct90d + "% | " +
        "SMA20: $" + enriched.sma20 + " | " +
        "analyst target: $" + enriched.analystTargetMean + " (" + enriched.analystUpsidePct + "% upside) | " +
        "beat streak: " + enriched.beatStreak + " | " +
        "latest rating: " + (enriched.latestRating || "none")
      );
    } catch (e) {
      console.warn("[Enrichment] Firestore update error for " + ticker + ":", e);
    }

    return enriched;
  }

  window.enrichCandidate = enrichCandidate;
  console.log("[Stocks] Enrichment module loaded.");
})();
