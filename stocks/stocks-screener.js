// stocks/stocks-screener.js
// TIER 1 — Client-side screener (for development/testing).
// In production this logic runs in a Firebase Scheduled Cloud Function.
// This file lets you run + test the screener right from the browser
// before wiring up the backend, so you can see real signals immediately.

(function () {
  "use strict";

  // -----------------------------------------------------------
  // Key helpers — always read from STOCKS_CONFIG (Remote Config)
  // -----------------------------------------------------------
  function getFinnhubKey() {
    return (window.STOCKS_CONFIG || {}).FINNHUB_KEY || "";
  }
  function getAVKey() {
    return (window.STOCKS_CONFIG || {}).AV_KEY || "";
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function isMarketOpen() {
    const now = new Date();
    const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = et.getDay();
    if (day === 0 || day === 6) return false;
    const h   = et.getHours();
    const m   = et.getMinutes();
    const cfg = window.STOCKS_CONFIG || {};
    const openMins  = (cfg.MARKET_OPEN_HOUR  || 9)  * 60 + (cfg.MARKET_OPEN_MIN  || 30);
    const closeMins = (cfg.MARKET_CLOSE_HOUR || 16) * 60 + (cfg.MARKET_CLOSE_MIN || 0);
    const nowMins   = h * 60 + m;
    return nowMins >= openMins && nowMins < closeMins;
  }

  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // -----------------------------------------------------------
  // Fetch live quote from Finnhub
  // -----------------------------------------------------------
  async function fetchQuote(ticker) {
    try {
      const key = getFinnhubKey();
      if (!key) { console.warn("[Stocks] Finnhub key not set in STOCKS_CONFIG."); return null; }

      const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const d = await res.json();
      if (!d || !d.c) return null;
      const changePct = d.pc ? ((d.c - d.pc) / d.pc) * 100 : 0;
      return { price: d.c, prevClose: d.pc, changePct };
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------
  // Fetch RSI from Alpha Vantage
  // -----------------------------------------------------------
  async function fetchRSI(ticker) {
    try {
      const key = getAVKey();
      if (!key) { console.warn("[Stocks] Alpha Vantage key not set in STOCKS_CONFIG."); return null; }

      const url = `https://www.alphavantage.co/query?function=RSI&symbol=${ticker}&interval=15min&time_period=14&series_type=close&apikey=${key}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const d = await res.json();
      const series = d["Technical Analysis: RSI"];
      if (!series) return null;
      const latest = Object.values(series)[0];
      return latest ? parseFloat(latest.RSI) : null;
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------
  // Fetch MACD from Alpha Vantage
  // -----------------------------------------------------------
  async function fetchMACD(ticker) {
    try {
      const key = getAVKey();
      if (!key) return null;

      const url = `https://www.alphavantage.co/query?function=MACD&symbol=${ticker}&interval=15min&series_type=close&apikey=${key}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const d = await res.json();
      const series = d["Technical Analysis: MACD"];
      if (!series) return null;
      const vals = Object.values(series);
      if (vals.length < 2) return null;

      const latest = vals[0];
      const prev   = vals[1];

      const macdNow  = parseFloat(latest.MACD);
      const sigNow   = parseFloat(latest.MACD_Signal);
      const macdPrev = parseFloat(prev.MACD);
      const sigPrev  = parseFloat(prev.MACD_Signal);

      const crossedBullish = (macdPrev < sigPrev) && (macdNow >= sigNow);
      const crossedBearish = (macdPrev > sigPrev) && (macdNow <= sigNow);

      return {
        macd: macdNow,
        signal: sigNow,
        histogram: parseFloat(latest.MACD_Hist),
        crossed: crossedBullish || crossedBearish,
        crossedBullish,
        crossedBearish
      };
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------
  // Cooldown check — read from Firestore
  // -----------------------------------------------------------
  async function isInCooldown(db, ticker) {
    try {
      const cfg = window.STOCKS_CONFIG || {};
      const doc = await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(ticker).get();
      if (!doc.exists) return false;
      const data  = doc.data();
      const lastAt = data.flaggedAt ? data.flaggedAt.toMillis() : 0;
      return (Date.now() - lastAt) < (cfg.SIGNAL_COOLDOWN_MS || 3600000);
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------
  // Write a candidate to Firestore (Tier 1 output)
  // -----------------------------------------------------------
  async function writeCandidate(db, ticker, quote, rsi, macd) {
    try {
      const cfg = window.STOCKS_CONFIG || {};
      const candidate = {
        ticker,
        price:          quote.price,
        prevClose:      quote.prevClose,
        changePct:      parseFloat(quote.changePct.toFixed(2)),
        rsi:            rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
        macdCrossed:    macd ? macd.crossed : false,
        macdBullish:    macd ? macd.crossedBullish : false,
        macdBearish:    macd ? macd.crossedBearish : false,
        macdHist:       macd ? parseFloat(macd.histogram.toFixed(4)) : null,
        flaggedAt:      firebase.firestore.FieldValue.serverTimestamp(),
        tier2Processed: false
      };

      await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(ticker).set(candidate);
      console.log(`[Stocks Tier1] \u2705 Flagged: ${ticker} | RSI:${rsi?.toFixed(1)} | Change:${quote.changePct.toFixed(2)}%`);
      return candidate;
    } catch (e) {
      console.error("[Stocks Tier1] writeCandidate error:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // RUN TIER 1 — main screener loop
  // -----------------------------------------------------------
  async function runTier1Screener(db) {
    if (!db) { console.warn("[Stocks] Firestore not available."); return []; }

    const cfg        = window.STOCKS_CONFIG || {};
    const universe   = window.STOCKS_UNIVERSE || [];
    const candidates = [];

    console.log(`[Stocks Tier1] Starting screener. Universe: ${universe.length} tickers. Market open: ${isMarketOpen()}`);

    for (let i = 0; i < universe.length; i++) {
      const ticker = universe[i];

      const quote = await fetchQuote(ticker);
      await delay(150);

      if (!quote) continue;

      const absChange = Math.abs(quote.changePct);
      if (absChange < (cfg.MIN_PRICE_MOVE_PCT || 1.5)) continue;

      const coolingDown = await isInCooldown(db, ticker);
      if (coolingDown) {
        console.log(`[Stocks Tier1] \u23f3 Cooldown active: ${ticker}`);
        continue;
      }

      const rsi = await fetchRSI(ticker);
      await delay(250);

      const rsiTriggered = rsi !== null &&
        (rsi > (cfg.RSI_OVERBOUGHT || 70) || rsi < (cfg.RSI_OVERSOLD || 30));

      const macd = await fetchMACD(ticker);
      await delay(250);

      const macdTriggered = macd && macd.crossed;

      if (!rsiTriggered && !macdTriggered) continue;

      const c = await writeCandidate(db, ticker, quote, rsi, macd);
      if (c) candidates.push(c);
    }

    console.log(`[Stocks Tier1] Done. ${candidates.length} candidate(s) flagged.`);
    return candidates;
  }

  // Expose
  window.runTier1Screener = runTier1Screener;
  window.isMarketOpen     = isMarketOpen;

  console.log("[Stocks] Screener module loaded.");
})();
