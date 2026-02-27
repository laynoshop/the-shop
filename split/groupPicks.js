/* split/groupPicks.js
   =========================
   GROUP PICKS (Weekly Multi-League Slate) — SINGLE SOURCE for Picks tab
   - Admin: create weeks (auto increment), set active week, add games from ANY league/day into that week, publish
   - Users: see active week by default, can select prior published weeks
   - Picks: home/away (multi-pick), then Save once (manual save)
   - Per-game lock (locks at game start)
   - NO UID UI
   ========================= */

(function () {
  "use strict";

  // -----------------------------
  // Safe helpers / fallbacks
  // -----------------------------
  const PICKS_NAME_KEY = "theShopPicksName_v1";
  const PICKS_WEEK_KEY = "theShopPicksWeek_v1"; // last selected week id
  const META_PUBLIC_DOC = "public";
  const META_ADMIN_DOC = "admin";

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

  function yyyymmddToPrettySafe(yyyymmdd) {
    if (typeof window.yyyymmddToPretty === "function") return window.yyyymmddToPretty(yyyymmdd);
    const s = String(yyyymmdd || "");
    if (s.length !== 8) return s;
    const y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
    const dt = new Date(y, m, d);
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function weekIdFor(year, weekNum) {
    return `${year}_W${weekNum}`;
  }

  function parseWeekId(weekId) {
    const m = String(weekId || "").match(/^(\d{4})_W(\d{1,2})$/);
    if (!m) return { year: currentYear(), weekNum: 1 };
    return { year: Number(m[1]), weekNum: Number(m[2]) };
  }

  // -----------------------------
  // Leagues (admin add-games tool)
  // -----------------------------
  const __LEAGUES_FALLBACK_FULL = [
    { key: "ncaam", name: "Men’s College Basketball", endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=50&limit=200` },
    { key: "nba",   name: "NBA",                    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}` },
    { key: "nhl",   name: "NHL",                    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}` },
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
  // Firestore helpers (meta + week)
  // -----------------------------
  function metaRef(db, docId) {
    return db.collection("pickSlatesMeta").doc(String(docId));
  }

  async function gpGetMetaPublic(db) {
    const snap = await metaRef(db, META_PUBLIC_DOC).get();
    return snap.exists ? (snap.data() || {}) : {};
  }

  async function gpGetMetaAdmin(db) {
    const snap = await metaRef(db, META_ADMIN_DOC).get();
    return snap.exists ? (snap.data() || {}) : {};
  }

  async function gpEnsureMetaInitialized(db) {
    const y = currentYear();
    const pub = await gpGetMetaPublic(db);
    if (pub?.year === y && pub?.activeWeekId) return;

    // Admin-only init happens via admin action; users just fall back.
  }

  // -----------------------------
  // Picks storage model (week is the slateId now)
  // -----------------------------
  function kickoffMsFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const iso = ev?.date || comp?.date || "";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
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

  async function gpGetMyPicksMap(db, slateId, uid) {
    if (!uid) return {};
    const snap = await db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(uid)
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
      const uid = u.id;

      const gamesSnap = await db.collection("pickSlates").doc(slateId)
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

  async function gpSaveMyPicksBatch(db, slateId, uid, pendingMap) {
    const keys = Object.keys(pendingMap || {});
    if (!keys.length) return;

    const picksUserRef = db.collection("pickSlates").doc(slateId)
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
  // Week selector UI
  // -----------------------------
  function buildWeekSelectHTML(weeks, selectedWeekId) {
    const list = Array.isArray(weeks) ? weeks : [];
    const options = list.map(w => {
      const id = String(w?.id || "");
      const label = String(w?.label || id);
      const disabled = (w?.published === false) ? " disabled" : "";
      const sel = (id === selectedWeekId) ? " selected" : "";
      return `<option value="${esc(id)}"${sel}${disabled}>${esc(label)}</option>`;
    }).join("");

    return `
      <select class="leagueSelect" aria-label="Choose week" data-gpweeksel="1">
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
  // Admin: create week + set active + add games + publish
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

      const year = (Number(a.year) === y || Number(p.year) === y) ? y : y;
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

      // create the week slate doc (unpublished initially)
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
        year: (Number(p.year) === y ? y : y),
        activeWeekId: String(weekId),
        weeks,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });

      tx.set(adminRef, {
        year: (Number(p.year) === y ? y : y),
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

  async function gpAdminAddSelectedGamesToWeek(db, uid, weekId, leagueKey, dateYYYYMMDD, selectedEventIds, events) {
    const slateRef = db.collection("pickSlates").doc(String(weekId));

    // ensure slate exists
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

      const venueLine = buildVenueLine(comp);
      const odds = buildOdds(comp, homeTeam, awayTeam);

      await slateRef.collection("games").doc(eventId).set({
        eventId,
        weekId: String(weekId),
        leagueKey: String(leagueKey || ""),
        dateYYYYMMDD: String(dateYYYYMMDD || ""),

        homeName: homeTeam.name || "Home",
        awayName: awayTeam.name || "Away",
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

  async function gpAdminPublishWeek(db, uid, weekId) {
    const slateRef = db.collection("pickSlates").doc(String(weekId));
    await slateRef.set({
      published: true,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });

    // also mark published in meta public list (so users can select it)
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
  // Rendering (cards)
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
    const details = String(g?.oddsDetails || "").trim();
    const ou = String(g?.oddsOU || "").trim();
    const parts = [];
    if (details) parts.push(`Favored: ${details}`);
    if (ou) parts.push(`O/U: ${ou}`);
    return parts.join(" • ");
  }

  function gpBuildGroupPicksCardHTML({ weekId, weekLabel, games, myMap, published, allPicks }) {
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
          <div class="gameMetaTopLine">${esc(weekLabel || weekId)} not published yet</div>
          <div class="gameMetaOddsLine">Waiting on admin.</div>
        </div>
      `;
    }

    const now = Date.now();

    function teamRowBtn({ side, t, logoUrl, extraSub, isActive, isFaded, lockedGame, eventId }) {
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
      const lockedGame = startMs ? now >= startMs : false;

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

      const venueLine = String(g?.venueLine || "").trim();
      const oddsLine = fmtOddsLine(g);

      const awayLogo = safeLogo(away);
      const homeLogo = safeLogo(home);

      const hasPick = !!my;
      const awayActive = my === "away";
      const homeActive = my === "home";
      const awayFade = hasPick && !awayActive;
      const homeFade = hasPick && !homeActive;

      return `
        <div class="game gpMiniGameCard gpGameRow" data-saved="${esc(saved)}" style="
          margin-top:14px;
          padding:14px;
          border-radius:22px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.08);
        ">

          <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div class="muted" style="font-weight:800;">
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
            ${teamRowBtn({ side: "away", t: away, logoUrl: awayLogo, extraSub: "Away", isActive: awayActive, isFaded: awayFade, lockedGame, eventId })}
            ${teamRowBtn({ side: "home", t: home, logoUrl: homeLogo, extraSub: "Home", isActive: homeActive, isFaded: homeFade, lockedGame, eventId })}
          </div>

          <div class="gpMetaRow" style="margin-top:10px; display:flex; justify-content:space-between; gap:10px; align-items:center;">
            ${my
              ? `<div class="gpYouPicked">✓ ${isPending ? "Pending" : "Your Pick"}: ${esc(pickedTeam)}</div>`
              : `<div class="muted">No pick yet</div>`
            }
            ${lockedGame ? `<div class="muted">Locked</div>` : ``}
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

        <div class="gameMetaTopLine" style="margin-top:8px; font-weight:900;">
          ${esc(weekLabel || weekId)}
        </div>

        ${gameCards || `<div class="notice" style="margin-top:12px;">No games in this week.</div>`}

        ${saveRow}
      </div>
    `;
  }

  // -----------------------------
  // Admin builder UI (multi-league add)
  // -----------------------------
  function gpBuildAdminBuilderHTML({ weekId, weekLabel, leagueKey, dateYYYYMMDD, events }) {
    const now = Date.now();
    const sorted = [...(events || [])].sort((a, b) => kickoffMsFromEvent(a) - kickoffMsFromEvent(b));

    const rows = sorted.map(ev => {
      const eventId = String(ev?.id || "");
      if (!eventId) return "";
      const comp = ev?.competitions?.[0];
      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const home = competitors.find(c => c.homeAway === "home");
      const away = competitors.find(c => c.homeAway === "away");
      const homeName = home?.team?.displayName || home?.team?.name || "Home";
      const awayName = away?.team?.displayName || away?.team?.name || "Away";

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
// Main renderer
// -----------------------------
async function renderPicks(showLoading) {
  const content = document.getElementById("content");
  if (!content) return;

  const role = getRole();
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
    const uid = firebase.auth().currentUser?.uid || "";

    // Read meta (public) to know active week + list
    const metaPub = await gpGetMetaPublic(db);
    const weeks = Array.isArray(metaPub.weeks) ? metaPub.weeks : [];
    const activeWeekId = String(metaPub.activeWeekId || "").trim();

    // Determine which week to show
    const requested = getSelectedWeekFromLS();
    const requestedOk =
      requested &&
      weeks.some(w =>
        String(w.id) === requested && (w.published === true || role === "admin")
      );

    const showWeekId = requestedOk ? requested : activeWeekId;

    // Persist current selection so week selector stays stable
    if (showWeekId) setSelectedWeekToLS(showWeekId);

    const wLabel =
      (weeks.find(w => String(w.id) === String(showWeekId))?.label) ||
      showWeekId ||
      "Week";

    // Admin builder state
    let adminHTML = "";
    let adminEvents = [];
    const selectedLeagueKey = getSavedLeagueKeySafe();
    const selectedDate = getSavedDateYYYYMMDDSafe();

    if (role === "admin") {
      // load events only when admin taps Load (stored on window)
      adminEvents = Array.isArray(window.__GP_ADMIN_EVENTS) ? window.__GP_ADMIN_EVENTS : [];
      adminHTML = gpBuildAdminBuilderHTML({
        weekId: showWeekId,
        weekLabel: wLabel,
        leagueKey: selectedLeagueKey,
        dateYYYYMMDD: selectedDate,
        events: adminEvents
      });
    }

    // Week selector options:
    const weekOptions = (role === "admin") ? weeks : weeks.filter(w => w.published === true);
    const weekSelectHTML = buildWeekSelectHTML(weekOptions, showWeekId || "");

    if (!showWeekId) {
      content.innerHTML = `
        ${renderPicksHeaderHTML({ role, weekSelectHTML, weekLabel: "Week", rightLabel: "Updated", selectedKey: selectedLeagueKey, prettyDate: wLabel })}
        ${adminHTML}
        ${gpBuildGroupPicksCardHTML({ weekId: "", weekLabel: "", games: [], myMap: {}, allPicks: {}, published: false })}
      `;
      postRender();
      return;
    }

    const slateRef = db.collection("pickSlates").doc(showWeekId);
    const slateSnap = await slateRef.get();
    const slateData = slateSnap.exists ? (slateSnap.data() || {}) : {};
    const published = slateData.published === true;

    // Non-admin cannot view unpublished week
    if (!published && role !== "admin") {
      content.innerHTML = `
        ${renderPicksHeaderHTML({
          role,
          weekSelectHTML: buildWeekSelectHTML(weeks.filter(w => w.published === true), activeWeekId),
          weekLabel: wLabel,
          rightLabel: "Updated",
          selectedKey: selectedLeagueKey
        })}
        ${gpBuildGroupPicksCardHTML({ weekId: showWeekId, weekLabel: wLabel, games: [], myMap: {}, allPicks: {}, published: false })}
      `;
      postRender();
      return;
    }

    // Normal pick load
    const games = await gpGetSlateGames(db, showWeekId);
    const myMap = await gpGetMyPicksMap(db, showWeekId, uid);
    const allPicks = await gpGetAllPicksForSlate(db, showWeekId);

    gpPendingResetIfSlateChanged(showWeekId);
    window.__GP_PENDING.sid = showWeekId;

    content.innerHTML = `
      ${renderPicksHeaderHTML({
        role,
        weekSelectHTML,
        weekLabel: wLabel,
        rightLabel: published ? "Updated" : "Draft",
        selectedKey: selectedLeagueKey
      })}
      ${adminHTML}
      ${gpBuildGroupPicksCardHTML({ weekId: showWeekId, weekLabel: wLabel, games, myMap, allPicks, published })}
    `;

    postRender();
  } catch (err) {
    console.error("renderPicks error:", err);
    content.innerHTML = `
      ${renderPicksHeaderHTML({ role, weekLabel: "Week", rightLabel: "Error", weekSelectHTML: "" })}
      <div class="notice">Couldn’t load Picks right now.</div>
    `;
    postRender();
  }
}

/**
 * Header renderer
 * Accepts an object (because that's how you're calling it everywhere).
 */
function renderPicksHeaderHTML({ role, weekSelectHTML, weekLabel, rightLabel, selectedKey }) {
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

      <div class="subline">
        <div class="sublineLeft" style="display:flex; flex-direction:column; gap:10px;">

          <!-- Row 1: Week selector + admin week buttons (keeps them together) -->
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
            ${String(weekSelectHTML || "")}

            ${isAdmin ? `
              <button class="smallBtn" data-gpaction="newWeek" type="button">New Week</button>
              <button class="smallBtn" data-gpaction="setActive" type="button">Set Active</button>
            ` : ""}
          </div>

          <!-- Row 2: Admin-only league/date controls (so top row doesn't overflow) -->
          ${isAdmin ? `
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              ${buildLeagueSelectHTMLSafe(selectedKey)}
              ${buildCalendarButtonHTMLSafe()}
              <button class="smallBtn" data-gpaction="adminLoad" type="button">Load</button>
            </div>
          ` : ""}
        </div>

        <div style="white-space:nowrap;">
          ${esc(weekLabel || "Week")} • ${esc(rightLabel || "")}
        </div>
      </div>
    </div>
  `;
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
      if (act === "refresh") { renderPicks(true); return; }

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

            const slateId = String(window.__GP_PENDING?.sid || "");
            const pendingMap = window.__GP_PENDING?.map || {};
            const keys = Object.keys(pendingMap);

            if (!slateId || !keys.length) {
              gpUpdateSaveBtnUI();
              return;
            }

            await gpSaveMyPicksBatch(db, slateId, uid, pendingMap);
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

      // User pick buttons
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

      // Admin actions
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

              // persist to LS so it stays sticky
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

    // Week selector change (not a button, so separate handler)
    document.addEventListener("change", (e) => {
      const sel = e.target;
      if (!sel || !sel.getAttribute) return;
      if (sel.getAttribute("data-gpweeksel") !== "1") return;

      const v = String(sel.value || "").trim();
      if (!v) return;
      setSelectedWeekToLS(v);
      renderPicks(true);
    });

    window.__GP_CLICK_BOUND = true;
  }

  // Expose renderer used by shared tab router
  window.renderPicks = renderPicks;

})();