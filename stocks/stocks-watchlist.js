// stocks/stocks-watchlist.js
// Provides window.subscribeTodaysWatchlist — called by the Daily Watchlist overlay
// in stocks-render.js.  Reads from Firestore: dailyWatchlist/{YYYY-MM-DD}/triggered/{ticker}
// and returns a flat array of ticker objects to the callback via onSnapshot.

(function () {
  "use strict";

  /**
   * Subscribe to today's watchlist in Firestore.
   *
   * @param {firebase.firestore.Firestore} db  - Firestore instance
   * @param {function(Array|null)} callback    - called with array of ticker objects (or null if empty)
   * @returns {function} unsubscribe function
   */
  function subscribeTodaysWatchlist(db, callback) {
    if (!db) {
      console.warn("[Watchlist] Firestore not available.");
      callback(null);
      return function () {};
    }

    var today = new Date().toISOString().slice(0, 10); // e.g. "2026-05-13"
    var triggeredRef = db
      .collection("dailyWatchlist")
      .doc(today)
      .collection("triggered");

    var unsub = triggeredRef.onSnapshot(
      function (snapshot) {
        if (snapshot.empty) {
          callback([]);
          return;
        }
        var tickers = [];
        snapshot.forEach(function (doc) {
          var d = doc.data();
          tickers.push({
            ticker:    doc.id,
            sector:    d.sector    || "",
            price:     d.price     || null,
            changePct: d.changePct !== undefined ? d.changePct : null,
            triggers:  Array.isArray(d.triggers) ? d.triggers : []
          });
        });
        // Sort alphabetically by ticker
        tickers.sort(function (a, b) { return a.ticker.localeCompare(b.ticker); });
        callback(tickers);
      },
      function (err) {
        console.error("[Watchlist] Firestore snapshot error:", err);
        callback([]);
      }
    );

    return unsub;
  }

  window.subscribeTodaysWatchlist = subscribeTodaysWatchlist;
  console.log("[Watchlist] stocks-watchlist.js loaded.");
})();
