/* =========================
   SCORES DATA
   Constants, helpers, conference, odds, fetch logic.
   Exposes window.__SD for scores-render.js
   ========================= */

(function ScoresDataModule () {
  // ---------- Storage keys ----------
  const LEAGUE_KEY = "theShopLeague_v1";
  const DATE_KEY   = "theShopDate_v1";
  const CONF_FILTER_KEY_PREFIX = "theShopConfFilter_v1_";

  // ---------- Favorites ----------
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
    "Cleveland Guardians",
  ];

  const LEAGUE_COLORS = {
    cfb:   "#bb0000",
    nfl:   "#013369",
    nba:   "#c9082a",
    mlb:   "#002d72",
    nhl:   "#000000",
    ncaam: "#005fad",
    mls:   "#009a44",
    pga:   "#3d7a40",
    ufc:   "#c8102e",
  };

  const LEAGUES = [
    { key: "ncaam", name: "Men's College Basketball",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=50&limit=200`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${eventId}` },
    { key: "cfb", name: "College Football",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${eventId}` },
    { key: "nba", name: "NBA",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}` },
    { key: "nhl", name: "NHL",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${eventId}` },
    { key: "mls", name: "MLS (Soccer)",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/summary?event=${eventId}` },
    { key: "nfl", name: "NFL",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}` },
    { key: "mlb", name: "MLB",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${eventId}` },
    { key: "pga", name: "Golf (PGA)",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/summary?event=${eventId}` },
    { key: "ufc", name: "UFC",
      endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) => `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/summary?event=${eventId}` },
  ];

  const PLAYOFF_LEAGUES = new Set(["nhl", "nba", "nfl", "mlb"]);

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

  function norm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
  const FAVORITES_NORM = FAVORITES.map(norm);

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function getLeagueByKey(key) { return LEAGUES.find(l => l.key === key) || LEAGUES[0]; }

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
    return `<select id="leagueSelect" class="leagueSelect" aria-label="Select league">${opts}</select>`;
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
        <input id="nativeDateInput" class="nativeDateInput" type="date"
          value="${escapeHtml(current)}"
          aria-label="Choose date"
          onchange="handleNativeDateChangeFromEl(this)"
          oninput="handleNativeDateChangeFromEl(this)"
        />
      </span>
    `;
  }

  // ---------- Conference filter ----------
  function isCollegeLeagueKey(k) {
    const key = String(k || "").toLowerCase();
    return key === "ncaam" || key === "cfb";
  }

  const CONF_CACHE_PREFIX = "theShopConfCache_v1_";
  const CONF_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

  function confStorageKeyForLeague(leagueKey) {
    return `${CONF_FILTER_KEY_PREFIX}${String(leagueKey || "").trim()}`;
  }
  function getSavedConferenceFilter(leagueKey) {
    try { return String(localStorage.getItem(confStorageKeyForLeague(leagueKey)) || "").trim(); }
    catch { return ""; }
  }
  function saveConferenceFilter(leagueKey, confName) {
    try { localStorage.setItem(confStorageKeyForLeague(leagueKey), String(confName || "").trim()); } catch {}
  }

  function getConferenceNameFromTeam(team) {
    if (!team) return "";
    const conf = team?.conference?.shortName || team?.conference?.name || team?.conference?.abbreviation || "";
    return String(conf || "").trim();
  }
  function getConferenceNameFromCompetitor(competitor) {
    return getConferenceNameFromTeam(competitor?.team || null);
  }

  function confCacheKey(leagueKey, dateYYYYMMDD) {
    return `${CONF_CACHE_PREFIX}${String(leagueKey || "")}_${String(dateYYYYMMDD || "")}`;
  }
  function loadConfCache(leagueKey, dateYYYYMMDD) {
    try {
      const raw = sessionStorage.getItem(confCacheKey(leagueKey, dateYYYYMMDD));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const ts = Number(parsed.ts || 0);
      if (!Number.isFinite(ts) || (Date.now() - ts) > CONF_CACHE_TTL_MS) return null;
      return parsed;
    } catch { return null; }
  }
  function saveConfCache(leagueKey, dateYYYYMMDD, teamIdToConf) {
    try {
      sessionStorage.setItem(confCacheKey(leagueKey, dateYYYYMMDD),
        JSON.stringify({ ts: Date.now(), teamIdToConf: teamIdToConf || {} }));
    } catch {}
  }
  function buildConferenceListFromMap(teamIdToConf) {
    const set = new Set();
    for (const conf of Object.values(teamIdToConf || {})) {
      const c = String(conf || "").trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }
  function buildConferenceListFromEvents(events) {
    const set = new Set();
    for (const ev of (events || [])) {
      const comp = ev?.competitions?.[0];
      for (const c of (comp?.competitors || [])) {
        const conf = getConferenceNameFromCompetitor(c);
        if (conf) set.add(conf);
      }
    }
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b)));
  }
  function buildConferenceSelectHTML(confs, selected, isLoading) {
    const list = Array.isArray(confs) ? confs : [];
    const sel = String(selected || "").trim();
    const opts = [
      `<option value="">All Conferences</option>`,
      ...(isLoading ? [`<option disabled>Loading…</option>`] : []),
      ...list.map(c => {
        const v = String(c || "").trim();
        const s = (v && v === sel) ? "selected" : "";
        return `<option value="${escapeHtml(v)}" ${s}>${escapeHtml(v)}</option>`;
      })
    ].join("");
    return `<select id="confSelect" class="confSelect" aria-label="Filter by conference">${opts}</select>`;
  }
  async function fetchConferenceMapFromSummary(league, eventId) {
    if (!league?.summaryEndpoint || !eventId) return {};
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
        const comp = data?.header?.competitions?.[0];
        const map = {};
        for (const c of (comp?.competitors || [])) {
          const team = c?.team;
          const teamId = String(team?.id || "");
          if (!teamId) continue;
          const conf = getConferenceNameFromTeam(team);
          if (conf) map[teamId] = conf;
        }
        if (Object.keys(map).length) return map;
      } catch {}
    }
    return {};
  }
  function updateConferenceSelectOptions(confs, selectedKey) {
    const selEl = document.getElementById("confSelect");
    if (!selEl) return;
    const saved = getSavedConferenceFilter(selectedKey);
    const current = String(saved || "").trim();
    const opts = [
      { value: "", label: "All Conferences" },
      ...confs.map(c => ({ value: c, label: c }))
    ];
    selEl.innerHTML = opts.map(o => {
      const s = (o.value && o.value === current) ? "selected" : "";
      return `<option value="${escapeHtml(o.value)}" ${s}>${escapeHtml(o.label)}</option>`;
    }).join("");
  }
  function applyConferenceMetaToDom(eventId, side, confText, recordText) {
    const el = document.querySelector(
      `[data-teammeta="${CSS.escape(String(eventId))}_${CSS.escape(String(side))}"]`
    );
    if (!el) return;
    const parts = [];
    const c = String(confText || "").trim();
    const r = String(recordText || "").trim();
    if (c) parts.push(c);
    parts.push(side === "home" ? "Home" : "Away");
    if (r) parts.push(r);
    const next = parts.join(" • ");
    if (el.textContent !== next) el.textContent = next;
  }
  function filterEventsByConferenceUsingMap(events, confNorm, teamIdToConf) {
    if (!confNorm) return events;
    const map = teamIdToConf || {};
    return (events || []).filter(ev => {
      const comp = ev?.competitions?.[0];
      return (comp?.competitors || []).some(c => {
        const teamId = String(c?.team?.id || "");
        const conf = String(map[teamId] || getConferenceNameFromCompetitor(c) || "").trim();
        return norm(conf) === confNorm;
      });
    });
  }

  // ---------- Team / rank / record helpers ----------
  function getTeamLogoUrl(team) {
    const logos = team?.logos || [];
    if (logos.length) {
      const small = logos.find(l => (l.width || 999) <= 40) || logos[0];
      return String(small?.href || "");
    }
    return String(team?.logo || "");
  }
  function getOverallRecordFromCompetitor(competitor) {
    const stats = competitor?.statistics || [];
    const overall = stats.find(s =>
      String(s?.name || "").toLowerCase() === "overall" ||
      String(s?.abbreviation || "").toLowerCase() === "overall"
    );
    return String(overall?.displayValue || "").trim();
  }
  function metaLineWithConference(side, conf, record) {
    const parts = [];
    const c = String(conf || "").trim();
    const r = String(record || "").trim();
    if (c) parts.push(c);
    parts.push(side === "home" ? "Home" : "Away");
    if (r) parts.push(r);
    return parts.join(" • ");
  }
  function applyRivalryNameOverrides(name) {
    return String(name || "").replace(/\bMichigan\b/g, "TTUN");
  }
  function getTeamDisplayNameUI(team) {
    const raw = String(
      team?.shortDisplayName || team?.displayName || team?.name || team?.abbreviation || ""
    ).trim();
    return applyRivalryNameOverrides(raw);
  }
  function getTeamAbbrevUI(team) {
    return applyRivalryNameOverrides(String(team?.abbreviation || "").trim());
  }
  function teamDisplayNameWithRank(rank, name) {
    const r = Number(rank);
    if (r && r >= 1 && r <= 25) return `#${r} ${name}`;
    return name;
  }
  function getTeamIdentityStrings(team) {
    return [
      team?.displayName, team?.shortDisplayName, team?.name,
      team?.nickname, team?.abbreviation, team?.location
    ].filter(Boolean).map(s => norm(String(s)));
  }
  function isFavoriteTeam(team) {
    if (!team) return false;
    const identities = getTeamIdentityStrings(team);
    return identities.some(id => FAVORITES_NORM.some(f => id.includes(f) || f.includes(id)));
  }
  function favoriteRankForEvent(event) {
    const comp = event?.competitions?.[0];
    const competitors = comp?.competitors || [];
    let bestRank = Infinity;
    for (const c of competitors) {
      if (isFavoriteTeam(c?.team)) {
        const idx = FAVORITES_NORM.findIndex(f => {
          const identities = getTeamIdentityStrings(c?.team);
          return identities.some(id => id.includes(f) || f.includes(id));
        });
        if (idx !== -1 && idx < bestRank) bestRank = idx;
      }
    }
    return bestRank;
  }
  function stateRank(status) {
    const t = String(status?.type?.state || "").toLowerCase();
    if (t === "in") return 0;
    if (t === "post") return 1;
    if (t === "pre") return 2;
    return 3;
  }
  function getStartTimeMs(event) {
    const d = event?.competitions?.[0]?.date || event?.date || "";
    if (!d) return Infinity;
    const ms = Date.parse(d);
    return Number.isFinite(ms) ? ms : Infinity;
  }

  // ---------- Venue ----------
  function getVenuePartsFromVenueObj(venue) {
    if (!venue) return null;
    const name = String(venue?.fullName || venue?.name || "").trim();
    const city = String(venue?.address?.city || "").trim();
    const state = String(venue?.address?.state || "").trim();
    const loc = [city, state].filter(Boolean).join(", ");
    return { name, loc };
  }
  function buildVenueLine(competition) {
    const venue = competition?.venue;
    const parts = getVenuePartsFromVenueObj(venue);
    if (!parts) return "";
    const pieces = [parts.name, parts.loc].filter(Boolean);
    return pieces.length ? escapeHtml(pieces.join(" — ")) : "";
  }

  // ---------- Odds ----------
  const ODDS_STORAGE_PREFIX = "theShopOdds_v1_";
  const ODDS_CACHE_TTL_MS = 90 * 60 * 1000;
  const ODDS_CONCURRENCY_LIMIT = 4;

  const oddsCache = new Map();
  const oddsInFlight = new Map();
  let oddsCacheSaveTimer = null;

  function oddsCacheKey(leagueKey, dateYYYYMMDD) {
    return `${ODDS_STORAGE_PREFIX}${String(leagueKey||"")}_${String(dateYYYYMMDD||"")}`;
  }
  function loadOddsCacheFromSession(leagueKey, dateYYYYMMDD) {
    try {
      const raw = sessionStorage.getItem(oddsCacheKey(leagueKey, dateYYYYMMDD));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const ts = Number(parsed.ts || 0);
      if (!Number.isFinite(ts) || (Date.now() - ts) > ODDS_CACHE_TTL_MS) return;
      const entries = parsed.entries || {};
      for (const [k, v] of Object.entries(entries)) oddsCache.set(k, v);
    } catch {}
  }
  function saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD) {
    if (oddsCacheSaveTimer) return;
    oddsCacheSaveTimer = setTimeout(() => {
      oddsCacheSaveTimer = null;
      try {
        const entries = {};
        for (const [k, v] of oddsCache.entries()) entries[k] = v;
        sessionStorage.setItem(oddsCacheKey(leagueKey, dateYYYYMMDD),
          JSON.stringify({ ts: Date.now(), entries }));
      } catch {}
    }, 1500);
  }
  function getOddsLineElByEventId(eventId) {
    return document.querySelector(`[data-oddsline="${CSS.escape(String(eventId))}"]`);
  }
  function applyOddsToDom(eventId, favored, ou) {
    const el = getOddsLineElByEventId(eventId);
    if (!el) return;
    const line = buildOddsLine(favored, ou);
    if (el.textContent !== line) el.textContent = line;
  }
  function withLangRegion(url) {
    try {
      const u = new URL(url);
      if (!u.searchParams.has("lang")) u.searchParams.set("lang", "en");
      if (!u.searchParams.has("region")) u.searchParams.set("region", "us");
      return u.toString();
    } catch { return url; }
  }
  async function fetchJsonNoStore(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }
  async function runWithConcurrency(items, limit, worker) {
    const queue = [...items];
    const results = [];
    let idx = 0;
    async function next() {
      while (queue.length) {
        const item = queue.shift();
        const i = idx++;
        results[i] = await worker(item);
        await next();
      }
    }
    const workers = Array.from({ length: Math.min(limit, items.length) }, next);
    await Promise.all(workers);
    return results;
  }

  function normalizeNumberString(s) {
    return String(s || "").replace(/[\u2212\u2013]/g, "-").replace(/[^\d.\-+]/g, "").trim();
  }
  function cleanFavoredText(s) {
    return String(s || "").replace(/[\u2212]/g, "-").trim();
  }
  function getSafeTeamNameForOdds(team) {
    return String(team?.shortDisplayName || team?.abbreviation || team?.displayName || "").trim();
  }
  function firstPickcenterFromCompetition(competition) {
    const odds = competition?.odds || [];
    return odds.find(o => String(o?.provider?.name || "").toLowerCase().includes("pickcenter")) || odds[0] || null;
  }
  function parseOddsFromPickcenter(oddsObj, competitors) {
    if (!oddsObj) return { favored: "", ou: "" };
    const spread = String(oddsObj?.details || "").trim();
    const ou = String(oddsObj?.overUnder ?? "").trim();
    const favoredTeamId = String(oddsObj?.homeTeamOdds?.favorite === true
      ? (competitors?.find(c => String(c?.homeAway||"")===("home"))?.team?.id || "")
      : oddsObj?.awayTeamOdds?.favorite === true
        ? (competitors?.find(c => String(c?.homeAway||"")===("away"))?.team?.id || "")
        : "");
    let favoredName = "";
    if (favoredTeamId) {
      const t = competitors?.find(c => String(c?.team?.id||"") === favoredTeamId)?.team;
      favoredName = getSafeTeamNameForOdds(t);
    }
    if (!favoredName && spread) {
      const m = spread.match(/^([A-Za-z0-9 '&.]+?)\s*(-?\d)/);
      if (m) favoredName = m[1].trim();
    }
    const spreadNum = normalizeNumberString(spread.replace(/^[A-Za-z0-9 '&.]+/, ""));
    let favored = "";
    if (favoredName && spreadNum) favored = `${favoredName} ${spreadNum}`;
    else if (spread) favored = cleanFavoredText(spread);
    return { favored, ou: ou ? `O/U ${ou}` : "" };
  }
  function parseOddsFromScoreboardCompetition(competition) {
    const competitors = competition?.competitors || [];
    const oddsObj = firstPickcenterFromCompetition(competition);
    return parseOddsFromPickcenter(oddsObj, competitors);
  }
  function parseOddsFromSummary(summaryData, competitors) {
    const pickcenter = (summaryData?.pickcenter || summaryData?.odds || []);
    const oddsObj = pickcenter.find(o =>
      String(o?.provider?.name||"").toLowerCase().includes("pickcenter")
    ) || pickcenter[0] || null;
    return parseOddsFromPickcenter(oddsObj, competitors || []);
  }
  function buildOddsLine(favored, ou) {
    const parts = [];
    const f = String(favored || "").trim();
    const o = String(ou || "").trim();
    if (f) parts.push(f);
    if (o) parts.push(o);
    return parts.join("  •  ");
  }

  async function fetchOddsFromSummary(league, leagueKey, dateYYYYMMDD, eventId, fallbackCompetition) {
    const cacheKey = `${leagueKey}_${eventId}`;
    if (oddsCache.has(cacheKey)) return oddsCache.get(cacheKey);
    if (oddsInFlight.has(cacheKey)) return oddsInFlight.get(cacheKey);
    const promise = (async () => {
      try {
        const base = league.summaryEndpoint(eventId);
        const urls = [
          withLangRegion(base),
          withLangRegion(base.replace("?event=", "?eventId=")),
          base
        ];
        for (const url of urls) {
          try {
            const data = await fetchJsonNoStore(url);
            const summaryComp = data?.header?.competitions?.[0];
            const competitors = summaryComp?.competitors || fallbackCompetition?.competitors || [];
            const result = parseOddsFromSummary(data, competitors);
            if (result.favored || result.ou) {
              oddsCache.set(cacheKey, result);
              saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD);
              return result;
            }
          } catch {}
        }
        const fallback = parseOddsFromScoreboardCompetition(fallbackCompetition);
        oddsCache.set(cacheKey, fallback);
        saveOddsCacheToSessionThrottled(leagueKey, dateYYYYMMDD);
        return fallback;
      } catch {
        return { favored: "", ou: "" };
      } finally {
        oddsInFlight.delete(cacheKey);
      }
    })();
    oddsInFlight.set(cacheKey, promise);
    return promise;
  }

  async function hydrateAllOdds(league, leagueKey, dateYYYYMMDD, events) {
    const toHydrate = (events || []).filter(ev => {
      const id = String(ev?.id || "");
      if (!id) return false;
      const cacheKey = `${leagueKey}_${id}`;
      return !oddsCache.has(cacheKey);
    });
    if (!toHydrate.length) return;
    await runWithConcurrency(toHydrate, ODDS_CONCURRENCY_LIMIT, async (ev) => {
      const id = String(ev?.id || "");
      const comp = ev?.competitions?.[0];
      const result = await fetchOddsFromSummary(league, leagueKey, dateYYYYMMDD, id, comp);
      applyOddsToDom(id, result.favored, result.ou);
    });
  }

  // ---------- Event listeners ----------
  window.handleNativeDateChangeFromEl = function (el) {
    const v = inputValueToYYYYMMDD(el?.value || "");
    if (!v) return;
    saveDateYYYYMMDD(v);
    const tab = window.__activeTab || "scores";
    if (typeof window.showTab === "function") window.showTab(tab);
    else window.loadScores(true);
  };

  if (!window.__scoresLeagueChangeBound) {
    window.__scoresLeagueChangeBound = true;
    document.addEventListener("change", function (e) {
      if (e.target && e.target.id === "leagueSelect") {
        const v = String(e.target.value || "").trim();
        if (!v) return;
        saveLeagueKey(v);
        const tab = window.__activeTab || "scores";
        if (typeof window.showTab === "function") window.showTab(tab);
        else window.loadScores(true);
      }
      if (e.target && e.target.id === "confSelect") {
        const leagueKey = getSavedLeagueKey();
        saveConferenceFilter(leagueKey, e.target.value || "");
        const tab = window.__activeTab || "scores";
        if (typeof window.showTab === "function") window.showTab(tab);
        else window.loadScores(true);
      }
    });
  }

  // ---------- Expose shared namespace ----------
  window.__SD = {
    LEAGUE_COLORS, LEAGUES, FAVORITES, FAVORITES_NORM, LEAGUE_KEY, DATE_KEY,
    CONF_FILTER_KEY_PREFIX, PLAYOFF_LEAGUES, ODDS_CONCURRENCY_LIMIT,
    norm, escapeHtml,
    getLeagueByKey, getSavedLeagueKey, saveLeagueKey,
    getSavedDateYYYYMMDD, saveDateYYYYMMDD, formatDateYYYYMMDD,
    yyyymmddToPretty, buildLeagueSelectHTML, buildCalendarButtonHTML,
    isCollegeLeagueKey, getSavedConferenceFilter, saveConferenceFilter,
    getConferenceNameFromTeam, getConferenceNameFromCompetitor,
    loadConfCache, saveConfCache, buildConferenceListFromMap,
    buildConferenceListFromEvents, buildConferenceSelectHTML,
    fetchConferenceMapFromSummary, updateConferenceSelectOptions,
    applyConferenceMetaToDom, filterEventsByConferenceUsingMap,
    getTeamLogoUrl, getOverallRecordFromCompetitor, metaLineWithConference,
    applyRivalryNameOverrides, getTeamDisplayNameUI, getTeamAbbrevUI,
    teamDisplayNameWithRank, getTeamIdentityStrings, isFavoriteTeam,
    favoriteRankForEvent, stateRank, getStartTimeMs,
    buildVenueLine,
    buildOddsLine, parseOddsFromScoreboardCompetition, parseOddsFromSummary,
    hydrateAllOdds, runWithConcurrency,
    withLangRegion, fetchJsonNoStore,
    _oddsCache: oddsCache,
    applyOddsToDom,
  };

})();
