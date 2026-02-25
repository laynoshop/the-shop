/* split/logout.js
   =========================
   LOGOUT / RESET SESSION (SAFE)
   - Clears local session keys
   - Best-effort Firebase sign out (if loaded)
   - Returns to login
   ========================= */

(function () {
  "use strict";

  const KEYS_TO_CLEAR = [
    "theShopRole_v1",
    "theShopPicksName_v1",
    "theShopChatName_v1",
    "theShopInviteOk_v1",
    "theShopAuthed_v1",
    "theShopTopNewsCache_v1",
    "theShopTopNewsFilter_v1",
    // Uncomment if you want logout to reset these too:
    // "theShopLeague_v1",
    // "theShopDate_v1",
  ];

  async function safeFirebaseSignOut() {
    try {
      if (window.firebase && firebase.auth) {
        const auth = firebase.auth();
        if (auth && auth.currentUser) await auth.signOut();
      }
    } catch (e) {
      console.warn("Firebase signOut failed (ignored):", e);
    }
  }

  function clearKeys() {
    for (const k of KEYS_TO_CLEAR) {
      try { localStorage.removeItem(k); } catch {}
    }
  }

  async function doLogout() {
    clearKeys();
    await safeFirebaseSignOut();

    // Prefer app's login router if it exists
    try {
      if (typeof window.showLogin === "function") {
        window.showLogin();
        return;
      }
    } catch {}

    // Fallback: hard reload
    window.location.reload();
  }

  // ✅ Backwards-compatible exports
  window.doLogout = doLogout;
  window.logout = doLogout; // <-- this fixes "Can't find variable: logout"

})();