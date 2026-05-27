// split/boot.js
// Keep this file SMALL + SAFE.
// Its job: crash alerts + config + tiny polyfills.
// DO NOT paste big app logic in here.

(function () {
  window.__SPLIT_BOOT_OK = true;

  // =========================================================
  // MOBILE DEBUG CONSOLE
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
    });

    window.addEventListener("unhandledrejection", function (e) {
      var reason = e && e.reason ? (e.reason.message || e.reason) : e;
      __logs.push({ level: "error", msg: "\uD83D\uDEA8 PROMISE: " + reason, time: ts() });
      if (__logs.length > MAX_LOGS) __logs.shift();
      refreshPanel();
    });

    var panelOpen = false;
    var panelEl   = null;
    var listEl    = null;
    var badgeEl   = null;
    var ringOpen  = false;
    var ringEls   = [];
    var fabWrap   = null;
    var fabMain   = null;
    var preLoginDebugBtn = null;  // standalone debug btn shown before login

    function refreshPanel() {
      var newErrors = __logs.filter(function(l){ return l.level === "error" || l.level === "warn"; }).length;
      if (badgeEl) {
        badgeEl.textContent = newErrors > 0 ? newErrors : "";
        badgeEl.style.display = newErrors > 0 ? "flex" : "none";
      }
      // Also badge the pre-login debug button
      if (preLoginDebugBtn) {
        var preB = document.getElementById("__pre_debug_badge");
        if (preB) {
          preB.textContent = newErrors > 0 ? newErrors : "";
          preB.style.display = newErrors > 0 ? "flex" : "none";
        }
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
        var col  = colors[entry.level] || "#aaa";
        var icon = icons[entry.level]  || "\u25B8";
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
        "display:flex","flex-direction:column","font-family:monospace","font-size:12px"
      ].join(";");
      var header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;gap:8px;padding:10px 12px;background:#111;border-bottom:1px solid #333;flex-shrink:0;";
      header.innerHTML = [
        "<span style='font-weight:bold;color:#fff;font-size:14px;flex:1;'>\uD83D\uDC1E Debug Console</span>",
        "<button id='__debug_copy'  style='background:#1a1a2e;color:#60a5fa;border:1px solid #333;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;'>\uD83D\uDCCB Copy All</button>",
        "<button id='__debug_clear' style='background:#1a1a2e;color:#f59e0b;border:1px solid #333;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;'>Clear</button>",
        "<button id='__debug_close' style='background:#1a1a2e;color:#ff5555;border:1px solid #333;border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;'>\u2715 Close</button>"
      ].join("");
      listEl = document.createElement("div");
      listEl.style.cssText = "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;";
      panelEl.appendChild(header);
      panelEl.appendChild(listEl);
      document.body.appendChild(panelEl);
      document.getElementById("__debug_close").addEventListener("click", function () { panelOpen = false; panelEl.style.display = "none"; });
      document.getElementById("__debug_clear").addEventListener("click", function () { __logs.length = 0; renderLogs(); refreshPanel(); });
      document.getElementById("__debug_copy").addEventListener("click", function () {
        var text = __logs.map(function (e) { return "[" + e.time + "] [" + e.level.toUpperCase() + "] " + e.msg; }).join("\n");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            var btn = document.getElementById("__debug_copy");
            if (btn) { btn.textContent = "\u2705 Copied!"; setTimeout(function(){ btn.textContent = "\uD83D\uDCCB Copy All"; }, 2000); }
          }).catch(function () { prompt("Copy this:", text); });
        } else { prompt("Copy this:", text); }
      });
    }

    // =========================================================
    // WEATHER OVERLAY
    // =========================================================
    var weatherOverlayEl = null;
    var WMO_CODES = {
      0:{label:"Clear Sky",icon:"\u2600\uFE0F"},1:{label:"Mainly Clear",icon:"\uD83C\uDF24\uFE0F"},
      2:{label:"Partly Cloudy",icon:"\u26C5"},3:{label:"Overcast",icon:"\u2601\uFE0F"},
      45:{label:"Foggy",icon:"\uD83C\uDF2B\uFE0F"},48:{label:"Icy Fog",icon:"\uD83C\uDF2B\uFE0F"},
      51:{label:"Light Drizzle",icon:"\uD83C\uDF26\uFE0F"},53:{label:"Drizzle",icon:"\uD83C\uDF26\uFE0F"},
      55:{label:"Heavy Drizzle",icon:"\uD83C\uDF27\uFE0F"},61:{label:"Light Rain",icon:"\uD83C\uDF27\uFE0F"},
      63:{label:"Rain",icon:"\uD83C\uDF27\uFE0F"},65:{label:"Heavy Rain",icon:"\uD83C\uDF27\uFE0F"},
      71:{label:"Light Snow",icon:"\uD83C\uDF28\uFE0F"},73:{label:"Snow",icon:"\u2744\uFE0F"},
      75:{label:"Heavy Snow",icon:"\u2744\uFE0F"},77:{label:"Snow Grains",icon:"\uD83C\uDF28\uFE0F"},
      80:{label:"Rain Showers",icon:"\uD83C\uDF26\uFE0F"},81:{label:"Rain Showers",icon:"\uD83C\uDF27\uFE0F"},
      82:{label:"Heavy Showers",icon:"\u26C8\uFE0F"},85:{label:"Snow Showers",icon:"\uD83C\uDF28\uFE0F"},
      86:{label:"Heavy Snow Showers",icon:"\u2744\uFE0F"},95:{label:"Thunderstorm",icon:"\u26C8\uFE0F"},
      96:{label:"Thunderstorm w/ Hail",icon:"\u26C8\uFE0F"},99:{label:"Thunderstorm w/ Heavy Hail",icon:"\u26C8\uFE0F"}
    };
    function wmo(code) { return WMO_CODES[code] || { label: "Unknown", icon: "\uD83C\uDF21\uFE0F" }; }
    function dayLabel(dateStr, i) {
      if (i === 0) return "Today";
      if (i === 1) return "Tomorrow";
      return new Date(dateStr + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    }
    function buildWeatherOverlay() {
      weatherOverlayEl = document.createElement("div");
      weatherOverlayEl.id = "__weather_overlay";
      weatherOverlayEl.style.cssText = "position:fixed;inset:0;z-index:99997;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);";
      weatherOverlayEl.innerHTML =
        "<div id='__weather_card' style='background:#1a1a2e;border:1px solid #333;border-radius:16px;width:min(92vw,400px);max-height:85vh;overflow-y:auto;padding:20px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.7);font-family:-apple-system,system-ui,sans-serif;color:#e0e0e0;'>" +
        "<button id='__weather_close' style='position:absolute;top:12px;right:14px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;'>\u2715</button>" +
        "<div id='__weather_body'><div style='text-align:center;padding:30px;color:#666;'>Loading weather\u2026</div></div></div>";
      document.body.appendChild(weatherOverlayEl);
      document.getElementById("__weather_close").addEventListener("click", closeWeather);
      weatherOverlayEl.addEventListener("click", function(e){ if (e.target === weatherOverlayEl) closeWeather(); });
      fetchWeather();
    }
    function closeWeather() { if (weatherOverlayEl) weatherOverlayEl.style.display = "none"; }
    function openWeather() {
      if (!weatherOverlayEl) { buildWeatherOverlay(); }
      else { weatherOverlayEl.style.display = "flex"; fetchWeather(); }
    }
    function fetchWeather() {
      var body = document.getElementById("__weather_body");
      if (body) body.innerHTML = "<div style='text-align:center;padding:30px;color:#666;'>Loading weather\u2026</div>";
      var url = "https://api.open-meteo.com/v1/forecast?latitude=40.2365&longitude=-83.3677" +
        "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max" +
        "&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=6&timezone=America%2FNew_York";
      fetch(url).then(function(r){ return r.json(); }).then(renderWeather).catch(renderWeatherError);
    }
    function metaTile(label, value) {
      return "<div style='background:#111;border-radius:10px;padding:10px 12px;text-align:center;'>" +
        "<div style='font-size:11px;color:#666;margin-bottom:2px;'>" + label + "</div>" +
        "<div style='font-size:16px;font-weight:700;color:#fff;'>" + value + "</div></div>";
    }
    function renderWeather(data) {
      var body = document.getElementById("__weather_body"); if (!body) return;
      var cur = data.current || {}, daily = data.daily || {};
      var curWmo = wmo(cur.weather_code);
      var html = [
        "<div style='text-align:center;margin-bottom:16px;'>",
        "<div style='font-size:13px;color:#bb0000;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;'>Marysville, OH</div>",
        "<div style='font-size:64px;line-height:1;margin-bottom:4px;'>" + curWmo.icon + "</div>",
        "<div style='font-size:48px;font-weight:800;color:#fff;line-height:1;'>" + Math.round(cur.temperature_2m||0) + "\u00b0F</div>",
        "<div style='font-size:15px;color:#aaa;margin-top:6px;'>" + curWmo.label + "</div></div>",
        "<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;'>",
        metaTile("\uD83C\uDF21\uFE0F Feels Like", Math.round(cur.apparent_temperature||0) + "\u00b0F"),
        metaTile("\uD83D\uDCC8 High", Math.round((daily.temperature_2m_max||[])[0]||0) + "\u00b0F"),
        metaTile("\uD83D\uDCC9 Low",  Math.round((daily.temperature_2m_min||[])[0]||0) + "\u00b0F"),
        metaTile("\uD83D\uDCA7 Humidity", Math.round(cur.relative_humidity_2m||0) + "%"),
        metaTile("\uD83D\uDCA8 Wind", Math.round(cur.wind_speed_10m||0) + " mph"),
        "</div><div style='border-top:1px solid #333;padding-top:14px;'>",
        "<div style='font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;'>5-Day Forecast</div>"
      ].join("");
      var dates = daily.time || [];
      for (var i = 1; i <= 5; i++) {
        if (!dates[i]) continue;
        var dWmo = wmo((daily.weather_code||[])[i]);
        var hi = Math.round((daily.temperature_2m_max||[])[i]||0);
        var lo = Math.round((daily.temperature_2m_min||[])[i]||0);
        var precip = (daily.precipitation_probability_max||[])[i]||0;
        var wind = Math.round((daily.wind_speed_10m_max||[])[i]||0);
        html += "<div style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #222;'>" +
          "<span style='font-size:22px;width:32px;text-align:center;'>" + dWmo.icon + "</span>" +
          "<div style='flex:1;'><div style='font-size:13px;font-weight:600;color:#e0e0e0;'>" + dayLabel(dates[i],i) + "</div>" +
          "<div style='font-size:11px;color:#888;'>" + dWmo.label + (precip>0?" \u00b7 \uD83D\uDCA7 "+precip+"%":"") + " \u00b7 \uD83D\uDCA8 " + wind + " mph</div></div>" +
          "<div style='text-align:right;'><span style='font-size:14px;font-weight:700;color:#fff;'>" + hi + "\u00b0</span>" +
          "<span style='font-size:13px;color:#666;margin-left:4px;'>" + lo + "\u00b0</span></div></div>";
      }
      body.innerHTML = html + "</div>";
    }
    function renderWeatherError(err) {
      var body = document.getElementById("__weather_body");
      if (body) body.innerHTML = "<div style='text-align:center;padding:30px;color:#f59e0b;'>\u26a0\ufe0f Could not load weather.<br><small style='color:#666;'>" + (err&&err.message?err.message:"Network error") + "</small></div>";
    }

    // =========================================================
    // LOGOUT CONFIRM DIALOG
    // =========================================================
    var logoutDialogEl = null;
    function buildLogoutDialog() {
      logoutDialogEl = document.createElement("div");
      logoutDialogEl.id = "__logout_dialog";
      logoutDialogEl.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);";
      logoutDialogEl.innerHTML =
        "<div style='background:#1a1a2e;border:1px solid #444;border-radius:16px;width:min(88vw,320px);padding:28px 24px 20px;box-shadow:0 8px 40px rgba(0,0,0,0.8);font-family:-apple-system,system-ui,sans-serif;text-align:center;color:#e0e0e0;'>" +
        "<div style='font-size:40px;margin-bottom:12px;'>\uD83D\uDD13</div>" +
        "<div style='font-size:17px;font-weight:700;color:#fff;margin-bottom:8px;'>Leave The Shop?</div>" +
        "<div style='font-size:14px;color:#888;margin-bottom:24px;line-height:1.5;'>You'll need to re-enter<br>the Scarlet Key to get back in.</div>" +
        "<div style='display:flex;gap:10px;'>" +
        "<button id='__logout_cancel'  style='flex:1;padding:11px 0;border-radius:10px;background:#2a2a3e;color:#ccc;border:1px solid #444;font-size:15px;cursor:pointer;font-weight:600;'>Stay</button>" +
        "<button id='__logout_confirm' style='flex:1;padding:11px 0;border-radius:10px;background:#bb0000;color:#fff;border:none;font-size:15px;cursor:pointer;font-weight:700;'>Log Out</button>" +
        "</div></div>";
      document.body.appendChild(logoutDialogEl);
      document.getElementById("__logout_cancel").addEventListener("click", closeLogoutDialog);
      document.getElementById("__logout_confirm").addEventListener("click", function() {
        closeLogoutDialog();
        if (typeof window.doLogout === "function") { window.doLogout(); }
        else if (typeof window.logout === "function") { window.logout(); }
        else {
          try {
            var login = document.getElementById("login");
            var entry = document.getElementById("entry");
            var app   = document.getElementById("app");
            if (app)   app.style.display   = "none";
            if (entry) entry.style.display = "none";
            if (login) login.style.display = "block";
            var code = document.getElementById("code");
            if (code) code.value = "";
          } catch(e) { window.location.reload(); }
        }
        // Hide full FAB, show pre-login debug button again
        lockFAB();
      });
      logoutDialogEl.addEventListener("click", function(e){ if (e.target === logoutDialogEl) closeLogoutDialog(); });
    }
    function closeLogoutDialog() { if (logoutDialogEl) logoutDialogEl.style.display = "none"; }
    function openLogoutDialog() {
      if (!logoutDialogEl) buildLogoutDialog(); else logoutDialogEl.style.display = "flex";
    }

    // =========================================================
    // COIN FLIP OVERLAY
    // =========================================================
    var coinFlipOverlayEl = null;
    var coinFlipHistory   = [];   // session history, max 5
    var coinFlipping      = false;

    // ---- Firebase helpers ----
    // Use the existing signed-in user from the Scarlet Key login.
    // Never attempt anonymous sign-in — Firestore rules block anonymous users.

    function cfGetDB() {
      try {
        if (window.firebase && firebase.apps && firebase.apps.length) {
          return firebase.firestore();
        }
      } catch(e) {}
      return null;
    }

    // Wait up to 3s for an already-authenticated user.
    // If no user is signed in after the wait, bail out gracefully — never sign in anonymously.
    function cfEnsureFirebase() {
      return new Promise(function(resolve, reject) {
        try {
          if (!window.firebase) { reject(new Error("Firebase not loaded")); return; }

          // If Firebase isn't initialized yet, wait for it
          if (!firebase.apps || !firebase.apps.length) {
            if (window.FIREBASE_CONFIG) {
              firebase.initializeApp(window.FIREBASE_CONFIG);
            } else {
              reject(new Error("No Firebase config")); return;
            }
          }

          var auth = firebase.auth();

          // If there's already a signed-in user, we're done immediately
          if (auth.currentUser) { resolve(); return; }

          // Otherwise wait for auth state to settle (user is logging in)
          var done = false;
          var timer = setTimeout(function() {
            if (done) return;
            done = true;
            try { unsub(); } catch(e) {}
            var u = auth.currentUser;
            if (u) { resolve(); }
            else { reject(new Error("No authenticated user — coin flip requires Scarlet Key login")); }
          }, 3000);

          var unsub = auth.onAuthStateChanged(function(user) {
            if (done) return;
            if (user) {
              done = true;
              clearTimeout(timer);
              try { unsub(); } catch(e) {}
              resolve();
            }
            // If user is null, keep waiting for the timer — don't sign in anonymously
          });
        } catch(e) {
          reject(e);
        }
      });
    }

    function cfIncrement(field) {
      cfEnsureFirebase().then(function() {
        try {
          var db = cfGetDB();
          if (!db) return;
          var ref = db.collection("coinFlip").doc("record");
          db.runTransaction(function(tx) {
            return tx.get(ref).then(function(snap) {
              var data = snap.exists ? (snap.data() || {}) : { heads: 0, tails: 0 };
              var update = { heads: data.heads || 0, tails: data.tails || 0 };
              update[field] = (update[field] || 0) + 1;
              tx.set(ref, update);
            });
          }).then(function() {
            cfFetchRecord();
          }).catch(function(e) { console.warn("CF increment err:", e); });
        } catch(e) { console.warn("CF Firebase err:", e); }
      }).catch(function(e) { console.warn("CF skipping Firebase (not authed):", e.message); });
    }

    function cfFetchRecord() {
      var el = document.getElementById("__cf_record");
      if (el) el.innerHTML = "<span style='color:#555;font-size:13px;'>Loading record\u2026</span>";

      cfEnsureFirebase().then(function() {
        try {
          var db = cfGetDB();
          if (!db) { renderCFRecord(null); return; }
          db.collection("coinFlip").doc("record").get().then(function(snap) {
            renderCFRecord(snap.exists ? snap.data() : { heads: 0, tails: 0 });
          }).catch(function(e) {
            console.warn("CF fetch err:", e);
            renderCFRecord(null);
          });
        } catch(e) {
          console.warn("CF Firebase err:", e);
          renderCFRecord(null);
        }
      }).catch(function(e) {
        console.warn("CF skipping record fetch (not authed):", e.message);
        renderCFRecord(null);
      });
    }

    function renderCFRecord(data) {
      var el = document.getElementById("__cf_record");
      if (!el) return;
      if (!data) { el.innerHTML = ""; return; }
      var h = data.heads || 0;
      var t = data.tails || 0;
      var hLeading = h > t;
      var tLeading = t > h;
      // Heads always scarlet, tails always gray — bold the leader
      var hStyle = "color:#bb0000;font-weight:" + (hLeading ? "900" : "700") + ";font-size:" + (hLeading ? "16" : "15") + "px;";
      var tStyle = "color:#aaaaaa;font-weight:" + (tLeading ? "900" : "700") + ";font-size:" + (tLeading ? "16" : "15") + "px;";
      var dashStyle = "color:#444;font-size:13px;margin:0 6px;";
      el.innerHTML =
        "<span style='" + hStyle + "'>Heads " + h + "</span>" +
        "<span style='" + dashStyle + "'>\u2013</span>" +
        "<span style='" + tStyle + "'>" + t + " Tails</span>";
    }

    function buildCoinFlipOverlay() {
      // Inject coin flip keyframe styles once
      var cfStyle = document.createElement("style");
      cfStyle.textContent = [
        "@keyframes __cf_flip {",
          "0%   { transform: rotateY(0deg)   translateY(0px);   }",
          "30%  { transform: rotateY(360deg) translateY(-60px); }",
          "60%  { transform: rotateY(720deg) translateY(-20px); }",
          "80%  { transform: rotateY(900deg) translateY(-5px);  }",
          "100% { transform: rotateY(1080deg) translateY(0px);  }",
        "}",
        "#__cf_coin { transition: none; }",
        "#__cf_coin.flipping { animation: __cf_flip 1.1s cubic-bezier(0.33,1,0.68,1) forwards; }",
        "#__cf_flip_btn:active { transform:scale(0.95); }",
        "#__cf_flip_btn { transition:transform 0.12s ease, background 0.15s ease; }"
      ].join("\n");
      document.head.appendChild(cfStyle);

      coinFlipOverlayEl = document.createElement("div");
      coinFlipOverlayEl.id = "__coinflip_overlay";
      coinFlipOverlayEl.style.cssText = "position:fixed;inset:0;z-index:99997;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.60);backdrop-filter:blur(4px);";
      coinFlipOverlayEl.innerHTML =
        "<div id='__cf_card' style='background:#1a1a2e;border:1px solid #333;border-radius:16px;width:min(92vw,340px);padding:28px 24px 24px;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.75);font-family:-apple-system,system-ui,sans-serif;color:#e0e0e0;text-align:center;'>" +
          "<button id='__cf_close' style='position:absolute;top:12px;right:14px;background:none;border:none;color:#aaa;font-size:20px;cursor:pointer;line-height:1;'>\u2715</button>" +
          "<div style='font-size:13px;color:#bb0000;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:18px;'>\uD83E\uDE99 Coin Flip</div>" +

          // Coin — shows real images, falls back gracefully
          "<div style='perspective:600px;margin-bottom:16px;'>" +
            "<div id='__cf_coin' style='width:110px;height:110px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#bb0000,#8a0000);border:3px solid #ff4444;box-shadow:0 4px 20px rgba(187,0,0,0.5);overflow:hidden;'>" +
              "<img id='__cf_coin_img' src='buckeye-O.png' alt='Heads' style='width:80px;height:80px;object-fit:contain;pointer-events:none;' />" +
            "</div>" +
          "</div>" +

          // All-time record scoreboard
          "<div id='__cf_record' style='font-size:14px;letter-spacing:0.3px;margin-bottom:14px;min-height:20px;'>" +
            "<span style='color:#555;font-size:13px;'>Loading record\u2026</span>" +
          "</div>" +

          // Result label
          "<div id='__cf_result' style='font-size:28px;font-weight:900;min-height:36px;margin-bottom:6px;letter-spacing:1px;'>&nbsp;</div>" +
          "<div id='__cf_sub' style='font-size:13px;color:#666;margin-bottom:22px;min-height:18px;'>&nbsp;</div>" +

          // Flip button
          "<button id='__cf_flip_btn' style='width:100%;padding:14px 0;border-radius:12px;background:#bb0000;color:#fff;border:none;font-size:16px;font-weight:700;cursor:pointer;letter-spacing:0.5px;'>FLIP</button>" +

          // Session history
          "<div id='__cf_history' style='margin-top:18px;min-height:24px;'></div>" +
        "</div>";

      document.body.appendChild(coinFlipOverlayEl);
      document.getElementById("__cf_close").addEventListener("click", closeCoinFlip);
      coinFlipOverlayEl.addEventListener("click", function(e){ if (e.target === coinFlipOverlayEl) closeCoinFlip(); });
      document.getElementById("__cf_flip_btn").addEventListener("click", doFlip);
    }

    function doFlip() {
      if (coinFlipping) return;
      coinFlipping = true;

      var btn      = document.getElementById("__cf_flip_btn");
      var coinEl   = document.getElementById("__cf_coin");
      var coinImg  = document.getElementById("__cf_coin_img");
      var resultEl = document.getElementById("__cf_result");
      var subEl    = document.getElementById("__cf_sub");

      if (btn)      { btn.disabled = true; btn.style.opacity = "0.5"; }
      if (resultEl) resultEl.innerHTML = "&nbsp;";
      if (subEl)    subEl.innerHTML    = "&nbsp;";

      // Spinning state — hide image, show neutral spinner look
      if (coinImg)  coinImg.style.opacity = "0";
      if (coinEl) {
        coinEl.style.background = "linear-gradient(135deg,#333,#111)";
        coinEl.style.borderColor = "#555";
        coinEl.style.boxShadow = "0 4px 20px rgba(80,80,80,0.4)";
        coinEl.classList.remove("flipping");
        void coinEl.offsetWidth;
        coinEl.classList.add("flipping");
      }

      // Haptic nudge
      try { if (navigator.vibrate) navigator.vibrate([30, 40, 30]); } catch(e) {}

      setTimeout(function() {
        var isHeads = Math.random() < 0.5;
        var label   = isHeads ? "HEADS" : "TAILS";
        var imgSrc  = isHeads ? "buckeye-O.png" : "buckeye-leaf.png";
        var bgColor = isHeads
          ? "linear-gradient(135deg,#bb0000,#8a0000)"
          : "linear-gradient(135deg,#3a3a2a,#222210)";
        var borderColor = isHeads ? "#ff4444" : "#a8a060";
        var shadowColor = isHeads
          ? "0 4px 20px rgba(187,0,0,0.5)"
          : "0 4px 20px rgba(140,130,60,0.4)";

        if (coinImg) {
          coinImg.src = imgSrc;
          coinImg.alt = label;
          coinImg.style.opacity = "1";
        }
        if (coinEl) {
          coinEl.style.background   = bgColor;
          coinEl.style.borderColor  = borderColor;
          coinEl.style.boxShadow    = shadowColor;
        }

        // HEADS = scarlet, TAILS = gray
        if (resultEl) {
          resultEl.style.color = isHeads ? "#bb0000" : "#aaaaaa";
          resultEl.textContent = label;
        }

        // Increment Firebase record
        cfIncrement(isHeads ? "heads" : "tails");

        // Session history (max 5)
        coinFlipHistory.unshift(label);
        if (coinFlipHistory.length > 5) coinFlipHistory.pop();
        renderCoinHistory();

        // Fun quip
        var quips = isHeads
          ? ["Buckeyes win the flip! \uD83C\uDFC6", "Scarlet side up!", "O-H!", "That's a Buckeye!", "Easy money \uD83D\uDCB0"]
          : ["Leaf side up.", "Tails never fails?", "I-O!", "Flip again?", "Oof. Try again."];
        if (subEl) subEl.textContent = quips[Math.floor(Math.random() * quips.length)];

        if (btn) { btn.disabled = false; btn.style.opacity = "1"; btn.textContent = "FLIP AGAIN"; }
        coinFlipping = false;

        try { if (navigator.vibrate) navigator.vibrate(50); } catch(e) {}
      }, 1150);
    }

    function renderCoinHistory() {
      var el = document.getElementById("__cf_history");
      if (!el || coinFlipHistory.length === 0) return;
      var dots = coinFlipHistory.map(function(r) {
        var isH = r === "HEADS";
        return "<span title='" + r + "' style='display:inline-flex;align-items:center;justify-content:center;" +
          "width:30px;height:30px;border-radius:50%;overflow:hidden;" +
          "background:" + (isH ? "#8a0000" : "#2a2a18") + ";" +
          "border:2px solid " + (isH ? "#ff4444" : "#a8a060") + ";" +
          "margin:0 3px;'>" +
          "<img src='" + (isH ? "buckeye-O.png" : "buckeye-leaf.png") + "' " +
          "style='width:20px;height:20px;object-fit:contain;' alt='" + r + "' />" +
          "</span>";
      }).join("");
      el.innerHTML = "<div style='font-size:10px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;'>Last " + coinFlipHistory.length + " flips</div>" + dots;
    }

    function closeCoinFlip() {
      if (coinFlipOverlayEl) coinFlipOverlayEl.style.display = "none";
    }
    function openCoinFlip() {
      if (!coinFlipOverlayEl) buildCoinFlipOverlay();
      else coinFlipOverlayEl.style.display = "flex";
      // Reset to ready state each open
      var resultEl = document.getElementById("__cf_result");
      var subEl    = document.getElementById("__cf_sub");
      var btn      = document.getElementById("__cf_flip_btn");
      var coinImg  = document.getElementById("__cf_coin_img");
      var coinEl   = document.getElementById("__cf_coin");
      if (resultEl) { resultEl.innerHTML = "&nbsp;"; resultEl.style.color = "#fff"; }
      if (subEl)    subEl.innerHTML    = "&nbsp;";
      if (btn)      { btn.disabled = false; btn.style.opacity = "1"; btn.textContent = "FLIP"; }
      if (coinImg)  { coinImg.src = "buckeye-O.png"; coinImg.alt = "Heads"; coinImg.style.opacity = "1"; }
      if (coinEl) {
        coinEl.classList.remove("flipping");
        coinEl.style.background   = "linear-gradient(135deg,#bb0000,#8a0000)";
        coinEl.style.borderColor  = "#ff4444";
        coinEl.style.boxShadow    = "0 4px 20px rgba(187,0,0,0.5)";
      }
      renderCoinHistory();
      cfFetchRecord();
    }

    // =========================================================
    // DOMINOS PIZZA SHORTCUT
    // =========================================================
    function openDominos() {
      // Try the Domino's app deep link first; fall back to the website
      var appLink  = "dominos://";
      var webLink  = "https://www.dominos.com";
      var start    = Date.now();
      var fallback = setTimeout(function() {
        if (Date.now() - start < 2000) {
          window.open(webLink, "_blank");
        }
      }, 1200);
      // Attempt to launch the app via an invisible iframe
      var iframe = document.createElement("iframe");
      iframe.style.cssText = "position:absolute;width:0;height:0;border:0;visibility:hidden;";
      iframe.src = appLink;
      document.body.appendChild(iframe);
      setTimeout(function() {
        try { document.body.removeChild(iframe); } catch(e) {}
      }, 2000);
      // If the page loses focus the app opened — cancel the web fallback
      window.addEventListener("blur", function onBlur() {
        clearTimeout(fallback);
        window.removeEventListener("blur", onBlur);
      }, { once: true });
    }

    // =========================================================
    // RADIAL FAB
    //
    // PRE-LOGIN:  Only a small standalone 🐛 debug button is
    //             shown (bottom-right corner). The full Buckeye
    //             FAB stays hidden so the login screen is clean.
    //
    // POST-LOGIN: Call window.__fabUnlock() (triggered from
    //             shared.js checkCode success path) to hide the
    //             pre-login debug button and reveal the full
    //             Buckeye radial FAB with all ring buttons.
    //
    // LOGOUT:     Call window.__fabLock() to revert to the
    //             pre-login state.
    //
    // Arc angles (70°–240°) — evenly spaced at ~42.5° apart,
    // RADIUS bumped to 115px so 44px buttons never overlap:
    //   70°  = upper-right  (Coin Flip)
    //   112° = upper        (Weather)
    //   155° = left         (Domino's 🍕)
    //   197° = lower-left   (Log Out)
    //   240° = lower        (Debug)
    // =========================================================

    // ---- Pre-login standalone debug button ----
    function buildPreLoginDebugBtn() {
      preLoginDebugBtn = document.createElement("button");
      preLoginDebugBtn.id = "__pre_debug_btn";
      preLoginDebugBtn.setAttribute("aria-label", "Open debug console");
      preLoginDebugBtn.style.cssText = [
        "position:fixed",
        "bottom:30px","right:30px",
        "width:44px","height:44px",
        "background:#1a1a2e","color:#fff",
        "border:2px solid #555","border-radius:50%",
        "font-size:20px","cursor:pointer",
        "display:flex","align-items:center","justify-content:center",
        "box-shadow:0 2px 14px rgba(0,0,0,0.65)",
        "z-index:99998",
        "padding:0"
      ].join(";");
      preLoginDebugBtn.textContent = "\uD83D\uDC1E";

      // Error badge
      var preBadge = document.createElement("span");
      preBadge.id = "__pre_debug_badge";
      preBadge.style.cssText = [
        "position:absolute","top:-5px","right:-5px",
        "background:#ef4444","color:#fff",
        "border-radius:50%","width:18px","height:18px",
        "font-size:10px","font-family:sans-serif",
        "display:none","align-items:center","justify-content:center",
        "font-weight:bold","pointer-events:none"
      ].join(";");
      preLoginDebugBtn.appendChild(preBadge);

      preLoginDebugBtn.addEventListener("click", function(e) {
        e.stopPropagation();
        openDebug();
      });

      document.body.appendChild(preLoginDebugBtn);
    }

    function buildFAB() {
      var style = document.createElement("style");
      style.textContent = [
        "@keyframes __fab_pop_in {",
          "from { opacity:0; transform:scale(0.3); }",
          "to   { opacity:1; transform:scale(1); }",
        "}",
        "#__fab_wrap {",
          "transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);",
        "}",
        "#__fab_main:hover  { transform:scale(1.08); }",
        "#__fab_main:active { transform:scale(0.95); }",
        "#__fab_main { transition:transform 0.15s ease; }",
        ".__fab_ring_btn:hover  { filter:brightness(1.3); }",
        ".__fab_ring_btn:active { transform:scale(0.92) !important; }",
        "#__logout_cancel:hover  { background:#333 !important; }",
        "#__logout_confirm:hover { background:#990000 !important; }"
      ].join("\n");
      document.head.appendChild(style);

      fabWrap = document.createElement("div");
      fabWrap.id = "__fab_wrap";
      fabWrap.style.cssText = [
        "position:fixed",
        "bottom:110px",
        "right:30px",
        "width:0","height:0",
        "z-index:99998",
        "pointer-events:none",
        "display:none"   // hidden until login
      ].join(";");
      document.body.appendChild(fabWrap);

      fabMain = document.createElement("button");
      fabMain.id = "__fab_main";
      fabMain.setAttribute("aria-label", "Open shop menu");
      fabMain.style.cssText = [
        "position:absolute",
        "bottom:-22px","right:-22px",
        "width:44px","height:44px",
        "background:#bb0000","color:#fff",
        "border:2px solid rgba(255,255,255,0.18)","border-radius:50%",
        "font-size:20px","cursor:pointer",
        "display:flex","align-items:center","justify-content:center",
        "box-shadow:0 2px 14px rgba(0,0,0,0.65)",
        "padding:0","overflow:hidden",
        "pointer-events:auto"
      ].join(";");

      var img = document.createElement("img");
      img.src = "buckeye-leaf.png";
      img.alt = "Menu";
      img.style.cssText = "width:28px;height:28px;object-fit:contain;pointer-events:none;";
      img.onerror = function() {
        fabMain.innerHTML = "";
        fabMain.textContent = "O";
        fabMain.style.fontWeight = "900";
        fabMain.style.fontFamily = "serif";
      };
      fabMain.appendChild(img);

      badgeEl = document.createElement("span");
      badgeEl.style.cssText = [
        "position:absolute","top:-5px","right:-5px",
        "background:#ef4444","color:#fff",
        "border-radius:50%","width:18px","height:18px",
        "font-size:10px","font-family:sans-serif",
        "display:none","align-items:center","justify-content:center",
        "font-weight:bold","pointer-events:none"
      ].join(";");
      fabMain.appendChild(badgeEl);
      fabWrap.appendChild(fabMain);

      // Arc angles evenly distributed 70°–240° (42.5° apart), RADIUS=115px
      // ensures no two 44px buttons overlap (min arc gap ~85px at r=115).
      var ringItems = [
        { id: "__fab_coinflip", icon: "\uD83E\uDE99", label: "Coin Flip",  angle: 70,  action: openCoinFlip },
        { id: "__fab_weather",  icon: "\u26C5",       label: "Weather",    angle: 112, action: openWeather },
        { id: "__fab_dominos",  icon: "\uD83C\uDF55", label: "Domino's",   angle: 155, action: openDominos },
        { id: "__fab_logout",   icon: "\uD83D\uDD13", label: "Log Out",    angle: 197, action: openLogoutDialog },
        { id: "__fab_debug",    icon: "\uD83D\uDC1E", label: "Debug",      angle: 240, action: openDebug }
      ];

      var RADIUS = 115;

      ringItems.forEach(function(item) {
        var btn = document.createElement("button");
        btn.id = item.id;
        btn.className = "__fab_ring_btn";
        btn.setAttribute("aria-label", item.label);

        var rad = item.angle * Math.PI / 180;
        var dx = Math.round(Math.cos(rad) * RADIUS);
        var dy = Math.round(Math.sin(rad) * RADIUS);

        var rightPx  = -22 - dx;
        var bottomPx = -22 + dy;

        btn.style.cssText = [
          "position:absolute",
          "right:"  + rightPx  + "px",
          "bottom:" + bottomPx + "px",
          "width:44px","height:44px",
          "background:#1a1a2e","color:#fff",
          "border:2px solid #555","border-radius:50%",
          "font-size:20px","cursor:pointer",
          "display:none",
          "align-items:center","justify-content:center",
          "box-shadow:0 2px 12px rgba(0,0,0,0.6)",
          "transition:filter 0.12s ease, transform 0.12s ease",
          "pointer-events:auto"
        ].join(";");
        btn.textContent = item.icon;

        btn.addEventListener("click", function(e) {
          e.stopPropagation();
          closeRing();
          item.action();
        });

        fabWrap.appendChild(btn);
        ringEls.push(btn);
      });

      fabMain.addEventListener("click", function(e) {
        e.stopPropagation();
        if (ringOpen) closeRing(); else openRing();
      });

      document.addEventListener("click", function() {
        if (ringOpen) closeRing();
      });

      // Build the pre-login debug button (shown immediately)
      buildPreLoginDebugBtn();
    }

    // ---- Called after Scarlet Key is accepted ----
    function unlockFAB() {
      // Hide the pre-login debug button
      if (preLoginDebugBtn) preLoginDebugBtn.style.display = "none";
      // Show the full Buckeye FAB
      if (fabWrap) fabWrap.style.display = "block";
    }
    window.__fabUnlock = unlockFAB;

    // ---- Called after logout — revert to pre-login state ----
    function lockFAB() {
      // Close ring if open
      if (ringOpen) closeRing();
      // Hide the full FAB
      if (fabWrap) fabWrap.style.display = "none";
      // Show the pre-login debug button again
      if (preLoginDebugBtn) preLoginDebugBtn.style.display = "flex";
    }
    window.__fabLock = lockFAB;

    function openRing() {
      ringOpen = true;
      fabWrap.style.transform = "translate(-10px, -10px)";
      ringEls.forEach(function(btn, i) {
        btn.style.display = "flex";
        btn.style.opacity = "0";
        btn.style.animation = "none";
        void btn.offsetWidth;
        btn.style.animationDelay = (i * 55) + "ms";
        btn.style.animation = "__fab_pop_in 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards";
      });
    }

    function closeRing() {
      ringOpen = false;
      fabWrap.style.transform = "translate(0, 0)";
      ringEls.forEach(function(btn) {
        btn.style.display = "none";
        btn.style.opacity = "0";
        btn.style.animation = "none";
      });
    }

    function openDebug() {
      panelOpen = true;
      if (!panelEl) buildPanel();
      panelEl.style.display = "flex";
      renderLogs();
      setTimeout(function() { if (listEl) listEl.scrollTop = 0; }, 50);
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", buildFAB);
    } else {
      buildFAB();
    }

    window.__debugLogs = __logs;
  })();
  // =========================================================
  // END DEBUG CONSOLE + FAB
  // =========================================================

  // Firebase config
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

  window.__SCARLETKEY_BUILD = "split-boot-OK";
  try { console.log("Boot OK:", window.__SCARLETKEY_BUILD); } catch {}
})();

// =========================
// COUNTDOWN TO THE GAME
// =========================
(function () {
  function getGameDate() { return new Date("November 29, 2025 12:00:00"); }

  function updateCountdown() {
    var target = getGameDate(), now = new Date(), diff = target - now;
    if (diff <= 0) return;
    var days  = Math.floor(diff / (1000*60*60*24));
    var hours = Math.floor((diff / (1000*60*60)) % 24);
    var mins  = Math.floor((diff / (1000*60)) % 60);
    var secs  = Math.floor((diff / 1000) % 60);
    var set = function(id, val) {
      var el = document.getElementById(id);
      if (el) el.textContent = String(val).padStart(2, "0");
    };
    set("cdDays", days); set("cdHours", hours); set("cdMins", mins); set("cdSecs", secs);
  }

  window.startCountdown = function () {
    updateCountdown();
    setInterval(updateCountdown, 1000);
  };
})();
