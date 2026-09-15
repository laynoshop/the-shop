/* split/gp-espn.js
   =========================
   GROUP PICKS — ESPN Data Layer
   Leagues list, fetchEventsFor (admin's "available games" picker, which
   still talks to ESPN directly since those games aren't in Firestore
   yet), plus gpApplyStoredLiveState/gpApplyStoredOdds — reshape the
   live/final score and odds fields the syncPickemScores Cloud Function
   (functions/index.js) already writes onto each committed game doc into
   the shapes gp-render.js expects on g.__live/g.__odds. Once a game is
   part of a Pick'em week, nothing here calls ESPN directly anymore.
   Exposes all functions on window.GP_ESPN namespace.
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

  // Throws on any real failure (bad league/config, network/CORS error,
  // non-ok HTTP status, unparsable JSON) instead of swallowing it into an
  // empty array — a genuinely empty ESPN response for the requested
  // dates and a silent fetch failure used to look identical to whoever
  // called this (the admin's "Load Games" picker just showed "Loaded 0
  // games" either way), which made a real outage indistinguishable from
  // "no games that day." Callers that want the old forgiving behavior
  // can still catch and treat any error as empty.
  async function fetchEventsFor(leagueKey, dateYYYYMMDD) {
    const league = getLeagueByKeySafe(leagueKey);
    if (!league) throw new Error(`Unknown league "${leagueKey}".`);
    const url = (typeof league.endpoint === "function") ? league.endpoint(dateYYYYMMDD) : "";
    if (!url) throw new Error(`League "${leagueKey}" has no scoreboard endpoint configured.`);
    let r;
    try {
      r = await fetch(url, { cache: "no-store" });
    } catch (err) {
      throw new Error(`Network request to ESPN failed (${err?.message || "unknown error"}) — could be a connectivity issue or ESPN blocking the request.`);
    }
    if (!r.ok) throw new Error(`ESPN returned HTTP ${r.status} for ${league.name || leagueKey}.`);
    let j;
    try {
      j = await r.json();
    } catch {
      throw new Error("ESPN's response wasn't valid JSON.");
    }
    return Array.isArray(j?.events) ? j.events : [];
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

  // --------------- odds (from Firestore) ---------------
  // Same idea as gpApplyStoredLiveState: syncPickemScores now fetches
  // odds from the same ESPN scoreboard call it already makes for scores
  // and writes liveOddsDetails/liveOddsOverUnder onto each game doc, so
  // this is a zero-network-call reshape into the { details, overUnder }
  // shape safeOddsLine/safeOverUnder (gp-render.js) already expect on
  // g.__odds — no more per-render ESPN odds fetch, and no more relying
  // on someone having the app open for odds to stay current.
  function gpApplyStoredOdds(games) {
    for (const g of (Array.isArray(games) ? games : [])) {
      if (!g) continue;
      g.__odds = g.liveOddsDetails || g.liveOddsOverUnder
        ? { details: g.liveOddsDetails || "", overUnder: g.liveOddsOverUnder || "" }
        : null;
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
    gpApplyStoredOdds
  };

})();
