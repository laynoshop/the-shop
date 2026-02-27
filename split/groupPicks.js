/* split/groupPicks.js
   =========================
   GROUP PICKS (Pick'em Week) — SINGLE SOURCE for Picks tab
   - Weekly slate: Week 1, Week 2, ...
   - Mixed leagues in ONE week slate (NBA/NHL/NCAAM/etc)
   - Admin-only: league/date selectors + add games + week controls
   - Users: pick home/away (multi-pick), then Save once (manual save)
   - Users: see everyone’s picks
   - Per-game lock (default = game start; optional lockAt per game doc)
   - LIVE / FINAL pill + scores (from ESPN) while games are live/final
   - NO UID UI
   ========================= */

(function () {
  "use strict";

  // -----------------------------
  // Safe helpers / fallbacks
  // -----------------------------
  const PICKS_NAME_KEY = "theShopPicksName_v1";

  function safeGetLS(key) {
    try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
  }
  function safeSetLS(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
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
    return safeGetLS("theShopLeague_v1").trim() || "nfl";
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

  function yyyymmddToPrettySafe(yyyymmdd) {
    if (typeof window.yyyymmddToPretty === "function") return window.yyyymmddToPretty(yyyymmdd);
    const s = String(yyyymmdd || "");
    if (s.length !== 8) return s;
    const y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
    const dt = new Date(y, m, d);
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function fmtKickoff(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  // -----------------------------
  // ✅ LEAGUE SELECT + ESPN EVENTS
  // -----------------------------
  const __LEAGUES_FALLBACK_FULL = [
    {
      key: "ncaam",
      name: "Men’s College Basketball",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=50&limit=200`
    },
    {
      key: "cfb",
      name: "College Football",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}`
    },
    {
      key: "nba",
      name: "NBA",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`
    },
    {
      key: "nhl",
      name: "NHL",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}`
    },
    {
      key: "nfl",
      name: "NFL",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}`
    },
    {
      key: "mlb",
      name: "MLB",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`
    },
    {
      key: "pga",
      name: "Golf (PGA)",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${date}`
    }
  ];

  function __getLeaguesFullList() {
    const g = Array.isArray(window.LEAGUES) ? window.LEAGUES : null;
    if (g && g.length && typeof g[0]?.endpoint === "function") return g;
    return __LEAGUES_FALLBACK_FULL;
  }

  function __coerceValidLeagueKey(k) {
    const list = __getLeaguesFullList();
    const wanted = String(k || "").trim();
    if (wanted && list.some(l => String(l.key) === wanted)) return wanted;
    return list[0] ? String(list[0].key) : "nfl";
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
    if (typeof window.buildLeagueSelectHTML === "function") {
      return window.buildLeagueSelectHTML(selectedKey);
    }

    const LEAGUE_KEY = "theShopLeague_v1";
    function saveLeagueKeyLocal(k) {
      try { localStorage.setItem(LEAGUE_KEY, String(k)); } catch {}
    }

    if (typeof window.handleLeagueChangeFromEl !== "function") {
      window.handleLeagueChangeFromEl = function (el) {
        const v = String(el?.value || "").trim();
        if (!v) return;

        if (typeof window.saveLeagueKey === "function") window.saveLeagueKey(v);
        else saveLeagueKeyLocal(v);

        if (typeof window.showTab === "function") window.showTab("picks");
        else if (typeof window.renderPicks === "function") window.renderPicks(true);
      };
    }

    const leagues = __getLeaguesFullList();
    const sel = __coerceValidLeagueKey(selectedKey);

    if (String(selectedKey || "") !== sel) {
      if (typeof window.saveLeagueKey === "function") window.saveLeagueKey(sel);
      else saveLeagueKeyLocal(sel);
    }

    const options = leagues.map(l => {
      const k = String(l.key || "");
      const nm = String(l.name || k);
      return `<option value="${esc(k)}"${k === sel ? " selected" : ""}>${esc(nm)}</option>`;
    }).join("");

    return `
      <select class="leagueSelect" aria-label="Choose league" onchange="handleLeagueChangeFromEl(this)">
        ${options}
      </select>
    `;
  }

  function buildCalendarButtonHTMLSafe() {
    if (typeof window.buildCalendarButtonHTML === "function") return window.buildCalendarButtonHTML();

    const DATE_KEY = "theShopDate_v1";

    function yyyymmddToInputValue(yyyymmdd) {
      const s = String(yyyymmdd || "");
      if (!/^\d{8}$/.test(s)) return "";
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }

    function inputValueToYYYYMMDD(v) {
      const s = String(v || "").trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return "";
      return `${m[1]}${m[2]}${m[3]}`;
    }

    if (typeof window.handleNativeDateChangeFromEl !== "function") {
      window.handleNativeDateChangeFromEl = function (el) {
        const v = el?.value || "";
        const yyyymmdd = inputValueToYYYYMMDD(v);
        if (!yyyymmdd) return;

        if (typeof window.saveDateYYYYMMDD === "function") {
          window.saveDateYYYYMMDD(yyyymmdd);
        } else {
          try { localStorage.setItem(DATE_KEY, yyyymmdd); } catch {}
        }

        if (typeof window.showTab === "function") window.showTab("picks");
        else if (typeof window.renderPicks === "function") window.renderPicks(true);
      };
    }

    const current = yyyymmddToInputValue(getSavedDateYYYYMMDDSafe());

    return `
      <span class="datePickerWrap" aria-label="Choose date">
        <button id="dateBtn" class="iconBtn" aria-label="Choose date" type="button">📅</button>
        <input
          id="nativeDateInput"
          class="nativeDateInput"
          type="date"
          value="${esc(current)}"
          aria-label="Choose date"
          onchange="handleNativeDateChangeFromEl(this)"
          oninput="handleNativeDateChangeFromEl(this)"
        />
      </span>
    `;
  }

  // Debug bucket (kept for console)
  window.__GP_LAST_FETCH_DEBUG = "";

  async function fetchEventsFor(leagueKey, dateYYYYMMDD) {
    const league = getLeagueByKeySafe(leagueKey);
    if (!league) {
      window.__GP_LAST_FETCH_DEBUG = `No league found for key: ${leagueKey}`;
      return [];
    }

    if (typeof window.fetchScoreboardWithFallbacks === "function") {
      try {
        const sb = await window.fetchScoreboardWithFallbacks(league, dateYYYYMMDD);
        const events = Array.isArray(sb?.events) ? sb.events : [];
        window.__GP_LAST_FETCH_DEBUG = `fetchScoreboardWithFallbacks ok • events=${events.length}`;
        return events;
      } catch (e) {
        window.__GP_LAST_FETCH_DEBUG = `fetchScoreboardWithFallbacks failed: ${String(e?.message || e)}`;
      }
    }

    const url = (typeof league.endpoint === "function") ? league.endpoint(dateYYYYMMDD) : "";
    if (!url) {
      window.__GP_LAST_FETCH_DEBUG = `League endpoint missing for ${leagueKey}`;
      return [];
    }

    try {
      const r = await fetch(url, { cache: "no-store" });
      const status = `${r.status} ${r.statusText || ""}`.trim();
      if (!r.ok) {
        window.__GP_LAST_FETCH_DEBUG = `Direct ESPN fetch not ok • ${status} • ${url}`;
        return [];
      }
      const j = await r.json().catch(() => ({}));
      const events = Array.isArray(j?.events) ? j.events : [];
      window.__GP_LAST_FETCH_DEBUG = `Direct ESPN fetch ok • ${status} • events=${events.length}`;
      return events;
    } catch (e) {
      window.__GP_LAST_FETCH_DEBUG = `Direct ESPN fetch threw: ${String(e?.message || e)}`;
      return [];
    }
  }

  // -----------------------------
  // Firebase safe init
  // -----------------------------
  async function ensureFirebaseReadySafe() {
    if (typeof window.ensureFirebaseChatReady === "function") return window.ensureFirebaseChatReady();
    if (window.firebase && window.FIREBASE_CONFIG && !firebase.apps?.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      try { await firebase.auth().signInAnonymously(); } catch {}
    }
  }

  function getPicksDisplayName() {
    const existingChat = (safeGetLS("shopChatName") || "").trim();
    if (existingChat) return existingChat.slice(0, 20);

    let name = (safeGetLS(PICKS_NAME_KEY) || "").trim();
    if (!name) {
      const picked = prompt("Name for Picks (example: Victor):", "") || "";
      name = String(picked).trim() || "Anon";
      safeSetLS(PICKS_NAME_KEY, name.slice(0, 20));
    }
    return name.slice(0, 20);
  }

  function setPicksNameUI() {
    const btn = document.querySelector('[data-gpaction="name"]');
    if (btn) btn.textContent = "Name";
  }

  // -----------------------------
  // WEEK MODEL (Firestore)
  // -----------------------------
    const GPW = {
    metaDoc: "meta",
    currentDoc: "current",
    weekPrefix: "week_",
    // IMPORTANT: use existing collection to match current Firestore rules
    coll: "pickSlates"
  };

  function isWeekId(id) {
    const s = String(id || "");
    return /^week_\d+$/.test(s);
  }

  async function gpEnsureWeekInfra(db) {
    const metaRef = db.collection(GPW.coll).doc(GPW.metaDoc);
    const curRef = db.collection(GPW.coll).doc(GPW.currentDoc);

    const [metaSnap, curSnap] = await Promise.all([metaRef.get(), curRef.get()]);

    if (!metaSnap.exists) {
      await metaRef.set({
        nextWeekNumber: 1,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    if (!curSnap.exists) {
      await curRef.set({
        activeWeekId: "",
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  async function gpGetActiveWeekId(db) {
    const curRef = db.collection(GPW.coll).doc(GPW.currentDoc);
    const snap = await curRef.get();
    const v = snap.exists ? String(snap.data()?.activeWeekId || "") : "";
    return isWeekId(v) ? v : "";
  }

  async function gpCreateNewWeekAndSetCurrent(db, uid) {
    const metaRef = db.collection(GPW.coll).doc(GPW.metaDoc);
    const curRef = db.collection(GPW.coll).doc(GPW.currentDoc);

    const metaSnap = await metaRef.get();
    const nextNum = Number(metaSnap.data()?.nextWeekNumber || 1);
    const weekNum = (Number.isFinite(nextNum) && nextNum > 0) ? nextNum : 1;
    const weekId = `${GPW.weekPrefix}${weekNum}`;

    const weekRef = db.collection(GPW.coll).doc(weekId);

    await weekRef.set({
      weekNumber: weekNum,
      label: `Week ${weekNum}`,
      published: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: uid || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid || ""
    }, { merge: true });

    await curRef.set({
      activeWeekId: weekId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid || ""
    }, { merge: true });

    await metaRef.set({
      nextWeekNumber: weekNum + 1,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid || ""
    }, { merge: true });

    return weekId;
  }

  async function gpSetWeekPublished(db, weekId, uid, publishBool) {
    const weekRef = db.collection(GPW.coll).doc(weekId);
    await weekRef.set({
      published: !!publishBool,
      publishedAt: publishBool ? firebase.firestore.FieldValue.serverTimestamp() : null,
      publishedBy: publishBool ? (uid || "") : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid || ""
    }, { merge: true });
  }

  // -----------------------------
  // Game helpers
  // -----------------------------
  function kickoffMsFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const iso = ev?.date || comp?.date || "";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function getMatchupTeamsFromEvent(ev) {
    const comp = ev?.competitions?.[0] || {};
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const homeC = competitors.find(c => c?.homeAway === "home") || {};
    const awayC = competitors.find(c => c?.homeAway === "away") || {};
    return { comp, homeC, awayC };
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
    const r =
      competitor?.curatedRank?.current ??
      competitor?.rank ??
      teamObj?.rank ??
      "";
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
    const o = Array.isArray(comp?.odds) ? comp.odds[0] : null;
    if (!o) return { details: "", overUnder: "", favoredTeam: "" };

    const details = String(o?.details || "");
    const overUnder = (o?.overUnder != null) ? String(o.overUnder) : "";

    const homeFav = !!o?.homeTeamOdds?.favorite;
    const awayFav = !!o?.awayTeamOdds?.favorite;
    const favoredTeam =
      homeFav ? (homeTeam?.abbr || homeTeam?.name || "") :
      awayFav ? (awayTeam?.abbr || awayTeam?.name || "") :
      "";

    return { details, overUnder, favoredTeam };
  }

  // -----------------------------
  // Week storage reads/writes
  // -----------------------------
  async function gpGetWeekDoc(db, weekId) {
    const ref = db.collection(GPW.coll).doc(weekId);
    const snap = await ref.get();
    return snap.exists ? (snap.data() || {}) : null;
  }

  async function gpGetWeekGames(db, weekId) {
    const snap = await db.collection(GPW.coll).doc(weekId).collection("games").get();
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));

    list.sort((a, b) => {
      const at = a?.startTime?.toMillis ? a.startTime.toMillis() : 0;
      const bt = b?.startTime?.toMillis ? b.startTime.toMillis() : 0;
      return at - bt;
    });

    return list;
  }

  async function gpGetMyPicksMap(db, weekId, uid) {
    if (!uid) return {};
    const snap = await db.collection(GPW.coll).doc(weekId)
      .collection("picks").doc(uid)
      .collection("games").get();

    const map = {};
    snap.forEach(d => map[d.id] = d.data());
    return map;
  }

  async function gpGetAllPicksForWeek(db, weekId) {
    const out = {};
    const usersSnap = await db.collection(GPW.coll).doc(weekId).collection("picks").get();
    const userDocs = usersSnap.docs || [];

    for (const u of userDocs) {
      const uid = u.id;

      const gamesSnap = await db.collection(GPW.coll).doc(weekId)
        .collection("picks").doc(uid)
        .collection("games").get();

      gamesSnap.forEach(d => {
        const eventId = d.id;
        const data = d.data() || {};
        const name = String(data.name || (u.data()?.name || "Someone"));
        const side = String(data.side || "");

        if (!out[eventId]) out[eventId] = [];
        out[eventId].push({ uid, name, side });
      });
    }

    Object.keys(out).forEach(eventId => {
      out[eventId].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    });

    return out;
  }

  async function gpSaveMyPicksBatch(db, weekId, uid, pendingMap) {
    const keys = Object.keys(pendingMap || {});
    if (!keys.length) return;

    const picksUserRef = db.collection(GPW.coll).doc(weekId)
      .collection("picks").doc(uid);

    const name = String(getPicksDisplayName() || "Someone").trim().slice(0, 20);

    const batch = db.batch();

    batch.set(picksUserRef, {
      uid: String(uid || ""),
      name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    for (const eventId of keys) {
      const side = String(pendingMap[eventId] || "");
      const gameRef = picksUserRef.collection("games").doc(String(eventId));
      batch.set(gameRef, {
        uid: String(uid || ""),
        name,
        side,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
  }

  async function gpAdminAddSelectedGamesToWeek(db, weekId, uid, leagueKey, dateYYYYMMDD, selectedEventIds, events) {
    const weekRef = db.collection(GPW.coll).doc(weekId);
    await weekRef.set({
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid || ""
    }, { merge: true });

    for (const ev of (events || [])) {
      const eventId = String(ev?.id || "");
      if (!eventId) continue;
      if (!selectedEventIds.has(eventId)) continue;

      const { comp, homeC, awayC } = getMatchupTeamsFromEvent(ev);
      const homeTeam = buildTeam(homeC);
      const awayTeam = buildTeam(awayC);

      const homeName = homeTeam.name || "Home";
      const awayName = awayTeam.name || "Away";

      const startMs = kickoffMsFromEvent(ev);
      const startTime = startMs ? firebase.firestore.Timestamp.fromMillis(startMs) : null;

      const venueLine = buildVenueLine(comp);
      const odds = buildOdds(comp, homeTeam, awayTeam);

      // ✅ per-game lock default = startTime (no lockAt written unless you add it later)
      await weekRef.collection("games").doc(eventId).set({
        eventId,
        leagueKey: String(leagueKey || ""),
        dateYYYYMMDD: String(dateYYYYMMDD || ""),

        homeName,
        awayName,
        startTime,

        venueLine: String(venueLine || ""),
        oddsDetails: String(odds.details || ""),
        oddsOU: String(odds.overUnder || ""),
        oddsFavored: String(odds.favoredTeam || ""),
        homeTeam,
        awayTeam,

        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  async function gpAdminRemoveGameFromWeek(db, weekId, uid, eventId) {
    const weekRef = db.collection(GPW.coll).doc(weekId);
    await weekRef.collection("games").doc(String(eventId)).delete().catch(() => {});
    await weekRef.set({
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid || ""
    }, { merge: true });
  }

  async function gpAdminClearWeek(db, weekId, uid) {
    const weekRef = db.collection(GPW.coll).doc(weekId);
    const snap = await weekRef.collection("games").get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    await weekRef.set({
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid || ""
    }, { merge: true });
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
    window.__GP_PENDING.map[eventId] = s; // "home" | "away"
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
  // LIVE/FINAL + scores helpers (ESPN event)
  // -----------------------------
  function buildLiveFinalPillHTML(eventObj) {
    const ev = eventObj || null;
    const comp = ev?.competitions?.[0] || null;
    const st = comp?.status || ev?.status || null;
    const type = st?.type || null;

    const state = String(type?.state || "").trim(); // "pre" | "in" | "post"
    const shortDetail = String(type?.shortDetail || type?.detail || "").trim();
    if (!state) return "";

    if (state === "in") {
      const txt = shortDetail ? `LIVE • ${shortDetail}` : "LIVE";
      return `<div class="statusPill status-live" style="margin-bottom:10px;">${esc(txt)}</div>`;
    }

    if (state === "post") {
      const txt = shortDetail ? `FINAL • ${shortDetail}` : "FINAL";
      return `<div class="statusPill status-final" style="margin-bottom:10px;">${esc(txt)}</div>`;
    }

    return "";
  }

  function gpGetSideScore(eventObj, homeAway /* "home"|"away" */) {
    const ev = eventObj || null;
    const comp = ev?.competitions?.[0] || null;
    const st = comp?.status || ev?.status || null;
    const state = String(st?.type?.state || "").trim(); // pre/in/post

    if (!(state === "in" || state === "post")) return "";

    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const c = competitors.find(x => String(x?.homeAway || "") === String(homeAway || ""));
    const score = (c?.score != null) ? String(c.score) : "";
    return score.trim();
  }

  // -----------------------------
  // Admin UI (Week Builder + Add Games)
  // -----------------------------
  function gpBuildAdminPanelHTML({ weekId, weekLabel, published, leagueKey, dateYYYYMMDD, events }) {
    const now = Date.now();
    const sorted = [...(events || [])].sort((a, b) => kickoffMsFromEvent(a) - kickoffMsFromEvent(b));

    const rows = sorted.map(ev => {
      const eventId = String(ev?.id || "");
      if (!eventId) return "";

      const { comp, homeC, awayC } = getMatchupTeamsFromEvent(ev);
      const homeName = (homeC?.team?.displayName || homeC?.team?.name || "Home");
      const awayName = (awayC?.team?.displayName || awayC?.team?.name || "Away");

      const startMs = kickoffMsFromEvent(ev);
      const started = startMs ? (startMs <= now) : false;
      const iso = ev?.date || comp?.date || "";

      return `
        <div class="gpAdminRow">
          <label class="gpAdminLabel">
            <input type="checkbox" data-gpcheck="1" data-eid="${esc(eventId)}" />
            <span class="gpAdminText">${esc(awayName)} @ ${esc(homeName)}</span>
            <span class="muted gpAdminTime">${esc(fmtKickoff(iso))}${started ? " • Started" : ""}</span>
          </label>
        </div>
      `;
    }).join("");

    return `
      <div class="game" data-gpadminwrap="1" data-weekid="${esc(weekId)}" data-leaguekey="${esc(leagueKey)}" data-date="${esc(dateYYYYMMDD)}">
        <div class="gameHeader">
          <div class="statusPill status-other">ADMIN: WEEK BUILDER</div>
        </div>

        <div class="gameMetaTopLine">${esc(weekLabel)} • ${published ? "Published" : "Draft"}</div>
        <div class="gameMetaOddsLine">Create weeks, publish/unpublish, and add games across leagues.</div>

        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="smallBtn" type="button" data-gpadmin="newWeek">Create New Week</button>
          <button class="smallBtn" type="button" data-gpadmin="${published ? "unpublishWeek" : "publishWeek"}">${published ? "Unpublish" : "Publish"}</button>
          <button class="smallBtn" type="button" data-gpadmin="clearWeek">Clear Week Games</button>
        </div>

        <div style="margin-top:14px;">
          <div class="muted" style="margin-bottom:6px;">Add games to ${esc(weekLabel)}:</div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            ${buildLeagueSelectHTMLSafe(leagueKey)}
            ${buildCalendarButtonHTMLSafe()}
            <button class="smallBtn" type="button" data-gpaction="refresh">Load Games</button>
          </div>
        </div>

        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="smallBtn" type="button" data-gpselect="all">Select All</button>
          <button class="smallBtn" type="button" data-gpselect="none">Select None</button>
          <button class="smallBtn" type="button" data-gpadmin="addSelected">Add Selected to Week</button>
        </div>

        <div style="margin-top:10px;">
          ${rows || `<div class="notice">No games found for this league/date.</div>`}
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
  // User-facing Week Picks card
  // -----------------------------
  function gpBuildWeekPicksCardHTML({ weekId, weekLabel, games, myMap, published, allPicks, eventsById, role }) {
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

    if (!published) {
      return `
        <div class="game">
          <div class="gameHeader">
            <div class="statusPill status-other">GROUP PICKS</div>
          </div>
          <div class="gameMetaTopLine">${esc(weekLabel)} is not published yet</div>
          <div class="gameMetaOddsLine">Waiting on admin.</div>
        </div>
      `;
    }

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
      const details = String(g?.oddsDetails || "").trim();
      const ou = String(g?.oddsOU || "").trim();
      const parts = [];
      if (details) parts.push(`Favored: ${details}`);
      if (ou) parts.push(`O/U: ${ou}`);
      return parts.join(" • ");
    }

    function shortLeagueTag(k) {
      const kk = String(k || "").trim().toUpperCase();
      return kk ? kk : "";
    }

    function teamRowBtn({ side, t, logoUrl, extraSub, isActive, isFaded, scoreText, lockedGame, eventId }) {
      const score = String(scoreText || "").trim();
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

          ${score ? `
            <div style="
              flex:0 0 auto;
              font-weight:900;
              font-size:38px;
              line-height:1;
              letter-spacing:0.5px;
              margin-left:8px;
              opacity:0.95;
            ">${esc(score)}</div>
          ` : ``}
        </button>
      `;
    }

    const now = Date.now();

    const gameCards = (games || []).map(g => {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";

      const away = g?.awayTeam || { name: g?.awayName || "Away", rank: g?.awayRank, record: g?.awayRecord, logo: g?.awayLogo };
      const home = g?.homeTeam || { name: g?.homeName || "Home", rank: g?.homeRank, record: g?.homeRecord, logo: g?.homeLogo };

      const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
      const kickoffLabel = startMs
        ? new Date(startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "—";

      // ✅ per-game lock: lockAt OR startTime
      const lockMs = g?.lockAt?.toMillis ? g.lockAt.toMillis() : 0;
      const effectiveLock = lockMs || startMs || 0;
      const lockedGame = effectiveLock ? (now >= effectiveLock) : false;

      const pending = gpPendingGet(eventId);
      const saved = String(myMap?.[eventId]?.side || "");
      const my = pending || saved;

      const everyone = Array.isArray(allPicks?.[eventId]) ? allPicks[eventId] : [];
      const pickedTeam = (my === "away") ? (away?.name || "") : (my === "home" ? (home?.name || "") : "");
      const isPending = !!pending && pending !== saved;

      const everyoneLines = everyone.length
        ? everyone.map(p => {
            const nm = String(p?.name || "Someone");
            const side = String(p?.side || "");
            const team = (side === "away") ? (away?.name || "—") : (side === "home" ? (home?.name || "—") : "—");
            return `<div class="gpPickLine"><b>${esc(nm)}:</b> ${esc(team)}</div>`;
          }).join("")
        : `<div class="muted">No picks yet.</div>`;

      const venueLine = String(g?.venueLine || g?.venue || g?.venueName || "").trim();
      const oddsLine = fmtOddsLine(g);

      const awayLogo = safeLogo(away);
      const homeLogo = safeLogo(home);

      const hasPick = !!my;
      const awayActive = my === "away";
      const homeActive = my === "home";

      const awayFade = hasPick && !awayActive;
      const homeFade = hasPick && !homeActive;

      const ev = (eventsById && eventsById[eventId]) ? eventsById[eventId] : null;
      const liveFinalPill = buildLiveFinalPillHTML(ev);
      const awayScore = gpGetSideScore(ev, "away");
      const homeScore = gpGetSideScore(ev, "home");

      const leagueTag = shortLeagueTag(g?.leagueKey);

      return `
        <div class="game gpMiniGameCard gpGameRow" data-saved="${esc(saved)}" style="
          margin-top:14px;
          padding:14px;
          border-radius:22px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.08);
        ">
          ${liveFinalPill || ""}

          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div class="muted" style="font-weight:800;">
              ${leagueTag ? `<span class="statusPill status-other" style="display:inline-block; margin-right:8px;">${esc(leagueTag)}</span>` : ""}
              ${venueLine ? esc(venueLine) : ""}
            </div>
            <div class="muted" style="white-space:nowrap; font-weight:900;">
              ${esc(kickoffLabel)}
            </div>
          </div>

          ${oddsLine
            ? `<div class="muted" style="margin-top:8px; font-weight:800;">${esc(oddsLine)}</div>`
            : `<div class="muted" style="margin-top:8px; font-weight:800;">Odds unavailable</div>`
          }

          <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
            ${teamRowBtn({
              side: "away",
              t: away,
              logoUrl: awayLogo,
              extraSub: "Away",
              isActive: awayActive,
              isFaded: awayFade,
              scoreText: awayScore,
              lockedGame,
              eventId
            })}
            ${teamRowBtn({
              side: "home",
              t: home,
              logoUrl: homeLogo,
              extraSub: "Home",
              isActive: homeActive,
              isFaded: homeFade,
              scoreText: homeScore,
              lockedGame,
              eventId
            })}
          </div>

          <div class="gpMetaRow" style="margin-top:10px; display:flex; justify-content:space-between; gap:10px; align-items:center;">
            ${my
              ? `<div class="gpYouPicked">✓ ${isPending ? "Pending" : "Your Pick"}: ${esc(pickedTeam)}</div>`
              : `<div class="muted">No pick yet</div>`
            }
            <div style="display:flex; gap:10px; align-items:center;">
              ${lockedGame ? `<div class="muted">Locked</div>` : ``}
              ${role === "admin" ? `<button class="smallBtn" type="button" data-gpadmin="removeGame" data-eid="${esc(eventId)}">Remove</button>` : ``}
            </div>
          </div>

          <details class="gpEveryone" ${lockedGame ? "open" : ""} style="margin-top:10px;">
            <summary class="gpEveryoneSummary">Everyone’s Picks</summary>
            <div class="gpEveryoneBody">${everyoneLines}</div>
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
        </div>

        <div class="statusPill status-live" style="margin-top:10px;">
          ${esc(weekLabel)} • ${esc((games || []).length)} game${(games || []).length === 1 ? "" : "s"}
        </div>

        ${gameCards || `<div class="notice" style="margin-top:12px;">No games in this week yet.</div>`}

        ${saveRow}
      </div>
    `;
  }

  // -----------------------------
  // Header
  // -----------------------------
  function renderPicksHeaderHTML({ weekLabel, rightLabel, role, selectedKey, prettyDate }) {
    const adminSelectors = (role === "admin")
      ? `
        ${buildLeagueSelectHTMLSafe(selectedKey)}
        ${buildCalendarButtonHTMLSafe()}
      `
      : ``;

    return `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Picks</h2>
            <span class="badge">Group</span>
          </div>

          <div class="headerActions">
            <button class="smallBtn" data-gpaction="name">Name</button>
            <button class="smallBtn" data-gpaction="savePicks">Save</button>
            <button class="smallBtn" data-gpaction="refresh">Refresh</button>
          </div>
        </div>

        <div class="subline">
          <div class="sublineLeft">
            ${adminSelectors}
          </div>
          <div>${esc(weekLabel || "Week")} • ${esc(rightLabel || "")}${role === "admin" ? ` • ${esc(prettyDate || "")}` : ""}</div>
        </div>
      </div>
    `;
  }

  // -----------------------------
  // Main Picks renderer
  // -----------------------------
  async function renderPicks(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;

    const role = getRole();
    const selectedDate = getSavedDateYYYYMMDDSafe();
    const selectedKey = getSavedLeagueKeySafe();
    const prettyDate = yyyymmddToPrettySafe(selectedDate);

    if (showLoading) {
      content.innerHTML = `
        ${renderPicksHeaderHTML({ weekLabel: "Week", rightLabel: "Loading…", role, selectedKey, prettyDate })}
        <div class="notice">Loading picks…</div>
      `;
    }

    try {
      await ensureFirebaseReadySafe();

      const user = firebase?.auth?.().currentUser;
      if (!user) {
        try { await firebase.auth().signInAnonymously(); } catch {}
      }

      const db = firebase.firestore();
      const uid = firebase.auth().currentUser?.uid || "";

      await gpEnsureWeekInfra(db);

      // Active week (create Week 1 automatically if admin and none exists)
      let weekId = await gpGetActiveWeekId(db);

      if (!weekId && role === "admin") {
        weekId = await gpCreateNewWeekAndSetCurrent(db, uid);
      }

      const weekData = weekId ? await gpGetWeekDoc(db, weekId) : null;
      const weekLabel = String(weekData?.label || (weekId ? "Week" : "Week")) || "Week";
      const published = weekData?.published === true;

      // Admin builder needs events for selected league/date
      let eventsForPicker = [];
      if (role === "admin") {
        eventsForPicker = await fetchEventsFor(selectedKey, selectedDate);
      }

      const adminHTML = (role === "admin" && weekId)
        ? gpBuildAdminPanelHTML({
            weekId,
            weekLabel,
            published,
            leagueKey: selectedKey,
            dateYYYYMMDD: selectedDate,
            events: eventsForPicker
          })
        : "";

      if (!weekId) {
        content.innerHTML = `
          ${renderPicksHeaderHTML({ weekLabel: "Week", rightLabel: "Updated", role, selectedKey, prettyDate })}
          ${adminHTML}
          ${gpBuildWeekPicksCardHTML({ weekId: "", weekLabel: "", games: [], myMap: {}, published: false, allPicks: {}, eventsById: {}, role })}
        `;
        postRender();
        return;
      }

      // Users can’t see unpublished week
      if (!published && role !== "admin") {
        content.innerHTML = `
          ${renderPicksHeaderHTML({ weekLabel, rightLabel: "Updated", role, selectedKey, prettyDate })}
          ${gpBuildWeekPicksCardHTML({ weekId, weekLabel, games: [], myMap: {}, published: false, allPicks: {}, eventsById: {}, role })}
        `;
        postRender();
        return;
      }

      const games = await gpGetWeekGames(db, weekId);

      // ✅ Build eventsById across ALL league/date pairs in the week
      const pairs = {};
      for (const g of (games || [])) {
        const lk = String(g?.leagueKey || "").trim();
        const dt = String(g?.dateYYYYMMDD || "").trim();
        if (!lk || !dt) continue;
        pairs[`${lk}__${dt}`] = { leagueKey: lk, dateYYYYMMDD: dt };
      }

      const eventsById = {};
      const pairKeys = Object.keys(pairs);
      for (const k of pairKeys) {
        const p = pairs[k];
        const evs = await fetchEventsFor(p.leagueKey, p.dateYYYYMMDD);
        for (const ev of (evs || [])) {
          const id = String(ev?.id || "");
          if (id) eventsById[id] = ev;
        }
      }

      const myMap = await gpGetMyPicksMap(db, weekId, uid);
      const allPicks = await gpGetAllPicksForWeek(db, weekId);

      gpPendingResetIfSlateChanged(weekId);
      window.__GP_PENDING.sid = weekId;

      content.innerHTML = `
        ${renderPicksHeaderHTML({ weekLabel, rightLabel: "Updated", role, selectedKey, prettyDate })}
        ${adminHTML}
        ${gpBuildWeekPicksCardHTML({
          weekId,
          weekLabel,
          games,
          myMap,
          allPicks,
          published: true,
          eventsById,
          role
        })}
      `;

      postRender();
    } catch (err) {
  console.error("renderPicks error:", err);

  const code = String(err?.code || "");
  const msg = String(err?.message || err || "");

  content.innerHTML = `
    ${renderPicksHeaderHTML(
      yyyymmddToPrettySafe(getSavedDateYYYYMMDDSafe()),
      "Error",
      getSavedLeagueKeySafe()
    )}
    <div class="notice">Couldn’t load Picks right now.</div>

    <div class="notice" style="margin-top:10px; opacity:0.9;">
      <div style="font-weight:900; margin-bottom:6px;">Debug</div>
      ${code ? `<div><b>Code:</b> ${esc(code)}</div>` : ``}
      ${msg ? `<div style="margin-top:6px;"><b>Message:</b> ${esc(msg)}</div>` : ``}
    </div>
  `;

  postRender();
}
  }

  function postRender() {
    try { setPicksNameUI(); } catch {}
    try { gpUpdateSaveBtnUI(); } catch {}

    try {
      if (typeof window.replaceMichiganText === "function") setTimeout(() => window.replaceMichiganText(), 0);
    } catch {}
    try {
      if (typeof window.updateRivalryBanner === "function") window.updateRivalryBanner();
    } catch {}
  }

  // -----------------------------
  // Click handling (delegated)
  // -----------------------------
  if (!window.__GP_CLICK_BOUND) {
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;

      const act = btn.getAttribute("data-gpaction");
      if (act === "refresh") {
        renderPicks(true);
        return;
      }
      if (act === "name") {
        const cur = getPicksDisplayName();
        const picked = prompt("Enter name for Picks:", cur) || "";
        const name = String(picked).trim();
        if (name) safeSetLS(PICKS_NAME_KEY, name.slice(0, 20));
        renderPicks(true);
        return;
      }
      if (act === "savePicks") {
        ensureFirebaseReadySafe()
          .then(async () => {
            const db = firebase.firestore();
            const uid = firebase.auth().currentUser?.uid || "";
            if (!uid) throw new Error("No uid (not signed in)");

            const weekId = String(window.__GP_PENDING?.sid || "");
            const pendingMap = window.__GP_PENDING?.map || {};
            const keys = Object.keys(pendingMap);

            if (!weekId || !keys.length) {
              gpUpdateSaveBtnUI();
              return;
            }

            await gpSaveMyPicksBatch(db, weekId, uid, pendingMap);
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

      // ✅ User pick buttons (pending only)
      const gpPick = btn.getAttribute("data-gppick");
      if (gpPick) {
        const eventId = btn.getAttribute("data-eid") || "";
        if (!eventId) return;

        if (btn.disabled) return;

        const cur = gpPendingGet(eventId);
        if (cur === gpPick) gpPendingSet(eventId, "");
        else gpPendingSet(eventId, gpPick);

        gpUpdateSaveBtnUI();

        // ✅ update active + fade states in-place
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

      // Admin actions
      const gpAdmin = btn.getAttribute("data-gpadmin");
      if (gpAdmin) {
        ensureFirebaseReadySafe()
          .then(async () => {
            const role = getRole();
            if (role !== "admin") {
              alert("Admin only.");
              return;
            }

            const db = firebase.firestore();
            const uid = firebase.auth().currentUser?.uid || "";
            if (!uid) throw new Error("No uid (not signed in)");

            const wrap = btn.closest('[data-gpadminwrap="1"]');
            const weekId = String(wrap?.getAttribute("data-weekid") || "");
            const leagueKey = String(wrap?.getAttribute("data-leaguekey") || getSavedLeagueKeySafe());
            const dateYYYYMMDD = String(wrap?.getAttribute("data-date") || getSavedDateYYYYMMDDSafe());

            const statusEl = document.getElementById("gpAdminStatus");
            const setStatus = (t) => { if (statusEl) statusEl.textContent = String(t || ""); };

            if (gpAdmin === "newWeek") {
              setStatus("Creating new week…");
              await gpCreateNewWeekAndSetCurrent(db, uid);
              setStatus("New week created ✅");
              return;
            }

            if (!weekId) {
              alert("No active week yet.");
              return;
            }

            if (gpAdmin === "publishWeek") {
              setStatus("Publishing…");
              await gpSetWeekPublished(db, weekId, uid, true);
              setStatus("Published ✅");
              return;
            }

            if (gpAdmin === "unpublishWeek") {
              setStatus("Unpublishing…");
              await gpSetWeekPublished(db, weekId, uid, false);
              setStatus("Unpublished ✅");
              return;
            }

            if (gpAdmin === "clearWeek") {
              if (!confirm("Clear all games from this week?")) return;
              setStatus("Clearing week games…");
              await gpAdminClearWeek(db, weekId, uid);
              setStatus("Week cleared ✅");
              return;
            }

            if (gpAdmin === "addSelected") {
              const checks = Array.from(wrap?.querySelectorAll('input[type="checkbox"][data-gpcheck="1"]') || []);
              const selected = new Set(
                checks.filter(c => c.checked)
                  .map(c => String(c.getAttribute("data-eid") || ""))
                  .filter(Boolean)
              );
              if (selected.size === 0) {
                setStatus("Select at least 1 game first.");
                alert("Select at least 1 game first.");
                return;
              }

              setStatus("Loading ESPN games…");
              const events = await fetchEventsFor(leagueKey, dateYYYYMMDD);

              setStatus("Adding selected games…");
              await gpAdminAddSelectedGamesToWeek(db, weekId, uid, leagueKey, dateYYYYMMDD, selected, events);

              setStatus(`Added ✅ (${selected.size} game${selected.size === 1 ? "" : "s"})`);
              return;
            }

            if (gpAdmin === "removeGame") {
              const eid = String(btn.getAttribute("data-eid") || "");
              if (!eid) return;
              if (!confirm("Remove this game from the week?")) return;
              await gpAdminRemoveGameFromWeek(db, weekId, uid, eid);
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

    window.__GP_CLICK_BOUND = true;
  }

  // Expose renderer used by shared tab router
  window.renderPicks = renderPicks;

})();