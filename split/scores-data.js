/* =========================
   SCORES DATA
   League config, constants, ESPN fetch helpers, odds hydration.
   Exposed on window.__SD for scores-render.js to consume.
   ========================= */

(function ScoresDataModule () {
  "use strict";

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

  // ─── Storage keys ─────────────────────────────────────────────────────────
  const LEAGUE_KEY = "scoresLeague";
  const DATE_KEY   = "scoresDate";

  function getSavedLeagueKey() {
    try { return localStorage.getItem(LEAGUE_KEY) || "nba"; } catch { return "nba"; }
  }
  function setSavedLeagueKey(k) {
    try { localStorage.setItem(LEAGUE_KEY, k); } catch {}
  }
  function getSavedDateYYYYMMDD() {
    try { return localStorage.getItem(DATE_KEY) || todayYYYYMMDD(); } catch { return todayYYYYMMDD(); }
  }
  function setSavedDateYYYYMMDD(d) {
    try { localStorage.setItem(DATE_KEY, d); } catch {}
  }

  // ─── Conference filter storage ─────────────────────────────────────────────
  function confFilterKey(leagueKey) { return `scoresConf_${leagueKey}`; }
  function getSavedConferenceFilter(leagueKey) {
    try { return localStorage.getItem(confFilterKey(leagueKey)) || ""; } catch { return ""; }
  }
  function setSavedConferenceFilter(leagueKey, conf) {
    try { localStorage.setItem(confFilterKey(leagueKey), conf || ""); } catch {}
  }

  // ─── Conference cache ──────────────────────────────────────────────────────
  function confCacheKey(leagueKey, date) { return `scoresConfCache_${leagueKey}_${date}`; }
  function loadConfCache(leagueKey, date) {
    try {
      const raw = localStorage.getItem(confCacheKey(leagueKey, date));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  function saveConfCache(leagueKey, date, teamIdToConf) {
    try { localStorage.setItem(confCacheKey(leagueKey, date), JSON.stringify({ teamIdToConf, ts: Date.now() })); } catch {}
  }

  // ─── Date helpers ──────────────────────────────────────────────────────────
  function todayYYYYMMDD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }
  function yyyymmddToPretty(s) {
    if (!s || s.length !== 8) return s;
    try {
      const y = parseInt(s.slice(0,4), 10);
      const m = parseInt(s.slice(4,6), 10) - 1;
      const d = parseInt(s.slice(6,8), 10);
      return new Date(y, m, d).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    } catch { return s; }
  }
  function yyyymmddOffset(s, delta) {
    if (!s || s.length !== 8) return s;
    try {
      const y = parseInt(s.slice(0,4), 10);
      const m = parseInt(s.slice(4,6), 10) - 1;
      const d = parseInt(s.slice(6,8), 10);
      const dt = new Date(y, m, d);
      dt.setDate(dt.getDate() + delta);
      const ny = dt.getFullYear();
      const nm = String(dt.getMonth() + 1).padStart(2, "0");
      const nd = String(dt.getDate()).padStart(2, "0");
      return `${ny}${nm}${nd}`;
    } catch { return s; }
  }

  function withLangRegion(url) {
    if (!url) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}lang=en&region=us`;
  }

  // ─── Fetch helpers ────────────────────────────────────────────────────────
  async function fetchJsonNoStore(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  // ─── League lookup ─────────────────────────────────────────────────────────
  function getLeagueByKey(key) {
    return LEAGUES.find(l => l.key === key) || LEAGUES[0];
  }

  // ─── Team helpers ──────────────────────────────────────────────────────────
  function getTeamDisplayNameUI(team) {
    return String(team?.displayName || team?.shortDisplayName || team?.name || team?.abbreviation || "TBD");
  }
  function getTeamAbbrevUI(team) {
    return String(team?.abbreviation || team?.shortDisplayName || "?");
  }
  function getTeamLogoUrl(team) {
    const logos = team?.logos || [];
    if (logos.length) {
      const dark = logos.find(l => Array.isArray(l?.rel) && l.rel.includes("dark"));
      return String((dark || logos[0])?.href || "");
    }
    return String(team?.logo || "");
  }
  function teamDisplayNameWithRank(rank, name) {
    if (rank > 0 && rank <= 25) return `#${rank} ${name}`;
    return name;
  }
  function getTeamIdentityStrings(team) {
    return [
      team?.displayName, team?.shortDisplayName, team?.name,
      team?.nickname, team?.abbreviation, team?.location
    ].filter(Boolean).map(s => norm(String(s)));
  }

  // ─── Favorite team matching — EXACT match only ────────────────────────────
  function isFavoriteTeam(team) {
    if (!team) return false;
    const identities = getTeamIdentityStrings(team);
    return identities.some(id => FAVORITES_NORM.some(f => id === f));
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
  function getStartTimeMs(ev) {
    try { return new Date(ev?.date || ev?.competitions?.[0]?.date || 0).getTime(); } catch { return 0; }
  }

  // ─── Record / Conference helpers ───────────────────────────────────────────
  function getOverallRecordFromCompetitor(competitor) {
    const records = competitor?.records || [];
    const overall = records.find(r => String(r?.type||r?.name||"").toLowerCase().includes("overall") || String(r?.type||"").toLowerCase() === "total");
    if (overall) return String(overall.summary || "");
    if (records.length) return String(records[0].summary || "");
    return "";
  }
  function getConferenceNameFromCompetitor(competitor) {
    const groups = competitor?.team?.groups || competitor?.groups || null;
    if (groups) return String(groups?.name || groups?.shortName || "");
    const stats = competitor?.statistics || [];
    for (const s of stats) {
      if (String(s?.name||"").toLowerCase().includes("conf")) return String(s?.displayValue || s?.value || "");
    }
    return "";
  }
  function metaLineWithConference(side, conf, record) {
    const parts = [];
    if (conf) parts.push(conf);
    if (record) parts.push(record);
    return parts.join(" · ");
  }
  function isCollegeLeagueKey(key) { return key === "ncaam" || key === "cfb"; }

  // ─── Venue ─────────────────────────────────────────────────────────────────
  function buildVenueLine(comp) {
    const venue = comp?.venue;
    if (!venue) return "";
    const name = String(venue?.fullName || venue?.name || "").trim();
    const city = String(venue?.address?.city || "").trim();
    const state = String(venue?.address?.state || "").trim();
    const parts = [name, [city, state].filter(Boolean).join(", ")].filter(Boolean);
    return parts.join(" — ");
  }

  // ─── Conference hydration helpers ──────────────────────────────────────────
  async function fetchConferenceMapFromSummary(league, eventId) {
    try {
      const url = withLangRegion(league.summaryEndpoint(eventId));
      const data = await fetchJsonNoStore(url);
      const map = {};
      const boxscore = data?.boxscore || {};
      const teams = boxscore?.teams || data?.header?.competitions?.[0]?.competitors || [];
      for (const t of teams) {
        const team = t?.team || t;
        const id = String(team?.id || "");
        const conf = String(team?.conferenceId || team?.conference?.name || team?.conference?.shortName || team?.groups?.name || "");
        if (id && conf) map[id] = conf;
      }
      return map;
    } catch { return {}; }
  }
  function buildConferenceListFromMap(teamIdToConf) {
    const seen = new Set();
    const out = [];
    for (const conf of Object.values(teamIdToConf)) {
      if (conf && !seen.has(conf)) { seen.add(conf); out.push(conf); }
    }
    return out.sort();
  }
  function updateConferenceSelectOptions(confs, leagueKey) {
    const sel = document.getElementById("confFilter");
    if (!sel) return;
    const current = getSavedConferenceFilter(leagueKey);
    const opts = [`<option value="">All Conferences</option>`, ...confs.map(c => `<option value="${escapeHtml(c)}"${norm(c)===norm(current)?' selected':''}>${escapeHtml(c)}</option>`)];
    sel.innerHTML = opts.join("");
  }
  function applyConferenceMetaToDom(eventId, side, conf, record) {
    const el = document.querySelector(`[data-teammeta="${CSS.escape(eventId)}_${side}"]`);
    if (!el) return;
    el.textContent = metaLineWithConference(side, conf, record);
  }
  function filterEventsByConferenceUsingMap(events, confFilterNorm, teamIdToConf) {
    if (!confFilterNorm) return events;
    return (events || []).filter(ev => {
      const competitors = ev?.competitions?.[0]?.competitors || [];
      return competitors.some(c => {
        const id = String(c?.team?.id || "");
        const conf = norm(teamIdToConf[id] || getConferenceNameFromCompetitor(c) || "");
        return conf === confFilterNorm || conf.includes(confFilterNorm) || confFilterNorm.includes(conf);
      });
    });
  }

  // ─── Odds hydration ────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function applyOddsToDom(eventId, favored, ou) {
    const el = document.querySelector(`[data-oddsline="${CSS.escape(eventId)}"]`);
    if (!el) return;
    const line = buildOddsLine(favored, ou);
    el.textContent = line;
  }

  function buildOddsLine(favored, ou) {
    const f = String(favored || "").trim();
    const o = String(ou || "").trim();
    if (f && o) return `${f}  ·  ${o}`;
    if (f) return f;
    if (o) return o;
    return "";
  }

  function getSafeTeamNameForOdds(team) {
    if (!team) return "";
    return String(team.abbreviation || team.shortDisplayName || team.displayName || "").trim();
  }

  function cleanFavoredText(raw) {
    if (!raw) return "";
    return String(raw).replace(/\s+/g, " ").trim().slice(0, 30);
  }

  function extractOddsFromSummary(data, competitors) {
    try {
      const pickcenter = data?.pickcenter || data?.odds || [];
      const oddsArr = Array.isArray(pickcenter) ? pickcenter : [pickcenter];
      const oddsObj = oddsArr.find(o => o?.provider?.name || o?.spread !== undefined) || oddsArr[0];
      if (!oddsObj) return { favored: "", ou: "" };

      const spread = String(oddsObj?.spread ?? oddsObj?.details ?? "").trim();
      const ou = String(oddsObj?.overUnder ?? oddsObj?.total ?? "").trim();
      const spreadNum = String(oddsObj?.spreadDisplay ?? spread ?? "").trim();

      const favoredTeamId = String(oddsObj?.homeTeamOdds?.favorite === true
        ? (competitors?.find(c => String(c?.homeAway||"") === "home")?.team?.id || "")
        : oddsObj?.awayTeamOdds?.favorite === true
        ? (competitors?.find(c => String(c?.homeAway||"") === "away")?.team?.id || "")
        : "");

      let favoredName = "";
      if (favoredTeamId) {
        const t = competitors?.find(c => String(c?.team?.id||"") === favoredTeamId)?.team;
        favoredName = getSafeTeamNameForOdds(t);
      }
      if (!favoredName && spread) {
        const m = spread.match(/^([A-Za-z0-9 ]+?)\s*[-+]\d/);
        if (m) favoredName = m[1].trim();
      }

      let favored = "";
      if (favoredName && spreadNum) favored = `${favoredName} ${spreadNum}`;
      else if (spread) favored = cleanFavoredText(spread);
      return { favored, ou: ou ? `O/U ${ou}` : "" };
    } catch { return { favored: "", ou: "" }; }
  }

  async function hydrateAllOdds(league, leagueKey, dateYYYYMMDD, events) {
    if (!events || !events.length) return;
    const limit = Math.min(events.length, 12);
    const batch = events.slice(0, limit);
    await Promise.all(batch.map(async (ev) => {
      const id = String(ev?.id || "");
      if (!id) return;
      try {
        const url = withLangRegion(league.summaryEndpoint(id));
        const data = await fetchJsonNoStore(url);
        const competitors = ev?.competitions?.[0]?.competitors || [];
        let result = extractOddsFromSummary(data, competitors);
        if (!result.favored && !result.ou) {
          const pickcenter2 = data?.header?.competitions?.[0]?.odds || [];
          if (pickcenter2.length) {
            const o = pickcenter2[0];
            result = {
              favored: cleanFavoredText(o?.details || ""),
              ou: o?.overUnder ? `O/U ${o.overUnder}` : ""
            };
          }
        }
        if (result.favored || result.ou) {
          applyOddsToDom(id, result.favored, result.ou);
        }
      } catch {}
    }));
  }

  // ─── Conference select HTML ────────────────────────────────────────────────
  function buildConferenceSelectHTML(confs, savedConf, includeAll) {
    const opts = [];
    if (includeAll) opts.push(`<option value="">All Conferences</option>`);
    for (const c of confs) {
      const sel = norm(c) === norm(savedConf) ? " selected" : "";
      opts.push(`<option value="${escapeHtml(c)}"${sel}>${escapeHtml(c)}</option>`);
    }
    return `<select id="confFilter" class="confFilterSelect">${opts.join("")}</select>`;
  }

  // ─── League select / calendar HTML ────────────────────────────────────────
  function buildLeagueSelectHTML(activeKey) {
    return LEAGUES.map(l => {
      const active = l.key === activeKey ? " active" : "";
      return `<div class="scoresLeaguePill${active}" data-leaguekey="${escapeHtml(l.key)}">${escapeHtml(l.name)}</div>`;
    }).join("");
  }
  function buildCalendarButtonHTML() {
    return `<button class="scoresCalBtn" id="scoresCalBtn" aria-label="Pick date">📅</button>`;
  }

  // ─── Expose public API ─────────────────────────────────────────────────────
  window.__SD = {
    LEAGUE_COLORS, LEAGUES, FAVORITES, FAVORITES_NORM, LEAGUE_KEY, DATE_KEY,
    PLAYOFF_LEAGUES,
    getSavedLeagueKey, setSavedLeagueKey,
    getSavedDateYYYYMMDD, setSavedDateYYYYMMDD,
    getSavedConferenceFilter, setSavedConferenceFilter,
    loadConfCache, saveConfCache,
    todayYYYYMMDD, yyyymmddToPretty, yyyymmddOffset, withLangRegion,
    fetchJsonNoStore, getLeagueByKey,
    getTeamDisplayNameUI, getTeamAbbrevUI, getTeamLogoUrl,
    teamDisplayNameWithRank, getTeamIdentityStrings, isFavoriteTeam,
    favoriteRankForEvent, stateRank, getStartTimeMs,
    getOverallRecordFromCompetitor, getConferenceNameFromCompetitor,
    metaLineWithConference, isCollegeLeagueKey,
    buildVenueLine,
    fetchConferenceMapFromSummary, buildConferenceListFromMap,
    updateConferenceSelectOptions, applyConferenceMetaToDom,
    filterEventsByConferenceUsingMap,
    escapeHtml, applyOddsToDom, buildOddsLine, hydrateAllOdds,
    buildConferenceSelectHTML, buildLeagueSelectHTML, buildCalendarButtonHTML,
    norm,
  };

})();
