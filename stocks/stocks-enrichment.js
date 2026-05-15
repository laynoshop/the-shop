// stocks/stocks-enrichment.js
// ENRICHMENT LAYER — rewritten for FMP Starter plan endpoints only.
// Uses: /profile, /ratios, /income-statement, /technical_indicator/daily (SMA/RSI),
//       /rating, /price-target-summary, /stock-price-change
// All confirmed full-access on Starter plan.

(function () {
  "use strict";

  function getFMPKey() { return (window.STOCKS_CONFIG || {}).FMP_KEY || ""; }

  // Fetch from FMP /stable/ base, fall back to /api/v3/ on 404
  async function fmpGet(path) {
    const key = getFMPKey();
    if (!key) return null;
    try {
      const stable = "https://financialmodelingprep.com/stable";
      const v3     = "https://financialmodelingprep.com/api/v3";
      const sep    = path.includes("?") ? "&" : "?";

      let res = await fetch(stable + path + sep + "apikey=" + key);
      if (res.status === 404) {
        res = await fetch(v3 + path + sep + "apikey=" + key);
      }
      if (!res.ok) {
        console.warn("[Enrichment] FMP error on", path, "status:", res.status);
        return null;
      }
      return await res.json() || null;
    } catch (e) {
      console.warn("[Enrichment] fetch error:", e.message);
      return null;
    }
  }

  // -----------------------------------------------------------
  // 1. COMPANY PROFILE — sector, beta, mktCap, analyst target, description
  //    Endpoint: /profile/{ticker}  [Full Access on Starter]
  // -----------------------------------------------------------
  async function fetchProfile(ticker) {
    const data = await fmpGet("/profile/" + ticker);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      companyName:    d.companyName   || null,
      sector:         d.sector        || null,
      industry:       d.industry      || null,
      beta:           d.beta          != null ? parseFloat(d.beta.toFixed(2))             : null,
      mktCap:         d.mktCap        || null,
      analystTarget:  d.dcfDiff       != null ? parseFloat(d.dcf.toFixed(2))              : null,
      priceTarget:    d.price         != null ? parseFloat(d.price.toFixed(2))             : null,
      description:    d.description   || null,
      exchange:       d.exchange      || null,
      country:        d.country       || null
    };
  }

  // -----------------------------------------------------------
  // 2. PRICE TARGET SUMMARY — analyst consensus target
  //    Endpoint: /price-target-summary?symbol={ticker}  [Full Access on Starter]
  // -----------------------------------------------------------
  async function fetchPriceTarget(ticker) {
    const data = await fmpGet("/price-target-summary?symbol=" + ticker);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      targetHigh:   d.targetHigh   != null ? parseFloat(d.targetHigh.toFixed(2))   : null,
      targetLow:    d.targetLow    != null ? parseFloat(d.targetLow.toFixed(2))    : null,
      targetMean:   d.targetMean   != null ? parseFloat(d.targetMean.toFixed(2))   : null,
      targetMedian: d.targetMedian != null ? parseFloat(d.targetMedian.toFixed(2)) : null,
      consensus:    d.consensus    || null
    };
  }

  // -----------------------------------------------------------
  // 3. ANALYST RATINGS — buy/hold/sell score
  //    Endpoint: /rating/{ticker}  [Full Access on Starter]
  // -----------------------------------------------------------
  async function fetchRating(ticker) {
    const data = await fmpGet("/rating/" + ticker);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      rating:           d.rating           || null,  // "S", "A", "B", etc.
      ratingScore:      d.ratingScore       != null ? d.ratingScore       : null,  // 1-5
      ratingRecommendation: d.ratingRecommendation || null,  // "Strong Buy", "Buy", etc.
      dcfScore:         d.ratingDetailsDCFScore           != null ? d.ratingDetailsDCFScore           : null,
      roeScore:         d.ratingDetailsROEScore           != null ? d.ratingDetailsROEScore           : null,
      roeRec:           d.ratingDetailsROERecommendation  || null,
      deRec:            d.ratingDetailsDERecommendation   || null,
      peRec:            d.ratingDetailsPERecommendation   || null,
      pbRec:            d.ratingDetailsPBRecommendation   || null
    };
  }

  // -----------------------------------------------------------
  // 4. FINANCIAL RATIOS — PE, debt/equity, ROE, current ratio
  //    Endpoint: /ratios/{ticker}?limit=2&period=quarter  [Full Access on Starter]
  // -----------------------------------------------------------
  async function fetchRatios(ticker) {
    const data = await fmpGet("/ratios/" + ticker + "?limit=2&period=quarter");
    if (!Array.isArray(data) || !data.length) return null;
    const d = data[0];
    return {
      peRatio:        d.priceEarningsRatio    != null ? parseFloat(d.priceEarningsRatio.toFixed(1))    : null,
      pbRatio:        d.priceToBookRatio      != null ? parseFloat(d.priceToBookRatio.toFixed(2))      : null,
      psRatio:        d.priceToSalesRatio     != null ? parseFloat(d.priceToSalesRatio.toFixed(2))     : null,
      debtToEquity:   d.debtEquityRatio       != null ? parseFloat(d.debtEquityRatio.toFixed(2))       : null,
      currentRatio:   d.currentRatio          != null ? parseFloat(d.currentRatio.toFixed(2))          : null,
      roe:            d.returnOnEquity        != null ? parseFloat((d.returnOnEquity * 100).toFixed(1)) : null,
      roa:            d.returnOnAssets        != null ? parseFloat((d.returnOnAssets * 100).toFixed(1)) : null,
      grossMargin:    d.grossProfitMargin     != null ? parseFloat((d.grossProfitMargin * 100).toFixed(1)) : null,
      netMargin:      d.netProfitMargin       != null ? parseFloat((d.netProfitMargin * 100).toFixed(1))  : null,
      date:           d.date                 || null
    };
  }

  // -----------------------------------------------------------
  // 5. INCOME STATEMENT — revenue trend, net income
  //    Endpoint: /income-statement/{ticker}?limit=4&period=quarter  [Full Access on Starter]
  // -----------------------------------------------------------
  async function fetchIncome(ticker) {
    const data = await fmpGet("/income-statement/" + ticker + "?limit=4&period=quarter");
    if (!Array.isArray(data) || !data.length) return null;
    const quarters = data.map(q => ({
      date:         q.date       || null,
      revenue:      q.revenue    || null,
      netIncome:    q.netIncome  || null,
      grossProfit:  q.grossProfit || null,
      eps:          q.eps        != null ? parseFloat(q.eps.toFixed(2)) : null
    }));
    // YoY revenue growth (Q1 this year vs Q1 last year)
    let revenueGrowthYoY = null;
    if (quarters.length >= 4 && quarters[0].revenue && quarters[3].revenue) {
      revenueGrowthYoY = parseFloat((((quarters[0].revenue - quarters[3].revenue) / Math.abs(quarters[3].revenue)) * 100).toFixed(1));
    }
    return { quarters, revenueGrowthYoY };
  }

  // -----------------------------------------------------------
  // 6. TECHNICAL INDICATORS — RSI(14), SMA(20), SMA(50), EMA(20)
  //    Endpoint: /technical_indicator/daily/{ticker}?type=rsi&period=14  [Full Access on Starter]
  // -----------------------------------------------------------
  async function fetchTechnicals(ticker) {
    const [rsiData, sma20Data, sma50Data, ema20Data] = await Promise.all([
      fmpGet("/technical_indicator/daily/" + ticker + "?type=rsi&period=14&limit=5"),
      fmpGet("/technical_indicator/daily/" + ticker + "?type=sma&period=20&limit=5"),
      fmpGet("/technical_indicator/daily/" + ticker + "?type=sma&period=50&limit=5"),
      fmpGet("/technical_indicator/daily/" + ticker + "?type=ema&period=20&limit=5")
    ]);

    const latest = (arr) => Array.isArray(arr) && arr.length ? arr[0] : null;
    const rsi   = latest(rsiData);
    const sma20 = latest(sma20Data);
    const sma50 = latest(sma50Data);
    const ema20 = latest(ema20Data);

    return {
      rsi14:      rsi   ? parseFloat((rsi.rsi   || rsi.value   || 0).toFixed(1)) : null,
      sma20:      sma20 ? parseFloat((sma20.sma || sma20.value || 0).toFixed(2)) : null,
      sma50:      sma50 ? parseFloat((sma50.sma || sma50.value || 0).toFixed(2)) : null,
      ema20:      ema20 ? parseFloat((ema20.ema || ema20.value || 0).toFixed(2)) : null,
      rsiSignal:  rsi ? (
        (rsi.rsi || rsi.value || 50) >= 70 ? "OVERBOUGHT" :
        (rsi.rsi || rsi.value || 50) <= 30 ? "OVERSOLD" : "NEUTRAL"
      ) : null
    };
  }

  // -----------------------------------------------------------
  // 7. STOCK PRICE CHANGE — 1D, 5D, 1M, 3M, 6M, 1Y % changes
  //    Endpoint: /stock-price-change/{ticker}  [Full Access on Starter]
  // -----------------------------------------------------------
  async function fetchPriceChange(ticker) {
    const data = await fmpGet("/stock-price-change/" + ticker);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      pct1d:  d["1D"]  != null ? parseFloat(d["1D"].toFixed(2))  : null,
      pct5d:  d["5D"]  != null ? parseFloat(d["5D"].toFixed(2))  : null,
      pct1m:  d["1M"]  != null ? parseFloat(d["1M"].toFixed(2))  : null,
      pct3m:  d["3M"]  != null ? parseFloat(d["3M"].toFixed(2))  : null,
      pct6m:  d["6M"]  != null ? parseFloat(d["6M"].toFixed(2))  : null,
      pct1y:  d["1Y"]  != null ? parseFloat(d["1Y"].toFixed(2))  : null
    };
  }

  // -----------------------------------------------------------
  // MASTER ENRICHMENT
  // -----------------------------------------------------------
  async function enrichCandidate(db, candidate) {
    const ticker = candidate.ticker;
    const price  = candidate.price || 0;
    const key    = getFMPKey();

    if (!key) {
      console.warn("[Enrichment] FMP key not set — skipping " + ticker);
      return candidate;
    }

    console.log("[Enrichment] Enriching " + ticker + "...");

    const [profile, priceTarget, rating, ratios, income, technicals, priceChange] = await Promise.all([
      fetchProfile(ticker),
      fetchPriceTarget(ticker),
      fetchRating(ticker),
      fetchRatios(ticker),
      fetchIncome(ticker),
      fetchTechnicals(ticker),
      fetchPriceChange(ticker)
    ]);

    // Analyst upside %
    let analystUpsidePct = null;
    if (priceTarget && priceTarget.targetMean && price > 0) {
      analystUpsidePct = parseFloat((((priceTarget.targetMean - price) / price) * 100).toFixed(1));
    }

    // Above/below SMA20
    const aboveSMA20 = (technicals && technicals.sma20 && price > 0)
      ? price > technicals.sma20
      : null;

    const enriched = {
      ...candidate,
      // Profile
      companyName:        profile?.companyName        ?? null,
      sector:             profile?.sector             ?? null,
      industry:           profile?.industry           ?? null,
      beta:               profile?.beta               ?? null,
      mktCap:             profile?.mktCap             ?? null,
      exchange:           profile?.exchange           ?? null,
      // Price changes
      pct1d:              priceChange?.pct1d          ?? null,
      pct5d:              priceChange?.pct5d          ?? null,
      pct1m:              priceChange?.pct1m          ?? null,
      pct3m:              priceChange?.pct3m          ?? null,
      pct6m:              priceChange?.pct6m          ?? null,
      pct1y:              priceChange?.pct1y          ?? null,
      // Technicals
      rsi14:              technicals?.rsi14           ?? null,
      rsiSignal:          technicals?.rsiSignal       ?? null,
      sma20:              technicals?.sma20           ?? null,
      sma50:              technicals?.sma50           ?? null,
      ema20:              technicals?.ema20           ?? null,
      aboveSMA20,
      // Analyst
      analystTargetMean:  priceTarget?.targetMean     ?? null,
      analystTargetHigh:  priceTarget?.targetHigh     ?? null,
      analystTargetLow:   priceTarget?.targetLow      ?? null,
      analystConsensus:   priceTarget?.consensus      ?? null,
      analystUpsidePct,
      ratingRecommendation: rating?.ratingRecommendation ?? null,
      ratingScore:        rating?.ratingScore         ?? null,
      // Fundamentals
      peRatio:            ratios?.peRatio             ?? null,
      pbRatio:            ratios?.pbRatio             ?? null,
      debtToEquity:       ratios?.debtToEquity        ?? null,
      currentRatio:       ratios?.currentRatio        ?? null,
      roe:                ratios?.roe                 ?? null,
      grossMarginPct:     ratios?.grossMargin         ?? null,
      netMarginPct:       ratios?.netMargin           ?? null,
      // Income trend
      revenueGrowthYoY:   income?.revenueGrowthYoY   ?? null,
      latestEps:          income?.quarters?.[0]?.eps  ?? null,
      enrichedAt:         new Date().toISOString()
    };

    // Persist enrichment back to Firestore
    try {
      const cfg = window.STOCKS_CONFIG || {};
      const payload = {
        sector:               enriched.sector,
        industry:             enriched.industry,
        beta:                 enriched.beta,
        pct1d:                enriched.pct1d,
        pct5d:                enriched.pct5d,
        pct1m:                enriched.pct1m,
        pct3m:                enriched.pct3m,
        rsi14:                enriched.rsi14,
        rsiSignal:            enriched.rsiSignal,
        sma20:                enriched.sma20,
        sma50:                enriched.sma50,
        ema20:                enriched.ema20,
        aboveSMA20:           enriched.aboveSMA20,
        analystTargetMean:    enriched.analystTargetMean,
        analystUpsidePct:     enriched.analystUpsidePct,
        analystConsensus:     enriched.analystConsensus,
        ratingRecommendation: enriched.ratingRecommendation,
        ratingScore:          enriched.ratingScore,
        peRatio:              enriched.peRatio,
        debtToEquity:         enriched.debtToEquity,
        roe:                  enriched.roe,
        grossMarginPct:       enriched.grossMarginPct,
        netMarginPct:         enriched.netMarginPct,
        revenueGrowthYoY:     enriched.revenueGrowthYoY,
        latestEps:            enriched.latestEps,
        enrichedAt:           firebase.firestore.FieldValue.serverTimestamp()
      };

      // Strip nulls so we don't overwrite existing data with null
      Object.keys(payload).forEach(k => { if (payload[k] == null) delete payload[k]; });

      await db
        .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
        .doc(ticker)
        .update(payload);

      console.log("[Enrichment] \u2705 " + ticker + " enriched | " +
        "RSI: " + enriched.rsi14 + " (" + (enriched.rsiSignal || "?") + ") | " +
        "SMA20: $" + enriched.sma20 + " | " +
        "1M: " + enriched.pct1m + "% | " +
        "analyst target: $" + enriched.analystTargetMean + " (" + enriched.analystUpsidePct + "% upside) | " +
        "rating: " + (enriched.ratingRecommendation || "none")
      );
    } catch (e) {
      console.warn("[Enrichment] Firestore update error for " + ticker + ":", e.message);
    }

    return enriched;
  }

  window.enrichCandidate = enrichCandidate;
  console.log("[Stocks] Enrichment module loaded.");
})();
