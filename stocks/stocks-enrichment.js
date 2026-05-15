// stocks/stocks-enrichment.js
// ENRICHMENT LAYER — FMP Starter plan, confirmed-accessible endpoints only.
// Base: /api/v3/ (Starter plan default), falls back to /stable/ on 404.
// Endpoints: /profile, /ratios, /income-statement,
//            /technical_indicator/daily (RSI/SMA/EMA),
//            /rating, /price-target-summary, /stock-price-change

(function () {
  "use strict";

  function getFMPKey() { return (window.STOCKS_CONFIG || {}).FMP_KEY || ""; }

  // Try v3 first (Starter plan default), fall back to /stable/ on 404 only.
  // 403 means truly no access — don't retry, just return null.
  async function fmpGet(path) {
    const key = getFMPKey();
    if (!key) return null;
    const sep = path.includes("?") ? "&" : "?";
    const v3     = "https://financialmodelingprep.com/api/v3";
    const stable = "https://financialmodelingprep.com/stable";
    try {
      let res = await fetch(v3 + path + sep + "apikey=" + key);
      if (res.status === 404) {
        res = await fetch(stable + path + sep + "apikey=" + key);
      }
      if (!res.ok) {
        console.warn("[Enrichment] FMP " + res.status + " on", path);
        return null;
      }
      const json = await res.json();
      return json || null;
    } catch (e) {
      console.warn("[Enrichment] fetch error:", e.message);
      return null;
    }
  }

  // -----------------------------------------------------------
  // 1. COMPANY PROFILE
  //    GET /api/v3/profile/{ticker}
  // -----------------------------------------------------------
  async function fetchProfile(ticker) {
    const data = await fmpGet("/profile/" + ticker);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      companyName: d.companyName  || null,
      sector:      d.sector       || null,
      industry:    d.industry     || null,
      beta:        d.beta         != null ? parseFloat(d.beta.toFixed(2))   : null,
      mktCap:      d.mktCap       || null,
      exchange:    d.exchange     || null,
      country:     d.country      || null,
      description: d.description  || null
    };
  }

  // -----------------------------------------------------------
  // 2. PRICE TARGET SUMMARY
  //    GET /api/v3/price-target-summary?symbol={ticker}
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
  // 3. ANALYST RATING
  //    GET /api/v3/rating/{ticker}
  // -----------------------------------------------------------
  async function fetchRating(ticker) {
    const data = await fmpGet("/rating/" + ticker);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      rating:               d.rating                          || null,
      ratingScore:          d.ratingScore                     != null ? d.ratingScore : null,
      ratingRecommendation: d.ratingRecommendation            || null,
      dcfScore:             d.ratingDetailsDCFScore           != null ? d.ratingDetailsDCFScore : null,
      roeRec:               d.ratingDetailsROERecommendation  || null,
      deRec:                d.ratingDetailsDERecommendation   || null,
      peRec:                d.ratingDetailsPERecommendation   || null
    };
  }

  // -----------------------------------------------------------
  // 4. FINANCIAL RATIOS (quarterly)
  //    GET /api/v3/ratios/{ticker}?limit=2&period=quarter
  // -----------------------------------------------------------
  async function fetchRatios(ticker) {
    const data = await fmpGet("/ratios/" + ticker + "?limit=2&period=quarter");
    if (!Array.isArray(data) || !data.length) return null;
    const d = data[0];
    return {
      peRatio:      d.priceEarningsRatio != null ? parseFloat(d.priceEarningsRatio.toFixed(1))        : null,
      pbRatio:      d.priceToBookRatio   != null ? parseFloat(d.priceToBookRatio.toFixed(2))          : null,
      debtToEquity: d.debtEquityRatio    != null ? parseFloat(d.debtEquityRatio.toFixed(2))           : null,
      currentRatio: d.currentRatio       != null ? parseFloat(d.currentRatio.toFixed(2))              : null,
      roe:          d.returnOnEquity     != null ? parseFloat((d.returnOnEquity * 100).toFixed(1))     : null,
      grossMargin:  d.grossProfitMargin  != null ? parseFloat((d.grossProfitMargin * 100).toFixed(1)) : null,
      netMargin:    d.netProfitMargin    != null ? parseFloat((d.netProfitMargin * 100).toFixed(1))   : null
    };
  }

  // -----------------------------------------------------------
  // 5. INCOME STATEMENT (quarterly, last 4 quarters)
  //    GET /api/v3/income-statement/{ticker}?limit=4&period=quarter
  // -----------------------------------------------------------
  async function fetchIncome(ticker) {
    const data = await fmpGet("/income-statement/" + ticker + "?limit=4&period=quarter");
    if (!Array.isArray(data) || !data.length) return null;
    const quarters = data.map(q => ({
      date:        q.date        || null,
      revenue:     q.revenue     || null,
      netIncome:   q.netIncome   || null,
      grossProfit: q.grossProfit || null,
      eps:         q.eps         != null ? parseFloat(q.eps.toFixed(2)) : null
    }));
    let revenueGrowthYoY = null;
    if (quarters.length >= 4 && quarters[0].revenue && quarters[3].revenue) {
      revenueGrowthYoY = parseFloat(
        (((quarters[0].revenue - quarters[3].revenue) / Math.abs(quarters[3].revenue)) * 100).toFixed(1)
      );
    }
    return { quarters, revenueGrowthYoY };
  }

  // -----------------------------------------------------------
  // 6. TECHNICAL INDICATORS — RSI(14), SMA(20), SMA(50), EMA(20)
  //    GET /api/v3/technical_indicator/daily/{ticker}?type=rsi&period=14&limit=5
  // -----------------------------------------------------------
  async function fetchTechnicals(ticker) {
    const base = "/technical_indicator/daily/" + ticker;
    const [rsiData, sma20Data, sma50Data, ema20Data] = await Promise.all([
      fmpGet(base + "?type=rsi&period=14&limit=5"),
      fmpGet(base + "?type=sma&period=20&limit=5"),
      fmpGet(base + "?type=sma&period=50&limit=5"),
      fmpGet(base + "?type=ema&period=20&limit=5")
    ]);

    const first = (arr) => Array.isArray(arr) && arr.length ? arr[0] : null;
    const rsi   = first(rsiData);
    const sma20 = first(sma20Data);
    const sma50 = first(sma50Data);
    const ema20 = first(ema20Data);

    const rsiVal = rsi ? parseFloat(((rsi.rsi || rsi.value || 0)).toFixed(1)) : null;

    return {
      rsi14:     rsiVal,
      sma20:     sma20 ? parseFloat(((sma20.sma || sma20.value || 0)).toFixed(2)) : null,
      sma50:     sma50 ? parseFloat(((sma50.sma || sma50.value || 0)).toFixed(2)) : null,
      ema20:     ema20 ? parseFloat(((ema20.ema || ema20.value || 0)).toFixed(2)) : null,
      rsiSignal: rsiVal != null
        ? (rsiVal >= 70 ? "OVERBOUGHT" : rsiVal <= 30 ? "OVERSOLD" : "NEUTRAL")
        : null
    };
  }

  // -----------------------------------------------------------
  // 7. STOCK PRICE CHANGE — 1D, 5D, 1M, 3M, 6M, 1Y
  //    GET /api/v3/stock-price-change/{ticker}
  // -----------------------------------------------------------
  async function fetchPriceChange(ticker) {
    const data = await fmpGet("/stock-price-change/" + ticker);
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    const fmt = (v) => v != null ? parseFloat(v.toFixed(2)) : null;
    return {
      pct1d: fmt(d["1D"]),
      pct5d: fmt(d["5D"]),
      pct1m: fmt(d["1M"]),
      pct3m: fmt(d["3M"]),
      pct6m: fmt(d["6M"]),
      pct1y: fmt(d["1Y"])
    };
  }

  // -----------------------------------------------------------
  // MASTER ENRICHMENT
  // -----------------------------------------------------------
  async function enrichCandidate(db, candidate) {
    const ticker = candidate.ticker;
    const price  = candidate.price || 0;

    if (!getFMPKey()) {
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

    // Derived: analyst upside %
    let analystUpsidePct = null;
    if (priceTarget?.targetMean && price > 0) {
      analystUpsidePct = parseFloat((((priceTarget.targetMean - price) / price) * 100).toFixed(1));
    }

    // Derived: price vs SMA20
    const aboveSMA20 = (technicals?.sma20 && price > 0) ? price > technicals.sma20 : null;

    const enriched = {
      ...candidate,
      // Profile
      companyName:          profile?.companyName        ?? null,
      sector:               profile?.sector             ?? null,
      industry:             profile?.industry           ?? null,
      beta:                 profile?.beta               ?? null,
      mktCap:               profile?.mktCap             ?? null,
      exchange:             profile?.exchange           ?? null,
      // Price momentum
      pct1d:                priceChange?.pct1d          ?? null,
      pct5d:                priceChange?.pct5d          ?? null,
      pct1m:                priceChange?.pct1m          ?? null,
      pct3m:                priceChange?.pct3m          ?? null,
      pct6m:                priceChange?.pct6m          ?? null,
      pct1y:                priceChange?.pct1y          ?? null,
      // Technicals
      rsi14:                technicals?.rsi14           ?? null,
      rsiSignal:            technicals?.rsiSignal       ?? null,
      sma20:                technicals?.sma20           ?? null,
      sma50:                technicals?.sma50           ?? null,
      ema20:                technicals?.ema20           ?? null,
      aboveSMA20,
      // Analyst
      analystTargetMean:    priceTarget?.targetMean     ?? null,
      analystTargetHigh:    priceTarget?.targetHigh     ?? null,
      analystTargetLow:     priceTarget?.targetLow      ?? null,
      analystConsensus:     priceTarget?.consensus      ?? null,
      analystUpsidePct,
      ratingRecommendation: rating?.ratingRecommendation ?? null,
      ratingScore:          rating?.ratingScore         ?? null,
      // Fundamentals
      peRatio:              ratios?.peRatio             ?? null,
      pbRatio:              ratios?.pbRatio             ?? null,
      debtToEquity:         ratios?.debtToEquity        ?? null,
      currentRatio:         ratios?.currentRatio        ?? null,
      roe:                  ratios?.roe                 ?? null,
      grossMarginPct:       ratios?.grossMargin         ?? null,
      netMarginPct:         ratios?.netMargin           ?? null,
      // Income trend
      revenueGrowthYoY:     income?.revenueGrowthYoY   ?? null,
      latestEps:            income?.quarters?.[0]?.eps  ?? null,
      enrichedAt:           new Date().toISOString()
    };

    // Persist to Firestore (strip nulls so we never clobber existing good data)
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
      Object.keys(payload).forEach(k => { if (payload[k] == null) delete payload[k]; });

      await db
        .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
        .doc(ticker)
        .update(payload);

      console.log("[Enrichment] \u2705 " + ticker +
        " | RSI: " + (enriched.rsi14 ?? "null") + " (" + (enriched.rsiSignal || "?") + ")" +
        " | SMA20: $" + (enriched.sma20 ?? "null") +
        " | 1M: " + (enriched.pct1m ?? "null") + "%" +
        " | target: $" + (enriched.analystTargetMean ?? "null") +
        " (" + (enriched.analystUpsidePct ?? "null") + "% upside)" +
        " | rating: " + (enriched.ratingRecommendation || "none")
      );
    } catch (e) {
      console.warn("[Enrichment] Firestore update error for " + ticker + ":", e.message);
    }

    return enriched;
  }

  window.enrichCandidate = enrichCandidate;
  console.log("[Stocks] Enrichment module loaded.");
})();
