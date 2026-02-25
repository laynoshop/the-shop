/* =========================
   The Shop — Gold Standard v1 (Updated)
   - Scores (ESPN) + robust odds hydration
   - PGA Top 15 leaderboard view
   - NEW: Beat TTUN (Hype Mode)
   - NEW: Top News (ESPN)
   - Shop tab (placeholder hub)
   - HARDENED for iOS/PWA (CSS.escape polyfill + event delegation)
   ========================= */

/* =========================
   FIREBASE CONFIG (Shop Chat)
   ========================= */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBK09tMYLKcDLTMLVn2gYpsezCJAax0Y9Y",
  authDomain: "the-shop-chat.firebaseapp.com",
  projectId: "the-shop-chat",
  storageBucket: "the-shop-chat.firebasestorage.app",
  messagingSenderId: "98648984848",
  appId: "1:98648984848:web:c4e876c8acdb00d8ba2995"
};

/* ====== SAFETY: CSS.escape polyfill (fixes iOS/PWA crashes) ====== */
(function ensureCssEscape(){
  if (!window.CSS) window.CSS = {};
  if (typeof window.CSS.escape === "function") return;

  window.CSS.escape = function (value) {
    const str = String(value);
    return str.replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function(ch) {
      const hex = ch.codePointAt(0).toString(16).toUpperCase();
      return "\\" + hex + " ";
    });
  };
})();

let refreshIntervalId = null;
let currentTab = null;

const STORAGE_KEY = "theShopLeague_v1";
const DATE_KEY = "theShopDate_v1"; // stores YYYYMMDD

// =========================
// LOGIN HARDENING (prevents iOS "submit/reload" issue)
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const codeEl = document.getElementById("code");
  const loginWrap = document.getElementById("login");

  // If there is a form wrapper anywhere, prevent submit from reloading the page
  const form = loginWrap ? loginWrap.closest("form") : null;
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      checkCode();
    });
  }

  // Make sure the Enter button is not treated as submit
  const btn = loginWrap ? loginWrap.querySelector("button") : null;
  if (btn) {
    btn.type = "button";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      checkCode();
    });
  }

  // Hitting Enter in the input should log in (without submitting/reloading)
  if (codeEl) {
    codeEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        checkCode();
      }
    });
  }
});

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
  return "ncaam"; // default
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

const AI_ENDPOINT = ""; 
// If you later deploy a real endpoint, set it like:
// const AI_ENDPOINT = "https://your-vercel-app.vercel.app/api/ai-insight";

/* =========================
   LOGO + HTML HELPERS
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

// ===== ENTRY + COUNTDOWN TO "THE GAME" (Yearly calc) =====

// The Game: last Saturday in November, local time, 12:00 PM by default (change if you want)
function getTheGameDate(year) {
  // Start at Nov 30 and walk backward to Saturday
  const d = new Date(year, 10, 30, 12, 0, 0, 0); // month is 0-based: 10 = November
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1); // 6 = Saturday
  return d;
}

function getNextTheGameDate(now = new Date()) {

// --- REQUIRED GLOBAL EXPORTS (split build) ---
try {
  if (typeof checkCode === "function") window.checkCode = checkCode;
} catch (e) {}