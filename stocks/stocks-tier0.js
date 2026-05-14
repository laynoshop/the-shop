// stocks/stocks-tier0.js
// TIER 0 — Dynamic Watchlist Builder.
// FMP Starter plan handles: batch quotes, gainers/losers, earnings calendar.
// Finnhub free handles: recent news check (company-news).
// Writes results to Firestore dailyWatchlist/{date}/triggered/{ticker}
// and updates window.STOCKS_UNIVERSE so Tier 1 screens the right stocks.
//
// NOTE: Uses FMP /stable/ endpoints (post-Aug 2025 API).
// /stable/batch-quote?symbols=AAPL,MSFT,...  for multi-ticker quotes
// /stable/biggest-gainers and /stable/biggest-losers for movers
// /stable/earnings-calendar for upcoming earnings

(function () {
  "use strict";

  // -----------------------------------------------------------
  // CONFIG
  // -----------------------------------------------------------
  var TIER0_CONFIG = {
    MAX_WATCHLIST:       40,
    MIN_CHANGE_PCT:      1.0,
    MIN_VOLUME_RATIO:    1.5,
    EARNINGS_DAYS_AHEAD: 5,
    FIRESTORE_ROOT:      "dailyWatchlist",
    FMP_BATCH_SIZE:      50,
    FMP_DELAY_MS:        300,
    NEWS_DELAY_MS:       1100
  };

  var FMP_BASE = "https://financialmodelingprep.com/stable";

  var SEED_UNIVERSE = [
    "AAPL","MSFT","NVDA","AMZN","GOOGL","GOOG","META","TSLA","NFLX","ORCL",
    "AMD","INTC","AVGO","QCOM","MU","AMAT","LRCX","KLAC","TXN","MRVL",
    "CRM","NOW","ADBE","INTU","SNOW","DDOG","PANW","CRWD","ZS","OKTA",
    "JPM","BAC","GS","MS","WFC","C","AXP","V","MA","BLK",
    "JNJ","UNH","PFE","ABBV","MRK","LLY","TMO","ABT","AMGN","GILD",
    "XOM","CVX","COP","EOG","SLB","OXY","MPC","PSX","VLO","HAL",
    "HD","MCD","NKE","SBUX","TGT","LOW","BKNG","MAR","HLT","ABNB",
    "WMT","COST","PG","KO","PEP","PM","MO","CL","GIS","KHC",
    "CAT","DE","HON","RTX","LMT","GE","BA","UPS","FDX","CSX",
    "NEE","DUK","SO","D","AMT","PLD","EQIX","SPG","O","WELL",
    "SPY","QQQ","IWM","DIA","XLF","XLK","XLE","XLV","XLI","XLY",
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

  // Normalize a raw FMP quote object to a consistent shape.
  // The stable API may use different field names than v3.
  function normalizeQuote(q) {
    return {
      symbol:           q.symbol           || q.ticker || "",
      price:            q.price            || q.lastPrice || q.currentPrice || 0,
      changesPercentage: q.changesPercentage != null ? q.changesPercentage
                        : (q.changePercentage != null ? q.changePercentage
                        : (q.change != null && q.previousClose ? (q.change / q.previousClose) * 100 : 0)),
      volume:           q.volume           || 0,
      avgVolume:        q.avgVolume        || q.averageVolume || 0
    };
  }

  // -----------------------------------------------------------
  // STEP 1 — FMP batch quotes
  // /stable/batch-quote?symbols=AAPL,MSFT,...&apikey=KEY
  // -----------------------------------------------------------
  async function fetchFMPBatchQuotes(tickers) {
    var key = getFMPKey();
    if (!key) { console.warn("[Tier0] FMP key not set."); return []; }
    var results = [];
    for (var i = 0; i < tickers.length; i += TIER0_CONFIG.FMP_BATCH_SIZE) {
      var batch = tickers.slice(i, i + TIER0_CONFIG.FMP_BATCH_SIZE).join(",");
      try {
        var res = await fetch(
          FMP_BASE + "/batch-quote?symbols=" + encodeURIComponent(batch) + "&apikey=" + key
        );
        if (res.ok) {
          var data = await res.json();
          // Diagnostic: log shape of first response only
          if (i === 0) {
            var sample = Array.isArray(data) ? data[0] : data;
            console.log("[Tier0] Quote response sample:", JSON.stringify(sample).slice(0, 200));
          }
          if (Array.isArray(data)) {
            results = results.concat(data.map(normalizeQuote));
          } else if (data && typeof data === "object" && !data["Error Message"]) {
            // Single object returned — wrap it
            results.push(normalizeQuote(data));
          } else if (data && data["Error Message"]) {
            console.warn("[Tier0] FMP quote API error:", data["Error Message"]);
          }
        } else {
          var errText = await res.text().catch(function () { return ""; });
          console.warn("[Tier0] FMP batch quotes HTTP " + res.status, errText.slice(0, 100));
        }
      } catch (e) { console.warn("[Tier0] FMP batch error:", e); }
      if (i + TIER0_CONFIG.FMP_BATCH_SIZE < tickers.length) await delay(TIER0_CONFIG.FMP_DELAY_MS);
    }
    return results;
  }

  // -----------------------------------------------------------
  // STEP 2 — FMP top gainers + losers
  // /stable/biggest-gainers and /stable/biggest-losers
  // -----------------------------------------------------------
  async function fetchFMPMovers() {
    var key = getFMPKey();
    if (!key) return [];
    var movers = [];
    try {
      var g = await fetch(FMP_BASE + "/biggest-gainers?apikey=" + key);
      if (g.ok) {
        var gd = await g.json();
        if (i === 0 && Array.isArray(gd) && gd[0]) {
          console.log("[Tier0] Gainers sample:", JSON.stringify(gd[0]).slice(0, 150));
        }
        if (Array.isArray(gd)) {
          // Normalize: stable API may use 'ticker' instead of 'symbol'
          movers = movers.concat(gd.slice(0, 15).map(function(m) {
            return { symbol: m.symbol || m.ticker || "" };
          }));
        }
      }
      await delay(TIER0_CONFIG.FMP_DELAY_MS);
      var l = await fetch(FMP_BASE + "/biggest-losers?apikey=" + key);
      if (l.ok) {
        var ld = await l.json();
        if (Array.isArray(ld)) {
          movers = movers.concat(ld.slice(0, 15).map(function(m) {
            return { symbol: m.symbol || m.ticker || "" };
          }));
        }
      }
    } catch (e) { console.warn("[Tier0] FMP movers error:", e); }
    return movers;
  }

  // -----------------------------------------------------------
  // STEP 3 — FMP earnings calendar
  // /stable/earnings-calendar?from=...&to=...&apikey=KEY
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
        FMP_BASE + "/earnings-calendar?from=" + from + "&to=" + to + "&apikey=" + key
      );
      if (!res.ok) return new Set();
      var data = await res.json();
      return Array.isArray(data) ? new Set(data.map(function (e) { return e.symbol || e.ticker || ""; })) : new Set();
    } catch (e) { console.warn("[Tier0] Earnings calendar error:", e); return new Set(); }
  }

  // -----------------------------------------------------------
  // STEP 4 — Finnhub recent news check
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
  // SCORE
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
  // SECTOR MOMENTUM
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
  // WRITE to Firestore
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

    console.log("[Tier0] Starting watchlist build...");
    var earningsPromise = fetchEarningsTickers();
    var moversPromise   = fetchFMPMovers();
    var earningsSet     = await earningsPromise;
    var moverData       = await moversPromise;

    console.log("[Tier0] Earnings tickers (next " + TIER0_CONFIG.EARNINGS_DAYS_AHEAD + "d): " + earningsSet.size);

    var moverTickers = moverData.map(function (m) { return m.symbol; }).filter(Boolean);
    var combined     = Array.from(new Set(SEED_UNIVERSE.concat(moverTickers)));
    console.log("[Tier0] Universe: " + combined.length + " tickers (seed + movers)");

    var quotes = await fetchFMPBatchQuotes(combined);
    console.log("[Tier0] Quotes received: " + quotes.length);

    var scored = [];
    quotes.forEach(function (q) {
      var r = scoreQuote(q, earningsSet);
      if (r) scored.push(r);
    });
    console.log("[Tier0] Tickers passing filter: " + scored.length);

    scored = applySectorMomentum(scored);
    scored.sort(function (a, b) { return b.score - a.score; });
    var watchlist = scored.slice(0, TIER0_CONFIG.MAX_WATCHLIST);

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

    await writeWatchlist(db, watchlist);

    window.STOCKS_UNIVERSE = watchlist.map(function (w) { return w.ticker; });
    console.log("[Tier0] window.STOCKS_UNIVERSE updated \u2192 " + window.STOCKS_UNIVERSE.length + " tickers.");

    return watchlist;
  }

  // -----------------------------------------------------------
  // MANUAL TRIGGER
  // -----------------------------------------------------------
  window.runTier0Manual = async function () {
    var db = null;
    try { if (window.firebase && window.firebase.firestore) db = window.firebase.firestore(); } catch (e) {}
    if (!db) throw new Error("[Tier0] Firestore not ready.");
    return runTier0(db);
  };

  // -----------------------------------------------------------
  // AUTO-RUN on page load (weekdays, 8 AM–8 PM ET)
  // -----------------------------------------------------------
  async function autoRunIfNeeded() {
    try {
      var now = new Date();
      var et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      if (et.getDay() === 0 || et.getDay() === 6) return;
      var hour = et.getHours();
      if (hour < 8 || hour >= 20) return;

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

      console.log("[Tier0] No fresh watchlist \u2014 auto-building...");
      await runTier0(db);
    } catch (e) {
      console.warn("[Tier0] Auto-run error:", e.message || e);
    }
  }

  setTimeout(autoRunIfNeeded, 4000);
  console.log("[Tier0] Watchlist builder loaded.");
})();
