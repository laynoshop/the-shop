/* =========================
   SCORES TAB (Gold Standard)
   - ESPN scoreboard fetch w/ fallbacks
   - Favorites-first sorting (shows ALL games)
   - Odds parse + background hydration via Summary
   - AI EDGE (local compute + cache, no flicker)
   - Header matches big script look
   - ✅ NEW: CFB + MCBB conference label + conference filter
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
    // (Optional) If you want this favored in MLS too later:
    // "Columbus Crew"
  ];

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

      // expected: { ts, teamIdToConf: { [teamId]: "Big Ten" } }
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

  // Best-effort from scoreboard response (often empty for NCAA)
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

      // league select
      if (sel && sel.id === "leagueSelect") {
        const key = String(sel.value || "").trim();
        if (!key) return;
        saveLeagueKey(key);

        const tab = window.__activeTab || "scores";
        if (typeof window.showTab === "function") window.showTab(tab);
        else window.loadScores(true);
        return;
      }

      // conference select (only exists for college leagues)
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

    // ESPN UFC often has records/summary in different places; keep it defensive
    const rec =
      (Array.isArray(competitor?.records) ? competitor.records[0]?.summary : "") ||
      a?.record?.displayValue ||
      "";

    return {
      name: String(a?.displayName || a?.shortName || competitor?.displayName || "Fighter"),
      logo: String(headshot || ""),   // reuse your logo spot for headshot
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
      const away = competitors.find(t => t.h