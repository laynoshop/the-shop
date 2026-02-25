/* =========================
   GROUP PICKS (Pick'em Slate) — CLEAN + MATCHES WORKING UI
   - Admin builds slate from ESPN games
   - Admin sets lock time (datetime-local on card)
   - Admin Create/Replace, then Publish
   - Everyone sees published slate + everyone’s picks
   - NO UID UI
   ========================= */

/** ✅ IMPORTANT FIX:
 * Ensure saved league key is REAL (must exist in LEAGUES).
 * This prevents “ncaab” (or any stale key) from breaking Picks/Slates.
 */
function getSavedLeagueKey() {
  let saved = "";
  try {
    saved = String(localStorage.getItem(LEAGUE_KEY) || "").trim();
  } catch (e) {
    saved = String((window.__SK_MEM && window.__SK_MEM[LEAGUE_KEY]) || "").trim();
  }

  const validKeys = new Set((LEAGUES || []).map(l => String(l.key || "")));
  if (saved && validKeys.has(saved)) return saved;

  const fallback =
    (Array.isArray(LEAGUES) && LEAGUES[0] && LEAGUES[0].key)
      ? String(LEAGUES[0].key)
      : "nfl";

  try { localStorage.setItem(LEAGUE_KEY, fallback); }
  catch (e) {
    window.__SK_MEM = window.__SK_MEM || {};
    window.__SK_MEM[LEAGUE_KEY] = fallback;
  }

  return fallback;
}

function slateIdFor(leagueKey, dateYYYYMMDD) {
  return `${leagueKey}__${dateYYYYMMDD}`;
}

function isPgaLeagueKey(k) {
  return String(k || "").toLowerCase() === "pga";
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

  const homeName = getTeamDisplayNameUI(home?.team) || "Home";
  const awayName = getTeamDisplayNameUI(away?.team) || "Away";
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
  const snap = await db.collection("pickSlates").doc(slateId)
    .collection("picks").doc(uid)
    .collection("games")
    .get();

  const map = {};
  snap.forEach(d => map[d.id] = d.data());
  return map;
}

async function gpGetAllPicksForSlate(db, slateId) {
  // Returns: { [eventId]: [ { uid, name, side } ] }
  const out = {};

  const usersSnap = await db.collection("pickSlates").doc(slateId).collection("picks").get();
  const userDocs = usersSnap.docs || [];

  for (const u of userDocs) {
    const uid = u.id;

    const gamesSnap = await db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(uid)
      .collection("games")
      .get();

    gamesSnap.forEach(d => {
      const eventId = d.id;
      const data = d.data() || {};
      const name = String(data.name || "Someone");
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

  const name = (typeof getPicksDisplayName === "function")
    ? String(getPicksDisplayName() || "Someone").trim()
    : "Someone";

  // Ensure parent exists (so everyone-picks scan can find this user)
  await picksUserRef.set({
    uid: String(uid || ""),
    name,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await gameRef.set({
    uid: String(uid || ""),
    name,
    side: String(side || ""),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
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

  // TRUE replace: delete all existing games docs
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
          <input type="checkbox" data-gpcheck="1" data-eid="${escapeHtml(eventId)}" />
          <span class="gpAdminText">${escapeHtml(awayName)} @ ${escapeHtml(homeName)}</span>
          <span class="muted gpAdminTime">${escapeHtml(fmtKickoff(iso))}${started ? " • Started" : ""}</span>
        </label>
      </div>
    `;
  }).join("");

  return `
    <div class="game" data-gpadminwrap="1" data-leaguekey="${escapeHtml(leagueKey)}" data-date="${escapeHtml(dateYYYYMMDD)}">
      <div class="gameHeader">
        <div class="statusPill status-other">ADMIN: SLATE BUILDER</div>
      </div>

      <div class="gameMetaTopLine">
        ${escapeHtml(String(leagueKey || "").toUpperCase())} • ${escapeHtml(dateYYYYMMDD)}
      </div>

      <div class="gameMetaOddsLine">
        Select games, set lock time, then Create/Replace and Publish.
      </div>

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
        <button
          class="smallBtn"
          data-gpadmin="create"
          data-league="${escapeHtml(leagueKey)}"
          data-date="${escapeHtml(dateYYYYMMDD)}">
          Create/Replace Slate
        </button>

        <button
          class="smallBtn"
          data-gpadmin="publish"
          data-league="${escapeHtml(leagueKey)}"
          data-date="${escapeHtml(dateYYYYMMDD)}">
          Publish Slate
        </button>
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

  const rows = (games || []).map(g => {
    const eventId = String(g?.eventId || g?.id || "");
    if (!eventId) return "";

    const homeName = String(g?.homeName || "Home");
    const awayName = String(g?.awayName || "Away");

    const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
    const locked = startMs ? (Date.now() >= startMs) : false;

    const my = myMap?.[eventId]?.side || "";

    const everyone = Array.isArray(allPicks?.[eventId]) ? allPicks[eventId] : [];
    const everyoneLines = everyone.length
      ? everyone.map(p => {
          const nm = String(p?.name || "Someone");
          const side = String(p?.side || "");
          const pickedTeam = (side === "away") ? awayName : (side === "home" ? homeName : "—");
          return `<div class="gpPickLine"><b>${escapeHtml(nm)}:</b> ${escapeHtml(pickedTeam)}</div>`;
        }).join("")
      : `<div class="muted">No picks yet.</div>`;

    return `
      <div class="gpGameRow">
        <div class="gpMatchup">
          <div class="gpTeams">${escapeHtml(awayName)} @ ${escapeHtml(homeName)}</div>
          <div class="muted">
            ${startMs ? new Date(startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
            ${locked ? " • LOCKED" : ""}
          </div>
        </div>

        <div class="gpButtons">
          <button class="gpBtn ${my === "away" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
            data-gppick="away" data-slate="${escapeHtml(slateId)}" data-eid="${escapeHtml(eventId)}">
            ${escapeHtml(awayName)}
          </button>

          <button class="gpBtn ${my === "home" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
            data-gppick="home" data-slate="${escapeHtml(slateId)}" data-eid="${escapeHtml(eventId)}">
            ${escapeHtml(homeName)}
          </button>
        </div>

        <details class="gpEveryone" ${locked ? "open" : ""}>
          <summary class="gpEveryoneSummary">Everyone’s Picks</summary>
          <div class="gpEveryoneBody">
            ${everyoneLines}
          </div>
        </details>
      </div>
    `;
  }).join("");

  const lockLine = lockMs
    ? `Locks at ${new Date(lockMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : "Picks lock at game start";

  return `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">GROUP PICKS</div>
      </div>
      <div class="gameMetaTopLine">Slate is live</div>
      <div class="gameMetaOddsLine">${escapeHtml(lockLine)}</div>
      ${rows || `<div class="notice">No games in slate.</div>`}
    </div>
  `;
}

/* =========================
   ✅ Drop-in for renderPicks() GROUP PICKS section
   Replace ONLY the "GROUP PICKS" part inside renderPicks with this helper.
   ========================= */

async function gpRenderSectionHTML({ db, selectedKey, selectedDate, events }) {
  let groupPicksHTML = "";

  const role = getRole();
  const uid = firebase.auth().currentUser?.uid || "";

  if (isPgaLeagueKey(selectedKey)) return ""; // skip PGA

  const eventsSorted = [...(events || [])].sort((a, b) => kickoffMsFromEvent(a) - kickoffMsFromEvent(b));

  const adminHTML = (role === "admin")
    ? gpBuildAdminSlateHTML(eventsSorted, selectedKey, selectedDate)
    : "";

  const sid = slateIdFor(selectedKey, selectedDate);
  const slateRef = db.collection("pickSlates").doc(sid);
  const slateSnap = await slateRef.get();

  if (!slateSnap.exists) {
    groupPicksHTML =
      adminHTML +
      gpBuildGroupPicksCardHTML({
        slateId: sid,
        games: [],
        myMap: {},
        allPicks: {},
        published: false
      });
    return groupPicksHTML;
  }

  const slateData = slateSnap.data() || {};
  const isPublished = slateData.published === true;

  if (!isPublished && role !== "admin") {
    groupPicksHTML =
      gpBuildGroupPicksCardHTML({
        slateId: sid,
        games: [],
        myMap: {},
        allPicks: {},
        published: false
      });
    return groupPicksHTML;
  }

  const slateGames = await gpGetSlateGames(db, sid);
  const myMap = uid ? await gpGetMyPicksMap(db, sid, uid) : {};
  const allPicks = await gpGetAllPicksForSlate(db, sid);

  groupPicksHTML =
    adminHTML +
    gpBuildGroupPicksCardHTML({
      slateId: sid,
      games: slateGames,
      myMap,
      allPicks,
      published: isPublished,
      lockAt: slateData.lockAt || null
    });

  return groupPicksHTML;
}

/* =========================
   ✅ Replace your GROUP PICKS click handling with this
   (inside your existing document.addEventListener("click", ...) )
   ========================= */

// --- GROUP PICKS actions ---
// (A) User pick buttons (home/away)
function __handleGroupPickClick(btn) {
  const gpPick = btn.getAttribute("data-gppick");
  if (!gpPick) return false;

  const slateId = btn.getAttribute("data-slate") || "";
  const eventId = btn.getAttribute("data-eid") || "";

  ensureFirebaseChatReady()
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

  return true;
}

// (B) Admin slate buttons (create/publish)
function __handleGroupAdminClick(btn) {
  const gpAdmin = btn.getAttribute("data-gpadmin");
  if (!gpAdmin) return false;

  const leagueKey = btn.getAttribute("data-league") || "";
  const dateYYYYMMDD = btn.getAttribute("data-date") || "";

  ensureFirebaseChatReady()
    .then(async () => {
      const roleLocal = getRole();
      if (roleLocal !== "admin") {
        alert("Admin only.");
        return;
      }

      const db = firebase.firestore();
      const uid = firebase.auth().currentUser?.uid || "";
      if (!uid) throw new Error("No uid (not signed in)");

      // Confirm server role doc exists (rules depend on this)
      const userSnap = await db.collection("users").doc(uid).get();
      const serverRole = userSnap.exists ? String((userSnap.data() || {}).role || "") : "";
      if (serverRole !== "admin") {
        alert(
          "Your account is not admin on the server yet.\n\n" +
          "Fix:\n1) Log out\n2) Enter the ADMIN invite code again\n\n" +
          "That creates users/{uid}.role = admin."
        );
        return;
      }

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

        const league = getLeagueByKey(leagueKey);
        const sb = await fetchScoreboardWithFallbacks(league, dateYYYYMMDD);
        const events = sb.events || [];

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

  return true;
}