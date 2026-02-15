/* =========================
   The Shop — Gold Standard v1
   - Scores (ESPN) + robust odds
   - PGA Top 15 leaderboard view
   - Wagers (Firebase v0.1): rooms + picks + leaderboard
   ========================= */

let refreshIntervalId = null;
let currentTab = null;

const STORAGE_KEY = "theShopLeague_v1";
const DATE_KEY = "theShopDate_v1"; // stores YYYYMMDD

// Wagers (Firebase)
const WAGERS_USER_KEY = "theShopWagersUser_v1";   // display name
const WAGERS_ROOM_KEY = "theShopWagersRoom_v1";   // room id/code

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

  // Accept MM/DD/YYYY
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
/* ======================= */

/* =========================
   VENUE + ODDS HELPERS
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

function getVenueParts(competition) {
  return getVenuePartsFromVenueObj(competition?.venue || null);
}

function buildVenueLine(competition) {
  const v = getVenueParts(competition);
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

function parseOddsFromSummary(summaryData, fallbackComp) {
  // 1) summary.pickcenter
  const pcArr = summaryData?.pickcenter;
  if (Array.isArray(pcArr) && pcArr.length) {
    const comp = summaryData?.header?.competitions?.[0] || fallbackComp || null;
    const competitors = comp?.competitors || [];
    const home = competitors.find(t => t.homeAway === "home");
    const away = competitors.find(t => t.homeAway === "away");
    const homeName = home?.team?.displayName || "Home";
    const awayName = away?.team?.displayName || "Away";

    const parsed = parseOddsFromPickcenter(pcArr[0], homeName, awayName);
    if (parsed.favored || parsed.ou) return parsed;
  }

  // 2) competition.pickcenter (sometimes nested)
  const sc0 = summaryData?.header?.competitions?.[0] || fallbackComp || null;
  const pcComp = firstPickcenterFromCompetition(sc0);
  if (pcComp) {
    const competitors = sc0?.competitors || [];
    const home = competitors.find(t => t.homeAway === "home");
    const away = competitors.find(t => t.homeAway === "away");
    const homeName = home?.team?.displayName || "Home";
    const awayName = away?.team?.displayName || "Away";
    const parsed = parseOddsFromPickcenter(pcComp, homeName, awayName);
    if (parsed.favored || parsed.ou) return parsed;
  }

  // 3) competition.odds
  const o2 = firstOddsFromCompetition(sc0);
  if (o2 && (o2.details || o2.overUnder !== undefined || o2.total !== undefined)) {
    return {
      favored: cleanFavoredText(o2.details || o2.displayValue || ""),
      ou: normalizeNumberString(o2.overUnder ?? o2.total ?? "")
    };
  }

  // 4) top-level odds
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
/* ======================= */

/* =========================
   ODDS FETCH (RELIABLE)
   ========================= */
const ODDS_CONCURRENCY_LIMIT = 6;
const ODDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ODDS_STORAGE_PREFIX = "theShopOddsCache_v1"; // sessionStorage key prefix

const oddsCache = new Map();    // cacheKey -> { favored, ou, ts }
const oddsInFlight = new Map(); // cacheKey -> Promise

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
      if (!val || typeof val !== "object") continue;
      const ts = Number(val.ts || 0);
      if (!Number.isFinite(ts) || (now - ts) > ODDS_CACHE_TTL_MS) continue;

      const ck = oddsCacheKey(leagueKey, dateYYYYMMDD, eventId);
      oddsCache.set(ck, { favored: val.favored || "", ou: val.ou || "", ts });
    }
  } catch (e) {}
}

let oddsCacheSaveTimer = null;
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
  return card.querySelector(".gameMetaOddsLine");
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
    const joiner = url.includes("?") ? "&" : "?";
    let out = url;
    if (!/([?&])lang=/.test(out)) out += `${joiner}lang=en`;
    if (!/([?&])region=/.test(out)) out += `${out.includes("?") ? "&" : "?"}region=us`;
    return out;
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
  const results = [];
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function hydrateAllOdds(events, league, leagueKey, dateYYYYMMDD) {
  loadOddsCacheFromSession(leagueKey, dateYYYYMMDD);

  const jobs = events
    .map(e => {
      const eventId = String(e?.id || "");
      const competition = e?.competitions?.[0] || null;
      return { eventId, competition };
    })
    .filter(j => j.eventId);

  // apply cached + scoreboard first
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
/* ======================= */

/* =========================
   PGA Top 15 Leaderboard
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
    c?.player?.displayName ||
    c?.player?.fullName ||
    c?.competitor?.displayName ||
    c?.displayName ||
    "—"
  );
}

function getGolferPos(c) {
  return (
    c?.position?.displayName ||
    c?.position?.shortDisplayName ||
    c?.position ||
    c?.rank ||
    c?.order ||
    ""
  );
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
    statValueByName(c?.statistics, ["To Par", "toPar", "Topar"]) ||
    statValueByName(c?.statistics, ["Score", "Total", "Strokes"]) ||
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

  const fromStats =
    statValueByName(c?.statistics, ["Thru", "THRU", "Hole", "Holes", "Current Hole", "currentHole"]) ||
    "";

  const pick = fromStatus || fromStats;
  return normalizeThruLabel(pick);
}

function getTournamentName(event, competition) {
  return (
    event?.name ||
    event?.shortName ||
    event?.longName ||
    competition?.tournament?.name ||
    competition?.tournament?.shortName ||
    competition?.name ||
    "Tournament"
  );
}

function getTournamentLocationLine(event, competition) {
  const v1 = competition?.venue || null;
  const v2 = event?.venue || null;
  const v3 = (Array.isArray(event?.venues) && event.venues.length) ? event.venues[0] : null;
  const v4 = event?.competitions?.[0]?.venue || null;

  const chosen = v1 || v2 || v3 || v4 || null;
  if (!chosen) return "—";

  const parts = getVenuePartsFromVenueObj(chosen);
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

    golfers.sort((a, b) => {
      if (a.sortPos !== b.sortPos) return a.sortPos - b.sortPos;
      return a.name.localeCompare(b.name);
    });

    const top15 = golfers.slice(0, 15);

    const card = document.createElement("div");
    card.className = "game golfCard";

    const venueText = `${tournamentName} — ${locationLine}`;

    card.innerHTML = `
      <div class="gameHeader">
        <div class="statusPill ${pillClass}">${escapeHtml(pillText)}</div>
      </div>

      <div class="gameMetaTopLine" aria-label="Tournament and location">
        ${escapeHtml(venueText)}
      </div>

      <div class="gameMetaOddsLine" aria-label="Leaderboard">
        Top 15 Leaderboard
      </div>
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
/* ======================= */

/* =========================
   FIREBASE WAGERS (v0.1)
   ========================= */
let fb = null;
let fbInitPromise = null;
let fbUnsubPicks = null;

async function initFirebaseIfNeeded() {
  if (fb) return fb;
  if (fbInitPromise) return fbInitPromise;

  fbInitPromise = (async () => {
    const appMod = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
    const authMod = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js");
    const fsMod = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

    const app = appMod.initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    const db = fsMod.getFirestore(app);

    fb = {
      auth,
      db,
      signInAnon: () => authMod.signInAnonymously(auth),
      onAuth: (cb) => authMod.onAuthStateChanged(auth, cb),
      doc: fsMod.doc,
      setDoc: fsMod.setDoc,
      getDoc: fsMod.getDoc,
      serverTimestamp: fsMod.serverTimestamp,
      collection: fsMod.collection,
      query: fsMod.query,
      where: fsMod.where,
      onSnapshot: fsMod.onSnapshot
    };
    return fb;
  })();

  return fbInitPromise;
}

function getWagersUserName() {
  return (localStorage.getItem(WAGERS_USER_KEY) || "").trim();
}

function setWagersUserName(name) {
  localStorage.setItem(WAGERS_USER_KEY, String(name || "").trim());
}

function getWagersRoomId() {
  return (localStorage.getItem(WAGERS_ROOM_KEY) || "").trim();
}

function setWagersRoomId(roomId) {
  localStorage.setItem(WAGERS_ROOM_KEY, String(roomId || "").trim());
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function buildEventKey(leagueKey, dateYYYYMMDD, eventId) {
  return `${leagueKey}|${dateYYYYMMDD}|${eventId}`;
}

async function ensureSignedIn() {
  const f = await initFirebaseIfNeeded();
  if (f.auth.currentUser) return f.auth.currentUser;

  await f.signInAnon();
  return new Promise((resolve) => {
    const unsub = f.onAuth((u) => {
      if (u) {
        unsub();
        resolve(u);
      }
    });
  });
}

async function createRoomIfMissing(roomId) {
  const f = await initFirebaseIfNeeded();
  const user = await ensureSignedIn();

  const roomRef = f.doc(f.db, "rooms", roomId);
  const snap = await f.getDoc(roomRef);
  if (!snap.exists()) {
    await f.setDoc(roomRef, {
      createdAt: f.serverTimestamp(),
      createdBy: user.uid,
      v: 1
    }, { merge: true });
  }

  const name = getWagersUserName() || "Guest";
  const memberRef = f.doc(f.db, "rooms", roomId, "members", user.uid);
  await f.setDoc(memberRef, {
    name,
    joinedAt: f.serverTimestamp()
  }, { merge: true });
}

async function joinRoomFlow() {
  const current = getWagersRoomId();
  const input = prompt(
    `Enter a Room Code to join (or leave blank to create a new one).\n\nCurrent: ${current || "None"}`,
    current || ""
  );
  if (input === null) return;

  const cleaned = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  const roomId = cleaned || randomRoomCode();

  setWagersRoomId(roomId);
  await createRoomIfMissing(roomId);
  renderWagers(true);
}

async function setNameFlow() {
  const current = getWagersUserName();
  const input = prompt("Your display name for wagers:", current || "");
  if (input === null) return;
  const cleaned = String(input || "").trim();
  if (!cleaned) {
    alert("Name can’t be blank.");
    return;
  }
  setWagersUserName(cleaned);

  const roomId = getWagersRoomId();
  if (roomId) {
    try {
      const f = await initFirebaseIfNeeded();
      const user = await ensureSignedIn();
      const memberRef = f.doc(f.db, "rooms", roomId, "members", user.uid);
      await f.setDoc(memberRef, { name: cleaned }, { merge: true });
    } catch (e) {}
  }

  renderWagers(false);
}

function stopWagersListeners() {
  if (fbUnsubPicks) {
    try { fbUnsubPicks(); } catch (e) {}
  }
  fbUnsubPicks = null;
}

async function setPick(roomId, leagueKey, dateYYYYMMDD, eventId, pick, teamName) {
  const f = await initFirebaseIfNeeded();
  const user = await ensureSignedIn();
  const name = getWagersUserName() || "Guest";

  const eventKey = buildEventKey(leagueKey, dateYYYYMMDD, eventId);
  const docId = `${eventKey}|${user.uid}`;

  const pickRef = f.doc(f.db, "rooms", roomId, "picks", docId);
  await f.setDoc(pickRef, {
    uid: user.uid,
    name,
    leagueKey,
    date: dateYYYYMMDD,
    eventId,
    pick,
    teamName: teamName || "",
    updatedAt: f.serverTimestamp()
  }, { merge: true });
}

function getWinnerFromCompetition(competition) {
  const competitors = competition?.competitors || [];
  const home = competitors.find(c => c.homeAway === "home");
  const away = competitors.find(c => c.homeAway === "away");
  const homeScore = Number(home?.score ?? "");
  const awayScore = Number(away?.score ?? "");
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return "";
  if (homeScore === awayScore) return "";
  return homeScore > awayScore ? "home" : "away";
}

function buildPickLine(picksForEvent, homeName, awayName) {
  if (!picksForEvent.length) return "Picks: —";
  const maxShow = 3;
  const shown = picksForEvent.slice(0, maxShow);
  const more = picksForEvent.length - shown.length;
  const parts = shown.map(p => {
    const who = p.name || "Someone";
    const team = p.pick === "home" ? homeName : awayName;
    return `${who} → ${team}`;
  });
  if (more > 0) parts.push(`+${more} more`);
  return `Picks: ${parts.join(" • ")}`;
}

async function listenToPicks(roomId, leagueKey, dateYYYYMMDD, onUpdate) {
  stopWagersListeners();
  const f = await initFirebaseIfNeeded();
  await ensureSignedIn();

  const picksCol = f.collection(f.db, "rooms", roomId, "picks");
  const q = f.query(
    picksCol,
    f.where("leagueKey", "==", leagueKey),
    f.where("date", "==", dateYYYYMMDD)
  );

  fbUnsubPicks = f.onSnapshot(q, (snap) => {
    const picks = [];
    snap.forEach(docSnap => {
      const d = docSnap.data() || {};
      picks.push({
        uid: d.uid || "",
        name: d.name || "",
        leagueKey: d.leagueKey || "",
        date: d.date || "",
        eventId: d.eventId || "",
        pick: d.pick || ""
      });
    });
    onUpdate(picks);
  }, (err) => {
    onUpdate({ error: String(err?.message || err) });
  });
}

function computeLeaderboard(picks, resultsByEventId) {
  const byUser = new Map();
  for (const p of picks) {
    const key = p.uid || p.name || "unknown";
    if (!byUser.has(key)) byUser.set(key, { name: p.name || "Unknown", wins: 0, losses: 0, pending: 0 });
    const row = byUser.get(key);

    const res = resultsByEventId.get(p.eventId);
    if (!res || res.state !== "post" || !res.winner) {
      row.pending++;
      continue;
    }
    if (p.pick === res.winner) row.wins++;
    else row.losses++;
  }
  return Array.from(byUser.values()).sort((a,b) => (b.wins - a.wins) || (a.losses - b.losses) || a.name.localeCompare(b.name));
}

async function renderWagers(showLoading) {
  const content = document.getElementById("content");

  const selectedDate = getSavedDateYYYYMMDD();
  const prettyDate = yyyymmddToPretty(selectedDate);
  const now = new Date();
  const updatedTime = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const selectedKey = getSavedLeagueKey();
  const league = getLeagueByKey(selectedKey);

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
  `;

  const sel = document.getElementById("leagueSelect");
  if (sel) {
    sel.addEventListener("change", () => {
      saveLeagueKey(sel.value);
      renderWagers(true);
    });
  }

  const dateBtn = document.getElementById("dateBtn");
  if (dateBtn) {
    dateBtn.addEventListener("click", () => {
      promptForDateAndReloadWagers();
    });
  }

  content.innerHTML += `
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

  document.getElementById("setNameBtn")?.addEventListener("click", () => setNameFlow());
  document.getElementById("joinRoomBtn")?.addEventListener("click", async () => {
    if (!getWagersUserName()) {
      alert("Set your Name first so your buddies can see who you are.");
      return;
    }
    try {
      await joinRoomFlow();
    } catch (e) {
      alert("Couldn’t join room yet. Make sure Anonymous Auth + Firestore are enabled and rules are pasted.");
    }
  });

  if (!userName || !roomId) {
    content.innerHTML += `
      <div class="notice">
        Next steps:
        <div style="margin-top:8px; opacity:0.8; font-size:12px;">
          1) Tap <strong>Set Name</strong><br/>
          2) Tap <strong>Join / Create</strong> and text the Room Code to your buddies
        </div>
      </div>
    `;
    return;
  }

  try {
    await createRoomIfMissing(roomId);
  } catch (e) {
    content.innerHTML += `
      <div class="notice">
        Firebase isn’t ready yet. Double-check:
        <div style="margin-top:8px; opacity:0.8; font-size:12px;">
          • Anonymous Auth enabled<br/>
          • Firestore created<br/>
          • Rules pasted
        </div>
      </div>
    `;
    return;
  }

  const result = await fetchScoreboardWithFallbacks(league, selectedDate);
  let events = result.events;

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

  if (league.key === "pga") {
    content.innerHTML += `<div class="notice">Wagers are for team sports right now. Switch leagues above.</div>`;
    return;
  }

  // favorites-first sort
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

  const lb = document.createElement("div");
  lb.className = "notice";
  lb.innerHTML = `<div class="leaderboardTitle"><strong>Leaderboard</strong></div><div class="leaderboardBody">Loading…</div>`;
  content.appendChild(lb);

  const grid = document.createElement("div");
  grid.className = "grid";
  content.appendChild(grid);

  const resultsByEventId = new Map();

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
    const eventKey = buildEventKey(selectedKey, selectedDate, eventId);

    const winner = state === "post" ? getWinnerFromCompetition(competition) : "";
    resultsByEventId.set(eventId, { winner, state });

    const card = document.createElement("div");
    card.className = "game wagersGame";
    if (eventId) card.setAttribute("data-eventid", eventId);

    card.innerHTML = `
      <div class="gameHeader">
        <div class="statusPill ${pillClass}">${pillText}</div>
      </div>

      <div class="gameMetaTopLine" aria-label="Venue">
        ${escapeHtml(venueLine)}
      </div>

      <div class="gameMetaOddsLine" aria-label="Betting line">
        ${escapeHtml(initialOddsText)}
      </div>

      <div class="teamRow">
        <div class="teamLeft">
          <div class="teamLine">
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
            <div class="teamText">
              <div class="teamName">${escapeHtml(homeName)}</div>
              <div class="teamMeta">Home</div>
            </div>
          </div>
        </div>
        <div class="score">${homeScore}</div>
      </div>

      <div class="wagerActions">
        <button class="smallBtn wagerBtn" data-pick="away" data-eventid="${escapeHtml(eventId)}" data-team="${escapeHtml(awayName)}">Pick Away</button>
        <button class="smallBtn wagerBtn" data-pick="home" data-eventid="${escapeHtml(eventId)}" data-team="${escapeHtml(homeName)}">Pick Home</button>
      </div>

      <div class="wagerPicksLine" data-eventkey="${escapeHtml(eventKey)}">Picks: —</div>
    `;

    grid.appendChild(card);
  });

  // odds hydration (same engine as Scores)
  hydrateAllOdds(events, league, selectedKey, selectedDate);

  grid.querySelectorAll(".wagerBtn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const eventId = btn.getAttribute("data-eventid") || "";
      const pick = btn.getAttribute("data-pick") || "";
      const teamName = btn.getAttribute("data-team") || "";
      if (!eventId || (pick !== "home" && pick !== "away")) return;

      try {
        await setPick(roomId, selectedKey, selectedDate, eventId, pick, teamName);
      } catch (e) {
        alert("Couldn’t save pick. Check Firebase rules/auth.");
      }
    });
  });

  await listenToPicks(roomId, selectedKey, selectedDate, (payload) => {
    if (payload && payload.error) {
      lb.querySelector(".leaderboardBody").textContent = "Firebase rules/auth not ready.";
      return;
    }

    const picks = Array.isArray(payload) ? payload : [];
    const byEventKey = new Map();
    for (const p of picks) {
      const ek = buildEventKey(p.leagueKey, p.date, p.eventId);
      if (!byEventKey.has(ek)) byEventKey.set(ek, []);
      byEventKey.get(ek).push(p);
    }

    grid.querySelectorAll(".wagerPicksLine").forEach(el => {
      const ek = el.getAttribute("data-eventkey") || "";
      const parts = ek.split("|");
      const eventId = parts[2] || "";
      const card = grid.querySelector(`.game[data-eventid="${CSS.escape(eventId)}"]`);
      if (!card) return;
      const teamNames = card.querySelectorAll(".teamName");
      const awayName = teamNames?.[0]?.textContent || "Away";
      const homeName = teamNames?.[1]?.textContent || "Home";

      const arr = byEventKey.get(ek) || [];
      el.textContent = buildPickLine(arr, homeName, awayName);
    });

    const rows = computeLeaderboard(picks, resultsByEventId);
    if (!rows.length) {
      lb.querySelector(".leaderboardBody").textContent = "No picks yet.";
      return;
    }
    lb.querySelector(".leaderboardBody").innerHTML = rows.map(r => {
      return `<div class="leaderboardRow">${escapeHtml(r.name)}: ${r.wins}-${r.losses} <span style="opacity:0.7;">(pending ${r.pending})</span></div>`;
    }).join("");
  });
}

function promptForDateAndReloadWagers() {
  const current = getSavedDateYYYYMMDD();
  const pretty = yyyymmddToPretty(current);

  const input = prompt(
    `Pick a date:\n\n• Enter: YYYY-MM-DD (example: 2026-02-15)\n• Or: MM/DD/YYYY (example: 02/15/2026)\n• Or type: today\n\nCurrent: ${pretty} (${current})`,
    `${current.slice(0,4)}-${current.slice(4,6)}-${current.slice(6,8)}`
  );

  if (input === null) return;

  const parsed = parseUserDateToYYYYMMDD(input);
  if (!parsed) {
    alert("Date not recognized. Try YYYY-MM-DD or MM/DD/YYYY.");
    return;
  }

  saveDateYYYYMMDD(parsed);
  renderWagers(true);
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
  refreshIntervalId = setInterval(() => {
    if (currentTab === "scores") loadScores(false);
    if (currentTab === "wagers") renderWagers(false);
  }, 30000);
}

function showTab(tab) {
  currentTab = tab;
  setActiveTabButton(tab);
  stopAutoRefresh();

  stopWagersListeners();

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

  if (input === null) return;

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

    // PGA: Top 15 leaderboard
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

      const homeTeam = home?.team || null;
      const awayTeam = away?.team || null;
      const homeLogo = getTeamLogoUrl(homeTeam);
      const awayLogo = getTeamLogoUrl(awayTeam);
      const homeAbbrev = escapeHtml(getTeamAbbrev(homeTeam)).slice(0, 4);
      const awayAbbrev = escapeHtml(getTeamAbbrev(awayTeam)).slice(0, 4);

      const venueLine = buildVenueLine(competition);

      const initialOdds = parseOddsFromScoreboardCompetition(competition);
      const initialOddsText = buildOddsLine(initialOdds.favored, initialOdds.ou);

      const eventId = String(event?.id || "");

      const card = document.createElement("div");
      card.className = "game";
      if (eventId) card.setAttribute("data-eventid", eventId);

      card.innerHTML = `
        <div class="gameHeader">
          <div class="statusPill ${pillClass}">${pillText}</div>
        </div>

        <div class="gameMetaTopLine" aria-label="Venue">
          ${escapeHtml(venueLine)}
        </div>

        <div class="gameMetaOddsLine" aria-label="Betting line">
          ${escapeHtml(initialOddsText)}
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
      `;

      grid.appendChild(card);
    });

    content.appendChild(grid);

    hydrateAllOdds(events, league, selectedKey, selectedDate);

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

/* =========================
   UI / TABS
   ========================= */
function setActiveTabButton(tab) {
  document.querySelectorAll(".tabs button").forEach(btn => btn.classList.remove("active"));
  const map = { scores: 0, wagers: 1, shop: 2 };
  const idx = map[tab];
  const btn = document.querySelectorAll(".tabs button")[idx];
  if (btn) btn.classList.add("active");
}

/* =========================
   Auto refresh
   ========================= */
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

function showTab(tab) {
  currentTab = tab;
  setActiveTabButton(tab);
  stopAutoRefresh();

  stopWagersListeners();

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
   Status label helpers
   ========================= */
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