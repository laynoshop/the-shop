// stocks/stocks-screener.js
// TIER 1 — Client-side screener (for development/testing).
// In production this logic runs in a Firebase Scheduled Cloud Function.
// This file lets you run + test the screener right from the browser
// before wiring up the backend, so you can see real signals immediately.

(function () {
  "use strict";

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------
  function isMarketOpen() {
    const now = new Date();
    // Convert to Eastern Time
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = et.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return false;
    const h = et.getHours();
    const m = et.getMinutes();
    const cfg = window.STOCKS_CONFIG;
    const openMins  = cfg.MARKET_OPEN_HOUR  * 60 + cfg.MARKET_OPEN_MIN;
    const closeMins = cfg.MARKET_CLOSE_HOUR * 60 + cfg.MARKET_CLOSE_MIN;
    const nowMins   = h * 60 + m;
    return nowMins >= openMins && nowMins < closeMins;
  }

  // Throttle helper — space out Finnhub calls to stay under rate limits
  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // -----------------------------------------------------------
  // Fetch live quote from Finnhub
  // Returns: { price, prevClose, changePct } or null on error
  // -----------------------------------------------------------
  async function fetchQuote(ticker) {
    try {
      const key = window.__STOCKS_FINNHUB_KEY;
      if (!key) { console.warn("[Stocks] Finnhub key not set."); return null; }

      const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const d = await res.json();
      // d.c = current price, d.pc = previous close
      if (!d || !d.c) return null;
      const changePct = d.pc ? ((d.c - d.pc) / d.pc) * 100 : 0;
      return { price: d.c, prevClose: d.pc, changePct };
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------
  // Fetch RSI from Alpha Vantage (pre-computed, no math needed)
  // Returns: number (RSI value) or null
  // -----------------------------------------------------------
  async function fetchRSI(ticker) {
    try {
      const key = window.__STOCKS_ALPHAVANTAGE_KEY;
      if (!key) { console.warn("[Stocks] Alpha Vantage key not set."); return null; }

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
  // Returns: { macd, signal, histogram, crossed } or null
  // A "crossed" flag = MACD crossed signal line recently
  // -----------------------------------------------------------
  async function fetchMACD(ticker) {
    try {
      const key = window.__STOCKS_ALPHAVANTAGE_KEY;
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

      // Crossed = flipped side of signal line between last two bars
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
  // Returns true if ticker is still in cooldown
  // -----------------------------------------------------------
  async function isInCooldown(db, ticker) {
    try {
      const cfg = window.STOCKS_CONFIG;
      const doc = await db.collection(cfg.CANDIDATES_COLLECTION).doc(ticker).get();
      if (!doc.exists) return false;
      const data = doc.data();
      const lastAt = data.flaggedAt ? data.flaggedAt.toMillis() : 0;
      return (Date.now() - lastAt) < cfg.SIGNAL_COOLDOWN_MS;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------
  // Write a candidate to Firestore (Tier 1 output)
  // -----------------------------------------------------------
  async function writeCandidate(db, ticker, quote, rsi, macd) {
    try {
      const cfg = window.STOCKS_CONFIG;
      const candidate = {
        ticker,
        price:        quote.price,
        prevClose:    quote.prevClose,
        changePct:    parseFloat(quote.changePct.toFixed(2)),
        rsi:          rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
        macdCrossed:  macd ? macd.crossed : false,
        macdBullish:  macd ? macd.crossedBullish : false,
        macdBearish:  macd ? macd.crossedBearish : false,
        macdHist:     macd ? parseFloat(macd.histogram.toFixed(4)) : null,
        flaggedAt:    firebase.firestore.FieldValue.serverTimestamp(),
        tier2Processed: false
      };

      await db.collection(cfg.CANDIDATES_COLLECTION).doc(ticker).set(candidate);
      console.log(`[Stocks Tier1] ✅ Flagged: ${ticker} | RSI:${rsi?.toFixed(1)} | Change:${quote.changePct.toFixed(2)}%`);
      return candidate;
    } catch (e) {
      console.error("[Stocks Tier1] writeCandidate error:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // RUN TIER 1 — main screener loop
  // Loops through the universe, applies filters, flags candidates
  // -----------------------------------------------------------
  async function runTier1Screener(db) {
    if (!db) { console.warn("[Stocks] Firestore not available."); return []; }

    const cfg = window.STOCKS_CONFIG;
    const universe = window.STOCKS_UNIVERSE || [];
    const candidates = [];

    console.log(`[Stocks Tier1] Starting screener. Universe: ${universe.length} tickers. Market open: ${isMarketOpen()}`);

    // Note: Free tier Alpha Vantage = 25 req/day.
    // We skip RSI/MACD fetch on tickers that don't pass the price filter
    // to conserve those calls during testing.

    for (let i = 0; i < universe.length; i++) {
      const ticker = universe[i];

      // ---- Stage 1: Quick quote + price movement filter ----
      const quote = await fetchQuote(ticker);
      await delay(150); // ~6-7 req/sec — safe for Finnhub free (60 req/min)

      if (!quote) continue;

      const absChange = Math.abs(quote.changePct);
      if (absChange < cfg.MIN_PRICE_MOVE_PCT) continue; // Stage 1 fail — skip

      // ---- Stage 2: Cooldown check ----
      const coolingDown = await isInCooldown(db, ticker);
      if (coolingDown) {
        console.log(`[Stocks Tier1] ⏳ Cooldown active: ${ticker}`);
        continue;
      }

      // ---- Stage 3: RSI check (uses Alpha Vantage call) ----
      const rsi = await fetchRSI(ticker);
      await delay(250); // space out AV calls

      const rsiTriggered = rsi !== null &&
        (rsi > cfg.RSI_OVERBOUGHT || rsi < cfg.RSI_OVERSOLD);

      // ---- Stage 4: MACD check ----
      const macd = await fetchMACD(ticker);
      await delay(250);

      const macdTriggered = macd && macd.crossed;

      // ---- Stage 5: Must pass RSI OR MACD (at least one) ----
      if (!rsiTriggered && !macdTriggered) continue;

      // ✅ Passed all stages — write candidate
      const c = await writeCandidate(db, ticker, quote, rsi, macd);
      if (c) candidates.push(c);
    }

    console.log(`[Stocks Tier1] Done. ${candidates.length} candidate(s) flagged.`);
    return candidates;
  }

  // Expose
  window.runTier1Screener   = runTier1Screener;
  window.isMarketOpen       = isMarketOpen;

  console.log("[Stocks] Screener module loaded.");
})();
