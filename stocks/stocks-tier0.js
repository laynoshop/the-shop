// stocks/stocks-tier0.js
// TIER 0 — Dynamic Watchlist Builder.
// FMP Starter plan handles: batch quotes, gainers/losers, earnings calendar.
// Finnhub free handles: recent news check (company-news).
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
    MIN_VOLUME_RATIO:    1.5,  // today volume must be >= 1.5x avg
    EARNINGS_DAYS_AHEAD: 5,    // flag if earnings within N calendar days
    FIRESTORE_ROOT:      "dailyWatchlist",
    FMP_BATCH_SIZE:      50,   // FMP /quote supports up to 50 symbols per call
    FMP_DELAY_MS:        300,  // small pause between FMP batch calls
    NEWS_DELAY_MS:       1100  // Finnhub free = 60 req/min
  };

  // 150-ticker seed covering all 11 S&P sectors + high-beta Nasdaq names.
  // FMP /gainers + /losers dynamically augment this at runtime.
  var SEED_UNIVERSE = [
    // Mega-cap tech
    "AAPL","MSFT","NVDA","AMZN","GOOGL","GOOG","META","TSLA","NFLX","ORCL",
    // Semiconductors
    "AMD","INTC","AVGO","QCOM","MU","AMAT","LRCX","KLAC","TXN","MRVL",
    // Software / Cloud
    "CRM","NOW","ADBE","INTU","SNOW","DDOG","PANW","CRWD","ZS","OKTA",
    // Financials
    "JPM","BAC","GS","MS","WFC","C","AXP","V","MA","BLK",
    // Healthcare
    "JNJ","UNH","PFE","ABBV","MRK","LLY","TMO","ABT","AMGN","GILD",
    // Energy
    "XOM","CVX","COP","EOG","SLB","OXY","MPC","PSX","VLO","HAL",
    // Consumer Discretionary
    "HD","MCD","NKE","SBUX","TGT","LOW","BKNG","MAR","HLT","ABNB",
    // Consumer Staples
    "WMT","COST","PG","KO","PEP","PM","MO","CL","GIS","KHC",
    // Industrials
    "CAT","DE","HON","RTX","LMT","GE","BA","UPS","FDX","CSX",
    // Utilities / Real Estate
    "NEE","DUK","SO","D","AMT","PLD","EQIX","SPG","O","WELL",
    // ETFs
    "SPY","QQQ","IWM","DIA","XLF","XLK","XLE","XLV","XLI","XLY",
    // High-beta / momentum
    "MSTR","PLTR","COIN","HOOD","RBLX","SNAP","UBER","LYFT","RIVN","LCID"
  ];

  var SECTOR_MAP = {
    "AAPL":"Tech","MSFT":"Tech","NVDA":"Tech","AMZN":"Tech","GOOGL":"Tech","GOOG":"Tech",
    "META":"Tech","TSLA":"Tech","NFLX":"Tech","ORCL":"Tech","AMD":"Tech","INTC":"Tech",
    "AVGO":"Tech","QCOM":"Tech","MU":"Tech","AMAT":"Tech","LRCX":"Tech","KLAC":"Tech",
    "TXN":"Tech","MRVL":"Tech","CRM":"Tech","NOW":"Tech","ADBE":"Tech","INTU":"Tech",
    "SNOW":"Tech","DDOG":"Tech","PANW":"Tech","CRWD":"Tech","ZS":"Tech","OKTA":"Tech",
    "MSTR":"Tech","PLTR":"Tech","COIN":"Tech","HOOD":"Tech","RBLX":"Tech",
    "SNAP":"Tech","UBER":"Tech","LYFT":"Tech","RIVN":"Tech","LCID":"Tech",
    "JPM":"Financials","BAC":"Financials","GS":"Financials","MS":"Financials","WFC":"Financials",
    "C":"Financials","AXP":"Financials","V":"Financials","MA":"Financials","BLK":"Financials","XLF":"Financials",
    "JNJ":"Healthcare","UNH":"Healthcare","PFE":"Healthcare","ABBV":"Healthcare","MRK":"Healthcare",
    "LLY":"Healthcare","TMO":"Healthcare","ABT":"Healthcare","AMGN":"Healthcare","GILD":"Healthcare","XLV":"Healthcare",
    "XOM":"Energy","CVX":"Energy","COP":"Energy","EOG":"Energy","SLB":"Energy",
    "OXY":"Energy","MPC":"Energy","PSX":"Energy","VLO":"Energy","HAL":"Energy","XLE":"Energy",
    "HD":"Consumer","MCD":"Consumer","NKE":"Consumer","SBUX":"Consumer","TGT":"Consumer",
    "LOW":"Consumer","BKNG":"Consumer","MAR":"Consumer","HLT":"Consumer","ABNB":"Consumer",
    "WMT":"Consumer","COST":"Consumer","PG":"Consumer","KO":"Consumer","PEP":"Consumer",
    "PM":"Consumer","MO":"Consumer","CL":"Consumer","GIS":"Consumer","KHC":"Consumer","XLY":"Consumer",
    "CAT":"Industrials","DE":"Industrials","HON":"Industrials","RTX":"Industrials","LMT":"Industrials",
    "GE":"Industrials","BA":"Industrials","UPS":"Industrials","FDX":"Industrials","CSX":"Industrials","XLI":"Industrials",
    "NEE":"Utilities","DUK":"Utilities","SO":"Utilities","D":"Utilities",
    "AMT":"Real Estate","PLD":"Real Estate","EQIX":"Real Estate","SPG":"Real Estate",
    "O":"Real Estate","WELL":"Real Estate",
    "SPY":"ETF","QQQ":"ETF","IWM":"ETF","DIA":"ETF","XLK":"ETF"
  };

  // -----------------------------------------------------------
  // HELPERS
  // -----------------------------------------------------------
  function getFMPKey()     { return (window.STOCKS_CONFIG || {}).FMP_KEY     || ""; }
  function getFinnhubKey() { return (window.STOCKS_CONFIG || {}).FINNHUB_KEY || ""; }
  function todayStr()      { return new Date().toISOString().slice(0, 10); }
  function delay(ms)       { return new Promise(function (r) { setTimeout(r, ms); }); }

  // -----------------------------------------------------------
  // STEP 1 — FMP batch quotes (50 symbols per request)
  // Returns array of FMP quote objects
  // -----------------------------------------------------------
  async function fetchFMPBatchQuotes(tickers) {
    var key = getFMPKey();
    if (!key) { console.warn("[Tier0] FMP key not set."); return []; }
    var results = [];
    for (var i = 0; i < tickers.length; i += TIER0_CONFIG.FMP_BATCH_SIZE) {
      var batch = tickers.slice(i, i + TIER0_CONFIG.FMP_BATCH_SIZE).join(",");
      try {
        var res = await fetch(
          "https://financialmodelingprep.com/api/v3/quote/" + batch + "?apikey=" + key
        );
        if (res.ok) {
          var data = await res.json();
          if (Array.isArray(data)) results = results.concat(data);
        } else {
          console.warn("[Tier0] FMP batch quotes HTTP " + res.status);
        }
      } catch (e) { console.warn("[Tier0] FMP batch error:", e); }
      if (i + TIER0_CONFIG.FMP_BATCH_SIZE < tickers.length) await delay(TIER0_CONFIG.FMP_DELAY_MS);
    }
    return results;
  }

  // -----------------------------------------------------------
  // STEP 2 — FMP top gainers + losers (dynamic universe expansion)
  // -----------------------------------------------------------
  async function fetchFMPMovers() {
    var key = getFMPKey();
    if (!key) return [];
    var movers = [];
    try {
      var g = await fetch("https://financialmodelingprep.com/api/v3/stock_market/gainers?apikey=" + key);
      if (g.ok) {
        var gd = await g.json();
        if (Array.isArray(gd)) movers = movers.concat(gd.slice(0, 15));
      }
      await delay(TIER0_CONFIG.FMP_DELAY_MS);
      var l = await fetch("https://financialmodelingprep.com/api/v3/stock_market/losers?apikey=" + key);
      if (l.ok) {
        var ld = await l.json();
        if (Array.isArray(ld)) movers = movers.concat(ld.slice(0, 15));
      }
    } catch (e) { console.warn("[Tier0] FMP movers error:", e); }
    return movers;
  }

  // -----------------------------------------------------------
  // STEP 3 — FMP earnings calendar (next N days)
  // -----------------------------------------------------------
  async function fetchEarningsTickers() {
    var key = getFMPKey();
    if (!key) return new Set();
    try {
      var today  = new Date();
      var future = new Date(today);
      future.setDate(today.getDate() + TIER0_CONFIG.EARNINGS_DAYS_AHEAD);
      var from = today.toISOString().slice(0, 10);
      var to   = future.toISOString().slice(0, 10);
      var res  = await fetch(
        "https://financialmodelingprep.com/api/v3/earning_calendar?from=" + from + "&to=" + to + "&apikey=" + key
      );
      if (!res.ok) return new Set();
      var data = await res.json();
      return Array.isArray(data) ? new Set(data.map(function (e) { return e.symbol; })) : new Set();
    } catch (e) { console.warn("[Tier0] Earnings calendar error:", e); return new Set(); }
  }

  // -----------------------------------------------------------
  // STEP 4 — Finnhub recent news check (>= 2 articles in 24h)
  // Still uses Finnhub free — FMP news costs more credits
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
    if (!q.symbol || !q.price) return null;
    var triggers  = [];
    var changePct = typeof q.changesPercentage === "number" ? q.changesPercentage : 0;

    if (changePct >=  TIER0_CONFIG.MIN_CHANGE_PCT) triggers.push("gap_up");
    if (changePct <= -TIER0_CONFIG.MIN_CHANGE_PCT) triggers.push("gap_down");

    var vol    = q.volume    || 0;
    var avgVol = q.avgVolume || 1;
    if (avgVol > 0 && vol >= avgVol * TIER0_CONFIG.MIN_VOLUME_RATIO) triggers.push("volume_surge");

    if (earningsSet.has(q.symbol)) triggers.push("earnings_proximity");

    if (triggers.length === 0) return null;

    return {
      ticker:    q.symbol,
      price:     q.price,
      changePct: parseFloat(changePct.toFixed(2)),
      volume:    vol,
      avgVolume: avgVol,
      sector:    SECTOR_MAP[q.symbol] || q.sector || "",
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
        volume:    c.volume,
        avgVolume: c.avgVolume,
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

    // Parallel: earnings + movers at the same time
    console.log("[Tier0] Starting watchlist build...");
    var earningsPromise = fetchEarningsTickers();
    var moversPromise   = fetchFMPMovers();
    var earningsSet     = await earningsPromise;
    var moverData       = await moversPromise;

    console.log("[Tier0] Earnings tickers (next " + TIER0_CONFIG.EARNINGS_DAYS_AHEAD + "d): " + earningsSet.size);

    // Build combined universe: seed + movers (deduped)
    var moverTickers = moverData.map(function (m) { return m.symbol; }).filter(Boolean);
    var combined     = Array.from(new Set(SEED_UNIVERSE.concat(moverTickers)));
    console.log("[Tier0] Universe: " + combined.length + " tickers (seed + movers)");

    // Batch fetch quotes via FMP (fast — 50 per request)
    var quotes = await fetchFMPBatchQuotes(combined);
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

    // News check on top 20 via Finnhub (rate-limited)
    var newsLimit = Math.min(watchlist.length, 20);
    for (var i = 0; i < newsLimit; i++) {
      var hasNews = await hasRecentNews(watchlist[i].ticker);
      if (hasNews && watchlist[i].triggers.indexOf("news_activity") === -1) {
        watchlist[i].triggers.push("news_activity");
        watchlist[i].score += 0.5;
      }
      await delay(TIER0_CONFIG.NEWS_DELAY_MS);
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
