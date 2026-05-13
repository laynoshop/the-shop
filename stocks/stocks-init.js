// stocks/stocks-init.js
// Wires the Stocks tab into the app.
// Loaded last among the stocks/ files.

(function () {
  "use strict";

  // ============================================================
  // API KEYS
  // ============================================================
  window.STOCKS_CONFIG = {
    FINNHUB_KEY : "d826gf9r01gtiq8uqmo0d826g",
    FMP_KEY     : "tImqah3bCdyE0yZ6J9b46MSwj1IeeZWQ",
    OPENAI_KEY  : "PASTE_NEW_KEY_HERE",   // <-- rotate & paste new key from OpenAI
    AV_KEY      : "",                     // Alpha Vantage (free signup if needed)
  };

  // Expose renderStocks globally (shared.js showTab router calls it)
  // renderStocks is already set by stocks-render.js — this just confirms it.
  document.addEventListener("DOMContentLoaded", () => {
    try {
      if (typeof window.renderStocks === "function") {
        console.log("[Stocks] Init OK \u2014 renderStocks ready.");
      } else {
        console.warn("[Stocks] renderStocks not found. Check load order.");
      }
    } catch {}
  });

  console.log("[Stocks] Init module loaded.");
})();
