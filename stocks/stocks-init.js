// stocks/stocks-init.js
// Boots the Stocks module.
// Fetches API keys from Firebase Remote Config at runtime.
// Waits for Firebase to be fully ready before attempting Remote Config.

(function () {
  "use strict";

  window.STOCKS_CONFIG = {
    FINNHUB_KEY          : "",
    FMP_KEY              : "",
    AV_KEY               : "",
    OPENAI_KEY           : "",   // Not used client-side — Cloud Function holds this
    SIGNALS_COLLECTION   : "stockSignals",
    CANDIDATES_COLLECTION: "stockCandidates"
  };

  async function loadStocksConfig() {
    try {
      if (typeof window.ensureFirebaseChatReady === "function") {
        await window.ensureFirebaseChatReady();
      } else {
        await new Promise((resolve) => {
          let tries = 0;
          const t = setInterval(() => {
            tries++;
            try {
              if (window.firebase && window.firebase.app()) {
                clearInterval(t);
                resolve();
              }
            } catch {}
            if (tries > 100) { clearInterval(t); resolve(); }
          }, 100);
        });
      }

      const rc = firebase.remoteConfig();
      rc.settings.minimumFetchIntervalMillis = 0; // Force fresh fetch every time (cache bust)

      rc.defaultConfig = {
        FINNHUB_KEY: "",
        FMP_KEY    : "",
        AV_KEY     : "",
      };

      await rc.fetchAndActivate();

      window.STOCKS_CONFIG.FINNHUB_KEY = rc.getValue("FINNHUB_KEY").asString();
      window.STOCKS_CONFIG.FMP_KEY     = rc.getValue("FMP_KEY").asString();
      window.STOCKS_CONFIG.AV_KEY      = rc.getValue("AV_KEY").asString();

      console.log("[Stocks] Remote Config loaded OK. Finnhub key tail:", window.STOCKS_CONFIG.FINNHUB_KEY.slice(-6));
    } catch (err) {
      console.warn("[Stocks] Remote Config fetch failed — stocks features may be limited.", err);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
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

  window.loadStocksConfig = loadStocksConfig;

  console.log("[Stocks] Init module loaded.");
})();
