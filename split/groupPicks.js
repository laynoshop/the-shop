/* split/groupPicks.js
   =========================
   GROUP PICKS — Orchestrator
   Thin coordinator that wires together:
     GP_Identity  (gp-identity.js)
     GP_Data      (gp-data.js)
     GP_ESPN      (gp-espn.js)
     GP_Admin     (gp-admin.js)
     GP_Render    (gp-render.js)

   Owns: constants, pending-picks state, league + week selection,
         renderPicks(), click/change handlers, auto-refresh.

   Flow: identity gate -> league picker -> week view (pager, not a
   dropdown) -> leaderboard -> games. "League" here means a pick'em
   group (Work League, Family League, ...) — unrelated to `leagueKey`
   elsewhere in this file, which means the *sport* (nfl/cfb/nba/...)
   for the ESPN scoreboard fetch. To keep the two straight, the pick'em
   concept is always `pickLeague*` in code.

   Layout order for admin:
     1. Header (sticky)
     2. Week pager
     3. Admin Builder Panel
     4. Leaderboard + games
*/

(function () {
  "use strict";

  // ───────────────────────────────────────────
  // Constants
  // ───────────────────────────────────────────
  const PICKS_LEAGUE_KEY = "theShopPickLeagueId_v1";
  function weekKeyForLeague(pickLeagueId) {
    return `theShopPicksWeek_v1_${pickLeagueId}`;
  }

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
  function gpPendingDelete(eventId) {
    delete gpPendingBucket()[String(eventId)];
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
  // Lock reminder — flags any still-open games without a pick, and an
  // unanswered tiebreaker, every time the player lands on this week (not
  // just when a lock is imminent — that's a supplementary detail here,
  // not a gate on whether the reminder shows at all).
  function gpComputeLockReminder(games, myMap, tiebreakerEventId, myTiebreakerGuess, pendingTiebreakerGuess) {
    const now = Date.now();
    const list = Array.isArray(games) ? games : [];
    let missingCount = 0;
    let earliestMs = null;
    for (const g of list) {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) continue;
      const ms = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
      if (!ms || ms <= now) continue; // already locked or no kickoff time
      const hasPick = !!(myMap?.[eventId]?.side) || !!gpPendingGet(eventId);
      if (hasPick) continue;
      missingCount++;
      if (earliestMs == null || ms < earliestMs) earliestMs = ms;
    }

    let tiebreakerMissing = false;
    if (tiebreakerEventId) {
      const tbGame = list.find(g => String(g?.eventId || g?.id || "") === String(tiebreakerEventId));
      const tbMs = tbGame ? (tbGame?.startTime?.toMillis ? tbGame.startTime.toMillis() : 0) : 0;
      const tbLocked = tbMs > 0 && now >= tbMs;
      const hasGuess = myTiebreakerGuess != null || pendingTiebreakerGuess != null;
      if (!tbLocked && !hasGuess) tiebreakerMissing = true;
    }

    if (!missingCount && !tiebreakerMissing) return null;
    const minutesUntilLock = earliestMs != null ? Math.round((earliestMs - now) / 60000) : null;
    return { missingCount, tiebreakerMissing, minutesUntilLock };
  }

  // ───────────────────────────────────────────
  // Season standings — aggregate every published week in a league
  // Fully-final weeks are cached in localStorage forever (their result
  // can never change again); anything still live/upcoming is recomputed
  // fresh on every load.
  // ───────────────────────────────────────────
  function gpSeasonWeekCacheKey(weekId) {
    return `theShopGpSeasonWeekCache_v1_${weekId}`;
  }
  async function gpLoadSeasonLeaderboard(db, league) {
    const allWeeks = Array.isArray(league?.weeks) ? league.weeks : [];
    const published = allWeeks.filter(w => w?.published);
    const isH2H = league?.format === "h2h";

    // Every week's data is independent of every other week's, so fetch
    // them all at once instead of one at a time — sequentially, a season
    // with several not-yet-final weeks adds up fast enough (each week
    // does its own Firestore + ESPN round trips) to trip the page's hard
    // render timeout on a slow connection even though nothing is
    // actually stuck, just cumulatively slow.
    const weekResults = await Promise.all(published.map(async (w) => {
      const wid = String(w?.id || "");
      if (!wid) return null;
      const weekIndex = allWeeks.findIndex(x => String(x?.id) === wid);
      const cacheKey = gpSeasonWeekCacheKey(wid);
      let cached = null;
      try { cached = JSON.parse(localStorage.getItem(cacheKey) || "null"); } catch {}
      if (cached && cached.final) {
        return { weekId: wid, weekLabel: w.label, weekIndex, rows: cached.rows, finalsCount: cached.finalsCount, gamesCount: cached.finalsCount };
      }
      let games = [];
      try { games = await (Data().gpGetSlateGames || (async () => []))(db, wid); } catch {}
      if (!games.length) return null;

      let allPicks = {}, slateDoc = {}, tiebreakers = {};
      try {
        [, allPicks, slateDoc, tiebreakers] = await Promise.all([
          (ESPN().gpHydrateLiveStateForGames || (async () => {}))(games),
          (Data().gpEnsureAllPicksForWeek || (async () => ({})))(db, wid),
          (Data().gpGetSlateDoc || (async () => ({})))(db, wid),
          (Data().gpEnsureTiebreakersForWeek || (async () => ({})))(db, wid),
        ]);
      } catch {}

      const lb = (Data().gpComputeWeeklyLeaderboard || (() => ({ rows: [], finalsCount: 0 })))(
        games, allPicks, { atsEventIds: slateDoc?.atsEventIds, tiebreakers, tiebreakerEventId: slateDoc?.tiebreakerEventId }
      );

      const allFinal = games.length > 0 && lb.finalsCount === games.length;
      if (allFinal) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ final: true, rows: lb.rows, finalsCount: lb.finalsCount })); } catch {}
      }
      return { weekId: wid, weekLabel: w.label, weekIndex, rows: lb.rows, finalsCount: lb.finalsCount, gamesCount: games.length };
    }));

    const results = weekResults.filter(Boolean);
    if (isH2H) {
      return (Data().gpComputeH2HSeasonStandings || (() => ({ rows: [], weeksCount: 0 })))(results, league?.h2hSchedule);
    }
    return (Data().gpComputeSeasonLeaderboard || (() => ({ rows: [], weeksCount: 0 })))(results);
  }

  // ───────────────────────────────────────────
  // League selection helpers (which pick'em group is active)
  // ───────────────────────────────────────────
  function gpGetSelectedLeagueId() {
    return safeGetLS(PICKS_LEAGUE_KEY).trim();
  }
  function gpSetSelectedLeagueId(id) {
    safeSetLS(PICKS_LEAGUE_KEY, String(id || ""));
  }

  // ───────────────────────────────────────────
  // Week selection helpers (scoped per league — switching leagues
  // remembers where you left off in each one independently)
  // ───────────────────────────────────────────
  function gpGetSelectedWeekId(pickLeagueId, league) {
    const saved = safeGetLS(weekKeyForLeague(pickLeagueId)).trim();
    if (saved) return saved;
    return String(league?.activeWeekId || "");
  }
  function gpSetSelectedWeekId(pickLeagueId, id) {
    safeSetLS(weekKeyForLeague(pickLeagueId), String(id || ""));
  }

  // Finds the adjacent week's id for the pager arrows. Non-admins only
  // ever step through published weeks; admins can page through drafts too.
  function gpAdjacentWeekId(weeks, currentId, dir, isAdmin) {
    const list = Array.isArray(weeks) ? weeks : [];
    const visible = isAdmin ? list : list.filter(w => w?.published);
    const idx = visible.findIndex(w => String(w?.id) === String(currentId));
    if (idx === -1) return null;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= visible.length) return null;
    return String(visible[nextIdx].id);
  }

  // ───────────────────────────────────────────
  // postRender — wire up save-button state
  // ───────────────────────────────────────────
  function postRender() {
    syncSaveBtnState();
    // Never show Michigan's real name on the Picks page — admin picker,
    // committed game cards, leaderboard, everywhere.
    try {
      const el = document.getElementById("content");
      if (el && typeof window.replaceMichiganText === "function") {
        window.replaceMichiganText(el, "The Team Up North");
      }
    } catch {}
  }

  function syncSaveBtnState() {
    const btns = document.querySelectorAll('[data-gpaction="savePicks"]');
    const hasPending = gpPendingHasAny();
    btns.forEach(btn => { btn.disabled = !hasPending; });
  }

  // ───────────────────────────────────────────
  // Main renderer
  //
  // `loadingMode` picks which blip plays, matched to what's actually
  // about to render rather than to how the render was triggered:
  //   "light" — landing on the (cheap) league picker: fresh tab entry,
  //             the Leagues button, or a refresh while already there.
  //             Plays the 5s gif/joke blip.
  //   "heavy" — landing inside an actual league's week/season view,
  //             which fetches real games/picks data: selecting a
  //             league, or a refresh while already inside one. Plays
  //             the 4s "one more second" blip.
  //   falsy   — internal reload (save, week nav, admin actions) — no
  //             blip, renders straight through.
  // Either mode renders the real content into a detached scratch
  // element in parallel with its timer, then swaps it in once both are
  // done, so the blip is never on screen for less than its full time no
  // matter how fast the fetch is.
  //
  // renderPicksInto can hang (a stuck Firestore/auth/ESPN call somewhere
  // downstream never settling) rather than throw, which a plain
  // try/catch can't protect against — a hang there used to strand the
  // user on the blip forever, with no way out but switching tabs. A hard
  // timeout races against it so the blip always resolves to *something*
  // — real content, or a retry screen with a working refresh button.
  //
  // DOM order written:
  //   1. Header  (gpPageHeader — sticky)
  //   2. gpContainer
  //        a. League picker OR league settings form OR week content
  // ───────────────────────────────────────────
  const GP_LOADING_PHASE1_MS = 5000; // "light" — league picker
  const GP_LOADING_PHASE2_MS = 4000; // "heavy" — inside a league
  const GP_RENDER_TIMEOUT_MS = 15000;

  async function renderPicks(loadingMode, forceLeaguePicker) {
    const contentEl = document.getElementById("content");
    if (!contentEl) return;
    const opts = { forceLeaguePicker: !!forceLeaguePicker };

    if (!loadingMode) {
      await renderPicksInto(contentEl, opts);
      gpScheduleInactivityCheck();
      return;
    }

    const blipMs = loadingMode === "heavy" ? GP_LOADING_PHASE2_MS : GP_LOADING_PHASE1_MS;
    try {
      contentEl.innerHTML = (Render().gpBuildLoadingBlipHTML || (() => ""))(loadingMode === "heavy" ? 2 : 1);
    } catch {}

    const scratch = document.createElement("div");
    const started = Date.now();

    const renderTask = renderPicksInto(scratch, opts).catch((err) => {
      console.error("[GP] renderPicksInto failed:", err);
      scratch.innerHTML = gpBuildRetryScreenHTML("Something went wrong loading the picks page.");
    });
    let timedOut = false;
    const timeoutTask = new Promise((resolve) => setTimeout(resolve, GP_RENDER_TIMEOUT_MS))
      .then(() => { timedOut = true; });

    await Promise.race([renderTask, timeoutTask]);
    if (timedOut && !scratch.innerHTML) {
      scratch.innerHTML = gpBuildRetryScreenHTML("This is taking longer than expected.");
    }

    const remaining = blipMs - (Date.now() - started);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));

    contentEl.innerHTML = scratch.innerHTML;
    postRender();
    gpScheduleInactivityCheck();
  }

  // ── Inactivity: bounce back to the league picker after 15 idle
  //    minutes inside an actual league, so a forgotten-open tab doesn't
  //    just sit on stale data forever ──
  const GP_INACTIVITY_MS = 15 * 60 * 1000;
  let gpInactivityTimer = null;

  function gpScheduleInactivityCheck() {
    if (gpInactivityTimer) { clearTimeout(gpInactivityTimer); gpInactivityTimer = null; }
    if (window.__activeTab !== "picks") return;
    gpInactivityTimer = setTimeout(async () => {
      gpInactivityTimer = null;
      if (window.__activeTab !== "picks") return;
      const mem = gpMem();
      if (!mem.pickLeagueId || mem.gpShowLeaguePicker) return; // already on the picker
      mem.gpShowLeaguePicker = true;
      await renderPicks("light");
    }, GP_INACTIVITY_MS);
  }

  if (!window.__GP_INACTIVITY_BOUND) {
    window.__GP_INACTIVITY_BOUND = true;
    document.addEventListener("click", () => {
      if (window.__activeTab === "picks") gpScheduleInactivityCheck();
    }, true);
  }

  function gpBuildRetryScreenHTML(message) {
    const idObj = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
    const headerHTML = (Render().renderPicksHeaderHTML || (() => ""))({
      isAdmin: getRole() === "admin", showLeaguesBtn: false, playerName: idObj.name
    });
    const esc = typeof window.escapeHtml === "function" ? window.escapeHtml : String;
    return `${headerHTML}<div class="gpContainer"><div class="gpNotice">${esc(message)} Tap &#8635; above to try again.</div></div>`;
  }

  async function renderPicksInto(el, opts) {
    const forceLeaguePicker = !!opts?.forceLeaguePicker;

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
      const hdr = (Render().renderPicksHeaderHTML || (() => ""))({ isAdmin });
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

    // ── firebase ──
    let db;
    try {
      await (Data().ensureFirebaseReadySafe || (async () => {}))();
      db = firebase.firestore();
    } catch (err) {
      el.innerHTML = `<div class="gpContainer"><div class="gpNotice">Failed to connect: ${String(err?.message || err)}</div></div>`;
      return;
    }

    // ── league settings form (create or edit) — can be entered either
    //    from the picker or from within an active league ──
    if (mem.gpLeagueEditMode) {
      const isEdit = mem.gpLeagueEditMode === "edit";
      let league = null;
      if (isEdit) {
        try { league = await (Data().gpGetLeague || (async () => null))(db, mem.gpLeagueEditingId); } catch {}
      }
      let registeredPlayers = [];
      let leagueMembers = [];
      try {
        [registeredPlayers, leagueMembers] = await Promise.all([
          (Data().gpListRegisteredPlayers || (async () => []))(db),
          isEdit ? (Data().gpGetLeagueMembers || (async () => []))(db, mem.gpLeagueEditingId) : Promise.resolve([]),
        ]);
      } catch {}
      const headerHTML = (Render().renderPicksHeaderHTML || (() => ""))({
        leagueName: league?.name || "", isAdmin, showLeaguesBtn: !!gpGetSelectedLeagueId(), playerName: name
      });
      const formHTML = (Render().gpBuildLeagueSettingsHTML || (() => ""))({
        mode: isEdit ? "edit" : "create", league, registeredPlayers, leagueMembers
      });
      el.innerHTML = `${headerHTML}<div class="gpContainer">${formHTML}</div>`;
      postRender();
      return;
    }

    // ── league resolution ──
    const pickLeagueId = mem.pickLeagueId || gpGetSelectedLeagueId();
    const showPicker = forceLeaguePicker || !pickLeagueId || mem.gpShowLeaguePicker;

    if (showPicker) {
      const headerHTML = (Render().renderPicksHeaderHTML || (() => ""))({ isAdmin, showLeaguesBtn: false, showSaveBtn: false, playerName: name });
      let leagues = [];
      try { leagues = await (Data().gpListLeagues || (async () => []))(db); } catch {}
      const isActiveFn = Data().gpIsLeagueActive    || (async () => false);
      const membersFn  = Data().gpGetLeagueMembers  || (async () => []);
      try {
        const [activeFlags, memberLists] = await Promise.all([
          Promise.all(leagues.map(l => isActiveFn(db, l).catch(() => false))),
          Promise.all(leagues.map(l => membersFn(db, l.id).catch(() => []))),
        ]);
        leagues = leagues.map((l, i) => {
          const members = memberLists[i] || [];
          return { ...l, active: activeFlags[i], members, isMember: members.some(m => m.playerId === playerId) };
        });
      } catch {}
      // Stashed so the Join League overlay (opened from a card tap) can
      // reuse this same data instead of re-fetching it.
      mem.gpLeaguePickerLeagues = leagues;
      const pickerHTML = (Render().gpBuildLeaguePickerHTML || (() => ""))({ leagues, isAdmin });
      el.innerHTML = `${headerHTML}<div class="gpContainer">${pickerHTML}</div>`;
      postRender();
      return;
    }

    mem.pickLeagueId = pickLeagueId;

    // ── league doc ──
    let league = null;
    try { league = await (Data().gpGetLeague || (async () => null))(db, pickLeagueId); } catch {}
    if (!league) {
      // League vanished (deleted, or a stale/bad id) — fall back to the
      // picker, rendering into whatever target (real element or the
      // loading-blip scratch element) this call was already using.
      mem.pickLeagueId = "";
      gpSetSelectedLeagueId("");
      await renderPicksInto(el, opts);
      return;
    }

    const weeks = Array.isArray(league.weeks) ? league.weeks : [];
    mem.picksLeagueWeeksCache = weeks;

    // ── season view: cumulative standings across every published week ──
    if (mem.gpViewMode === "season") {
      const headerHTML  = (Render().renderPicksHeaderHTML || (() => ""))({
        leagueName: league.name, isAdmin, showLeaguesBtn: true, playerName: name
      });
      const toggleHTML  = (Render().gpBuildViewToggleHTML || (() => ""))("season");
      let seasonHTML = `<div class="gpNotice">Loading season standings…</div>`;
      el.innerHTML = `${headerHTML}<div class="gpContainer">${toggleHTML}${seasonHTML}</div>`;
      try {
        const seasonLB = await gpLoadSeasonLeaderboard(db, league);
        seasonHTML = league.format === "h2h"
          ? (Render().gpBuildH2HSeasonStandingsHTML || (() => ""))(seasonLB)
          : (Render().buildSeasonLeaderboardHTML || (() => ""))(seasonLB);
      } catch (err) {
        seasonHTML = `<div class="gpNotice">Couldn't load season standings: ${String(err?.message || err)}</div>`;
      }
      el.innerHTML = `${headerHTML}<div class="gpContainer">${toggleHTML}${seasonHTML}</div>`;
      postRender();
      return;
    }

    let selectedId = gpGetSelectedWeekId(pickLeagueId, league);
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
      // These six reads are independent of one another — fetching them
      // in parallel instead of one-at-a-time cuts total wait time from
      // the sum of all six round trips down to whichever is slowest,
      // which matters a lot on a weak connection (each sequential await
      // adds its own latency, and enough of them stacked up can trip the
      // page's hard render timeout on its own, with nothing actually
      // "stuck").
      try {
        [games, myMap, allPicks, slateDoc, tiebreakers, myPicksUserDoc] = await Promise.all([
          (Data().gpGetSlateGames         || (async () => []))(db, selectedId),
          (Data().gpGetMyPicksMap         || (async () => ({})))(db, selectedId, playerId),
          (Data().gpEnsureAllPicksForWeek || (async () => ({})))(db, selectedId),
          (Data().gpGetSlateDoc           || (async () => ({})))(db, selectedId),
          (Data().gpEnsureTiebreakersForWeek || (async () => ({})))(db, selectedId),
          (Data().gpGetMyPicksUserDoc     || (async () => ({})))(db, selectedId, playerId),
        ]);
      } catch {}
    }
    const atsEventIds       = Array.isArray(slateDoc?.atsEventIds) ? slateDoc.atsEventIds.map(String) : [];
    const tiebreakerEventId = String(slateDoc?.tiebreakerEventId || "");
    const myTiebreakerGuess = Number.isFinite(Number(myPicksUserDoc?.tiebreakerGuess))
      ? Number(myPicksUserDoc.tiebreakerGuess) : null;

    // ── hydrate live scores + odds ── (independent — different fields
    // on each game object, safe to run at the same time)
    if (games.length) {
      try {
        await Promise.all([
          (ESPN().gpHydrateLiveStateForGames || (async () => {}))(games),
          (ESPN().gpHydrateOddsForGames     || (async () => {}))(games),
        ]);
      } catch {}
    }

    // ── expose current state for player picks overlay ──
    window.__gpCurrentGames             = games;
    window.__gpCurrentAllPicks          = allPicks;
    window.__gpCurrentAtsEventIds       = atsEventIds;
    window.__gpCurrentTiebreakerEventId = tiebreakerEventId;
    window.__gpCurrentTiebreakers       = tiebreakers;

    // ── league announcements (admin-authored, top of the page) —
    //    a league saved before multi-announcement support only has the
    //    old singular `announcement` field; treat it as a 1-item list ──
    const announcementsList = Array.isArray(league.announcements)
      ? league.announcements
      : (league.announcement ? [league.announcement] : []);
    const announcementHTML = (Render().gpBuildLeagueAnnouncementsHTML || (() => ""))(announcementsList);

    // ── lock reminder (mine only) — missing picks + tiebreaker ──
    const lockReminder = gpComputeLockReminder(
      games, myMap, tiebreakerEventId, myTiebreakerGuess, gpPendingGetTiebreaker()
    );
    const lockReminderHTML = lockReminder ? (Render().gpBuildLockReminderHTML || (() => ""))(lockReminder) : "";

    // ── build HTML ──
    const headerHTML = (Render().renderPicksHeaderHTML || (() => ""))({
      leagueName: league.name, isAdmin, showLeaguesBtn: true, playerName: name
    });
    const toggleHTML = (Render().gpBuildViewToggleHTML || (() => ""))("week");
    const pagerHTML  = weeks.length ? (Render().gpBuildWeekPagerHTML || (() => ""))({
      weekLabel,
      isDraft:  !published && isAdmin,
      canPrev:  !!gpAdjacentWeekId(weeks, selectedId, -1, isAdmin),
      canNext:  !!gpAdjacentWeekId(weeks, selectedId, +1, isAdmin)
    }) : "";
    const cardsHTML = (Render().gpBuildGroupPicksCardHTML || (() => ""))({
      weekId: selectedId, weekLabel, games, myMap, published, allPicks, isAdmin,
      atsEventIds, tiebreakerEventId, tiebreakers,
      myTiebreakerGuess, pendingTiebreakerGuess: gpPendingGetTiebreaker(),
      lockReminder: lockReminderHTML,
      h2hFormat: league.format === "h2h", h2hSchedule: league.h2hSchedule,
      weekIndex: weeks.findIndex(w => String(w?.id) === selectedId)
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
        games, atsEventIds, tiebreakerEventId, pickLeagueId
      });
    }

    el.innerHTML = `${headerHTML}<div class="gpContainer">${announcementHTML}${toggleHTML}${pagerHTML}${adminBuilderHTML}${cardsHTML}</div>`;
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
          const bSide  = b.getAttribute("data-gppick");
          const active = bSide === side;
          // A game whose pick buttons are still clickable hasn't started,
          // so a freshly-tapped pick is always unresolved (neutral gray) —
          // never green/red, those only apply once the game goes final.
          b.classList.toggle("gpPickNeutral",    active);
          b.classList.remove("gpPickResultWin", "gpPickResultLoss");
          b.classList.toggle("gpFaded", !active);
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
      const pendingRaw = gpPendingBucket();
      let tbPending  = gpPendingGetTiebreaker();
      const idObj2   = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
      const playerId = idObj2.playerId || gpMem().picksPlayerId || "";

      if (!slateId)  { console.error("[GP] savePicks: no slateId");  return; }
      if (!playerId) { console.error("[GP] savePicks: no playerId"); return; }
      if (!Object.keys(pendingRaw).length && tbPending == null) return;

      // A pick can sit "pending" (chosen but not yet saved) for a while
      // before Save is tapped — if its game has since locked, Firestore
      // rejects that one write, and since every pending pick saves in a
      // single atomic batch, that one rejection takes every other
      // still-valid pick down with it (surfaces as a generic "Missing or
      // insufficient permissions" error, with nothing actually saved).
      // Drop anything that's locked before saving so the rest goes
      // through.
      const now = Date.now();
      const gamesById = new Map();
      for (const g of (window.__gpCurrentGames || [])) {
        const eid = String(g?.eventId || g?.id || "");
        if (eid) gamesById.set(eid, g);
      }
      function isLocked(eventId) {
        const g = gamesById.get(String(eventId));
        const ms = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
        return ms > 0 && now >= ms;
      }

      const pending = {};
      let droppedGames = 0;
      for (const [eventId, side] of Object.entries(pendingRaw)) {
        if (isLocked(eventId)) { droppedGames++; gpPendingDelete(eventId); continue; }
        pending[eventId] = side;
      }
      let droppedTiebreaker = false;
      if (tbPending != null && isLocked(window.__gpCurrentTiebreakerEventId)) {
        tbPending = null;
        droppedTiebreaker = true;
        gpPendingClearTiebreaker();
      }

      if (!Object.keys(pending).length && tbPending == null) {
        gpPendingClear();
        alert("Those picks locked before you could save them — nothing left to save. Refreshing to show the latest.");
        await renderPicks();
        return;
      }

      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        // Each pick (and the tiebreaker) is written independently now, so
        // one write Firestore rejects can't take the others down with it
        // the way a single atomic batch used to — this call reports
        // exactly which writes succeeded and which didn't, and why.
        const result = await (Data().gpSaveMyPicksBatch || (async () => ({ parent: null, games: {} })))(
          db2, slateId, playerId, pending, tbPending
        );

        const rejectedGames = [];
        for (const [eventId, r] of Object.entries(result.games || {})) {
          if (r?.ok) { gpPendingDelete(eventId); }
          else { rejectedGames.push({ eventId, error: r?.error || "unknown error" }); }
        }
        const parentRejected = result.parent && result.parent.ok === false;
        const tiebreakerSaved = tbPending != null && result.parent && result.parent.ok !== false;
        if (tiebreakerSaved) gpPendingClearTiebreaker();

        gpBustAllPicksCache(slateId);

        const lockedParts = [];
        if (droppedGames) lockedParts.push(`${droppedGames} pick${droppedGames !== 1 ? "s" : ""} locked before you saved`);
        if (droppedTiebreaker) lockedParts.push("the tiebreaker locked before you saved");

        const failedParts = [];
        if (rejectedGames.length) failedParts.push(`${rejectedGames.length} pick${rejectedGames.length !== 1 ? "s" : ""} couldn't save (${rejectedGames[0].error})`);
        if (parentRejected) {
          failedParts.push(tbPending != null
            ? `the tiebreaker couldn't save (${result.parent.error})`
            : `couldn't save (${result.parent.error})`);
        }

        if (lockedParts.length || failedParts.length) {
          btn.textContent = "Saved (see note)";
          const msgParts = [];
          if (lockedParts.length) msgParts.push(`${lockedParts.join(" and ")} — those are gone for good.`);
          if (failedParts.length) msgParts.push(`${failedParts.join("; ")} — still pending, so you can try Save again.`);
          setTimeout(() => alert(`Heads up — ${msgParts.join(" ")} Everything else saved fine.`), 50);
        } else {
          btn.textContent = "Saved!";
        }
        setTimeout(() => renderPicks(), 800);
      } catch (err) {
        btn.textContent = "Error — retry";
        btn.disabled = false;
        console.error("[GP] save error:", err);
        alert(`Couldn't save: ${String(err?.message || err)}`);
      }
      return;
    }

    // ── view toggle: this week / season ──
    if (action === "viewWeek" || action === "viewSeason") {
      gpMem().gpViewMode = action === "viewSeason" ? "season" : "week";
      await renderPicks();
      return;
    }

    // ── week pager: previous / next ──
    if (action === "weekPrev" || action === "weekNext") {
      const mem2 = gpMem();
      const pickLeagueId = mem2.pickLeagueId || gpGetSelectedLeagueId();
      const weeks = mem2.picksLeagueWeeksCache || [];
      const isAdmin = getRole() === "admin";
      const dir = action === "weekPrev" ? -1 : 1;
      const adjacentId = gpAdjacentWeekId(weeks, mem2.picksSlateId, dir, isAdmin);
      if (!pickLeagueId || !adjacentId) return;
      gpSetSelectedWeekId(pickLeagueId, adjacentId);
      gpPendingClear();
      await renderPicks();
      return;
    }

    // ── leagues: open the picker ──
    if (action === "showLeaguePicker") {
      const mem2 = gpMem();
      mem2.gpShowLeaguePicker = true;
      // Clear any in-progress league settings form — otherwise the
      // render gate for it takes priority over the picker and this
      // button silently does nothing.
      mem2.gpLeagueEditMode  = null;
      mem2.gpLeagueEditingId = "";
      await renderPicks("light");
      return;
    }

    // ── leagues: select one ──
    if (action === "selectLeague") {
      const leagueId = String(btn.getAttribute("data-leagueid") || "").trim();
      if (!leagueId) return;
      const mem2 = gpMem();
      mem2.pickLeagueId = leagueId;
      mem2.gpShowLeaguePicker = false;
      mem2.gpViewMode = "week";
      gpSetSelectedLeagueId(leagueId);
      gpPendingClear();
      await renderPicks("heavy");
      return;
    }

    // ── leagues: invite someone via the device's native share sheet ──
    if (action === "inviteToLeague") {
      const leagueName = String(btn.getAttribute("data-leaguename") || "our league").trim();
      const url = window.location.origin + window.location.pathname;
      const title = "Join my Pick’em League!";
      const text = `Welcome to The Shop! 🏈 I'm inviting you to join our "${leagueName}" Pick’em League. Tap the link below, enter 2026 as the Scarlet Key, head to the Pick’em page, and follow the steps from there to join the league. Let's go! 🏆`;

      if (navigator.share) {
        try {
          await navigator.share({ title, text, url });
        } catch (err) {
          // AbortError just means the player closed the share sheet — not an error.
          if (err?.name !== "AbortError") console.error("[GP] inviteToLeague share error:", err);
        }
        return;
      }

      // No native share sheet (e.g. desktop) — copy the whole invite to
      // the clipboard instead, same fallback pattern used elsewhere in
      // this app (see boot.js's debug-log copy button).
      const fullMessage = `${text}\n${url}`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(fullMessage)
          .then(() => alert("Invite message copied! Paste it anywhere to share."))
          .catch(() => prompt("Copy this invite message:", fullMessage));
      } else {
        prompt("Copy this invite message:", fullMessage);
      }
      return;
    }

    // ── leagues: show the "Join League" overlay for a league the
    //    player hasn't joined yet (uses the picker's already-fetched
    //    league + member data, no extra round trip) ──
    if (action === "openJoinOverlay") {
      const leagueId = String(btn.getAttribute("data-leagueid") || "").trim();
      if (!leagueId) return;
      const leagues = gpMem().gpLeaguePickerLeagues || [];
      const league  = leagues.find(l => String(l.id) === leagueId);
      if (!league) return;
      (Render().gpShowJoinLeagueOverlay || (() => {}))(league, league.members || []);
      return;
    }

    // ── leagues: confirm joining from inside the overlay ──
    if (action === "confirmJoinLeague") {
      const leagueId = String(btn.getAttribute("data-leagueid") || "").trim();
      if (!leagueId) return;
      const idObj2    = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
      const playerId  = idObj2.playerId || gpMem().picksPlayerId || "";
      const playerNm  = idObj2.name     || gpMem().picksName     || "";
      if (!playerId || !playerNm) return;

      const originalLabel = btn.innerHTML;
      btn.disabled = true; btn.textContent = "Joining…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        await (Data().gpJoinLeague || (async () => {}))(db2, leagueId, playerId, playerNm);
        (Render().gpDismissJoinLeagueOverlay || (() => {}))();

        const mem2 = gpMem();
        mem2.pickLeagueId = leagueId;
        mem2.gpShowLeaguePicker = false;
        mem2.gpViewMode = "week";
        gpSetSelectedLeagueId(leagueId);
        gpPendingClear();
        await renderPicks("heavy");
      } catch (err) {
        btn.disabled = false; btn.innerHTML = originalLabel;
        console.error("[GP] confirmJoinLeague error:", err);
      }
      return;
    }

    // ── leagues: open create form ──
    if (action === "createLeague") {
      const mem2 = gpMem();
      mem2.gpLeagueEditMode   = "create";
      mem2.gpLeagueEditingId  = "";
      await renderPicks();
      return;
    }

    // ── leagues: open edit-settings form ──
    if (action === "editLeague") {
      const leagueId = String(btn.getAttribute("data-leagueid") || "").trim();
      if (!leagueId) return;
      const mem2 = gpMem();
      mem2.gpLeagueEditMode  = "edit";
      mem2.gpLeagueEditingId = leagueId;
      await renderPicks();
      return;
    }

    // ── leagues: cancel the create/edit form ──
    if (action === "cancelLeagueSettings") {
      const mem2 = gpMem();
      mem2.gpLeagueEditMode  = null;
      mem2.gpLeagueEditingId = "";
      await renderPicks();
      return;
    }

    // ── leagues: submit create/edit form ──
    if (action === "submitLeagueSettings") {
      const leagueId = String(btn.getAttribute("data-leagueid") || "").trim();
      const nameEl       = document.getElementById("gpLeagueName");
      const yearEl       = document.getElementById("gpLeagueYear");
      const totalWeeksEl = document.getElementById("gpLeagueTotalWeeks");
      const archivedEl   = document.getElementById("gpLeagueArchived");
      const formatEl     = document.getElementById("gpLeagueFormat");
      const rosterEl     = document.getElementById("gpLeagueH2HRoster");
      const checkedPlayerNames = Array.from(document.querySelectorAll('[data-gp-h2h-player="1"]:checked'))
        .map(el => String(el.value || "").trim()).filter(Boolean);
      const name       = String(nameEl?.value || "").trim();
      const year       = Number(yearEl?.value || "");
      const totalWeeks = String(totalWeeksEl?.value || "").trim();
      const format     = String(formatEl?.value || "points").trim();
      const extraNames = String(rosterEl?.value || "").split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      const h2hRoster  = [...checkedPlayerNames, ...extraNames];
      const announcements = [0, 1, 2].map(i => ({
        title:   String(document.getElementById(`gpLeagueAnnouncementTitle${i}`)?.value || "").trim(),
        message: String(document.getElementById(`gpLeagueAnnouncementMessage${i}`)?.value || "").trim(),
      }));
      if (!name) { alert("Give the league a name first."); return; }

      btn.disabled = true; btn.textContent = "Saving…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        const mem2 = gpMem();
        if (leagueId) {
          await (Admin().gpUpdateLeagueSettings || (async () => {}))(db2, uid, leagueId, {
            name, seasonYear: year, totalWeeks,
            archived: archivedEl ? !!archivedEl.checked : undefined,
            format, h2hRoster, announcements
          });
        } else {
          const newId = await (Admin().gpCreateLeague || (async () => ""))(db2, uid, {
            name, seasonYear: year, totalWeeks, format, h2hRoster, announcements
          });
          // The admin creating a league is almost always a player in it
          // too — auto-join them so they don't hit their own "Join"
          // button the first time they open it.
          const myIdObj = (ID().gpGetIdentityFromStorageOrMem || (() => ({})))();
          const myPlayerId = myIdObj.playerId || gpMem().picksPlayerId || "";
          const myPlayerNm = myIdObj.name     || gpMem().picksName     || "";
          if (myPlayerId && myPlayerNm) {
            try { await (Data().gpJoinLeague || (async () => {}))(db2, newId, myPlayerId, myPlayerNm); } catch {}
          }
          mem2.pickLeagueId = newId;
          mem2.gpShowLeaguePicker = false;
          gpSetSelectedLeagueId(newId);
        }
        mem2.gpLeagueEditMode  = null;
        mem2.gpLeagueEditingId = "";
        await renderPicks();
      } catch (err) {
        btn.disabled = false; btn.textContent = leagueId ? "Save Settings" : "Create League";
        console.error("[GP] submitLeagueSettings error:", err);
      }
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

    // ── admin: save the week's against-the-spread games (up to 5) ──
    if (action === "adminSetAtsGames") {
      const weekId = String(btn.getAttribute("data-weekid") || "");
      if (!weekId) return;
      const checked  = document.querySelectorAll("[data-gpatscheck]:checked");
      const eventIds = [...checked].map(c => String(c.value));
      if (eventIds.length > 5) { alert("Pick at most 5 against-the-spread games."); return; }
      btn.disabled = true; btn.textContent = "Saving…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        await (Admin().gpAdminSetAtsGames || (async () => {}))(db2, uid, weekId, eventIds);
        await renderPicks();
      } catch (err) {
        btn.disabled = false; btn.textContent = "Save ATS Games";
        console.error("[GP] adminSetAtsGames error:", err);
      }
      return;
    }

    // ── refresh ── (light on the league picker, heavy inside a league)
    if (action === "refresh") {
      const mem2 = gpMem();
      const onPicker = !(mem2.pickLeagueId || gpGetSelectedLeagueId()) || mem2.gpShowLeaguePicker;
      await renderPicks(onPicker ? "light" : "heavy");
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
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        await (Data().gpRegisterPlayer || (async () => {}))(firebase.firestore(), pid, nm);
      } catch (err) {
        console.error("[GP] gpRegisterPlayer failed:", err);
      }
      // Logging in is a fresh entry into the app, same as switching to
      // the tab: show the light blip and land on the league picker
      // rather than jumping straight back into whatever league was
      // selected before logging out.
      await renderPicks("light", true);
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
        const hdr = (Render().renderPicksHeaderHTML || (() => ""))({ isAdmin: getRole() === "admin", playerName: idObj.name });
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

    // ── admin: create week (inside the current league) ──
    if (action === "adminCreateWeek") {
      const leagueId = String(btn.getAttribute("data-leagueid") || gpMem().pickLeagueId || "").trim();
      if (!leagueId) return;
      if (!confirm("Create a new week?")) return;
      btn.disabled = true; btn.textContent = "Creating…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        const newWeekId = await (Admin().gpAdminCreateNewWeekInLeague || (async () => ""))(db2, uid, leagueId);
        if (newWeekId) gpSetSelectedWeekId(leagueId, newWeekId);
        await renderPicks();
      } catch (err) {
        btn.disabled = false; btn.textContent = "+ New Week";
        console.error("[GP] adminCreateWeek error:", err);
      }
      return;
    }

    // ── admin: publish week ──
    if (action === "adminPublish") {
      const weekId   = String(btn.getAttribute("data-weekid") || "");
      const leagueId = String(btn.getAttribute("data-leagueid") || gpMem().pickLeagueId || "").trim();
      if (!weekId || !leagueId || !confirm(`Publish ${weekId}? Players will see it.`)) return;
      btn.disabled = true; btn.textContent = "Publishing…";
      try {
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db2 = firebase.firestore();
        const uid = firebase.auth().currentUser?.uid || "admin";
        await (Admin().gpAdminPublishWeek || (async () => {}))(db2, uid, leagueId, weekId);
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

    // League format selector — toggle the roster field without a full re-render
    if (t.getAttribute("data-gp-format-select") === "1") {
      const row = document.getElementById("gpLeagueH2HRosterRow");
      if (row) row.style.display = (t.value === "h2h") ? "" : "none";
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
