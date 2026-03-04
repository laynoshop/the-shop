/* split/groupPicks.js
   =========================
   GROUP PICKS (Weekly Multi-League Slate) — SINGLE SOURCE for Picks tab
   - Admin: create weeks (auto increment), set active week, add games from ANY league/day into that week, publish
   - Users: see active week by default, can select prior published weeks
   - Picks: home/away (single pick per game), then Save once (manual save)
   - Per-game lock (locks at game start)
   - NO UID UI
*/

(function () {
  "use strict";

  // -----------------------------
  // Storage keys / constants
  // -----------------------------
  const PICKS_NAME_KEY = "theShopPicksName_v1";
  const PICKS_WEEK_KEY = "theShopPicksWeek_v1"; // last selected week id
  const META_PUBLIC_DOC = "public";
  const META_ADMIN_DOC = "admin";

  // Picks Identity (Option A) — only for Picks tab
  const PICKS_PLAYER_CODE_KEY = "theShopPicksPlayerCode_v1";     // stored only if "remember" checked
  const PICKS_PLAYER_REMEMBER_KEY = "theShopPicksRemember_v1";   // "1" or "0"
  const PICKS_PLAYER_ID_KEY = "theShopPicksPlayerId_v1";         // cached computed id

  // -----------------------------
  // Safe helpers / fallbacks
  // -----------------------------
  function safeGetLS(key) {
    try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
  }
  function safeSetLS(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }
  function safeDelLS(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function esc(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
    const DATE_KEY = "theShopDate_v1"; // stores YYYYMMDD
    let saved = "";
    try { saved = String(localStorage.getItem(DATE_KEY) || "").trim(); } catch { saved = ""; }
    if (/^\d{8}$/.test(saved)) return saved;

    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${da}`;
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function weekIdFor(year, weekNum) {
    return `${year}_W${weekNum}`;
  }

  // -----------------------------
  // Picks Identity (Option A) — stable player id (name + code)
  // -----------------------------
  function gpMem() {
    window.__GP_MEM = window.__GP_MEM || {};
    return window.__GP_MEM;
  }

  function gpNormalizeName(s) {
    return String(s || "").trim().replace(/\s+/g, " ").slice(0, 20);
  }

  function gpNormalizeCode(s) {
    return String(s || "").trim().slice(0, 64);
  }

  function gpRememberDefault() {
    const v = safeGetLS(PICKS_PLAYER_REMEMBER_KEY).trim();
    if (v === "0") return false;
    if (v === "1") return true;
    return true; // default ON
  }

  function gpGetIdentityFromStorageOrMem() {
    const m = gpMem();
    const name = gpNormalizeName(safeGetLS(PICKS_NAME_KEY) || m.picksName || "");
    const remember = gpRememberDefault();

    let code = "";
    if (remember) code = gpNormalizeCode(safeGetLS(PICKS_PLAYER_CODE_KEY));
    else code = gpNormalizeCode(m.picksCode || "");

    let playerId = safeGetLS(PICKS_PLAYER_ID_KEY).trim() || String(m.picksPlayerId || "").trim();

    return { name, code, remember, playerId };
  }

  function gpSetIdentity({ name, code, remember, playerId }) {
    const m = gpMem();
    const nm = gpNormalizeName(name);
    const cd = gpNormalizeCode(code);
    const rem = !!remember;

    // Name is always stored (used in UI/leaderboard)
    if (nm) safeSetLS(PICKS_NAME_KEY, nm);

    // Remember toggle stored
    safeSetLS(PICKS_PLAYER_REMEMBER_KEY, rem ? "1" : "0");

    // Code: store only if remember
    if (rem) {
      if (cd) safeSetLS(PICKS_PLAYER_CODE_KEY, cd);
      else safeDelLS(PICKS_PLAYER_CODE_KEY);
      m.picksCode = "";
    } else {
      safeDelLS(PICKS_PLAYER_CODE_KEY);
      m.picksCode = cd;
    }

    // Cache playerId
    if (playerId) {
      safeSetLS(PICKS_PLAYER_ID_KEY, String(playerId));
      m.picksPlayerId = String(playerId);
    }
    m.picksName = nm;
  }

  function gpClearIdentity() {
    const m = gpMem();
    safeDelLS(PICKS_NAME_KEY);
    safeDelLS(PICKS_PLAYER_CODE_KEY);
    safeDelLS(PICKS_PLAYER_ID_KEY);
    safeSetLS(PICKS_PLAYER_REMEMBER_KEY, "1");
    m.picksName = "";
    m.picksCode = "";
    m.picksPlayerId = "";
  }

  async function gpComputePlayerId(name, code) {
    const nm = gpNormalizeName(name);
    const cd = gpNormalizeCode(code);
    const raw = `picks:v1:${nm.toLowerCase()}|${cd}`;

    try {
      if (window.crypto && crypto.subtle && typeof TextEncoder !== "undefined") {
        const bytes = new TextEncoder().encode(raw);
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        const arr = Array.from(new Uint8Array(hash));
        const hex = arr.slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
        return `p_${hex}`;
      }
    } catch {}

    let h = 5381;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
    const hex = (h >>> 0).toString(16).padStart(8, "0");
    return `p_${hex}_${raw.length}`;
  }

  function gpIsIdentityValid(idObj) {
    const nm = gpNormalizeName(idObj?.name || "");
    const cd = gpNormalizeCode(idObj?.code || "");
    return (nm.length >= 2 && cd.length >= 3);
  }

  function gpBuildIdentityGateHTML({ prefillName, rememberChecked }) {
    const nm = gpNormalizeName(prefillName || "");
    const rem = (rememberChecked !== false);

    return `
      <div class="game" style="
        margin-top:12px;
        padding:14px;
        border-radius:22px;
        background:rgba(255,255,255,0.06);
        border:1px solid rgba(255,255,255,0.08);
      ">
        <div class="gameHeader">
          <div class="statusPill status-other">PICKS IDENTITY</div>
        </div>

        <div class="gameMetaTopLine" style="margin-top:10px; font-weight:950;">
          Enter your name and a code
        </div>

        <div class="muted" style="margin-top:8px; font-weight:800;">
          Use the same name + code on any phone to be the same player.
        </div>

        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
          <div>
            <div class="muted" style="font-weight:900; margin-bottom:6px;">Display Name</div>
            <input
              id="gpIdName"
              type="text"
              inputmode="text"
              autocomplete="off"
              autocapitalize="words"
              spellcheck="false"
              value="${esc(nm)}"
              placeholder="Example: Victor"
              style="
                width:100%;
                box-sizing:border-box;
                padding:14px 14px;
                border-radius:16px;
                background:rgba(0,0,0,0.18);
                border:1px solid rgba(255,255,255,0.12);
                color:inherit;
                font-weight:850;
                font-size:16px;
                outline:none;
              "
            />
          </div>

          <div>
            <div class="muted" style="font-weight:900; margin-bottom:6px;">Player Code</div>
            <input
              id="gpIdCode"
              type="password"
              inputmode="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              placeholder="Make something you’ll remember"
              style="
                width:100%;
                box-sizing:border-box;
                padding:14px 14px;
                border-radius:16px;
                background:rgba(0,0,0,0.18);
                border:1px solid rgba(255,255,255,0.12);
                color:inherit;
                font-weight:850;
                font-size:16px;
                outline:none;
              "
            />
            <div class="muted" style="margin-top:6px; font-weight:800;">
              Tip: “buckeyes27” / “victor-1595” / etc.
            </div>
          </div>

          <label style="display:flex; align-items:center; gap:10px; margin-top:2px;">
            <input id="gpIdRemember" type="checkbox" ${rem ? "checked" : ""} />
            <span class="muted" style="font-weight:900;">Remember on this device</span>
          </label>

          <div style="display:flex; gap:10px; margin-top:6px;">
            <button class="smallBtn" type="button" data-gpaction="playerContinue" style="flex:0 0 auto;">Continue</button>
            <button class="smallBtn" type="button" data-gpaction="playerClear" style="flex:0 0 auto;">Clear</button>
          </div>

          <div id="gpIdErr" class="muted" style="margin-top:4px; font-weight:900;"></div>
        </div>
      </div>
    `;
  }

  function gpSetIdentityError(msg) {
    const el = document.getElementById("gpIdErr");
    if (el) el.textContent = String(msg || "");
  }

  // -----------------------------
  // Lazy-load "Everyone's Picks" + cache buckets
  // -----------------------------
  function gpGetAllPicksCacheBucket(weekId) {
    window.__GP_ALLPICKS_CACHE = window.__GP_ALLPICKS_CACHE || {};
    const k = String(weekId || "");
    if (!window.__GP_ALLPICKS_CACHE[k]) window.__GP_ALLPICKS_CACHE[k] = { ts: 0, data: null, promise: null };
    return window.__GP_ALLPICKS_CACHE[k];
  }

  async function gpEnsureAllPicksForWeek(db, weekId) {
    const k = String(weekId || "").trim();
    if (!k) return {};

    const bucket = gpGetAllPicksCacheBucket(k);
    const TTL = 2 * 60 * 1000; // 2 minutes

    const fresh = bucket.data && bucket.ts && (Date.now() - bucket.ts) < TTL;
    if (fresh) return bucket.data || {};

    if (bucket.promise) return bucket.promise;

    bucket.promise = (async () => {
      try {
        const data = await gpGetAllPicksForSlate(db, k);
        bucket.data = data || {};
        bucket.ts = Date.now();
        return bucket.data;
      } catch {
        bucket.data = {};
        bucket.ts = Date.now();
        return bucket.data;
      } finally {
        bucket.promise = null;
      }
    })();

    return bucket.promise;
  }

  function gpBuildEveryoneLinesForEvent({ everyoneArr, awayName, homeName }) {
    const arr = Array.isArray(everyoneArr) ? everyoneArr : [];
    if (!arr.length) return `<div class="muted">No picks yet.</div>`;

    return arr.map(p => {
      const nm = String(p?.name || "Someone");
      const side = String(p?.side || "");
      const team = (side === "away") ? (awayName || "—") : (side === "home" ? (homeName || "—") : "—");
      return `<div class="gpPickLine"><b>${esc(nm)}:</b> ${esc(team)}</div>`;
    }).join("");
  }

  if (!window.__GP_EVERYONE_TOGGLE_BOUND) {
    window.__GP_EVERYONE_TOGGLE_BOUND = true;

    document.addEventListener("toggle", (e) => {
      const details = e.target;
      if (!details || details.tagName !== "DETAILS") return;
      if (details.getAttribute("data-gpeveryone") !== "1") return;
      if (!details.open) return;

      (async () => {
        try {
          const weekId = String(details.getAttribute("data-weekid") || "").trim();
          const eventId = String(details.getAttribute("data-eid") || "").trim();
          if (!weekId || !eventId) return;

          const bodyId = `gpEveryone_${weekId}_${eventId}`;
          const bodyEl = document.getElementById(bodyId);
          if (!bodyEl) return;

          if (bodyEl.getAttribute("data-loaded") === "1") return;

          bodyEl.innerHTML = `<div class="muted">Loading…</div>`;

          await ensureFirebaseReadySafe();
          const db = firebase.firestore();

          const all = await gpEnsureAllPicksForWeek(db, weekId);
          const everyoneArr = Array.isArray(all?.[eventId]) ? all[eventId] : [];

          const awayName = String(details.getAttribute("data-away") || "Away");
          const homeName = String(details.getAttribute("data-home") || "Home");

          bodyEl.innerHTML = gpBuildEveryoneLinesForEvent({
            everyoneArr,
            awayName,
            homeName
          });

          bodyEl.setAttribute("data-loaded", "1");
        } catch (err) {
          console.error("Everyone's Picks lazy-load error:", err);
          try {
            const details = e.target;
            const weekId = String(details?.getAttribute("data-weekid") || "").trim();
            const eventId = String(details?.getAttribute("data-eid") || "").trim();
            const bodyId = `gpEveryone_${weekId}_${eventId}`;
            const bodyEl = document.getElementById(bodyId);
            if (bodyEl) bodyEl.innerHTML = `<div class="muted">Couldn’t load picks.</div>`;
          } catch {}
        }
      })();
    }, true);
  }

  // -----------------------------
  // Leagues (admin add-games tool)
  // -----------------------------
  const __LEAGUES_FALLBACK_FULL = [
    { key: "ncaam", name: "Men’s College Basketball", endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=50&limit=200` },
    { key: "nba",   name: "NBA",                    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}` },
    { key: "nhl",   name: "NHL",                    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}` },
    { key: "mls",   name: "MLS (Soccer)",           endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${date}` },
    { key: "nfl",   name: "NFL",                    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}` },
    { key: "cfb",   name: "College Football",       endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}` },
    { key: "mlb",   name: "MLB",                    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}` },
    { key: "pga",   name: "Golf (PGA)",             endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${date}` }
  ];

  function __getLeaguesFullList() {
    const g = Array.isArray(window.LEAGUES) ? window.LEAGUES : null;
    if (g && g.length && typeof g[0]?.endpoint === "function") return g;
    return __LEAGUES_FALLBACK_FULL;
  }

  function getLeagueByKeySafe(key) {
    if (typeof window.getLeagueByKey === "function") {
      const found = window.getLeagueByKey(key);
      if (found) return found;
    }
    const list = __getLeaguesFullList();
    const k = String(key || "").trim();
    return list.find(l => String(l.key) === k) || null;
  }

  function buildLeagueSelectHTMLSafe(selectedKey) {
    const leagues = __getLeaguesFullList();
    const sel = leagues.some(l => l.key === selectedKey) ? selectedKey : (leagues[0]?.key || "ncaam");
    const options = leagues.map(l => {
      const k = String(l.key || "");
      const nm = String(l.name || k);
      return `<option value="${esc(k)}"${k === sel ? " selected" : ""}>${esc(nm)}</option>`;
    }).join("");

    return `
      <select class="leagueSelect" aria-label="Choose league" data-gpadminleague="1">
        ${options}
      </select>
    `;
  }

  function buildCalendarButtonHTMLSafe() {
    const current = (() => {
      const s = String(getSavedDateYYYYMMDDSafe() || "");
      if (!/^\d{8}$/.test(s)) return "";
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    })();

    return `
      <span class="datePickerWrap" aria-label="Choose date">
        <button id="dateBtn" class="iconBtn" aria-label="Choose date" type="button">📅</button>
        <input
          id="nativeDateInput"
          class="nativeDateInput"
          type="date"
          value="${esc(current)}"
          aria-label="Choose date"
          data-gpadmindate="1"
        />
      </span>
    `;
  }

  async function fetchEventsFor(leagueKey, dateYYYYMMDD) {
    const league = getLeagueByKeySafe(leagueKey);
    if (!league) return [];
    const url = (typeof league.endpoint === "function") ? league.endpoint(dateYYYYMMDD) : "";
    if (!url) return [];
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return [];
      const j = await r.json().catch(() => ({}));
      return Array.isArray(j?.events) ? j.events : [];
    } catch {
      return [];
    }
  }

  // -----------------------------
  // ESPN live + odds hydration
  // -----------------------------
  function gpGetEventLiveInfoFromScoreboardEvent(ev) {
    try {
      const comp = ev?.competitions?.[0] || {};
      const st = comp?.status?.type || {};
      const state = String(st?.state || "").toLowerCase(); // pre | in | post
      const detail = String(st?.shortDetail || st?.detail || "").trim();

      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const homeC = competitors.find(c => c?.homeAway === "home") || {};
      const awayC = competitors.find(c => c?.homeAway === "away") || {};

      const homeScore = (homeC?.score != null) ? String(homeC.score) : "";
      const awayScore = (awayC?.score != null) ? String(awayC.score) : "";

      return { state, detail, homeScore, awayScore };
    } catch {
      return null;
    }
  }

  function gpYYYYMMDDFromStartTime(g) {
    try {
      const ms = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
      if (!ms) return "";
      const d = new Date(ms);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}${m}${da}`;
    } catch {
      return "";
    }
  }

  async function gpHydrateLiveStateForGames(games) {
    const list = Array.isArray(games) ? games : [];
    if (!list.length) return;

    const groups = new Map();
    for (const g of list) {
      const leagueKey = String(g?.leagueKey || "").trim();
      const dateYYYYMMDD = gpYYYYMMDDFromStartTime(g) || String(g?.dateYYYYMMDD || "").trim();
      const eventId = String(g?.eventId || g?.id || "").trim();
      if (!leagueKey || !dateYYYYMMDD || !eventId) continue;

      const k = `${leagueKey}__${dateYYYYMMDD}`;
      if (!groups.has(k)) groups.set(k, { leagueKey, dateYYYYMMDD, ids: new Set() });
      groups.get(k).ids.add(eventId);
    }
    if (!groups.size) return;

    const liveMap = new Map();

    for (const grp of groups.values()) {
      const league = getLeagueByKeySafe(grp.leagueKey);
      const url = (league && typeof league.endpoint === "function") ? league.endpoint(grp.dateYYYYMMDD) : "";
      if (!url) continue;

      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;

        const j = await r.json().catch(() => ({}));
        const events = Array.isArray(j?.events) ? j.events : [];
        for (const ev of events) {
          const eid = String(ev?.id || "");
          if (!eid || !grp.ids.has(eid)) continue;

          const info = gpGetEventLiveInfoFromScoreboardEvent(ev);
          if (info) liveMap.set(eid, info);
        }
      } catch {}
    }

    for (const g of list) {
      const eid = String(g?.eventId || g?.id || "").trim();
      g.__live = liveMap.get(eid) || null;
    }
  }

  function gpGetEventOddsFromScoreboardEvent(ev) {
    try {
      const comp = ev?.competitions?.[0] || {};
      const o = Array.isArray(comp?.odds) ? comp.odds[0] : null;
      if (!o) return null;

      const details = String(o?.details || "").trim();
      const overUnder = (o?.overUnder != null) ? String(o.overUnder).trim() : "";

      const homeFav = !!o?.homeTeamOdds?.favorite;
      const awayFav = !!o?.awayTeamOdds?.favorite;

      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const homeC = competitors.find(c => c?.homeAway === "home") || {};
      const awayC = competitors.find(c => c?.homeAway === "away") || {};

      const homeAbbr = String(homeC?.team?.abbreviation || homeC?.team?.shortDisplayName || "").trim();
      const awayAbbr = String(awayC?.team?.abbreviation || awayC?.team?.shortDisplayName || "").trim();

      const favoredTeam =
        homeFav ? (homeAbbr || "Home") :
        awayFav ? (awayAbbr || "Away") :
        "";

      if (!details && !overUnder) return null;
      return { details, overUnder, favoredTeam };
    } catch {
      return null;
    }
  }

  async function gpHydrateOddsForGames(games) {
    const list = Array.isArray(games) ? games : [];
    if (!list.length) return;

    const needs = list.filter(g => {
      const d = String(g?.oddsDetails || "").trim();
      const ou = String(g?.oddsOU || "").trim();
      return (!d && !ou);
    });
    if (!needs.length) return;

    const groups = new Map();
    for (const g of needs) {
      const leagueKey = String(g?.leagueKey || "").trim();
      const dateYYYYMMDD = gpYYYYMMDDFromStartTime(g) || String(g?.dateYYYYMMDD || "").trim();
      const eventId = String(g?.eventId || g?.id || "").trim();
      if (!leagueKey || !dateYYYYMMDD || !eventId) continue;

      const k = `${leagueKey}__${dateYYYYMMDD}`;
      if (!groups.has(k)) groups.set(k, { leagueKey, dateYYYYMMDD, ids: new Set() });
      groups.get(k).ids.add(eventId);
    }
    if (!groups.size) return;

    const oddsMap = new Map();

    for (const grp of groups.values()) {
      const league = getLeagueByKeySafe(grp.leagueKey);
      const url = (league && typeof league.endpoint === "function") ? league.endpoint(grp.dateYYYYMMDD) : "";
      if (!url) continue;

      try {
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) continue;

        const j = await r.json().catch(() => ({}));
        const events = Array.isArray(j?.events) ? j.events : [];
        for (const ev of events) {
          const eid = String(ev?.id || "");
          if (!eid || !grp.ids.has(eid)) continue;

          const odds = gpGetEventOddsFromScoreboardEvent(ev);
          if (odds) oddsMap.set(eid, odds);
        }
      } catch {}
    }

    for (const g of list) {
      const eid = String(g?.eventId || g?.id || "").trim();
      g.__odds = oddsMap.get(eid) || null;
    }
  }

  // -----------------------------
  // Firebase ready
  // -----------------------------
  async function ensureFirebaseReadySafe() {
    if (typeof window.ensureFirebaseChatReady === "function") return window.ensureFirebaseChatReady();
    if (window.firebase && window.FIREBASE_CONFIG && !firebase.apps?.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      try { await firebase.auth().signInAnonymously(); } catch {}
    }
  }

  function getPicksDisplayName() {
    const existingChat = (safeGetLS("theShopChatName_v1") || "").trim();
    if (existingChat) return existingChat.slice(0, 20);

    let name = (safeGetLS(PICKS_NAME_KEY) || "").trim();
    if (!name) name = "Anon";
    return String(name).trim().slice(0, 20);
  }

  function setPicksNameUI() {
    const btn = document.querySelector('[data-gpaction="name"]');
    if (btn) btn.textContent = "Name";
  }

  // -----------------------------
  // Firestore helpers
  // -----------------------------
  function metaRef(db, docId) {
    return db.collection("pickSlatesMeta").doc(String(docId));
  }

  async function gpGetMetaPublic(db) {
    const snap = await metaRef(db, META_PUBLIC_DOC).get();
    return snap.exists ? (snap.data() || {}) : {};
  }

  // -----------------------------
  // Picks model
  // -----------------------------
  function kickoffMsFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const iso = ev?.date || comp?.date || "";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function gpPrettyDateFromStartMs(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    const weekday = d.toLocaleDateString([], { weekday: "long" });
    const monthDay = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${weekday} ${monthDay}`;
  }

  function fmtKickoffFromMs(ms) {
    if (!ms) return "—";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  async function gpGetSlateGames(db, slateId) {
    const snap = await db.collection("pickSlates").doc(slateId).collection("games").get();
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    list.sort((a, b) => {
      const at = a?.startTime?.toMillis ? a.startTime.toMillis() : 0;
      const bt = b?.startTime?.toMillis ? b.startTime.toMillis() : 0;
      return at - bt;
    });

    return list;
  }

  async function gpGetMyPicksMap(db, slateId, playerId) {
    if (!playerId) return {};
    const snap = await db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(playerId)
      .collection("games").get();

    const map = {};
    snap.forEach(d => map[d.id] = d.data());
    return map;
  }

  async function gpGetAllPicksForSlate(db, slateId) {
    const out = {};
    const usersSnap = await db.collection("pickSlates").doc(slateId).collection("picks").get();
    const userDocs = usersSnap.docs || [];

    for (const u of userDocs) {
      const playerId = u.id;

      const gamesSnap = await db.collection("pickSlates").doc(slateId)
        .collection("picks").doc(playerId)
        .collection("games").get();

      gamesSnap.forEach(d => {
        const eventId = d.id;
        const data = d.data() || {};
        const name = String(data.name || (u.data()?.name || "Someone"));
        const side = String(data.side || "");

        if (!out[eventId]) out[eventId] = [];
        out[eventId].push({ uid: playerId, name, side }); // keep field name uid for compatibility
      });
    }

    Object.keys(out).forEach(eventId => {
      out[eventId].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    });

    return out;
  }

  async function gpSaveMyPicksBatch(db, slateId, playerId, pendingMap) {
    const keys = Object.keys(pendingMap || {});
    if (!keys.length) return;

    const picksUserRef = db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(playerId);

    const name = String(getPicksDisplayName() || "Someone").trim().slice(0, 20);
    const batch = db.batch();

    batch.set(picksUserRef, {
      uid: String(playerId || ""),
      name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    for (const eventId of keys) {
      const side = String(pendingMap[eventId] || "");
      const gameRef = picksUserRef.collection("games").doc(String(eventId));
      batch.set(gameRef, {
        uid: String(playerId || ""),
        name,
        side,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
  }

  // -----------------------------
  // Pending picks (manual save)
  // -----------------------------
  window.__GP_PENDING = window.__GP_PENDING || { sid: "", map: {} };

  function gpPendingResetIfSlateChanged(sid) {
    if (window.__GP_PENDING.sid !== sid) {
      window.__GP_PENDING.sid = sid;
      window.__GP_PENDING.map = {};
    }
  }

  function gpPendingCount() {
    const m = window.__GP_PENDING?.map || {};
    return Object.keys(m).length;
  }

  function gpPendingGet(eventId) {
    return String(window.__GP_PENDING?.map?.[eventId] || "");
  }

  function gpPendingSet(eventId, side) {
    if (!eventId) return;
    if (!window.__GP_PENDING) window.__GP_PENDING = { sid: "", map: {} };

    const s = String(side || "");
    if (!s) {
      delete window.__GP_PENDING.map[eventId];
      return;
    }
    window.__GP_PENDING.map[eventId] = s; // home | away
  }

  function gpPendingClear() {
    if (!window.__GP_PENDING) window.__GP_PENDING = { sid: "", map: {} };
    window.__GP_PENDING.map = {};
  }

  function gpUpdateSaveBtnUI() {
    const btns = Array.from(document.querySelectorAll('[data-gpaction="savePicks"]'));
    if (!btns.length) return;

    const n = gpPendingCount();
    for (const btn of btns) {
      btn.textContent = n ? `Save (${n})` : "Save";
      btn.disabled = !n;
    }
  }

  // -----------------------------
  // Week selector
  // -----------------------------
  function buildWeekSelectHTML(weeks, selectedWeekId) {
    const list = Array.isArray(weeks) ? weeks : [];

    const role = getRole();
    const isAdmin = (String(role) === "admin");

    const options = list.map(w => {
      const id = String(w?.id || "");
      const label = String(w?.label || id);
      const disabled = (!isAdmin && w?.published === false) ? " disabled" : "";
      const sel = (id === selectedWeekId) ? " selected" : "";
      return `<option value="${esc(id)}"${sel}${disabled}>${esc(label)}</option>`;
    }).join("");

    return `
      <select
        data-gpweeksel="1"
        style="
          -webkit-appearance:none;
          appearance:none;
          background:rgba(255,255,255,0.06);
          color:inherit;
          border:1px solid rgba(255,255,255,0.12);
          padding:12px 16px;
          border-radius:18px;
          font-weight:800;
          font-size:16px;
          line-height:1;
          min-width:110px;
          flex:0 0 auto;
        "
      >
        ${options || `<option value="${esc(selectedWeekId)}" selected>${esc(selectedWeekId)}</option>`}
      </select>
    `;
  }

  function getSelectedWeekFromLS() {
    return safeGetLS(PICKS_WEEK_KEY).trim();
  }

  function setSelectedWeekToLS(weekId) {
    safeSetLS(PICKS_WEEK_KEY, String(weekId || ""));
  }

  // -----------------------------
  // Admin actions
  // -----------------------------
  async function gpAdminCreateNewWeek(db, uid) {
    const y = currentYear();
    const adminRef = metaRef(db, META_ADMIN_DOC);
    const publicRef = metaRef(db, META_PUBLIC_DOC);

    await db.runTransaction(async (tx) => {
      const aSnap = await tx.get(adminRef);
      const pSnap = await tx.get(publicRef);

      const a = aSnap.exists ? (aSnap.data() || {}) : {};
      const p = pSnap.exists ? (pSnap.data() || {}) : {};

      const year = y;
      const cur = Number(a.currentWeek || 0);
      const nextWeek = Math.max(1, cur + 1);

      const newId = weekIdFor(year, nextWeek);
      const label = `Week ${nextWeek}`;

      const weeks = Array.isArray(p.weeks) ? [...p.weeks] : [];
      if (!weeks.some(w => String(w.id) === newId)) {
        weeks.push({ id: newId, label, published: false });
      }

      tx.set(adminRef, {
        year,
        currentWeek: nextWeek,
        activeWeekId: newId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });

      tx.set(publicRef, {
        year,
        activeWeekId: newId,
        weeks,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });

      tx.set(db.collection("pickSlates").doc(newId), {
        type: "week",
        year,
        weekNum: nextWeek,
        label,
        active: true,
        published: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
    });

    return true;
  }

  async function gpAdminSetActiveWeek(db, uid, weekId) {
    const publicRef = metaRef(db, META_PUBLIC_DOC);
    const adminRef = metaRef(db, META_ADMIN_DOC);
    const y = currentYear();

    await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(publicRef);
      const p = pSnap.exists ? (pSnap.data() || {}) : {};
      const weeks = Array.isArray(p.weeks) ? [...p.weeks] : [];

      if (!weeks.some(w => String(w.id) === String(weekId))) {
        weeks.push({ id: String(weekId), label: String(weekId), published: false });
      }

      tx.set(publicRef, {
        year: y,
        activeWeekId: String(weekId),
        weeks,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });

      tx.set(adminRef, {
        year: y,
        activeWeekId: String(weekId),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });

      tx.set(db.collection("pickSlates").doc(String(weekId)), {
        active: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
    });

    return true;
  }

  function pickLogo(teamObj) {
    const l1 = teamObj?.logo;
    const l2 = Array.isArray(teamObj?.logos) ? teamObj.logos[0]?.href : "";
    return String(l1 || l2 || "");
  }
  function pickRecord(competitor) {
    const recs = Array.isArray(competitor?.records) ? competitor.records : [];
    const total = recs.find(r => r?.type === "total") || recs[0];
    return String(total?.summary || "");
  }
  function pickRank(competitor, teamObj) {
    const r = competitor?.curatedRank?.current ?? competitor?.rank ?? teamObj?.rank ?? "";
    const n = Number(r);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function buildTeam(competitor) {
    const team = competitor?.team || {};
    return {
      id: String(team?.id || ""),
      name: String(team?.displayName || team?.name || ""),
      abbr: String(team?.abbreviation || ""),
      logo: pickLogo(team),
      record: pickRecord(competitor),
      rank: pickRank(competitor, team),
      homeAway: String(competitor?.homeAway || "")
    };
  }
  function buildVenueLine(comp) {
    const v = comp?.venue || {};
    const full = String(v?.fullName || "");
    const city = String(v?.address?.city || "");
    const state = String(v?.address?.state || "");
    const loc = [city, state].filter(Boolean).join(", ");
    if (full && loc) return `${full} - ${loc}`;
    return full || loc || "";
  }
  function buildOdds(comp, homeTeam, awayTeam) {
    // ESPN is inconsistent: odds may appear in comp.odds[0] OR comp.pickcenter[0]
    const homeName = String(homeTeam?.abbr || homeTeam?.name || "Home");
    const awayName = String(awayTeam?.abbr || awayTeam?.name || "Away");

    const pickFirst = (...vals) => {
      for (const v of vals) {
        if (v == null) continue;
        const s = String(v).trim();
        if (s) return s;
      }
      return "";
    };

    // 1) Try PickCenter (best for spreads/totals)
    const pc = Array.isArray(comp?.pickcenter) ? comp.pickcenter[0] : null;
    if (pc) {
      const ou = pickFirst(pc.overUnder, pc.total, pc.overunder, pc.over_under);
      let details = pickFirst(
        pc.details,
        pc.displayValue,
        pc.awayTeamOdds?.details,
        pc.homeTeamOdds?.details
      );

      let favoredTeam = "";
      const homeFav = !!pc.homeTeamOdds?.favorite;
      const awayFav = !!pc.awayTeamOdds?.favorite;

      if (homeFav) favoredTeam = homeName;
      else if (awayFav) favoredTeam = awayName;

      // If details isn't provided but spread exists, compute a clean details string
      if (!details) {
        const spreadNum = Number(pc.spread ?? pc.line ?? pc.handicap);
        if (Number.isFinite(spreadNum) && spreadNum !== 0) {
          // ESPN spreads: negative means home favored (usually), but we honor favorite flags first
          let favName = favoredTeam;
          if (!favName) favName = spreadNum < 0 ? homeName : awayName;
          const abs = Math.abs(spreadNum);
          const spreadVal = abs % 1 === 0 ? String(abs.toFixed(0)) : String(abs);
          details = `${favName} -${spreadVal}`;
          favoredTeam = favName;
        }
      }

      if (details || ou || favoredTeam) {
        return { details, overUnder: ou, favoredTeam };
      }
    }

    // 2) Fallback: comp.odds[0]
    const o = Array.isArray(comp?.odds) ? comp.odds[0] : null;
    if (!o) return { details: "", overUnder: "", favoredTeam: "" };

    const details = pickFirst(o?.details, o?.displayValue);
    const overUnder = (o?.overUnder != null) ? String(o.overUnder) : pickFirst(o?.total);

    // Favoring team hints (not always present)
    let favoredTeam = "";
    const homeFav = !!o?.homeTeamOdds?.favorite;
    const awayFav = !!o?.awayTeamOdds?.favorite;
    if (homeFav) favoredTeam = homeName;
    else if (awayFav) favoredTeam = awayName;

    return { details, overUnder, favoredTeam };
  }

  async function gpAdminAddSelectedGamesToWeek(db, uid, weekId, leagueKey, dateYYYYMMDD, selectedEventIds, events) {
  const slateRef = db.collection("pickSlates").doc(String(weekId));

  await slateRef.set({
    type: "week",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid
  }, { merge: true });

  for (const ev of (events || [])) {
    const eventId = String(ev?.id || "");
    if (!eventId) continue;
    if (!selectedEventIds.has(eventId)) continue;

    const comp = ev?.competitions?.[0] || {};
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const homeC = competitors.find(c => c?.homeAway === "home") || {};
    const awayC = competitors.find(c => c?.homeAway === "away") || {};

    const homeTeam = buildTeam(homeC);
    const awayTeam = buildTeam(awayC);

    const startMs = kickoffMsFromEvent(ev);
    const startTime = startMs ? firebase.firestore.Timestamp.fromMillis(startMs) : null;

    // ✅ Use the game’s REAL date (derived from kickoff), not the admin picker date
    const actualYYYYMMDD = (() => {
      if (!startMs) return String(dateYYYYMMDD || "");
      const d = new Date(startMs);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      return `${y}${m}${da}`;
    })();

    const venueLine = buildVenueLine(comp);
    const odds = buildOdds(comp, homeTeam, awayTeam);

    // Build payload defensively so we don't overwrite stored odds with blanks
    const gameDoc = {
      eventId,
      weekId: String(weekId),
      leagueKey: String(leagueKey || ""),

      // ✅ this is the field you were asking about
      dateYYYYMMDD: String(actualYYYYMMDD || ""),

      homeName: homeTeam.name || "Home",
      awayName: awayTeam.name || "Away",
      startTime,

      venueLine: String(venueLine || ""),
      homeTeam,
      awayTeam,

      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Only write odds fields if we actually have them (prevents wiping odds later)
    if (odds && String(odds.details || "").trim()) gameDoc.oddsDetails = String(odds.details).trim();
    if (odds && String(odds.overUnder || "").trim()) gameDoc.oddsOU = String(odds.overUnder).trim();
    if (odds && String(odds.favoredTeam || "").trim()) gameDoc.oddsFavored = String(odds.favoredTeam).trim();

    await slateRef.collection("games").doc(eventId).set(gameDoc, { merge: true });
  }
}

  async function gpAdminPublishWeek(db, uid, weekId) {
    const slateRef = db.collection("pickSlates").doc(String(weekId));
    await slateRef.set({
      published: true,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });

    const publicRef = metaRef(db, META_PUBLIC_DOC);
    await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(publicRef);
      const p = pSnap.exists ? (pSnap.data() || {}) : {};
      const weeks = Array.isArray(p.weeks) ? [...p.weeks] : [];
      const next = weeks.map(w => {
        if (String(w.id) === String(weekId)) return { ...w, published: true };
        return w;
      });
      tx.set(publicRef, {
        weeks: next,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
    });
  }

  // -----------------------------
  // Leaderboard (weekly)
  // -----------------------------
  function gpIsFinalGame(g) {
    const live = g?.__live || null;
    return !!live && String(live.state || "").toLowerCase() === "post";
  }

  function gpWinnerSideFromLive(g) {
    const live = g?.__live || null;
    if (!live) return "";
    const a = Number(live.awayScore);
    const h = Number(live.homeScore);
    if (!Number.isFinite(a) || !Number.isFinite(h)) return "";
    if (a === h) return "";
    return (a > h) ? "away" : "home";
  }

  function gpFavoredSideFromGame(g) {
    try {
      const away = g?.awayTeam || {};
      const home = g?.homeTeam || {};

      const hydFav = String(g?.__odds?.favoredTeam || "").trim();
      const storedFav = String(g?.oddsFavored || "").trim();
      const fav = (storedFav || hydFav || "").trim();

      const homeAbbr = String(home?.abbr || "").trim();
      const awayAbbr = String(away?.abbr || "").trim();

      if (fav && homeAbbr && fav.toLowerCase() === homeAbbr.toLowerCase()) return "home";
      if (fav && awayAbbr && fav.toLowerCase() === awayAbbr.toLowerCase()) return "away";
      return "";
    } catch {
      return "";
    }
  }

  function gpComputeWeeklyLeaderboard(games, allPicks) {
    const list = Array.isArray(games) ? games : [];
    const picksByEvent = allPicks && typeof allPicks === "object" ? allPicks : {};

    let finalsCount = 0;
    const users = new Map();

    for (const g of list) {
      const eventId = String(g?.eventId || g?.id || "").trim();
      if (!eventId) continue;

      if (!gpIsFinalGame(g)) continue;
      finalsCount++;

      const winner = gpWinnerSideFromLive(g);
      if (!winner) continue;

      const favoredSide = gpFavoredSideFromGame(g);
      const isUpset = !!favoredSide && winner !== favoredSide;

      const arr = Array.isArray(picksByEvent[eventId]) ? picksByEvent[eventId] : [];
      for (const p of arr) {
        const uid = String(p?.uid || "").trim();
        const name = String(p?.name || "Someone").trim();
        const side = String(p?.side || "").trim();
        if (!uid) continue;

        if (!users.has(uid)) {
          users.set(uid, { uid, name, picks: 0, wins: 0, losses: 0, points: 0 });
        }

        const u = users.get(uid);
        if (name) u.name = name;

        if (side === "home" || side === "away") {
          u.picks += 1;

          if (side === winner) {
            u.wins += 1;
            u.points += (isUpset ? 2 : 1);
          } else {
            u.losses += 1;
          }
        }
      }
    }

    const rows = Array.from(users.values());
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.picks !== a.picks) return b.picks - a.picks;
      return String(a.name).localeCompare(String(b.name));
    });

    return { rows, finalsCount };
  }

  function gpBuildLeaderboardHTML({ weekLabel, finalsCount, rows }) {
    const list = Array.isArray(rows) ? rows : [];

    if (!finalsCount) {
      return `
        <div class="gpLeaderCard" style="
          margin-top:12px;
          padding:14px;
          border-radius:22px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.08);
        ">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="font-weight:950;">Leaderboard</div>
            <div class="muted" style="font-weight:900;">${esc(String(weekLabel || ""))}</div>
          </div>
          <div class="muted" style="margin-top:8px; font-weight:800;">
            No finals yet — leaderboard will appear once games go final.
          </div>

          <div style="
            margin-top:12px;
            padding-top:12px;
            border-top:1px solid rgba(255,255,255,0.08);
          ">
            <div class="muted" style="font-weight:950;">How Points Awarded:</div>
            <div class="muted" style="margin-top:6px; font-weight:850;">2pts • Picking Underdog Winner</div>
            <div class="muted" style="margin-top:4px; font-weight:850;">1pt • Picking Favored Winner</div>
          </div>
        </div>
      `;
    }

    function medalForRank(rank) {
      if (rank === 1) return "🥇";
      if (rank === 2) return "🥈";
      if (rank === 3) return "🥉";
      return "";
    }

    function rowHTML(u, rank) {
      const top3 = rank <= 3;
      const medal = medalForRank(rank);

      return `
        <div style="
          display:flex;
          align-items:stretch;
          gap:12px;
          padding:12px;
          border-radius:18px;
          background:${top3 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"};
          border:1px solid ${top3 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"};
        ">
          <div style="
            flex:0 0 auto;
            min-width:54px;
            display:flex;
            flex-direction:column;
            justify-content:center;
            align-items:center;
            text-align:center;
          ">
            ${top3
              ? `<div style="font-weight:1000; font-size:36px; line-height:1;">${esc(medal)}</div>`
              : `<div style="font-weight:1000; font-size:22px; line-height:1; letter-spacing:0.2px; color:rgba(255,255,255,0.92);">${esc(String(rank))}</div>`
            }
          </div>

          <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div style="min-width:0;">
                <div style="
                  font-weight:${top3 ? "1000" : "950"};
                  font-size:${top3 ? "22px" : "20px"};
                  white-space:nowrap;
                  overflow:hidden;
                  text-overflow:ellipsis;
                ">
                  ${esc(String(u?.name || "Someone"))}
                </div>
                <div class="muted" style="margin-top:4px; font-weight:800; font-size:14px; opacity:0.85;">
                  Picks: ${esc(String(u?.picks ?? 0))} • W: ${esc(String(u?.wins ?? 0))} • L: ${esc(String(u?.losses ?? 0))}
                </div>
              </div>

              <div class="statusPill" style="
                background:rgba(0,200,120,0.18);
                border:1px solid rgba(0,200,120,0.35);
                color:rgba(180,255,220,0.95);
                white-space:nowrap;
                display:flex;
                align-items:baseline;
                gap:2px;
                padding:10px 14px;
              ">
                <span style="font-weight:1000; font-size:22px; line-height:1;">${esc(String(u?.points ?? 0))}</span>
                <span style="font-weight:900; font-size:12px; opacity:0.85;">pts</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    const body = list.length
      ? list.map((u, idx) => rowHTML(u, idx + 1)).join("")
      : `<div class="muted" style="margin-top:10px; font-weight:800;">No picks yet.</div>`;

    const footer = `
      <div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
        <div class="muted" style="font-weight:950;">How Points Awarded:</div>
        <div class="muted" style="margin-top:6px; font-weight:850;">2pts • Picking Underdog Winner</div>
        <div class="muted" style="margin-top:4px; font-weight:850;">1pt • Picking Favored Winner</div>
      </div>
    `;

    return `
      <div class="gpLeaderCard" style="
        margin-top:12px;
        padding:14px;
        border-radius:22px;
        background:rgba(255,255,255,0.06);
        border:1px solid rgba(255,255,255,0.08);
      ">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div style="font-weight:950;">Leaderboard</div>
          <div class="muted" style="font-weight:900;">${esc(String(weekLabel || ""))}</div>
        </div>

        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
          ${body}
        </div>

        ${footer}
      </div>
    `;
  }

  function gpApplyLeaderboardFromAllPicks({ weekId, weekLabel, games, allPicks }) {
    const host = document.getElementById("gpLeaderboard");
    if (!host) return;

    const lb = gpComputeWeeklyLeaderboard(games, allPicks || {});
    host.innerHTML = gpBuildLeaderboardHTML({
      weekLabel: weekLabel || weekId,
      finalsCount: lb.finalsCount,
      rows: lb.rows
    });
  }

  // -----------------------------
  // Rendering helpers (teams/odds)
  // -----------------------------
  function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function rankPrefix(rankVal) {
    const r = toNum(rankVal);
    if (!r) return "";
    if (r >= 1 && r <= 25) return `#${r} `;
    return "";
  }
  function safeTeamLabel(t) {
    const nm = String(t?.name || "").trim();
    const rk = rankPrefix(t?.rank);
    return (rk + nm).trim() || "Team";
  }
  function safeRecord(t) {
    const r = String(t?.record || "").trim();
    return r ? r : "";
  }
  function safeLogo(t) {
    return String(t?.logo || "").trim();
  }

  function fmtOddsLine(g) {
    const storedDetails = String(g?.oddsDetails || "").trim();
    const storedOU = String(g?.oddsOU || "").trim();

    const hyd = g?.__odds || null;
    const details = storedDetails || String(hyd?.details || "").trim();
    const ou = storedOU || String(hyd?.overUnder || "").trim();

    const parts = [];
    if (details) parts.push(`Favored: ${details}`);
    if (ou) parts.push(`O/U: ${ou}`);
    return parts.join(" • ");
  }

  function gpBuildGroupPicksCardHTML({ weekId, weekLabel, games, myMap, published, allPicks, isAdmin }) {
    if (!weekId) {
      return `
        <div class="game">
          <div class="gameHeader">
            <div class="statusPill status-other">GROUP PICKS</div>
          </div>
          <div class="gameMetaTopLine">No active week yet</div>
          <div class="gameMetaOddsLine">Waiting on admin to create Week 1.</div>
        </div>
      `;
    }

    if (!published && !isAdmin) {
      return `
        <div class="game">
          <div class="gameHeader">
            <div class="statusPill status-other">GROUP PICKS</div>
          </div>
          <div class="gameMetaTopLine" style="margin-top:8px; font-weight:900;">
            ${esc(weekLabel || weekId)} not published yet
          </div>
          <div class="muted" style="margin-top:8px; font-weight:800;">
            Waiting on admin.
          </div>
        </div>
      `;
    }

    const isDraft = (!published && !!isAdmin);
    const now = Date.now();

    // Prefer cached allPicks if available
    const cachedAll =
      (window.__GP_ALLPICKS_CACHE &&
        window.__GP_ALLPICKS_CACHE[weekId] &&
        window.__GP_ALLPICKS_CACHE[weekId].data) || null;

    const effectiveAllPicks =
      (allPicks && typeof allPicks === "object" && Object.keys(allPicks).length)
        ? allPicks
        : (cachedAll && typeof cachedAll === "object" ? cachedAll : {});

    const hasAllPicks = !!Object.keys(effectiveAllPicks).length;

    // Leaderboard placeholder/initial render
    let leaderboardHTML = "";
    if (!isDraft) {
      if (!hasAllPicks) {
        leaderboardHTML = `
          <div id="gpLeaderboard">
            <div class="gpLeaderCard" style="
              margin-top:12px;
              padding:14px;
              border-radius:22px;
              background:rgba(255,255,255,0.06);
              border:1px solid rgba(255,255,255,0.08);
            ">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                <div style="font-weight:950;">Leaderboard</div>
                <div class="muted" style="font-weight:900;">${esc(String(weekLabel || weekId || ""))}</div>
              </div>
              <div class="muted" style="margin-top:8px; font-weight:800;">
                Loading leaderboard…
              </div>
            </div>
          </div>
        `;
      } else {
        const lb = gpComputeWeeklyLeaderboard(games, effectiveAllPicks);
        leaderboardHTML = `
          <div id="gpLeaderboard">
            ${gpBuildLeaderboardHTML({
              weekLabel: weekLabel || weekId,
              finalsCount: lb.finalsCount,
              rows: lb.rows
            })}
          </div>
        `;
      }
    }

    function teamRowBtn({ side, t, logoUrl, extraSub, isActive, isFaded, lockedGame, eventId, scoreText }) {
      return `
        <button
          class="gpPickRowBtn ${isActive ? "gpPickRowActive" : ""} ${isFaded ? "gpFaded" : ""}"
          type="button"
          ${lockedGame ? "disabled" : ""}
          data-gppick="${esc(side)}"
          data-slate="${esc(weekId)}"
          data-eid="${esc(eventId)}"
          style="
            width:100%;
            display:flex;
            align-items:center;
            gap:12px;
            padding:12px;
            border-radius:16px;
            background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.10);
            text-align:left;
          "
        >
          <div style="
            width:44px; height:44px; border-radius:12px;
            background:rgba(255,255,255,0.06);
            border:1px solid rgba(255,255,255,0.08);
            display:flex; align-items:center; justify-content:center;
            overflow:hidden;
            flex:0 0 44px;
          ">
            ${logoUrl
              ? `<img src="${esc(logoUrl)}" alt="" style="width:34px;height:34px;object-fit:contain;" onerror="this.style.display='none'">`
              : ``
            }
          </div>

          <div style="flex:1; min-width:0;">
            <div style="font-weight:900; font-size:18px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${esc(safeTeamLabel(t))}
            </div>
            <div class="muted" style="margin-top:4px;">
              ${esc(extraSub || "")}${extraSub && safeRecord(t) ? " • " : ""}${esc(safeRecord(t))}
            </div>
          </div>

          ${scoreText !== "" ? `
            <div style="
              flex:0 0 auto;
              min-width:44px;
              text-align:right;
              font-weight:950;
              font-size:34px;
              line-height:1;
              letter-spacing:0.2px;
              color:rgba(255,255,255,0.92);
            ">
              ${esc(scoreText)}
            </div>
          ` : ``}
        </button>
      `;
    }

    const gameCards = (games || []).map(g => {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";

      const away = g?.awayTeam || { name: g?.awayName || "Away", rank: g?.awayRank, record: g?.awayRecord, logo: g?.awayLogo };
      const home = g?.homeTeam || { name: g?.homeName || "Home", rank: g?.homeRank, record: g?.homeRecord, logo: g?.homeLogo };

      const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
      const kickoffLabel = fmtKickoffFromMs(startMs);
      const kickoffDateLabel = gpPrettyDateFromStartMs(startMs);
      const lockedGame = startMs ? now >= startMs : false;

      const live = g.__live || null;
      const state = String(live?.state || "").toLowerCase();
      const isLive = state === "in";
      const isFinal = state === "post";

      const awayScore = (live && live.awayScore != null) ? String(live.awayScore) : "";
      const homeScore = (live && live.homeScore != null) ? String(live.homeScore) : "";

      let pillHTML = "";
      if (isLive || isFinal) {
        const pillText = isLive ? `LIVE • ${String(live?.detail || "").trim()}` : "FINAL";
        pillHTML = `
          <div class="statusPill" style="
            display:inline-flex;
            align-items:center;
            gap:8px;
            padding:10px 14px;
            border-radius:999px;
            width:100%;
            max-width:100%;
            box-sizing:border-box;
            background:${isLive ? "rgba(0,200,120,0.18)" : "rgba(255,255,255,0.10)"};
            border:1px solid ${isLive ? "rgba(0,200,120,0.35)" : "rgba(255,255,255,0.16)"};
            color:${isLive ? "rgba(180,255,220,0.95)" : "rgba(255,255,255,0.88)"};
            font-weight:950;
            letter-spacing:0.3px;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
          ">
            ${esc(pillText)}
          </div>
        `;
      }

      const pending = gpPendingGet(eventId);
      const saved = String(myMap?.[eventId]?.side || "");
      const my = pending || saved;

      const pickedTeam = (my === "away") ? (away?.name || "") : (my === "home" ? (home?.name || "") : "");
      const isPending = !!pending && pending !== saved;

      const venueLine = String(g?.venueLine || "").trim();
      const oddsLine = fmtOddsLine(g);

      const awayLogo = safeLogo(away);
      const homeLogo = safeLogo(home);

      const hasPick = !!my;
      const awayActive = my === "away";
      const homeActive = my === "home";
      const awayFade = hasPick && !awayActive;
      const homeFade = hasPick && !homeActive;

      const showScores = (isLive || isFinal) && awayScore !== "" && homeScore !== "";
      const awayScoreText = showScores ? awayScore : "";
      const homeScoreText = showScores ? homeScore : "";

      return `
        <div class="game gpMiniGameCard gpGameRow" data-saved="${esc(saved)}" style="
          margin-top:14px;
          padding:14px;
          border-radius:22px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.08);
        ">

          ${pillHTML ? `<div style="margin-bottom:10px;">${pillHTML}</div>` : ``}

          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div class="muted" style="font-weight:800;">
              ${venueLine ? esc(venueLine) : ""}
            </div>

            <div class="muted" style="white-space:nowrap; font-weight:900; text-align:right;">
              ${kickoffDateLabel ? `<div style="font-weight:800; line-height:1.05;">${esc(kickoffDateLabel)}</div>` : ``}
              <div style="line-height:1.05;">${esc(kickoffLabel)}</div>
            </div>
          </div>

          ${oddsLine
            ? `<div class="muted" style="margin-top:8px; font-weight:800;">${esc(oddsLine)}</div>`
            : `<div class="muted" style="margin-top:8px; font-weight:800;">Odds unavailable</div>`
          }

          <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
            ${teamRowBtn({ side: "away", t: away, logoUrl: awayLogo, extraSub: "Away", isActive: awayActive, isFaded: awayFade, lockedGame, eventId, scoreText: awayScoreText })}
            ${teamRowBtn({ side: "home", t: home, logoUrl: homeLogo, extraSub: "Home", isActive: homeActive, isFaded: homeFade, lockedGame, eventId, scoreText: homeScoreText })}
          </div>

          <div class="gpMetaRow" style="margin-top:10px; display:flex; justify-content:space-between; gap:10px; align-items:center;">
            ${my
              ? `<div class="gpYouPicked">✓ ${isPending ? "Pending" : "Your Pick"}: ${esc(pickedTeam)}</div>`
              : `<div class="muted">No pick yet</div>`
            }
            ${lockedGame ? `<div class="muted">Locked</div>` : ``}
          </div>

          <details
            class="gpEveryone"
            data-gpeveryone="1"
            data-weekid="${esc(weekId)}"
            data-eid="${esc(eventId)}"
            data-away="${esc(String(away?.name || "Away"))}"
            data-home="${esc(String(home?.name || "Home"))}"
            style="margin-top:10px;"
          >
            <summary class="gpEveryoneSummary">Everyone’s Picks</summary>
            <div id="gpEveryone_${esc(weekId)}_${esc(eventId)}" class="gpEveryoneBody">
              <div class="muted">Loading picks…</div>
            </div>
          </details>
        </div>
      `;
    }).join("");

    const saveRow = `
      <div class="gpSaveRow" style="margin-top:14px; display:flex; align-items:center; gap:10px;">
        <button class="smallBtn" data-gpaction="savePicks" type="button">Save</button>
        <div class="muted">(Saves your pending picks)</div>
      </div>
    `;

    return `
      <div class="game">
        <div class="gameHeader">
          <div class="statusPill status-other">GROUP PICKS</div>
          ${isDraft ? `
            <div class="statusPill" style="
              margin-left:10px;
              background:rgba(255,200,0,0.14);
              border:1px solid rgba(255,200,0,0.30);
              color:rgba(255,230,170,0.95);
              font-weight:950;
              white-space:nowrap;
            ">DRAFT</div>
          ` : ``}
        </div>

        <div class="gameMetaTopLine" style="margin-top:8px; font-weight:900;">
          ${esc(weekLabel || weekId)}
        </div>

        ${isDraft ? `
          <div class="muted" style="margin-top:8px; font-weight:850;">
            Draft mode — only admins can see this until you Publish Week.
          </div>
        ` : leaderboardHTML}

        <div id="gpGamesWrap">
          ${gameCards || `<div class="notice" style="margin-top:12px;">No games in this week.</div>`}
        </div>

        ${saveRow}
      </div>
    `;
  }

  // -----------------------------
  // Admin builder UI
  // -----------------------------
  function gpBuildAdminBuilderHTML({ weekId, weekLabel, leagueKey, dateYYYYMMDD, events }) {
    const now = Date.now();
    const sorted = [...(events || [])].sort((a, b) => kickoffMsFromEvent(a) - kickoffMsFromEvent(b));

    const isRankedLeague = (String(leagueKey || "").trim() === "cfb" || String(leagueKey || "").trim() === "ncaam");

    function top25Prefix(competitor) {
      if (!isRankedLeague) return "";
      const r = competitor?.curatedRank?.current ?? competitor?.rank ?? competitor?.team?.rank ?? "";
      const n = Number(r);
      if (Number.isFinite(n) && n >= 1 && n <= 25) return `#${n} `;
      return "";
    }

    function teamNameWithRank(competitor) {
      const t = competitor?.team || {};
      const name = String(t?.displayName || t?.name || "").trim() || "Team";
      return `${top25Prefix(competitor)}${name}`.trim();
    }

    const rows = sorted.map(ev => {
      const eventId = String(ev?.id || "");
      if (!eventId) return "";
      const comp = ev?.competitions?.[0];
      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const home = competitors.find(c => c.homeAway === "home");
      const away = competitors.find(c => c.homeAway === "away");

      const homeName = teamNameWithRank(home);
      const awayName = teamNameWithRank(away);

      const startMs = kickoffMsFromEvent(ev);
      const started = startMs ? (startMs <= now) : false;

      return `
        <div class="gpAdminRow">
          <label class="gpAdminLabel">
            <input type="checkbox" data-gpcheck="1" data-eid="${esc(eventId)}" />
            <span class="gpAdminText">${esc(awayName)} @ ${esc(homeName)}</span>
            <span class="muted gpAdminTime">${esc(fmtKickoffFromMs(startMs))}${started ? " • Started" : ""}</span>
          </label>
        </div>
      `;
    }).join("");

    return `
      <div class="game" data-gpadminwrap="1" data-weekid="${esc(weekId || "")}">
        <div class="gameHeader">
          <div class="statusPill status-other">ADMIN: WEEK BUILDER</div>
        </div>

        <div class="gameMetaTopLine">${esc(weekLabel || weekId || "Week")}</div>
        <div class="gameMetaOddsLine">Pick games from any league/day and add them into this week.</div>

        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${buildLeagueSelectHTMLSafe(leagueKey)}
          ${buildCalendarButtonHTMLSafe()}
          <button class="smallBtn" type="button" data-gpadmin="loadEvents">Load</button>
        </div>

        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="smallBtn" type="button" data-gpselect="all">Select All</button>
          <button class="smallBtn" type="button" data-gpselect="none">Select None</button>
          <button class="smallBtn" type="button" data-gpadmin="addSelected">Add Selected</button>
          <button class="smallBtn" type="button" data-gpadmin="publishWeek">Publish Week</button>
        </div>

        <div style="margin-top:10px;">
          ${rows || `<div class="notice">No games loaded yet (tap Load).</div>`}
        </div>

        <div class="muted" id="gpAdminStatus" style="margin-top:10px;"></div>
      </div>
    `;
  }

  function gpApplyAdminSelection(wrapEl, mode) {
    if (!wrapEl) return;
    const checks = Array.from(wrapEl.querySelectorAll('input[type="checkbox"][data-gpcheck="1"]'));
    const on = (mode === "all");
    for (const c of checks) c.checked = on;
  }

  // -----------------------------
  // Header / postRender
  // -----------------------------
  function renderPicksHeaderHTML({ role, weekSelectHTML, weekLabel, rightLabel }) {
    const isAdmin = role === "admin";

    return `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Picks</h2>
            <span class="badge">Group</span>
          </div>

          <div class="headerActions" style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
            <button class="smallBtn" data-gpaction="name">Name</button>
            <button class="smallBtn" data-gpaction="savePicks">Save</button>
            <button class="smallBtn" data-gpaction="refresh">Refresh</button>
          </div>
        </div>

        <div class="subline" style="display:block;">
          <div
            class="sublineLeft"
            style="
              display:flex;
              gap:10px;
              align-items:center;
              flex-wrap:nowrap;
              overflow-x:auto;
              -webkit-overflow-scrolling:touch;
              max-width:100%;
              padding-bottom:6px;
            "
          >
            <span style="flex:0 0 auto; display:inline-flex; align-items:center;">
              ${weekSelectHTML || ""}
            </span>

            ${isAdmin ? `
              <button class="smallBtn" data-gpadmin="newWeek" type="button" style="flex:0 0 auto;">New Week</button>
              <button class="smallBtn" data-gpadmin="setActive" type="button" style="flex:0 0 auto;">Set Active</button>
            ` : ""}
          </div>

          <div style="margin-top:4px; text-align:right; white-space:nowrap;">
            ${esc(weekLabel || "Week")} • ${esc(rightLabel || "")}
          </div>
        </div>
      </div>

      <style>
        select[data-gpweeksel="1"]{
          -webkit-appearance:none;
          appearance:none;
          background:rgba(255,255,255,0.06) !important;
          color:inherit !important;
          border:1px solid rgba(255,255,255,0.12) !important;
        }
      </style>
    `;
  }

  function postRender() {
    try { setPicksNameUI(); } catch {}
    try { gpUpdateSaveBtnUI(); } catch {}
    try { if (typeof window.replaceMichiganText === "function") setTimeout(() => window.replaceMichiganText(), 0); } catch {}
    try { if (typeof window.updateRivalryBanner === "function") window.updateRivalryBanner(); } catch {}
  }

  // -----------------------------
  // Main renderer
  // -----------------------------
  async function renderPicks(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;

    const role = getRole();
    const isAdmin = (role === "admin");
    const dbReady = ensureFirebaseReadySafe();

    if (showLoading) {
      content.innerHTML = `
        ${renderPicksHeaderHTML({ role, weekLabel: "Week", rightLabel: "Loading…", weekSelectHTML: "" })}
        <div class="notice">Loading picks…</div>
      `;
    }

    try {
      await dbReady;

      const user = firebase?.auth?.().currentUser;
      if (!user) {
        try { await firebase.auth().signInAnonymously(); } catch {}
      }

      const db = firebase.firestore();

      // Mandatory identity gate — ONLY for Picks page
      const ident = gpGetIdentityFromStorageOrMem();
      if (!gpIsIdentityValid(ident) || !String(ident.playerId || "").trim()) {
        content.innerHTML = `
          ${renderPicksHeaderHTML({ role, weekLabel: "Week", rightLabel: "Player", weekSelectHTML: "" })}
          ${gpBuildIdentityGateHTML({ prefillName: ident.name, rememberChecked: ident.remember })}
        `;
        postRender();
        setTimeout(() => { try { document.getElementById("gpIdName")?.focus(); } catch {} }, 0);
        return;
      }

      const playerId = String(ident.playerId || "").trim();

      const metaPub = await gpGetMetaPublic(db);
      const weeks = Array.isArray(metaPub.weeks) ? metaPub.weeks : [];
      const activeWeekId = String(metaPub.activeWeekId || "").trim();

      const publishedWeeks = weeks.filter(w => w && w.published === true);
      const latestPublishedWeekId = String(publishedWeeks[publishedWeeks.length - 1]?.id || "").trim();

      let showWeekId = "";

      if (!isAdmin) {
        const activeIsPublished =
          !!activeWeekId &&
          weeks.some(w => String(w.id) === activeWeekId && w.published === true);

        showWeekId = activeIsPublished ? activeWeekId : (latestPublishedWeekId || "");
      } else {
        const requested = getSelectedWeekFromLS();
        const requestedIsAllowed =
          !!requested &&
          weeks.some(w => String(w.id) === requested && (w.published === true || isAdmin));

        showWeekId = requestedIsAllowed ? requested : (activeWeekId || requested || "");
      }

      if (showWeekId) setSelectedWeekToLS(showWeekId);

      const wLabel =
        (weeks.find(w => String(w.id) === String(showWeekId))?.label) ||
        showWeekId ||
        "Week";

      let adminHTML = "";
      let adminEvents = [];
      const selectedLeagueKey = getSavedLeagueKeySafe();
      const selectedDate = getSavedDateYYYYMMDDSafe();

      if (isAdmin) {
        adminEvents = Array.isArray(window.__GP_ADMIN_EVENTS) ? window.__GP_ADMIN_EVENTS : [];
        adminHTML = gpBuildAdminBuilderHTML({
          weekId: showWeekId,
          weekLabel: wLabel,
          leagueKey: selectedLeagueKey,
          dateYYYYMMDD: selectedDate,
          events: adminEvents
        });
      }

      const weekOptions = isAdmin ? weeks : publishedWeeks;
      const weekSelectHTML = buildWeekSelectHTML(weekOptions, showWeekId || "");

      if (!showWeekId) {
        content.innerHTML = `
          ${renderPicksHeaderHTML({ role, weekSelectHTML, weekLabel: "Week", rightLabel: "Updated" })}
          ${adminHTML}
          ${gpBuildGroupPicksCardHTML({ weekId: "", weekLabel: "", games: [], myMap: {}, allPicks: {}, published: false, isAdmin })}
        `;
        postRender();
        return;
      }

      const slateRef = db.collection("pickSlates").doc(showWeekId);

      const [slateSnap, games, myMap] = await Promise.all([
        slateRef.get(),
        gpGetSlateGames(db, showWeekId),
        gpGetMyPicksMap(db, showWeekId, playerId)
      ]);

      const slateData = slateSnap.exists ? (slateSnap.data() || {}) : {};
      const published = (slateData.published === true);

      if (!published && !isAdmin) {
        const fallbackId = latestPublishedWeekId || "";
        if (fallbackId && fallbackId !== showWeekId) {
          setSelectedWeekToLS(fallbackId);
          renderPicks(true);
          return;
        }

        content.innerHTML = `
          ${renderPicksHeaderHTML({
            role,
            weekSelectHTML: buildWeekSelectHTML(publishedWeeks, latestPublishedWeekId || ""),
            weekLabel: wLabel,
            rightLabel: "Updated"
          })}
          ${gpBuildGroupPicksCardHTML({
            weekId: showWeekId,
            weekLabel: wLabel,
            games: [],
            myMap: {},
            allPicks: {},
            published: false,
            isAdmin
          })}
        `;
        postRender();
        return;
      }

      await Promise.all([
        gpHydrateLiveStateForGames(games),
        gpHydrateOddsForGames(games)
      ]);

      // FAST PATH: do NOT block initial render on everyone's picks
      const allPicks = {};

      gpPendingResetIfSlateChanged(showWeekId);
      window.__GP_PENDING.sid = showWeekId;

      content.innerHTML = `
        ${renderPicksHeaderHTML({
          role,
          weekSelectHTML,
          weekLabel: wLabel,
          rightLabel: published ? "Updated" : "Draft"
        })}
        ${adminHTML}
        ${gpBuildGroupPicksCardHTML({ weekId: showWeekId, weekLabel: wLabel, games, myMap, allPicks, published, isAdmin })}
      `;

      postRender();

      // Calendar button opens native date input (admin builder)
      try {
        const btn = document.getElementById("dateBtn");
        const input = document.getElementById("nativeDateInput");
        if (btn && input && !btn.__gpBound) {
          btn.__gpBound = true;
          btn.addEventListener("click", () => {
            try {
              if (typeof input.showPicker === "function") input.showPicker();
              else input.click();
            } catch { try { input.click(); } catch {} }
          });
        }
      } catch {}

      // Warm cache in the background + update leaderboard when it arrives (NO await)
      try {
        if (published) {
          const bucket = gpGetAllPicksCacheBucket(showWeekId);
          const TTL = 2 * 60 * 1000;
          const fresh = bucket.data && bucket.ts && (Date.now() - bucket.ts) < TTL;

          const gamesSnapshot = Array.isArray(games) ? games.slice() : [];
          const weekLabelSnapshot = String(wLabel || showWeekId);
          const weekIdSnapshot = String(showWeekId || "");

          if (fresh) {
            setTimeout(() => {
              try {
                if (String(window.__GP_PENDING?.sid || "") !== weekIdSnapshot) return;
                gpApplyLeaderboardFromAllPicks({
                  weekId: weekIdSnapshot,
                  weekLabel: weekLabelSnapshot,
                  games: gamesSnapshot,
                  allPicks: bucket.data || {}
                });
              } catch {}
            }, 0);
          } else if (!bucket.promise) {
            bucket.promise = gpGetAllPicksForSlate(db, weekIdSnapshot)
              .then((data) => {
                bucket.data = data || {};
                bucket.ts = Date.now();
                try {
                  if (String(window.__GP_PENDING?.sid || "") !== weekIdSnapshot) return bucket.data;
                  gpApplyLeaderboardFromAllPicks({
                    weekId: weekIdSnapshot,
                    weekLabel: weekLabelSnapshot,
                    games: gamesSnapshot,
                    allPicks: bucket.data || {}
                  });
                } catch {}
                return bucket.data;
              })
              .catch(() => {
                bucket.data = {};
                bucket.ts = Date.now();
                return bucket.data;
              })
              .finally(() => { bucket.promise = null; });
          }
        }
      } catch {}

    } catch (err) {
      console.error("renderPicks error:", err);
      content.innerHTML = `
        ${renderPicksHeaderHTML({ role: getRole(), weekSelectHTML: "", weekLabel: "Week", rightLabel: "Error" })}
        <div class="notice">Couldn’t load picks.</div>
      `;
      postRender();
    }
  }

  // Expose renderer used by shared tab router
  window.renderPicks = renderPicks;

  // -----------------------------
  // Click handling (delegated)
  // -----------------------------
  if (!window.__GP_CLICK_BOUND) {
    window.__GP_CLICK_BOUND = true;

    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;

      const act = btn.getAttribute("data-gpaction");

      if (act === "refresh") { renderPicks(true); return; }

      // Name button opens identity gate
      if (act === "name") {
        const content = document.getElementById("content");
        const role = getRole();
        const ident = gpGetIdentityFromStorageOrMem();
        if (content) {
          content.innerHTML = `
            ${renderPicksHeaderHTML({ role, weekLabel: "Week", rightLabel: "Player", weekSelectHTML: "" })}
            ${gpBuildIdentityGateHTML({ prefillName: ident.name, rememberChecked: ident.remember })}
          `;
          postRender();
          setTimeout(() => { try { document.getElementById("gpIdName")?.focus(); } catch {} }, 0);
        }
        return;
      }

      // Identity gate actions
      if (act === "playerClear") {
        gpClearIdentity();
        gpSetIdentityError("");
        renderPicks(true);
        return;
      }

      if (act === "playerContinue") {
        (async () => {
          try {
            const nm = gpNormalizeName(document.getElementById("gpIdName")?.value || "");
            const cd = gpNormalizeCode(document.getElementById("gpIdCode")?.value || "");
            const remember = !!document.getElementById("gpIdRemember")?.checked;

            if (nm.length < 2) { gpSetIdentityError("Name must be at least 2 characters."); return; }
            if (cd.length < 3) { gpSetIdentityError("Code must be at least 3 characters."); return; }

            gpSetIdentityError("Saving…");
            const pid = await gpComputePlayerId(nm, cd);
            gpSetIdentity({ name: nm, code: cd, remember, playerId: pid });

            gpSetIdentityError("");
            renderPicks(true);
          } catch (err) {
            console.error("playerContinue error:", err);
            gpSetIdentityError("Couldn’t save identity. Try again.");
          }
        })();
        return;
      }

      if (act === "savePicks") {
        ensureFirebaseReadySafe()
          .then(async () => {
            const db = firebase.firestore();

            const ident = gpGetIdentityFromStorageOrMem();
            if (!gpIsIdentityValid(ident) || !String(ident.playerId || "").trim()) {
              renderPicks(true);
              return;
            }

            const playerId = String(ident.playerId || "").trim();
            if (!playerId) throw new Error("No playerId");

            const slateId = String(window.__GP_PENDING?.sid || "");
            const pendingMap = window.__GP_PENDING?.map || {};
            const keys = Object.keys(pendingMap);

            if (!slateId || !keys.length) {
              gpUpdateSaveBtnUI();
              return;
            }

            await gpSaveMyPicksBatch(db, slateId, playerId, pendingMap);
            gpPendingClear();
          })
          .then(() => renderPicks(true))
          .catch((err) => {
            console.error("savePicks error:", err);
            const code = err?.code ? `\n\nCode: ${err.code}` : "";
            const msg = err?.message ? `\n${err.message}` : "";
            alert("Couldn’t save picks." + code + msg);
            gpUpdateSaveBtnUI();
          });
        return;
      }

      const gpSelect = btn.getAttribute("data-gpselect");
      if (gpSelect) {
        const wrap = btn.closest('[data-gpadminwrap="1"]');
        gpApplyAdminSelection(wrap, gpSelect);
        return;
      }

      const gpPick = btn.getAttribute("data-gppick");
      if (gpPick) {
        const eventId = btn.getAttribute("data-eid") || "";
        if (!eventId) return;
        if (btn.disabled) return;

        const cur = gpPendingGet(eventId);
        if (cur === gpPick) gpPendingSet(eventId, "");
        else gpPendingSet(eventId, gpPick);

        gpUpdateSaveBtnUI();

        const row = btn.closest(".gpGameRow");
        if (row) {
          const curPick = gpPendingGet(eventId) || String(row.getAttribute("data-saved") || "");
          const awayBtn = row.querySelector('button[data-gppick="away"]');
          const homeBtn = row.querySelector('button[data-gppick="home"]');

          const hasPick = !!curPick;
          const awayActive = curPick === "away";
          const homeActive = curPick === "home";

          if (awayBtn) {
            awayBtn.classList.toggle("gpPickRowActive", awayActive);
            awayBtn.classList.toggle("gpFaded", hasPick && !awayActive);
          }
          if (homeBtn) {
            homeBtn.classList.toggle("gpPickRowActive", homeActive);
            homeBtn.classList.toggle("gpFaded", hasPick && !homeActive);
          }
        }
        return;
      }

      const gpAdmin = btn.getAttribute("data-gpadmin");
      if (gpAdmin) {
        ensureFirebaseReadySafe()
          .then(async () => {
            const role = getRole();
            if (role !== "admin") { alert("Admin only."); return; }

            const db = firebase.firestore();
            const uid = firebase.auth().currentUser?.uid || "";
            if (!uid) throw new Error("No uid (not signed in)");

            const weekId = safeGetLS(PICKS_WEEK_KEY).trim();
            const statusEl = document.getElementById("gpAdminStatus");
            const wrap = btn.closest('[data-gpadminwrap="1"]');

            if (gpAdmin === "newWeek") {
              if (statusEl) statusEl.textContent = "Creating new week…";
              await gpAdminCreateNewWeek(db, uid);
              if (statusEl) statusEl.textContent = "New week created ✅";
              return;
            }

            if (gpAdmin === "setActive") {
              if (!weekId) { alert("No week selected."); return; }
              if (statusEl) statusEl.textContent = "Setting active week…";
              await gpAdminSetActiveWeek(db, uid, weekId);
              if (statusEl) statusEl.textContent = "Active week set ✅";
              return;
            }

            if (gpAdmin === "loadEvents") {
              const leagueEl = wrap?.querySelector('[data-gpadminleague="1"]');
              const dateEl = wrap?.querySelector('[data-gpadmindate="1"]');
              const leagueKey = String(leagueEl?.value || getSavedLeagueKeySafe()).trim();
              const dateVal = String(dateEl?.value || "").trim(); // YYYY-MM-DD
              const m = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              const dateYYYYMMDD = m ? `${m[1]}${m[2]}${m[3]}` : getSavedDateYYYYMMDDSafe();

              try { localStorage.setItem("theShopLeague_v1", leagueKey); } catch {}
              try { localStorage.setItem("theShopDate_v1", dateYYYYMMDD); } catch {}

              if (statusEl) statusEl.textContent = "Loading events…";
              const events = await fetchEventsFor(leagueKey, dateYYYYMMDD);
              window.__GP_ADMIN_EVENTS = events;
              if (statusEl) statusEl.textContent = `Loaded ${events.length} events ✅`;
              return;
            }

            if (gpAdmin === "addSelected") {
              if (!weekId) { alert("No week selected."); return; }

              const leagueEl = wrap?.querySelector('[data-gpadminleague="1"]');
              const dateEl = wrap?.querySelector('[data-gpadmindate="1"]');
              const leagueKey = String(leagueEl?.value || getSavedLeagueKeySafe()).trim();
              const dateVal = String(dateEl?.value || "").trim();
              const m = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              const dateYYYYMMDD = m ? `${m[1]}${m[2]}${m[3]}` : getSavedDateYYYYMMDDSafe();

              const checks = Array.from(wrap?.querySelectorAll('input[type="checkbox"][data-gpcheck="1"]') || []);
              const selected = new Set(
                checks.filter(c => c.checked)
                  .map(c => String(c.getAttribute("data-eid") || ""))
                  .filter(Boolean)
              );

              if (!selected.size) { alert("Select at least 1 game first."); return; }

              const events = Array.isArray(window.__GP_ADMIN_EVENTS) ? window.__GP_ADMIN_EVENTS : [];
              if (statusEl) statusEl.textContent = `Adding ${selected.size} game(s)…`;

              await gpAdminAddSelectedGamesToWeek(db, uid, weekId, leagueKey, dateYYYYMMDD, selected, events);

              if (statusEl) statusEl.textContent = "Games added ✅";
              return;
            }

            if (gpAdmin === "publishWeek") {
              if (!weekId) { alert("No week selected."); return; }
              if (statusEl) statusEl.textContent = "Publishing week…";
              await gpAdminPublishWeek(db, uid, weekId);
              if (statusEl) statusEl.textContent = "Week published ✅";
              return;
            }
          })
          .then(() => renderPicks(true))
          .catch((err) => {
            console.error("gpAdmin error:", err);
            const code = err?.code ? `\n\nCode: ${err.code}` : "";
            const msg = err?.message ? `\n${err.message}` : "";
            alert("Admin action failed." + code + msg);
          });

        return;
      }
    });

    document.addEventListener("change", (e) => {
      const sel = e.target;
      if (!sel || !sel.getAttribute) return;
      if (sel.getAttribute("data-gpweeksel") !== "1") return;

      const v = String(sel.value || "").trim();
      if (!v) return;
      setSelectedWeekToLS(v);
      renderPicks(true);
    });
  }

  // -----------------------------
  // Live score auto-refresh (SAFE)
  // - Updates ONLY #gpGamesWrap
  // - Avoids UI flicker while pending picks exist
  // - Skips for admins
  // -----------------------------
  if (!window.__GP_REFRESH_BOUND) {
    window.__GP_REFRESH_BOUND = true;

    let gpInterval = null;

    function stopGpAutoRefresh() {
      if (gpInterval) {
        clearInterval(gpInterval);
        gpInterval = null;
      }
    }

    function startGpAutoRefresh() {
      stopGpAutoRefresh();

      gpInterval = setInterval(async () => {
        try {
          const gamesWrap = document.getElementById("gpGamesWrap");
          if (!gamesWrap) return;

          if (window.__GP_PENDING && Object.keys(window.__GP_PENDING.map || {}).length) return;

          const ident = gpGetIdentityFromStorageOrMem();
          if (!gpIsIdentityValid(ident) || !String(ident.playerId || "").trim()) return;

          const role = getRole();
          if (String(role) === "admin") return;

          await ensureFirebaseReadySafe();

          const db = firebase.firestore();

          const weekId = (localStorage.getItem(PICKS_WEEK_KEY) || "").trim();
          if (!weekId) return;

          const slateSnap = await db.collection("pickSlates").doc(weekId).get();
          const slateData = slateSnap.exists ? (slateSnap.data() || {}) : {};
          if (!slateData.published) return;

          const games = await gpGetSlateGames(db, weekId);
          await gpHydrateLiveStateForGames(games);
          await gpHydrateOddsForGames(games);

          const playerId = String(ident.playerId || "").trim();
          const myMap = await gpGetMyPicksMap(db, weekId, playerId);

          const html = gpBuildGroupPicksCardHTML({
            weekId,
            weekLabel: String(slateData.label || weekId),
            games,
            myMap,
            allPicks: {},
            published: true,
            isAdmin: false
          });

          const temp = document.createElement("div");
          temp.innerHTML = html;
          const newWrap = temp.querySelector("#gpGamesWrap");
          if (newWrap) gamesWrap.innerHTML = newWrap.innerHTML;

          // Warm picks cache in background
          try {
            const bucket = gpGetAllPicksCacheBucket(weekId);
            const TTL = 2 * 60 * 1000;
            const fresh = bucket.data && bucket.ts && (Date.now() - bucket.ts) < TTL;
            if (!fresh && !bucket.promise) {
              bucket.promise = gpGetAllPicksForSlate(db, weekId)
                .then((data) => {
                  bucket.data = data || {};
                  bucket.ts = Date.now();
                  return bucket.data;
                })
                .catch(() => {
                  bucket.data = {};
                  bucket.ts = Date.now();
                  return bucket.data;
                })
                .finally(() => { bucket.promise = null; });
            }
          } catch {}

        } catch (err) {
          console.error("GP auto-refresh error:", err);
        }
      }, 30000);
    }

    startGpAutoRefresh();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopGpAutoRefresh();
      else startGpAutoRefresh();
    });
  }

})();