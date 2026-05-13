// stocks/stocks-data.js
// Ticker universe: S&P 500 sample + Nasdaq top names for free-tier testing.
// In production, swap this for a dynamic fetch from FMP or Polygon.

(function () {
  "use strict";

  // -----------------------------------------------------------
  // FREE-TIER STARTER UNIVERSE
  // 30 high-volume, well-known tickers that will generate real
  // signals on Finnhub's free plan without blowing rate limits.
  // Expand this list once you upgrade to paid API plans.
  // -----------------------------------------------------------
  window.STOCKS_UNIVERSE = [
    // Mega-cap tech (Nasdaq heavy-hitters)
    "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA",
    // Semiconductors
    "AMD", "INTC", "AVGO", "QCOM",
    // Financials
    "JPM", "BAC", "GS", "V", "MA",
    // Healthcare
    "JNJ", "UNH", "PFE",
    // Energy
    "XOM", "CVX",
    // ETFs (broad market + sector)
    "QQQ", "SPY", "IWM", "XLF", "XLK", "XLE",
    // High-volatility momentum names
    "MSTR", "PLTR", "COIN"
  ];

  // -----------------------------------------------------------
  // TIER 1 THRESHOLDS — tweak these to tune signal sensitivity
  // -----------------------------------------------------------
  window.STOCKS_CONFIG = {
    // RSI extremes
    RSI_OVERBOUGHT:   70,
    RSI_OVERSOLD:     30,

    // Minimum % price move in the last quote vs prev close
    MIN_PRICE_MOVE_PCT: 0.75,

    // Cooldown: don't re-signal same ticker within this many ms
    SIGNAL_COOLDOWN_MS: 2 * 60 * 60 * 1000, // 2 hours

    // Firestore collection names
    CANDIDATES_COLLECTION: "stockCandidates",
    SIGNALS_COLLECTION:    "stockSignals",

    // Market hours (Eastern) — screener ignores off-hours
    MARKET_OPEN_HOUR:  9,
    MARKET_OPEN_MIN:   30,
    MARKET_CLOSE_HOUR: 16,
    MARKET_CLOSE_MIN:  0
  };

  console.log("[Stocks] Data module loaded. Universe:", window.STOCKS_UNIVERSE.length, "tickers");
})();
