// split/shared.js
// Shared cross-tab utilities + login/entry/navigation glue.
// This file must be 100% syntax-clean or the whole split build stops loading.

(function () {
  "use strict";

// ------------------------------------------------------------
// iOS/PWA safety: CSS.escape polyfill (some WebViews lack it)
// ------------------------------------------------------------
(function ensureCssEscape(){
  if (!window.CSS) window.CSS = {};
  if (typeof window.CSS.escape === "function") return;
  window.CSS.escape = function (value) {
    const str = String(value);
    return str.replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function(ch) {
      const hex = ch.codePointAt(0).toString(16).toUpperCase();
      return "\\" + hex + " ";
    });
  };
})();

// ---- Hard reset for login/app init guards (allows re-login after logout) ----
window.hardResetAppInitState = function hardResetAppInitState() {
  try { window.__APP_LOADING = false; } catch {}
  try { window.__APP_INIT = false; } catch {}
  try { window.__APP_READY = false; } catch {}
  try { window.__APP_INIT_PROMISE = null; } catch {}
  try { window.__BOOT_PROMISE = null; } catch {}
  try { window.__INIT_PROMISE = null; } catch {}
  try { window.__SPLIT_BOOTED = false; } catch {}
  try { window.__ROUTER_READY = false; } catch {}
};

  // ------------------------------------------------------------
  // Tiny safe storage helpers (private browsing can throw)
  // ------------------------------------------------------------
  function mem() {
    window.__SK_MEM = window.__SK_MEM || {};
    return window.__SK_MEM;
  }

  function safeGet(key) {
    try { return String(localStorage.getItem(key) || ""); }
    catch (e) { return String(mem()[key] || ""); }
  }

  function safeSet(key, val) {
    try { localStorage.setItem(key, String(val)); }
    catch (e) { mem()[key] = String(val); }
  }

  // ------------------------------------------------------------
  // Globals / state
  // ------------------------------------------------------------
  const ROLE_KEY = "theShopRole_v1"; // "admin" | "guest"
  window.__serverRoleCache = window.__serverRoleCache || "";
  window.__activeTab = window.__activeTab || "scores";
  let currentTab = window.__activeTab || "scores";

  // ------------------------------------------------------------
  // TTUN text replacer (global)
  // ------------------------------------------------------------
  function replaceMichiganText(root = document.body) {
  try {
    const rxFull = /Michigan\s+Wolverines/gi;
    const rxWolv = /\bWolverines\b/gi;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.nodeValue;
      if (!t) continue;

      let next = t.replace(rxFull, "TTUN");

      if (/Michigan/i.test(t)) {
        next = next.replace(rxWolv, "TTUN");
      }

      if (next !== t) node.nodeValue = next;
    }
  } catch {}
}
window.replaceMichiganText = replaceMichiganText;

  // ------------------------------------------------------------
  // Rivalry banner (bottom fixed) + login screen day counter
  // ------------------------------------------------------------
  const LAST_TTUN_WIN_DATE = new Date(2024, 10, 30, 12, 0, 0); // Nov 30 2024 @ noon local

  function daysSince(d) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = today.getTime() - start.getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }

  function updateRivalryBanner() {
    const days = daysSince(LAST_TTUN_WIN_DATE);

    const banner = document.getElementById("rivalryBanner");
    if (banner) {
      banner.textContent = `${days} days since TTUN has won in The Game`;
      banner.style.display = "block";
    }

    const loginCounter = document.getElementById("daysSinceNumber");
    if (loginCounter) loginCounter.textContent = days;
  }
  window.updateRivalryBanner = updateRivalryBanner;

  // ------------------------------------------------------------
  // UI helpers
  // ------------------------------------------------------------
  function setActiveTabButton(tab) {
    document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
    const btn = document.querySelector(`.tabs button[data-tab="${CSS.escape(String(tab))}"]`);
    if (btn) btn.classList.add("active");
  }

  function showEntryScreen() {
    const login = document.getElementById("login");
    const entry = document.getElementById("entry");
    const app = document.getElementById("app");

    document.body.classList.add("entryMode");

    if (login) login.style.display = "none";
    if (app) app.style.display = "none";
    if (entry) entry.style.display = "flex";

    const role = getRole();

    const shopDoor = document.querySelector('.doorBtn[data-go="shop"]');
    if (shopDoor) shopDoor.style.display = (role === "admin") ? "" : "none";

    const piBtn = document.getElementById("piScoreboardBtn");
    if (piBtn) piBtn.style.display = (role === "admin") ? "" : "none";

    updateRivalryBanner();

    if (!showEntryScreen._bound) {
      document.querySelectorAll(".doorBtn").forEach(btn => {
        btn.addEventListener("click", () => {
          const tab = btn.getAttribute("data-go");
          if (tab) enterAppToTab(tab);
        });
      });

      const piScoreboardBtn = document.getElementById("piScoreboardBtn");
      if (piScoreboardBtn) {
        piScoreboardBtn.addEventListener("click", () => {
          if (typeof window.launchPiScoreboard === "function") {
            window.launchPiScoreboard();
          }
        });
      }

      showEntryScreen._bound = true;
    }
  }
  window.showEntryScreen = showEntryScreen;

  function enterAppToTab(tabName) {
    const entry = document.getElementById("entry");
    const app = document.getElementById("app");

    document.body.classList.remove("entryMode");

    if (entry) entry.style.display = "none";
    if (app) app.style.display = "block";

    showTab(tabName || "scores");
  }
  window.enterAppToTab = enterAppToTab;

  function buildTabsForRole(role) {
    const tabs = document.querySelector(".tabs");
    if (!tabs) return;

    const baseTabs = [
      { key: "scores", label: "Scores" },
      { key: "picks",  label: "Picks" },
      { key: "beat",   label: "Beat<br/>TTUN" },
      { key: "news",   label: "Top<br/>News" },
      { key: "golf",   label: "⛳<br/>Putt" },
      { key: "fun",    label: "🎉<br/>Fun" }
    ];

    if (role === "admin") baseTabs.push({ key: "shop", label: "Shop" });

    tabs.innerHTML = baseTabs
      .map(t => `<button type="button" data-tab="${t.key}">${t.label}</button>`)
      .join("");

    const current = window.__activeTab || "scores";
    const exists = baseTabs.some(t => t.key === current);
    showTab(exists ? current : "scores");
  }
  window.buildTabsForRole = buildTabsForRole;

  // ------------------------------------------------------------
  // Role helpers
  // ------------------------------------------------------------
  function safeRoleGet() { return safeGet(ROLE_KEY).trim(); }
  function safeRoleSet(val) { safeSet(ROLE_KEY, String(val || "").trim()); }

  function getRole() {
    if (window.__serverRoleCache === "admin" || window.__serverRoleCache === "guest") return window.__serverRoleCache;
    const r = safeRoleGet();
    if (r === "admin" || r === "guest") return r;
    return "guest";
  }
  window.getRole = getRole;
  window.safeRoleSet = safeRoleSet;

  async function refreshServerRoleCache(db) {
    try {
      if (typeof window.ensureFirebaseChatReady !== "function") return "";
      await window.ensureFirebaseChatReady();
      const uid = firebase.auth().currentUser?.uid || "";
      if (!uid) return "";

      const snap = await db.collection("users").doc(uid).get();
      const r = snap.exists ? String((snap.data() || {}).role || "").trim() : "";
      if (r === "admin" || r === "guest") {
        window.__serverRoleCache = r;
        safeRoleSet(r);
        return r;
      }
    } catch (e) {}
    return "";
  }
  window.refreshServerRoleCache = refreshServerRoleCache;

  // ------------------------------------------------------------
  // Navigation / tab router
  // ------------------------------------------------------------
  function showTab(tab) {
    const role = getRole();

    // Block Shop for guests
    if (tab === "shop" && role !== "admin") tab = "scores";

    currentTab = tab;
    window.__activeTab = tab;

    const content = document.getElementById("content");
    if (content) content.innerHTML = "";

    try { setActiveTabButton(tab); } catch (e) {}

    const safe = (fnName, ...args) => {
      try {
        const fn = window[fnName];
        if (typeof fn === "function") return fn(...args);
        console.warn("Missing function:", fnName);
      } catch (err) {
        console.error("Tab render error:", tab, err);
        if (content) content.innerHTML = `<div class="notice">Error loading <b>${tab}</b>.</div>`;
      }
    };

    if (tab === "scores")    safe("loadScores", true);
    else if (tab === "picks") safe("renderPicks", true);
    else if (tab === "beat")  safe("renderBeatTTUN");
    else if (tab === "news")  safe("renderTopNews", true);
    else if (tab === "shop")  safe("renderShop");
    else if (tab === "golf")  safe("renderGolf");
    else if (tab === "fun")   safe("renderFun");
    else safe("loadScores", true);

    updateRivalryBanner();
    setTimeout(() => { try { replaceMichiganText(); } catch {} }, 0);
  }
  window.showTab = showTab;

  // ------------------------------------------------------------
  // Login (invite code -> role)
  // ------------------------------------------------------------
  async function checkCode() {
  const input = document.getElementById("code");
  const btn = document.getElementById("loginBtn");

  if (!input) return;

  const raw = String(input.value || "").trim();
  if (!raw) return;

  if (btn) { btn.disabled = true; btn.textContent = "Checking…"; }

  try {
    let role = "";

    // --- HARDCODED KEYS (instant, no network) ---
    const HARD_CODES = {
      "SCARLET":   "admin",
      "BUCKEYE":   "admin",
      "OHIOSTATE": "admin",
      "THESHOP":   "admin",
      "GUEST":     "guest",
      "VISITOR":   "guest"
    };

    const upper = raw.toUpperCase();
    if (HARD_CODES[upper]) {
      role = HARD_CODES[upper];
    }

    // --- FIREBASE LOOKUP (if no hardcoded match) ---
    if (!role) {
      if (typeof window.ensureFirebaseChatReady !== "function" || !window.firebase) {
        if (btn) { btn.disabled = false; btn.textContent = "Enter The Shop"; }
        alert("Firebase not loaded yet. Please wait a moment and try again.");
        return;
      }

      try {
        await window.ensureFirebaseChatReady();
      } catch (firebaseErr) {
        if (btn) { btn.disabled = false; btn.textContent = "Enter The Shop"; }
        alert("Firebase failed to initialize. Check your connection.");
        return;
      }

      const db = firebase.firestore();

      // 1. Try redeemInviteCodeHttp cloud function first
      try {
        const resp = await fetch(
          "https://us-central1-the-shop-chat.cloudfunctions.net/redeemInviteCodeHttp",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: raw })
          }
        );
        const json = await resp.json();
        if (json.role) role = json.role;
      } catch (cfErr) {
        console.warn("Cloud function failed, falling back to Firestore direct:", cfErr);
      }

      // 2. Fallback: direct Firestore read
      if (!role) {
        try {
          const snap = await db.collection("inviteCodes").doc(raw.toUpperCase()).get();
          if (snap.exists) {
            const d = snap.data() || {};
            if (d.role) role = d.role;
          }
        } catch (fsErr) {
          console.warn("Firestore fallback failed:", fsErr);
        }
      }
    }

    if (!role) {
      if (btn) { btn.disabled = false; btn.textContent = "Enter The Shop"; }
      alert("Invalid code. Try again.");
      return;
    }

    // --- SUCCESS ---
    window.__serverRoleCache = role;
    safeRoleSet(role);

    if (btn) { btn.disabled = false; btn.textContent = "Enter The Shop"; }

    // Advance to entry screen (door selection)
    showEntryScreen();

    const tab = window.__activeTab || "scores";
    buildTabsForRole(role);
    showTab(tab);

  } catch (err) {
    console.error("checkCode error:", err);
    if (btn) { btn.disabled = false; btn.textContent = "Enter The Shop"; }
    alert("Something went wrong. Please try again.");
  }
}
window.checkCode = checkCode;

  // ------------------------------------------------------------
  // Logout
  // ------------------------------------------------------------
  window.logoutUser = function logoutUser() {
    try { window.hardResetAppInitState && window.hardResetAppInitState(); } catch {}
    try { safeRoleSet(""); } catch {}
    try { window.__serverRoleCache = ""; } catch {}
    try { window.__activeTab = "scores"; } catch {}

    const app = document.getElementById("app");
    const login = document.getElementById("login");
    const entry = document.getElementById("entry");

    if (app) app.style.display = "none";
    if (entry) entry.style.display = "none";
    if (login) {
      login.style.display = "flex";
      const codeEl = document.getElementById("code");
      if (codeEl) { codeEl.value = ""; codeEl.focus(); }
    }
  };

})();
