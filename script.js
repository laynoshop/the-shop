let refreshIntervalId = null;
let currentTab = null;

const STORAGE_KEY = "theShopLeague_v1";
const DATE_KEY = "theShopDate_v1"; // stores YYYYMMDD

// Favorites (top priority, in this order)
const FAVORITES = [
  "Ohio State Buckeyes",
  "Duke Blue Devils",
  "West Virginia Mountaineers",
  "Columbus Blue Jackets",
  "Carolina Hurricanes",
  "Carolina Panthers",
  "Dallas Cowboys",
  "Boston Red Sox",
  "Cleveland Guardians"
];

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Leagues for dropdown
const LEAGUES = [
  {
    key: "ncaam",
    name: "Men’s College Basketball",
    // groups=50 => All Division I (prevents the “one featured game” issue)
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

function parseUserDateToYYYYMMDD(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (lower === "today" || lower === "t") return formatDateYYYYMMDD(new Date());

  // Accept YYYY-MM-DD or YYYY/MM/DD
  let m = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const dt = new Date(yyyy, mm - 1, dd);
    if (dt && dt.getFullYear() === yyyy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) {
      return formatDateYYYYMMDD(dt);
    }
    return null;
  }

  // Accept MM/DD/YYYY or M/D/YYYY
  m = raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    const dt = new Date(yyyy, mm - 1, dd);
    if (dt && dt.getFullYear() === yyyy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) {
      return formatDateYYYYMMDD(dt);
    }
    return null;
  }

  // Accept YYYYMMDD
  m = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const dt = new Date(yyyy, mm - 1, dd);
    if (dt && dt.getFullYear() === yyyy && dt.getMonth() === (mm - 1) && dt.getDate() === dd) {
      return formatDateYYYYMMDD(dt);
    }
    return null;
  }

  return null;
}

function getSavedDateYYYYMMDD() {
  const saved = localStorage.getItem(DATE_KEY);
  if (saved && /^\d{8}$/.test(saved)) return saved;
  // default to today
  const today = formatDateYYYYMMDD(new Date());
  localStorage.setItem(DATE_KEY, today);
  return today;
}

function saveDateYYYYMMDD(yyyymmdd) {
  localStorage.setItem(DATE_KEY, yyyymmdd);
}

function yyyymmddToPretty(yyyymmdd) {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return "";
  const yyyy = Number(yyyymmdd.slice(0, 4));
  const mm = Number(yyyymmdd.slice(4, 6));
  const dd = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(yyyy, mm - 1, dd);
  return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* =========================
   LOGO HELPERS
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
/* ======================= */

/* =========================
   FAVORITES SORTING
   ========================= */
const FAVORITES_NORM = FAVORITES.map(norm);

function getTeamIdentityStrings(team) {
  // We match on displayName primarily (your list), but also include a few safe alternates
  const displayName = team?.displayName || "";
  const shortName = team?.shortDisplayName || "";
  const name = team?.name || "";
  const location = team?.location || "";
  const abbrev = team?.abbreviation || "";

  // Build some typical ESPN combos like "Ohio State Buckeyes"
  const combo1 = location && name ? `${location} ${name}` : "";

  return [displayName, combo1, shortName, name, location, abbrev].filter(Boolean);
}

function favoriteRankForEvent(competition) {
  const competitors = competition?.competitors || [];
  let bestRank = Infinity;

  for (const c of competitors) {
    const team = c?.team;
    const ids = getTeamIdentityStrings(team).map(norm);

    // EXACT match to your favorite list entries
    for (let i = 0; i < FAVORITES_NORM.length; i++) {
      if (ids.includes(FAVORITES_NORM[i])) {
        if (i < bestRank) bestRank = i;
      }
    }
  }

  return bestRank; // Infinity means not a favorite game
}

function stateRank(state) {
  // We want: LIVE first, then upcoming, then finals, then other
  if (state === "in") return 0;
  if (state === "pre") return 1;
  if (state === "post") return 2;
  return 3;
}

function getStartTimeMs(event, competition) {
  // ESPN usually provides event.date (ISO string), sometimes competition.date
  const iso = event?.date || competition?.date || "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
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

function buildCalendarButtonHTML() {
  return `<button id="dateBtn" class="iconBtn" aria-label="Choose date">📅</button>`;
}

function promptForDateAndReload() {
  const current = getSavedDateYYYYMMDD();
  const pretty = yyyymmddToPretty(current);

  const input = prompt(
    `Pick a date:\n\n• Enter: YYYY-MM-DD (example: 2026-02-15)\n• Or: MM/DD/YYYY (example: 02/15/2026)\n• Or type: today\n\nCurrent: ${pretty} (${current})`,
    `${current.slice(0,4)}-${current.slice(4,6)}-${current.slice(6,8)}`
  );

  if (input === null) return; // user canceled

  const parsed = parseUserDateToYYYYMMDD(input);
  if (!parsed) {
    alert("Date not recognized. Try YYYY-MM-DD or MM/DD/YYYY.");
    return;
  }

  saveDateYYYYMMDD(parsed);
  loadScores(true);
}

/* =========================
   ESPN FETCH (ROBUST)
   ========================= */
function removeDatesParam(url) {
  return url
    .replace(/\?dates=\d{8}&/i, "?")
    .replace(/\?dates=\d{8}$/i, "")
    .replace(/&dates=\d{8}&/i, "&")
    .replace(/&dates=\d{8}$/i, "");
}

async function fetchScoreboardWithFallbacks(league, yyyymmdd) {
  const baseUrl = league.endpoint(yyyymmdd);

  // Use selected date for yesterday/tomorrow as well
  const yyyy = Number(yyyymmdd.slice(0, 4));
  const mm = Number(yyyymmdd.slice(4, 6));
  const dd = Number(yyyymmdd.slice(6, 8));
  const baseDate = new Date(yyyy, mm - 1, dd);

  const yesterday = new Date(baseDate.getTime() - 86400000);
  const tomorrow = new Date(baseDate.getTime() + 86400000);
  const yDate = formatDateYYYYMMDD(yesterday);
  const tDate = formatDateYYYYMMDD(tomorrow);

  const isNcaam = league.key === "ncaam";

  const attempts = [
    { label: "selectedDate", url: baseUrl },

    // NCAAM-only: try removing groups in case ESPN behavior shifts
    ...(isNcaam ? [{ label: "ncaam-noGroups", url: baseUrl.replace(/&groups=50/i, "") }] : []),

    // General: noDate lets ESPN decide “today” (mostly useful when the selected date is today)
    { label: "noDate", url: removeDatesParam(baseUrl) },

    // Edge cases
    { label: "yesterday", url: league.endpoint(yDate) },
    { label: "tomorrow", url: league.endpoint(tDate) }
  ];

  let lastError = null;

  for (const a of attempts) {
    try {
      const resp = await fetch(a.url, { cache: "no-store" });
      if (!resp.ok) {
        lastError = new Error(`HTTP ${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const events = Array.isArray(data?.events) ? data.events : [];
      if (events.length > 0) {
        return { data, events, used: a.label, url: a.url };
      }
    } catch (e) {
      lastError = e;
    }
  }

  return { data: null, events: [], used: "none", url: "", error: lastError };
}
/* ======================= */

async function loadScores(showLoading) {
  const content = document.getElementById("content");

  const selectedDate = getSavedDateYYYYMMDD();
  const prettyDate = yyyymmddToPretty(selectedDate);

  const now = new Date();
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
          <div class="sublineLeft">
            ${buildLeagueSelectHTML(selectedKey)}
            ${buildCalendarButtonHTML()}
          </div>
          <div>${escapeHtml(prettyDate)} • Loading…</div>
        </div>
      </div>
      <div class="notice">Grabbing games…</div>
    `;
  }

  try {
    const result = await fetchScoreboardWithFallbacks(league, selectedDate);
    let events = result.events;

    // Header with dropdown + calendar + updated time + selected date
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
          <div class="sublineLeft">
            ${buildLeagueSelectHTML(selectedKey)}
            ${buildCalendarButtonHTML()}
          </div>
          <div>${escapeHtml(prettyDate)} • Updated ${updatedTime}</div>
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

    // Wire calendar button
    const dateBtn = document.getElementById("dateBtn");
    if (dateBtn) {
      dateBtn.addEventListener("click", () => {
        promptForDateAndReload();
      });
    }

    if (events.length === 0) {
      content.innerHTML += `
        <div class="notice">
          No games found for this league/date (likely offseason).
          <div style="margin-top:8px; opacity:0.6; font-size:12px;">
            (Tried ESPN fallbacks: ${escapeHtml(result.used)})
          </div>
        </div>
      `;
      return;
    }

    // FAVORITES-FIRST SORT (still shows ALL games)
    // 1) Favorite games first (by your favorite order)
    // 2) Within that: LIVE > UPCOMING > FINAL > OTHER
    // 3) Then by start time
    // 4) Then stable fallback by event id/name
    events = [...events].sort((a, b) => {
      const ca = a?.competitions?.[0];
      const cb = b?.competitions?.[0];

      const ra = favoriteRankForEvent(ca);
      const rb = favoriteRankForEvent(cb);

      const aFav = Number.isFinite(ra) ? ra : Infinity;
      const bFav = Number.isFinite(rb) ? rb : Infinity;

      if (aFav !== bFav) return aFav - bFav;

      const sa = a?.status?.type?.state || "unknown";
      const sb = b?.status?.type?.state || "unknown";
      const sr = stateRank(sa) - stateRank(sb);
      if (sr !== 0) return sr;

      const ta = getStartTimeMs(a, ca);
      const tb = getStartTimeMs(b, cb);
      if (ta !== tb) return ta - tb;

      const ida = String(a?.id || a?.uid || a?.name || "");
      const idb = String(b?.id || b?.uid || b?.name || "");
      return ida.localeCompare(idb);
    });

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

      // LOGOS
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
          <div class="sublineLeft">
            ${buildLeagueSelectHTML(getSavedLeagueKey())}
            ${buildCalendarButtonHTML()}
          </div>
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

    const dateBtn = document.getElementById("dateBtn");
    if (dateBtn) {
      dateBtn.addEventListener("click", () => {
        promptForDateAndReload();
      });
    }
  }
}
