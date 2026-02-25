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

/* =========================
   UI: League + Calendar (iOS-safe native picker)
   ========================= */

// Convert YYYYMMDD -> YYYY-MM-DD (for <input type="date">)
function yyyymmddToInputValue(yyyymmdd) {
  const s = String(yyyymmdd || "").trim();
  if (!/^\d{8}$/.test(s)) return "";
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

// Convert YYYY-MM-DD -> YYYYMMDD
function inputValueToYYYYMMDD(v) {
  const s = String(v || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s.replaceAll("-", "");
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

/**
 * iOS-safe approach:
 * - Render a normal 📅 button for visuals
 * - Overlay the REAL <input type="date"> on top (opacity 0)
 * - User tap is on the input itself → picker always opens in Safari + PWA
 */
/**
 * iOS-safe approach:
 * - Render a normal 📅 button for visuals
 * - Overlay the REAL <input type="date"> on top (opacity 0)
 * - Wire onchange/oninput directly so date selection actually reloads scores
 */
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
function handleNativeDateChangeFromEl(el) {
  const v = el?.value || "";
  const yyyymmdd = inputValueToYYYYMMDD(v);
  if (!yyyymmdd) return;

  saveDateYYYYMMDD(yyyymmdd);

  // Reload scores (date affects scores)
  loadScores(true);
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

    // Call HTTPS endpoint (CORS-safe)
    const resp = await fetch(
      "https://us-central1-the-shop-chat.cloudfunctions.net/redeemInviteCodeHttp",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ code: entered })
      }
    );

    const data = await resp.json().catch(() => ({}));

    role = String(data?.role || "");
    if (!resp.ok || (role !== "admin" && role !== "guest")) {
      throw new Error("Invalid code");
    }
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
    if (app) app.style.display = "none";

    if (login) login.classList.remove("loginUnlocking", "loginFadeOut");

    if (typeof buildTabsForRole === "function") buildTabsForRole(role);

    const entry = document.getElementById("entry");
    if (entry) {
      entry.querySelectorAll(".adminOnly").forEach(el => {
        el.style.display = (role === "admin") ? "" : "none";
      });
    }

    if (typeof showEntryScreen === "function") {
      showEntryScreen();
    } else {
      // fallback (shouldn't happen in your current build)
      if (app) app.style.display = "block";
      if (typeof showTab === "function") showTab("scores");
    }
  }, 520);
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


    .collection("games").doc(eventId);

  await ref.set({
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
    published: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: uid
  }, { merge: true });

  // write games docs
  for (const ev of (events || [])) {
    const eventId = String(ev?.id || "");
    if (!eventId) continue;
    if (!selectedEventIds.has(eventId)) continue;

    const { homeName, awayName, iso } = getMatchupNamesFromEvent(ev);
    const startDate = iso ? new Date(iso) : null;
