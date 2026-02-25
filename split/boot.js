// split/boot.js
// Keep this file SMALL + SAFE.
// Its job: crash alerts + config + tiny polyfills.
// DO NOT paste big app logic in here.

(function () {
  // Stamp that boot loaded
  window.__SPLIT_BOOT_OK = true;

  // Loud errors (phone-friendly)
  window.addEventListener("error", (e) => {
    try { alert("JS ERROR: " + (e?.message || e)); } catch {}
  });

  window.addEventListener("unhandledrejection", (e) => {
    try { alert("PROMISE ERROR: " + (e?.reason?.message || e?.reason || e)); } catch {}
  });

  // Firebase config (used by chat + picks)
  window.FIREBASE_CONFIG = {
    apiKey: "AIzaSyBK09tMYLKcDLTMLVn2gYpsezCJAax0Y9Y",
    authDomain: "the-shop-chat.firebaseapp.com",
    projectId: "the-shop-chat",
    storageBucket: "the-shop-chat.firebasestorage.app",
    messagingSenderId: "98648984848",
    appId: "1:98648984848:web:c4e876c8acdb00d8ba2995"
  };

  // iOS/PWA safety: CSS.escape polyfill
  (function ensureCssEscape() {
    if (!window.CSS) window.CSS = {};
    if (typeof window.CSS.escape === "function") return;

    window.CSS.escape = function (value) {
      const str = String(value);
      return str.replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function (ch) {
        const hex = ch.codePointAt(0).toString(16).toUpperCase();
        return "\\" + hex + " ";
      });
    };
  })();

  // Optional build stamp (helps confirm deploy)
  window.__SCARLETKEY_BUILD = "split-boot-OK";
  try { console.log("Boot OK:", window.__SCARLETKEY_BUILD); } catch {}
})();

// =========================
// COUNTDOWN TO THE GAME
// =========================
(function () {

  function getGameDate() {
    // Adjust to the actual next Game date
    // Example: Nov 29, 2025 at Noon
    return new Date("November 29, 2025 12:00:00");
  }

  function updateCountdown() {
    const target = getGameDate();
    const now = new Date();
    const diff = target - now;

    if (diff <= 0) return;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / (1000 * 60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(val).padStart(2, "0");
    };

    set("cdDays", days);
    set("cdHours", hours);
    set("cdMins", mins);
    set("cdSecs", secs);
  }

  window.startCountdown = function () {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  };

})();