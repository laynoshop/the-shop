/* split/groupPicks.js
   =========================
   GROUP PICKS (Pick'em Slate) — SINGLE SOURCE for Picks tab
   - Overrides any older Units picks renderPicks
   - Admin: build slate from ESPN events, set lock time, Create+Publish (one button)
   - Users: pick home/away (multi-pick), then Save once (manual save)
   - Users: see everyone’s picks
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

  function norm(s) {
    if (typeof window.norm === "function") return window.norm(s);
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
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

  // -----------------------------
  // ✅ LEAGUE SELECT + LEAGUE LOOKUP + ESPN EVENTS (SINGLE COPY)
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

  // Debug bucket (kept for console, NOT shown in UI anymore)
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
  // Group picks storage model
  // -----------------------------
  function slateIdFor(leagueKey, dateYYYYMMDD) {
    return `${leagueKey}__${dateYYYYMMDD}`;
  }

  function kickoffMsFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const iso = ev?.date || comp?.date || "";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function fmtKickoff(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function getMatchupNamesFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const home = competitors.find(c => c.homeAway === "home");
    const away = competitors.find(c => c.homeAway === "away");

    const homeName = (typeof window.getTeamDisplayNameUI === "function")
      ? (window.getTeamDisplayNameUI(home?.team) || "Home")
      : (home?.team?.displayName || home?.team?.name || "Home");

    const awayName = (typeof window.getTeamDisplayNameUI === "function")
      ? (window.getTeamDisplayNameUI(away?.team) || "Away")
      : (away?.team?.displayName || away?.team?.name || "Away");

    const iso = ev?.date || comp?.date || "";
    return { homeName, awayName, iso };
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

  async function gpSaveMyPick(db, slateId, uid, eventId, side) {
    const picksUserRef = db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(uid);

    const gameRef = picksUserRef.collection("games").doc(eventId);

    const name = String(getPicksDisplayName() || "Someone").trim().slice(0, 20);

    await picksUserRef.set({
      uid: String(uid || ""),
      name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await gameRef.set({
      uid: String(uid || ""),
      name,
      side: String(side || ""),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // ✅ Batch save ALL pending picks in one commit (manual save)
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

  async function gpAdminCreateOrReplaceSlate(db, leagueKey, dateYYYYMMDD, uid, selectedEventIds, events) {
    const slateId = slateIdFor(leagueKey, dateYYYYMMDD);
    const slateRef = db.collection("pickSlates").doc(slateId);

    await slateRef.set({
      leagueKey,
      dateYYYYMMDD,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });

    // Replace games collection
    const existingSnap = await slateRef.collection("games").get();
    const batch = db.batch();
    existingSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    for (const ev of (events || [])) {
      const eventId = String(ev?.id || "");
      if (!eventId) continue;
      if (!selectedEventIds.has(eventId)) continue;

      const { homeName, awayName } = getMatchupNamesFromEvent(ev);

      const startMs = kickoffMsFromEvent(ev);
      const startTime = startMs ? firebase.firestore.Timestamp.fromMillis(startMs) : null;

      await slateRef.collection("games").doc(eventId).set({
        eventId,
        homeName,
        awayName,
        startTime,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    return slateId;
  }

  // ✅ NEW: ONE BUTTON admin flow: Create/Replace + Publish in one pass (lock time only once)
  async function gpAdminCreatePublishSlate(db, leagueKey, dateYYYYMMDD, uid, selectedEventIds, events, lockDate) {
    const slateId = slateIdFor(leagueKey, dateYYYYMMDD);
    const slateRef = db.collection("pickSlates").doc(slateId);

    if (!(lockDate instanceof Date) || isNaN(lockDate.getTime())) {
      alert("Please set a valid Lock Time before publishing.");
      return null;
    }

    // Create/Replace games
    await gpAdminCreateOrReplaceSlate(db, leagueKey, dateYYYYMMDD, uid, selectedEventIds, events);

    // Publish + set lockAt (no second step)
    await slateRef.set({
      published: true,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: uid,
      lockAt: firebase.firestore.Timestamp.fromDate(lockDate),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });

    return slateId;
  }

  // -----------------------------
  // ✅ Admin UI (no ESPN debug line, one button)
  // -----------------------------
  function gpBuildAdminSlateHTML(events, leagueKey, dateYYYYMMDD) {
  const now = Date.now();
  const sorted = [...(events || [])].sort((a, b) => kickoffMsFromEvent(a) - kickoffMsFromEvent(b));

  const rows = sorted.map(ev => {
    const eventId = String(ev?.id || "");
    if (!eventId) return "";
    const { homeName, awayName, iso } = getMatchupNamesFromEvent(ev);

    const startMs = kickoffMsFromEvent(ev);
    const started = startMs ? (startMs <= now) : false;

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
    <div class="game" data-gpadminwrap="1" data-leaguekey="${esc(leagueKey)}" data-date="${esc(dateYYYYMMDD)}">
      <div class="gameHeader">
        <div class="statusPill status-other">ADMIN: SLATE BUILDER</div>
      </div>

      <div class="gameMetaTopLine">${esc(String(leagueKey || "").toUpperCase())} • ${esc(dateYYYYMMDD)}</div>
      <div class="gameMetaOddsLine">Select games, then set lock time and Create + Publish.</div>

      <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="smallBtn" type="button" data-gpselect="all">Select All</button>
        <button class="smallBtn" type="button" data-gpselect="none">Select None</button>
      </div>

      <div style="margin-top:10px;">
        ${rows || `<div class="notice">No games to build a slate from.</div>`}
      </div>

      <!-- ✅ Lock Time moved DOWN near publish -->
      <div style="margin-top:14px;">
        <label style="display:block; margin-bottom:6px;">
          Lock Time:
          <input type="datetime-local" data-gplock="1" />
        </label>
        <div class="muted" style="margin-top:4px;">Local time on this device.</div>
      </div>

      <div style="margin-top:12px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="smallBtn" type="button"
          data-gpadmin="createPublish"
          data-league="${esc(leagueKey)}"
          data-date="${esc(dateYYYYMMDD)}">
          Create + Publish Slate
        </button>

        <div class="muted" id="gpAdminStatus"></div>
      </div>
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
  // User-facing Group Picks card
  // -----------------------------
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
  // Update ALL save buttons (header + in-card)
  const btns = Array.from(document.querySelectorAll('[data-gpaction="savePicks"]'));
  if (!btns.length) return;

  const n = gpPendingCount();
  for (const btn of btns) {
    btn.textContent = n ? `Save (${n})` : "Save";
    btn.disabled = !n;
  }
}
  
  function gpBuildGroupPicksCardHTML({ slateId, games, myMap, published, allPicks, lockAt }) {
  if (!published) {
    return `
      <div class="game">
        <div class="gameHeader">
          <div class="statusPill status-other">GROUP PICKS</div>
        </div>
        <div class="gameMetaTopLine">No slate published yet</div>
        <div class="gameMetaOddsLine">Waiting on admin.</div>
      </div>
    `;
  }

  const lockMs = lockAt?.toMillis ? lockAt.toMillis() : 0;
  const now = Date.now();

  const lockAtLabel = lockMs
    ? new Date(lockMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";

  // game cards
  const rows = (games || []).map(g => {
    const eventId = String(g?.eventId || g?.id || "");
    if (!eventId) return "";

    const homeName = String(g?.homeName || "Home");
    const awayName = String(g?.awayName || "Away");

    const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;

    // lock behavior: if lockAt set, use it; otherwise lock at kickoff
    const locked = lockMs ? (now >= lockMs) : (startMs ? now >= startMs : false);

    // pending overrides saved
    const pending = gpPendingGet(eventId); // "home"/"away"/""
    const saved = String(myMap?.[eventId]?.side || "");
    const my = pending || saved;

    const everyone = Array.isArray(allPicks?.[eventId]) ? allPicks[eventId] : [];

    const pickedTeam = (my === "away") ? awayName : (my === "home" ? homeName : "");
    const isPending = !!pending && pending !== saved;

    const everyoneLines = everyone.length
      ? everyone.map(p => {
          const nm = String(p?.name || "Someone");
          const side = String(p?.side || "");
          const team = (side === "away") ? awayName : (side === "home" ? homeName : "—");
          return `<div class="gpPickLine"><b>${esc(nm)}:</b> ${esc(team)}</div>`;
        }).join("")
      : `<div class="muted">No picks yet.</div>`;

    return `
      <div class="gpGameRow" data-saved="${esc(saved)}">
        <div class="gpMatchup">
          <div class="gpTeams">${esc(awayName)} @ ${esc(homeName)}</div>
          <div class="muted">
            ${startMs ? new Date(startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
            ${locked ? " • LOCKED" : ""}
          </div>
        </div>

        <div class="gpButtons ${my ? "hasPick" : ""}">
          <button class="gpBtn ${my === "away" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
            data-gppick="away" data-slate="${esc(slateId)}" data-eid="${esc(eventId)}">
            ${esc(awayName)}
          </button>

          <button class="gpBtn ${my === "home" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
            data-gppick="home" data-slate="${esc(slateId)}" data-eid="${esc(eventId)}">
            ${esc(homeName)}
          </button>
        </div>

        <div class="gpMetaRow">
          ${my
            ? `<div class="gpYouPicked">✓ ${isPending ? "Pending" : "Your Pick"}: ${esc(pickedTeam)}</div>`
            : `<div class="muted">No pick yet</div>`
          }
        </div>

        <details class="gpEveryone" ${locked ? "open" : ""}>
          <summary class="gpEveryoneSummary">Everyone’s Picks</summary>
          <div class="gpEveryoneBody">${everyoneLines}</div>
        </details>
      </div>
    `;
  }).join("");

  // Save row (bottom)
  const saveRow = `
    <div class="gpSaveRow" style="margin-top:12px; display:flex; align-items:center; gap:10px;">
      <button class="smallBtn" data-gpaction="savePicks" type="button">Save</button>
      <div class="muted">(Saves your pending picks)</div>
    </div>
  `;

  // One clean status pill (timer will update this text + color)
  const pillClass = (lockMs && now >= lockMs) ? "status-locked" : "status-live";
  const pillText = (lockMs && now >= lockMs)
    ? "Slate is locked"
    : `Slate is live • Locks in ⏳ • ${lockAtLabel ? `Locks at ${lockAtLabel}` : "Locks at game start"}`;

  return `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">GROUP PICKS</div>
      </div>

      <div
        id="gpSlatePill"
        class="statusPill ${esc(pillClass)}"
        data-lockms="${esc(String(lockMs || 0))}"
        data-lockat="${esc(lockAtLabel || "")}"
        style="margin-top:10px;"
      >
        ${esc(pillText)}
      </div>

      ${rows || `<div class="notice">No games in slate.</div>`}

      ${saveRow}
    </div>
  `;
}
  
  // -----------------------------
  // Main Picks renderer
  // -----------------------------
  async function renderPicks(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;

    const selectedDate = getSavedDateYYYYMMDDSafe();
    const selectedKey = getSavedLeagueKeySafe();
    const prettyDate = yyyymmddToPrettySafe(selectedDate);

    if (showLoading) {
      content.innerHTML = `
        ${renderPicksHeaderHTML(prettyDate, "Loading…", selectedKey)}
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

      const role = getRole();
      const events = await fetchEventsFor(selectedKey, selectedDate);

      const adminHTML = (role === "admin")
        ? gpBuildAdminSlateHTML(events, selectedKey, selectedDate)
        : "";

      const sid = slateIdFor(selectedKey, selectedDate);
      gpPendingResetIfSlateChanged(sid);
      window.__GP_PENDING.sid = sid;
      const slateRef = db.collection("pickSlates").doc(sid);
      const slateSnap = await slateRef.get();

      if (!slateSnap.exists) {
        content.innerHTML = `
          ${renderPicksHeaderHTML(prettyDate, "Updated", selectedKey)}
          ${adminHTML}
          ${gpBuildGroupPicksCardHTML({ slateId: sid, games: [], myMap: {}, allPicks: {}, published: false })}
        `;
        postRender();
        return;
      }

      const slateData = slateSnap.data() || {};
      const published = slateData.published === true;

      if (!published && role !== "admin") {
        content.innerHTML = `
          ${renderPicksHeaderHTML(prettyDate, "Updated", selectedKey)}
          ${gpBuildGroupPicksCardHTML({ slateId: sid, games: [], myMap: {}, allPicks: {}, published: false })}
        `;
        postRender();
        return;
      }

      const games = await gpGetSlateGames(db, sid);
      const myMap = await gpGetMyPicksMap(db, sid, uid);
      const allPicks = await gpGetAllPicksForSlate(db, sid);

      content.innerHTML = `
        ${renderPicksHeaderHTML(prettyDate, "Updated", selectedKey)}
        ${adminHTML}
        ${gpBuildGroupPicksCardHTML({
          slateId: sid,
          games,
          myMap,
          allPicks,
          published,
          lockAt: slateData.lockAt || null
        })}
      `;

      postRender();
    } catch (err) {
      console.error("renderPicks error:", err);
      content.innerHTML = `
        ${renderPicksHeaderHTML(yyyymmddToPrettySafe(getSavedDateYYYYMMDDSafe()), "Error", getSavedLeagueKeySafe())}
        <div class="notice">Couldn’t load Picks right now.</div>
      `;
      postRender();
    }
  }

  function renderPicksHeaderHTML(prettyDate, rightLabel, selectedKey) {
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
          ${buildLeagueSelectHTMLSafe(selectedKey)}
          ${buildCalendarButtonHTMLSafe()}
          <button class="iconBtn" data-gpaction="addQuick" title="Add pick">＋</button>
        </div>
        <div>${esc(prettyDate)} • ${esc(rightLabel || "")}</div>
      </div>
    </div>
  `;
}

function gpFormatCountdown(msLeft) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function gpStartLockCountdownTimer() {
  // clear old timer
  if (window.__GP_LOCK_TICK) {
    clearInterval(window.__GP_LOCK_TICK);
    window.__GP_LOCK_TICK = null;
  }

  const el = document.getElementById("gpSlatePill");
  if (!el) return;

  const lockMs = Number(el.getAttribute("data-lockms") || "0");
  const lockAtLabel = String(el.getAttribute("data-lockat") || "").trim();

  // No lock time: keep it simple
  if (!lockMs) {
    el.classList.remove("status-locked");
    el.classList.add("status-live");
    el.textContent = `Slate is live • Locks at game start`;
    return;
  }

  const tick = () => {
    const now = Date.now();
    const left = lockMs - now;

    if (left <= 0) {
      el.classList.remove("status-live");
      el.classList.add("status-locked");
      el.textContent = "Slate is locked";
      return;
    }

    const countdown = gpFormatCountdown(left);
    el.classList.remove("status-locked");
    el.classList.add("status-live");
    el.textContent = `Slate is live • Locks in ${countdown} • Locks at ${lockAtLabel || "—"}`;
  };

  tick();
  window.__GP_LOCK_TICK = setInterval(tick, 1000);
}

  function postRender() {
  try { setPicksNameUI(); } catch {}
  try { gpStartLockCountdownTimer(); } catch {}
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

      // Header actions
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

      const slateId = String(window.__GP_PENDING?.sid || "");
      const pendingMap = window.__GP_PENDING?.map || {};
      const keys = Object.keys(pendingMap);

      if (!slateId || !keys.length) {
        gpUpdateSaveBtnUI();
        return;
      }

      // ✅ batch-save everything in one commit
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
      if (act === "addQuick") {
        alert("Quick-add is coming soon. Group Picks slate is the main workflow.");
        return;
      }

      // Admin: Select All / Select None
      const gpSelect = btn.getAttribute("data-gpselect");
      if (gpSelect) {
        const wrap = btn.closest('[data-gpadminwrap="1"]');
        gpApplyAdminSelection(wrap, gpSelect);
        return;
      }

      // ✅ User pick buttons: set pending locally (no immediate save)
const gpPick = btn.getAttribute("data-gppick");
if (gpPick) {
  const eventId = btn.getAttribute("data-eid") || "";
  if (!eventId) return;

  // respect locked/disabled
  if (btn.disabled) return;

  // toggle: tap same side again clears it
  const cur = gpPendingGet(eventId);
  if (cur === gpPick) gpPendingSet(eventId, "");
  else gpPendingSet(eventId, gpPick);

  // quick UI update
gpUpdateSaveBtnUI();

// ✅ update active states in-place (no full re-render)
const row = btn.closest(".gpGameRow");
if (row) {
  const eid = eventId;
  const curPick = gpPendingGet(eid) || String(row.getAttribute("data-saved") || "");
  const awayBtn = row.querySelector('button[data-gppick="away"]');
  const homeBtn = row.querySelector('button[data-gppick="home"]');
  if (awayBtn) awayBtn.classList.toggle("gpBtnActive", curPick === "away");
  if (homeBtn) homeBtn.classList.toggle("gpBtnActive", curPick === "home");
}

// ❌ REMOVE this line if it exists:
// renderPicks(false);

return;
} // ✅ CLOSE gpPick block

      // Admin actions
      const gpAdmin = btn.getAttribute("data-gpadmin");
      if (gpAdmin) {
        const leagueKey = btn.getAttribute("data-league") || "";
        const dateYYYYMMDD = btn.getAttribute("data-date") || "";

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

            const statusEl = document.getElementById("gpAdminStatus");
            if (statusEl) statusEl.textContent = "Creating + Publishing…";

            const wrap = btn.closest('[data-gpadminwrap="1"]');
            const lockVal = (wrap?.querySelector('input[data-gplock="1"]')?.value || "").trim();
            const lockDate = lockVal ? new Date(lockVal) : null;

            const checks = Array.from(wrap?.querySelectorAll('input[type="checkbox"][data-gpcheck="1"]') || []);
            const selected = new Set(
              checks
                .filter(c => c.checked)
                .map(c => String(c.getAttribute("data-eid") || ""))
                .filter(Boolean)
            );

            if (gpAdmin === "createPublish") {
              if (selected.size === 0) {
                if (statusEl) statusEl.textContent = "Select at least 1 game first.";
                alert("Select at least 1 game first.");
                return;
              }

              if (!lockDate || isNaN(lockDate.getTime())) {
                if (statusEl) statusEl.textContent = "Set a valid lock time first.";
                alert("Set a valid lock time first (use the Lock Time field).");
                return;
              }

              const events = await fetchEventsFor(leagueKey, dateYYYYMMDD);
              await gpAdminCreatePublishSlate(db, leagueKey, dateYYYYMMDD, uid, selected, events, lockDate);

              const sid = slateIdFor(leagueKey, dateYYYYMMDD);
              const slateRef = db.collection("pickSlates").doc(sid);
              const gamesSnap = await slateRef.collection("games").get();
              const gameCount = gamesSnap.size || 0;

              if (statusEl) statusEl.textContent =
                `Slate LIVE ✅ (${gameCount} game${gameCount === 1 ? "" : "s"}) • locks at ${lockDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

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