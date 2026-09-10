/* split/gp-espn.js
   =========================
   GROUP PICKS — ESPN Data Layer
   Leagues list, fetchEventsFor, live score hydration,
   odds hydration + sessionStorage cache.
   Exposes all functions on window.GP_ESPN namespace.

   v2 fix: after hydrating live scores, any game that has gone
   final (state === "post") is written back to Firestore so the
   leaderboard can compute correctly even after ESPN stops
   returning data for old dates.
*/

(function () {
  "use strict";

  // --------------- safe helpers (local copies) ---------------
  function safeGetLS(key) {
    try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
  }

  function getSavedDateYYYYMMDDSafe() {
    if (typeof window.getSavedDateYYYYMMDD === "function") return window.getSavedDateYYYYMMDD();
    const DATE_KEY = "theShopDate_v1";
    let saved = "";
    try { saved = String(localStorage.getItem(DATE_KEY) || "").trim(); } catch { saved = ""; }
    if (/^\d{8}$/.test(saved)) return saved;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${da}`;
  }

  function esc(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // --------------- leagues list ---------------
  const __LEAGUES_FALLBACK_FULL = [
    { key: "ncaam", name: "Men's College Basketball", endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=50&limit=200` },
    { key: "nba",   name: "NBA",                     endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}` },
    { key: "nhl",   name: "NHL",                     endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}` },
    { key: "mls",   name: "MLS (Soccer)",            endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${date}` },
    { key: "nfl",   name: "NFL",                     endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}` },
    { key: "cfb",   name: "College Football",        endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}` },
    { key: "mlb",   name: "MLB",                     endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}` },
    { key: "pga",   name: "Golf (PGA)",              endpoint: (date) => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${date}` }
  ];

  function __getLeaguesFullList() {
    const g = Array.isArray(window.LEAGUES) ? window.LEAGUES : null;
    if (g && g.length && typeof g[0]?.endpoint === "function") return g;
    return __LEAGUES_FALLBACK_FULL;
  }

  function getLeagueByKeySafe(key) {
    if (typeof window.getLeagueByKey === "function") {
      const found = window.getLeagueByKey(key);
      if (found) return found;
    }
    const list = __getLeaguesFullList();
    const k = String(key || "").trim();
    return list.find(l => String(l.key) === k) || null;
  }

  function buildLeagueSelectHTMLSafe(selectedKey) {
    const leagues = __getLeaguesFullList();
    const sel = leagues.some(l => l.key === selectedKey) ? selectedKey : (leagues[0]?.key || "ncaam");
    const options = leagues.map(l => {
      const k = String(l.key || "");
      const nm = String(l.name || k);
      return `<option value="${esc(k)}"${k === sel ? " selected" : ""}>${esc(nm)}</option>`;
    }).join("");
    return `<select class="leagueSelect" aria-label="Choose league" data-gpadminleague="1">${options}</select>`;
  }

  function buildCalendarButtonHTMLSafe() {
    const current = (() => {
      const s = String(getSavedDateYYYYMMDDSafe() || "");
      if (!/^\d{8}$/.test(s)) return "";
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    })();
    return `
      <span class="datePickerWrap" aria-label="Choose date">
        <button id="dateBtn" class="iconBtn" aria-label="Choose date" type="button">&#x1F4C5;</button>
        <input
          id="nativeDateInput"
          class="nativeDateInput"
          type="date"
          value="${esc(current)}"
          aria-label="Choose date"
          data-gpadmindate="1"
        />
      </span>
    `;
  }

  async function fetchEventsFor(leagueKey, dateYYYYMMDD) {
    const league = getLeagueByKeySafe(leagueKey);
    if (!league) return [];
    const url = (typeof league.endpoint === "function") ? league.endpoint(dateYYYYMMDD) : "";
    if (!url) return [];
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) return [];
      const j = await r.json().catch(() => ({}));
      return Array.isArray(j?.events) ? j.events : [];
    } catch {
      return [];
    }
  }

  // --------------- live/final state (from Firestore) ---------------
  // The syncPickemScores Cloud Function polls ESPN on its own 1-minute
  // schedule and writes live/final scores straight onto each game doc
  // (liveState/liveHomeScore/liveAwayScore/liveDetail while in progress,
  // finalState/finalHomeScore/finalAwayScore once it ends) — reliably,
  // regardless of whether anyone has the app open. gpGetSlateGames
  // already reads the full game doc, so those fields are already sitting
  // on each game object with zero extra network calls; this just
  // reshapes them into the { state, detail, homeScore, awayScore } shape
  // every render/grading helper already expects on g.__live. This
  // replaces the old client-side ESPN poll (and its best-effort final-
  // score writeback, which only worked when an admin's browser happened
  // to be open right as a game ended).
  function gpApplyStoredLiveState(games) {
    for (const g of (Array.isArray(games) ? games : [])) {
      if (!g) continue;
      if (String(g.finalState || "").toLowerCase() === "post" && g.finalHomeScore != null && g.finalAwayScore != null) {
        g.__live = { state: "post", detail: "", homeScore: g.finalHomeScore, awayScore: g.finalAwayScore };
      } else if (g.liveState) {
        g.__live = {
          state: String(g.liveState || "").toLowerCase(),
          detail: String(g.liveDetail || ""),
          homeScore: g.liveHomeScore,
          awayScore: g.liveAwayScore,
        };
      } else {
        g.__live = null;
      }
    }
  }

  // --------------- odds helpers ---------------
  function gpCleanFavoredText(s) {
    return String(s || "")
      .trim()
      .replace(/^Line:\s*/i, "")
      .replace(/^Spread:\s*/i, "")
      .replace(/^Odds:\s*/i, "")
      .trim();
  }
  function gpNormalizeNumberString(n) {
    if (n === null || n === undefined || n === "") return "";
    return String(n).trim();
  }
  function gpFirstOddsFromCompetition(comp) {
    const arr = comp?.odds;
    if (Array.isArray(arr) && arr.length) return arr[0];
    return null;
  }
  function gpFirstPickcenterFromCompetition(comp) {
    const pc = comp?.pickcenter;
    if (Array.isArray(pc) && pc.length) return pc[0];
    return null;
  }
  function gpParseOddsFromPickcenter(pc) {
    if (!pc) return null;
    const overUnder = gpNormalizeNumberString(pc.overUnder ?? pc.total ?? pc.overunder ?? "");
    const detailsRaw = gpCleanFavoredText(
      pc.details || pc.displayValue ||
      pc.awayTeamOdds?.details || pc.homeTeamOdds?.details || ""
    );
    if (detailsRaw || overUnder) return { details: detailsRaw, overUnder };
    const spreadNum = Number(pc.spread ?? pc.line ?? pc.handicap);
    if (!Number.isFinite(spreadNum)) return null;
    const homeFav = !!pc.homeTeamOdds?.favorite;
    const awayFav = !!pc.awayTeamOdds?.favorite;
    let favoredTeam = homeFav ? "Home" : awayFav ? "Away" : (spreadNum < 0 ? "Home" : "Away");
    const abs = Math.abs(spreadNum);
    const spreadVal = abs % 1 === 0 ? String(abs.toFixed(0)) : String(abs);
    return { details: `${favoredTeam} -${spreadVal}`, overUnder };
  }
  function gpGetEventOddsFromScoreboardEvent(ev) {
    try {
      const comp = ev?.competitions?.[0] || null;
      if (!comp) return null;
      const o = gpFirstOddsFromCompetition(comp);
      if (o) {
        const details = gpCleanFavoredText(o?.details || o?.displayValue || "");
        const overUnder = gpNormalizeNumberString(o?.overUnder ?? o?.total ?? "");
        if (details || overUnder) return { details, overUnder };
      }
      const pc = gpFirstPickcenterFromCompetition(comp);
      const fromPc = gpParseOddsFromPickcenter(pc);
      if (fromPc && (fromPc.details || fromPc.overUnder)) return fromPc;
      return null;
    } catch {
      return null;
    }
  }

  // --------------- odds cache (sessionStorage) ---------------
  const GP_ODDS_CACHE_PREFIX = "theShopGpOddsCache_v2_";
  const GP_ODDS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  function gpOddsCacheKey(leagueKey, dateYYYYMMDD) {
    return `${GP_ODDS_CACHE_PREFIX}${String(leagueKey || "")}_${String(dateYYYYMMDD || "")}`;
  }
  function gpLoadOddsCache(leagueKey, dateYYYYMMDD) {
    try {
      const raw = sessionStorage.getItem(gpOddsCacheKey(leagueKey, dateYYYYMMDD));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const now = Date.now();
      const out = {};
      for (const [eventId, val] of Object.entries(parsed)) {
        const ts = Number(val?.ts || 0);
        if (!Number.isFinite(ts) || (now - ts) > GP_ODDS_CACHE_TTL_MS) continue;
        out[eventId] = { details: val.details || "", overUnder: val.overUnder || "", ts };
      }
      return out;
    } catch { return {}; }
  }
  function gpSaveOddsCache(leagueKey, dateYYYYMMDD, obj) {
    try {
      sessionStorage.setItem(gpOddsCacheKey(leagueKey, dateYYYYMMDD), JSON.stringify(obj || {}));
    } catch {}
  }

  // --------------- summary URL inference ---------------
  function gpWithLangRegion(url) {
    try {
      const u = new URL(url);
      if (!u.searchParams.has("lang")) u.searchParams.set("lang", "en");
      if (!u.searchParams.has("region")) u.searchParams.set("region", "us");
      return u.toString();
    } catch { return url; }
  }
  async function gpFetchJsonNoStore(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }
  function gpInferSummaryUrls(league, eventId) {
    const urls = [];
    try {
      const base = String(league?.endpoint?.(getSavedDateYYYYMMDDSafe()) || "");
      if (!base) return [];
      const baseNoDates = base.replace(/([?&])dates=\d{8}(&?)/i, (m, p1, p2) => (p2 ? p1 : ""));
      const withoutScoreboard = baseNoDates.replace(/\/scoreboard(\?.*)?$/i, "");
      const u1 = `${withoutScoreboard}/summary?event=${encodeURIComponent(eventId)}`;
      const u2 = `${withoutScoreboard}/summary?eventId=${encodeURIComponent(eventId)}`;
      urls.push(gpWithLangRegion(u1), gpWithLangRegion(u2), u1, u2);
    } catch {}
    return urls.filter(Boolean);
  }
  function gpParseOddsFromSummaryData(summaryData) {
    const pcArr = summaryData?.pickcenter;
    if (Array.isArray(pcArr) && pcArr.length) {
      const parsed = gpParseOddsFromPickcenter(pcArr[0]);
      if (parsed && (parsed.details || parsed.overUnder)) return parsed;
    }
    const comp = summaryData?.header?.competitions?.[0] || null;
    if (comp) {
      const pc2 = gpFirstPickcenterFromCompetition(comp);
      const parsed2 = gpParseOddsFromPickcenter(pc2);
      if (parsed2 && (parsed2.details || parsed2.overUnder)) return parsed2;
      const o2 = gpFirstOddsFromCompetition(comp);
      if (o2) {
        const details = gpCleanFavoredText(o2?.details || o2?.displayValue || "");
        const overUnder = gpNormalizeNumberString(o2?.overUnder ?? o2?.total ?? "");
        if (details || overUnder) return { details, overUnder };
      }
    }
    const oTop = Array.isArray(summaryData?.odds) ? summaryData.odds[0] : null;
    if (oTop) {
      const details = gpCleanFavoredText(oTop?.details || oTop?.displayValue || "");
      const overUnder = gpNormalizeNumberString(oTop?.overUnder ?? oTop?.total ?? "");
      if (details || overUnder) return { details, overUnder };
    }
    return null;
  }

  // --------------- full odds hydration ---------------
  async function gpHydrateOddsForGames(list, leagueKey) {
    if (!Array.isArray(list) || !list.length) return;
    const dateYYYYMMDD = getSavedDateYYYYMMDDSafe();
    const league = getLeagueByKeySafe(leagueKey);
    const cacheObj = gpLoadOddsCache(leagueKey, dateYYYYMMDD);
    const oddsMap = new Map();
    for (const [eid, val] of Object.entries(cacheObj)) {
      if (eid && val && (val.details || val.overUnder)) oddsMap.set(eid, val);
    }

    let events = [];
    try {
      const resp = await fetch(league.endpoint(dateYYYYMMDD), { cache: "no-store" });
      if (resp.ok) {
        const sb = await resp.json();
        events = Array.isArray(sb?.events) ? sb.events : [];
      }
    } catch {}

    for (const ev of events) {
      const eid = String(ev?.id || "").trim();
      if (!eid || oddsMap.has(eid)) continue;
      const odds = gpGetEventOddsFromScoreboardEvent(ev);
      if (odds && (odds.details || odds.overUnder)) {
        oddsMap.set(eid, { details: odds.details || "", overUnder: odds.overUnder || "", ts: Date.now() });
        cacheObj[eid] = { details: odds.details || "", overUnder: odds.overUnder || "", ts: Date.now() };
      }
    }

    const missing = [];
    for (const g of list) {
      const eid = String(g?.eventId || g?.id || "").trim();
      if (!eid) continue;
      const val = oddsMap.get(eid);
      if (!(val && (val.details || val.overUnder))) missing.push(eid);
    }

    const CONCURRENCY = 6;
    let idx = 0;
    async function worker() {
      while (idx < missing.length) {
        const eid = missing[idx++];
        const urls = gpInferSummaryUrls(league, eid);
        for (const url of urls) {
          try {
            const data = await gpFetchJsonNoStore(url);
            const parsed = gpParseOddsFromSummaryData(data);
            if (parsed && (parsed.details || parsed.overUnder)) {
              const val = { details: parsed.details || "", overUnder: parsed.overUnder || "", ts: Date.now() };
              oddsMap.set(eid, val);
              cacheObj[eid] = val;
              break;
            }
          } catch {}
        }
        if (!cacheObj[eid]) cacheObj[eid] = { details: "", overUnder: "", ts: Date.now() };
      }
    }
    await Promise.all(new Array(Math.min(CONCURRENCY, missing.length)).fill(0).map(worker));
    gpSaveOddsCache(leagueKey, dateYYYYMMDD, cacheObj);

    for (const g of list) {
      const eid = String(g?.eventId || g?.id || "").trim();
      g.__odds = eid ? (oddsMap.get(eid) || null) : null;
    }
  }

  // --------------- expose on window ---------------
  window.GP_ESPN = {
    __getLeaguesFullList,
    getLeagueByKeySafe,
    buildLeagueSelectHTMLSafe,
    buildCalendarButtonHTMLSafe,
    fetchEventsFor,
    gpApplyStoredLiveState,
    gpHydrateOddsForGames,
    gpGetEventOddsFromScoreboardEvent
  };

})();
