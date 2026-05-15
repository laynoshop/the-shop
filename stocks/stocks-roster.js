// stocks/stocks-roster.js
// THE ROSTER — Manages the master curated ticker list in Firestore.
// Persists to `stockRoster` collection (single doc: `master`).
// Max 20 tickers. Add/remove/load functions exposed on window.

(function () {
  "use strict";

  const ROSTER_COLLECTION = "stockRoster";
  const ROSTER_DOC_ID     = "master";
  const MAX_TICKERS       = 20;

  function getDb() {
    try { return window.firebase && window.firebase.firestore ? window.firebase.firestore() : null; }
    catch { return null; }
  }

  // Load roster tickers from Firestore — returns array of uppercase strings
  async function loadRoster() {
    const db = getDb();
    if (!db) return [];
    try {
      const doc = await db.collection(ROSTER_COLLECTION).doc(ROSTER_DOC_ID).get();
      if (!doc.exists) return [];
      return (doc.data().tickers || []).map(t => t.toUpperCase());
    } catch (e) {
      console.warn("[Roster] Load error:", e);
      return [];
    }
  }

  // Save full ticker array to Firestore
  async function saveRoster(tickers) {
    const db = getDb();
    if (!db) return;
    try {
      await db.collection(ROSTER_COLLECTION).doc(ROSTER_DOC_ID).set({ tickers, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      console.error("[Roster] Save error:", e);
    }
  }

  // Add a ticker — returns { ok, reason } 
  async function addToRoster(ticker) {
    const clean = ticker.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
    if (!clean) return { ok: false, reason: "Invalid ticker" };
    const current = await loadRoster();
    if (current.includes(clean)) return { ok: false, reason: `${clean} is already on The Roster` };
    if (current.length >= MAX_TICKERS) return { ok: false, reason: `Roster is full (${MAX_TICKERS} max). Remove a ticker first.` };
    const updated = [...current, clean];
    await saveRoster(updated);
    console.log(`[Roster] Added ${clean}. Roster: ${updated.join(", ")}`);
    return { ok: true, tickers: updated };
  }

  // Remove a ticker
  async function removeFromRoster(ticker) {
    const clean = ticker.trim().toUpperCase();
    const current = await loadRoster();
    const updated = current.filter(t => t !== clean);
    await saveRoster(updated);
    console.log(`[Roster] Removed ${clean}. Roster: ${updated.join(", ")}`);
    return { ok: true, tickers: updated };
  }

  window.loadRoster         = loadRoster;
  window.addToRoster        = addToRoster;
  window.removeFromRoster   = removeFromRoster;
  window.saveRoster         = saveRoster;
  window.ROSTER_MAX         = MAX_TICKERS;

  console.log("[Stocks] Roster module loaded.");
})();
