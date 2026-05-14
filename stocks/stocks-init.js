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

  // ============================================================
  // Wait for Firebase to be initialised (boot.js calls initializeApp)
  // Then fetch Remote Config keys
  // ============================================================
  async function loadStocksConfig() {
    try {
      // ensureFirebaseChatReady is set by boot.js — waits for auth + Firestore
      if (typeof window.ensureFirebaseChatReady === "function") {
        await window.ensureFirebaseChatReady();
      } else {
        // Fallback: poll until firebase.app() exists
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
      rc.settings.minimumFetchIntervalMillis = 3600000; // 1 hour cache

      rc.defaultConfig = {
        FINNHUB_KEY: "",
        FMP_KEY    : "",
        AV_KEY     : "",
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
  // Boot sequence — runs after DOM is ready
  // ============================================================
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
