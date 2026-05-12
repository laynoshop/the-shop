/* split/groupPicks.js
   =========================
   GROUP PICKS — Orchestrator
   Thin coordinator that wires together:
     GP_Identity  (gp-identity.js)
     GP_Data      (gp-data.js)
     GP_ESPN      (gp-espn.js)
     GP_Admin     (gp-admin.js)
     GP_Render    (gp-render.js)

   Owns: constants, pending-picks state, week selector,
         renderPicks(), click/change handlers, auto-refresh.

   Layout order for admin:
     1. Header (sticky)
     2. Admin Builder Panel   ← TOP of page
     3. Game cards + leaderboard
*/

(function () {
  "use strict";

  // ───────────────────────────────────────────
  // Constants
  // ───────────────────────────────────────────
  const PICKS_WEEK_KEY = "theShopPicksWeek_v1";

  // ───────────────────────────────────────────
  // Safe helpers (local copies for safety)
  // ───────────────────────────────────────────
  function safeGetLS(key) {
    try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
  }
  function safeSetLS(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }
  function getRole() {
    if (typeof window.getRole === "function") return window.getRole();
    const r = safeGetLS("theShopRole_v1").trim();
    return (r === "admin" || r === "guest") ? r : "guest";
  }
  function getSavedLeagueKeySafe() {
    if (typeof window.getSavedLeagueKey === "function") return window.getSavedLeagueKey();
    return safeGetLS("theShopLeague_v1").trim() || "ncaam";
  }
  function getSavedDateYYYYMMDDSafe() {
    if (typeof window.getSavedDateYYYYMMDD === "function") return window.getSavedDateYYYYMMDD();
    const DATE_KEY = "theShopDate_v1";
    let saved = "";
    try { saved = String(localStorage.getItem(DATE_KEY) || "").trim(); } catch {}
    if (/^\d{8}$/.test(saved)) return saved;
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }

  // ───────────────────────────────────────────
  // Sub-module delegates (fail-safe accessors)
  // ───────────────────────────────────────────
  const ID     = () => window.GP_Identity || {};
  const Data   = () => window.GP_Data     || {};
  const ESPN   = () => window.GP_ESPN     || {};
  const Admin  = () => window.GP_Admin    || {};
  const Render = () => window.GP_Render   || {};

  // ───────────────────────────────────────────
  // Memory bucket (shared with sub-modules)
  // ───────────────────────────────────────────
  function gpMem() {
    window.__GP_MEM = window.__GP_MEM || {};
    return window.__GP_MEM;
  }

  // ───────────────────────────────────────────
  // Pending picks (in-memory, per session)
  // ───────────────────────────────────────────
  function gpPendingBucket() {
    window.__GP_PENDING = window.__GP_PENDING || {};
    return window.__GP_PENDING;
  }
  function gpPendingSet(eventId, side) {
    gpPendingBucket()[String(eventId)] = String(side);
  }
  function gpPendingGet(eventId) {
    return String(gpPendingBucket()[String(eventId)] || "");
  }
  function gpPendingClear() {
    window.__GP_PENDING = {};
  }
  function gpPendingHasAny() {
    return Object.keys(gpPendingBucket()).length > 0;
  }
  // Expose for use in gp-render.js card builder
  window.gpPendingGet = gpPendingGet;

  // ───────────────────────────────────────────
  // Cache bust helper
  // Clears the allPicks in-memory cache for a week so the next
  // renderPicks() re-fetches fresh data from Firestore.
  // Also strips data-loaded from any open <details> so they re-render.
  // ───────────────────────────────────────────
  function gpBustAllPicksCache(weekId) {
    // 1. Bust the in-memory cache bucket
    const bustFn = Data().gpBustAllPicksCache;
    if (typeof bustFn === "function") {
      bustFn(weekId);
    } else {
      // Fallback: clear directly if gp-data.js hasn't exposed the helper yet
      try {
        if (window.__GP_ALLPICKS_CACHE && window.__GP_ALLPICKS_CACHE[weekId]) {
          window.__GP_ALLPICKS_CACHE[weekId] = { ts: 0, data: null, promise: null };
        }
      } catch {}
    }
    // 2. Bust data-loaded on any open <details> for this week so they re-fetch
    try {
      document.querySelectorAll(`[data-gpeveryone="1"][data-weekid="${weekId}"]`).forEach(det => {
        const bodyId = `gpEveryone_${weekId}_${det.getAttribute("data-eid") || ""}`;
        const bodyEl = document.getElementById(bodyId);
        if (bodyEl) bodyEl.removeAttribute("data-loaded");
      });
    } catch {}
  }

  // ───────────────────────────────────────────
  // Week selector helpers
  // ───────────────────────────────────────────
  function gpGetSelectedWeekId(metaPublic) {
    const saved = safeGetLS(PICKS_WEEK_KEY).trim();
    if (saved) return saved;
    return String(metaPublic?.activeWeekId || "");
  }
  function gpSetSelectedWeekId(id) {
    safeSetLS(PICKS_WEEK_KEY, String(id));
  }
  function buildWeekSelectHTML(weeks, selectedId) {
    const list = Array.isArray(weeks) ? weeks : [];
    if (list.length <= 1) return "";
    const options = list.map(w => {
      const id  = String(w?.id || "");
      const lbl = String(w?.label || id);
      return `<option value="${id}"${id === selectedId ? " selected" : ""}>${lbl}</option>`;
    }).join("");
    return `<select class="smallSelect" data-gpweeksel="1" style="font-weight:900;">${options}</select>`;
  }

  // ───────────────────────────────────────────
  // postRender — wire up save-button state
  // ───────────────────────────────────────────
  function postRender() {
    syncSaveBtnState();
  }

  function syncSaveBtnState() {
    const btns = document.querySelectorAll('[data-gpaction="savePicks"]');
    const hasPending = gpPendingHasAny();
    btns.forEach(btn => { btn.disabled = !hasPending; });
  }

  // ───────────────────────────────────────────
  // Main renderer
  //
  // DOM order written:
  //   1. Header  (gpPageHeader — sticky)
  //   2. gpContainer
  //        a. Admin builder panel  ← FIRST inside container (admin only)
  //        b. Games + leaderboard
  // ───────────────────────────────────────────
  async function renderPicks() {
    const el = document.getElementById("content");
    if (!el) return;

    const isAdmin = getRole() === "admin";
    const mem     = gpMem();

    // ── identity gate ──
    const idObj = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
    const valid  = (ID().gpIsIdentityValid || (() => false))(idObj);
    if (!valid) {
      const gateHTML = (ID().gpBuildIdentityGateHTML || (() => ""))({
        prefillName:     idObj.name || "",
        rememberChecked: idObj.remember !== false
      });
      const hdr = (Render().renderPicksHeaderHTML || (() => ""))({
        weekSelectHTML: "", weekId: "", weekLabel: "", isAdmin
      });
      el.innerHTML = `${hdr}<div class="gpContainer">${gateHTML}</div>`;
      return;
    }

    // ── ensure player ID ──
    let { name, code, playerId } = idObj;
    if (!playerId) {
      playerId = await (ID().gpComputePlayerId || (async () => ""))(name, code);
      (ID().gpSetIdentity || (() => {}))({ name, code, remember: idObj.remember, playerId });
    }
    mem.picksPlayerId = playerId;
    mem.picksName     = name;

    // ── firebase + meta ──
    let db, metaPublic;
    try {
      await (Data().ensureFirebaseReadySafe || (async () => {}))();
      db = firebase.firestore();
      metaPublic = await (Data().gpGetMetaPublic || (async () => ({})))(db);
    } catch (err) {
      el.innerHTML = `<div class="gpContainer"><div class="gpNotice">Failed to connect: ${String(err?.message || err)}</div></div>`;
      return;
    }

    // ── week resolution ──
    const weeks    = Array.isArray(metaPublic?.weeks) ? metaPublic.weeks : [];
    let selectedId = gpGetSelectedWeekId(metaPublic);
    const weekMeta = weeks.find(w => String(w?.id) === selectedId) || weeks[weeks.length - 1] || null;
    if (!selectedId && weekMeta) selectedId = String(weekMeta.id || "");
    const weekLabel = String(weekMeta?.label || selectedId || "");
    const published = !!weekMeta?.published;

    // ── store slateId so save handler can always find it ──
    mem.picksSlateId = selectedId;

    // ── games + my picks ──
    let games    = [];
    let myMap    = {};
    let allPicks = {};
    if (selectedId) {
      try {
        games    = await (Data().gpGetSlateGames      || (async () => []))(db, selectedId);
        myMap    = await (Data().gpGetMyPicksMap      || (async () => ({})))(db, selectedId, playerId);
        allPicks = await (Data().gpEnsureAllPicksForWeek || (async () => ({})))(db, selectedId);
      } catch {}
    }

    // ── hydrate live scores + odds ──
    if (games.length) {
      try { await (ESPN().gpHydrateLiveStateForGames || (async () => {}))(games); } catch {}
      try { await (ESPN().gpHydrateOddsForGames     || (async () => {}))(games); } catch {}
    }

    // ── expose current state for player picks overlay ──
    window.__gpCurrentGames    = games;
    window.__gpCurrentAllPicks = allPicks;

    // ── build HTML ──
    const weekSelectHTML = buildWeekSelectHTML(weeks, selectedId);
    const headerHTML     = (Render().renderPicksHeaderHTML || (() => ""))({
      weekSelectHTML, weekId: selectedId, weekLabel, isAdmin
    });
    const cardsHTML = (Render().gpBuildGroupPicksCardHTML || (() => ""))({
      weekId: selectedId, weekLabel, games, myMap, published, allPicks, isAdmin
    });

    // Admin builder goes FIRST inside gpContainer
    let adminBuilderHTML = "";
    if (isAdmin) {
      const leagueKey = mem.gpAdminLeagueKey || getSavedLeagueKeySafe();
      const dateLabel = mem.gpAdminDateLabel || getSavedDateYYYYMMDDSafe();
      const avail     = mem.gpAvailableEvents || [];
      adminBuilderHTML = (Render().gpBuildAdminBuilderHTML || (() => ""))({
        weekId: selectedId, weekLabel, availableEvents: avail,
        leagueKey, dateLabel, isAdmin
      });
    }

    el.innerHTML = `${headerHTML}<div class="gpContainer">${adminBuilderHTML}${cardsHTML}</div>`;
    postRender();
  }

  // ───────────────────────────────────────────
  // Click delegation
  // ───────────────────────────────────────────
  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!t) return;

    // ── pick a team ──
    const pickBtn = t.closest("[data-gppick]");
    if (pickBtn && !pickBtn.disabled) {
      const side    = String(pickBtn.getAttribute("data-gppick") || "");
      const eventId = String(pickBtn.getAttribute("data-eid")   || "");
      if (side && eventId) {
        gpPendingSet(eventId, side);
        syncSaveBtnState();
        document.querySelectorAll(`[data-gppick][data-eid="${eventId}"]`).forEach(b => {
          const bSide = b.getAttribute("data-gppick");
          b.classList.toggle("gpPickRowActive", bSide === side);
          b.classList.toggle("gpFaded",         bSide !== side);
        });
      }
      return;
    }

    // ── select all / none (admin game list) ──
    const gpSelect = t.getAttribute("data-gpselect") ||
                     t.closest("[data-gpselect]")?.getAttribute("data-gpselect") || "";
    if (gpSelect) {
      (Render().gpApplyAdminSelection || (() => {}))(gpSelect);
      return;
    }

    const action = t.getAttribute("data-gpaction") ||
                   t.closest("[data-gpaction]")?.getAttribute("data-gpaction") || "";
    if (!action) return;
    const btn = t.closest("[data-gpaction]") || t;

    // ── save picks ──
    if (action === "savePicks") {
      const slateId  = String(gpMem().picksSlateId || btn.getAttribute("data-slate") || "").trim();
      const pending  = gpPendingBucket();
      const idObj2   = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
      const playerId = idObj2.playerId || gpMem().picksPlayerId || "";

      if (!slateId)  { console.error("[GP] savePicks: no slateId");  return; }
      if (!playerId) { console.error("[GP] savePicks: no playerId"); return; }
      if (!Object.keys(pending).length) return;

      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        await (Data().gpSaveMyPicksBatch || (async () => {}))(db2, slateId, playerId, pending);
        gpPendingClear();
        // Bust the allPicks cache so the re-render fetches fresh data
        gpBustAllPicksCache(slateId);
        btn.textContent = "Saved!";
        setTimeout(() => renderPicks(), 800);
      } catch (err) {
        btn.textContent = "Error — retry";
        btn.disabled = false;
        console.error("[GP] save error:", err);
      }
      return;
    }

    // ── refresh ──
    if (action === "refresh") {
      await renderPicks();
      return;
    }

    // ── identity: continue ──
    if (action === "playerContinue") {
      const nameEl = document.getElementById("gpIdName");
      const codeEl = document.getElementById("gpIdCode");
      const remEl  = document.getElementById("gpIdRemember");
      const nm     = String(nameEl?.value || "").trim();
      const cd     = String(codeEl?.value || "").trim();
      const rem    = !!remEl?.checked;
      if (!(ID().gpIsIdentityValid || (() => false))({ name: nm, code: cd })) {
        (ID().gpSetIdentityError || (() => {}))("Name (2+ chars) and code (3+ chars) required.");
        return;
      }
      const pid = await (ID().gpComputePlayerId || (async () => ""))(nm, cd);
      (ID().gpSetIdentity || (() => {}))({ name: nm, code: cd, remember: rem, playerId: pid });
      await renderPicks();
      return;
    }

    // ── identity: clear ──
    if (action === "playerClear") {
      (ID().gpClearIdentity || (() => {}))();
      gpPendingClear();
      await renderPicks();
      return;
    }

    // ── name button (open identity gate) ──
    if (action === "name") {
      const idObj = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
      const gateHTML = (ID().gpBuildIdentityGateHTML || (() => ""))({
        prefillName: idObj.name || "", rememberChecked: idObj.remember !== false
      });
      const el = document.getElementById("content");
      if (el) {
        const hdr = (Render().renderPicksHeaderHTML || (() => ""))({
          weekSelectHTML: "", weekId: "", weekLabel: "", isAdmin: getRole() === "admin"
        });
        el.innerHTML = `${hdr}<div class="gpContainer">${gateHTML}</div>`;
        postRender();
        setTimeout(() => { try { document.getElementById("gpIdName")?.focus(); } catch {} }, 0);
      }
      return;
    }

    // ── admin: load games ──
    if (action === "adminLoadGames") {
      const mem2       = gpMem();
      const leagueKey  = mem2.gpAdminLeagueKey || getSavedLeagueKeySafe();
      const dateStr    = mem2.gpAdminDateLabel || getSavedDateYYYYMMDDSafe();
      const statusEl   = document.getElementById("gpAdminStatus");
      if (statusEl) statusEl.textContent = "Loading games…";
      try {
        const events = await (ESPN().fetchEventsFor || (async () => []))(leagueKey, dateStr);
        mem2.gpAvailableEvents = Array.isArray(events) ? events : [];
        if (statusEl) statusEl.textContent = `Loaded ${mem2.gpAvailableEvents.length} games.`;
      } catch (err) {
        mem2.gpAvailableEvents = [];
        if (statusEl) statusEl.textContent = "Error loading games.";
        console.error("[GP] adminLoadGames error:", err);
      }
      await renderPicks();
      return;
    }

    // ── admin: add selected games ──
    if (action === "adminAddGames") {
      const weekId = String(btn.getAttribute("data-weekid") || "");
      const mem2   = gpMem();
      if (!weekId) return;
      const checkboxes = document.querySelectorAll("[data-gpgamesel]:checked");
      const selected   = new Set([...checkboxes].map(c => String(c.value)));
      if (!selected.size) { alert("Select at least one game first."); return; }
      btn.disabled = true; btn.textContent = "Adding…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        const leagueKey = mem2.gpAdminLeagueKey || getSavedLeagueKeySafe();
        const dateStr   = mem2.gpAdminDateLabel || getSavedDateYYYYMMDDSafe();
        const events    = mem2.gpAvailableEvents || [];
        await (Admin().gpAdminAddSelectedGamesToWeek || (async () => {}))(db2, uid, weekId, leagueKey, dateStr, selected, events);
        mem2.gpAvailableEvents = [];
        await renderPicks();
      } catch (err) {
        btn.disabled = false; btn.textContent = "Add Selected";
        console.error("[GP] adminAddGames error:", err);
      }
      return;
    }

    // ── admin: create week ──
    if (action === "adminCreateWeek") {
      if (!confirm("Create a new week?")) return;
      btn.disabled = true; btn.textContent = "Creating…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        await (Admin().gpAdminCreateNewWeek || (async () => {}))(db2, uid);
        safeSetLS(PICKS_WEEK_KEY, "");
        await renderPicks();
      } catch (err) {
        btn.disabled = false; btn.textContent = "+ New Week";
        console.error("[GP] adminCreateWeek error:", err);
      }
      return;
    }

    // ── admin: publish week ──
    if (action === "adminPublish") {
      const weekId = String(btn.getAttribute("data-weekid") || "");
      if (!weekId || !confirm(`Publish ${weekId}? Players will see it.`)) return;
      btn.disabled = true; btn.textContent = "Publishing…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        await (Admin().gpAdminPublishWeek || (async () => {}))(db2, uid, weekId);
        await renderPicks();
      } catch (err) {
        btn.disabled = false; btn.textContent = "Publish";
        console.error("[GP] adminPublish error:", err);
      }
      return;
    }
  });

  // ───────────────────────────────────────────
  // Change handlers
  // ───────────────────────────────────────────
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!t) return;

    // Week selector
    if (t.getAttribute("data-gpweeksel") === "1") {
      const id = String(t.value || "").trim();
      if (id) { gpSetSelectedWeekId(id); gpPendingClear(); renderPicks(); }
      return;
    }

    // Admin league selector
    if (t.getAttribute("data-league-select") !== null) {
      gpMem().gpAdminLeagueKey = String(t.value || "").trim();
      return;
    }

    // Admin date input  (value is YYYY-MM-DD → store as YYYYMMDD)
    if (t.getAttribute("data-date-input") !== null) {
      const v = String(t.value || "").replace(/-/g, "");
      gpMem().gpAdminDateLabel = v;
      return;
    }
  });

  // ───────────────────────────────────────────
  // Auto-refresh
  // ───────────────────────────────────────────
  let _gpRefreshTimer = null;
  const GP_REFRESH_MS = 60 * 1000;

  function startGpAutoRefresh() {
    stopGpAutoRefresh();
    _gpRefreshTimer = setInterval(() => {
      const tab = document.querySelector(".tabBtn.active[data-tab='picks']") ||
                  document.querySelector(".tabBtn.active[data-tab='grouppicks']");
      if (tab) renderPicks();
    }, GP_REFRESH_MS);
  }
  function stopGpAutoRefresh() {
    if (_gpRefreshTimer) { clearInterval(_gpRefreshTimer); _gpRefreshTimer = null; }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopGpAutoRefresh(); else startGpAutoRefresh();
  });

  // ───────────────────────────────────────────
  // Expose public API
  // ───────────────────────────────────────────
  window.renderPicks        = renderPicks;
  window.startGpAutoRefresh = startGpAutoRefresh;
  window.stopGpAutoRefresh  = stopGpAutoRefresh;

})();
