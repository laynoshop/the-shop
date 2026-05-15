// stocks/stocks-enrichment.js
// ENRICHMENT LAYER — FMP /stable/ API (post-August 2025 accounts, Starter plan).
// RSI + SMA/EMA computed locally from /historical-price-eod/full (free).
// key-metrics dropped (402 on Starter). Income statement kept (free for stocks).

(function () {
  "use strict";

  const FMP_BASE = "https://financialmodelingprep.com/stable";

  function getFMPKey() { return (window.STOCKS_CONFIG || {}).FMP_KEY || ""; }

  async function fmpGet(endpoint, params) {
    const key = getFMPKey();
    if (!key) return null;
    try {
      const qs = new URLSearchParams({ ...params, apikey: key }).toString();
      const res = await fetch(FMP_BASE + "/" + endpoint + "?" + qs);
      if (!res.ok) {
        console.warn("[Enrichment] FMP " + res.status + " on /" + endpoint + " for " + (params.symbol || ""));
        return null;
      }
      return await res.json() || null;
    } catch (e) {
      console.warn("[Enrichment] fetch error:", e.message);
      return null;
    }
  }

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
  // 1. COMPANY PROFILE — free
  // -----------------------------------------------------------
  async function fetchProfile(ticker) {
    const data = await fmpGet("profile", { symbol: ticker });
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    return {
      companyName: d.companyName || null,
      sector:      d.sector      || null,
      industry:    d.industry    || null,
      beta:        d.beta        != null ? parseFloat(parseFloat(d.beta).toFixed(2)) : null,
      mktCap:      d.mktCap      || null,
      exchange:    d.exchange    || null
    };
  }

  // -----------------------------------------------------------
  // 2. PRICE TARGET SUMMARY — free on Starter
  // -----------------------------------------------------------
  async function fetchPriceTarget(ticker) {
    const data = await fmpGet("price-target-summary", { symbol: ticker });
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
  // 3. INCOME STATEMENT — free for stocks (ETFs return empty, graceful)
  // -----------------------------------------------------------
  async function fetchIncome(ticker) {
    const data = await fmpGet("income-statement", { symbol: ticker, period: "quarter", limit: 4 });
    if (!Array.isArray(data) || !data.length) return null;
    const quarters = data.map(q => ({
      date:      q.date    || null,
      revenue:   q.revenue || null,
      eps:       q.eps     != null ? parseFloat(parseFloat(q.eps).toFixed(2)) : null
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
  // 4. TECHNICALS from EOD history — free
  //    GET /stable/historical-price-eod/full?symbol={ticker}&limit=60
  // -----------------------------------------------------------
  async function fetchTechnicals(ticker) {
    const data = await fmpGet("historical-price-eod/full", { symbol: ticker, limit: 60 });
    const hist = data?.historical || (Array.isArray(data) ? data : null);
    if (!hist || hist.length < 20) {
      console.warn("[Enrichment] Not enough EOD history for " + ticker + " (" + (hist?.length || 0) + " bars)");
      return null;
    }
    const closes = hist.map(d => parseFloat(d.close || d.adjClose || 0)).filter(v => v > 0);
    const rsiVal  = computeRSI(closes, 14);
    const sma20   = computeSMA(closes, 20);
    const sma50   = computeSMA(closes, 50);
    const ema20   = computeEMA(closes, 20);
    return {
      rsi14:     rsiVal,
      sma20,
      sma50,
      ema20,
      rsiSignal: rsiVal != null
        ? (rsiVal >= 70 ? "OVERBOUGHT" : rsiVal <= 30 ? "OVERSOLD" : "NEUTRAL")
        : null
    };
  }

  // -----------------------------------------------------------
  // 5. STOCK PRICE CHANGE — free
  // -----------------------------------------------------------
  async function fetchPriceChange(ticker) {
    const data = await fmpGet("stock-price-change", { symbol: ticker });
    const d = Array.isArray(data) ? data[0] : data;
    if (!d) return null;
    const fmt = (v) => v != null ? parseFloat(parseFloat(v).toFixed(2)) : null;
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

    const [profile, priceTarget, income, technicals, priceChange] = await Promise.all([
      fetchProfile(ticker),
      fetchPriceTarget(ticker),
      fetchIncome(ticker),
      fetchTechnicals(ticker),
      fetchPriceChange(ticker)
    ]);

    let analystUpsidePct = null;
    if (priceTarget?.targetMean && price > 0) {
      analystUpsidePct = parseFloat((((priceTarget.targetMean - price) / price) * 100).toFixed(1));
    }
    const aboveSMA20 = (technicals?.sma20 && price > 0) ? price > technicals.sma20 : null;

    const enriched = {
      ...candidate,
      companyName:       profile?.companyName        ?? null,
      sector:            profile?.sector             ?? null,
      industry:          profile?.industry           ?? null,
      beta:              profile?.beta               ?? null,
      mktCap:            profile?.mktCap             ?? null,
      exchange:          profile?.exchange           ?? null,
      pct1d:             priceChange?.pct1d          ?? null,
      pct5d:             priceChange?.pct5d          ?? null,
      pct1m:             priceChange?.pct1m          ?? null,
      pct3m:             priceChange?.pct3m          ?? null,
      pct6m:             priceChange?.pct6m          ?? null,
      pct1y:             priceChange?.pct1y          ?? null,
      rsi14:             technicals?.rsi14           ?? null,
      rsiSignal:         technicals?.rsiSignal       ?? null,
      sma20:             technicals?.sma20           ?? null,
      sma50:             technicals?.sma50           ?? null,
      ema20:             technicals?.ema20           ?? null,
      aboveSMA20,
      analystTargetMean: priceTarget?.targetMean     ?? null,
      analystTargetHigh: priceTarget?.targetHigh     ?? null,
      analystTargetLow:  priceTarget?.targetLow      ?? null,
      analystConsensus:  priceTarget?.consensus      ?? null,
      analystUpsidePct,
      revenueGrowthYoY:  income?.revenueGrowthYoY   ?? null,
      latestEps:         income?.quarters?.[0]?.eps  ?? null,
      enrichedAt:        new Date().toISOString()
    };

    try {
      const cfg = window.STOCKS_CONFIG || {};
      const payload = {
        sector:            enriched.sector,
        industry:          enriched.industry,
        beta:              enriched.beta,
        pct1d:             enriched.pct1d,
        pct5d:             enriched.pct5d,
        pct1m:             enriched.pct1m,
        pct3m:             enriched.pct3m,
        rsi14:             enriched.rsi14,
        rsiSignal:         enriched.rsiSignal,
        sma20:             enriched.sma20,
        sma50:             enriched.sma50,
        ema20:             enriched.ema20,
        aboveSMA20:        enriched.aboveSMA20,
        analystTargetMean: enriched.analystTargetMean,
        analystUpsidePct:  enriched.analystUpsidePct,
        analystConsensus:  enriched.analystConsensus,
        revenueGrowthYoY:  enriched.revenueGrowthYoY,
        latestEps:         enriched.latestEps,
        enrichedAt:        firebase.firestore.FieldValue.serverTimestamp()
      };
      Object.keys(payload).forEach(k => { if (payload[k] == null) delete payload[k]; });
      await db
        .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
        .doc(ticker)
        .update(payload);

      console.log("[Enrichment] ✅ " + ticker +
        " | RSI: " + (enriched.rsi14 ?? "null") + " (" + (enriched.rsiSignal || "?") + ")" +
        " | SMA20: $" + (enriched.sma20 ?? "null") +
        " | 1M: " + (enriched.pct1m ?? "null") + "%" +
        " | target: $" + (enriched.analystTargetMean ?? "null") +
        " (" + (enriched.analystUpsidePct ?? "null") + "% upside)"
      );
    } catch (e) {
      console.warn("[Enrichment] Firestore update error for " + ticker + ":", e.message);
    }

    return enriched;
  }

  window.enrichCandidate = enrichCandidate;
  console.log("[Stocks] Enrichment module loaded.");
})();
