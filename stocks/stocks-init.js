// stocks/stocks-init.js
// Wires the Stocks tab into the app.
// Loaded last among the stocks/ files.

(function () {
  "use strict";

  // Expose renderStocks globally (shared.js showTab router calls it)
  // renderStocks is already set by stocks-render.js — this just confirms it.
  document.addEventListener("DOMContentLoaded", () => {
    try {
      if (typeof window.renderStocks === "function") {
        console.log("[Stocks] Init OK — renderStocks ready.");
      } else {
        console.warn("[Stocks] renderStocks not found. Check load order.");
      }
    } catch {}
  });

  console.log("[Stocks] Init module loaded.");
})();
