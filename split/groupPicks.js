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
  function ymd8(d) {
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }
  // Default multi-day builder range: Thu–Mon of the current NFL-style
  // week (weeks run Tue→Mon, so "this week" is anchored to the most
  // recent Tuesday on or before today).
  // Builds the ESPN scoreboard `dates` param from the admin's start/end
  // mem fields — a single YYYYMMDD, or a YYYYMMDD-YYYYMMDD range when the
  // two differ (ESPN's scoreboard endpoints accept both forms).
  function gpAdminDateRangeString(mem2) {
    const defaults = gpDefaultWeekRange();
    const start = String(mem2?.gpAdminDateStart || defaults.start);
    const end   = String(mem2?.gpAdminDateEnd   || defaults.end);
    if (!end || end === start) return start;
    return `${start}-${end}`;
  }
  function gpDefaultWeekRange() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun..6=Sat
    const daysSinceTue = (day - 2 + 7) % 7;
    const tue = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceTue);
    const thu = new Date(tue.getFullYear(), tue.getMonth(), tue.getDate() + 2);
    const mon = new Date(tue.getFullYear(), tue.getMonth(), tue.getDate() + 6);
    return { start: ymd8(thu), end: ymd8(mon) };
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
    gpPendingClearTiebreaker();
  }
  function gpPendingHasAny() {
    return Object.keys(gpPendingBucket()).length > 0 || gpPendingGetTiebreaker() != null;
  }
  // Expose for use in gp-render.js card builder
  window.gpPendingGet = gpPendingGet;

  // ───────────────────────────────────────────
  // Pending tiebreaker guess (separate slot — not an eventId pick)
  // ───────────────────────────────────────────
  function gpPendingSetTiebreaker(value) {
    const n = Number(value);
    window.__GP_PENDING_TB = Number.isFinite(n) ? Math.max(0, Math.min(200, Math.round(n))) : null;
  }
  function gpPendingGetTiebreaker() {
    return (typeof window.__GP_PENDING_TB === "number") ? window.__GP_PENDING_TB : null;
  }
  function gpPendingClearTiebreaker() {
    window.__GP_PENDING_TB = null;
  }

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
  // Lock reminder — flags picks that lock soon and are still empty
  // ───────────────────────────────────────────
  const GP_LOCK_REMINDER_THRESHOLD_MIN = 180; // 3 hours
  function gpComputeLockReminder(games, myMap) {
    const now = Date.now();
    let missingCount = 0;
    let earliestMs = null;
    for (const g of (Array.isArray(games) ? games : [])) {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) continue;
      const ms = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
      if (!ms || ms <= now) continue; // already locked or no kickoff time
      const hasPick = !!(myMap?.[eventId]?.side) || !!gpPendingGet(eventId);
      if (hasPick) continue;
      missingCount++;
      if (earliestMs == null || ms < earliestMs) earliestMs = ms;
    }
    if (!missingCount || earliestMs == null) return null;
    const minutesUntilLock = Math.round((earliestMs - now) / 60000);
    if (minutesUntilLock > GP_LOCK_REMINDER_THRESHOLD_MIN) return null;
    return { missingCount, minutesUntilLock };
  }

  // ───────────────────────────────────────────
  // Season standings — aggregate every published week
  // Fully-final weeks are cached in localStorage forever (their result
  // can never change again); anything still live/upcoming is recomputed
  // fresh on every load.
  // ───────────────────────────────────────────
  function gpSeasonWeekCacheKey(weekId) {
    return `theShopGpSeasonWeekCache_v1_${weekId}`;
  }
  async function gpLoadSeasonLeaderboard(db, weeks) {
    const published = (Array.isArray(weeks) ? weeks : []).filter(w => w?.published);
    const results = [];
    for (const w of published) {
      const wid = String(w?.id || "");
      if (!wid) continue;
      const cacheKey = gpSeasonWeekCacheKey(wid);
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch {}
      if (cached && cached.final) {
        results.push({ weekId: wid, weekLabel: w.label, rows: cached.rows, finalsCount: cached.finalsCount });
        continue;
      }
      let games = [];
      try { games = await (Data().gpGetSlateGames || (async () => []))(db, wid); } catch {}
      if (!games.length) continue;
      try { await (ESPN().gpHydrateLiveStateForGames || (async () => {}))(games); } catch {}
      let allPicks = {};
      try { allPicks = await (Data().gpEnsureAllPicksForWeek || (async () => ({})))(db, wid); } catch {}
      let slateDoc = {};
      try { slateDoc = await (Data().gpGetSlateDoc || (async () => ({})))(db, wid); } catch {}
      const scoringMode = String(slateDoc?.scoringMode || "straight");
      let tiebreakers = {};
      try { tiebreakers = await (Data().gpEnsureTiebreakersForWeek || (async () => ({})))(db, wid); } catch {}
      const lb = (Data().gpComputeWeeklyLeaderboard || (() => ({ rows: [], finalsCount: 0 })))(
        games, allPicks, { scoringMode, tiebreakers, tiebreakerEventId: slateDoc?.tiebreakerEventId }
      );
      results.push({ weekId: wid, weekLabel: w.label, rows: lb.rows, finalsCount: lb.finalsCount });

      const allFinal = games.length > 0 && lb.finalsCount === games.length;
      if (allFinal) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ final: true, rows: lb.rows, finalsCount: lb.finalsCount })); } catch {}
      }
    }
    return (Data().gpComputeSeasonLeaderboard || (() => ({ rows: [], weeksCount: 0 })))(results);
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
    const weeks = Array.isArray(metaPublic?.weeks) ? metaPublic.weeks : [];

    // ── season view: cumulative standings across every published week ──
    if (mem.gpViewMode === "season") {
      const headerHTML  = (Render().renderPicksHeaderHTML || (() => ""))({
        weekSelectHTML: "", weekId: "", weekLabel: "Season", isAdmin
      });
      const toggleHTML  = (Render().gpBuildViewToggleHTML || (() => ""))("season");
      let seasonHTML = `<div class="gpNotice">Loading season standings…</div>`;
      el.innerHTML = `${headerHTML}<div class="gpContainer">${toggleHTML}${seasonHTML}</div>`;
      try {
        const seasonLB = await gpLoadSeasonLeaderboard(db, weeks);
        seasonHTML = (Render().buildSeasonLeaderboardHTML || (() => ""))(seasonLB);
      } catch (err) {
        seasonHTML = `<div class="gpNotice">Couldn't load season standings: ${String(err?.message || err)}</div>`;
      }
      el.innerHTML = `${headerHTML}<div class="gpContainer">${toggleHTML}${seasonHTML}</div>`;
      postRender();
      return;
    }

    let selectedId = gpGetSelectedWeekId(metaPublic);
    const weekMeta = weeks.find(w => String(w?.id) === selectedId) || weeks[weeks.length - 1] || null;
    if (!selectedId && weekMeta) selectedId = String(weekMeta.id || "");
    const weekLabel = String(weekMeta?.label || selectedId || "");
    const published = !!weekMeta?.published;

    // ── store slateId so save handler can always find it ──
    mem.picksSlateId = selectedId;

    // ── games + my picks + slate settings (scoring mode / tiebreaker) ──
    let games       = [];
    let myMap       = {};
    let allPicks    = {};
    let slateDoc    = {};
    let tiebreakers = {};
    let myPicksUserDoc = {};
    if (selectedId) {
      try {
        games          = await (Data().gpGetSlateGames         || (async () => []))(db, selectedId);
        myMap          = await (Data().gpGetMyPicksMap         || (async () => ({})))(db, selectedId, playerId);
        allPicks       = await (Data().gpEnsureAllPicksForWeek || (async () => ({})))(db, selectedId);
        slateDoc       = await (Data().gpGetSlateDoc           || (async () => ({})))(db, selectedId);
        tiebreakers    = await (Data().gpEnsureTiebreakersForWeek || (async () => ({})))(db, selectedId);
        myPicksUserDoc = await (Data().gpGetMyPicksUserDoc     || (async () => ({})))(db, selectedId, playerId);
      } catch {}
    }
    const scoringMode      = String(slateDoc?.scoringMode || "straight");
    const tiebreakerEventId = String(slateDoc?.tiebreakerEventId || "");
    const myTiebreakerGuess = Number.isFinite(Number(myPicksUserDoc?.tiebreakerGuess))
      ? Number(myPicksUserDoc.tiebreakerGuess) : null;

    // ── hydrate live scores + odds ──
    if (games.length) {
      try { await (ESPN().gpHydrateLiveStateForGames || (async () => {}))(games); } catch {}
      try { await (ESPN().gpHydrateOddsForGames     || (async () => {}))(games); } catch {}
    }

    // ── expose current state for player picks overlay ──
    window.__gpCurrentGames    = games;
    window.__gpCurrentAllPicks = allPicks;

    // ── lock reminder (mine only) ──
    const lockReminder = gpComputeLockReminder(games, myMap);
    const lockReminderHTML = lockReminder ? (Render().gpBuildLockReminderHTML || (() => ""))(lockReminder) : "";

    // ── build HTML ──
    const weekSelectHTML = buildWeekSelectHTML(weeks, selectedId);
    const headerHTML     = (Render().renderPicksHeaderHTML || (() => ""))({
      weekSelectHTML, weekId: selectedId, weekLabel, isAdmin
    });
    const toggleHTML = (Render().gpBuildViewToggleHTML || (() => ""))("week");
    const cardsHTML = (Render().gpBuildGroupPicksCardHTML || (() => ""))({
      weekId: selectedId, weekLabel, games, myMap, published, allPicks, isAdmin,
      scoringMode, tiebreakerEventId, tiebreakers,
      myTiebreakerGuess, pendingTiebreakerGuess: gpPendingGetTiebreaker(),
      lockReminder: lockReminderHTML
    });

    // Admin builder goes FIRST inside gpContainer
    let adminBuilderHTML = "";
    if (isAdmin) {
      const leagueKey  = mem.gpAdminLeagueKey || getSavedLeagueKeySafe();
      const defaultRange = gpDefaultWeekRange();
      const dateStart  = mem.gpAdminDateStart || defaultRange.start;
      const dateEnd    = mem.gpAdminDateEnd   || defaultRange.end;
      const avail      = mem.gpAvailableEvents || [];
      adminBuilderHTML = (Render().gpBuildAdminBuilderHTML || (() => ""))({
        weekId: selectedId, weekLabel, availableEvents: avail,
        leagueKey, dateStart, dateEnd, isAdmin,
        games, scoringMode, tiebreakerEventId
      });
    }

    el.innerHTML = `${headerHTML}<div class="gpContainer">${toggleHTML}${adminBuilderHTML}${cardsHTML}</div>`;
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
      const tbPending = gpPendingGetTiebreaker();
      const idObj2   = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
      const playerId = idObj2.playerId || gpMem().picksPlayerId || "";

      if (!slateId)  { console.error("[GP] savePicks: no slateId");  return; }
      if (!playerId) { console.error("[GP] savePicks: no playerId"); return; }
      if (!Object.keys(pending).length && tbPending == null) return;

      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        await (Data().gpSaveMyPicksBatch || (async () => {}))(db2, slateId, playerId, pending, tbPending);
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

    // ── view toggle: this week / season ──
    if (action === "viewWeek" || action === "viewSeason") {
      gpMem().gpViewMode = action === "viewSeason" ? "season" : "week";
      await renderPicks();
      return;
    }

    // ── admin: quick-fill this week's date range (Thu–Mon) ──
    if (action === "adminQuickWeekRange") {
      const range = gpDefaultWeekRange();
      gpMem().gpAdminDateStart = range.start;
      gpMem().gpAdminDateEnd   = range.end;
      await renderPicks();
      return;
    }

    // ── admin: set the weekly tiebreaker game ──
    if (action === "adminSetTiebreaker") {
      const weekId = String(btn.getAttribute("data-weekid") || "");
      const sel    = document.querySelector("[data-gptiebreakerselect]");
      const eventId = String(sel?.value || "").trim();
      if (!weekId) return;
      const games = Array.isArray(window.__gpCurrentGames) ? window.__gpCurrentGames : [];
      const game  = eventId ? games.find(g => String(g?.eventId || g?.id || "") === eventId) : null;
      const startMs = game?.startTime?.toMillis ? game.startTime.toMillis() : 0;
      btn.disabled = true; btn.textContent = "Setting…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        await (Admin().gpAdminSetTiebreaker || (async () => {}))(db2, uid, weekId, eventId, startMs);
        await renderPicks();
      } catch (err) {
        btn.disabled = false; btn.textContent = "Set";
        console.error("[GP] adminSetTiebreaker error:", err);
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

    // ── admin: load games (supports a multi-day date range) ──
    if (action === "adminLoadGames") {
      const mem2       = gpMem();
      const leagueKey  = mem2.gpAdminLeagueKey || getSavedLeagueKeySafe();
      const dateRange  = gpAdminDateRangeString(mem2);
      const statusEl   = document.getElementById("gpAdminStatus");
      if (statusEl) statusEl.textContent = "Loading games…";
      try {
        const events = await (ESPN().fetchEventsFor || (async () => []))(leagueKey, dateRange);
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

    // ── admin: remove a committed game from the week ──
    if (action === "adminRemoveGame") {
      const weekId  = String(btn.getAttribute("data-weekid") || "");
      const eventId = String(btn.getAttribute("data-eid")    || "");
      if (!weekId || !eventId) return;

      const picksForGame = window.__gpCurrentAllPicks?.[eventId];
      const pickCount = Array.isArray(picksForGame) ? picksForGame.length : 0;
      const warn = pickCount
        ? ` ${pickCount} player${pickCount !== 1 ? "s" : ""} already picked this game — their picks won't be deleted, but the game (and their picks for it) will drop out of the standings.`
        : "";
      if (!confirm(`Remove this game from the week?${warn}`)) return;

      btn.disabled = true;
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        await (Admin().gpAdminRemoveGameFromWeek || (async () => {}))(db2, uid, weekId, eventId);
        await renderPicks();
      } catch (err) {
        btn.disabled = false;
        console.error("[GP] adminRemoveGame error:", err);
      }
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
        // Fallback date if an event has no computable kickoff time — each
        // added game's real date is otherwise derived from its own start time.
        const dateStr   = mem2.gpAdminDateStart || gpDefaultWeekRange().start;
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
  document.addEventListener("change", async (e) => {
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

    // Admin date range inputs (value is YYYY-MM-DD → store as YYYYMMDD)
    if (t.getAttribute("data-date-start-input") !== null) {
      gpMem().gpAdminDateStart = String(t.value || "").replace(/-/g, "");
      return;
    }
    if (t.getAttribute("data-date-end-input") !== null) {
      gpMem().gpAdminDateEnd = String(t.value || "").replace(/-/g, "");
      return;
    }

    // Admin scoring mode select
    if (t.getAttribute("data-gpscoringmode") === "1") {
      const weekId = String(gpMem().picksSlateId || "").trim();
      const mode   = String(t.value || "straight").trim();
      if (!weekId) return;
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        await (Admin().gpAdminSetScoringMode || (async () => {}))(db2, uid, weekId, mode);
        await renderPicks();
      } catch (err) {
        console.error("[GP] adminSetScoringMode error:", err);
      }
      return;
    }

    // Pending tiebreaker guess
    if (t.getAttribute("data-gptiebreakerinput") === "1") {
      const raw = String(t.value || "").trim();
      if (raw === "") { gpPendingClearTiebreaker(); } else { gpPendingSetTiebreaker(raw); }
      syncSaveBtnState();
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
