// split/boot.js
// Keep this file SMALL + SAFE.
// Its job: crash alerts + config + tiny polyfills.
// DO NOT paste big app logic in here.

(function () {
  // Stamp that boot loaded
  window.__SPLIT_BOOT_OK = true;

  // =========================================================
  // MOBILE DEBUG CONSOLE
  // Intercepts all console output + errors so you can
  // copy/paste logs on your phone instead of using DevTools.
  // =========================================================
  (function initDebugConsole() {
    var __logs = [];
    var MAX_LOGS = 300;

    function ts() {
      var d = new Date();
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }

    function capture(level, args) {
      var msg = Array.from(args).map(function (a) {
        if (a === null) return "null";
        if (a === undefined) return "undefined";
        if (a instanceof Error) return a.message + (a.stack ? "\n" + a.stack : "");
        try { return (typeof a === "object") ? JSON.stringify(a, null, 2) : String(a); }
        catch (e) { return String(a); }
      }).join(" ");
      __logs.push({ level: level, msg: msg, time: ts() });
      if (__logs.length > MAX_LOGS) __logs.shift();
      refreshPanel();
    }

    var _origLog   = console.log.bind(console);
    var _origWarn  = console.warn.bind(console);
    var _origError = console.error.bind(console);
    var _origInfo  = console.info.bind(console);

    console.log   = function() { _origLog.apply(console, arguments);   capture("log",   arguments); };
    console.warn  = function() { _origWarn.apply(console, arguments);  capture("warn",  arguments); };
    console.error = function() { _origError.apply(console, arguments); capture("error", arguments); };
    console.info  = function() { _origInfo.apply(console, arguments);  capture("info",  arguments); };

    window.addEventListener("error", function (e) {
      var msg = (e.message || "Unknown error");
      if (e.filename) msg += " @ " + e.filename.split("/").pop() + ":" + e.lineno;
      __logs.push({ level: "error", msg: "\uD83D\uDEA8 UNCAUGHT: " + msg, time: ts() });
      if (__logs.length > MAX_LOGS) __logs.shift();
      refreshPanel();
      try { alert("JS ERROR: " + (e.message || e)); } catch {}
    });

    window.addEventListener("unhandledrejection", function (e) {
      var reason = e && e.reason ? (e.reason.message || e.reason) : e;
      __logs.push({ level: "error", msg: "\uD83D\uDEA8 PROMISE: " + reason, time: ts() });
      if (__logs.length > MAX_LOGS) __logs.shift();
      refreshPanel();
      try { alert("PROMISE ERROR: " + reason); } catch {}
    });

    // -- UI --
    var panelOpen = false;
    var panelEl   = null;
    var listEl    = null;
    var badgeEl   = null;
    var errorCount = 0;

    function refreshPanel() {
      // Update error badge on button
      var newErrors = __logs.filter(function(l){ return l.level === "error" || l.level === "warn"; }).length;
      if (badgeEl) {
        badgeEl.textContent = newErrors > 0 ? newErrors : "";
        badgeEl.style.display = newErrors > 0 ? "flex" : "none";
      }
      if (panelOpen && listEl) renderLogs();
    }

    function renderLogs() {
      if (!listEl) return;
      var colors = { error: "#ff5555", warn: "#f59e0b", log: "#aaaaaa", info: "#60a5fa" };
      var icons  = { error: "\u274C", warn: "\u26A0\uFE0F", log: "\u25B8", info: "\u2139\uFE0F" };
      if (__logs.length === 0) {
        listEl.innerHTML = "<div style='color:#666;padding:12px;font-style:italic;'>No logs yet.</div>";
        return;
      }
      listEl.innerHTML = __logs.slice().reverse().map(function (entry) {
        var col = colors[entry.level] || "#aaa";
        var icon = icons[entry.level] || "\u25B8";
        var safe = entry.msg.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return "<div style='border-bottom:1px solid #222;padding:6px 8px;'>" +
          "<div style='display:flex;gap:6px;align-items:baseline;'>" +
          "<span style='color:" + col + ";font-size:11px;flex-shrink:0;'>" + icon + " " + entry.level.toUpperCase() + "</span>" +
          "<span style='color:#555;font-size:10px;flex-shrink:0;'>" + entry.time + "</span>" +
          "</div>" +
          "<pre style='margin:2px 0 0;color:" + col + ";font-size:11px;white-space:pre-wrap;word-break:break-all;'>" + safe + "</pre>" +
          "</div>";
      }).join("");
    }

    function buildPanel() {
      panelEl = document.createElement("div");
      panelEl.id = "__debug_panel";
      panelEl.style.cssText = [
        "position:fixed","top:0","left:0","right:0","bottom:0",
        "background:#0d0d0d","color:#ccc","z-index:99999",
        "display:flex","flex-direction:column",
        "font-family:monospace","font-size:12px"
      ].join(";");

      var header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;background:#111;border-bottom:1px solid #333;flex-shrink:0;";
      header.innerHTML = [
        "<span style='font-weight:bold;color:#fff;font-size:14px;flex:1;'>\uD83D\uDC1E Debug Console</span>",
        "<button id='__debug_copy' style='background:#1a1a2e;color:#60a5fa;border:1px solid #333;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;'>\uD83D\uDCCB Copy All</button>",
        "<button id='__debug_clear' style='background:#1a1a2e;color:#f59e0b;border:1px solid #333;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;'>Clear</button>",
        "<button id='__debug_close' style='background:#1a1a2e;color:#ff5555;border:1px solid #333;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;'>\u2715 Close</button>"
      ].join("");

      listEl = document.createElement("div");
      listEl.style.cssText = "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;";

      panelEl.appendChild(header);
      panelEl.appendChild(listEl);
      document.body.appendChild(panelEl);

      document.getElementById("__debug_close").addEventListener("click", function () {
        panelOpen = false;
        panelEl.style.display = "none";
      });
      document.getElementById("__debug_clear").addEventListener("click", function () {
        __logs.length = 0;
        renderLogs();
        refreshPanel();
      });
      document.getElementById("__debug_copy").addEventListener("click", function () {
        var text = __logs.map(function (e) {
          return "[" + e.time + "] [" + e.level.toUpperCase() + "] " + e.msg;
        }).join("\n");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            var btn = document.getElementById("__debug_copy");
            if (btn) { btn.textContent = "\u2705 Copied!"; setTimeout(function(){ btn.textContent = "\uD83D\uDCCB Copy All"; }, 2000); }
          }).catch(function () { prompt("Copy this:", text); });
        } else {
          prompt("Copy this:", text);
        }
      });
    }

    function buildFAB() {
      var fab = document.createElement("button");
      fab.id = "__debug_fab";
      fab.innerHTML = "\uD83D\uDC1E";
      fab.style.cssText = [
        "position:fixed","bottom:80px","right:14px",
        "width:44px","height:44px",
        "background:#1a1a2e","color:#fff",
        "border:2px solid #333","border-radius:50%",
        "font-size:20px","cursor:pointer",
        "z-index:99998","display:flex",
        "align-items:center","justify-content:center",
        "box-shadow:0 2px 12px rgba(0,0,0,0.6)"
      ].join(";");

      badgeEl = document.createElement("span");
      badgeEl.style.cssText = [
        "position:absolute","top:-4px","right:-4px",
        "background:#ef4444","color:#fff",
        "border-radius:50%","width:18px","height:18px",
        "font-size:10px","font-family:sans-serif",
        "display:none","align-items:center","justify-content:center",
        "font-weight:bold","pointer-events:none"
      ].join(";");
      fab.appendChild(badgeEl);

      fab.addEventListener("click", function () {
        panelOpen = true;
        if (!panelEl) buildPanel();
        panelEl.style.display = "flex";
        renderLogs();
        setTimeout(function () { if (listEl) listEl.scrollTop = 0; }, 50);
      });

      document.body.appendChild(fab);
    }

    // Wait for DOM then build the FAB
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", buildFAB);
    } else {
      buildFAB();
    }

    window.__debugLogs = __logs;
  })();
  // =========================================================
  // END DEBUG CONSOLE
  // =========================================================

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
