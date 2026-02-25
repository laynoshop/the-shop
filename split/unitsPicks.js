    await ensureFirebaseChatReady(); // re-uses your firebase init/auth
    const db = firebase.firestore();

    // 1) Load scoreboard for current league/date (we’ll use it to show games + grade finals)
    const sb = await fetchScoreboardWithFallbacks(league, selectedDate);
    const events = sb.events || [];

    // 2) Load recent picks for THIS league/date (shared competition)
    const picksSnap = await picksCollectionRef(db)
      .where("leagueKey", "==", selectedKey)
      .where("dateYYYYMMDD", "==", selectedDate)
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    const picks = [];
    picksSnap.forEach(doc => picks.push({ id: doc.id, ...doc.data() }));

    // 3) Auto-grade any pending picks where the game is FINAL
    await autoGradePicksForEvents(db, picks, events);

    // Re-read (so UI reflects grading)
    const picksSnap2 = await picksCollectionRef(db)
      .where("leagueKey", "==", selectedKey)
      .where("dateYYYYMMDD", "==", selectedDate)
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    const picks2 = [];
    picksSnap2.forEach(doc => picks2.push({ id: doc.id, ...doc.data() }));

    // 4) GROUP PICKS (Pick’em) — render ABOVE Units Picks
    let groupPicksHTML = "";
    try {
      const role = getRole();
      const user = firebase.auth().currentUser;
      const uid = user?.uid || "";

      // For now, skip Group Picks on PGA since it's a tournament not head-to-head
      if (!isPgaLeagueKey(selectedKey)) {
        // Admin builder UI
        const eventsSorted = [...events].sort((a, b) => kickoffMsFromEvent(a) - kickoffMsFromEvent(b));
        const adminHTML = (role === "admin")
          ? gpBuildAdminSlateHTML(eventsSorted, selectedKey, selectedDate)
          : "";

        // Published slate UI
        const publishedSlate = await gpGetPublishedSlate(db, selectedKey, selectedDate);

        if (!publishedSlate) {
          groupPicksHTML =
            adminHTML +
            gpBuildGroupPicksCardHTML({
              slateId: slateIdFor(selectedKey, selectedDate),
              games: [],
              myMap: {},
              published: false
            });
        } else {
          const sid = publishedSlate.id;
          const slateGames = await gpGetSlateGames(db, sid);
          const myMap = uid ? await gpGetMyPicksMap(db, sid, uid) : {};
          groupPicksHTML =
            adminHTML +
            gpBuildGroupPicksCardHTML({
              slateId: sid,
              games: slateGames,
              myMap,
              published: true
            });
        }
      }
    } catch (e) {
      console.error("Group Picks load error:", e);
      groupPicksHTML = `
        <div class="game">
          <div class="gameHeader">
            <div class="statusPill status-other">GROUP PICKS</div>
          </div>
          <div class="gameMetaTopLine">Couldn’t load Group Picks</div>
          <div class="gameMetaOddsLine">Try Refresh.</div>
        </div>
      `;
    }

    // 5) Units Picks (existing system) — keep intact under Group Picks
    const leaderboard = computeLeaderboard(picks2);
    const leaderboardHTML = renderLeaderboardHTML(leaderboard);

    const myName = getPicksDisplayName();
    const myPicks = picks2.filter(p => String(p.name || "") === myName);

    const myPicksHTML = renderPicksListHTML(myPicks, "My Picks");
    const allPicksHTML = renderPicksListHTML(picks2, "All Picks");

    // 6) Render games list (Add Pick buttons)
    const gamesHTML = renderGamesForPickEntryHTML(events, selectedKey, selectedDate);

    // 7) Final render
    const nowLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    content.innerHTML = `
      ${renderPicksHeaderHTML(`Updated ${escapeHtml(nowLabel)}`)}

      <div class="grid">
        ${groupPicksHTML}
        ${leaderboardHTML}
        ${myPicksHTML}
        ${allPicksHTML}
        ${gamesHTML}
      </div>
    `;
  } catch (e) {
    console.error("renderPicks error:", e);
    content.innerHTML = `
      ${renderPicksHeaderHTML("Error")}
      <div class="notice">Couldn’t load Picks. Try Refresh.</div>
    `;
  }
}

function computeLeaderboard(picks) {
  // Per-user: units net, W/L/P counts, streak (simple)
  const byUser = new Map();

  const sortedOldToNew = [...(picks || [])].sort((a, b) => {
    const ta = a?.createdAt?.toMillis ? a.createdAt.toMillis() : safeNum(a?.createdAtMs, 0);
    const tb = b?.createdAt?.toMillis ? b.createdAt.toMillis() : safeNum(b?.createdAtMs, 0);
    return ta - tb;
  });

  for (const p of sortedOldToNew) {
    const name = String(p?.name || "Anon");
    if (!byUser.has(name)) {
      byUser.set(name, { name, net: 0, w: 0, l: 0, push: 0, streak: "" , _streakCount: 0, _streakType: ""});
    }
    const u = byUser.get(name);

    const outcome = String(p?.outcome || "").toLowerCase(); // win/loss/push/pending
    const units = safeNum(p?.units, 0);

    if (outcome === "win") { u.w++; u.net += units; updateStreak(u, "W"); }
    else if (outcome === "loss") { u.l++; u.net -= units; updateStreak(u, "L"); }
    else if (outcome === "push") { u.push++; updateStreak(u, "P"); }
    else { /* pending: no impact */ }
  }

  const rows = Array.from(byUser.values()).map(u => {
    const total = u.w + u.l;
    const wp = total ? Math.round((u.w / total) * 100) : 0;
    const streak = u._streakType ? `${u._streakType}${u._streakCount}` : "—";
    return { ...u, wp, streak };
  });

  rows.sort((a, b) => (b.net - a.net) || (b.wp - a.wp) || (b.w - a.w) || a.name.localeCompare(b.name));
  return rows;
}

function updateStreak(u, type) {
  // ignore pushes for streak type (optional). I’ll keep them as neutral.
  if (type === "P") return;

  if (u._streakType === type) u._streakCount += 1;
  else { u._streakType = type; u._streakCount = 1; }
}

function renderLeaderboardHTML(rows) {
  const lines = (rows || []).slice(0, 10).map((r, idx) => {
    const net = (r.net >= 0 ? `+${r.net.toFixed(1)}` : r.net.toFixed(1));
    return `
      <div class="teamRow leaderboardRow">
        <div class="teamLeft">
          <div class="teamName">${escapeHtml(String(idx + 1))}. ${escapeHtml(r.name)}</div>
          <div class="teamMeta">W-L: ${r.w}-${r.l} • Push: ${r.push} • Win%: ${r.wp}% • Streak: ${escapeHtml(r.streak)}</div>
        </div>
        <div class="score">${escapeHtml(net)}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">LEADERBOARD</div>
      </div>
      <div class="gameMetaTopLine">Units (Today)</div>
      <div class="gameMetaOddsLine">Win = +Units • Loss = -Units • Push = 0</div>
      ${lines || `<div class="notice">No picks yet. Be first.</div>`}
    </div>
  `;
}

function renderPicksListHTML(picks, title) {
  const items = (picks || []).slice(0, 25).map(p => {
    const name = escapeHtml(String(p?.name || "Anon"));
    const type = escapeHtml(String(p?.type || "spread").toUpperCase());
    const selection = escapeHtml(String(p?.selection || "—"));
    const units = safeNum(p?.units, 0);
    const outcome = String(p?.outcome || "pending").toLowerCase();

    const pillClass =
      outcome === "win" ? "status-live" :
      outcome === "loss" ? "status-up" :
      outcome === "push" ? "status-final" : "status-other";

    const pillText =
      outcome === "win" ? "WIN" :
      outcome === "loss" ? "LOSS" :
      outcome === "push" ? "PUSH" : "PENDING";

    return `
      <div class="teamRow">
        <div class="teamLeft">
          <div class="teamName">${name} • ${type}</div>
          <div class="teamMeta">${selection} • ${units}u</div>
        </div>
        <div class="statusPill ${pillClass}">${pillText}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">${escapeHtml(title.toUpperCase())}</div>
      </div>
      <div class="gameMetaTopLine">${escapeHtml(title)}</div>
      <div class="gameMetaOddsLine">${(picks || []).length ? `${(picks || []).length} pick(s)` : "—"}</div>
      ${items || `<div class="notice">None yet.</div>`}
    </div>
  `;
}

function renderGamesForPickEntryHTML(events, leagueKey, dateYYYYMMDD) {
  const list = (events || []).slice(0, 30).map(ev => {
    const comp = ev?.competitions?.[0];
    if (!comp) return "";

    const home = comp.competitors.find(t => t.homeAway === "home");
    const away = comp.competitors.find(t => t.homeAway === "away");

    const homeName = escapeHtml(getTeamDisplayNameUI(home?.team));
    const awayName = escapeHtml(getTeamDisplayNameUI(away?.team));

    const state = ev?.status?.type?.state || "unknown";
    const detail = ev?.status?.type?.detail || "—";
    const pillClass = statusClassFromState(state);
    const pillText = statusLabelFromState(state, detail);

    const eventId = String(ev?.id || "");
    const kickoff = String(ev?.date || comp?.date || "");
    const timeLabel = kickoff ? new Date(kickoff).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";

    return `
      <div class="teamRow">
        <div class="teamLeft">
          <div class="teamName">${awayName} @ ${homeName}</div>
          <div class="teamMeta">${escapeHtml(timeLabel)} • ${escapeHtml(leagueKey.toUpperCase())}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <div class="statusPill ${pillClass}">${escapeHtml(pillText)}</div>
          <button class="smallBtn"
            data-picksaction="add"
            data-eventid="${escapeHtml(eventId)}"
            data-league="${escapeHtml(leagueKey)}"
            data-date="${escapeHtml(dateYYYYMMDD)}"
            style="padding:8px 10px;border-radius:12px;">
            Add
          </button>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">ADD PICKS</div>
      </div>
      <div class="gameMetaTopLine">Tap “Add” on a game</div>
      <div class="gameMetaOddsLine">Locked after submit</div>
      ${list || `<div class="notice">No games on this slate.</div>`}
    </div>
  `;
}

async function autoGradePicksForEvents(db, picks, events) {
  if (!picks || !picks.length) return;
  if (!events || !events.length) return;

  // Build event final score lookup
  const finals = new Map(); // eventId -> { state, home, away }
  for (const ev of events) {
    const comp = ev?.competitions?.[0];
    if (!comp) continue;
    const eventId = String(ev?.id || "");
    if (!eventId) continue;

    const state = ev?.status?.type?.state || "unknown";
    const home = comp?.competitors?.find(t => t.homeAway === "home");
    const away = comp?.competitors?.find(t => t.homeAway === "away");

    const homeScore = safeNum(home?.score, 0);
    const awayScore = safeNum(away?.score, 0);

    finals.set(eventId, { state, homeScore, awayScore });
  }

  // Only grade pending picks for events that are FINAL
  const toUpdate = [];
  for (const p of picks) {
    const outcome = String(p?.outcome || "pending").toLowerCase();
    if (outcome !== "pending" && outcome !== "") continue;

    const eventId = String(p?.eventId || "");
    const fin = finals.get(eventId);
    if (!fin) continue;
    if (fin.state !== "post") continue;

    const result = gradePickAgainstFinal(p, fin.homeScore, fin.awayScore);
    const units = safeNum(p?.units, 0);
    const netUnits = outcomeToNetUnits(result, units);

    toUpdate.push({ id: p.id, outcome: result, netUnits });
  }

  if (!toUpdate.length) return;

  const batch = db.batch();
  for (const u of toUpdate.slice(0, 250)) {
    batch.update(picksDocRef(db, u.id), {
      outcome: u.outcome,
      netUnits: u.netUnits,
      gradedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
}

async function addPickFlowFromEvent(eventId, leagueKey, dateYYYYMMDD) {
  await ensureFirebaseChatReady();
  const db = firebase.firestore();

  const name = getPicksDisplayName();

  // Choose type
  const typeRaw = prompt("Pick type: spread / ml / ou", "spread");
  if (typeRaw === null) return;
  const type = normalizePickType(typeRaw);

  let side = "";
  let selection = "";
  let line = 0;

  if (type === "ou") {
    const overUnder = prompt("Over or Under? (type: over / under)", "over");
    if (overUnder === null) return;
    side = String(overUnder || "").trim().toLowerCase().startsWith("u") ? "under" : "over";

    const lineRaw = prompt("Total number (example: 47.5)", "");
    if (lineRaw === null) return;
    line = safeNum(lineRaw, 0);

    selection = `${side.toUpperCase()} ${line}`;
  } else {
    const sideRaw = prompt("Home or Away? (type: home / away)", "home");
    if (sideRaw === null) return;
    side = String(sideRaw || "").trim().toLowerCase().startsWith("a") ? "away" : "home";

    if (type === "spread") {
      const lineRaw = prompt("Spread line (example: -6.5). Use + for underdog.", "");
      if (lineRaw === null) return;
      line = safeNum(lineRaw, 0);
      selection = `${side.toUpperCase()} ${line}`;
    } else {
      // ML
      selection = `${side.toUpperCase()} ML`;
      line = 0;
    }
  }

  // Units
  const unitsRaw = prompt("Units (0.5 to 5). Win=+u, Loss=-u", "1");
  if (unitsRaw === null) return;
  const units = clampUnits(unitsRaw);
  if (!units) {
    alert("Units must be between 0.5 and 5.");
    return;
  }

  // Confirm (locked)
  const ok = confirm(`Submit this pick (LOCKED)?\n\n${name}\n${selection}\n${units}u`);
  if (!ok) return;

  // Save
  await picksCollectionRef(db).add({
    name: sanitizeTTUNText(name).slice(0, 20),
    eventId: String(eventId || ""),
    leagueKey: String(leagueKey || ""),
    dateYYYYMMDD: String(dateYYYYMMDD || ""),

    type,
    side,
    line,
    selection: sanitizeTTUNText(selection),

    units,
    outcome: "pending",
    netUnits: 0,

    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAtMs: Date.now()
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  // Tabs
  const tab = btn.getAttribute("data-tab");
  if (tab) {
    showTab(tab);
    return;
  }

  // News filters
  const filter = btn.getAttribute("data-newsfilter");
  if (filter) {
    currentNewsFilter = filter;
    sessionStorage.setItem(NEWS_FILTER_KEY, filter);

    const cached = loadNewsCache();
    const headerUpdated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if (cached && cached.items && cached.items.length) {
      renderNewsList(cached.items, headerUpdated, cached.updatedLabel || "");
    } else {
      renderTopNews(true);
    }
    return;
  }

  // Shop Chat Send
  if (btn.id === "chatSendBtn") {
    sendShopChatMessage();
    return;
  }

  // Picks actions
  const act = btn.getAttribute("data-picksaction");
  if (act) {
    if (act === "refresh") {
      renderPicks(true);
      return;
    }

    if (act === "addQuick") {
      alert("Tap Add on a game card below to attach it to a real matchup.");
      return;
    }

    if (act === "add") {
      const eventId = btn.getAttribute("data-eventid");
      const leagueKey = btn.getAttribute("data-league");
      const dateYYYYMMDD = btn.getAttribute("data-date");

      addPickFlowFromEvent(eventId, leagueKey, dateYYYYMMDD)
        .then(() => renderPicks(true))
        .catch(() => alert("Couldn’t submit pick. Check Firebase rules/connection."));
      return;
    }
  }
});

function updateDaysSinceWin(){
  const lastWinDate = new Date("2024-11-30T00:00:00");
  const now = new Date();
  const diffDays = Math.floor((now - lastWinDate) / (1000 * 60 * 60 * 24));
  const d = Math.max(0, diffDays);

  const el = document.getElementById("daysSinceWin");
  if (el){
    el.innerHTML = `
      <div class="daysNumber">${d}</div>
      <div class="daysLabel">DAYS SINCE TTUN WON IN THE GAME</div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", updateDaysSinceWin);

document.addEventListener("DOMContentLoaded", updateDaysSinceWin);

// Call it right away on load
updateDaysSinceWin();

/* =========================
   Window exports (keeps inline onclick working)
   ========================= */

const __originalShowTab = showTab;
showTab = function(tab) {
  __originalShowTab(tab);
  setTimeout(() => replaceMichiganText(), 0);
};


// exports (AFTER wrapping)
window.checkCode = checkCode;
window.showTab = showTab;

window.loadScores = loadScores;
window.renderBeatTTUN = renderBeatTTUN;
window.renderTopNews = renderTopNews;
window.renderShop = renderShop;
window.logout = logout;
window.renderPicks = renderPicks;
