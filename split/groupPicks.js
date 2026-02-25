/* split/groupPicks.js
   =========================
   GROUP PICKS (Pick'em Slate) — SINGLE SOURCE for Picks tab
   - Overrides any older Units picks renderPicks
   - Admin: build slate from ESPN events, set lock time, Create/Replace, Publish
   - Users: pick home/away, see everyone’s picks
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
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
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
    // fallback
    return safeGetLS("theShopLeague_v1").trim() || "nfl";
  }

  function getSavedDateYYYYMMDDSafe() {
  // Prefer the shared/global implementation
  if (typeof window.getSavedDateYYYYMMDD === "function") return window.getSavedDateYYYYMMDD();

  // Fallback to the same key used in the big script:
  const DATE_KEY = "theShopDate_v1"; // stores YYYYMMDD

  let saved = "";
  try { saved = String(localStorage.getItem(DATE_KEY) || "").trim(); } catch { saved = ""; }
  if (/^\d{8}$/.test(saved)) return saved;

  // fallback: today
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

  function buildLeagueSelectHTMLSafe(selectedKey) {
  // If the shared/global version exists, use it
  if (typeof window.buildLeagueSelectHTML === "function") {
    return window.buildLeagueSelectHTML(selectedKey);
  }

  // -----------------------------
  // Split-build fallback league selector (self-contained)
  // -----------------------------
  const LEAGUE_KEY = "theShopLeague_v1";

  // Minimal league list (matches the big script)
  const LEAGUES_FALLBACK = [
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

  function getLeaguesList() {
    // Prefer a global list if your split build exposes one, else fallback
    const list = Array.isArray(window.LEAGUES) && window.LEAGUES.length ? window.LEAGUES : LEAGUES_FALLBACK;
    // ensure stable shape
    return list
      .map(l => ({ key: String(l.key || ""), name: String(l.name || l.label || l.key || "") }))
      .filter(l => l.key);
  }

  function getValidSelectedKey(k) {
    const list = getLeaguesList();
    const wanted = String(k || "").trim();
    if (list.some(x => x.key === wanted)) return wanted;
    return (list[0] && list[0].key) ? list[0].key : "nfl";
  }

  function saveLeagueKey(k) {
    const key = String(k || "").trim();
    if (!key) return;
    try { localStorage.setItem(LEAGUE_KEY, key); } catch {}
  }

  // Inline handler used by the <select onchange="...">
  if (typeof window.handleLeagueChangeFromEl !== "function") {
    window.handleLeagueChangeFromEl = function (el) {
      const v = String(el?.value || "").trim();
      if (!v) return;

      // Prefer shared saver if it exists
      if (typeof window.saveLeagueKey === "function") {
        window.saveLeagueKey(v);
      } else {
        saveLeagueKey(v);
      }

      // Re-render Picks (prefer the router so tab state stays consistent)
      if (typeof window.showTab === "function") {
        window.showTab("picks");
      } else if (typeof window.renderPicks === "function") {
        window.renderPicks(true);
      }
    };
  }

  const leagues = getLeaguesList();
  const sel = getValidSelectedKey(selectedKey);

  const options = leagues
    .map(l => `<option value="${esc(l.key)}"${l.key === sel ? " selected" : ""}>${esc(l.name)}</option>`)
    .join("");

  return `
    <select class="leagueSelect" aria-label="Choose league" onchange="handleLeagueChangeFromEl(this)">
      ${options}
    </select>
  `;
}

  function buildCalendarButtonHTMLSafe() {
  // If the shared/global version exists, use it
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

  // ✅ Inline handler needs to exist on window
  if (typeof window.handleNativeDateChangeFromEl !== "function") {
    window.handleNativeDateChangeFromEl = function (el) {
      const v = el?.value || "";
      const yyyymmdd = inputValueToYYYYMMDD(v);
      if (!yyyymmdd) return;

      // Save date (prefer shared/global saver if present)
      if (typeof window.saveDateYYYYMMDD === "function") {
        window.saveDateYYYYMMDD(yyyymmdd);
      } else {
        try { localStorage.setItem(DATE_KEY, yyyymmdd); } catch {}
      }

      // Re-render Picks (prefer showTab so tabs stay consistent)
      if (typeof window.showTab === "function") {
        window.showTab("picks");
      } else if (typeof window.renderPicks === "function") {
        window.renderPicks(true);
      }
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

  function getLeagueByKeySafe(key) {
    if (typeof window.getLeagueByKey === "function") return window.getLeagueByKey(key);
    // fallback: search LEAGUES
    const list = Array.isArray(window.LEAGUES) ? window.LEAGUES : [];
    return list.find(l => String(l.key) === String(key)) || null;
  }

  async function ensureFirebaseReadySafe() {
    if (typeof window.ensureFirebaseChatReady === "function") return window.ensureFirebaseChatReady();
    // minimal fallback: init app if needed
    if (window.firebase && window.FIREBASE_CONFIG && !firebase.apps?.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      try { await firebase.auth().signInAnonymously(); } catch {}
    }
  }

  function getPicksDisplayName() {
    // Prefer chat name if present
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
  // pickSlates/{league__date}
  //   fields: leagueKey,dateYYYYMMDD,published,lockAt,...
  //   games/{eventId} fields: eventId,homeName,awayName,startTime
  //   picks/{uid} fields: uid,name,updatedAt
  //     games/{eventId} fields: uid,name,side,updatedAt
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

  async function fetchEventsFor(leagueKey, dateYYYYMMDD) {
    // Prefer your existing robust fetch helper if present
    const league = getLeagueByKeySafe(leagueKey);
    if (!league) return [];

    if (typeof window.fetchScoreboardWithFallbacks === "function") {
      const sb = await window.fetchScoreboardWithFallbacks(league, dateYYYYMMDD);
      return Array.isArray(sb?.events) ? sb.events : [];
    }

    // Basic fallback (direct ESPN)
    const url = (typeof league.endpoint === "function") ? league.endpoint(dateYYYYMMDD) : "";
    if (!url) return [];
    const r = await fetch(url);
    const j = await r.json().catch(() => ({}));
    return Array.isArray(j?.events) ? j.events : [];
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

  async function gpAdminPublishSlate(db, leagueKey, dateYYYYMMDD, uid, lockDate) {
    const slateId = slateIdFor(leagueKey, dateYYYYMMDD);
    const slateRef = db.collection("pickSlates").doc(slateId);

    if (!(lockDate instanceof Date) || isNaN(lockDate.getTime())) {
      alert("Please set a valid Lock Time before publishing.");
      return null;
    }

    await slateRef.set({
      published: true,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: uid,
      lockAt: firebase.firestore.Timestamp.fromDate(lockDate)
    }, { merge: true });

    return slateId;
  }

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
            <input type="checkbox" checked data-gpcheck="1" data-eid="${esc(eventId)}" />
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
        <div class="gameMetaOddsLine">Select games, set lock time, then Create/Replace and Publish.</div>

        <div style="margin-top:12px;">
          <label style="display:block; margin-bottom:6px;">
            Lock Time:
            <input type="datetime-local" data-gplock="1" />
          </label>
          <div class="muted" style="margin-top:4px;">Local time on this device.</div>
        </div>

        <div style="margin-top:8px;">
          ${rows || `<div class="notice">No games to build a slate from.</div>`}
        </div>

        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="smallBtn" data-gpadmin="create" data-league="${esc(leagueKey)}" data-date="${esc(dateYYYYMMDD)}">Create/Replace Slate</button>
          <button class="smallBtn" data-gpadmin="publish" data-league="${esc(leagueKey)}" data-date="${esc(dateYYYYMMDD)}">Publish Slate</button>
        </div>

        <div class="muted" id="gpAdminStatus" style="margin-top:8px;"></div>
      </div>
    `;
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
    const lockLine = lockMs
      ? `Locks at ${new Date(lockMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "Picks lock at game start";

    const now = Date.now();

    const rows = (games || []).map(g => {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";

      const homeName = String(g?.homeName || "Home");
      const awayName = String(g?.awayName || "Away");

      const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;

      // Lock behavior:
      // - If lockAt exists, lock at lockAt
      // - Otherwise lock at game start
      const locked = lockMs ? (now >= lockMs) : (startMs ? now >= startMs : false);

      const my = myMap?.[eventId]?.side || "";

      const everyone = Array.isArray(allPicks?.[eventId]) ? allPicks[eventId] : [];
      const everyoneLines = everyone.length
        ? everyone.map(p => {
            const nm = String(p?.name || "Someone");
            const side = String(p?.side || "");
            const pickedTeam = (side === "away") ? awayName : (side === "home" ? homeName : "—");
            return `<div class="gpPickLine"><b>${esc(nm)}:</b> ${esc(pickedTeam)}</div>`;
          }).join("")
        : `<div class="muted">No picks yet.</div>`;

      return `
        <div class="gpGameRow">
          <div class="gpMatchup">
            <div class="gpTeams">${esc(awayName)} @ ${esc(homeName)}</div>
            <div class="muted">
              ${startMs ? new Date(startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
              ${locked ? " • LOCKED" : ""}
            </div>
          </div>

          <div class="gpButtons">
            <button class="gpBtn ${my === "away" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
              data-gppick="away" data-slate="${esc(slateId)}" data-eid="${esc(eventId)}">
              ${esc(awayName)}
            </button>

            <button class="gpBtn ${my === "home" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
              data-gppick="home" data-slate="${esc(slateId)}" data-eid="${esc(eventId)}">
              ${esc(homeName)}
            </button>
          </div>

          <details class="gpEveryone" ${locked ? "open" : ""}>
            <summary class="gpEveryoneSummary">Everyone’s Picks</summary>
            <div class="gpEveryoneBody">${everyoneLines}</div>
          </details>
        </div>
      `;
    }).join("");

    return `
      <div class="game">
        <div class="gameHeader">
          <div class="statusPill status-other">GROUP PICKS</div>
        </div>
        <div class="gameMetaTopLine">Slate is live</div>
        <div class="gameMetaOddsLine">${esc(lockLine)}</div>
        ${rows || `<div class="notice">No games in slate.</div>`}
      </div>
    `;
  }

  // -----------------------------
  // Main Picks renderer (this is what showTab('picks') calls)
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

      // Ensure auth user exists
      const user = firebase?.auth?.().currentUser;
      if (!user) {
        // If your ensureFirebaseChatReady signs in, this will usually be non-null.
        // If not, attempt anonymous sign-in.
        try { await firebase.auth().signInAnonymously(); } catch {}
      }

      const db = firebase.firestore();
      const uid = firebase.auth().currentUser?.uid || "";

      // Fetch ESPN events for admin slate builder
      const role = getRole();
      const events = await fetchEventsFor(selectedKey, selectedDate);

      const adminHTML = (role === "admin")
        ? gpBuildAdminSlateHTML(events, selectedKey, selectedDate)
        : "";

      const sid = slateIdFor(selectedKey, selectedDate);
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

      // Guests shouldn’t see builder; they’ll just see waiting card until published
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
    // Match your header pattern used elsewhere
    return `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Picks</h2>
            <span class="badge">Group</span>
          </div>

          <div class="headerActions">
            <button class="smallBtn" data-gpaction="name">Name</button>
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

  function postRender() {
    try { setPicksNameUI(); } catch {}
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
      if (act === "addQuick") {
        alert("Quick-add is coming soon. Group Picks slate is the main workflow.");
        return;
      }

      // User pick buttons
      const gpPick = btn.getAttribute("data-gppick");
      if (gpPick) {
        const slateId = btn.getAttribute("data-slate") || "";
        const eventId = btn.getAttribute("data-eid") || "";

        ensureFirebaseReadySafe()
          .then(async () => {
            const db = firebase.firestore();
            const uid = firebase.auth().currentUser?.uid || "";
            if (!uid) throw new Error("No uid (not signed in)");
            await gpSaveMyPick(db, slateId, uid, eventId, gpPick);
          })
          .then(() => renderPicks(true))
          .catch((err) => {
            console.error("gpSaveMyPick error:", err);
            const code = err?.code ? `\n\nCode: ${err.code}` : "";
            const msg = err?.message ? `\n${err.message}` : "";
            alert("Couldn’t save pick." + code + msg);
          });

        return;
      }

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
            if (statusEl) statusEl.textContent = (gpAdmin === "publish") ? "Publishing…" : "Saving slate…";

            const wrap = btn.closest('[data-gpadminwrap="1"]');
            const lockVal = (wrap?.querySelector('input[data-gplock="1"]')?.value || "").trim();
            const lockDate = lockVal ? new Date(lockVal) : null;

            // Read checked games
            const checks = Array.from(document.querySelectorAll('input[type="checkbox"][data-gpcheck="1"]'));
            const selected = new Set(
              checks
                .filter(c => c.checked)
                .map(c => String(c.getAttribute("data-eid") || ""))
                .filter(Boolean)
            );

            const sid = slateIdFor(leagueKey, dateYYYYMMDD);
            const slateRef = db.collection("pickSlates").doc(sid);

            if (gpAdmin === "create") {
              if (selected.size === 0) {
                if (statusEl) statusEl.textContent = "Select at least 1 game first.";
                alert("Select at least 1 game first.");
                return;
              }

              const events = await fetchEventsFor(leagueKey, dateYYYYMMDD);
              await gpAdminCreateOrReplaceSlate(db, leagueKey, dateYYYYMMDD, uid, selected, events);

              const gamesSnap = await slateRef.collection("games").get();
              const gameCount = gamesSnap.size || 0;

              if (statusEl) statusEl.textContent = `Slate saved ✅ (${gameCount} game${gameCount === 1 ? "" : "s"})`;
              return;
            }

            if (gpAdmin === "publish") {
              const slateSnap = await slateRef.get();
              if (!slateSnap.exists) {
                if (statusEl) statusEl.textContent = "Create the slate first.";
                alert("No slate exists yet. Tap Create/Replace Slate first.");
                return;
              }

              if (!lockDate || isNaN(lockDate.getTime())) {
                if (statusEl) statusEl.textContent = "Set a valid lock time first.";
                alert("Set a valid lock time first (use the Lock Time field).");
                return;
              }

              await gpAdminPublishSlate(db, leagueKey, dateYYYYMMDD, uid, lockDate);

              if (statusEl) statusEl.textContent =
                `Slate published ✅ (locks at ${lockDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`;

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