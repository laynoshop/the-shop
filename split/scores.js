/* =========================
   SCORES TAB (Gold Standard)
   - ESPN scoreboard fetch w/ fallbacks
   - Favorites-first sorting (shows ALL games)
   - Odds parse + background hydration via Summary
   - AI EDGE (local compute + cache, no flicker)
   - Header matches big script look
   ========================= */

(function ScoresTabModule () {
  // ---------- Storage keys ----------
  const LEAGUE_KEY = "theShopLeague_v1";
  const DATE_KEY   = "theShopDate_v1"; // YYYYMMDD

  // ---------- Favorites (top priority, in this order) ----------
  const FAVORITES = [
    "Ohio State Buckeyes",
    "Duke Blue Devils",
    "West Virginia Mountaineers",
    "Columbus Blue Jackets",
    "Columbus Crew",
    "Carolina Hurricanes",
    "Carolina Panthers",
    "Dallas Cowboys",
    "Boston Red Sox",
    "Cleveland Guardians"
  ];

  // ---------- Leagues (dropdown) ----------
  // NOTE: Added MLS (Soccer) — usa.1 is ESPN's MLS league key
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

    // ✅ NEW: MLS
    {
      key: "mls",
      name: "MLS (Soccer)",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) =>
        `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/summary?event=${eventId}`
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

  // Expose for other split modules (ex: Picks builder uses window.LEAGUES if present)
  // This helps keep league lists consistent across tabs.
  window.LEAGUES = LEAGUES;

  // ---------- iOS/PWA safety ----------
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

  function norm(s) {
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }
  const FAVORITES_NORM = FAVORITES.map(norm);

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getLeagueByKey(key) {
    return LEAGUES.find(l => l.key === key) || LEAGUES[0];
  }

  function getSavedLeagueKey() {
    let saved = "";
    try { saved = String(localStorage.getItem(LEAGUE_KEY) || "").trim(); } catch {}
    if (saved && getLeagueByKey(saved)) return saved;

    const fallback = (LEAGUES[0] && LEAGUES[0].key) ? String(LEAGUES[0].key) : "nfl";
    try { localStorage.setItem(LEAGUE_KEY, fallback); } catch {}
    return fallback;
  }

  function saveLeagueKey(k) {
    const v = String(k || "").trim();
    if (!v) return;
    try { localStorage.setItem(LEAGUE_KEY, v); } catch {}
  }

  function formatDateYYYYMMDD(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }

  function getSavedDateYYYYMMDD() {
    let saved = null;
    try { saved = localStorage.getItem(DATE_KEY); } catch {}
    if (saved && /^\d{8}$/.test(saved)) return saved;

    const today = formatDateYYYYMMDD(new Date());
    try { localStorage.setItem(DATE_KEY, today); } catch {}
    return today;
  }

  function saveDateYYYYMMDD(yyyymmdd) {
    try { localStorage.setItem(DATE_KEY, String(yyyymmdd || "")); } catch {}
  }

  function yyyymmddToPretty(yyyymmdd) {
    if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return "";
    const yyyy = Number(yyyymmdd.slice(0, 4));
    const mm = Number(yyyymmdd.slice(4, 6));
    const dd = Number(yyyymmdd.slice(6, 8));
    const dt = new Date(yyyy, mm - 1, dd);
    return dt.toLocaleDateString([], { month: "short", day: "numeric" });
  }

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

  // Exported for inline onchange/oninput
  window.handleNativeDateChangeFromEl = function (el) {
    const v = el?.value || "";
    const yyyymmdd = inputValueToYYYYMMDD(v);
    if (!yyyymmdd) return;
    saveDateYYYYMMDD(yyyymmdd);

    // rerender current tab if your router tracks it; otherwise just scores
    const tab = window.__activeTab || "scores";
    if (typeof window.showTab === "function") window.showTab(tab);
    else window.loadScores(true);
  };

  // League change (no duplicate handlers)
  if (!window.__scoresLeagueChangeBound) {
    window.__scoresLeagueChangeBound = true;
    document.addEventListener("change", (e) => {
      const sel = e.target;
      if (!sel || sel.id !== "leagueSelect") return;
      const key = String(sel.value || "").trim();
      if (!key) return;
      saveLeagueKey(key);
      const tab = window.__activeTab || "scores";
      if (typeof window.showTab === "function") window.showTab(tab);
      else window.loadScores(true);
    });
  }

  // ---------- Team / rank / record helpers (matches big file behavior) ----------
  function getTeamLogoUrl(team) {
    if (!team) return "";
    if (team.logo) return team.logo;
    const logos = team.logos;
    if (Array.isArray(logos) && logos.length > 0) return logos[0].href || "";
    return "";
  }

  function getOverallRecordFromCompetitor(competitor) {
    const recs = competitor?.records;
    if (!Array.isArray(recs) || !recs.length) return "";
    const overall =
      recs.find(r => String(r?.name || "").toLowerCase() === "overall") ||
      recs.find(r => String(r?.type || "").toLowerCase() === "total") ||
      recs[0];
    return String(overall?.summary || "").trim();
  }

  function homeAwayWithRecord(homeAwayLabel, competitor, leagueKey) {
    if (leagueKey !== "ncaam" && leagueKey !== "cfb") return homeAwayLabel;
    const rec = getOverallRecordFromCompetitor(competitor);
    return rec ? `${homeAwayLabel} • ${rec}` : homeAwayLabel;
  }

  function applyRivalryNameOverrides(rawName, teamObj) {
    const name = String(rawName || "").trim();
    const lower = name.toLowerCase();
    const id = String(teamObj?.id || "");
    const displayLower = String(teamObj?.displayName || "").toLowerCase();

    // TTUN (Michigan Wolverines only)
    if (
      id === "130" ||
      lower.includes("michigan wolverines") ||
      displayLower.includes("michigan wolverines")
    ) return "The Team Up North";

    // UNC (Tar Heels only)
    const abbrev = String(teamObj?.abbreviation || "").toLowerCase();
    if (
      id === "153" ||
      abbrev === "unc" ||
      lower.includes("north carolina tar heels") ||
      displayLower.includes("north carolina tar heels")
    ) return "Paper Classes U";

    return name;
  }

  function getTeamDisplayNameUI(team) {
    if (!team) return "";
    const full = String(team.displayName || "").toLowerCase();
    const short = String(team.name || "").toLowerCase();
    const abbrev = String(team.abbreviation || "").toLowerCase();
    const id = String(team.id || "");

    if (
      full.includes("michigan wolverines") ||
      (short === "wolverines" && full.includes("michigan")) ||
      id === "130"
    ) return "The Team Up North";

    if (
      full.includes("north carolina tar heels") ||
      (short === "tar heels" && full.includes("north carolina")) ||
      abbrev === "unc" ||
      id === "153"
    ) return "Paper Classes U";

    return team.displayName || "";
  }

  function getTeamAbbrevUI(team) {
    if (!team) return "";
    const full = String(team.displayName || "").toLowerCase();
    const abbrev = String(team.abbreviation || "").toLowerCase();
    const id = String(team.id || "");

    if (full.includes("michigan wolverines") || id === "130") return "TTUN";
    if (full.includes("north carolina tar heels") || abbrev === "unc" || id === "153") return "PCU";
    return team.abbreviation || "";
  }

  function teamDisplayNameWithRank(rawName, competitor, selectedKey) {
    const teamObj = competitor?.team || null;
    const baseName = applyRivalryNameOverrides(rawName, teamObj);

    const isCollege =
      selectedKey === "ncaam" ||
      selectedKey === "ncaaf" ||
      selectedKey === "collegefb" ||
      selectedKey === "collegebb" ||
      selectedKey === "cfb";

    if (!isCollege) return baseName;

    const rank =
      competitor?.curatedRank?.current ||
      competitor?.rank?.current ||
      competitor?.rank ||
      teamObj?.rank?.current ||
      teamObj?.rank ||
      "";

    const r = parseInt(rank, 10);
    if (Number.isFinite(r) && r > 0 && r <= 25) return `#${r} ${baseName}`;
    return baseName;
  }

  // ---------- Favorites sorting ----------
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

  // ---------- Venue ----------
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

  // ---------- Odds parsing + hydration (same behavior) ----------
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

  function getSafeTeamNameForOdds(team, fallback) {
    try {
      if (typeof getTeamDisplayNameUI === "function") return getTeamDisplayNameUI(team);
    } catch {}
    return team?.displayName || team?.shortDisplayName || team?.name || fallback || "Team";
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

    const o2 = firstOddsFromCompetition(sc0);
    if (o2 && (o2.details || o2.overUnder !== undefined || o2.total !== undefined)) {
      return {
        favored: cleanFavoredText(o2.details || o2.displayValue || ""),
        ou: normalizeNumberString(o2.overUnder ?? o2.total ?? "")
      };
    }

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
    if (!hasFav && !hasOu) return "";
    if (hasFav && hasOu) return `Favored: ${favored} • O/U: ${ou}`;
    if (hasFav) return `Favored: ${favored}`;
    if (hasOu) return `O/U: ${ou}`;
    return "";
  }

  // Odds cache + concurrency (same as big script, but scoped)
  const ODDS_CONCURRENCY_LIMIT = 6;
  const ODDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const ODDS_STORAGE_PREFIX = "theShopOddsCache_v1";
  const oddsCache = new Map();
  const oddsInFlight = new Map();
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
    } catch {}
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
      } catch {}
    }, 400);
  }

  function getOddsLineElByEventId(eventId) {
    const card = document.querySelector(`.game[data-eventid="${CSS.escape(String(eventId))}"]`);
    if (!card) return null;
    return card.querySelector(".gameMetaOddsLine") || card.querySelector(".gameMetaOddsPlain");
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
        } catch {}
      }

      const empty = { favored: "", ou: "" };
      oddsCache.set(ck, { favored: "", ou: "", ts: Date.now() });
      saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD);
      return empty;
    })();

    oddsInFlight.set(ck, p);
    try { return await p; }
    finally { oddsInFlight.delete(ck); }
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

    const jobs = (events || [])
      .map(e => ({ eventId: String(e?.id || ""), competition: e?.competitions?.[0] || null }))
      .filter(j => j.eventId);

    // Apply cached + scoreboard odds first
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

  // ---------- AI Insight (local compute + cache) ----------
  const AI_CACHE_TTL_MS = 30 * 60 * 1000;
  const AI_SESSION_KEY = "theShopAiInsightCache_v1";
  let aiInsightCache = {};

  (function loadAiCache(){
    try {
      const raw = sessionStorage.getItem(AI_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") aiInsightCache = parsed;
    } catch {}
  })();

  function saveAiCache(){
    try { sessionStorage.setItem(AI_SESSION_KEY, JSON.stringify(aiInsightCache)); } catch {}
  }
  function isAiCacheFresh(entry){
    if (!entry) return false;
    const ts = Number(entry.ts || 0);
    if (!Number.isFinite(ts)) return false;
    return (Date.now() - ts) <= AI_CACHE_TTL_MS;
  }

  function generateAIInsight({ favoredText, ouText, state }) {
    let confidence = 5;
    let edge = "Stay Away";
    let lean = "";

    if (state === "in") confidence += 0.5;

    if (favoredText && favoredText.includes("-")) {
      const parts = favoredText.split("-");
      const team = parts[0].trim();
      const spread = parseFloat(parts[1]);
      if (!isNaN(spread)) {
        confidence += spread < 4 ? 1.2 : 0.4;
        edge = `${team} -${spread}`;
      }
    }

    if (ouText) {
      const total = parseFloat(ouText);
      if (!isNaN(total)) {
        confidence += total > 145 ? 0.5 : 0.2;
        lean = total > 145 ? `Over ${total}` : `Under ${total}`;
      }
    }

    confidence = Math.max(1, Math.min(10, confidence));
    return { edge, lean, confidence: confidence.toFixed(1) };
  }

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

    const g = generateAIInsight({
      favoredText: payload.spread || "",
      ouText: payload.total || "",
      state: "pre"
    });

    const stored = { edge: g.edge, lean: g.lean, confidence: g.confidence, ts: Date.now() };
    aiInsightCache[key] = stored;
    saveAiCache();
    return stored;
  }

  // ---------- ESPN fetch with fallbacks (same as big script) ----------
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
      return formatDateYYYYMMDD(d);
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

    // Normalized-day mode (today/yesterday/tomorrow combined, then filtered)
    try {
      const urlToday = addOrReplaceParam(baseUrl, "limit", "1000");
      const urlY = addOrReplaceParam(league.endpoint(yDate), "limit", "1000");
      const urlT = addOrReplaceParam(league.endpoint(tDate), "limit", "1000");

      const results = await Promise.allSettled([
        fetchEvents(urlToday),
        fetchEvents(urlY),
        fetchEvents(urlT),
      ]);

      const firstFulfilled = results.find(r => r.status === "fulfilled");
      const baseData = firstFulfilled && firstFulfilled.status === "fulfilled"
        ? firstFulfilled.value.data
        : { events: [] };

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
        return {
          data: { ...(baseData || {}), events: filtered },
          events: filtered,
          used: "normalized-day",
          url: urlToday
        };
      }
    } catch {}

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
        if (!resp.ok) { lastError = new Error(`HTTP ${resp.status}`); continue; }

        const data = await resp.json();
        const events = Array.isArray(data?.events) ? data.events : [];
        if (events.length === 0) continue;

        if (!firstNonEmpty) firstNonEmpty = { data, events, used: a.label, url: a.url };

        if (isNcaam && hasAnyScheduledPreGames(events)) return { data, events, used: a.label, url: a.url };
        if (!isNcaam) return { data, events, used: a.label, url: a.url };

      } catch (e) {
        lastError = e;
      }
    }

    if (firstNonEmpty) return firstNonEmpty;
    return { data: { events: [] }, events: [], used: "none", url: "", error: lastError };
  }

  // ---------- UI helpers ----------
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

  // ---------- PGA view (kept simple; if you split PGA elsewhere, you can remove) ----------
  function renderGolfPlaceholder(events, content) {
    content.innerHTML += `<div class="notice">PGA view is handled in your main script (or add it here if needed).</div>`;
  }

  // ---------- The actual Scores loader (THIS is what your router calls) ----------
  async function loadScores(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;

    const selectedDate = getSavedDateYYYYMMDD();
    const prettyDate = yyyymmddToPretty(selectedDate);

    const updatedTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
      let events = result.events || [];

      content.innerHTML = headerHTML(`${escapeHtml(prettyDate)} • Updated ${updatedTime}`);

      if (!events.length) {
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
        renderGolfPlaceholder(events, content);
        return;
      }

      // Favorites-first sort (still shows ALL games)
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

      for (const event of events) {
        const competition = event?.competitions?.[0];
        if (!competition) continue;

        const competitorsArr = Array.isArray(competition.competitors) ? competition.competitors : [];
        const home = competitorsArr.find(t => t.homeAway === "home");
        const away = competitorsArr.find(t => t.homeAway === "away");
        if (!home || !away) continue;

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

        if (state === "in") card.classList.add("statusLive");
        else if (state === "pre") card.classList.add("statusPre");
        else if (state === "post") card.classList.add("statusFinal");
        if (!initialOdds?.favored && !initialOdds?.ou) card.classList.add("edgeNone");

        if (eventId) card.setAttribute("data-eventid", eventId);

        const shouldShowAI = (state === "pre") && !!initialOddsText && !!eventId;

        card.innerHTML = `
          <div class="gameHeader">
            <div class="statusPill ${pillClass}">${escapeHtml(pillText)}</div>
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
      }

      content.appendChild(grid);

      // Odds hydration (updates cards in place)
      hydrateAllOdds(events, league, selectedKey, selectedDate);

      // AI hydration (small concurrency)
      const limit = 4;
      let idx = 0;

      async function runNext() {
        while (idx < aiJobs.length) {
          const job = aiJobs[idx++];

          const line1 = document.querySelector(`[data-ai-line1="${CSS.escape(String(job.eventId))}"]`);
          const line2 = document.querySelector(`[data-ai-line2="${CSS.escape(String(job.eventId))}"]`);

          if (line1) line1.textContent = job.spread ? "AI EDGE: Analyzing…" : "AI EDGE: Waiting for line…";
          if (line2) line2.textContent = "Confidence: —/10";

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

  // ---------- Exports ----------
  window.loadScores = loadScores;

})();