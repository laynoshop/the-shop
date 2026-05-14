// stocks/stocks-tier0.js
// TIER 0 — Pre-market watchlist builder.
// Runs automatically via Firebase Scheduled Cloud Function at 9:00 AM ET weekdays.
// Can also be triggered manually from the UI.
// Pulls S&P 500 + Nasdaq from FMP, applies 5 filters, writes ~30-80 tickers
// to Firestore `stockWatchlist/{YYYY-MM-DD}` with trigger metadata.

(function () {
  "use strict";

  const TIER0_CF_URL = "https://us-central1-the-shop-chat.cloudfunctions.net/stocksTier0";

  // -----------------------------------------------------------
  // Trigger Tier 0 manually from the browser (calls Cloud Function)
  // -----------------------------------------------------------
  async function runTier0Manual() {
    try {
      console.log("[Stocks Tier0] Manual trigger started...");
      const res = await fetch(TIER0_CF_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual: true })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("[Stocks Tier0] Cloud Function error:", err);
        return null;
      }
      const data = await res.json();
      console.log("[Stocks Tier0] Manual run complete:", data);
      return data;
    } catch (e) {
      console.error("[Stocks Tier0] runTier0Manual failed:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // Load today's watchlist from Firestore for UI display
  // Returns array of { ticker, sector, triggers[], addedAt }
  // -----------------------------------------------------------
  async function loadTodaysWatchlist(db) {
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      const doc = await db.collection("stockWatchlist").doc(todayKey).get();
      if (!doc.exists) return [];
      const data = doc.data();
      return data.tickers || [];
    } catch (e) {
      console.error("[Stocks Tier0] loadTodaysWatchlist error:", e);
      return [];
    }
  }

  // -----------------------------------------------------------
  // Subscribe to today's watchlist — live updates
  // cb(tickers[]) called on each change
  // -----------------------------------------------------------
  function subscribeTodaysWatchlist(db, cb) {
    const todayKey = new Date().toISOString().slice(0, 10);
    return db.collection("stockWatchlist").doc(todayKey)
      .onSnapshot(snap => {
        if (!snap.exists) { cb([]); return; }
        cb(snap.data().tickers || []);
      }, err => {
        console.error("[Stocks Tier0] Watchlist listener error:", err);
        cb([]);
      });
  }

  // Expose
  window.runTier0Manual            = runTier0Manual;
  window.loadTodaysWatchlist        = loadTodaysWatchlist;
  window.subscribeTodaysWatchlist   = subscribeTodaysWatchlist;

  console.log("[Stocks] Tier 0 module loaded.");
})();
