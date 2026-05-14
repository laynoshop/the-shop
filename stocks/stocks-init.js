// stocks/stocks-init.js
// Boots the Stocks module.
// Fetches API keys securely from Firebase Remote Config at runtime —
// nothing sensitive is stored in this file or the GitHub repo.

(function () {
  "use strict";

  // Will be populated by loadStocksConfig() before any data fetch runs
  window.STOCKS_CONFIG = {
    FINNHUB_KEY : "",
    FMP_KEY     : "",
    AV_KEY      : "",
    OPENAI_KEY  : "",   // Reserved — will come from Cloud Function proxy
  };

  // ============================================================
  // Load keys from Firebase Remote Config
  // ============================================================
  async function loadStocksConfig() {
    try {
      // firebase is already initialised by boot.js before this runs
      const rc = firebase.remoteConfig();

      // How long the browser caches Remote Config values.
      // 3600s (1 hour) in production; set to 0 during development if you
      // need changes to show immediately.
      rc.settings.minimumFetchIntervalMillis = 3600000;

      // In-app defaults — app still works even if the fetch fails
      rc.defaultConfig = {
        FINNHUB_KEY : "",
        FMP_KEY     : "",
        AV_KEY      : "",
      };

      await rc.fetchAndActivate();

      window.STOCKS_CONFIG.FINNHUB_KEY = rc.getValue("FINNHUB_KEY").asString();
      window.STOCKS_CONFIG.FMP_KEY     = rc.getValue("FMP_KEY").asString();
      window.STOCKS_CONFIG.AV_KEY      = rc.getValue("AV_KEY").asString();

      console.log("[Stocks] Remote Config loaded OK.");
    } catch (err) {
      console.warn("[Stocks] Remote Config fetch failed — stocks features may be limited.", err);
    }
  }

  // ============================================================
  // Expose renderStocks globally (shared.js showTab router calls it)
  // ============================================================
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      // Load keys first, then confirm render function is ready
      await loadStocksConfig();

      if (typeof window.renderStocks === "function") {
        console.log("[Stocks] Init OK — renderStocks ready.");
      } else {
        console.warn("[Stocks] renderStocks not found. Check load order.");
      }
    } catch (e) {
      console.error("[Stocks] Init error:", e);
    }
  });

  // Expose config loader so other stocks modules can await it if needed
  window.loadStocksConfig = loadStocksConfig;

  console.log("[Stocks] Init module loaded.");
})();
