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