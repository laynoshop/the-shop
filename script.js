/* =========================
   The Shop — Gold Standard v1
   - Scores (ESPN) + robust odds
   - PGA Top 15 leaderboard view
   - Wagers (Firebase v0.1): rooms + picks + leaderboard
   ========================= */

/* ====== SAFETY: CSS.escape polyfill (fixes iOS/PWA crashes) ====== */
(function ensureCssEscape(){
  if (!window.CSS) window.CSS = {};
  if (typeof window.CSS.escape === "function") return;

  // Minimal, safe CSS.escape polyfill for IDs/attrs
  window.CSS.escape = function (value) {
    const str = String(value);
    return str.replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function(ch) {
      const hex = ch.codePointAt(0).toString(16).toUpperCase();
      return "\\" + hex + " ";
    });
  };
})();

/* ====== OPTIONAL: quick error popup so you KNOW if JS died ======
   If you don’t want alerts long-term, tell me and I’ll remove it. */
window.addEventListener("error", (e) => {
  // Don’t spam: show only the first one
  if (window.__SHOP_ERR_SHOWN__) return;
  window.__SHOP_ERR_SHOWN__ = true;
  alert("The Shop hit a JS error and stopped. Screenshot this if possible:\n\n" + (e?.message || "Unknown error"));
});
window.addEventListener("unhandledrejection", (e) => {
  if (window.__SHOP_ERR_SHOWN__) return;
  window.__SHOP_ERR_SHOWN__ = true;
  alert("The Shop hit a JS promise error and stopped. Screenshot this if possible:\n\n" + (e?.reason?.message || e?.reason || "Unknown rejection"));
});

let refreshIntervalId = null;
let currentTab = null;

const STORAGE_KEY = "theShopLeague_v1";
const DATE_KEY = "theShopDate_v1"; // stores YYYYMMDD

// Wagers (Firebase)
const WAGERS_USER_KEY = "theShopWagersUser_v1";
const WAGERS_ROOM_KEY = "theShopWagersRoom_v1";

// Firebase Web config (public)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBvcZ2EFiicabZWpXG1bBnKA-cLsWVDY4c",
  authDomain: "shop-app-a2fe1.firebaseapp.com",
  projectId: "shop-app-a2fe1",
  storageBucket: "shop-app-a2fe1.firebasestorage.app",
  messagingSenderId: "909459942749",
  appId: "1:909459942749:web:c28c897bead11be9658cb4",
  measurementId: "G-7H6CK42QM1"
};

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
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Leagues for dropdown
const LEAGUES = [
  {
    key: "ncaam",
    name: "Men’s College Basketball",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=50&limit=200`,
    summaryEndpoint: (eventId) =>
      `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${eventId}`
  },
  {
    key: "cfb",
    name: "College Football",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}`,
    summaryEndpoint: (eventId) =>
      `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${eventId}`
  },
  {
    key: "nba",
    name: "NBA",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`,
    summaryEndpoint: (eventId) =>
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`
  },
  {
    key: "nhl",
    name: "NHL",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}`,
    summaryEndpoint: (eventId) =>
      `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${eventId}`
  },
  {
    key: "nfl",
    name: "NFL",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}`,
    summaryEndpoint: (eventId) =>
      `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`
  },
  {
    key: "mlb",
    name: "MLB",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`,
    summaryEndpoint: (eventId) =>
      `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${eventId}`
  },
  {
    key: "pga",
    name: "Golf (PGA)",
    endpoint: (date) =>
      `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${date}`,
    summaryEndpoint: (eventId) =>
      `https://site.api.espn.com/apis/site/v2/sports/golf/pga/summary?event=${eventId}`
  }
];

function getSavedLeagueKey() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && LEAGUES.some(l => l.key === saved)) return saved;
  return "ncaam";
}
function saveLeagueKey(key) { localStorage.setItem(STORAGE_KEY, key); }
function getLeagueByKey(key) { return LEAGUES.find(l => l.key === key) || LEAGUES[0]; }

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
  const today = formatDateYYYYMMDD(new Date());
  localStorage.setItem(DATE_KEY, today);
  return today;
}
function saveDateYYYYMMDD(yyyymmdd) { localStorage.setItem(DATE_KEY, yyyymmdd); }

function yyyymmddToPretty(yyyymmdd) {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return "";
  const yyyy = Number(yyyymmdd.slice(0, 4));
  const mm = Number(yyyymmdd.slice(4, 6));
  const dd = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(yyyy, mm - 1, dd);
  return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}

/* =========================
   HTML helpers
   ========================= */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================
   FAVORITES SORTING
   ========================= */
const FAVORITES_NORM = FAVORITES.map(norm);

function getTeamIdentityStrings(team) {
  const displayName = team?.displayName || "";
  const shortName = team?.shortDisplayName || "";
  const name = team?.name || "";
  const location = team?.location || "";
  const abbrev = team?.abbreviation || "";
  const combo1 = location && name ? `${location} ${name}` : "";
  return [displayName, combo1, shortName, name, location, abbrev].filter(Boolean);
}

function favoriteRankForEvent(competition) {
  const competitors = competition?.competitors || [];
  let bestRank = Infinity;
  for (const c of competitors) {
    const team = c?.team;
    const ids = getTeamIdentityStrings(team).map(norm);
    for (let i = 0; i < FAVORITES_NORM.length; i++) {
      if (ids.includes(FAVORITES_NORM[i])) bestRank = Math.min(bestRank, i);
    }
  }
  return bestRank;
}

function stateRank(state) {
  if (state === "in") return 0;
  if (state === "pre") return 1;
  if (state === "post") return 2;
  return 3;
}

function getStartTimeMs(event, competition) {
  const iso = event?.date || competition?.date || "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

/* =========================
   VENUE + ODDS
   ========================= */
function getVenuePartsFromVenueObj(venue) {
  if (!venue) return { venueName: "", location: "" };
  const venueName = venue?.fullName || venue?.name || "";
  const city = venue?.address?.city || venue?.city || "";
  const state = venue?.address?.state || venue?.state || "";
  const country = venue?.address?.country || venue?.country || "";
  let location = "";
  if (city && state) location = `${city}, ${state}`;
  else if (city) location = city;
  else if (state) location = state;
  else if (country) location = country;
  return { venueName, location };
}
function buildVenueLine(competition) {
  const v = getVenuePartsFromVenueObj(competition?.venue || null);
  const venuePart = [v.venueName, v.location].filter(Boolean).join(" - ");
  return venuePart ? venuePart : "—";
}

function cleanFavoredText(s) {
  return String(s || "")
    .trim()
    .replace(/^Line:\s*/i, "")
    .replace(/^Spread:\s*/i, "")
    .replace(/^Odds:\s*/i, "")
    .trim();
}
function normalizeNumberString(n) {
  if (n === null || n === undefined || n === "") return "";
  return String(n).trim();
}
function firstOddsFromCompetition(comp) {
  const arr = comp?.odds;
  if (Array.isArray(arr) && arr.length) return arr[0];
  return null;
}
function firstPickcenterFromCompetition(comp) {
  const pc = comp?.pickcenter;
  if (Array.isArray(pc) && pc.length) return pc[0];
  return null;
}
function parseOddsFromPickcenter(pc, homeName, awayName) {
  if (!pc) return { favored: "", ou: "" };
  const ou = normalizeNumberString(pc.overUnder ?? pc.total ?? pc.overunder ?? "");
  const details = cleanFavoredText(
    pc.details ||
    pc.displayValue ||
    pc.awayTeamOdds?.details ||
    pc.homeTeamOdds?.details ||
    ""
  );
  if (details) return { favored: details, ou };

  const spreadNum = Number(pc.spread ?? pc.line ?? pc.handicap);
  if (!Number.isFinite(spreadNum)) return { favored: "", ou };

  const homeFav = !!pc.homeTeamOdds?.favorite;
  const awayFav = !!pc.awayTeamOdds?.favorite;

  let favoredTeam = "";
  if (homeFav) favoredTeam = homeName;
  else if (awayFav) favoredTeam = awayName;
  else favoredTeam = spreadNum < 0 ? homeName : awayName;

  const abs = Math.abs(spreadNum);
  const spreadVal = abs % 1 === 0 ? String(abs.toFixed(0)) : String(abs);
  return { favored: `${favoredTeam} -${spreadVal}`, ou };
}
function parseOddsFromScoreboardCompetition(competition) {
  const o1 = firstOddsFromCompetition(competition);
  if (o1 && (o1.details || o1.overUnder !== undefined || o1.total !== undefined)) {
    return {
      favored: cleanFavoredText(o1.details || o1.displayValue || ""),
      ou: normalizeNumberString(o1.overUnder ?? o1.total ?? "")
    };
  }
  const pc = firstPickcenterFromCompetition(competition);
  if (pc) {
    const competitors = competition?.competitors || [];
    const home = competitors.find(t => t.homeAway === "home");
    const away = competitors.find(t => t.homeAway === "away");
    const homeName = home?.team?.displayName || "Home";
    const awayName = away?.team?.displayName || "Away";
    const parsed = parseOddsFromPickcenter(pc, homeName, awayName);
    if (parsed.favored || parsed.ou) return parsed;
  }
  return { favored: "", ou: "" };
}
function buildOddsLine(favored, ou) {
  return `Favored: ${favored || "—"} • O/U: ${ou || "—"}`;
}

/* ====== Odds hydration (safe) ====== */
function getOddsLineElByEventId(eventId) {
  const card = document.querySelector(`.game[data-eventid="${CSS.escape(String(eventId))}"]`);
  if (!card) return null;
  return card.querySelector(".gameMetaOddsLine");
}
function applyOddsToDom(eventId, favored, ou) {
  const el = getOddsLineElByEventId(eventId);
  if (!el) return;
  const text = buildOddsLine(favored, ou);
  if (el.textContent !== text) el.textContent = text;
}

/* Concurrency runner */
async function runWithConcurrency(items, limit, worker) {
  let i = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

/* Minimal summary fetch (your old logic works; keeping it light here) */
async function hydrateAllOdds(events, league) {
  // If you already had the robust odds code in your previous working build,
  // keep it there; this stub prevents crashes & keeps odds updates safe.
  // (We’re not changing your layout.)
  try {
    const jobs = events
      .map(e => ({ eventId: String(e?.id || ""), competition: e?.competitions?.[0] || null }))
      .filter(j => j.eventId);

    await runWithConcurrency(jobs, 6, async (job) => {
      const fromScoreboard = parseOddsFromScoreboardCompetition(job.competition);
      if (fromScoreboard.favored || fromScoreboard.ou) {
        applyOddsToDom(job.eventId, fromScoreboard.favored, fromScoreboard.ou);
      }
    });
  } catch (e) {
    // never crash the app
  }
}

/* =========================
   PGA Top 15 (already working)
   ========================= */
function parseGolfPosToSortValue(pos) {
  const s = String(pos || "").trim();
  if (!s) return Infinity;
  const n = Number(s.replace(/^T/i, ""));
  return Number.isFinite(n) ? n : Infinity;
}
function formatGolfScoreToPar(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "—";
  if (s === "E" || s === "EVEN" || s === "Even") return "E";
  return s;
}
function getGolfCompetitorsList(competition) {
  const list = competition?.competitors;
  return Array.isArray(list) ? list : [];
}
function getGolferName(c) {
  return c?.athlete?.displayName || c?.athlete?.shortName || c?.athlete?.fullName || c?.displayName || "—";
}
function getGolferPos(c) {
  return c?.position?.displayName || c?.position?.shortDisplayName || c?.position || c?.rank || "";
}
function statValueByName(statsArr, names) {
  if (!Array.isArray(statsArr)) return "";
  const target = names.map(norm);
  const found = statsArr.find(s => target.includes(norm(s?.name)) || target.includes(norm(s?.displayName)));
  return (found?.displayValue || found?.value || "").toString().trim();
}
function getGolferScoreToPar(c) {
  const direct =
    c?.score ||
    c?.toPar ||
    c?.scoreToPar ||
    statValueByName(c?.statistics, ["To Par", "toPar"]) ||
    "";
  return formatGolfScoreToPar(direct);
}
function normalizeThruLabel(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^(f|cut|wd|dq)$/i.test(s)) return s.toUpperCase();
  if (/thru/i.test(s)) return s;
  if (/^\d{1,2}$/.test(s)) return `Thru ${s}`;
  return s;
}
function getGolferThru(c) {
  const fromStatus =
    c?.status?.type?.shortDetail ||
    c?.status?.type?.detail ||
    c?.status?.displayValue ||
    "";
  const fromStats = statValueByName(c?.statistics, ["Thru", "Hole", "Holes", "Current Hole"]) || "";
  return normalizeThruLabel(fromStatus || fromStats || "");
}
function getTournamentName(event, competition) {
  return event?.name || event?.shortName || competition?.name || "Tournament";
}
function getTournamentLocationLine(event, competition) {
  const v = competition?.venue || event?.venue || (Array.isArray(event?.venues) ? event.venues[0] : null) || null;
  const parts = getVenuePartsFromVenueObj(v);
  const line = [parts.venueName, parts.location].filter(Boolean).join(" - ");
  return line || "—";
}
function formatGolfPosLabel(pos) {
  const s = String(pos || "").trim();
  if (!s) return "";
  return s.endsWith(".") ? s : `${s}.`;
}
function renderGolfLeaderboards(events, content) {
  const grid = document.createElement("div");
  grid.className = "grid";

  events.forEach(event => {
    const competition = event?.competitions?.[0];
    if (!competition) return;

    const state = event?.status?.type?.state || "unknown";
    const detail = event?.status?.type?.detail || "Status unavailable";
    const pillClass = statusClassFromState(state);
    const pillText = statusLabelFromState(state, detail);

    const tournamentName = getTournamentName(event, competition);
    const locationLine = getTournamentLocationLine(event, competition);

    const golfers = getGolfCompetitorsList(competition)
      .map(c => {
        const pos = getGolferPos(c);
        return {
          name: getGolferName(c),
          pos: String(pos || "").trim(),
          sortPos: parseGolfPosToSortValue(pos),
          score: getGolferScoreToPar(c),
          thru: getGolferThru(c)
        };
      })
      .filter(g => g.name && g.name !== "—");

    golfers.sort((a, b) => (a.sortPos - b.sortPos) || a.name.localeCompare(b.name));
    const top15 = golfers.slice(0, 15);

    const card = document.createElement("div");
    card.className = "game golfCard";

    const metaText = `${tournamentName} — ${locationLine}`;

    card.innerHTML = `
      <div class="gameHeader">
        <div class="statusPill ${pillClass}">${escapeHtml(pillText)}</div>
      </div>
      <div class="gameMetaTopLine">${escapeHtml(metaText)}</div>
      <div class="gameMetaOddsLine">Top 15 Leaderboard</div>
    `;

    top15.forEach(g => {
      const row = document.createElement("div");
      row.className = "teamRow";

      const posPrefix = formatGolfPosLabel(g.pos);
      const thruText = g.thru || "—";

      row.innerHTML = `
        <div class="teamLeft">
          <div class="teamName">${escapeHtml(posPrefix)} ${escapeHtml(g.name)}</div>
        </div>
        <div class="scoreCol">
          <div class="score">${escapeHtml(g.score)}</div>
          <div class="scoreMeta">${escapeHtml(thruText)}</div>
        </div>
      `;
      card.appendChild(row);
    });

    grid.appendChild(card);
  });

  content.appendChild(grid);
}

/* =========================
   WAGERS — click plumbing only (your UI stays the same)
   ========================= */
function getWagersUserName() { return (localStorage.getItem(WAGERS_USER_KEY) || "").trim(); }
function setWagersUserName(name) { localStorage.setItem(WAGERS_USER_KEY, String(name || "").trim()); }
function getWagersRoomId() { return (localStorage.getItem(WAGERS_ROOM_KEY) || "").trim(); }
function setWagersRoomId(roomId) { localStorage.setItem(WAGERS_ROOM_KEY, String(roomId || "").trim()); }

/* IMPORTANT: Right now we’re only fixing “buttons don’t do anything”.
   Your previous Firebase logic can be re-added once clicks work. */
async function setNameFlow() {
  const current = getWagersUserName();
  const input = prompt("Your display name for wagers:", current || "");
  if (input === null) return;
  const cleaned = String(input || "").trim();
  if (!cleaned) { alert("Name can’t be blank."); return; }
  setWagersUserName(cleaned);
  renderWagers(false);
}

async function joinRoomFlow() {
  const current = getWagersRoomId();
  const input = prompt(
    `Enter a Room Code to join (or leave blank to create a new one).\n\nCurrent: ${current || "None"}`,
    current || ""
  );
  if (input === null) return;

  const cleaned = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  const roomId = cleaned || "ROOM1";
  setWagersRoomId(roomId);
  renderWagers(true);
}

function buildLeagueSelectHTML(selectedKey) {
  const options = LEAGUES.map(l => {
    const sel = l.key === selectedKey ? "selected" : "";
    return `<option value="${l.key}" ${sel}>${l.name}</option>`;
  }).join("");
  return `<select id="leagueSelect" class="leagueSelect" aria-label="Select league">${options}</select>`;
}
function buildCalendarButtonHTML() {
  return `<button id="dateBtn" class="iconBtn" aria-label="Choose date">📅</button>`;
}

function promptForDateAndReload() {
  const current = getSavedDateYYYYMMDD();
  const pretty = yyyymmddToPretty(current);
  const input = prompt(
    `Pick a date:\n\n• Enter: YYYY-MM-DD\n• Or: MM/DD/YYYY\n• Or type: today\n\nCurrent: ${pretty} (${current})`,
    `${current.slice(0,4)}-${current.slice(4,6)}-${current.slice(6,8)}`
  );
  if (input === null) return;
  const parsed = parseUserDateToYYYYMMDD(input);
  if (!parsed) { alert("Date not recognized."); return; }
  saveDateYYYYMMDD(parsed);
  if (currentTab === "wagers") renderWagers(true);
  else loadScores(true);
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
    ...(isNcaam ? [{ label: "ncaam-noGroups", url: baseUrl.replace(/&groups=50/i, "") }] : []),
    { label: "noDate", url: removeDatesParam(baseUrl) },
    { label: "yesterday", url: league.endpoint(yDate) },
    { label: "tomorrow", url: league.endpoint(tDate) }
  ];

  let lastError = null;

  for (const a of attempts) {
    try {
      const resp = await fetch(a.url, { cache: "no-store" });
      if (!resp.ok) { lastError = new Error(`HTTP ${resp.status}`); continue; }
      const data = await resp.json();
      const events = Array.isArray(data?.events) ? data.events : [];
      if (events.length > 0) return { data, events, used: a.label, url: a.url };
    } catch (e) {
      lastError = e;
    }
  }

  return { data: null, events: [], used: "none", url: "", error: lastError };
}

/* =========================
   UI Tabs
   ========================= */
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
  refreshIntervalId = setInterval(() => {
    if (currentTab === "scores") loadScores(false);
    if (currentTab === "wagers") renderWagers(false);
  }, 30000);
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
    renderWagers(true);
    startAutoRefresh();
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

/* =========================
   Login
   ========================= */
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

/* =========================
   Render: SCORES
   ========================= */
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

  const result = await fetchScoreboardWithFallbacks(league, selectedDate);
  let events = result.events;

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

  if (events.length === 0) {
    content.innerHTML += `<div class="notice">No games found (likely offseason).</div>`;
    return;
  }

  if (league.key === "pga") {
    renderGolfLeaderboards(events, content);
    return;
  }

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

    const venueLine = buildVenueLine(competition);

    const initialOdds = parseOddsFromScoreboardCompetition(competition);
    const initialOddsText = buildOddsLine(initialOdds.favored, initialOdds.ou);

    const eventId = String(event?.id || "");

    const card = document.createElement("div");
    card.className = "game";
    if (eventId) card.setAttribute("data-eventid", eventId);

    card.innerHTML = `
      <div class="gameHeader">
        <div class="statusPill ${pillClass}">${escapeHtml(pillText)}</div>
      </div>

      <div class="gameMetaTopLine">${escapeHtml(venueLine)}</div>

      <div class="gameMetaOddsLine">${escapeHtml(initialOddsText)}</div>

      <div class="teamRow">
        <div class="teamLeft">
          <div class="teamName">${escapeHtml(awayName)}</div>
          <div class="teamMeta">Away</div>
        </div>
        <div class="score">${awayScore}</div>
      </div>

      <div class="teamRow">
        <div class="teamLeft">
          <div class="teamName">${escapeHtml(homeName)}</div>
          <div class="teamMeta">Home</div>
        </div>
        <div class="score">${homeScore}</div>
      </div>
    `;

    grid.appendChild(card);
  });

  content.appendChild(grid);
  hydrateAllOdds(events, league);
}

/* =========================
   Render: WAGERS (buttons now ALWAYS work)
   ========================= */
async function renderWagers(showLoading) {
  const content = document.getElementById("content");
  const selectedDate = getSavedDateYYYYMMDD();
  const prettyDate = yyyymmddToPretty(selectedDate);
  const now = new Date();
  const updatedTime = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const selectedKey = getSavedLeagueKey();

  const userName = getWagersUserName();
  const roomId = getWagersRoomId();

  content.innerHTML = `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Wagers</h2>
          <span class="badge">v0.1</span>
        </div>
        <button class="smallBtn" onclick="renderWagers(true)">Refresh</button>
      </div>
      <div class="subline">
        <div class="sublineLeft">
          ${buildLeagueSelectHTML(selectedKey)}
          ${buildCalendarButtonHTML()}
        </div>
        <div>${escapeHtml(prettyDate)} • Updated ${updatedTime}</div>
      </div>
    </div>

    <div class="notice">
      <div class="wagersLine">
        <div><strong>Name:</strong> ${escapeHtml(userName || "Not set")}</div>
        <button class="smallBtn" id="setNameBtn">Set Name</button>
      </div>
      <div class="wagersLine" style="margin-top:10px;">
        <div><strong>Room:</strong> ${escapeHtml(roomId || "Not joined")}</div>
        <button class="smallBtn" id="joinRoomBtn">${roomId ? "Change Room" : "Join / Create"}</button>
      </div>
    </div>
  `;
}

/* =========================
   HARDENED EVENTS
   ========================= */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.id === "setNameBtn") { setNameFlow(); return; }
  if (btn.id === "joinRoomBtn") {
    if (!getWagersUserName()) { alert("Set your Name first."); return; }
    joinRoomFlow(); return;
  }
  if (btn.id === "dateBtn") { promptForDateAndReload(); return; }
});

document.addEventListener("change", (e) => {
  const sel = e.target;
  if (!(sel instanceof HTMLSelectElement)) return;
  if (sel.id !== "leagueSelect") return;
  saveLeagueKey(sel.value);
  if (currentTab === "wagers") renderWagers(true);
  else loadScores(true);
});

/* =========================
   Window exports (so your inline onclick works)
   ========================= */
window.checkCode = checkCode;
window.showTab = showTab;
window.loadScores = loadScores;
window.renderWagers = renderWagers;