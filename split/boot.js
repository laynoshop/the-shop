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
    var fabWrap   = null;  // the container that slides
    var fabMain   = null;

    function refreshPanel() {
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
      });
      logoutDialogEl.addEventListener("click", function(e){ if (e.target === logoutDialogEl) closeLogoutDialog(); });
    }
    function closeLogoutDialog() { if (logoutDialogEl) logoutDialogEl.style.display = "none"; }
    function openLogoutDialog() {
      if (!logoutDialogEl) buildLogoutDialog(); else logoutDialogEl.style.display = "flex";
    }

    // =========================================================
    // RADIAL FAB  — container-based so it never clips edges
    //
    // Layout strategy:
    //  • fabWrap sits at bottom-right as a zero-size anchor.
    //    The main FAB is centered on that anchor point.
    //  • Ring buttons are absolute children offset by RADIUS
    //    in polar coords relative to the FAB center.
    //  • Resting bottom is high enough that the FAB fully
    //    clears the bottom tab bar + browser chrome.
    //  • On open, fabWrap translates only a small nudge —
    //    the buttons fan out purely via their polar offsets,
    //    so no overlap regardless of count.
    //
    // Arc design (angles from positive-X axis, CCW):
    //   100° = mostly up, slight left   (Weather)
    //   158° = upper-left diagonal      (Log Out)
    //   216° = lower-left diagonal      (Debug)
    //
    //  RADIUS = 90px gives plenty of breathing room between
    //  the 44px buttons (centres are 90px apart, edges ~46px).
    //
    //  right:30px on the wrapper keeps the FAB fully inset
    //  from the screen edge on all iPhone sizes.
    // =========================================================
    function buildFAB() {
      // --- Styles ---
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

      // --- Wrapper (fixed anchor, zero visual size) ---
      // bottom:110px clears the ~80px tab bar + browser URL bar.
      // right:30px keeps the 44px FAB fully visible on all iPhones
      // (22px half-button + 8px inset from edge = comfortable clearance).
      fabWrap = document.createElement("div");
      fabWrap.id = "__fab_wrap";
      fabWrap.style.cssText = [
        "position:fixed",
        "bottom:110px",
        "right:30px",   // 30px anchor → FAB edge sits ~8px from screen edge
        "width:0","height:0",
        "z-index:99998",
        "pointer-events:none"
      ].join(";");
      document.body.appendChild(fabWrap);

      // --- Main FAB button ---
      fabMain = document.createElement("button");
      fabMain.id = "__fab_main";
      fabMain.setAttribute("aria-label", "Open shop menu");
      fabMain.style.cssText = [
        "position:absolute",
        "bottom:-22px","right:-22px",   // center 44px button on wrap origin
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

      // --- Ring button definitions ---
      // Angles from positive-X axis, counter-clockwise.
      // Arc spans 100°–216° so all buttons stay above and to the
      // left of the FAB — away from the right edge and nav bar.
      var ringItems = [
        { id: "__fab_weather", icon: "\u26C5",       label: "Weather", angle: 100, action: openWeather },
        { id: "__fab_logout",  icon: "\uD83D\uDD13", label: "Log Out", angle: 158, action: openLogoutDialog },
        { id: "__fab_debug",   icon: "\uD83D\uDC1E", label: "Debug",   angle: 216, action: openDebug }
      ];

      var RADIUS = 90; // px — enough spacing between 44px buttons

      ringItems.forEach(function(item, i) {
        var btn = document.createElement("button");
        btn.id = item.id;
        btn.className = "__fab_ring_btn";
        btn.setAttribute("aria-label", item.label);

        var rad = item.angle * Math.PI / 180;
        var dx = Math.round(Math.cos(rad) * RADIUS); // +right / -left
        var dy = Math.round(Math.sin(rad) * RADIUS); // +up   / -down

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

      // --- Toggle logic ---
      fabMain.addEventListener("click", function(e) {
        e.stopPropagation();
        if (ringOpen) closeRing(); else openRing();
      });

      document.addEventListener("click", function() {
        if (ringOpen) closeRing();
      });
    }

    function openRing() {
      ringOpen = true;
      // Tiny nudge — the arc geometry does the real work
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
