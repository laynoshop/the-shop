// ========== CONFIG ==========
const PAGE_SIZE = 3;              // show only 3 games
const PAGE_HOLD_MS = 10000;       // hold for 10 seconds
const REFRESH_MS = 30000;         // re-fetch current league every 30 seconds while on Scores

// ESPN scoreboard base: https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD
// Golf PGA is supported via /sports/golf/pga/scoreboard :contentReference[oaicite:1]{index=1}
const LEAGUES = [
  {
    key: "ncaam",
    name: "Men’s College Basketball",
    badge: "NCAAM",
    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}`
  },
  {
    key: "cfb",
    name: "College Football",
    badge: "CFB",
    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}`
  },
  {
    key: "nba",
    name: "NBA",
    badge: "NBA",
    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`
  },
  {
    key: "nhl",
    name: "NHL",
    badge: "NHL",
    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}`
  },
  {
    key: "nfl",
    name: "NFL",
    badge: "NFL",
    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}`
  },
  {
    key: "mlb",
    name: "MLB",
    badge: "MLB",
    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`
  },
  {
    key: "pga",
    name: "Golf (PGA)",
    badge: "PGA",
    endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${date}`
  }
];

// Defaults
const DEFAULT_ENABLED = ["ncaam", "cfb", "nba", "nhl", "nfl", "mlb", "pga"];
const DEFAULT_SELECTED = "ncaam";
const STORAGE_KEY = "theShopSettings_v1";

// ========== STATE ==========
let currentTab = null;

let pageTimerId = null;     // rotates pages/leagues every 10s
let refreshTimerId = null;  // re-fetches current league every 30s

let cache = {}; // cache[leagueKey] = { fetchedAt, events: [...] }

let tvMode = true;                // rotation mode on/off
let enabledLeagueKeys = [...DEFAULT_ENABLED];
let selectedLeagueKey = DEFAULT_SELECTED;

let tvLeagueIndex = 0;            // which league in enabled list we're on
let tvPageIndex = 0;              // which "page of 3 games" in the league

// ========== SETTINGS ==========
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.tvMode === "boolean") tvMode = s.tvMode;
    if (Array.isArray(s.enabledLeagueKeys) && s.enabledLeagueKeys.length) enabledLeagueKeys = s.enabledLeagueKeys;
    if (typeof s.selectedLeagueKey === "string") selectedLeagueKey = s.selectedLeagueKey;
  } catch {}
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    tvMode,
    enabledLeagueKeys,
    selectedLeagueKey
  }));
}

function getEnabledLeagues() {
  return LEAGUES.filter(l => enabledLeagueKeys.includes(l.key));
}

function getLeagueByKey(key) {
  return LEAGUES.find(l => l.key === key) || LEAGUES[0];
}

// ========== AUTH ==========
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

// ========== TABS ==========
function setActiveTabButton(tab) {
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  const map = { scores: 0, wagers: 1, shop: 2, leagues: 3 };
  const idx = map[tab];
  const btn = document.querySelectorAll(".tabs button")[idx];
  if (btn) btn.classList.add("active");
}

function stopTimers() {
  if (pageTimerId) clearInterval(pageTimerId);
  if (refreshTimerId) clearInterval(refreshTimerId);
  pageTimerId = null;
  refreshTimerId = null;
}

function showTab(tab) {
  currentTab = tab;
  setActiveTabButton(tab);
  stopTimers();

  const content = document.getElementById("content");
  content.innerHTML = "";

  if (tab === "scores") {
    // load settings
    loadSettings();
    // reset rotation pointers safely
    tvLeagueIndex = 0;
    tvPageIndex = 0;

    renderScoresHeader("Loading…", "Loading…");
    loadAndRenderScores(true);

    // rotate pages/leagues every 10s
    pageTimerId = setInterval(() => {
      if (currentTab !== "scores") return;
      if (!tvMode) return; // only rotate in TV Mode
      advanceTV();
    }, PAGE_HOLD_MS);

    // refresh current league data every 30s
    refreshTimerId = setInterval(() => {
      if (currentTab !== "scores") return;
      refreshCurrentLeague();
    }, REFRESH_MS);

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
      <div class="notice" style="padding:14px; color: rgba(255,255,255,0.75);">
        Next build: tap a game → pick a winner → simple leaderboard.
      </div>
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
      <div class="notice" style="padding:14px; color: rgba(255,255,255,0.75);">
        Next after wagers: post feed (text + photos).
      </div>
    `;
  } else if (tab === "leagues") {
    renderLeaguesPage();
  }
}

// ========== SCOREBOARD HELPERS ==========
function formatDateYYYYMMDD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
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

function renderScoresHeader(leagueName, rightText) {
  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Scores</h2>
          <span class="badge">The Shop</span>
        </div>
        <button class="smallBtn" onclick="manualRefresh()">Refresh</button>
      </div>
      <div class="subline">
        <div>${leagueName}</div>
        <div>${rightText}</div>
      </div>
    </div>
  `;
}

function manualRefresh() {
  // re-fetch and re-render current visible league/page (without changing anything else)
  refreshCurrentLeague(true);
}

async function refreshCurrentLeague(forceRender = false) {
  const league = getCurrentLeagueForDisplay();
  await fetchLeague(league, true);
  if (forceRender) {
    renderCurrent();
  } else {
    // If we're currently showing that league, re-render.
    if (!tvMode && league.key === selectedLeagueKey) renderCurrent();
    if (tvMode) renderCurrent();
  }
}

function getCurrentLeagueForDisplay() {
  const enabled = getEnabledLeagues();
  if (!enabled.length) return getLeagueByKey(DEFAULT_SELECTED);

  if (tvMode) {
    const idx = Math.min(tvLeagueIndex, enabled.length - 1);
    return enabled[idx];
  } else {
    // manual league selected
    if (!enabledLeagueKeys.includes(selectedLeagueKey)) {
      selectedLeagueKey = enabled[0].key;
      saveSettings();
    }
    return getLeagueByKey(selectedLeagueKey);
  }
}

function getEventsForLeague(key) {
  return (cache[key]?.events) ? cache[key].events : [];
}

// TV rotation: step through pages of 3 games; when pages done, advance league.
function advanceTV() {
  const enabled = getEnabledLeagues();
  if (!enabled.length) return;

  const league = enabled[Math.min(tvLeagueIndex, enabled.length - 1)];
  const events = getEventsForLeague(league.key);
  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));

  // advance page
  tvPageIndex++;
  if (tvPageIndex >= pageCount) {
    tvPageIndex = 0;
    tvLeagueIndex++;
    if (tvLeagueIndex >= enabled.length) tvLeagueIndex = 0;
  }

  // Ensure new league has data (fetch if missing/stale)
  const newLeague = enabled[tvLeagueIndex];
  loadLeagueIfNeeded(newLeague).then(() => renderCurrent());
}

async function loadLeagueIfNeeded(league) {
  const entry = cache[league.key];
  const stale = !entry || (Date.now() - entry.fetchedAt) > REFRESH_MS;
  if (stale) {
    await fetchLeague(league, false);
  }
}

async function loadAndRenderScores(showLoading) {
  const league = getCurrentLeagueForDisplay();

  if (showLoading) {
    renderScoresHeader(league.name, "Loading…");
  }

  await fetchLeague(league, false);
  renderCurrent();
}

function renderCurrent() {
  const league = getCurrentLeagueForDisplay();
  const now = new Date();
  const updatedTime = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  renderScoresHeader(league.name, `Updated ${updatedTime}`);

  const content = document.getElementById("content");
  const events = getEventsForLeague(league.key);

  // Decide which page to show
  let pageIndex = 0;
  if (tvMode) pageIndex = tvPageIndex;

  const start = pageIndex * PAGE_SIZE;
  const slice = events.slice(start, start + PAGE_SIZE);

  const pageCount = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const pageLine = document.createElement("div");
  pageLine.style.padding = "10px 14px 0 14px";
  pageLine.style.color = "rgba(255,255,255,0.70)";
  pageLine.style.fontSize = "13px";
  pageLine.innerHTML = `
    ${tvMode ? "TV Mode: ON" : "TV Mode: OFF"} • Showing ${Math.min(start+1, events.length)}-${Math.min(start+slice.length, events.length)} of ${events.length} • Page ${Math.min(pageIndex+1, pageCount)}/${pageCount}
  `;
  content.appendChild(pageLine);

  if (events.length === 0) {
    const msg = document.createElement("div");
    msg.className = "notice";
    msg.style.padding = "14px";
    msg.style.color = "rgba(255,255,255,0.75)";
    msg.textContent = "No events found for this league/date (likely offseason).";
    content.appendChild(msg);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid";

  slice.forEach(event => {
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

    const card = document.createElement("div");
    card.className = "game";

    card.innerHTML = `
      <div class="gameHeader">
        <div class="statusPill ${pillClass}">${pillText}</div>
      </div>

      <div class="teamRow">
        <div class="teamLeft">
          <div class="teamName">${awayName}</div>
          <div class="teamMeta" style="font-size:12px; color: rgba(255,255,255,0.65);">Away</div>
        </div>
        <div class="score">${awayScore}</div>
      </div>

      <div class="teamRow">
        <div class="teamLeft">
          <div class="teamName">${homeName}</div>
          <div class="teamMeta" style="font-size:12px; color: rgba(255,255,255,0.65);">Home</div>
        </div>
        <div class="score">${homeScore}</div>
      </div>

      <div class="footerLine" style="display:flex; justify-content:space-between; color: rgba(255,255,255,0.65); font-size:13px;">
        <div>${competition?.status?.type?.shortDetail || ""}</div>
        <div style="color: rgba(187,0,0,0.9); font-weight:900;">⬤</div>
      </div>
    `;

    grid.appendChild(card);
  });

  content.appendChild(grid);
}

async function fetchLeague(league, force) {
  const now = new Date();
  const date = formatDateYYYYMMDD(now);

  const existing = cache[league.key];
  const stale = !existing || (Date.now() - existing.fetchedAt) > REFRESH_MS;

  if (!force && existing && !stale) return;

  try {
    const response = await fetch(league.endpoint(date));
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];
    cache[league.key] = { fetchedAt: Date.now(), events };
  } catch {
    cache[league.key] = cache[league.key] || { fetchedAt: Date.now(), events: [] };
  }
}

// ========== LEAGUES PAGE ==========
function renderLeaguesPage() {
  loadSettings();

  const content = document.getElementById("content");
  content.innerHTML = `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Leagues</h2>
          <span class="badge">Settings</span>
        </div>
      </div>
      <div class="subline">
        <div>Enable what you want</div>
        <div>TV rotation uses enabled list</div>
      </div>
    </div>

    <div style="padding:14px;">
      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px; margin-bottom: 14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div>
            <div style="font-weight:900;">TV Mode</div>
            <div style="color: rgba(255,255,255,0.70); font-size:13px;">Shows 3 games at a time and rotates every 10 seconds</div>
          </div>
          <label style="display:flex; align-items:center; gap:10px;">
            <input type="checkbox" id="tvModeToggle" ${tvMode ? "checked" : ""} />
          </label>
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px;">
        <div style="font-weight:900; margin-bottom:10px;">Enabled leagues</div>
        <div id="leagueList"></div>
      </div>

      <div style="padding-top:14px; color: rgba(255,255,255,0.70); font-size:13px;">
        Tip: If a league is offseason, you’ll see “No events found” — it will still rotate through it.
      </div>
    </div>
  `;

  const list = document.getElementById("leagueList");
  LEAGUES.forEach(l => {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.alignItems = "center";
    row.style.padding = "10px 0";
    row.style.borderBottom = "1px solid rgba(255,255,255,0.06)";
    row.innerHTML = `
      <div>
        <div style="font-weight:800;">${l.name}</div>
        <div style="color: rgba(255,255,255,0.65); font-size:12px;">${l.badge}</div>
      </div>
      <input type="checkbox" data-key="${l.key}" ${enabledLeagueKeys.includes(l.key) ? "checked" : ""} />
    `;
    list.appendChild(row);
  });

  const tvToggle = document.getElementById("tvModeToggle");
  tvToggle.addEventListener("change", () => {
    tvMode = tvToggle.checked;
    saveSettings();
  });

  list.querySelectorAll("input[type='checkbox'][data-key]").forEach(cb => {
    cb.addEventListener("change", () => {
      const key = cb.getAttribute("data-key");
      if (cb.checked) {
        if (!enabledLeagueKeys.includes(key)) enabledLeagueKeys.push(key);
      } else {
        enabledLeagueKeys = enabledLeagueKeys.filter(k => k !== key);
      }

      // Always ensure at least one league is enabled
      if (enabledLeagueKeys.length === 0) {
        enabledLeagueKeys = ["ncaam"];
      }

      // If selected league got disabled, pick first enabled
      if (!enabledLeagueKeys.includes(selectedLeagueKey)) {
        selectedLeagueKey = enabledLeagueKeys[0];
      }

      saveSettings();
    });
  });
}
