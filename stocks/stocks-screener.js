// stocks/stocks-screener.js
// TIER 1 — Client-side screener.
//
// GATE LOGIC:
//   Uses Tier 0 changePct (already in Firestore) as the price-move gate.
//   This avoids re-fetching and getting a stale intraday number.
//   RSI + MACD are bonus signals stored on the candidate but do NOT gate.

(function () {
  "use strict";

  function getFinnhubKey() { return (window.STOCKS_CONFIG || {}).FINNHUB_KEY || ""; }
  function getAVKey()      { return (window.STOCKS_CONFIG || {}).AV_KEY      || ""; }

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
    return (h * 60 + m) >= openMins && (h * 60 + m) < closeMins;
  }

  function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

  // -----------------------------------------------------------
  // Fetch current price from Finnhub (for storing, NOT for gate)
  // -----------------------------------------------------------
  async function fetchLivePrice(ticker) {
    try {
      const key = getFinnhubKey();
      if (!key) return null;
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${key}`);
      if (!res.ok) return null;
      const d = await res.json();
      if (!d || !d.c) return null;
      return { price: d.c, prevClose: d.pc || null };
    } catch { return null; }
  }

  // -----------------------------------------------------------
  // RSI (Alpha Vantage) — bonus signal only
  // -----------------------------------------------------------
  async function fetchRSI(ticker) {
    try {
      const key = getAVKey();
      if (!key) return null;
      const res = await fetch(
        `https://www.alphavantage.co/query?function=RSI&symbol=${ticker}&interval=15min&time_period=14&series_type=close&apikey=${key}`
      );
      if (!res.ok) return null;
      const d      = await res.json();
      const series = d["Technical Analysis: RSI"];
      if (!series) return null;
      const latest = Object.values(series)[0];
      return latest ? parseFloat(latest.RSI) : null;
    } catch { return null; }
  }

  // -----------------------------------------------------------
  // MACD (Alpha Vantage) — bonus signal only
  // -----------------------------------------------------------
  async function fetchMACD(ticker) {
    try {
      const key = getAVKey();
      if (!key) return null;
      const res = await fetch(
        `https://www.alphavantage.co/query?function=MACD&symbol=${ticker}&interval=15min&series_type=close&apikey=${key}`
      );
      if (!res.ok) return null;
      const d      = await res.json();
      const series = d["Technical Analysis: MACD"];
      if (!series) return null;
      const vals = Object.values(series);
      if (vals.length < 2) return null;
      const latest = vals[0], prev = vals[1];
      const macdNow  = parseFloat(latest.MACD),  sigNow  = parseFloat(latest.MACD_Signal);
      const macdPrev = parseFloat(prev.MACD),    sigPrev = parseFloat(prev.MACD_Signal);
      const crossedBullish = macdPrev < sigPrev && macdNow >= sigNow;
      const crossedBearish = macdPrev > sigPrev && macdNow <= sigNow;
      return {
        macd: macdNow, signal: sigNow,
        histogram: parseFloat(latest.MACD_Hist),
        crossed: crossedBullish || crossedBearish,
        crossedBullish, crossedBearish
      };
    } catch { return null; }
  }

  // -----------------------------------------------------------
  // Cooldown check
  // -----------------------------------------------------------
  async function isInCooldown(db, ticker) {
    try {
      const cfg    = window.STOCKS_CONFIG || {};
      const doc    = await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(ticker).get();
      if (!doc.exists) return false;
      const lastAt = doc.data().flaggedAt ? doc.data().flaggedAt.toMillis() : 0;
      return (Date.now() - lastAt) < (cfg.SIGNAL_COOLDOWN_MS || 3600000);
    } catch { return false; }
  }

  // -----------------------------------------------------------
  // Write candidate
  // -----------------------------------------------------------
  async function writeCandidate(db, ticker, livePrice, rsi, macd, tier0Entry) {
    try {
      const cfg        = window.STOCKS_CONFIG || {};
      const changePct  = tier0Entry.changePct || 0;

      let confidence = Math.min(Math.abs(changePct) / 10, 1.0);
      if (rsi !== null && (rsi > (cfg.RSI_OVERBOUGHT || 70) || rsi < (cfg.RSI_OVERSOLD || 30))) confidence += 0.2;
      if (macd && macd.crossed) confidence += 0.2;
      confidence = parseFloat(Math.min(confidence, 1.0).toFixed(2));

      const candidate = {
        ticker,
        price:          livePrice ? livePrice.price     : tier0Entry.price,
        prevClose:      livePrice ? livePrice.prevClose  : null,
        changePct:      parseFloat(changePct.toFixed(2)),
        rsi:            rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
        rsiOverbought:  rsi !== null && rsi > (cfg.RSI_OVERBOUGHT || 70),
        rsiOversold:    rsi !== null && rsi < (cfg.RSI_OVERSOLD   || 30),
        macdCrossed:    macd ? macd.crossed        : false,
        macdBullish:    macd ? macd.crossedBullish : false,
        macdBearish:    macd ? macd.crossedBearish : false,
        macdHist:       macd ? parseFloat(macd.histogram.toFixed(4)) : null,
        confidence,
        tier0Triggers:  tier0Entry.triggers || [],
        tier0Score:     tier0Entry.score    || null,
        sector:         tier0Entry.sector   || "",
        flaggedAt:      firebase.firestore.FieldValue.serverTimestamp(),
        tier2Processed: false
      };

      await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(ticker).set(candidate);
      console.log(
        `[Stocks Tier1] \u2705 Flagged: ${ticker} | ${changePct.toFixed(2)}%` +
        (rsi !== null ? ` | RSI:${rsi.toFixed(1)}` : "") +
        (macd && macd.crossed ? ` | MACD✗` : "") +
        ` | conf:${confidence}`
      );
      return candidate;
    } catch (e) {
      console.error("[Stocks Tier1] writeCandidate error:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // RUN TIER 1
  // -----------------------------------------------------------
  async function runTier1Screener(db) {
    if (!db) { console.warn("[Stocks] Firestore not available."); return []; }

    const cfg      = window.STOCKS_CONFIG || {};
    const universe = window.STOCKS_UNIVERSE || [];
    const candidates = [];

    // Load Tier 0 Firestore data — this is the source of truth for changePct
    const tier0Map = {};
    try {
      const today   = new Date().toISOString().slice(0, 10);
      const subSnap = await db
        .collection("dailyWatchlist").doc(today)
        .collection("triggered").get();
      subSnap.forEach(d => { tier0Map[d.id] = d.data(); });
      console.log(`[Stocks Tier1] Loaded ${Object.keys(tier0Map).length} Tier 0 entries from Firestore.`);
    } catch (e) {
      console.warn("[Stocks Tier1] Could not load Tier 0 map:", e.message);
    }

    console.log(`[Stocks Tier1] Starting screener. Universe: ${universe.length} tickers. Market open: ${isMarketOpen()}`);

    for (let i = 0; i < universe.length; i++) {
      const ticker     = universe[i];
      const tier0Entry = tier0Map[ticker];

      // Gate 1: need Tier 0 entry with a changePct
      if (!tier0Entry) {
        console.warn(`[Stocks Tier1] No Tier 0 entry for ${ticker} — skipping.`);
        continue;
      }

      const absChange = Math.abs(tier0Entry.changePct || 0);
      if (absChange < (cfg.MIN_PRICE_MOVE_PCT || 1.5)) {
        // Expected quiet skip
        continue;
      }

      // Gate 2: cooldown
      const coolingDown = await isInCooldown(db, ticker);
      if (coolingDown) {
        console.log(`[Stocks Tier1] \u23f3 Cooldown: ${ticker}`);
        continue;
      }

      // Fetch live price for storing current value (non-gating)
      const livePrice = await fetchLivePrice(ticker);
      await delay(1100);

      // Bonus: RSI + MACD
      const rsi  = await fetchRSI(ticker);  await delay(250);
      const macd = await fetchMACD(ticker); await delay(250);

      const c = await writeCandidate(db, ticker, livePrice, rsi, macd, tier0Entry);
      if (c) candidates.push(c);
    }

    console.log(`[Stocks Tier1] Done. ${candidates.length} candidate(s) flagged.`);
    return candidates;
  }

  window.runTier1Screener = runTier1Screener;
  window.isMarketOpen     = isMarketOpen;

  console.log("[Stocks] Screener module loaded.");
})();
