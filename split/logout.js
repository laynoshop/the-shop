/* split/logout.js
   =========================
   LOGOUT / RESET SESSION (SAFE)
   - Clears local + session keys
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

  // Session caches your Scores tab uses (optional but recommended)
  const SESSION_KEYS_TO_CLEAR_PREFIXES = [
    "theShopOddsCache_v1_",
    "theShopAiInsightCache_v1",
    "theShopConfCache_v1_"
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

  function clearLocalKeys() {
    for (const k of KEYS_TO_CLEAR) {
      try { localStorage.removeItem(k); } catch {}
    }
  }

  function clearSessionKeys() {
    try {
      // Remove exact known key
      sessionStorage.removeItem("theShopAiInsightCache_v1");
    } catch {}

    // Remove any session keys that start with known prefixes
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        if (SESSION_KEYS_TO_CLEAR_PREFIXES.some(p => k.startsWith(p))) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {}
  }

  function showLoginFallback() {
    // If you ever add window.showLogin, we’ll use it.
    try {
      if (typeof window.showLogin === "function") {
        window.showLogin();
        return true;
      }
    } catch {}

    // Soft fallback that matches your split DOM IDs
    try {
      const login = document.getElementById("login");
      const entry = document.getElementById("entry");
      const app = document.getElementById("app");

      document.body.classList.add("entryMode");

      if (app) app.style.display = "none";
      if (entry) entry.style.display = "none";
      if (login) login.style.display = "block";

      // Clear password input if present
      const code = document.getElementById("code");
      if (code) code.value = "";

      return true;
    } catch {}

    return false;
  }

  async function doLogout() {
    clearLocalKeys();
    clearSessionKeys();
    await safeFirebaseSignOut();

    // Prefer soft return to login; otherwise hard reload
    if (!showLoginFallback()) {
      window.location.reload();
    }
  }

  // ✅ Backwards-compatible exports
  window.doLogout = doLogout;
  window.logout = doLogout; // fixes "Can't find variable: logout"
})();