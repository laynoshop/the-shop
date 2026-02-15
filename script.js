let refreshIntervalId = null;
let currentTab = null;

const STORAGE_KEY = "theShopLeague_v1";

// Leagues for dropdown
const LEAGUES = [
  {
    key: "ncaam",
    name: "Men’s College Basketball",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}`
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

function getSavedLeagueKey() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && LEAGUES.some(l => l.key === saved)) return saved;
  return "ncaam"; // default
}

function saveLeagueKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

function getLeagueByKey(key) {
  return LEAGUES.find(l => l.key === key) || LEAGUES[0];
}

function formatDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

/* =========================
   LOGO HELPERS (ADDED)
   ========================= */
function getTeamLogoUrl(team) {
  if (!team) return "";
  if (team.logo) return team.logo;

  const logos = team.logos;
  if (Array.isArray(logos) && logos.length > 0) {
    return logos[0].href || "";
  }
  return "";
}

function getTeamAbbrev(team) {
  return team?.abbreviation || team?.shortDisplayName || team?.displayName || "";
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
/* ======================= */

function checkCode() {
  const code = document.getElementById("code").value;
  if (code === "2026") {
    document.getElementById("login").style.display = "none";
    document.getElementById("app").style.display = "block";
    showTab("scores");
  } else {
    alert("Wrong code");
  }
}

function setActiveTabButton(tab) {
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  const map = { scores: 0, wagers: 1, shop: 2 };
  const idx = map[tab];
  const btn = document.querySelectorAll(".tabs button")[idx];
  if (btn) btn.classList.add("active");
}

function stopAutoRefresh() {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  refreshIntervalId = null;
}

function startAutoRefresh() {
  stopAutoRefresh();
  // Refresh current league every 30 seconds while Scores is visible
  refreshIntervalId = setInterval(() => {
    if (currentTab === "scores") loadScores(false);
  }, 30000);
}

function showTab(tab) {
  currentTab = tab;
  setActiveTabButton(tab);
  stopAutoRefresh();

  const content = document.getElementById("content");
  content.innerHTML = "";

  if (tab === "scores") {
    loadScores(true);
    startAutoRefresh();
  } else if (tab === "wagers") {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Friendly Wagers</h2>
            <span class="badge">v0.1</span>
          </div>
        </div>
        <div class="subline">
          <div>Coming next</div>
          <div>Invite-only</div>
        </div>
      </div>
      <div class="notice">Next: tap a game → pick a winner → simple leaderboard.</div>
    `;
  } else if (tab === "shop") {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Shop Updates</h2>
            <span class="badge">v0.1</span>
          </div>
        </div>
        <div class="subline">
          <div>Photos + notes</div>
          <div>Private</div>
        </div>
      </div>
      <div class="notice">Next after wagers: a feed where you post pics/notes.</div>
    `;
  }
}

function statusClassFromState(state) {
  if (state === "in") return "status-live";
  if (state === "post") return "status-final";
  if (state === "pre") return "status-up";
  return "status-other";
}

function statusLabelFromState(state, detail) {
  if (state === "in") return `LIVE • ${detail}`;
  if (state === "post") return `FINAL`;
  if (state === "pre") return `${detail}`;
  return detail || "STATUS";
}

function buildLeagueSelectHTML(selectedKey) {
  const options = LEAGUES.map(l => {
    const sel = l.key === selectedKey ? "selected" : "";
    return `<option value="${l.key}" ${sel}>${l.name}</option>`;
  }).join("");

  return `
    <select id="leagueSelect" class="leagueSelect" aria-label="Select league">
      ${options}
    </select>
  `;
}

async function loadScores(showLoading) {
  const content = document.getElementById("content");

  const now = new Date();
  const date = formatDateYYYYMMDD(now);
  const updatedTime = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const selectedKey = getSavedLeagueKey();
  const league = getLeagueByKey(selectedKey);

  if (showLoading) {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <button class="smallBtn" onclick="loadScores(true)">Refresh</button>
        </div>
        <div class="subline">
          <div>${buildLeagueSelectHTML(selectedKey)}</div>
          <div>Loading…</div>
        </div>
      </div>
      <div class="notice">Grabbing today’s games…</div>
    `;
  }

  try {
    const response = await fetch(league.endpoint(date));
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];

    // Header with dropdown + updated time
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <button class="smallBtn" onclick="loadScores(true)">Refresh</button>
        </div>
        <div class="subline">
          <div>${buildLeagueSelectHTML(selectedKey)}</div>
          <div>Updated ${updatedTime}</div>
        </div>
      </div>
    `;

    // Wire dropdown change
    const sel = document.getElementById("leagueSelect");
    if (sel) {
      sel.addEventListener("change", () => {
        saveLeagueKey(sel.value);
        loadScores(true);
      });
    }

    if (events.length === 0) {
      content.innerHTML += `<div class="notice">No games found today for this league (likely offseason).</div>`;
      return;
    }

    // Show ALL games (scroll)
    const grid = document.createElement("div");
    grid.className = "grid";

    events.forEach(event => {
      const competition = event?.competitions?.[0];
      if (!competition) return;

      const home = competition.competitors.find(t => t.homeAway === "home");
      const away = competition.competitors.find(t => t.homeAway === "away");

      const state = event?.status?.type?.state || "unknown";
      const detail = event?.status?.type?.detail || "Status unavailable";
      const pillClass = statusClassFromState(state);
      const pillText = statusLabelFromState(state, detail);

      const homeScore = home?.score ? parseInt(home.score, 10) : (state === "pre" ? "" : "0");
      const awayScore = away?.score ? parseInt(away.score, 10) : (state === "pre" ? "" : "0");

      const homeName = home?.team?.displayName || "Home";
      const awayName = away?.team?.displayName || "Away";

      // LOGOS (ADDED)
      const homeTeam = home?.team || null;
      const awayTeam = away?.team || null;
      const homeLogo = getTeamLogoUrl(homeTeam);
      const awayLogo = getTeamLogoUrl(awayTeam);
      const homeAbbrev = escapeHtml(getTeamAbbrev(homeTeam)).slice(0, 4);
      const awayAbbrev = escapeHtml(getTeamAbbrev(awayTeam)).slice(0, 4);

      const card = document.createElement("div");
      card.className = "game";

      card.innerHTML = `
        <div class="gameHeader">
          <div class="statusPill ${pillClass}">${pillText}</div>
        </div>

        <div class="teamRow">
          <div class="teamLeft">
            <div class="teamLine">
              ${
                awayLogo
                  ? `<img class="teamLogo" src="${awayLogo}" alt="${escapeHtml(awayName)} logo" loading="lazy" decoding="async" />`
                  : `<div class="teamLogoFallback">${awayAbbrev || "—"}</div>`
              }
              <div class="teamText">
                <div class="teamName">${escapeHtml(awayName)}</div>
                <div class="teamMeta">Away</div>
              </div>
            </div>
          </div>
          <div class="score">${awayScore}</div>
        </div>

        <div class="teamRow">
          <div class="teamLeft">
            <div class="teamLine">
              ${
                homeLogo
                  ? `<img class="teamLogo" src="${homeLogo}" alt="${escapeHtml(homeName)} logo" loading="lazy" decoding="async" />`
                  : `<div class="teamLogoFallback">${homeAbbrev || "—"}</div>`
              }
              <div class="teamText">
                <div class="teamName">${escapeHtml(homeName)}</div>
                <div class="teamMeta">Home</div>
              </div>
            </div>
          </div>
          <div class="score">${homeScore}</div>
        </div>

        <div class="footerLine">
          <div>${competition?.status?.type?.shortDetail || ""}</div>
          <div style="color: rgba(187,0,0,0.9); font-weight:900;">⬤</div>
        </div>
      `;

      grid.appendChild(card);
    });

    content.appendChild(grid);

  } catch (error) {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <button class="smallBtn" onclick="loadScores(true)">Retry</button>
        </div>
        <div class="subline">
          <div>${buildLeagueSelectHTML(getSavedLeagueKey())}</div>
          <div>Error</div>
        </div>
      </div>
      <div class="notice">Couldn’t load scores right now.</div>
    `;

    const sel = document.getElementById("leagueSelect");
    if (sel) {
      sel.addEventListener("change", () => {
        saveLeagueKey(sel.value);
        loadScores(true);
      });
    }
  }
}
