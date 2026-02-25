function gpBuildAdminSlateHTML(events, leagueKey, dateYYYYMMDD) {
  // Default: pre-select all games
  const rows = (events || []).map(ev => {
    const eventId = String(ev?.id || "");
    if (!eventId) return "";
    const { homeName, awayName, iso } = getMatchupNamesFromEvent(ev);

    return `
      <div class="gpAdminRow">
        <label class="gpAdminLabel">
          <input type="checkbox" checked data-gpcheck="1" data-eid="${escapeHtml(eventId)}" />
          <span class="gpAdminText">${escapeHtml(awayName)} @ ${escapeHtml(homeName)}</span>
          <span class="muted gpAdminTime">${escapeHtml(fmtKickoff(iso))}</span>
        </label>
      </div>
    `;
  }).join("");

  return `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">ADMIN: SLATE BUILDER</div>
      </div>
      <div class="gameMetaTopLine">${escapeHtml(leagueKey.toUpperCase())} • ${escapeHtml(dateYYYYMMDD)}</div>
      <div class="gameMetaOddsLine">Select games, then Create/Replace, then Publish</div>

      <div style="margin-top:8px;">
        ${rows || `<div class="notice">No games to build a slate from.</div>`}
      </div>

      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="smallBtn" data-gpadmin="create" data-league="${escapeHtml(leagueKey)}" data-date="${escapeHtml(dateYYYYMMDD)}">Create/Replace Slate</button>
        <button class="smallBtn" data-gpadmin="publish" data-league="${escapeHtml(leagueKey)}" data-date="${escapeHtml(dateYYYYMMDD)}">Publish Slate</button>
      </div>

      <div class="muted" id="gpAdminStatus" style="margin-top:8px;"></div>
    </div>
  `;
}

function gpBuildGroupPicksCardHTML({ slateId, games, myMap, published }) {
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

  const rows = (games || []).map(g => {
    const eventId = String(g?.eventId || g?.id || "");
    if (!eventId) return "";

    const homeName = String(g?.homeName || "Home");
    const awayName = String(g?.awayName || "Away");

    const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
    const locked = startMs ? (Date.now() >= startMs) : false;

    const my = myMap?.[eventId]?.side || "";

    return `
      <div class="gpGameRow">
        <div class="gpMatchup">
          <div class="gpTeams">${escapeHtml(awayName)} @ ${escapeHtml(homeName)}</div>
          <div class="muted">${startMs ? new Date(startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}${locked ? " • LOCKED" : ""}</div>
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
      </div>
    `;
  }).join("");

  return `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">GROUP PICKS</div>
      </div>
      <div class="gameMetaTopLine">Slate is live</div>
      <div class="gameMetaOddsLine">Picks lock at game start</div>
      ${rows || `<div class="notice">No games in slate.</div>`}
    </div>
  `;
}

/* =========================
   PICKS (Firebase / Firestore)
   - Locked once submitted
   - Units-only scoring
   - Auto-grade when games go FINAL
   ========================= */

const PICKS_ROOM_ID = "main";
const PICKS_COLLECTION = "picks";
const PICKS_NAME_KEY = "theShopPicksName_v1";

function getPicksDisplayName() {
  // Prefer existing chat name if it exists
  const existingChat = (localStorage.getItem("shopChatName") || "").trim();
  if (existingChat) return existingChat.slice(0, 20);

  let name = (localStorage.getItem(PICKS_NAME_KEY) || "").trim();
  if (!name) {
    name = (prompt("Name for Picks leaderboard (example: Victor):", "") || "").trim();
    if (!name) name = "Anon";
    localStorage.setItem(PICKS_NAME_KEY, name.slice(0, 20));
  }
  return name.slice(0, 20);
}

function picksDocRef(db, id) {
  return db.collection("rooms").doc(PICKS_ROOM_ID).collection(PICKS_COLLECTION).doc(id);
}

function picksCollectionRef(db) {
  return db.collection("rooms").doc(PICKS_ROOM_ID).collection(PICKS_COLLECTION);
}

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampUnits(u) {
  // Allowed: 0.5 to 5 (and common increments)
  const n = safeNum(u, 0);
  if (n <= 0) return 0;
  const clamped = Math.max(0.5, Math.min(5, n));
  // round to nearest 0.5
  return Math.round(clamped * 2) / 2;
}

function pickKey(leagueKey, dateYYYYMMDD, eventId) {
  return `${leagueKey}|${dateYYYYMMDD}|${eventId}`;
}

function parsePickSelection(raw) {
  return String(raw || "").trim().slice(0, 60);
}

function normalizePickType(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "ml" || s === "moneyline") return "ml";
  if (s === "ou" || s === "o/u" || s === "total" || s === "totals") return "ou";
  return "spread";
}

// Compute win/loss/push based on final score + pick data
function gradePickAgainstFinal(pick, finalHome, finalAway) {
  // pick.side: "home" | "away" | "over" | "under"
  // pick.type: "spread" | "ml" | "ou"
  const type = pick?.type;
  const side = pick?.side;
  const line = safeNum(pick?.line, 0);

  const home = safeNum(finalHome, 0);
  const away = safeNum(finalAway, 0);

  if (type === "ml") {
    // winner only
    const diff = home - away;
    if (diff === 0) return "push";
    const winner = diff > 0 ? "home" : "away";
    return winner === side ? "win" : "loss";
  }

  if (type === "spread") {
    // line applies to chosen side
    // If side=home: homeScore + line vs awayScore
    // If side=away: awayScore + line vs homeScore
    let a, b;
    if (side === "home") {
      a = home + line;
      b = away;
    } else {
      a = away + line;
      b = home;
    }
    if (a === b) return "push";
    return a > b ? "win" : "loss";
  }

  // OU
  if (type === "ou") {
    const total = home + away;
    if (total === line) return "push";
    if (side === "over") return total > line ? "win" : "loss";
    return total < line ? "win" : "loss";
  }
}

function outcomeToNetUnits(outcome, units) {
  if (outcome === "win") return units;
  if (outcome === "loss") return -units;
  return 0;
}

function renderPicksHeaderHTML(rightLabel) {
  const selectedDate = getSavedDateYYYYMMDD();
  const prettyDate = yyyymmddToPretty(selectedDate);
  const selectedKey = getSavedLeagueKey();

  return `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Picks</h2>
          <span class="badge">Units</span>
        </div>

        <div class="headerActions">
          <button class="smallBtn" data-picksaction="refresh">Refresh</button>
        </div>
      </div>

      <div class="subline">
        <div class="sublineLeft">
          ${buildLeagueSelectHTML(selectedKey)}
          ${buildCalendarButtonHTML()}
          <button class="iconBtn" data-picksaction="addQuick" title="Add pick">＋</button>
        </div>
        <div>${escapeHtml(prettyDate)} • ${escapeHtml(rightLabel || "")}</div>
      </div>
    </div>
  `;
}

async function renderPicks(showLoading) {
  const content = document.getElementById("content");
  const selectedDate = getSavedDateYYYYMMDD();
  const selectedKey = getSavedLeagueKey();
  const league = getLeagueByKey(selectedKey);

  if (showLoading) {
    content.innerHTML = `
      ${renderPicksHeaderHTML("Loading…")}
      <div class="notice">Loading picks + games…</div>
    `;
  }

  try {
