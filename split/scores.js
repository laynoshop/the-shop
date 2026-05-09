/* =========================
   SCORES TAB (Gold Standard)
   - ESPN scoreboard fetch w/ fallbacks
   - Favorites-first sorting (shows ALL games)
   - Odds parse + background hydration via Summary
   - AI EDGE (local compute + cache, no flicker)
   - Header matches big script look
   - ✅ NEW: CFB + MCBB conference label + conference filter
   - ✅ NEW: pi.js visual language — card accents, league badge, live glow, tabular-nums
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
        `https://site.api.espn.