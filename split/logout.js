/* split/logout.js
   =========================
   LOGOUT / RESET SESSION (SAFE)
   - Clears local session keys
   - Optionally signs out Firebase (if loaded)
   - Returns to login
   ========================= */

(function () {
  "use strict";

  // Change this list if you want to preserve some settings
  const KEYS_TO_CLEAR = [
    "theShopRole_v1",
    "theShopPicksName_v1",
    "theShopChatName_v1",
    "theShopInviteOk_v1",
    "theShopAuthed_v1",
    "theShopTopNewsCache_v1",
    "theShopTopNewsFilter_v1",
    // Keep league/date if you want:
    // "theShopLeague_v1",
    // "theShopDate_v1",
  ];

  async function safeFirebaseSignOut() {
    try {
      if (window.firebase && firebase.auth) {
        const auth = firebase.auth();
        if (auth && auth.currentUser) {
          await auth.signOut();
        }
      }
    } catch (e) {
      // ignore
      console.warn("Firebase signOut failed (ignored):", e);
    }
  }

  function clearKeys() {
    for (const k of KEYS_TO_CLEAR) {
      try { localStorage.removeItem(k); } catch {}
    }
  }

  async function doLogout() {
    // Clear local state first
    clearKeys();

    // Firebase sign out (best-effort)
    await safeFirebaseSignOut();

    // Return to login (prefer your existing app router if present)
    try {
      if (typeof window.showLogin === "function") {
        window.showLogin();
        return;
      }
    } catch {}

    // Fallback: hard reload
    window.location.reload();
  }

  // Expose for buttons / menu links
  window.doLogout = doLogout;

})();