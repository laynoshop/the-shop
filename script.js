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

// ===== ScarletKey Crash Guard + Build Stamp (PHONE SAFE) =====
(function () {
  function showCrash(msg) {
    try {
      const el = document.createElement("div");
      el.id = "skCrash";
      el.style.cssText =
        "position:fixed;inset:0;z-index:999999;background:#0b0b0b;color:#fff;padding:16px;font-family:system-ui;overflow:auto;";
      el.innerHTML = `
        <h2 style="margin:0 0 8px 0;">ScarletKey Error</h2>
        <div style="opacity:.9;line-height:1.4;white-space:pre-wrap;">${String(msg || "Unknown error")}</div>
        <div style="margin-top:12px;opacity:.7;font-size:12px;">
          Tip: This usually means a paste/truncation happened.<br/>
          Revert the last script.js edit in GitHub.
        </div>
      `;
      document.body.appendChild(el);
    } catch {}
  }

  window.addEventListener("error", (e) => {
    console.error("APP ERROR:", e);
    showCrash(e?.message || e);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("PROMISE ERROR:", e);
    showCrash(e?.reason?.message || e?.reason || e);
  });
})();

// ===== Build Stamp (confirms correct deploy loaded) =====
window.__SCARLETKEY_BUILD = "2026-02-22-01";
console.log("ScarletKey build:", window.__SCARLETKEY_BUILD);

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
// League dropdown changes (Scores + Picks)
document.addEventListener("change", (e) => {
  const sel = e.target;
  if (!sel || sel.id !== "leagueSelect") return;

  const key = String(sel.value || "").trim();
  if (!key) return;

  saveLeagueKey(key);

  // Re-render current tab after league change
  const tab = window.__activeTab || currentTab || "scores";
  showTab(tab);
});

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

// League dropdown changes (Scores + Picks)
document.addEventListener("change", (e) => {
  const sel = e.target;
  if (!sel || sel.id !== "leagueSelect") return;

  const key = String(sel.value || "").trim();
  if (!key) return;

  saveLeagueKey(key);

  // Re-render current tab after league change
  const tab = window.__activeTab || currentTab || "scores";
  showTab(tab);
});

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

window.addEventListener("error", (e) => {
  console.error("APP ERROR:", e?.message || e);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("PROMISE ERROR:", e?.reason || e);
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
  let saved = null;

  // Private browsing can throw on localStorage access — never crash the app.
  try {
    saved = localStorage.getItem(DATE_KEY);
  } catch (e) {
    // fallback to in-memory storage
    saved = (window.__SK_MEM && window.__SK_MEM[DATE_KEY]) || null;
  }

  if (saved && /^\d{8}$/.test(saved)) return saved;

  const today = formatDateYYYYMMDD(new Date());

  try {
    localStorage.setItem(DATE_KEY, today);
  } catch (e) {
    window.__SK_MEM = window.__SK_MEM || {};
    window.__SK_MEM[DATE_KEY] = today;
  }

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
  const year = now.getFullYear();
  const thisYears = getTheGameDate(year);
  if (now <= thisYears) return thisYears;
  return getTheGameDate(year + 1);
}

function pad2(n){ return String(n).padStart(2, "0"); }

function updateTheGameCountdown() {
  const now = new Date();
  const target = getNextTheGameDate(now);
  const diffMs = target - now;

  const card = document.getElementById("countdownCard");
  if (!card) return; // if not on this screen, bail safely

  const elDays  = document.getElementById("cdDays");
  const elHours = document.getElementById("cdHours");
  const elMins  = document.getElementById("cdMins");
  const elSecs  = document.getElementById("cdSecs");

  // If any counters are missing, bail safely
  if (!elDays || !elHours || !elMins || !elSecs) return;

  // Clear intensity levels (if you still have these styles)
  card.classList.remove("level30", "level7", "level1");

  if (diffMs <= 0) {
    elDays.textContent  = "0";
    elHours.textContent = "00";
    elMins.textContent  = "00";
    elSecs.textContent  = "00";
    card.classList.add("level1");
    return;
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days  = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;

  elDays.textContent  = String(days);
  elHours.textContent = pad2(hours);
  elMins.textContent  = pad2(mins);
  elSecs.textContent  = pad2(secs);

  // Intensity classes (optional; keep if you like)
  if (days <= 1) card.classList.add("level1");
  else if (days <= 7) card.classList.add("level7");
  else if (days <= 30) card.classList.add("level30");

  // ✅ Removed "Target: ..." line entirely (no countdownSub)
}

let countdownTimerHandle = null;

function showEntryScreen() {
  const login = document.getElementById("login");
  const entry = document.getElementById("entry");
  const app   = document.getElementById("app");

  // ✅ Entry-only vibe
  document.body.classList.add("entryMode");

  if (login) login.style.display = "none";
  if (app) app.style.display = "none";
  if (entry) entry.style.display = "flex";

  // ✅ Admin-only: Shop door visibility
  try {
    const role = String(localStorage.getItem(ROLE_KEY) || "guest").trim();
    const shopDoor = document.querySelector('.doorBtn[data-go="shop"]');
    if (shopDoor) {
      shopDoor.style.display = (role === "admin") ? "" : "none";
    }
  } catch {}

  // Start countdown tick
  updateTheGameCountdown();
  if (countdownTimerHandle) clearInterval(countdownTimerHandle);
  countdownTimerHandle = setInterval(updateTheGameCountdown, 1000);

  // Bind door clicks once (prevents stacking handlers)
  if (!showEntryScreen._bound) {
    document.querySelectorAll(".doorBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-go");
        enterAppToTab(tab);
      });
    });
    showEntryScreen._bound = true;
  }
}

function enterAppToTab(tabName) {
  const entry = document.getElementById("entry");
  const app   = document.getElementById("app");

  // ✅ Turn off Entry-only vibe
  document.body.classList.remove("entryMode");

  if (entry) entry.style.display = "none";
  if (app) app.style.display = "block";

  // Stop countdown (keeps things lighter)
  if (countdownTimerHandle) {
    clearInterval(countdownTimerHandle);
    countdownTimerHandle = null;
  }

  // Keep your existing navigation
  if (typeof showTab === "function") {
    showTab(tabName);
  } else {
    console.warn("showTab(tabName) not found — wire this to your existing tab navigation.");
  }
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
      if (ids.includes(FAVORITES_NORM[i])) {
        if (i < bestRank) bestRank = i;
      }
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
   VENUE + ODDS HELPERS
   ========================= */

// Safe team-name helper (uses TTUN override if present)
function getSafeTeamNameForOdds(team, fallback) {
  try {
    if (typeof getTeamDisplayNameUI === "function") {
      return getTeamDisplayNameUI(team);
    }
  } catch (_) {}
  return team?.displayName || team?.shortDisplayName || team?.name || fallback || "Team";
}

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

// Primary: parse from ESPN Summary/Competition "pickcenter"
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

function parseOddsFromSummary(summaryData, fallbackComp) {
  // 1) pickcenter array at top-level (most common)
  const pcArr = summaryData?.pickcenter;
  if (Array.isArray(pcArr) && pcArr.length) {
    const comp = summaryData?.header?.competitions?.[0] || fallbackComp || null;
    const competitors = comp?.competitors || [];
    const home = competitors.find(t => t.homeAway === "home");
    const away = competitors.find(t => t.homeAway === "away");

    const homeName = getSafeTeamNameForOdds(home?.team, "Home");
    const awayName = getSafeTeamNameForOdds(away?.team, "Away");

    const parsed = parseOddsFromPickcenter(pcArr[0], homeName, awayName);
    if (parsed.favored || parsed.ou) return parsed;
  }

  // 2) pickcenter inside header competition
  const sc0 = summaryData?.header?.competitions?.[0] || fallbackComp || null;
  const pc2 = firstPickcenterFromCompetition(sc0);
  if (pc2) {
    const competitors = sc0?.competitors || [];
    const home = competitors.find(t => t.homeAway === "home");
    const away = competitors.find(t => t.homeAway === "away");

    const homeName = getSafeTeamNameForOdds(home?.team, "Home");
    const awayName = getSafeTeamNameForOdds(away?.team, "Away");

    const parsed = parseOddsFromPickcenter(pc2, homeName, awayName);
    if (parsed.favored || parsed.ou) return parsed;
  }

  // 3) odds array inside header competition
  const o2 = firstOddsFromCompetition(sc0);
  if (o2 && (o2.details || o2.overUnder !== undefined || o2.total !== undefined)) {
    return {
      favored: cleanFavoredText(o2.details || o2.displayValue || ""),
      ou: normalizeNumberString(o2.overUnder ?? o2.total ?? "")
    };
  }

  // 4) odds at top-level
  const oTop = Array.isArray(summaryData?.odds) ? summaryData.odds[0] : null;
  if (oTop && (oTop.details || oTop.overUnder !== undefined || oTop.total !== undefined)) {
    return {
      favored: cleanFavoredText(oTop.details || oTop.displayValue || ""),
      ou: normalizeNumberString(oTop.overUnder ?? oTop.total ?? "")
    };
  }

  return { favored: "", ou: "" };
}

function parseOddsFromScoreboardCompetition(competition) {
  // Try odds array
  const o1 = firstOddsFromCompetition(competition);
  if (o1 && (o1.details || o1.overUnder !== undefined || o1.total !== undefined)) {
    return {
      favored: cleanFavoredText(o1.details || o1.displayValue || ""),
      ou: normalizeNumberString(o1.overUnder ?? o1.total ?? "")
    };
  }

  // Try pickcenter inside competition
  const pc = firstPickcenterFromCompetition(competition);
  if (pc) {
    const competitors = competition?.competitors || [];
    const home = competitors.find(t => t.homeAway === "home");
    const away = competitors.find(t => t.homeAway === "away");

    const homeName = getSafeTeamNameForOdds(home?.team, "Home");
    const awayName = getSafeTeamNameForOdds(away?.team, "Away");

    const parsed = parseOddsFromPickcenter(pc, homeName, awayName);
    if (parsed.favored || parsed.ou) return parsed;
  }

  return { favored: "", ou: "" };
}

function buildOddsLine(favored, ou) {
  const hasFav = favored && favored !== "-" && favored !== "";
  const hasOu = ou && ou !== "-" && ou !== "";

  if (!hasFav && !hasOu) {
    return ""; // Nothing to show
  }

  if (hasFav && hasOu) {
    return `Favored: ${favored} • O/U: ${ou}`;
  }

  if (hasFav) {
    return `Favored: ${favored}`;
  }

  if (hasOu) {
    return `O/U: ${ou}`;
  }

  return "";
}

// =========================
// AI INSIGHT CACHE (NO-FLICKER)
// =========================
const AI_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const AI_SESSION_KEY = "theShopAiInsightCache_v1";

let aiInsightCache = {}; // key -> { edge, lean, confidence, ts }

(function loadAiCacheFromSession(){
  try {
    const raw = sessionStorage.getItem(AI_SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") aiInsightCache = parsed;
  } catch {}
})();

function saveAiCacheToSessionThrottled(){
  // keep it tiny + fast
  try {
    sessionStorage.setItem(AI_SESSION_KEY, JSON.stringify(aiInsightCache));
  } catch {}
}

function isAiCacheFresh(entry){
  if (!entry) return false;
  const ts = Number(entry.ts || 0);
  if (!Number.isFinite(ts)) return false;
  return (Date.now() - ts) <= AI_CACHE_TTL_MS;
}

/* =========================
   ODDS FETCH (RELIABLE)
   - Cache + concurrency + update cards in place
   ========================= */
const ODDS_CONCURRENCY_LIMIT = 6;
const ODDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ODDS_STORAGE_PREFIX = "theShopOddsCache_v1";

const oddsCache = new Map();    // cacheKey -> { favored, ou, ts }
const oddsInFlight = new Map(); // cacheKey -> Promise
let oddsCacheSaveTimer = null;

function oddsCacheKey(leagueKey, dateYYYYMMDD, eventId) {
  return `${leagueKey}|${dateYYYYMMDD}|${eventId}`;
}

function storageKeyForOdds(leagueKey, dateYYYYMMDD) {
  return `${ODDS_STORAGE_PREFIX}_${leagueKey}_${dateYYYYMMDD}`;
}

function loadOddsCacheFromSession(leagueKey, dateYYYYMMDD) {
  try {
    const key = storageKeyForOdds(leagueKey, dateYYYYMMDD);
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    const now = Date.now();
    for (const [eventId, val] of Object.entries(parsed)) {
      const ts = Number(val?.ts || 0);
      if (!Number.isFinite(ts) || (now - ts) > ODDS_CACHE_TTL_MS) continue;
      const ck = oddsCacheKey(leagueKey, dateYYYYMMDD, eventId);
      oddsCache.set(ck, { favored: val.favored || "", ou: val.ou || "", ts });
    }
  } catch (e) {}
}

function saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD) {
  if (oddsCacheSaveTimer) return;
  oddsCacheSaveTimer = setTimeout(() => {
    oddsCacheSaveTimer = null;
    try {
      const key = storageKeyForOdds(leagueKey, dateYYYYMMDD);
      const obj = {};
      for (const [ck, val] of oddsCache.entries()) {
        const [lk, dk, eventId] = String(ck).split("|");
        if (lk !== leagueKey || dk !== dateYYYYMMDD) continue;
        obj[eventId] = { favored: val.favored || "", ou: val.ou || "", ts: val.ts || Date.now() };
      }
      sessionStorage.setItem(key, JSON.stringify(obj));
    } catch (e) {}
  }, 400);
}

function getOddsLineElByEventId(eventId) {
  const card = document.querySelector(`.game[data-eventid="${CSS.escape(String(eventId))}"]`);
  if (!card) return null;

  // Support both old + new class names
  return (
    card.querySelector(".gameMetaOddsLine") ||
    card.querySelector(".gameMetaOddsPlain")
  );
}

function applyOddsToDom(eventId, favored, ou) {
  const el = getOddsLineElByEventId(eventId);
  if (!el) return;
  const text = buildOddsLine(favored, ou);
  if (el.textContent !== text) el.textContent = text;
}

function withLangRegion(url) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has("lang")) u.searchParams.set("lang", "en");
    if (!u.searchParams.has("region")) u.searchParams.set("region", "us");
    return u.toString();
  } catch {
    return url;
  }
}

async function fetchJsonNoStore(url) {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

async function fetchOddsFromSummary(league, leagueKey, dateYYYYMMDD, eventId, fallbackCompetition) {
  if (!league?.summaryEndpoint || !eventId) return { favored: "", ou: "" };

  const ck = oddsCacheKey(leagueKey, dateYYYYMMDD, eventId);
  const cached = oddsCache.get(ck);
  const now = Date.now();
  if (cached && (now - (cached.ts || 0)) <= ODDS_CACHE_TTL_MS) {
    return { favored: cached.favored || "", ou: cached.ou || "" };
  }

  if (oddsInFlight.has(ck)) return oddsInFlight.get(ck);

  const p = (async () => {
    const base = league.summaryEndpoint(eventId);
    const urls = [
      withLangRegion(base),
      withLangRegion(base.replace("?event=", "?eventId=")),
      withLangRegion(base.replace("summary?event=", "summary?eventId=")),
      base
    ];

    for (const url of urls) {
      try {
        const data = await fetchJsonNoStore(url);
        const parsed = parseOddsFromSummary(data, fallbackCompetition);
        if (parsed.favored || parsed.ou) {
          oddsCache.set(ck, { favored: parsed.favored || "", ou: parsed.ou || "", ts: Date.now() });
          saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD);
          return parsed;
        }
      } catch (e) {}
    }

    const empty = { favored: "", ou: "" };
    oddsCache.set(ck, { favored: "", ou: "", ts: Date.now() });
    saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD);
    return empty;
  })();

  oddsInFlight.set(ck, p);
  try {
    return await p;
  } finally {
    oddsInFlight.delete(ck);
  }
}

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

async function hydrateAllOdds(events, league, leagueKey, dateYYYYMMDD) {
  loadOddsCacheFromSession(leagueKey, dateYYYYMMDD);

  const jobs = events
    .map(e => ({ eventId: String(e?.id || ""), competition: e?.competitions?.[0] || null }))
    .filter(j => j.eventId);

  // Apply cached + scoreboard first
  for (const job of jobs) {
    const ck = oddsCacheKey(leagueKey, dateYYYYMMDD, job.eventId);
    const cached = oddsCache.get(ck);
    if (cached && (Date.now() - (cached.ts || 0)) <= ODDS_CACHE_TTL_MS) {
      applyOddsToDom(job.eventId, cached.favored, cached.ou);
      continue;
    }

    const fromScoreboard = parseOddsFromScoreboardCompetition(job.competition);
    if (fromScoreboard.favored || fromScoreboard.ou) {
      oddsCache.set(ck, { favored: fromScoreboard.favored || "", ou: fromScoreboard.ou || "", ts: Date.now() });
      saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD);
      applyOddsToDom(job.eventId, fromScoreboard.favored, fromScoreboard.ou);
    }
  }

  // Fetch summary only for missing
  const needsFetch = jobs.filter(job => {
    const ck = oddsCacheKey(leagueKey, dateYYYYMMDD, job.eventId);
    const val = oddsCache.get(ck);
    return !(val && (val.favored || val.ou));
  });

  await runWithConcurrency(needsFetch, ODDS_CONCURRENCY_LIMIT, async (job) => {
    const parsed = await fetchOddsFromSummary(league, leagueKey, dateYYYYMMDD, job.eventId, job.competition);
    applyOddsToDom(job.eventId, parsed.favored, parsed.ou);
  });
}

/* =========================
   PGA Top 15 (FIXED SORT)
   - Correctly sorts by leaderboard position (not alphabetical)
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
  return (
    c?.athlete?.displayName ||
    c?.athlete?.shortName ||
    c?.athlete?.fullName ||
    c?.displayName ||
    "—"
  );
}

function getGolferPos(c) {
  // Try the most common “position” shapes first
  const p =
    c?.position?.displayName ||
    c?.position?.shortDisplayName ||
    c?.position?.displayValue ||
    c?.position?.name ||
    "";

  if (String(p || "").trim()) return String(p).trim();

  // Many ESPN golf payloads store position/rank in statistics
  const fromStats =
    statValueByName(c?.statistics, ["Pos", "POS", "Position", "Rank", "RANK"]) ||
    "";

  if (String(fromStats || "").trim()) return String(fromStats).trim();

  // Fallbacks
  if (c?.rank !== undefined && c?.rank !== null && String(c.rank).trim()) return String(c.rank).trim();
  if (c?.order !== undefined && c?.order !== null && String(c.order).trim()) return String(c.order).trim();

  return "";
}

function getGolferSortPos(c) {
  // Prefer an explicit numeric sort value if ESPN provides one
  const candidates = [
    c?.position?.sortValue,
    c?.position?.rank,
    c?.rank,
    c?.order
  ];

  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Otherwise parse the display position (e.g., "T1", "1", "T15")
  const posStr = getGolferPos(c);
  const parsed = parseGolfPosToSortValue(posStr);
  return Number.isFinite(parsed) ? parsed : Infinity;
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
  const v =
    competition?.venue ||
    event?.venue ||
    (Array.isArray(event?.venues) ? event.venues[0] : null) ||
    null;

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
          sortPos: getGolferSortPos(c),          // ✅ FIXED
          score: getGolferScoreToPar(c),
          thru: getGolferThru(c)
        };
      })
      .filter(g => g.name && g.name !== "—");

    // ✅ FIXED: sort by real leaderboard position first, then name
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

    if (top15.length === 0) {
      const notice = document.createElement("div");
      notice.className = "notice";
      notice.textContent = "No leaderboard data available yet.";
      card.appendChild(notice);
    }

    grid.appendChild(card);
  });

  content.appendChild(grid);
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

  function addOrReplaceParam(url, key, value) {
    try {
      const u = new URL(url);
      u.searchParams.set(key, value);
      return u.toString();
    } catch {
      const hasQ = url.includes("?");
      const sep = hasQ ? "&" : "?";
      return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }
  }

  function eventLocalYYYYMMDD(ev) {
    const comp = ev?.competitions?.[0];
    const iso = ev?.date || comp?.date || "";
    const d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return "";
    return formatDateYYYYMMDD(d); // local timezone
  }

  function hasAnyScheduledPreGames(events) {
    for (const ev of (events || [])) {
      const comp = ev?.competitions?.[0];
      const state = comp?.status?.type?.state || "";
      if (String(state).toLowerCase() === "pre") return true;
    }
    return false;
  }

  async function fetchEvents(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    return { data, events };
  }

  // ✅ NORMALIZED DAY MODE (safe: always returns data object)
  try {
    const urlToday = addOrReplaceParam(baseUrl, "limit", "1000");
    const urlY = addOrReplaceParam(league.endpoint(yDate), "limit", "1000");
    const urlT = addOrReplaceParam(league.endpoint(tDate), "limit", "1000");

    const results = await Promise.allSettled([
      fetchEvents(urlToday),
      fetchEvents(urlY),
      fetchEvents(urlT),
    ]);

    // Pick a "best available" data payload for downstream UI (never null)
    const firstFulfilled = results.find(r => r.status === "fulfilled");
    const baseData = firstFulfilled && firstFulfilled.status === "fulfilled" ? firstFulfilled.value.data : { events: [] };

    // Combine events from fulfilled calls
    const combined = [];
    const seen = new Set();

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const ev of (r.value.events || [])) {
        const id = String(ev?.id || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        combined.push(ev);
      }
    }

    const filtered = combined.filter(ev => eventLocalYYYYMMDD(ev) === yyyymmdd);

    if (filtered.length > 0) {
      // Return with a valid data object so Scores/Picks don't crash
      return {
        data: { ...(baseData || {}), events: filtered },
        events: filtered,
        used: "normalized-day",
        url: urlToday
      };
    }
  } catch (e) {
    console.warn("normalized-day fetch failed, falling back:", e);
  }

  // ---------- Classic fallback attempts ----------
  const baseLimit500 = addOrReplaceParam(baseUrl, "limit", "500");
  const baseLimit1000 = addOrReplaceParam(baseUrl, "limit", "1000");

  const attempts = [
    { label: "selectedDate", url: baseUrl },
    { label: "selectedDate-limit-500", url: baseLimit500 },
    { label: "selectedDate-limit-1000", url: baseLimit1000 },

    ...(isNcaam ? [
      { label: "ncaam-noGroups", url: baseUrl.replace(/&groups=50/i, "") },
      { label: "ncaam-noGroups-limit-1000", url: addOrReplaceParam(baseUrl.replace(/&groups=50/i, ""), "limit", "1000") },
    ] : []),

    { label: "noDate", url: removeDatesParam(baseUrl) },
    { label: "yesterday", url: addOrReplaceParam(league.endpoint(yDate), "limit", "1000") },
    { label: "tomorrow", url: addOrReplaceParam(league.endpoint(tDate), "limit", "1000") }
  ];

  let lastError = null;
  let firstNonEmpty = null;

  for (const a of attempts) {
    try {
      const resp = await fetch(a.url, { cache: "no-store" });
      if (!resp.ok) {
        lastError = new Error(`HTTP ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const events = Array.isArray(data?.events) ? data.events : [];
      if (events.length === 0) continue;

      if (!firstNonEmpty) {
        firstNonEmpty = { data, events, used: a.label, url: a.url };
      }

      if (isNcaam && hasAnyScheduledPreGames(events)) {
        return { data, events, used: a.label, url: a.url };
      }

      if (!isNcaam) {
        return { data, events, used: a.label, url: a.url };
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (firstNonEmpty) return firstNonEmpty;
  return { data: { events: [] }, events: [], used: "none", url: "", error: lastError };
}

/**
 * iOS-safe approach:
 * - Render a normal 📅 button for visuals
 * - Overlay the REAL <input type="date"> on top (opacity 0)
 * - Wire onchange/oninput directly so date selection actually reloads scores
 */
/* =========================
   LEAGUE SELECT (missing fix)
   - Builds the league dropdown used in Scores + Picks headers
   ========================= */
function buildLeagueSelectHTML(selectedKey) {
  const opts = (LEAGUES || []).map(l => {
    const k = String(l.key || "");
    const name = String(l.name || k);
    const sel = (k === String(selectedKey || "")) ? "selected" : "";
    return `<option value="${escapeHtml(k)}" ${sel}>${escapeHtml(name)}</option>`;
  }).join("");

  return `
    <select id="leagueSelect" class="leagueSelect" aria-label="Select league">
      ${opts}
    </select>
  `;
}

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

function buildCalendarButtonHTML() {
  const current = yyyymmddToInputValue(getSavedDateYYYYMMDD());

  return `
    <span class="datePickerWrap" aria-label="Choose date">
      <button id="dateBtn" class="iconBtn" aria-label="Choose date" type="button">📅</button>
      <input
        id="nativeDateInput"
        class="nativeDateInput"
        type="date"
        value="${escapeHtml(current)}"
        aria-label="Choose date"
        onchange="handleNativeDateChangeFromEl(this)"
        oninput="handleNativeDateChangeFromEl(this)"
      />
    </span>
  `;
}

// Handle date changes (wired via delegated change listener below)
// Handle date changes (wired via onchange/oninput on the date input)
function handleNativeDateChangeFromEl(el) {
  const v = el?.value || "";
  const yyyymmdd = inputValueToYYYYMMDD(v);
  if (!yyyymmdd) return;

  saveDateYYYYMMDD(yyyymmdd);

  // ✅ Re-render the CURRENT tab (not always Scores)
  const tab = window.__activeTab || currentTab || "scores";
  showTab(tab);
}
/* =========================
   Login (ROLE-BASED)
   - 1024 = Admin (shows Shop)
   - 2026 = Guest (no Shop tab)
   ========================= */

const ROLE_KEY = "theShopRole_v1"; // "admin" | "guest"
let isLoggedIn = false;

function showLoginScreen() {
  isLoggedIn = false;
  const login = document.getElementById("login");
  const app = document.getElementById("app");
  if (app) app.style.display = "none";
  if (login) login.style.display = "flex";
}

function showAppScreen() {
  isLoggedIn = true;
  const login = document.getElementById("login");
  const app = document.getElementById("app");
  if (login) login.style.display = "none";
  if (app) app.style.display = "block";
}

function getSavedRole() {
  const r = (localStorage.getItem(ROLE_KEY) || "").trim();
  return (r === "admin" || r === "guest") ? r : "";
}

function buildTabsForRole(role) {
  const tabs = document.querySelector(".tabs");
  if (!tabs) return;

  const baseTabs = [
    { key: "scores", label: "Scores" },
    { key: "picks",  label: "Picks" },
    { key: "beat",   label: "Beat<br/>TTUN" },
    { key: "news",   label: "Top<br/>News" }
  ];

  if (role === "admin") baseTabs.push({ key: "shop", label: "Shop" });

  tabs.innerHTML = baseTabs
    .map(t => `<button type="button" data-tab="${t.key}">${t.label}</button>`)
    .join("");

  // Keep current tab if possible, else default to scores
  const current = window.__activeTab || "scores";
  const exists = baseTabs.some(t => t.key === current);
  showTab(exists ? current : "scores");
}

async function checkCode() {
  const input = document.getElementById("code");
  if (!input) return;

  const entered = String(input.value || "").trim();

  // Keep the same quick UX behavior if empty
  if (!entered) {
    input.focus();
    input.style.borderColor = "rgba(187,0,0,0.60)";
    setTimeout(() => (input.style.borderColor = ""), 450);
    return;
  }

  let role = "";

  try {
    // This already exists in your app for Shop chat and anonymous auth
    await ensureFirebaseChatReady();

    // Get Firebase ID token from the (anonymous) signed-in user
    const user = firebase.auth().currentUser;
    if (!user) throw new Error("No auth user");

    const token = await user.getIdToken();

    // Try both URLs (2nd Gen prints the Cloud Run URL on deploy)
    const redeemUrls = [
      "https://us-central1-the-shop-chat.cloudfunctions.net/redeemInviteCodeHttp",
      "https://redeeminvitecodehttp-an5l4al3xa-uc.a.run.app"
    ];

    let lastErr = null;

    for (const url of redeemUrls) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          },
          body: JSON.stringify({ code: entered })
        });

        const data = await resp.json().catch(() => ({}));
        role = String(data?.role || "");

        if (resp.ok && (role === "admin" || role === "guest")) {
          lastErr = null;
          break; // success
        }

        lastErr = new Error("Invalid code");
      } catch (e) {
        lastErr = e;
      }
    }

    if (lastErr) throw lastErr;
  } catch (e) {
    // Same invalid-code UX (no details leaked)
    input.focus();
    input.style.borderColor = "rgba(187,0,0,0.60)";
    setTimeout(() => (input.style.borderColor = ""), 450);
    return;
  }

  // Persist role (unchanged behavior)
  localStorage.setItem(ROLE_KEY, role);

  // Clear input so code isn't sitting on the screen
  input.value = "";

  // ---- Everything below stays the same UX flow ----
  const login = document.getElementById("login");
  const app = document.getElementById("app");

  if (login) {
    login.classList.add("loginUnlocking");
    setTimeout(() => login.classList.add("loginFadeOut"), 160);
  }

setTimeout(() => {
  if (login) login.style.display = "none";
  if (app) app.style.display = "block";

  // Build tabs based on role and go to default
  buildTabsForRole(role);

  // Show the Entry (doors) screen after login
  showEntryScreen();
}, 320);
}

/* =========================
   BUCKEYE BANNER (above tabs)
   ========================= */

// Set this to the most recent TTUN win date (local time). Update if/when it changes.
const LAST_TTUN_WIN_DATE = new Date(2024, 10, 30, 12, 0, 0); // Nov 30, 2024 @ noon local

function daysSince(d) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = today.getTime() - start.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function updateRivalryBanner() {
  const banner = document.getElementById("rivalryBanner");
  if (!banner) return;

  const days = daysSince(LAST_TTUN_WIN_DATE);
  banner.textContent = `${days} days since TTUN has won in The Game`;
  banner.style.display = "block";
}



function setActiveTabButton(tab) {
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  const btn = document.querySelector(`.tabs button[data-tab="${CSS.escape(String(tab))}"]`);
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
    // (No auto-refresh on Beat/News/Shop by default to keep it snappy)
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
  const role = localStorage.getItem(ROLE_KEY) || "guest";

  // Block Shop for guests
  if (tab === "shop" && role !== "admin") tab = "scores";

  // Track active tab globally (prevents refresh logic from overriding)
  currentTab = tab;
  window.__activeTab = tab;

  // Stop any running refresh/timers BEFORE rendering anything
  try { stopAutoRefresh(); } catch (e) {}

  // Clear content
  const content = document.getElementById("content");
  if (content) content.innerHTML = "";

  // Highlight active tab
  try { setActiveTabButton(tab); } catch (e) {
    // fallback: set active class via data-tab
    document.querySelectorAll(".tabs button").forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
  }

  // Helper: safe call so one tab can't crash the whole app
  const safe = (fn, ...args) => {
    try {
      if (typeof fn === "function") return fn(...args);
      console.warn("Missing function:", fn);
    } catch (err) {
      console.error("Tab render error:", tab, err);
      if (content) {
        content.innerHTML =
          `<div class="notice">Something went wrong loading <b>${tab}</b>. Check console.</div>`;
      }
    }
  };

  // Render tab
  if (tab === "scores") {
    safe(loadScores, true);
    // Only start auto-refresh on Scores
    safe(startAutoRefresh);
  } else if (tab === "picks") {
    safe(renderPicks, true);
  } else if (tab === "beat") {
    safe(renderBeatTTUN);
  } else if (tab === "news") {
    safe(renderTopNews, true);
  } else if (tab === "shop") {
    // Guard: do NOT allow scores refresh to repaint over Shop
    safe(renderShop);
  } else {
    // fallback safety
    currentTab = "scores";
    window.__activeTab = "scores";
    try { setActiveTabButton("scores"); } catch (e) {}
    safe(loadScores, true);
    safe(startAutoRefresh);
  }

  // Banner update (safe)
  try { updateRivalryBanner(); } catch (e) {}
}

/* =========================
   RANK + RECORD (NCAAM/CFB)
   ========================= */

function getTop25RankFromCompetitor(competitor) {
  // ESPN college scoreboards often expose rank on competitor.curatedRank or competitor.rank
  const r =
    competitor?.curatedRank?.current ??
    competitor?.curatedRank?.rank ??
    competitor?.rank ??
    competitor?.team?.rank ??
    competitor?.team?.curatedRank?.current ??
    null;

  const n = Number(r);
  if (Number.isFinite(n) && n >= 1 && n <= 25) return n;
  return null;
}

function getOverallRecordFromCompetitor(competitor) {
  const recs = competitor?.records;
  if (!Array.isArray(recs) || !recs.length) return "";

  // Prefer "overall"
  const overall =
    recs.find(r => String(r?.name || "").toLowerCase() === "overall") ||
    recs.find(r => String(r?.type || "").toLowerCase() === "total") ||
    recs[0];

  return String(overall?.summary || "").trim();
}

// =========================
// RIVALRY NAME OVERRIDES
// =========================
function applyRivalryNameOverrides(rawName, teamObj) {
  const name = String(rawName || "").trim();
  const lower = name.toLowerCase();

  const id = String(teamObj?.id || "");
  const abbrev = String(teamObj?.abbreviation || "").toLowerCase();
  const displayLower = String(teamObj?.displayName || "").toLowerCase();

  // TTUN (Michigan Wolverines ONLY)
  if (
    id === "130" ||
    lower.includes("michigan wolverines") ||
    displayLower.includes("michigan wolverines")
  ) {
    return "The Team Up North";
  }

  // UNC (North Carolina Tar Heels ONLY)
  if (
    id === "153" ||
    abbrev === "unc" ||
    lower.includes("north carolina tar heels") ||
    displayLower.includes("north carolina tar heels")
  ) {
    return "Paper Classes U";
  }

  return name;
}

// =========================
// TEAM NAME WITH RANK (AP Top 25)
// =========================
function teamDisplayNameWithRank(rawName, competitor, selectedKey) {
  const teamObj = competitor?.team || null;

  // First: apply rivalry rename (THIS is what fixes your screenshot)
  const baseName = applyRivalryNameOverrides(rawName, teamObj);

  // Only add ranking for college hoops + college football
  const isCollege =
    selectedKey === "ncaam" ||
    selectedKey === "ncaaf" ||
    selectedKey === "collegefb" ||
    selectedKey === "collegebb";

  if (!isCollege) return baseName;

  // Pull rank from ESPN competitor/team fields (handles common formats)
  const rank =
    competitor?.curatedRank?.current ||
    competitor?.rank?.current ||
    competitor?.rank ||
    teamObj?.rank?.current ||
    teamObj?.rank ||
    "";

  const r = parseInt(rank, 10);
  if (Number.isFinite(r) && r > 0 && r <= 25) {
    return `#${r} ${baseName}`;
  }

  return baseName;
}
function homeAwayWithRecord(homeAwayLabel, competitor, leagueKey) {
  // Only apply to college sports per your request
  if (leagueKey !== "ncaam" && leagueKey !== "cfb") return homeAwayLabel;

  const rec = getOverallRecordFromCompetitor(competitor);
  return rec ? `${homeAwayLabel} • ${rec}` : homeAwayLabel;
}

/* =========================
   TTUN TEAM NAME OVERRIDE (Wolverines only)
   ========================= */
const TTUN_TEAM_ID = "130"; // ESPN team id for Michigan Wolverines

function isTTUNTeam(team) {
  if (!team) return false;
  const id = String(team.id || "");
  const slug = String(team.slug || "");
  const abbr = String(team.abbreviation || "");
  const name = String(team.displayName || team.shortDisplayName || "");

  // Primary = ID match (best)
  if (id === TTUN_TEAM_ID) return true;

  // Backstops (in case ESPN shifts fields)
  if (slug === "michigan-wolverines") return true;
  if (abbr === "MICH" && /wolverines/i.test(name)) return true;

  return false;
}

function getTeamDisplayNameUI(team) {
  if (!team) return "";

  const full = String(team.displayName || "").toLowerCase();
  const short = String(team.name || "").toLowerCase();
  const abbrev = String(team.abbreviation || "").toLowerCase();
  const id = String(team.id || "");

  // =============================
  // TTUN (Michigan Wolverines)
  // =============================
  if (
    full.includes("michigan wolverines") ||
    (short === "wolverines" && full.includes("michigan")) ||
    id === "130" // ESPN ID for Michigan
  ) {
    return "The Team Up North";
  }

  // =============================
  // UNC (North Carolina Tar Heels)
  // =============================
  if (
    full.includes("north carolina tar heels") ||
    (short === "tar heels" && full.includes("north carolina")) ||
    abbrev === "unc" ||
    id === "153" // ESPN ID for UNC Chapel Hill
  ) {
    return "Paper Classes U";
  }

  return team.displayName || "";
}

function getTeamAbbrevUI(team) {
  if (!team) return "";

  const full = String(team.displayName || "").toLowerCase();
  const abbrev = String(team.abbreviation || "").toLowerCase();
  const id = String(team.id || "");

  // TTUN
  if (
    full.includes("michigan wolverines") ||
    id === "130"
  ) {
    return "TTUN";
  }

  // UNC
  if (
    full.includes("north carolina tar heels") ||
    abbrev === "unc" ||
    id === "153"
  ) {
    return "PCU";
  }

  return team.abbreviation || "";
}



function generateAIInsight({ homeName, awayName, homeScore, awayScore, favoredText, ouText, state }) {
  let confidence = 5;
  let edge = "Stay Away";
  let lean = "";

  // If live game, increase volatility
  if (state === "in") confidence += 0.5;

  // Spread logic
  if (favoredText && favoredText.includes("-")) {
    const parts = favoredText.split("-");
    const team = parts[0].trim();
    const spread = parseFloat(parts[1]);

    if (!isNaN(spread)) {
      confidence += spread < 4 ? 1.2 : 0.4;
      edge = `${team} -${spread}`;
    }
  }

  // O/U logic
  if (ouText) {
    const total = parseFloat(ouText);
    if (!isNaN(total)) {
      confidence += total > 145 ? 0.5 : 0.2;
      lean = total > 145 ? `Over ${total}` : `Under ${total}`;
    }
  }

  // Clamp confidence
  confidence = Math.max(1, Math.min(10, confidence));

  return {
    edge,
    lean,
    confidence: confidence.toFixed(1)
  };
}

/* =========================
   SCORES TAB (Updated header layout) — AI via /api/ai-insight
   ========================= */
async function loadScores(showLoading) {
  const content = document.getElementById("content");

  const selectedDate = getSavedDateYYYYMMDD();
  const prettyDate = yyyymmddToPretty(selectedDate);

  const now = new Date();
  const updatedTime = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const selectedKey = getSavedLeagueKey();
  const league = getLeagueByKey(selectedKey);

  const headerHTML = (rightLabel) => `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Scores</h2>
          <span class="badge">The Shop</span>
        </div>

        <div class="headerActions">
          <button class="smallBtn" onclick="loadScores(true)">Refresh</button>
          <button class="smallBtn logoutBtn" onclick="logout()">Log Out</button>
        </div>
      </div>

      <div class="subline">
        <div class="sublineLeft">
          ${buildLeagueSelectHTML(selectedKey)}
          ${buildCalendarButtonHTML()}
        </div>
        <div>${rightLabel}</div>
      </div>
    </div>
  `;

  if (showLoading) {
    content.innerHTML = `
      ${headerHTML(`${escapeHtml(prettyDate)} • Loading…`)}
      <div class="notice">Grabbing games…</div>
    `;
  }

  try {
    const result = await fetchScoreboardWithFallbacks(league, selectedDate);
    let events = result.events;

    content.innerHTML = headerHTML(`${escapeHtml(prettyDate)} • Updated ${updatedTime}`);

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

    // PGA special page
    if (league.key === "pga") {
      renderGolfLeaderboards(events, content);
      return;
    }

    // FAVORITES-FIRST SORT (still shows ALL games)
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

    const aiJobs = [];

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

      const homeTeam = home?.team || null;
      const awayTeam = away?.team || null;

      const homeBaseName = getTeamDisplayNameUI(homeTeam);
      const awayBaseName = getTeamDisplayNameUI(awayTeam);

      const homeName = teamDisplayNameWithRank(homeBaseName, home, selectedKey);
      const awayName = teamDisplayNameWithRank(awayBaseName, away, selectedKey);

      const homeLogo = getTeamLogoUrl(homeTeam);
      const awayLogo = getTeamLogoUrl(awayTeam);

      const homeAbbrev = escapeHtml(getTeamAbbrevUI(homeTeam)).slice(0, 4);
      const awayAbbrev = escapeHtml(getTeamAbbrevUI(awayTeam)).slice(0, 4);

      const venueLine = buildVenueLine(competition);

      const initialOdds = parseOddsFromScoreboardCompetition(competition);
      const initialOddsText = buildOddsLine(initialOdds.favored, initialOdds.ou);

      const eventId = String(event?.id || "");

      const card = document.createElement("div");
      card.className = "game";

      // status accent classes (your “sexy up” styles)
      if (state === "in") card.classList.add("statusLive");
      else if (state === "pre") card.classList.add("statusPre");
      else if (state === "post") card.classList.add("statusFinal");
      if (!initialOdds?.favored && !initialOdds?.ou) card.classList.add("edgeNone");

      if (eventId) card.setAttribute("data-eventid", eventId);

      const shouldShowAI = (state === "pre") && !!initialOddsText && !!eventId;

      card.innerHTML = `
        <div class="gameHeader">
          <div class="statusPill ${pillClass}">${pillText}</div>
        </div>

        <div class="gameMetaTopPlain" aria-label="Venue">
          ${escapeHtml(venueLine)}
        </div>

        ${initialOddsText ? `
          <div class="gameMetaOddsPlain" aria-label="Betting line">
            ${escapeHtml(initialOddsText)}
          </div>
        ` : ""}

        ${shouldShowAI ? `
          <div class="gameMetaAIPlain" aria-label="AI insight">
            <div class="aiRow" data-ai-line1="${escapeHtml(eventId)}">AI EDGE: — • Lean: —</div>
            <div class="aiConfidenceRow" data-ai-line2="${escapeHtml(eventId)}">Confidence: —/10</div>
          </div>
        ` : ""}

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
                <div class="teamMeta">${escapeHtml(homeAwayWithRecord("Away", away, selectedKey))}</div>
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
                <div class="teamMeta">${escapeHtml(homeAwayWithRecord("Home", home, selectedKey))}</div>
              </div>
            </div>
          </div>
          <div class="score">${homeScore}</div>
        </div>
      `;

      grid.appendChild(card);

      if (shouldShowAI) {
        aiJobs.push({
          eventId,
          leagueKey: selectedKey,
          dateYYYYMMDD: selectedDate,
          home: homeBaseName,
          away: awayBaseName,
          spread: initialOdds.favored || "",
          total: initialOdds.ou || ""
        });
      }
    });

    content.appendChild(grid);

    // Odds hydration
    hydrateAllOdds(events, league, selectedKey, selectedDate);

    // AI hydration (small concurrency)
    const limit = 4;
    let idx = 0;

    async function runNext() {
      while (idx < aiJobs.length) {
        const job = aiJobs[idx++];

        const line1 = document.querySelector(`[data-ai-line1="${CSS.escape(String(job.eventId))}"]`);
        const line2 = document.querySelector(`[data-ai-line2="${CSS.escape(String(job.eventId))}"]`);

        const alreadyHasText =
          (line1 && line1.textContent && line1.textContent.trim().length > 0) ||
          (line2 && line2.textContent && line2.textContent.trim().length > 0);

        if (!alreadyHasText) {
          if (line1) line1.textContent = job.spread ? "AI EDGE: Analyzing…" : "AI EDGE: Waiting for line…";
          if (line2) line2.textContent = "Confidence: —/10";
        }

        const data = await fetchAIInsight({
          eventId: job.eventId,
          league: job.leagueKey,
          date: job.dateYYYYMMDD,
          home: job.home,
          away: job.away,
          spread: job.spread || "",
          total: job.total || ""
        });

        if (!data) continue;

        const edge = (data.edge || "—");
        const lean = (data.lean || "");
        const conf = (data.confidence ?? "—");

        const leanPart = lean ? ` • Lean: ${lean}` : "";
        if (line1) line1.textContent = `AI EDGE: ${edge}${leanPart}`;
        if (line2) line2.textContent = `Confidence: ${conf}/10`;
      }
    }

    await Promise.all(new Array(Math.min(limit, aiJobs.length)).fill(0).map(runNext));

  } catch (error) {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <div class="headerActions">
            <button class="smallBtn" onclick="loadScores(true)">Retry</button>
            <button class="smallBtn logoutBtn" onclick="logout()">Log Out</button>
          </div>
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
  }
}

/* =========================
   AI fetch (cached + no flicker)
   ========================= */
async function fetchAIInsight(payload) {
  const key = [
    payload.league || "",
    payload.date || "",
    payload.eventId || "",
    payload.home || "",
    payload.away || "",
    payload.spread || "",
    payload.total || ""
  ].join("|");

  const cached = aiInsightCache[key];
  if (isAiCacheFresh(cached)) return cached;

  // ---- LOCAL FALLBACK (always available) ----
  function localCompute() {
    // Use your existing helper (already in your script)
    const g = generateAIInsight({
      homeName: payload.home,
      awayName: payload.away,
      homeScore: "",   // pregame
      awayScore: "",
      favoredText: payload.spread || "",
      ouText: payload.total || "",
      state: "pre"
    });

    return {
      edge: g.edge || "Stay Away",
      lean: g.lean || "",
      confidence: g.confidence ?? "5.0",
      ts: Date.now()
    };
  }

  // If no endpoint configured, just use local
  if (!AI_ENDPOINT) {
    const stored = localCompute();
    aiInsightCache[key] = stored;
    saveAiCacheToSessionThrottled();
    return stored;
  }

  // ---- REMOTE (optional if you deploy later) ----
  try {
    const resp = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // If remote fails, fallback local
    if (!resp.ok) {
      const stored = localCompute();
      aiInsightCache[key] = stored;
      saveAiCacheToSessionThrottled();
      return stored;
    }

    const data = await resp.json();

    const stored = {
      edge: data.edge || "—",
      lean: data.lean || "",
      confidence: (data.confidence ?? "—"),
      ts: Date.now()
    };

    aiInsightCache[key] = stored;
    saveAiCacheToSessionThrottled();
    return stored;

  } catch {
    const stored = localCompute();
    aiInsightCache[key] = stored;
    saveAiCacheToSessionThrottled();
    return stored;
  }
}

/* =========================
   BEAT TTUN (TUNNEL ENTRANCE MODE)
   ========================= */

// ESPN CDN logos (fast + reliable)
const OSU_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png";
const TTUN_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa/500/130.png";

// All-time series (update anytime you want)
const THE_GAME_ALL_TIME = {
  michWins: 62,
  osuWins: 52,
  ties: 6
};

// Last 10 *played* matchups (excludes 2020 canceled)
const THE_GAME_LAST_10 = [
  { year: 2025, winner: "Ohio State", score: "27–9" },
  { year: 2024, winner: "TTUN",       score: "13–10" },
  { year: 2023, winner: "TTUN",       score: "30–24" },
  { year: 2022, winner: "TTUN",       score: "45–23" },
  { year: 2021, winner: "TTUN",       score: "42–27" },
  { year: 2019, winner: "Ohio State", score: "56–27" },
  { year: 2018, winner: "Ohio State", score: "62–39" },
  { year: 2017, winner: "Ohio State", score: "31–20" },
  { year: 2016, winner: "Ohio State", score: "30–27 (2OT)" },
  { year: 2015, winner: "Ohio State", score: "42–13" }
];

let beatCountdownTimer = null;
let beatRotateTimer = null;

function stopBeatCountdown() {
  if (beatCountdownTimer) clearInterval(beatCountdownTimer);
  beatCountdownTimer = null;

  if (beatRotateTimer) clearInterval(beatRotateTimer);
  beatRotateTimer = null;
}

// “The Game” is typically the last Saturday of November.
// Count down to **noon local** for consistency.
function getNextTheGameDateLocalNoon() {
  const now = new Date();
  const year = now.getFullYear();
  const candidate = lastSaturdayOfNovemberAtNoon(year);
  if (candidate.getTime() > now.getTime()) return candidate;
  return lastSaturdayOfNovemberAtNoon(year + 1);
}

function lastSaturdayOfNovemberAtNoon(year) {
  const d = new Date(year, 10, 30, 12, 0, 0, 0); // month 10 = November
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1); // 6 = Saturday
  return d;
}

function countdownParts(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hrs  = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return { days, hrs, mins, secs };
}

function isGameWeek(targetDate) {
  const now = new Date();
  const diffMs = targetDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  return diffDays >= 0 && diffDays <= 7;
}

// Calculate current streak from THE_GAME_LAST_10 (most recent first)
function computeCurrentStreak() {
  const list = Array.isArray(THE_GAME_LAST_10) ? THE_GAME_LAST_10 : [];
  if (!list.length) return { label: "—", owner: "" };

  const first = String(list[0].winner || "").trim();
  if (!first) return { label: "—", owner: "" };

  let streak = 0;
  for (const g of list) {
    if (String(g.winner || "").trim() === first) streak++;
    else break;
  }

  if (first === "Ohio State") {
    return { label: `CURRENT STREAK: ${streak}`, owner: "osu" };
  }
  // If they’ve been winning recently:
  return { label: `REVENGE PENDING: ${streak}`, owner: "ttun" };
}

function renderBeatTTUN() {
  const content = document.getElementById("content");
  stopBeatCountdown();

  const target = getNextTheGameDateLocalNoon();
  const targetLabel = target.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const hypeLines = [
    "SILENCE THEIR STADIUM",
    "FINISH THE FIGHT",
    "LEAVE NO DOUBT",
    "NO MERCY",
    "DOMINATE"
  ];

  const streak = computeCurrentStreak();
  const gameWeek = isGameWeek(target);

  content.innerHTML = `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Beat TTUN</h2>
          <span class="badge">Hype</span>
        </div>
      </div>
      <div class="subline">
        <div>${gameWeek ? "IT’S GAME WEEK." : "Scarlet Mode"}</div>
        <div>❌ichigan Week Energy</div>
      </div>
    </div>

    <!-- TUNNEL HERO -->
    <div class="beatHero ${gameWeek ? "gameWeek" : ""}">
      <div class="beatHeroTop">
        <div class="beatHeroTitle">MISSION: BEAT TTUN</div>
        <div class="beatHeroSub">Ohio State vs The Team Up North • ${escapeHtml(targetLabel)} • Noon</div>
      </div>

      <div class="beatBig">
        <div id="beatDays" class="beatBigDays">—</div>
        <div class="beatBigLabel">DAYS</div>
      </div>

      <div class="beatHmsRow" aria-label="Hours minutes seconds">
        <div class="beatHmsUnit"><span id="beatHrs">—</span><small>HRS</small></div>
        <div class="beatHmsUnit"><span id="beatMins">—</span><small>MINS</small></div>
        <div class="beatHmsUnit"><span id="beatSecs">—</span><small>SECS</small></div>
      </div>

      <div class="beatDivider"></div>

      <div id="beatHypeLine" class="beatHypeLine">${hypeLines[0]}</div>
      <div class="beatStreak ${streak.owner === "osu" ? "osu" : "ttun"}">${escapeHtml(streak.label)}</div>
    </div>

    <div class="notice">
      <div style="font-weight:800; letter-spacing:0.5px;">ALL-TIME RECORD</div>
      <div style="margin-top:6px; opacity:0.9;">TTUN are cheating bastards</div>

      <div class="rivalRecordRow">
        <div class="rivalTeam">
          <img class="rivalLogo" src="${OSU_LOGO}" alt="Ohio State logo" loading="lazy" decoding="async" />
          <div class="rivalText"><strong>Ohio State:</strong> ${THE_GAME_ALL_TIME.osuWins}</div>
        </div>

        <div class="rivalTeam">
          <img class="rivalLogo" src="${TTUN_LOGO}" alt="TTUN logo" loading="lazy" decoding="async" />
          <div class="rivalText"><strong>The Team Up North:</strong> ${THE_GAME_ALL_TIME.michWins}</div>
        </div>

        <div class="rivalTie"><strong>Ties:</strong> ${THE_GAME_ALL_TIME.ties}</div>
      </div>
    </div>

    <div class="notice">
      <div style="font-weight:800; letter-spacing:0.5px;">LAST 10 MATCHUPS</div>
      <div class="last10List">
        ${THE_GAME_LAST_10.map(g => {
          const winner = escapeHtml(String(g.winner || ""));
          const score  = escapeHtml(String(g.score || ""));
          return `
            <div class="last10Row">
              <div class="last10Year">${g.year}</div>
              <div class="last10Winner">${winner}</div>
              <div class="last10Score">${score}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  // Countdown tick (updates big days + h/m/s)
  const daysEl = document.getElementById("beatDays");
  const hrsEl  = document.getElementById("beatHrs");
  const minsEl = document.getElementById("beatMins");
  const secsEl = document.getElementById("beatSecs");

  const tick = () => {
    const ms = target.getTime() - Date.now();
    const p = countdownParts(ms);

    if (daysEl) daysEl.textContent = String(p.days);
    if (hrsEl)  hrsEl.textContent  = String(p.hrs).padStart(2, "0");
    if (minsEl) minsEl.textContent = String(p.mins).padStart(2, "0");
    if (secsEl) secsEl.textContent = String(p.secs).padStart(2, "0");
  };

  tick();
  beatCountdownTimer = setInterval(tick, 1000);

  // Rotate hype line every 5s
  const hypeEl = document.getElementById("beatHypeLine");
  let idx = 0;
  beatRotateTimer = setInterval(() => {
    idx = (idx + 1) % hypeLines.length;
    if (hypeEl) hypeEl.textContent = hypeLines[idx];
  }, 5000);
}

/* =========================
   TOP NEWS (ESPN) — Upgrade C
   - Instant render from cache + background refresh
   - Buckeye Boost sort
   - Filters (tiny + uses existing .smallBtn)
   - Dedupe + safer text sanitization (TTUN hard enforcement)
   ========================= */

const NEWS_CACHE_KEY = "theShopNewsCache_v2";
const NEWS_FILTER_KEY = "theShopNewsFilter_v1";
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let currentNewsFilter = (sessionStorage.getItem(NEWS_FILTER_KEY) || "all");

function buildBadWordRegex() {
  // Avoid embedding the banned word directly anywhere in source strings
  const a = ["Mi", "chigan"].join("");
  const b = ["Wol", "verines"].join("");
  return {
    a: new RegExp(a, "gi"),
    b: new RegExp(b, "gi")
  };
}

function sanitizeTTUNText(str) {
  const s = String(str || "");
  const rx = buildBadWordRegex();
  return s.replace(rx.a, "TTUN").replace(rx.b, "TTUN");
}

function loadNewsCache() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const ts = Number(parsed.ts || 0);
    if (!Number.isFinite(ts)) return null;

    const items = Array.isArray(parsed.items) ? parsed.items : null;
    if (!items) return null;

    return {
      ts,
      updatedLabel: String(parsed.updatedLabel || ""),
      items
    };
  } catch {
    return null;
  }
}

function saveNewsCache(items, updatedLabel) {
  try {
    localStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), updatedLabel: updatedLabel || "", items: items || [] })
    );
  } catch {}
}

function timeAgoLabel(isoOrMs) {
  const t = typeof isoOrMs === "number" ? isoOrMs : Date.parse(String(isoOrMs || ""));
  if (!Number.isFinite(t)) return "";

  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24)  return `${hr}h ago`;
  if (day === 1) return "yesterday";
  return `${day}d ago`;
}

function scoreNewsItemForBuckeyeBoost(item) {
  const text = norm([item.headline, item.description, item.source].filter(Boolean).join(" "));
  let score = 0;

  // Boost terms (feel free to add later)
  const boosts = [
    { k: "ohio state", w: 80 },
    { k: "buckeyes", w: 80 },
    { k: "ryan day", w: 25 },
    { k: "columbus", w: 18 },
    { k: "big ten", w: 22 },
    { k: "cbb", w: 6 },
    { k: "cfb", w: 6 },
    { k: "college football", w: 14 },
    { k: "college basketball", w: 10 }
  ];

  for (const b of boosts) {
    if (text.includes(b.k)) score += b.w;
  }

  // Slightly favor fresher items
  const ts = Number(item.publishedTs || 0);
  if (Number.isFinite(ts) && ts > 0) {
    const ageMin = Math.max(0, (Date.now() - ts) / 60000);
    score += Math.max(0, 20 - Math.min(20, ageMin / 30)); // up to +20 for newest
  }

  return score;
}

function dedupeNewsItems(items) {
  const seen = new Set();
  const out = [];

  for (const it of items) {
    const key = norm(it.link || it.headline || "");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function tagNewsItem(it) {
  const t = norm([it.headline, it.description].join(" "));
  const tags = new Set();

  // Tiny keyword tagging (no UI redesign)
  if (t.includes("ohio state") || t.includes("buckeyes")) tags.add("buckeyes");
  if (t.includes("college football") || t.includes("cfb") || t.includes("ncaa football")) tags.add("cfb");
  if (t.includes("nfl")) tags.add("nfl");
  if (t.includes("mlb")) tags.add("mlb");
  if (t.includes("nhl")) tags.add("nhl");

  return Array.from(tags);
}

function passesNewsFilter(it, filterKey) {
  if (!filterKey || filterKey === "all") return true;

  const tags = Array.isArray(it.tags) ? it.tags : [];
  return tags.includes(filterKey);
}

function buildNewsFiltersRowHTML(activeKey) {
  // Uses existing .smallBtn styling to avoid redesign
  const btn = (key, label) => {
    const isOn = key === activeKey;
    // "active" class already exists for tabs; don’t reuse it here
    const extra = isOn ? `style="opacity:1;"` : `style="opacity:0.7;"`;
    return `<button class="smallBtn" data-newsfilter="${key}" ${extra}>${label}</button>`;
  };

  return `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
      ${btn("all", "All")}
      ${btn("buckeyes", "Buckeyes")}
      ${btn("cfb", "College FB")}
      ${btn("nfl", "NFL")}
      ${btn("mlb", "MLB")}
      ${btn("nhl", "NHL")}
    </div>
  `;
}

async function fetchTopNewsItemsFromESPN() {
  // --- helpers (local to this function) ---
  async function fetchJsonWithTimeout(url, ms = 9000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const resp = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchTextWithTimeout(url, ms = 9000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
      const resp = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } finally {
      clearTimeout(t);
    }
  }

  function ensureLinkOrSearch(it) {
    if (it.link) return it.link;
    const q = encodeURIComponent(it.headline || "");
    return q ? `https://www.espn.com/search/results?q=${q}` : "https://www.espn.com/";
  }

  function pickBestImageUrlFromESPNArticle(a) {
    // ESPN shapes vary by endpoint — try lots of common paths
    const candidates = [];

    // Most common: images: [{url, href, ...}]
    if (Array.isArray(a?.images)) {
      for (const im of a.images) {
        if (im?.url) candidates.push(im.url);
        if (im?.href) candidates.push(im.href);
      }
    }

    // Sometimes: image: { url }
    if (a?.image?.url) candidates.push(a.image.url);
    if (a?.image?.href) candidates.push(a.image.href);

    // Sometimes embedded in promo/thumbnail fields
    if (a?.thumbnail) candidates.push(a.thumbnail);
    if (a?.promoImage) candidates.push(a.promoImage);

    // Dedup + pick first usable https
    const cleaned = candidates
      .filter(Boolean)
      .map(String)
      .map(s => s.trim())
      .filter(s => s.length > 8);

    // Prefer https
    const httpsFirst = cleaned.find(u => u.startsWith("https://")) || cleaned[0] || "";
    return httpsFirst;
  }

  function normalizeItem(a) {
    const publishedIso = a?.published || a?.publishedAt || "";
    const publishedTs = Date.parse(publishedIso);

    const item = {
      headline: sanitizeTTUNText(a?.headline || a?.title || ""),
      description: sanitizeTTUNText(a?.description || a?.summary || ""),
      source: sanitizeTTUNText(a?.source || "ESPN"),
      publishedIso,
      publishedTs: Number.isFinite(publishedTs) ? publishedTs : 0,
      link: a?.links?.web?.href || a?.links?.[0]?.href || a?.url || "",
      imageUrl: pickBestImageUrlFromESPNArticle(a) || ""
    };

    item.link = ensureLinkOrSearch(item);
    return item;
  }

  function parseRssItems(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, 30);

    function text(q, node) {
      return node.querySelector(q)?.textContent || "";
    }

    function rssImageUrl(node) {
      // Try <enclosure url="...">
      const enc = node.querySelector("enclosure");
      const encUrl = enc?.getAttribute("url") || "";
      if (encUrl) return encUrl;

      // Try Media RSS tags (namespace can vary)
      // <media:content url="..."> or <media:thumbnail url="...">
      const mediaContent =
        node.querySelector("media\\:content") ||
        node.getElementsByTagName("media:content")?.[0];
      const mediaThumb =
        node.querySelector("media\\:thumbnail") ||
        node.getElementsByTagName("media:thumbnail")?.[0];

      const mcUrl = mediaContent?.getAttribute?.("url") || "";
      if (mcUrl) return mcUrl;

      const mtUrl = mediaThumb?.getAttribute?.("url") || "";
      if (mtUrl) return mtUrl;

      return "";
    }

    return items.map((node) => {
      const title = text("title", node);
      const link = text("link", node);
      const desc = text("description", node);
      const pub = text("pubDate", node);

      const publishedTs = Date.parse(pub);

      const it = {
        headline: sanitizeTTUNText(title),
        description: sanitizeTTUNText(desc.replace(/<[^>]*>/g, "").trim()),
        source: "ESPN",
        publishedIso: pub,
        publishedTs: Number.isFinite(publishedTs) ? publishedTs : 0,
        link: link || "",
        imageUrl: rssImageUrl(node) || ""
      };

      it.link = ensureLinkOrSearch(it);
      return it;
    }).filter(x => x.headline);
  }

  // --- 1) Try ESPN JSON (multiple endpoints + lang/region) ---
  const jsonBases = [
    "https://site.api.espn.com/apis/v2/sports/news?limit=50",
    "https://site.api.espn.com/apis/site/v2/sports/news?limit=50",
    "https://site.api.espn.com/apis/v2/sports/news",
    "https://site.api.espn.com/apis/site/v2/sports/news"
  ];

  const jsonUrls = [];
  for (const u of jsonBases) {
    jsonUrls.push(u);
    jsonUrls.push(withLangRegion(u));
  }

  let lastErr = null;
  for (const url of jsonUrls) {
    try {
      const data = await fetchJsonWithTimeout(url, 9000);
      const articles = Array.isArray(data?.articles) ? data.articles : [];
      if (articles.length) {
        const items = articles.slice(0, 30).map(normalizeItem).filter(x => x.headline);

        const tagged = items.map(it => ({ ...it, tags: tagNewsItem(it) }));
        const deduped = dedupeNewsItems(tagged);

        deduped.sort((a, b) => scoreNewsItemForBuckeyeBoost(b) - scoreNewsItemForBuckeyeBoost(a));
        return deduped.slice(0, 12);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  // --- 2) Try ESPN RSS directly ---
  const rssUrl = "https://www.espn.com/espn/rss/news";
  try {
    const xml = await fetchTextWithTimeout(rssUrl, 9000);
    const items = parseRssItems(xml);

    const tagged = items.map(it => ({ ...it, tags: tagNewsItem(it) }));
    const deduped = dedupeNewsItems(tagged);

    deduped.sort((a, b) => scoreNewsItemForBuckeyeBoost(b) - scoreNewsItemForBuckeyeBoost(a));
    return deduped.slice(0, 12);
  } catch (e) {
    lastErr = e;
  }

  // --- 3) Try RSS via AllOrigins (CORS escape hatch) ---
  try {
    const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    const xml = await fetchTextWithTimeout(proxied, 9000);
    const items = parseRssItems(xml);

    const tagged = items.map(it => ({ ...it, tags: tagNewsItem(it) }));
    const deduped = dedupeNewsItems(tagged);

    deduped.sort((a, b) => scoreNewsItemForBuckeyeBoost(b) - scoreNewsItemForBuckeyeBoost(a));
    return deduped.slice(0, 12);
  } catch (e) {
    lastErr = e;
  }

  throw (lastErr || new Error("News fetch failed"));
}

function renderNewsList(items, headerUpdatedLabel, cacheMetaLabel) {
  const content = document.getElementById("content");

  const filtered = (items || []).filter(it => passesNewsFilter(it, currentNewsFilter));

  const categoryLabel = (currentNewsFilter || "all").toUpperCase();

  const cards = filtered.map((it) => {
    const safeTitle = sanitizeTTUNText(it.headline);
    const title = escapeHtml(safeTitle);

    const descText = sanitizeTTUNText(it.description || "");

    const when = it.publishedTs ? timeAgoLabel(it.publishedTs) : "";
    const sourceLabel = it.source ? escapeHtml(sanitizeTTUNText(it.source)) : "ESPN";

    const metaLine = [categoryLabel, sourceLabel, when ? escapeHtml(when) : ""].filter(Boolean).join(" • ");

    const href = it.link
      ? it.link
      : `https://www.espn.com/search/results?q=${encodeURIComponent(safeTitle || "")}`;

    const imgUrl = (it.imageUrl || "").trim();

    const imageBlock = imgUrl ? `
      <a href="${href}"
         target="_blank"
         rel="noopener noreferrer"
         style="display:block;text-decoration:none;">
        <div class="newsImgWrap" style="
          width:100%;
          height:156px;
          border-radius:16px;
          overflow:hidden;
          margin-bottom:10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
        ">
          <img src="${escapeHtml(imgUrl)}"
               alt=""
               loading="lazy"
               referrerpolicy="no-referrer"
               style="width:100%;height:100%;object-fit:cover;display:block;"
               onerror="this.parentElement.style.display='none';"
          />
        </div>
      </a>
    ` : "";

    const headlinePill = `
      <a href="${href}"
         target="_blank"
         rel="noopener noreferrer"
         style="display:block;color:inherit;text-decoration:none;">
        <div style="
          display:block;
          padding: 12px 12px;
          border-radius: 14px;
          background: rgba(0,0,0,0.20);
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 10px 26px rgba(0,0,0,0.28);
          font-weight: 1000;
          font-size: 18px;
          line-height: 1.22;
        ">
          ${title}
        </div>
      </a>
    `;

    const desc = descText
      ? `<div style="opacity:0.85;font-size:14px;line-height:1.35;margin:10px 2px 8px;">
           ${escapeHtml(descText)}
         </div>`
      : "";

    const meta = metaLine
      ? `<div style="opacity:0.65;font-size:12px;letter-spacing:0.4px;margin:0 2px;">
           ${metaLine}
         </div>`
      : "";

    return `
      <div class="game">
        ${imageBlock}
        ${headlinePill}
        ${desc}
        ${meta}
      </div>
    `;
  }).join("");

  const cacheLine = cacheMetaLabel
    ? `<div style="opacity:0.7;">Last updated ${escapeHtml(cacheMetaLabel)}</div>`
    : `<div style="opacity:0.7;">—</div>`;

  content.innerHTML = `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Top News</h2>
          <span class="badge">ESPN</span>
        </div>
        <button class="smallBtn" onclick="renderTopNews(true)">Refresh</button>
      </div>
      <div class="subline">
        <div>Headlines</div>
        <div>Updated ${escapeHtml(headerUpdatedLabel || "")}</div>
      </div>
      ${buildNewsFiltersRowHTML(currentNewsFilter)}
      <div style="margin-top:8px;font-size:12px;">
        ${cacheLine}
      </div>
    </div>

    <div class="grid">
      ${cards || `<div class="notice">No headlines found for this filter.</div>`}
    </div>
  `;

  setTimeout(() => replaceMichiganText(document.getElementById("content") || document.body), 0);
}

async function renderTopNews(showLoading) {
  const content = document.getElementById("content");
  const headerUpdated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const cached = loadNewsCache();
  if (cached && Array.isArray(cached.items) && cached.items.length) {
    renderNewsList(cached.items, headerUpdated, cached.updatedLabel || "");
    const isFresh = (Date.now() - cached.ts) <= NEWS_CACHE_TTL_MS;
    if (!isFresh) refreshTopNewsInBackground();
    return;
  }

  if (showLoading) {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Top News</h2>
            <span class="badge">ESPN</span>
          </div>
          <button class="smallBtn" onclick="renderTopNews(true)">Refresh</button>
        </div>
        <div class="subline">
          <div>Headlines</div>
          <div>Updated ${escapeHtml(headerUpdated)}</div>
        </div>
        ${buildNewsFiltersRowHTML(currentNewsFilter)}
      </div>
      <div class="notice">Loading headlines…</div>
    `;
  }

  try {
    const items = await fetchTopNewsItemsFromESPN();
    const cacheLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    saveNewsCache(items, cacheLabel);
    renderNewsList(items, headerUpdated, cacheLabel);
  } catch (e) {
    const fallback = loadNewsCache();
    if (fallback && Array.isArray(fallback.items) && fallback.items.length) {
      renderNewsList(fallback.items, headerUpdated, fallback.updatedLabel || "");
      return;
    }

    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Top News</h2>
            <span class="badge">ESPN</span>
          </div>
          <button class="smallBtn" onclick="renderTopNews(true)">Retry</button>
        </div>
        <div class="subline">
          <div>Headlines</div>
          <div>Error</div>
        </div>
        ${buildNewsFiltersRowHTML(currentNewsFilter)}
      </div>

      <div class="notice" style="text-align:center;">
        Headlines are down right now.<br/>
        Hit Retry and we’ll run it back.
      </div>
    `;
  }

  async function refreshTopNewsInBackground() {
    try {
      const fresh = await fetchTopNewsItemsFromESPN();
      const cacheLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      saveNewsCache(fresh, cacheLabel);

      if (currentTab === "news") {
        const headerUpdated2 = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        renderNewsList(fresh, headerUpdated2, cacheLabel);
      }
    } catch {
      // silent
    }
  }
}

/* =========================
   SHOP CHAT (Firebase / Firestore)
   - One shared room: rooms/main/messages
   ========================= */

const CHAT_ROOM_ID = "main";
let chatUnsub = null;
let chatReady = false;

function getChatDisplayName() {
  const key = "theShopChatName_v1";
  let name = (localStorage.getItem(key) || "").trim();
  if (!name) {
    name = prompt("Chat name (shown to the group):", "") || "";
    name = name.trim().slice(0, 30);
    if (name) localStorage.setItem(key, name);
  }
  return name || "Anon";
}

async function ensureFirebaseChatReady() {
  if (chatReady) return;

  if (!window.firebase || !firebase.initializeApp) {
    throw new Error("Firebase SDK not loaded. Check index.html script tags.");
  }

  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  if (!auth.currentUser) {
    await auth.signInAnonymously();
  }

  chatReady = true;
}

function stopShopChatRealtime() {
  if (typeof chatUnsub === "function") chatUnsub();
  chatUnsub = null;
}

async function startShopChatRealtime() {
  ensureChatDisplayName();
  await ensureFirebaseChatReady();
  stopShopChatRealtime();

  // show loading immediately
  const status = document.getElementById("chatStatusLine");
  if (status) status.textContent = "Loading chat…";

  const db = firebase.firestore();

  const q = db
    .collection("rooms")
    .doc(CHAT_ROOM_ID)
    .collection("messages")
    .orderBy("ts", "desc")
    .limit(50);

  let firstLoadDone = false;

  chatUnsub = q.onSnapshot(
    (snap) => {
      const items = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      items.reverse(); // oldest -> newest

      renderShopChatMessages(items);

      // ✅ Connected UI
      setChatConnectionStatus(true);

      // ✅ Stop saying "Loading…" after the first good snapshot
      if (!firstLoadDone) {
        firstLoadDone = true;
        if (status) status.textContent = ""; // or "Ready."
      } else {
        // keep it blank after initial load
        if (status) status.textContent = "";
      }
    },
    (error) => {
      console.error("Chat listener error:", error);

      // 🔴 Disconnected UI
      setChatConnectionStatus(false);

      // show error state
      if (status) status.textContent = "Chat unavailable — try again.";
    }
  );
}

function setChatConnectionStatus(isConnected) {
  const dot = document.getElementById("chatStatusDot");
  const text = document.getElementById("chatStatusText");

  if (!dot || !text) return;

  if (isConnected) {
    dot.classList.remove("offline");
    dot.classList.add("online");
    text.textContent = "Connected";
  } else {
    dot.classList.remove("online");
    dot.classList.add("offline");
    text.textContent = "Disconnected";
  }
}

function renderShopChatMessages(items) {
  const list = document.getElementById("chatList");
  if (!list) return;

  const myName = getChatDisplayName();

  const html = (items || []).map(m => {
    const sender = escapeHtml(sanitizeTTUNText(m?.name || "Anon"));
    const text = escapeHtml(sanitizeTTUNText(m?.text || ""));

    const t = m?.ts?.toDate ? m.ts.toDate() : null;
    const time = t ? t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

    const isMine = (m?.name || "") === myName;

    return `
      <div class="chatMsgWrap ${isMine ? "mine" : ""}">
        <div class="chatMsgName">${sender}</div>
        <div class="chatMsgBubble ${isMine ? "mine" : ""}">
          <div class="chatMsgText">${text}</div>
          ${time ? `<div class="chatMsgTime">${escapeHtml(time)}</div>` : ``}
        </div>
      </div>
    `;
  }).join("");

  list.innerHTML = html || `<div class="notice">No messages yet. Start it up.</div>`;

  // Keep newest visible
  list.scrollTop = list.scrollHeight;

  // TTUN enforcement
  setTimeout(() => replaceMichiganText(), 0);
}

async function sendShopChatMessage() {
  const input = document.getElementById("chatInput");
  if (!input) return;

  const raw = String(input.value || "").trim();
  if (!raw) return;

  const text = sanitizeTTUNText(raw).slice(0, 500);
  input.value = "";

  await ensureFirebaseChatReady();

  const db = firebase.firestore();
  const name = getChatDisplayName();

  await db
    .collection("rooms")
    .doc(CHAT_ROOM_ID)
    .collection("messages")
    .add({
      name: sanitizeTTUNText(name).slice(0, 30),
      text,
      ts: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/* =========================
   SHOP TAB (placeholder hub)
   ========================= */
function renderShop() {
  const content = document.getElementById("content");

  content.innerHTML = `
    <div class="header">
      <div class="headerTop">
        <div class="brand">
          <h2 style="margin:0;">Shop</h2>
          <span class="badge">Hub</span>
        </div>
      </div>
      <div class="subline">
        <div>Tools for the shop</div>
        <div>Private</div>
      </div>
    </div>

    <div class="notice">
      <div style="font-weight:800; letter-spacing:0.5px;">GROUP CHAT</div>
      <div id="chatStatusLine" style="margin-top:6px; opacity:0.85;">Loading chat…</div>

<div id="chatRoomTitle" class="chatRoomTitle">
  <span id="chatRoomName">THE Chat</span>
  <span class="chatStatusWrap">
    • <span id="chatStatusDot" class="chatStatusDot"></span>
    <span id="chatStatusText">Connecting...</span>
  </span>
</div>

      <div style="margin-top:12px;">
      <div class="chatNameRow">
  <span id="chatUserNameLabel"></span>
  <button onclick="changeChatDisplayName()" class="chatNameBtn">Change</button>
</div>
        <div id="chatList" style="max-height:52vh; overflow:auto;"></div>
      </div>

      <div style="margin-top:12px; display:flex; gap:8px;">
        <input id="chatInput" type="text" placeholder="Type a message…" style="flex:1;" />
        <button class="smallBtn" id="chatSendBtn">Send</button>
      </div>

      <div style="margin-top:10px; opacity:0.7; font-size:12px;">
        One room • Real-time • Buckeye energy
      </div>
    </div>
  `;

  startShopChatRealtime()
    .catch(() => {
      const status = document.getElementById("chatStatusLine");
      if (status) status.textContent = "Chat unavailable — check Firebase config/rules.";
    });

  setTimeout(() => replaceMichiganText(), 0);
}

function getChatDisplayName() {
  let name = "";

  try {
    name = String(localStorage.getItem("shopChatName") || "").trim();
  } catch {
    name = "";
  }

  // If missing OR mistakenly set to the room name, re-prompt once
  if (!name || norm(name) === norm("THE Chat")) {
    const picked = prompt("Enter your name for group chat (example: Victor):", "");
    name = String(picked || "").trim();
    if (!name) name = "Anon";

    try {
      localStorage.setItem("shopChatName", name.slice(0, 20));
    } catch {}
  }

  // Update the small label if it exists
  const label = document.getElementById("chatUserNameLabel");
  if (label) label.textContent = `You: ${name}`;

  return name;
}

function ensureChatDisplayName() {
  let name = getChatDisplayName();

  if (!name) {
    name = prompt("Enter your display name:");
    if (!name) name = "Anon";
    localStorage.setItem("shopChatName", name.trim().slice(0, 20));
  }

  updateChatNameUI();
  return name;
}

function changeChatDisplayName() {
  const name = prompt("Enter new display name:");
  if (!name) return;

  localStorage.setItem("shopChatName", name.trim().slice(0, 20));
  updateChatNameUI();
}

function updateChatNameUI() {
  const label = document.getElementById("chatUserNameLabel");
  if (label) {
    label.textContent = `You: ${getChatDisplayName()}`;
  }
}

/* =========================
   GLOBAL TTUN REPLACER
   ========================= */

function replaceMichiganText(root = document.body) {
  // Build the banned terms without ever writing them as a single word in the source
  const a = ["Mi", "chigan"].join("");
  const b = ["Wol", "verines"].join("");

  const rxA = new RegExp(a, "gi");
  const rxB = new RegExp(b, "gi");

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue) continue;

    node.nodeValue = node.nodeValue
      .replace(rxA, "TTUN")
      .replace(rxB, "TTUN");
  }
}

/* =========================
   LOGOUT
   ========================= */
function logout() {
  // Clear role
  localStorage.removeItem("theShopRole_v1");

  // Stop refresh timers
  stopAutoRefresh();

  // Hide app, show login
  document.getElementById("app").style.display = "none";
  document.getElementById("login").style.display = "flex";

  // Clear content
  const content = document.getElementById("content");
  if (content) content.innerHTML = "";

  // Optional: clear code field
  const codeEl = document.getElementById("code");
  if (codeEl) codeEl.value = "";
}

/* =========================
   GROUP PICKS (Pick'em Slate)
   - Admin builds slate from ESPN games
   - Admin publishes slate
   - Everyone sees slate
   - Users submit home/away pick
   - Locks at game start (rules enforce it)
   ========================= */

async function gpGetAllPicksForSlate(db, slateId) {
  // Returns:
  // { [eventId]: [ { uid, name, side } ] }
  const out = {};

  // Get all users who have any picks doc under this slate
  const usersSnap = await db.collection("pickSlates").doc(slateId).collection("picks").get();
  const userDocs = usersSnap.docs || [];

  // For each user, read their per-game picks
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

  // Sort each game’s list by name so it’s stable
  Object.keys(out).forEach(eventId => {
    out[eventId].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  });

  return out;
}

function getRole() {
  return (localStorage.getItem(ROLE_KEY) || "guest").trim();
}

function slateIdFor(leagueKey, dateYYYYMMDD) {
  return `${leagueKey}__${dateYYYYMMDD}`;
}

function isPgaLeagueKey(k) {
  return String(k || "").toLowerCase() === "pga";
}

function fmtKickoff(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function kickoffMsFromEvent(ev) {
  const comp = ev?.competitions?.[0];
  const iso = ev?.date || comp?.date || "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
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

async function gpGetPublishedSlate(db, leagueKey, dateYYYYMMDD) {
  const q = db.collection("pickSlates")
    .where("leagueKey", "==", leagueKey)
    .where("dateYYYYMMDD", "==", dateYYYYMMDD)
    .where("published", "==", true)
    .limit(1);

  const snap = await q.get();
  if (snap.empty) return null;

  const doc0 = snap.docs[0];
  return { id: doc0.id, ...doc0.data() };
}

async function gpGetSlateGames(db, slateId) {
  const snap = await db.collection("pickSlates").doc(slateId).collection("games").get();
  const list = [];
  snap.forEach(d => list.push({ id: d.id, ...d.data() }));

  // sort by startTime if present
  list.sort((a,b) => {
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

async function gpSaveMyPick(db, slateId, uid, eventId, side) {
  const picksUserRef = db.collection("pickSlates").doc(slateId)
    .collection("picks").doc(uid);

  const gameRef = picksUserRef.collection("games").doc(eventId);

  const name = (typeof getPicksDisplayName === "function")
    ? String(getPicksDisplayName() || "Someone").trim()
    : "Someone";

  // ✅ Ensure parent doc exists so "everyone's picks" can find users
  await picksUserRef.set({
    uid: String(uid || ""),
    name,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Save the actual pick
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

  // ✅ Do NOT touch "published" here (prevents accidental unpublish)
  await slateRef.set({
    leagueKey,
    dateYYYYMMDD,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid
  }, { merge: true });

  // ✅ TRUE REPLACE: delete all existing game docs
  const existingSnap = await slateRef.collection("games").get();
  const batch = db.batch();
  existingSnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  // ✅ Write ONLY selected games with startTime as Timestamp
  for (const ev of (events || [])) {
    const eventId = String(ev?.id || "");
    if (!eventId) continue;
    if (!selectedEventIds.has(eventId)) continue;

    const { homeName, awayName } = getMatchupNamesFromEvent(ev);

    const startMs = kickoffMsFromEvent(ev);
    const startTime = startMs
      ? firebase.firestore.Timestamp.fromMillis(startMs)
      : null;

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

async function gpAdminPublishSlate(db, leagueKey, dateYYYYMMDD, uid) {
  const slateId = slateIdFor(leagueKey, dateYYYYMMDD);
  const slateRef = db.collection("pickSlates").doc(slateId);

  await slateRef.set({
    published: true,
    publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
    publishedBy: uid
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
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">ADMIN: SLATE BUILDER</div>
      </div>
      <div class="gameMetaTopLine">${escapeHtml(String(leagueKey || "").toUpperCase())} • ${escapeHtml(dateYYYYMMDD)}</div>
      <div class="gameMetaOddsLine">Select games, then Create/Replace, then Publish.</div>

      <div style="margin-top:8px;">
        ${rows || `<div class="notice">No games found for this date.</div>`}
      </div>

      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="smallBtn" data-gpadmin="create" data-league="${escapeHtml(leagueKey)}" data-date="${escapeHtml(dateYYYYMMDD)}">Create/Replace Slate</button>
        <button class="smallBtn" data-gpadmin="publish" data-league="${escapeHtml(leagueKey)}" data-date="${escapeHtml(dateYYYYMMDD)}">Publish Slate</button>
      </div>

      <div class="muted" id="gpAdminStatus" style="margin-top:8px;"></div>
    </div>
  `;
}

function gpBuildGroupPicksCardHTML({ slateId, games, myMap, published, allPicks }) {
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

  // Build rows + also build the "Everyone's Picks" view per game
  const rows = (games || []).map(g => {
    const eventId = String(g?.eventId || g?.id || "");
    if (!eventId) return "";

    const homeName = String(g?.homeName || "Home");
    const awayName = String(g?.awayName || "Away");

    const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
    const locked = startMs ? (Date.now() >= startMs) : false;

    const my = myMap?.[eventId]?.side || "";

    // Everyone's picks for this game: array of { name, side }
    const everyone = Array.isArray(allPicks?.[eventId]) ? allPicks[eventId] : [];

    // Render as "Name: Team"
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

function getPicksDisplayName(opts) {
  const askIfMissing = (opts && opts.askIfMissing === false) ? false : true;

  // Storage-safe helpers (private mode can throw)
  function safeGet(key) {
    try { return (localStorage.getItem(key) || ""); }
    catch (e) { return (window.__SK_MEM && window.__SK_MEM[key]) || ""; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); }
    catch (e) {
      window.__SK_MEM = window.__SK_MEM || {};
      window.__SK_MEM[key] = val;
    }
  }

  // Prefer existing chat name if it exists
  const existingChat = safeGet("shopChatName").trim();
  if (existingChat) return existingChat.slice(0, 20);

  let name = safeGet(PICKS_NAME_KEY).trim();

  if (!name && askIfMissing) {
    name = (prompt("Name for Picks (example: Victor):", "") || "").trim();
    if (!name) name = "Anon";
    safeSet(PICKS_NAME_KEY, name.slice(0, 20));
  }

  return (name || "Anon").slice(0, 20);
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
          <button class="smallBtn" data-picksaction="setName">Name</button>
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
    await ensureFirebaseChatReady();
    const db = firebase.firestore();

    // 1) Load scoreboard events (this should work since Scores works)
    const sb = await fetchScoreboardWithFallbacks(league, selectedDate);
    const events = sb.events || [];

    // 2) GROUP PICKS (Pick’em) — always try to render this first
let groupPicksHTML = "";
try {
  const role = getRole();
  const uid = firebase.auth().currentUser?.uid || "";

  // Skip PGA for now (not head-to-head)
  if (!isPgaLeagueKey(selectedKey)) {
    const eventsSorted = [...events].sort((a, b) => kickoffMsFromEvent(a) - kickoffMsFromEvent(b));
    const adminHTML = (role === "admin")
      ? gpBuildAdminSlateHTML(eventsSorted, selectedKey, selectedDate)
      : "";

    // ✅ Always use deterministic slate ID (prevents mismatched publish/read)
    const sid = slateIdFor(selectedKey, selectedDate);
    const slateRef = db.collection("pickSlates").doc(sid);
    const slateSnap = await slateRef.get();

    if (!slateSnap.exists) {
      // No slate at all yet
      groupPicksHTML =
        adminHTML +
        gpBuildGroupPicksCardHTML({
          slateId: sid,
          games: [],
          myMap: {},
          allPicks: {},
          published: false
        });
    } else {
      const slateData = slateSnap.data() || {};
      const isPublished = slateData.published === true;

      // Guest cannot see unpublished slate
      if (!isPublished && role !== "admin") {
        groupPicksHTML =
          gpBuildGroupPicksCardHTML({
            slateId: sid,
            games: [],
            myMap: {},
            allPicks: {},
            published: false
          });
      } else {
        // Admin can preview unpublished; everyone can see published
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
            published: isPublished
          });
      }
    }
  }
} catch (e) {
  console.error("Group Picks load error:", e);
  groupPicksHTML = `
    <div class="game">
      <div class="gameHeader">
        <div class="statusPill status-other">GROUP PICKS</div>
      </div>
      <div class="gameMetaTopLine">Group Picks error</div>
      <div class="gameMetaOddsLine">Open console for details.</div>
    </div>
  `;
}

    // 3) Units Picks (OLD system) — do NOT let it kill the page
    let leaderboardHTML = `
      <div class="game">
        <div class="gameHeader">
          <div class="statusPill status-other">UNITS PICKS</div>
        </div>
        <div class="gameMetaTopLine">Units Picks not enabled</div>
        <div class="gameMetaOddsLine">We’re rebuilding Picks from scratch.</div>
      </div>
    `;
    let myPicksHTML = "";
    let allPicksHTML = "";
    let gamesHTML = "";

    try {
      const picksSnap = await picksCollectionRef(db)
        .where("leagueKey", "==", selectedKey)
        .where("dateYYYYMMDD", "==", selectedDate)
        .orderBy("createdAt", "desc")
        .limit(250)
        .get();

      const picks = [];
      picksSnap.forEach(doc => picks.push({ id: doc.id, ...doc.data() }));

      await autoGradePicksForEvents(db, picks, events);

      const picksSnap2 = await picksCollectionRef(db)
        .where("leagueKey", "==", selectedKey)
        .where("dateYYYYMMDD", "==", selectedDate)
        .orderBy("createdAt", "desc")
        .limit(250)
        .get();

      const picks2 = [];
      picksSnap2.forEach(doc => picks2.push({ id: doc.id, ...doc.data() }));

      const leaderboard = computeLeaderboard(picks2);
      leaderboardHTML = renderLeaderboardHTML(leaderboard);

      const myName = getPicksDisplayName();
      const myPicks = picks2.filter(p => String(p.name || "") === myName);

      myPicksHTML = renderPicksListHTML(myPicks, "My Picks");
      allPicksHTML = renderPicksListHTML(picks2, "All Picks");

      gamesHTML = renderGamesForPickEntryHTML(events, selectedKey, selectedDate);
    } catch (unitsErr) {
      console.warn("Units Picks blocked or failed (this is OK for now):", unitsErr);
      // keep the placeholder card above
    }

    // 4) Render page
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
    console.error("renderPicks fatal error:", e);
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

  // ✅ PICKS HEADER ACTIONS (Name / Refresh)
  const picksAction = btn.getAttribute("data-picksaction");
  if (picksAction) {

    if (picksAction === "refresh") {
      renderPicks(true);
      return;
    }

    if (picksAction === "setName") {
      const current = getPicksDisplayName({ askIfMissing: false });
      const newName = (prompt("Name for Picks (example: Victor):", current) || "").trim();

      if (newName) {
        const val = newName.slice(0, 20);
        try {
          localStorage.setItem(PICKS_NAME_KEY, val);
        } catch (err) {
          window.__SK_MEM = window.__SK_MEM || {};
          window.__SK_MEM[PICKS_NAME_KEY] = val;
        }
      }

      renderPicks(true);
      return;
    }
  }

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

  // =========================
  // GROUP PICKS actions
  // =========================

  // (A) User pick buttons (home/away)
  const gpPick = btn.getAttribute("data-gppick");
  if (gpPick) {
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

    return;
  }

  // (B) Admin slate buttons (create/publish)
const gpAdmin = btn.getAttribute("data-gpadmin");
if (gpAdmin) {
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

      // ✅ CRITICAL: confirm server-side role doc exists (rules depend on this)
      const userSnap = await db.collection("users").doc(uid).get();
      const serverRole = userSnap.exists ? String((userSnap.data() || {}).role || "") : "";
      if (serverRole !== "admin") {
        alert(
          "Your account is not admin on the server yet.\n\n" +
          "Fix:\n" +
          "1) Log out\n" +
          "2) Enter the ADMIN invite code again\n\n" +
          "This creates users/{uid}.role = admin, which Firestore rules require."
        );
        return;
      }

      const statusEl = document.getElementById("gpAdminStatus");
      if (statusEl) statusEl.textContent = (gpAdmin === "publish") ? "Publishing…" : "Saving slate…";

      // Read the checked games from the Admin UI
      const checks = Array.from(document.querySelectorAll('input[type="checkbox"][data-gpcheck="1"]'));
      const selected = new Set(
        checks
          .filter(c => c.checked)
          .map(c => String(c.getAttribute("data-eid") || ""))
          .filter(Boolean)
      );

      if (selected.size === 0) {
        if (statusEl) statusEl.textContent = "Select at least 1 game first.";
        alert("Select at least 1 game first.");
        return;
      }

      // Re-fetch scoreboard so we have full event objects to write
      const league = getLeagueByKey(leagueKey);
      const sb = await fetchScoreboardWithFallbacks(league, dateYYYYMMDD);
      const events = sb.events || [];

      // Always save selected games first (true replace)
      const sid = await gpAdminCreateOrReplaceSlate(db, leagueKey, dateYYYYMMDD, uid, selected, events);

      // Read back slate games count to prove it saved
      const gamesSnap = await db.collection("pickSlates").doc(sid).collection("games").get();
      const gameCount = gamesSnap.size || 0;

      if (gpAdmin === "publish") {
        await gpAdminPublishSlate(db, leagueKey, dateYYYYMMDD, uid);
      }

      const pubLabel = (gpAdmin === "publish") ? "published" : "saved";
      if (statusEl) statusEl.textContent = `Slate ${pubLabel} ✅ (${gameCount} game${gameCount === 1 ? "" : "s"})`;

      // If somehow 0 saved, stop here and tell you
      if (gameCount === 0) {
        alert(
          "Slate saved with 0 games.\n\n" +
          "This usually means the selected event IDs were not found in the ESPN events list.\n" +
          "Try Refresh, then select again."
        );
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

  // =========================
  // Units Picks actions (existing)
  // =========================
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
