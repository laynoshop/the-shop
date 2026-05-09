/* =========================
   SCORES TAB (Gold Standard)
   - ESPN scoreboard fetch w/ fallbacks
   - Favorites-first sorting (shows ALL games)
   - Odds parse + background hydration via Summary
   - AI EDGE (local compute + cache, no flicker)
   - Header matches big script look
   - ✅ NEW: CFB + MCBB conference label + conference filter
   - ✅ NEW: Sexy pi.js-inspired card tiles (phone-optimized)
   ========================= */

(function ScoresTabModule () {
  // ---------- Storage keys ----------
  const LEAGUE_KEY = "theShopLeague_v1";
  const DATE_KEY   = "theShopDate_v1"; // YYYYMMDD
  const CONF_FILTER_KEY_PREFIX = "theShopConfFilter_v1_"; // per-league key

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
    "Cleveland Guardians",
  ];

  // ---------- League accent colors (mirrors pi.js LEAGUE_COLORS) ----------
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

  // ---------- Leagues (dropdown) ----------
  const LEAGUES = [
    {
      key: "ncaam",
      name: "Men's College Basketball",
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
    },
    {
      key: "ufc",
      name: "UFC",
      endpoint: (date) =>
        `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${date}`,
      summaryEndpoint: (eventId) =>
        `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/summary?event=${eventId}`
    }
  ];

  // Leagues that support playoff series tracking
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

  // ---------- NEW: Conference filter (CFB + NCAAM only) ----------
  function isCollegeLeagueKey(k) {
    const key = String(k || "").toLowerCase();
    return key === "ncaam" || key === "cfb";
  }

  const CONF_CACHE_PREFIX = "theShopConfCache_v1_";       // per-league+date cache
  const CONF_CACHE_TTL_MS = 12 * 60 * 60 * 1000;          // 12 hours

  function confStorageKeyForLeague(leagueKey) {
    return `${CONF_FILTER_KEY_PREFIX}${String(leagueKey || "").trim()}`;
  }
  function getSavedConferenceFilter(leagueKey) {
    try {
      return String(localStorage.getItem(confStorageKeyForLeague(leagueKey)) || "").trim();
    } catch {
      return "";
    }
  }
  function saveConferenceFilter(leagueKey, confName) {
    try {
      localStorage.setItem(confStorageKeyForLeague(leagueKey), String(confName || "").trim());
    } catch {}
  }

  // ----- Conference extraction (scoreboard OR summary) -----
  function getConferenceNameFromTeam(team) {
    if (!team) return "";
    const conf =
      team?.conference?.shortName ||
      team?.conference?.name ||
      team?.conference?.abbreviation ||
      "";
    return String(conf || "").trim();
  }

  function getConferenceNameFromCompetitor(competitor) {
    const team = competitor?.team || null;
    return getConferenceNameFromTeam(team);
  }

  // ----- Cache helpers -----
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
    } catch {
      return null;
    }
  }

  function saveConfCache(leagueKey, dateYYYYMMDD, teamIdToConf) {
    try {
      sessionStorage.setItem(
        confCacheKey(leagueKey, dateYYYYMMDD),
        JSON.stringify({ ts: Date.now(), teamIdToConf: teamIdToConf || {} })
      );
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
      const competitors = comp?.competitors || [];
      for (const c of competitors) {
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
      ...(isLoading ? [`<option value="" disabled>Loading conferences…</option>`] : []),
      ...list.map(c => {
        const v = String(c || "").trim();
        const s = (v && v === sel) ? "selected" : "";
        return `<option value="${escapeHtml(v)}" ${s}>${escapeHtml(v)}</option>`;
      })
    ].join("");

    return `
      <select id="confSelect" class="leagueSelect" aria-label="Select conference">
        ${opts}
      </select>
    `;
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
        const competitors = comp?.competitors || [];
        const map = {};

        for (const c of competitors) {
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

  function applyConferenceMetaToDom(eventId, side /* "home"|"away" */, confText, recordText) {
    const el = document.querySelector(
      `[data-teammeta="${CSS.escape(String(eventId))}_${CSS.escape(String(side))}"]`
    );
    if (!el) return;

    const base = side === "home" ? "Home" : "Away";
    const parts = [];
    const c = String(confText || "").trim();
    const r = String(recordText || "").trim();
    if (c) parts.push(c);
    parts.push(base);
    if (r) parts.push(r);

    const next = parts.join(" • ");
    if (el.textContent !== next) el.textContent = next;
  }

  function filterEventsByConferenceUsingMap(events, confNorm, teamIdToConf) {
    if (!confNorm) return events;
    const map = teamIdToConf || {};
    return (events || []).filter(ev => {
      const comp = ev?.competitions?.[0];
      const competitors = comp?.competitors || [];
      return competitors.some(c => {
        const teamId = String(c?.team?.id || "");
        const conf = teamId ? (map[teamId] || "") : "";
        return conf && norm(conf) === confNorm;
      });
    });
  }

  // Exported for inline onchange/oninput
  window.handleNativeDateChangeFromEl = function (el) {
    const v = el?.value || "";
    const yyyymmdd = inputValueToYYYYMMDD(v);
    if (!yyyymmdd) return;
    saveDateYYYYMMDD(yyyymmdd);

    const tab = window.__activeTab || "scores";
    if (typeof window.showTab === "function") window.showTab(tab);
    else window.loadScores(true);
  };

  // League change (no duplicate handlers)
  if (!window.__scoresLeagueChangeBound) {
    window.__scoresLeagueChangeBound = true;
    document.addEventListener("change", (e) => {
      const sel = e.target;

      if (sel && sel.id === "leagueSelect") {
        const key = String(sel.value || "").trim();
        if (!key) return;
        saveLeagueKey(key);

        const tab = window.__activeTab || "scores";
        if (typeof window.showTab === "function") window.showTab(tab);
        else window.loadScores(true);
        return;
      }

      if (sel && sel.id === "confSelect") {
        const leagueKey = getSavedLeagueKey();
        const conf = String(sel.value || "").trim();
        saveConferenceFilter(leagueKey, conf);

        const tab = window.__activeTab || "scores";
        if (typeof window.showTab === "function") window.showTab(tab);
        else window.loadScores(true);
        return;
      }
    });
  }

  function buildFighter(competitor) {
    const a = competitor?.athlete || {};
    const headshot =
      a?.headshot?.href ||
      (Array.isArray(a?.headshots) ? a.headshots[0]?.href : "") ||
      "";

    const rec =
      (Array.isArray(competitor?.records) ? competitor.records[0]?.summary : "") ||
      a?.record?.displayValue ||
      "";

    return {
      name: String(a?.displayName || a?.shortName || competitor?.displayName || "Fighter"),
      logo: String(headshot || ""),
      record: String(rec || ""),
      homeAway: String(competitor?.homeAway || "")
    };
  }

  // ---------- Team / rank / record helpers ----------
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

  function metaLineWithConference(homeAwayLabel, competitor, leagueKey) {
    const base = String(homeAwayLabel || "").trim() || "";
    if (!isCollegeLeagueKey(leagueKey)) {
      const rec = getOverallRecordFromCompetitor(competitor);
      return rec ? `${base} • ${rec}` : base;
    }

    const conf = getConferenceNameFromCompetitor(competitor);
    const rec = getOverallRecordFromCompetitor(competitor);

    const parts = [];
    if (conf) parts.push(conf);
    if (base) parts.push(base);
    if (rec) parts.push(rec);

    return parts.join(" • ") || base;
  }

  function applyRivalryNameOverrides(rawName, teamObj) {
    const name = String(rawName || "").trim();
    const lower = name.toLowerCase();
    const id = String(teamObj?.id || "");
    const displayLower = String(teamObj?.displayName || "").toLowerCase();

    if (
      id === "130" ||
      lower.includes("michigan wolverines") ||
      displayLower.includes("michigan wolverines")
    ) return "The Team Up North";

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

    const isCollege = isCollegeLeagueKey(selectedKey);
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

  function isFavoriteTeam(team) {
    if (!team) return false;
    const ids = getTeamIdentityStrings(team).map(norm);
    return FAVORITES_NORM.some(fav => ids.includes(fav));
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

  // ---------- Odds parsing + hydration ----------
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
    if (!Number.isFinite(spreadNum)) return { favored: "", ou: "" };

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

  // Odds cache + concurrency
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

  // ---------- AI Insight ----------
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
        lean = total > 145 ? `Under ${total}` : `Under ${total}`;
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

  // ---------- ESPN fetch with fallbacks ----------
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
      const seenIds = new Set();

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const ev of result.value.events) {
          const id = String(ev?.id || "");
          if (id && !seenIds.has(id)) {
            seenIds.add(id);
            combined.push(ev);
          }
        }
      }

      const targetEvents = combined.filter(ev => {
        const evDate = eventLocalYYYYMMDD(ev);
        return !evDate || evDate === yyyymmdd;
      });

      const finalEvents = targetEvents.length > 0 ? targetEvents : combined;
      return { data: { ...baseData, events: finalEvents }, events: finalEvents };
    } catch {
      return { data: { events: [] }, events: [] };
    }
  }

  // ---------- Playoff series helpers ----------
  function parseSeriesFromComp(comp, leagueKey) {
    if (!comp || !PLAYOFF_LEAGUES.has(leagueKey)) return null;
    try {
      const series = comp?.series;
      if (!series) return null;
      const seriesComps = series?.competitors || [];
      if (seriesComps.length < 2) return null;
      const w0 = Number(seriesComps[0]?.wins || 0);
      const w1 = Number(seriesComps[1]?.wins || 0);
      if (w0 === 0 && w1 === 0) {
        const title = String(series?.title || series?.summary || "");
        if (title) return { seriesSummary: title };
        return null;
      }
      const gameComps = comp?.competitors || [];
      const nameForSeriesComp = (sc) => {
        const scId = String(sc?.id || sc?.team?.id || "");
        if (scId) {
          const match = gameComps.find(gc =>
            String(gc?.id || gc?.team?.id || "") === scId ||
            String(gc?.team?.id || "") === scId
          );
          if (match) return String(match?.team?.shortDisplayName || match?.team?.displayName || match?.team?.abbreviation || "");
        }
        return String(sc?.team?.shortDisplayName || sc?.team?.displayName || sc?.team?.abbreviation || "");
      };
      const n0 = nameForSeriesComp(seriesComps[0]) || "Team A";
      const n1 = nameForSeriesComp(seriesComps[1]) || "Team B";
      return { name0: n0, wins0: w0, name1: n1, wins1: w1 };
    } catch { return null; }
  }

  function parseSeriesFromSummary(data, fallbackComp) {
    try {
      const comp = data?.header?.competitions?.[0] || data?.competitions?.[0];
      if (!comp) return null;
      const seasonType = Number(data?.header?.season?.type || data?.season?.type || 0);
      if (seasonType < 2) return null;
      const series = comp?.series;
      if (!series) return null;
      const seriesComps = series?.competitors || [];
      if (seriesComps.length < 2) return null;
      const w0 = Number(seriesComps[0]?.wins || 0);
      const w1 = Number(seriesComps[1]?.wins || 0);
      const gameComps = [...(comp?.competitors || []), ...((fallbackComp?.competitors) || [])];
      const nameForSeriesComp = (sc) => {
        const scId = String(sc?.id || sc?.team?.id || "");
        if (scId) {
          const match = gameComps.find(gc =>
            String(gc?.id || gc?.team?.id || "") === scId ||
            String(gc?.team?.id || "") === scId
          );
          if (match) return String(match?.team?.shortDisplayName || match?.team?.displayName || match?.team?.abbreviation || "");
        }
        return String(sc?.team?.shortDisplayName || sc?.team?.displayName || sc?.team?.abbreviation || "");
      };
      const n0 = nameForSeriesComp(seriesComps[0]) || "Team A";
      const n1 = nameForSeriesComp(seriesComps[1]) || "Team B";
      if (w0 === 0 && w1 === 0) {
        const title = String(series?.title || series?.summary || "");
        if (title) return { seriesSummary: title };
      } else {
        return { name0: n0, wins0: w0, name1: n1, wins1: w1 };
      }
      const competitors = comp?.competitors || [];
      if (competitors.length >= 2) {
        const s0 = String(competitors[0]?.seriesSummary || "");
        if (s0) return { seriesSummary: s0 };
      }
      return null;
    } catch { return null; }
  }

  function buildSeriesHTML(series) {
    if (!series) return "";
    if (series.seriesSummary) return `<span class="gameSeriesBadge">🏆 ${escapeHtml(series.seriesSummary)}</span>`;
    const { name0, wins0, name1, wins1 } = series;
    if (wins0 === wins1) return `<span class="gameSeriesBadge tied">🏆 Series Tied ${wins0}-${wins1}</span>`;
    const leader = wins0 > wins1
      ? `${escapeHtml(name0)} leads ${wins0}-${wins1}`
      : `${escapeHtml(name1)} leads ${wins1}-${wins0}`;
    return `<span class="gameSeriesBadge">🏆 ${leader}</span>`;
  }

  // ================================================================
  // CARD RENDERER — pi.js-inspired tiles, phone-optimized
  // ================================================================

  function injectScoreCardStyles() {
    if (document.getElementById("shopScoreCardStyles")) return;
    const style = document.createElement("style");
    style.id = "shopScoreCardStyles";
    style.textContent = `
      /* ---- Score Card Tiles (phone-optimized, pi.js-inspired) ---- */
      .game {
        background: rgba(255,255,255,0.04);
        border-radius: 11px;
        border-left: 4px solid #444;
        padding: 11px 13px 10px;
        margin-bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 7px;
        position: relative;
        overflow: hidden;
        transition: box-shadow 0.18s;
      }
      .game::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.025) 0%, transparent 60%);
        pointer-events: none;
      }
      .game.live   { border-left-color: #cc2200; background: rgba(180,20,0,0.08); }
      .game.final  { border-left-color: #3a3a3a; }
      .game.sched  { border-left-color: rgba(0,160,80,0.7); }
      .game.upcoming { border-left-color: rgba(0,110,220,0.7); background: rgba(0,60,140,0.06); }

      /* --- Card top row: league badge + status --- */
      .gameCardTop {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .gameLeagueBadge {
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        padding: 3px 9px;
        border-radius: 20px;
        color: #fff;
        flex-shrink: 0;
        line-height: 1.3;
      }
      .gameStatusPill {
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: #888;
        text-align: right;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .gameStatusPill.live {
        color: #ff5533;
        animation: gameStatusLivePulse 2s ease-in-out infinite;
      }
      .gameStatusPill.upcoming { color: #4499ff; }
      @keyframes gameStatusLivePulse {
        0%,100% { opacity: 1; }
        50%      { opacity: 0.55; }
      }

      /* --- Team rows --- */
      .gameTeamsBlock {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .gameTeamRow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        min-height: 32px;
      }
      .gameTeamLeft {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .gameTeamLogo {
        width: 28px;
        height: 28px;
        object-fit: contain;
        flex-shrink: 0;
        border-radius: 3px;
      }
      .gameTeamLogo.fav {
        filter: drop-shadow(0 0 5px rgba(255,200,60,0.55));
      }
      .gameTeamName {
        font-size: 0.97rem;
        font-weight: 700;
        color: #ddd;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.2;
      }
      .gameTeamName.fav {
        color: #ffcc55;
      }
      .gameTeamRight {
        display: flex;
        align-items: center;
        gap: 7px;
        flex-shrink: 0;
      }
      .gameTeamRecord {
        font-size: 0.7rem;
        color: #666;
        white-space: nowrap;
      }
      .gameTeamScore {
        font-size: 1.35rem;
        font-weight: 900;
        color: #fff;
        min-width: 36px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.01em;
      }
      .game.live .gameTeamScore {
        text-shadow: 0 0 10px rgba(255,180,0,0.3);
      }

      /* --- Divider between teams --- */
      .gameTeamDivider {
        height: 1px;
        background: rgba(255,255,255,0.07);
        margin: 0 2px;
      }

      /* --- Series badge --- */
      .gameSeriesRow {
        display: flex;
        align-items: center;
        gap: 6px;
        min-height: 0;
      }
      .gameSeriesBadge {
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.04em;
        color: #ffcc44;
        background: rgba(200,160,0,0.14);
        border: 1px solid rgba(200,160,0,0.28);
        border-radius: 5px;
        padding: 2px 8px;
        white-space: nowrap;
      }
      .gameSeriesBadge.tied {
        color: #aaa;
        background: rgba(180,180,180,0.09);
        border-color: rgba(180,180,180,0.2);
      }

      /* --- Meta row (odds + venue) --- */
      .gameMetaRow {
        display: flex;
        flex-wrap: wrap;
        gap: 3px 8px;
        margin-top: 1px;
      }
      .gameMetaItem {
        font-size: 0.69rem;
        color: #666;
        white-space: nowrap;
      }
      .gameMetaItem.odds {
        color: #999;
        font-weight: 600;
      }
      .gameMetaItem.venue {
        color: #5a5a5a;
      }

      /* --- AI Edge chip --- */
      .gameAiChip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.67rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        background: rgba(0,120,180,0.15);
        border: 1px solid rgba(0,140,220,0.25);
        border-radius: 5px;
        padding: 2px 7px;
        color: #66bbff;
        white-space: nowrap;
        margin-top: 1px;
      }

      /* --- Conf / home-away meta under team name --- */
      .gameTeamMeta {
        font-size: 0.67rem;
        color: #5a5a5a;
        line-height: 1.1;
        margin-top: 1px;
      }
    `;
    document.head.appendChild(style);
  }

  // ---- Build a single sexy score card tile ----
  function buildGameCardHTML({
    eventId,
    leagueKey,
    leagueName,
    state,         // "in" | "pre" | "post"
    statusText,
    isUpcoming,
    competitors,   // array of ESPN competitor objects
    competition,   // ESPN competition object
    selectedKey,
    venueLine,
    seriesHTML,
    oddsText,      // pre-rendered odds string (may be empty — hydrated later)
    aiEdge,
    aiLean,
    aiConfidence,
  }) {
    // Card class
    let cardClass = "game";
    let statusClass = "";
    if (isUpcoming) {
      cardClass += " upcoming";
      statusClass = "upcoming";
    } else if (state === "in") {
      cardClass += " live";
      statusClass = "live";
    } else if (state === "post") {
      cardClass += " final";
    } else {
      cardClass += " sched";
    }

    // League badge color
    const badgeColor = LEAGUE_COLORS[leagueKey] || "#444";
    const badgeLabel = escapeHtml(leagueName || leagueKey.toUpperCase());

    // Team rows
    const teamRowsHTML = competitors.map((c, idx) => {
      const team = c?.team || {};
      const isFav = isFavoriteTeam(team);
      const logoUrl = getTeamLogoUrl(team) || "";
      const rawName = getTeamDisplayNameUI(team) || team.displayName || "TBD";
      const name = teamDisplayNameWithRank(rawName, c, selectedKey);
      const score = (state !== "pre" && !isUpcoming && c?.score != null) ? String(c.score) : (isUpcoming ? "" : "");
      const record = getOverallRecordFromCompetitor(c);

      // Conference meta line (college only, shown under team name)
      const confText = isCollegeLeagueKey(selectedKey) ? getConferenceNameFromCompetitor(c) : "";
      const haConf = confText;
      const metaAttr = `data-teammeta="${escapeHtml(String(eventId))}_${escapeHtml(c.homeAway || (idx === 0 ? "away" : "home"))}"`;
      const metaLineText = metaLineWithConference(c.homeAway === "home" ? "Home" : "Away", c, selectedKey);
      const metaHTML = `<div class="gameTeamMeta" ${metaAttr}>${escapeHtml(metaLineText)}</div>`;

      const logoHTML = logoUrl
        ? `<img class="gameTeamLogo${isFav ? " fav" : ""}" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(name)}" width="28" height="28" loading="lazy" />`
        : "";

      const divider = idx === 0 ? `<div class="gameTeamDivider"></div>` : "";

      return `
        <div class="gameTeamRow">
          <div class="gameTeamLeft">
            ${logoHTML}
            <div style="min-width:0;flex:1;">
              <div class="gameTeamName${isFav ? " fav" : ""}">${escapeHtml(name)}</div>
              ${metaHTML}
            </div>
          </div>
          <div class="gameTeamRight">
            ${record ? `<span class="gameTeamRecord">${escapeHtml(record)}</span>` : ""}
            ${score !== "" ? `<span class="gameTeamScore">${escapeHtml(score)}</span>` : ""}
          </div>
        </div>
        ${divider}
      `;
    }).join("");

    // Odds meta
    const oddsHTML = oddsText
      ? `<span class="gameMetaItem odds gameMetaOddsLine">${escapeHtml(oddsText)}</span>`
      : `<span class="gameMetaItem odds gameMetaOddsLine"></span>`;

    const venueHTML = venueLine && venueLine !== "—"
      ? `<span class="gameMetaItem venue">📍 ${escapeHtml(venueLine)}</span>`
      : "";

    const metaRowHTML = (oddsText || (venueLine && venueLine !== "—"))
      ? `<div class="gameMetaRow">${oddsHTML}${venueHTML}</div>`
      : `<div class="gameMetaRow">${oddsHTML}</div>`;

    // AI Edge chip
    let aiHTML = "";
    if (aiEdge && aiEdge !== "Stay Away" && state === "pre") {
      aiHTML = `<div class="gameAiChip">🤖 Edge: ${escapeHtml(aiEdge)} · ${escapeHtml(String(aiConfidence || ""))} / 10</div>`;
    }

    // Series row
    const seriesRowHTML = seriesHTML
      ? `<div class="gameSeriesRow">${seriesHTML}</div>`
      : "";

    return `
      <div class="${cardClass}" data-eventid="${escapeHtml(String(eventId))}">
        <div class="gameCardTop">
          <span class="gameLeagueBadge" style="background:${badgeColor};">${badgeLabel}</span>
          <span class="gameStatusPill ${statusClass}">${escapeHtml(statusText)}</span>
        </div>
        <div class="gameTeamsBlock">
          ${teamRowsHTML}
        </div>
        ${seriesRowHTML}
        ${metaRowHTML}
        ${aiHTML}
      </div>
    `;
  }

  // ---------- Main render entry ----------
  window.loadScores = async function loadScores(forceRefresh) {
    injectScoreCardStyles();

    const container = document.getElementById("scoresContent") ||
                      document.getElementById("scores-content") ||
                      document.querySelector(".scores-tab-content") ||
                      document.querySelector("[data-tab='scores'] .tabContent");
    if (!container) return;

    const selectedKey = getSavedLeagueKey();
    const league = getLeagueByKey(selectedKey);
    const dateYYYYMMDD = getSavedDateYYYYMMDD();
    const prettyDate = yyyymmddToPretty(dateYYYYMMDD) || "Today";

    // Build header controls
    const leagueSelectHTML = buildLeagueSelectHTML(selectedKey);
    const calendarHTML = buildCalendarButtonHTML();
    const confSelectHTML = isCollegeLeagueKey(selectedKey)
      ? buildConferenceSelectHTML([], getSavedConferenceFilter(selectedKey), true)
      : "";

    container.innerHTML = `
      <div class="scoresHeader">
        <div class="scoresControls">
          ${leagueSelectHTML}
          ${confSelectHTML}
          ${calendarHTML}
        </div>
        <div class="scoresDateLabel">${escapeHtml(prettyDate)}</div>
      </div>
      <div id="scoresGameList" class="scoresGameList">
        <div class="scoresLoading">Loading scores…</div>
      </div>
    `;

    const gameList = container.querySelector("#scoresGameList");

    let events = [];
    let fetchError = false;

    try {
      const result = await fetchScoreboardWithFallbacks(league, dateYYYYMMDD);
      events = result.events || [];
    } catch (err) {
      fetchError = true;
    }

    if (fetchError || !events.length) {
      gameList.innerHTML = `<div class="scoresEmpty">${fetchError ? "Could not load scores. Check your connection." : "No games found for this date."}</div>`;
      return;
    }

    // Conference map for college leagues
    let teamIdToConf = {};
    if (isCollegeLeagueKey(selectedKey)) {
      const cached = loadConfCache(selectedKey, dateYYYYMMDD);
      if (cached?.teamIdToConf) {
        teamIdToConf = cached.teamIdToConf;
      } else {
        // Build from scoreboard first
        for (const ev of events) {
          for (const c of (ev?.competitions?.[0]?.competitors || [])) {
            const team = c?.team;
            const id = String(team?.id || "");
            if (id) {
              const conf = getConferenceNameFromTeam(team);
              if (conf) teamIdToConf[id] = conf;
            }
          }
        }
      }

      // Update conf dropdown with what we have
      const confs = buildConferenceListFromMap(teamIdToConf);
      updateConferenceSelectOptions(confs, selectedKey);
    }

    // Apply conference filter
    const savedConf = isCollegeLeagueKey(selectedKey) ? getSavedConferenceFilter(selectedKey) : "";
    const confNorm = norm(savedConf);
    const filteredEvents = confNorm
      ? filterEventsByConferenceUsingMap(events, confNorm, teamIdToConf)
      : events;

    // Sort: favorites first, then live > pre > post, then start time
    const sorted = [...filteredEvents].sort((a, b) => {
      const compA = a?.competitions?.[0];
      const compB = b?.competitions?.[0];
      const favA = favoriteRankForEvent(compA);
      const favB = favoriteRankForEvent(compB);

      // Favorites first
      const aIsFav = favA < Infinity;
      const bIsFav = favB < Infinity;
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      if (aIsFav && bIsFav && favA !== favB) return favA - favB;

      // Then by state
      const stateA = stateRank(String(compA?.status?.type?.state || "pre"));
      const stateB = stateRank(String(compB?.status?.type?.state || "pre"));
      if (stateA !== stateB) return stateA - stateB;

      // Then by start time
      return getStartTimeMs(a, compA) - getStartTimeMs(b, compB);
    });

    // Render cards
    const cardsHTML = sorted.map(ev => {
      const comp = ev?.competitions?.[0] || {};
      const competitors = comp?.competitors || [];
      const stateStr = String(comp?.status?.type?.state || "pre");
      const statusName = String(ev?.status?.type?.name || "").toLowerCase();
      const statusDetail = String(ev?.status?.type?.detail || ev?.status?.type?.shortDetail || "");

      let state = stateStr;
      if (statusName.includes("in_progress") || statusName === "in") state = "in";
      else if (statusName.includes("final") || statusName === "post") state = "post";

      let statusText = "";
      let isUpcoming = false;

      if (state === "in") {
        statusText = statusDetail || "LIVE";
      } else if (state === "post") {
        statusText = statusDetail || "Final";
      } else {
        const evDate = new Date(ev?.date || "");
        if (!isNaN(evDate.getTime())) {
          statusText = evDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        } else {
          statusText = "Scheduled";
        }
      }

      const venueLine = buildVenueLine(comp);
      const oddsFromBoard = parseOddsFromScoreboardCompetition(comp);
      const initialOddsText = buildOddsLine(oddsFromBoard.favored, oddsFromBoard.ou);

      // Series (from scoreboard, hydrated later via summary)
      const seriesFromComp = parseSeriesFromComp(comp, selectedKey);
      const seriesHTML = seriesFromComp ? buildSeriesHTML(seriesFromComp) : "";

      return buildGameCardHTML({
        eventId: String(ev?.id || ""),
        leagueKey: selectedKey,
        leagueName: league.name,
        state,
        statusText,
        isUpcoming,
        competitors,
        competition: comp,
        selectedKey,
        venueLine,
        seriesHTML,
        oddsText: initialOddsText,
        aiEdge: "",
        aiLean: "",
        aiConfidence: "",
      });
    }).join("");

    gameList.innerHTML = cardsHTML || `<div class="scoresEmpty">No games found.</div>`;

    // Background hydration: odds + series + AI + conference
    hydrateAllOdds(sorted, league, selectedKey, dateYYYYMMDD);

    // Hydrate series + AI + conf via summary
    if (league.summaryEndpoint) {
      runWithConcurrency(sorted, ODDS_CONCURRENCY_LIMIT, async (ev) => {
        const eventId = String(ev?.id || "");
        if (!eventId) return;

        const comp = ev?.competitions?.[0] || {};
        const stateStr = String(comp?.status?.type?.state || "pre");

        try {
          const base = league.summaryEndpoint(eventId);
          const summaryData = await fetchJsonNoStore(withLangRegion(base));

          // Series badge hydration
          if (PLAYOFF_LEAGUES.has(selectedKey)) {
            const series = parseSeriesFromSummary(summaryData, comp);
            if (series) {
              const card = gameList.querySelector(`.game[data-eventid="${CSS.escape(eventId)}"]`);
              if (card) {
                let seriesRow = card.querySelector(".gameSeriesRow");
                if (!seriesRow) {
                  seriesRow = document.createElement("div");
                  seriesRow.className = "gameSeriesRow";
                  const metaRow = card.querySelector(".gameMetaRow");
                  if (metaRow) card.insertBefore(seriesRow, metaRow);
                  else card.appendChild(seriesRow);
                }
                const html = buildSeriesHTML(series);
                if (html && seriesRow.innerHTML !== html) seriesRow.innerHTML = html;
              }
            }
          }

          // Conference hydration (college only)
          if (isCollegeLeagueKey(selectedKey)) {
            const confMap = await fetchConferenceMapFromSummary(league, eventId);
            Object.assign(teamIdToConf, confMap);

            // Apply to DOM
            for (const c of (comp?.competitors || [])) {
              const teamId = String(c?.team?.id || "");
              const conf = teamIdToConf[teamId] || "";
              if (conf) {
                const side = c.homeAway === "home" ? "home" : "away";
                const rec = getOverallRecordFromCompetitor(c);
                applyConferenceMetaToDom(eventId, side, conf, rec);
              }
            }

            // Update conf dropdown
            const confs = buildConferenceListFromMap(teamIdToConf);
            updateConferenceSelectOptions(confs, selectedKey);
            saveConfCache(selectedKey, dateYYYYMMDD, teamIdToConf);
          }

          // AI edge for pre-game only
          if (stateStr === "pre") {
            const competitors = comp?.competitors || [];
            const home = competitors.find(c => c.homeAway === "home");
            const away = competitors.find(c => c.homeAway === "away");
            const homeName = getTeamDisplayNameUI(home?.team) || "Home";
            const awayName = getTeamDisplayNameUI(away?.team) || "Away";
            const oddsForAI = parseOddsFromSummary(summaryData, comp);

            const ai = await fetchAIInsight({
              league: selectedKey,
              date: dateYYYYMMDD,
              eventId,
              home: homeName,
              away: awayName,
              spread: oddsForAI.favored || "",
              total: oddsForAI.ou || "",
            });

            if (ai && ai.edge && ai.edge !== "Stay Away") {
              const card = gameList.querySelector(`.game[data-eventid="${CSS.escape(eventId)}"]`);
              if (card) {
                let chip = card.querySelector(".gameAiChip");
                if (!chip) {
                  chip = document.createElement("div");
                  chip.className = "gameAiChip";
                  card.appendChild(chip);
                }
                const newText = `🤖 Edge: ${escapeHtml(ai.edge)} · ${escapeHtml(String(ai.confidence || ""))} / 10`;
                if (chip.innerHTML !== newText) chip.innerHTML = newText;
              }
            }
          }
        } catch {}
      });
    }
  };

})();
