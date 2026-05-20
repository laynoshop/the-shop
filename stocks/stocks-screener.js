// stocks/stocks-screener.js
// TIER 1 — Client-side screener.
//
// GATE LOGIC:
//   Uses Tier 0 changePct (already in Firestore) as the price-move gate.
//   RSI + MACD are bonus signals stored on the candidate but do NOT gate.
//
// COOLDOWN:
//   flaggedAt is ONLY written on the first flag — never overwritten.
//   This ensures the 2-hour cooldown window is respected across re-runs.

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

  // Returns { inCooldown, existingData } — single read shared by both cooldown check and writeCandidate
  async function getExistingCandidate(db, ticker) {
    try {
      const cfg = window.STOCKS_CONFIG || {};
      const doc = await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(ticker).get();
      if (!doc.exists) return { inCooldown: false, existingData: null };
      const data    = doc.data();
      const lastAt  = data.flaggedAt ? data.flaggedAt.toMillis() : 0;
      const cooldownMs = cfg.SIGNAL_COOLDOWN_MS || 3600000;
      const inCooldown = (Date.now() - lastAt) < cooldownMs;
      return { inCooldown, existingData: data };
    } catch { return { inCooldown: false, existingData: null }; }
  }

  async function writeCandidate(db, ticker, livePrice, rsi, macd, tier0Entry, existingData) {
    try {
      const cfg       = window.STOCKS_CONFIG || {};
      const changePct = tier0Entry.changePct || 0;

      let confidence = Math.min(Math.abs(changePct) / 10, 1.0);
      if (rsi !== null && (rsi > (cfg.RSI_OVERBOUGHT || 70) || rsi < (cfg.RSI_OVERSOLD || 30))) confidence += 0.2;
      if (macd && macd.crossed) confidence += 0.2;
      confidence = parseFloat(Math.min(confidence, 1.0).toFixed(2));

      // Preserve tier2Processed from existing doc — never reset to false
      const alreadyProcessed = existingData ? existingData.tier2Processed === true : false;
      const isNewDoc         = !existingData;

      const candidate = {
        ticker,
        price:          livePrice ? livePrice.price    : tier0Entry.price,
        prevClose:      livePrice ? livePrice.prevClose : null,
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
        tier2Processed: alreadyProcessed
        // NOTE: flaggedAt is intentionally omitted here if doc already exists
        // so we don't reset the cooldown clock on re-runs
      };

      // Only set flaggedAt on brand-new candidates
      if (isNewDoc) {
        candidate.flaggedAt = firebase.firestore.FieldValue.serverTimestamp();
      }

      // merge:true ensures we never accidentally wipe fields we didn't include
      await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
        .doc(ticker)
        .set(candidate, { merge: true });

      console.log(
        `[Stocks Tier1] ✅ Flagged: ${ticker} | ${changePct.toFixed(2)}%` +
        (rsi !== null ? ` | RSI:${rsi.toFixed(1)}` : "") +
        (macd && macd.crossed ? ` | MACD✗` : "") +
        ` | conf:${confidence}` +
        (alreadyProcessed ? " | [tier2 preserved]" : "") +
        (isNewDoc ? " | [NEW]" : " | [UPDATE — flaggedAt unchanged]")
      );
      return candidate;
    } catch (e) {
      console.error("[Stocks Tier1] writeCandidate error:", e);
      return null;
    }
  }

  async function runTier1Screener(db) {
    if (!db) { console.warn("[Stocks] Firestore not available."); return []; }

    const cfg        = window.STOCKS_CONFIG || {};
    const universe   = window.STOCKS_UNIVERSE || [];
    const candidates = [];

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

      if (!tier0Entry) {
        console.warn(`[Stocks Tier1] No Tier 0 entry for ${ticker} — skipping.`);
        continue;
      }

      const absChange = Math.abs(tier0Entry.changePct || 0);
      if (absChange < (cfg.MIN_PRICE_MOVE_PCT || 1.5)) continue;

      // Single read — used for both cooldown gate AND writeCandidate
      const { inCooldown, existingData } = await getExistingCandidate(db, ticker);
      if (inCooldown) {
        const remaining = existingData?.flaggedAt
          ? Math.round(((cfg.SIGNAL_COOLDOWN_MS || 3600000) - (Date.now() - existingData.flaggedAt.toMillis())) / 60000)
          : "?";
        console.log(`[Stocks Tier1] ⏳ Cooldown: ${ticker} (${remaining}m remaining)`);
        continue;
      }

      const livePrice = await fetchLivePrice(ticker);
      await delay(1100);

      const rsi  = await fetchRSI(ticker);  await delay(250);
      const macd = await fetchMACD(ticker); await delay(250);

      const c = await writeCandidate(db, ticker, livePrice, rsi, macd, tier0Entry, existingData);
      if (c) candidates.push(c);
    }

    console.log(`[Stocks Tier1] Done. ${candidates.length} candidate(s) flagged.`);
    return candidates;
  }

  window.runTier1Screener = runTier1Screener;
  window.isMarketOpen     = isMarketOpen;

  console.log("[Stocks] Screener module loaded.");
})();
