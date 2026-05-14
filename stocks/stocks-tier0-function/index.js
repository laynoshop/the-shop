// stocks/stocks-tier0-function/index.js
// Firebase Cloud Function: stocksTier0
// Scheduled: every weekday at 9:00 AM ET
// Also callable manually via HTTP POST { manual: true }
//
// DEPLOY COMMANDS:
//   cd stocks/stocks-tier0-function
//   npm install
//   firebase deploy --only functions:stocksTier0
//
// REQUIRED ENV VARS (set via Firebase Secret Manager or .env):
//   FMP_KEY   — Financial Modeling Prep API key (Starter plan required)
//   FINNHUB_KEY — Finnhub API key (free tier ok)

const functions  = require("firebase-functions");
const admin      = require("firebase-admin");
const fetch      = require("node-fetch");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ---- Config ----
const FMP_KEY     = process.env.FMP_KEY     || functions.config().stocks?.fmp_key     || "";
const FINNHUB_KEY = process.env.FINNHUB_KEY || functions.config().stocks?.finnhub_key || "";

const MIN_TRIGGERS      = 2;    // ticker must pass at least 2 filters to be included
const MAX_WATCHLIST     = 80;   // cap at 80 tickers
const GAP_THRESHOLD_PCT = 1.0;  // % gap up or down vs prev close
const VOLUME_SURGE_MULT = 1.5;  // volume must be 1.5x 10-day average
const EARNINGS_DAYS_OUT = 7;    // earnings within 7 calendar days
const NEWS_MIN_ARTICLES = 3;    // at least 3 news articles in 48h

// ---- Helpers ----
function todayET() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // YYYY-MM-DD
}

async function fmpGet(path) {
  const url = `https://financialmodelingprep.com/api/v3/${path}&apikey=${FMP_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP ${path} → ${res.status}`);
  return res.json();
}

async function finnhubGet(path) {
  const url = `https://finnhub.io/api/v1/${path}&token=${FINNHUB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// ---- Filter 1: Gap scanner (price gap vs prev close) ----
async function getGappers() {
  // FMP /stock-screener returns pre-market movers
  // We use gainers + losers endpoints for gap detection
  try {
    const [gainers, losers] = await Promise.all([
      fmpGet("stock_market/gainers?"),
      fmpGet("stock_market/losers?")
    ]);
    const gapUp   = (gainers || []).filter(s => parseFloat(s.changesPercentage) >= GAP_THRESHOLD_PCT)
                                   .map(s => ({ ticker: s.ticker, changePct: parseFloat(s.changesPercentage), trigger: "gap_up", price: s.price, sector: s.sector || "" }));
    const gapDown = (losers  || []).filter(s => parseFloat(s.changesPercentage) <= -GAP_THRESHOLD_PCT)
                                   .map(s => ({ ticker: s.ticker, changePct: parseFloat(s.changesPercentage), trigger: "gap_down", price: s.price, sector: s.sector || "" }));
    return [...gapUp, ...gapDown];
  } catch (e) {
    console.error("[Tier0] Gap filter error:", e.message);
    return [];
  }
}

// ---- Filter 2: Volume surge ----
async function getVolumeSurge() {
  try {
    const data = await fmpGet("stock_market/actives?");
    return (data || [])
      .filter(s => s.volume && s.avgVolume && (s.volume / s.avgVolume) >= VOLUME_SURGE_MULT)
      .map(s => ({ ticker: s.ticker, trigger: "volume_surge", price: s.price, sector: s.sector || "", changePct: parseFloat(s.changesPercentage || 0) }));
  } catch (e) {
    console.error("[Tier0] Volume filter error:", e.message);
    return [];
  }
}

// ---- Filter 3: Earnings proximity ----
async function getEarningsProximity() {
  try {
    const today = new Date();
    const from  = todayET();
    const to    = new Date(today.getTime() + EARNINGS_DAYS_OUT * 864e5)
                    .toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const data = await fmpGet(`earning_calendar?from=${from}&to=${to}`);
    return (data || []).map(s => ({ ticker: s.symbol, trigger: "earnings_proximity", price: null, sector: "", changePct: 0 }));
  } catch (e) {
    console.error("[Tier0] Earnings filter error:", e.message);
    return [];
  }
}

// ---- Filter 4: Sector momentum (top 2 sectors by ETF performance) ----
const SECTOR_ETFS = {
  XLK: "Technology", XLF: "Financials", XLE: "Energy",
  XLV: "Healthcare", XLI: "Industrials", XLY: "Consumer Discretionary",
  XLP: "Consumer Staples", XLRE: "Real Estate", XLB: "Materials", XLU: "Utilities"
};

async function getSectorMomentum() {
  try {
    const quotes = await Promise.all(
      Object.keys(SECTOR_ETFS).map(etf => fmpGet(`quote/${etf}?`))
    );
    const etfPerf = quotes
      .map((q, i) => ({ etf: Object.keys(SECTOR_ETFS)[i], sector: Object.values(SECTOR_ETFS)[i], pct: parseFloat((q?.[0]?.changesPercentage) || 0) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 2);

    const hotSectors = etfPerf.map(e => e.sector);
    console.log("[Tier0] Hot sectors:", hotSectors);

    // Pull S&P 500 stocks in those sectors via screener
    const results = [];
    for (const sector of hotSectors) {
      const data = await fmpGet(`stock-screener?exchange=NYSE,NASDAQ&sector=${encodeURIComponent(sector)}&marketCapMoreThan=1000000000&limit=50`);
      (data || []).forEach(s => results.push({ ticker: s.symbol, trigger: "sector_momentum", price: s.price, sector, changePct: parseFloat(s.changesPercentage || 0) }));
    }
    return results;
  } catch (e) {
    console.error("[Tier0] Sector momentum error:", e.message);
    return [];
  }
}

// ---- Filter 5: News activity (Finnhub) ----
async function getNewsActive(tickers) {
  const results = [];
  const to   = new Date();
  const from = new Date(Date.now() - 48 * 36e5);
  const fmt  = d => d.toISOString().split("T")[0];

  // Sample 60 tickers to avoid rate limits
  const sample = tickers.slice(0, 60);
  for (const ticker of sample) {
    try {
      const data = await finnhubGet(`company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}`);
      if (data && data.length >= NEWS_MIN_ARTICLES) {
        results.push({ ticker, trigger: "news_activity", price: null, sector: "", changePct: 0 });
      }
      await new Promise(r => setTimeout(r, 80)); // rate limit spacing
    } catch { /* skip */ }
  }
  return results;
}

// ---- Main Tier 0 logic ----
async function runTier0() {
  console.log("[Tier0] Starting pre-market screener...");

  const [gappers, volumeSurge, earningsProx, sectorMom] = await Promise.all([
    getGappers(),
    getVolumeSurge(),
    getEarningsProximity(),
    getSectorMomentum()
  ]);

  // Collect all unique tickers from the first 4 filters for news check
  const allTickers = [...new Set([
    ...gappers.map(t => t.ticker),
    ...volumeSurge.map(t => t.ticker),
    ...earningsProx.map(t => t.ticker),
    ...sectorMom.map(t => t.ticker)
  ])];

  const newsActive = await getNewsActive(allTickers);

  // Merge all hits into a map: ticker → { ...meta, triggers: Set }
  const tickerMap = {};

  const allHits = [...gappers, ...volumeSurge, ...earningsProx, ...sectorMom, ...newsActive];

  allHits.forEach(hit => {
    const tk = hit.ticker;
    if (!tickerMap[tk]) {
      tickerMap[tk] = {
        ticker:    tk,
        sector:    hit.sector || "",
        price:     hit.price  || null,
        changePct: hit.changePct || 0,
        triggers:  new Set()
      };
    }
    tickerMap[tk].triggers.add(hit.trigger);
    if (hit.price)     tickerMap[tk].price     = hit.price;
    if (hit.sector)    tickerMap[tk].sector    = hit.sector;
    if (hit.changePct) tickerMap[tk].changePct = hit.changePct;
  });

  // Filter: must have at least MIN_TRIGGERS distinct filters
  let watchlist = Object.values(tickerMap)
    .filter(t => t.triggers.size >= MIN_TRIGGERS)
    .map(t => ({ ...t, triggers: Array.from(t.triggers) }))
    .sort((a, b) => b.triggers.length - a.triggers.length) // most-triggered first
    .slice(0, MAX_WATCHLIST);

  console.log(`[Tier0] Watchlist built: ${watchlist.length} tickers`);

  // Write to Firestore
  const todayKey = todayET();
  await db.collection("stockWatchlist").doc(todayKey).set({
    date:      todayKey,
    builtAt:   admin.firestore.FieldValue.serverTimestamp(),
    count:     watchlist.length,
    tickers:   watchlist
  });

  // Also update STOCKS_UNIVERSE in a config doc so Tier 1 picks it up
  await db.collection("stocksConfig").doc("universe").set({
    tickers:   watchlist.map(t => t.ticker),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return watchlist;
}

// ---- Scheduled trigger: every weekday at 9:00 AM ET ----
exports.stocksTier0Scheduled = functions
  .pubsub
  .schedule("0 9 * * 1-5")        // cron: 9:00 AM UTC Mon-Fri
  .timeZone("America/New_York")   // Firebase honors this for ET
  .onRun(async () => {
    try {
      await runTier0();
    } catch (e) {
      console.error("[Tier0] Scheduled run error:", e);
    }
    return null;
  });

// ---- Manual HTTP trigger ----
exports.stocksTier0 = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Methods", "POST"); res.set("Access-Control-Allow-Headers", "Content-Type"); res.status(204).send(""); return; }
  try {
    const watchlist = await runTier0();
    res.json({ success: true, count: watchlist.length, tickers: watchlist.map(t => t.ticker) });
  } catch (e) {
    console.error("[Tier0] HTTP trigger error:", e);
    res.status(500).json({ error: e.message });
  }
});
