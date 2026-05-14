// stocks/stocks-tier0.js
// TIER 0 — Dynamic Watchlist Builder (Finnhub-only, no FMP required).
// Uses Finnhub free-tier endpoints:
//   /quote              — price + % change per ticker
//   /calendar/earnings  — upcoming earnings
//   /company-news       — recent news activity
// Writes results to Firestore dailyWatchlist/{date}/triggered/{ticker}
// and updates window.STOCKS_UNIVERSE so Tier 1 screens the right stocks.

(function () {
  "use strict";

  // -----------------------------------------------------------
  // CONFIG
  // -----------------------------------------------------------
  var TIER0_CONFIG = {
    MAX_WATCHLIST:       40,   // cap on tickers that pass
    MIN_CHANGE_PCT:      1.0,  // minimum absolute % move to qualify
    MIN_VOLUME_RATIO:    1.5,  // volume vs avg volume threshold
    EARNINGS_DAYS_AHEAD: 5,    // flag if earnings within N calendar days
    FIRESTORE_ROOT:      "dailyWatchlist",
    RATE_DELAY_MS:       1100  // Finnhub free = 60 req/min → ~1s between calls
  };

  // Focused 60-ticker seed: high-volume, high-beta names most likely to trigger.
  // Kept small so Finnhub free rate limit isn't hit.
  var SEED_UNIVERSE = [
    // Mega-cap tech (most active)
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","NFLX",
    // Semiconductors
    "AMD","INTC","AVGO","QCOM","MU","AMAT",
    // Software / Cloud
    "CRM","NOW","SNOW","DDOG","PANW","CRWD",
    // Financials
    "JPM","BAC","GS","V","MA",
    // Healthcare
    "UNH","LLY","PFE","ABBV","MRK",
    // Energy
    "XOM","CVX","OXY","SLB",
    // Consumer
    "HD","MCD","SBUX","WMT","COST","AMZN",
    // Industrials
    "CAT","BA","GE","RTX",
    // ETFs
    "SPY","QQQ","IWM",
    // High-beta / momentum
    "MSTR","PLTR","COIN","HOOD","RBLX","UBER","RIVN"
  ];

  // Dedupe seed
  SEED_UNIVERSE = Array.from(new Set(SEED_UNIVERSE));

  var SECTOR_MAP = {
    "AAPL":"Tech","MSFT":"Tech","NVDA":"Tech","AMZN":"Tech","GOOGL":"Tech",
    "META":"Tech","TSLA":"Tech","NFLX":"Tech","AMD":"Tech","INTC":"Tech",
    "AVGO":"Tech","QCOM":"Tech","MU":"Tech","AMAT":"Tech",
    "CRM":"Tech","NOW":"Tech","SNOW":"Tech","DDOG":"Tech","PANW":"Tech","CRWD":"Tech",
    "MSTR":"Tech","PLTR":"Tech","COIN":"Tech","HOOD":"Tech","RBLX":"Tech","UBER":"Tech","RIVN":"Tech",
    "JPM":"Financials","BAC":"Financials","GS":"Financials","V":"Financials","MA":"Financials",
    "UNH":"Healthcare","LLY":"Healthcare","PFE":"Healthcare","ABBV":"Healthcare","MRK":"Healthcare",
    "XOM":"Energy","CVX":"Energy","OXY":"Energy","SLB":"Energy",
    "HD":"Consumer","MCD":"Consumer","SBUX":"Consumer","WMT":"Consumer","COST":"Consumer",
    "CAT":"Industrials","BA":"Industrials","GE":"Industrials","RTX":"Industrials",
    "SPY":"ETF","QQQ":"ETF","IWM":"ETF"
  };

  // -----------------------------------------------------------
  // HELPERS
  // -----------------------------------------------------------
  function getFinnhubKey() { return (window.STOCKS_CONFIG || {}).FINNHUB_KEY || ""; }
  function todayStr()      { return new Date().toISOString().slice(0, 10); }
  function delay(ms)       { return new Promise(function (r) { setTimeout(r, ms); }); }

  // -----------------------------------------------------------
  // STEP 1 — Finnhub /quote for each ticker (rate-limited)
  // Returns array of { symbol, c (price), dp (% change), v (volume) }
  // -----------------------------------------------------------
  async function fetchFinnhubQuotes(tickers) {
    var key = getFinnhubKey();
    if (!key) { console.warn("[Tier0] Finnhub key not set."); return []; }
    var results = [];
    for (var i = 0; i < tickers.length; i++) {
      try {
        var res = await fetch(
          "https://finnhub.io/api/v1/quote?symbol=" + tickers[i] + "&token=" + key
        );
        if (res.ok) {
          var q = await res.json();
          if (q && typeof q.c === "number" && q.c > 0) {
            results.push({ symbol: tickers[i], c: q.c, dp: q.dp || 0, pc: q.pc || 0 });
          }
        }
      } catch (e) { console.warn("[Tier0] Quote error for " + tickers[i] + ":", e); }
      // Rate-limit: 60 req/min free tier
      if (i < tickers.length - 1) await delay(TIER0_CONFIG.RATE_DELAY_MS);
    }
    return results;
  }

  // -----------------------------------------------------------
  // STEP 2 — Finnhub earnings calendar (next N days)
  // -----------------------------------------------------------
  async function fetchEarningsTickers() {
    var key = getFinnhubKey();
    if (!key) return new Set();
    try {
      var today  = new Date();
      var future = new Date(today);
      future.setDate(today.getDate() + TIER0_CONFIG.EARNINGS_DAYS_AHEAD);
      var from = today.toISOString().slice(0, 10);
      var to   = future.toISOString().slice(0, 10);
      var res  = await fetch(
        "https://finnhub.io/api/v1/calendar/earnings?from=" + from + "&to=" + to + "&token=" + key
      );
      if (!res.ok) return new Set();
      var data = await res.json();
      var arr  = (data && Array.isArray(data.earningsCalendar)) ? data.earningsCalendar : [];
      return new Set(arr.map(function (e) { return e.symbol; }));
    } catch (e) { console.warn("[Tier0] Earnings calendar error:", e); return new Set(); }
  }

  // -----------------------------------------------------------
  // STEP 3 — Finnhub recent news check (>= 2 articles in 24h)
  // -----------------------------------------------------------
  async function hasRecentNews(ticker) {
    var key = getFinnhubKey();
    if (!key) return false;
    try {
      var today     = new Date();
      var yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      var from = yesterday.toISOString().slice(0, 10);
      var to   = today.toISOString().slice(0, 10);
      var res  = await fetch(
        "https://finnhub.io/api/v1/company-news?symbol=" + ticker +
        "&from=" + from + "&to=" + to + "&token=" + key
      );
      if (!res.ok) return false;
      var data = await res.json();
      return Array.isArray(data) && data.length >= 2;
    } catch { return false; }
  }

  // -----------------------------------------------------------
  // SCORE — decide if a quote qualifies and why
  // -----------------------------------------------------------
  function scoreQuote(q, earningsSet) {
    if (!q.symbol || !q.c) return null;
    var triggers  = [];
    var changePct = typeof q.dp === "number" ? q.dp : 0;

    if (changePct >=  TIER0_CONFIG.MIN_CHANGE_PCT) triggers.push("gap_up");
    if (changePct <= -TIER0_CONFIG.MIN_CHANGE_PCT) triggers.push("gap_down");

    if (earningsSet.has(q.symbol)) triggers.push("earnings_proximity");

    if (triggers.length === 0) return null;

    return {
      ticker:    q.symbol,
      price:     q.c,
      changePct: parseFloat(changePct.toFixed(2)),
      volume:    0,
      avgVolume: 0,
      sector:    SECTOR_MAP[q.symbol] || "",
      triggers:  triggers,
      score:     triggers.length + Math.abs(changePct) / 10
    };
  }

  // -----------------------------------------------------------
  // SECTOR MOMENTUM — if >= 3 tickers from same sector passed,
  // add sector_momentum trigger to all of them
  // -----------------------------------------------------------
  function applySectorMomentum(candidates) {
    var counts = {};
    candidates.forEach(function (c) {
      if (c.sector && c.sector !== "ETF") counts[c.sector] = (counts[c.sector] || 0) + 1;
    });
    candidates.forEach(function (c) {
      if (c.sector && counts[c.sector] >= 3 && c.triggers.indexOf("sector_momentum") === -1) {
        c.triggers.push("sector_momentum");
        c.score += 0.5;
      }
    });
    return candidates;
  }

  // -----------------------------------------------------------
  // WRITE to Firestore dailyWatchlist/{today}/triggered/{ticker}
  // -----------------------------------------------------------
  async function writeWatchlist(db, candidates) {
    var today   = todayStr();
    var rootRef = db.collection(TIER0_CONFIG.FIRESTORE_ROOT).doc(today);
    var batch   = db.batch();

    batch.set(rootRef, {
      builtAt: firebase.firestore.FieldValue.serverTimestamp(),
      count:   candidates.length,
      date:    today
    }, { merge: true });

    candidates.forEach(function (c) {
      batch.set(rootRef.collection("triggered").doc(c.ticker), {
        ticker:    c.ticker,
        price:     c.price,
        changePct: c.changePct,
        sector:    c.sector,
        triggers:  c.triggers,
        score:     c.score,
        addedAt:   firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log("[Tier0] \u2705 Wrote " + candidates.length + " tickers to Firestore dailyWatchlist/" + today);
  }

  // -----------------------------------------------------------
  // MAIN RUNNER
  // -----------------------------------------------------------
  async function runTier0(db) {
    if (!db) { console.warn("[Tier0] Firestore not available."); return []; }
    console.log("[Tier0] Starting watchlist build... ("+SEED_UNIVERSE.length+" tickers to scan)");

    // Fetch earnings calendar first (1 API call)
    var earningsSet = await fetchEarningsTickers();
    await delay(TIER0_CONFIG.RATE_DELAY_MS);
    console.log("[Tier0] Earnings tickers (next " + TIER0_CONFIG.EARNINGS_DAYS_AHEAD + "d): " + earningsSet.size);

    // Fetch quotes for all seed tickers (rate-limited 1 call/ticker)
    var quotes = await fetchFinnhubQuotes(SEED_UNIVERSE);
    console.log("[Tier0] Quotes received: " + quotes.length);

    // Score each quote
    var scored = [];
    quotes.forEach(function (q) {
      var r = scoreQuote(q, earningsSet);
      if (r) scored.push(r);
    });
    console.log("[Tier0] Tickers passing filter: " + scored.length);

    // Apply sector momentum bonus
    scored = applySectorMomentum(scored);

    // Sort by score, cap at MAX_WATCHLIST
    scored.sort(function (a, b) { return b.score - a.score; });
    var watchlist = scored.slice(0, TIER0_CONFIG.MAX_WATCHLIST);

    // News check on top 15 (rate-limited)
    var newsLimit = Math.min(watchlist.length, 15);
    for (var i = 0; i < newsLimit; i++) {
      var hasNews = await hasRecentNews(watchlist[i].ticker);
      if (hasNews && watchlist[i].triggers.indexOf("news_activity") === -1) {
        watchlist[i].triggers.push("news_activity");
        watchlist[i].score += 0.5;
      }
      await delay(TIER0_CONFIG.RATE_DELAY_MS);
    }
    watchlist.sort(function (a, b) { return b.score - a.score; });

    console.log("[Tier0] Final watchlist " + watchlist.length + " tickers:");
    watchlist.forEach(function (w) {
      console.log("  " + w.ticker + " | " + w.changePct + "% | " + w.triggers.join(", "));
    });

    // Write to Firestore
    await writeWatchlist(db, watchlist);

    // Update STOCKS_UNIVERSE so Tier 1 screens these tickers
    window.STOCKS_UNIVERSE = watchlist.map(function (w) { return w.ticker; });
    console.log("[Tier0] window.STOCKS_UNIVERSE updated \u2192 " + window.STOCKS_UNIVERSE.length + " tickers.");

    return watchlist;
  }

  // -----------------------------------------------------------
  // MANUAL TRIGGER — "Rebuild Now" button in the overlay
  // -----------------------------------------------------------
  window.runTier0Manual = async function () {
    var db = null;
    try { if (window.firebase && window.firebase.firestore) db = window.firebase.firestore(); } catch (e) {}
    if (!db) throw new Error("[Tier0] Firestore not ready.");
    return runTier0(db);
  };

  // -----------------------------------------------------------
  // AUTO-RUN on page load (weekdays, 8 AM–8 PM ET)
  // Skips if a fresh watchlist already exists (< 3 hours old)
  // -----------------------------------------------------------
  async function autoRunIfNeeded() {
    try {
      var now = new Date();
      var et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      if (et.getDay() === 0 || et.getDay() === 6) return; // weekend
      var hour = et.getHours();
      if (hour < 8 || hour >= 20) return; // outside trading window

      var db = null;
      try { if (window.firebase && window.firebase.firestore) db = window.firebase.firestore(); } catch (e) {}
      if (!db) return;

      var today   = todayStr();
      var docSnap = await db.collection(TIER0_CONFIG.FIRESTORE_ROOT).doc(today).get();

      if (docSnap.exists) {
        var data    = docSnap.data();
        var builtAt = data.builtAt ? data.builtAt.toMillis() : 0;
        var ageMs   = Date.now() - builtAt;

        if (ageMs < 3 * 60 * 60 * 1000) {
          // Fresh — load existing watchlist into STOCKS_UNIVERSE
          var subSnap = await db
            .collection(TIER0_CONFIG.FIRESTORE_ROOT)
            .doc(today)
            .collection("triggered")
            .get();
          if (!subSnap.empty) {
            var tickers = [];
            subSnap.forEach(function (d) { tickers.push(d.id); });
            window.STOCKS_UNIVERSE = tickers;
            console.log("[Tier0] Loaded existing watchlist (" + Math.round(ageMs / 60000) + "m old) \u2192 " + tickers.length + " tickers.");
          }
          return;
        }
      }

      console.log("[Tier0] No fresh watchlist — auto-building...");
      await runTier0(db);
    } catch (e) {
      console.warn("[Tier0] Auto-run error:", e.message || e);
    }
  }

  // Delay 4s to ensure Firebase + STOCKS_CONFIG are fully initialised
  setTimeout(autoRunIfNeeded, 4000);

  console.log("[Tier0] Watchlist builder loaded.");
})();
