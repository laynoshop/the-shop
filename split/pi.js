 // split/pi.js
// Pi Scoreboard — full-screen TV dashboard for the Raspberry Pi.
// Admin only. Launched from the entry screen via window.launchPiScoreboard().

(function () {
  "use strict";

  // ----------------------------------------------------------------
  // Constants
  // ----------------------------------------------------------------
  const REFRESH_SCORES_MS  = 60 * 1000;
  const REFRESH_NEWS_MS    = 5 * 60 * 1000;
  const COUNTDOWN_TICK_MS  = 1000;
  const THE_GAME_DATE      = new Date("2026-11-28T17:00:00Z");
  const LAST_TTUN_WIN      = new Date(2024, 10, 30);
  const YOUTUBE_VIDEO_ID   = "jGFInR31u3E";

  const LEAF_URL   = "https://raw.githubusercontent.com/laynoshop/the-shop/main/buckeye-leaf.png";
  const BLOCK_O    = "https://raw.githubusercontent.com/laynoshop/the-shop/main/buckeye-O.png";

  // Marysville, OH coords for weather
  const WEATHER_LAT = 40.2365;
  const WEATHER_LON = -83.3671;

  // Shop Teams — the crews teams, matched against ESPN display/short/location names
  const SHOP_TEAMS = [
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
  const SHOP_TEAMS_NORM = SHOP_TEAMS.map(s => s.trim().toLowerCase().replace(/\s+/g, " "));

  // Leagues that support playoff series tracking
  const PLAYOFF_LEAGUES = new Set(["nhl", "nba", "nfl", "mlb"]);

  // Per-league lookahead windows for Shop Teams (days ahead to search when no game today)
  const LOOKAHEAD_DAYS = {
    cfb:   6,
    nfl:   6,
    nhl:   3,
    nba:   3,
    mlb:   3,
    ncaam: 3,
    mls:   3,
    pga:   0,
    ufc:   3,
  };

  const LEAGUES = [
    { key: "cfb",   label: "🏈 CFB",    url: d => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${d}&limit=50` },
    { key: "nfl",   label: "🏈 NFL",    url: d => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${d}&limit=50` },
    { key: "nba",   label: "🏀 NBA",    url: d => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}&limit=50` },
    { key: "mlb",   label: "⚾ MLB",    url: d => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${d}&limit=50` },
    { key: "nhl",   label: "🏒 NHL",    url: d => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${d}&limit=50` },
    { key: "ncaam", label: "🏀 NCAAB",  url: d => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${d}&groups=50&limit=100` },
    { key: "mls",   label: "⚽ MLS",    url: d => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${d}&limit=50` },
    { key: "pga",   label: "⛳ PGA",    url: d => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${d}&limit=50` },
    { key: "ufc",   label: "🥊 UFC",    url: d => `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${d}&limit=50` },
  ];

  const SUMMARY_URLS = {
    cfb:   id => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${id}`,
    nfl:   id => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${id}`,
    nba:   id => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${id}`,
    mlb:   id => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${id}`,
    nhl:   id => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${id}`,
    ncaam: id => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${id}`,
    mls:   id => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/summary?event=${id}`,
    pga:   id => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/summary?event=${id}`,
    ufc:   id => `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/summary?event=${id}`,
  };

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

  let _intervals    = [];
  let _activeLeague = "shop";
  let _rightPanel   = "youtube";

  // ----------------------------------------------------------------
  // Guard
  // ----------------------------------------------------------------
  function isAdmin() {
    return typeof window.getRole === "function" && window.getRole() === "admin";
  }

  // ----------------------------------------------------------------
  // Launch
  // ----------------------------------------------------------------
  function launchPiScoreboard() {
    if (!isAdmin()) return;
    const entry   = document.getElementById("entry");
    const overlay = document.getElementById("piScoreboard");
    if (!overlay) return;
    if (entry) entry.style.display = "none";
    overlay.innerHTML = "";
    overlay.style.cssText = "display:block;position:fixed;inset:0;z-index:9999;overflow:hidden;";
    overlay.innerHTML = buildShell();
    overlay.querySelector("#piCloseBtn").addEventListener("click", exitPiScoreboard);
    document.addEventListener("keydown", _handleEsc);
    _bindLeagueButtons();
    _bindRightToggle();
    _startCountdown();
    _renderScores();
    _intervals.push(setInterval(_renderScores, REFRESH_SCORES_MS));
    _loadRightPanel();
    _intervals.push(setInterval(_loadRightPanel, REFRESH_NEWS_MS));
    _loadWeather();
    _intervals.push(setInterval(_loadWeather, 10 * 60 * 1000));
  }
  window.launchPiScoreboard = launchPiScoreboard;

  // ----------------------------------------------------------------
  // Exit
  // ----------------------------------------------------------------
  function exitPiScoreboard() {
    _intervals.forEach(id => clearInterval(id));
    _intervals = [];
    document.removeEventListener("keydown", _handleEsc);
    if (window._puttPuttUnsub) { window._puttPuttUnsub(); window._puttPuttUnsub = null; }
    const overlay = document.getElementById("piScoreboard");
    if (overlay) { overlay.style.display = "none"; overlay.innerHTML = ""; }
    if (typeof window.showEntryScreen === "function") window.showEntryScreen();
  }
  window.exitPiScoreboard = exitPiScoreboard;

  function _handleEsc(e) { if (e.key === "Escape") exitPiScoreboard(); }

  // ----------------------------------------------------------------
  // Weather
  // ----------------------------------------------------------------
  async function _loadWeather() {
    const el = document.getElementById("piWeatherWidget");
    if (!el) return;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&windspeed_unit=mph&forecast_days=1&timezone=America%2FNew_York`;
      const data = await fetch(url).then(r => r.ok ? r.json() : Promise.reject());
      const cur  = data?.current || {};
      const day  = data?.daily   || {};
      const temp    = Math.round(cur.temperature_2m ?? 0);
      const feels   = Math.round(cur.apparent_temperature ?? temp);
      const wind    = Math.round(cur.windspeed_10m ?? 0);
      const code    = Number(cur.weathercode ?? 0);
      const hiTemp  = Math.round((day.temperature_2m_max || [])[0] ?? temp);
      const loTemp  = Math.round((day.temperature_2m_min || [])[0] ?? temp);
      const { emoji, label, bg } = _weatherInfo(code, new Date().getHours());
      el.innerHTML = `
        <div class="piWeatherInner" style="background:${bg};">
          <div class="piWeatherEmoji">${emoji}</div>
          <div class="piWeatherData">
            <div class="piWeatherTemp">${temp}°<span class="piWeatherFeels">Feels ${feels}°</span></div>
            <div class="piWeatherLabel">${label}</div>
            <div class="piWeatherMeta">Hi ${hiTemp}° · Lo ${loTemp}° · 💨 ${wind} mph</div>
          </div>
        </div>`;
    } catch {
      el.innerHTML = `<div class="piWeatherInner"><div class="piWeatherEmoji">🌡️</div><div class="piWeatherData"><div class="piWeatherTemp">--°</div><div class="piWeatherLabel">Weather unavailable</div></div></div>`;
    }
  }

  function _weatherInfo(code, hour) {
    const isNight = hour < 6 || hour >= 20;
    // WMO weather codes → emoji + label + subtle bg tint
    if (code === 0)                      return { emoji: isNight ? "🌙" : "☀️",  label: isNight ? "Clear Night"    : "Sunny",           bg: isNight ? "rgba(20,10,50,0.45)" : "rgba(255,180,0,0.12)" };
    if (code === 1)                      return { emoji: isNight ? "🌙" : "🌤️",  label: "Mainly Clear",                                  bg: "rgba(255,180,0,0.09)" };
    if (code === 2)                      return { emoji: "⛅",                    label: "Partly Cloudy",                                 bg: "rgba(180,180,180,0.1)" };
    if (code === 3)                      return { emoji: "☁️",                    label: "Overcast",                                      bg: "rgba(120,120,120,0.12)" };
    if (code >= 45 && code <= 48)        return { emoji: "🌫️",                   label: "Foggy",                                         bg: "rgba(160,160,160,0.15)" };
    if (code >= 51 && code <= 57)        return { emoji: "🌦️",                   label: "Drizzle",                                       bg: "rgba(80,120,200,0.12)" };
    if (code >= 61 && code <= 67)        return { emoji: "🌧️",                   label: code >= 65 ? "Heavy Rain"    : "Rain",           bg: "rgba(40,80,180,0.15)" };
    if (code >= 71 && code <= 77)        return { emoji: "❄️",                   label: code >= 75 ? "Heavy Snow"    : "Snow",           bg: "rgba(180,220,255,0.12)" };
    if (code >= 80 && code <= 82)        return { emoji: "🌦️",                   label: code === 82 ? "Heavy Showers" : "Rain Showers",  bg: "rgba(40,80,180,0.15)" };
    if (code >= 85 && code <= 86)        return { emoji: "🌨️",                   label: "Snow Showers",                                  bg: "rgba(180,220,255,0.12)" };
    if (code >= 95 && code <= 99)        return { emoji: "⛈️",                   label: "Thunderstorm",                                  bg: "rgba(80,0,120,0.18)" };
    return { emoji: "🌡️", label: "Unknown", bg: "rgba(0,0,0,0.1)" };
  }

  // ----------------------------------------------------------------
  // Shell HTML
  // ----------------------------------------------------------------
  function buildShell() {
    const leagueBtns = [
      `<button class="piLeagueBtn piShopTeamsBtn${_activeLeague === "shop" ? " active" : ""}" data-league="shop">Shop Teams</button>`,
      ...LEAGUES.map(l =>
        `<button class="piLeagueBtn${l.key === _activeLeague ? " active" : ""}" data-league="${l.key}">${l.label}</button>`
      ),
      `<button class="piLeagueBtn piPuttPuttBtn${_activeLeague === "puttputt" ? " active" : ""}" data-league="puttputt">⛳ Clubhouse</button>`,
    ].join("");

    const days = _daysSince(LAST_TTUN_WIN);
    const leaf  = `<img src="${LEAF_URL}" class="piLeafSep" alt="leaf" />`;

    return `
<style>
  #piWrap {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    grid-template-columns: 1fr 630px;
    height: 100vh;
    height: 100dvh;
    background: #0d0000;
    color: #f0e8e8;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
    position: relative;
  }
  #piWrap::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 20% 110%, rgba(200,30,0,0.55) 0%, transparent 55%),
      radial-gradient(ellipse at 80% 110%, rgba(180,60,0,0.45) 0%, transparent 55%),
      radial-gradient(ellipse at 50% 120%, rgba(255,100,0,0.3) 0%, transparent 50%),
      linear-gradient(to top, #1a0000 0%, #0d0000 40%, #080000 100%);
    pointer-events: none;
    z-index: 0;
  }
  #piWrap > * { position: relative; z-index: 1; }

  /* ---- Header ---- */
  #piHeader {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 18px;
    background: linear-gradient(90deg, #8b0000 0%, #bb0000 40%, #8b0000 100%);
    border-bottom: 2px solid #cc0000;
    box-shadow: 0 2px 16px rgba(200,0,0,0.5);
    gap: 16px;
  }
  #piHeaderLeft { display: flex; align-items: center; gap: 12px; }
  #piHeaderLeft img { height: 44px; width: 44px; object-fit: contain; filter: drop-shadow(0 0 6px rgba(255,200,0,0.6)); }
  #piHeaderTitle {
    font-size: clamp(1rem, 2.5vw, 1.7rem);
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #fff;
    text-shadow: 0 0 12px rgba(255,180,0,0.5), 2px 2px 4px rgba(0,0,0,0.8);
    line-height: 1;
  }
  #piHeaderTitle span {
    display: block;
    font-size: 0.45em;
    font-weight: 600;
    letter-spacing: 0.12em;
    color: #ffddaa;
    text-shadow: none;
    margin-top: 2px;
  }

  /* ---- Countdown — sexied up ---- */
  #piCountdown {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,150,0,0.3);
    border-radius: 12px;
    padding: 6px 14px;
    box-shadow: 0 0 18px rgba(255,100,0,0.2), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .piCdLabel {
    font-size: clamp(0.85rem, 1.6vw, 1.15rem);
    color: #ffddaa;
    font-weight: 800;
    letter-spacing: 0.06em;
    margin-right: 4px;
    white-space: nowrap;
    text-shadow: 0 0 8px rgba(255,160,0,0.5);
    text-transform: uppercase;
  }
  .piCdBlock { text-align: center; min-width: 48px; }
  .piCdNum {
    display: block;
    font-size: clamp(1.4rem, 3vw, 2.2rem);
    font-weight: 900;
    color: #fff;
    line-height: 1;
    text-shadow: 0 0 14px rgba(255,120,0,0.8), 0 0 30px rgba(255,80,0,0.4);
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .piCdSub {
    display: block;
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    color: #ff9966;
    text-transform: uppercase;
    margin-top: 1px;
  }
  .piCdColon {
    font-size: clamp(1.3rem, 2.5vw, 2rem);
    color: #ff7733;
    align-self: flex-start;
    margin-top: 2px;
    padding: 0 2px;
    text-shadow: 0 0 10px rgba(255,100,0,0.7);
    animation: piColonBlink 1s step-start infinite;
  }
  @keyframes piColonBlink { 0%,49%{ opacity:1; } 50%,100%{ opacity:0.3; } }

  /* ---- Weather widget ---- */
  #piWeatherWidget {
    flex-shrink: 0;
    min-width: 160px;
  }
  .piWeatherInner {
    display: flex;
    align-items: center;
    gap: 8px;
    border-radius: 10px;
    padding: 6px 12px;
    border: 1px solid rgba(255,255,255,0.12);
    backdrop-filter: blur(4px);
  }
  .piWeatherEmoji { font-size: 2.2rem; line-height: 1; }
  .piWeatherData { display: flex; flex-direction: column; gap: 1px; }
  .piWeatherTemp {
    font-size: clamp(1.1rem, 2vw, 1.5rem);
    font-weight: 900;
    color: #fff;
    text-shadow: 0 0 8px rgba(255,200,100,0.5);
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .piWeatherFeels { font-size: 0.7em; color: #ffddaa; font-weight: 600; }
  .piWeatherLabel { font-size: clamp(0.72rem, 1.2vw, 0.9rem); font-weight: 700; color: #ffeedd; letter-spacing: 0.04em; }
  .piWeatherMeta  { font-size: clamp(0.62rem, 1vw, 0.75rem); color: #cc9977; letter-spacing: 0.03em; }

  /* ---- Header right cluster ---- */
  #piHeaderRight { display: flex; align-items: center; gap: 12px; }
  #piCloseBtn {
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  #piCloseBtn:hover { background: rgba(0,0,0,0.6); }

  /* ---- League bar ---- */
  #piLeagueBar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 18px;
    background: rgba(0,0,0,0.55);
    border-bottom: 1px solid rgba(180,0,0,0.3);
    overflow-x: auto;
    scrollbar-width: none;
  }
  #piLeagueBar::-webkit-scrollbar { display: none; }
  .piLeagueBtn {
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    color: #ccc;
    border-radius: 20px;
    padding: 6px 20px;
    font-size: clamp(0.9rem, 1.6vw, 1.2rem);
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.05em;
    white-space: nowrap;
    transition: all 0.18s;
    flex-shrink: 0;
  }
  .piLeagueBtn:hover { background: rgba(180,0,0,0.4); color: #fff; border-color: rgba(200,0,0,0.6); }
  .piLeagueBtn.active { background: linear-gradient(135deg, #bb0000, #880000); color: #fff; border-color: #cc0000; box-shadow: 0 0 10px rgba(200,0,0,0.5); }
  .piShopTeamsBtn.active { background: linear-gradient(135deg, #a07800, #7a5500); border-color: #c89a00; box-shadow: 0 0 10px rgba(200,160,0,0.5); }

  /* ---- Scores panel — 2-column grid ---- */
  #piScoresPanel {
    overflow-y: auto;
    padding: 12px 14px;
    border-right: 1px solid rgba(180,0,0,0.2);
    scrollbar-width: thin;
    scrollbar-color: #330000 #0d0000;
  }
  #piScoresPanel::-webkit-scrollbar { width: 4px; }
  #piScoresPanel::-webkit-scrollbar-track { background: #0d0000; }
  #piScoresPanel::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }
  #piScoresContent {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: start;
  }
  /* Panel head spans full width */
  .piPanelHeadWrapper { grid-column: 1 / -1; }

  /* ---- Right panel ---- */
  #piRightPanel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid rgba(180,0,0,0.2);
  }
  #piRightToggleBar {
    display: flex;
    gap: 0;
    background: rgba(0,0,0,0.5);
    border-bottom: 1px solid rgba(180,0,0,0.25);
    flex-shrink: 0;
  }
  .piRightToggleBtn {
    flex: 1;
    background: transparent;
    border: none;
    color: #999;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 7px 8px;
    cursor: pointer;
    transition: all 0.18s;
    text-transform: uppercase;
    border-bottom: 2px solid transparent;
  }
  .piRightToggleBtn:hover { color: #fff; background: rgba(180,0,0,0.25); }
  .piRightToggleBtn.active { color: #ff4444; border-bottom-color: #cc0000; background: rgba(180,0,0,0.15); }

  /* Right panel content area — YouTube only in top portion */
  #piRightContent {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
    position: relative;
  }
  #piYoutubeSlot {
    flex-shrink: 0;
    width: 100%;
    /* ~45% of right panel height = top portion only */
    height: 42%;
    position: relative;
    background: #000;
  }
  #piYoutubeSlot iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }
  #piRightBottom {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #330000 #0d0000;
  }
  #piRightBottom::-webkit-scrollbar { width: 4px; }
  #piRightBottom::-webkit-scrollbar-track { background: #0d0000; }
  #piRightBottom::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }

  /* Top 25 list */
  #piTop25List { padding: 10px 12px; }
  .piRankHead { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #bb0000; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid rgba(180,0,0,0.3); }
  .piRankRow { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 5px; margin-bottom: 3px; background: rgba(255,255,255,0.03); }
  .piRankRow:nth-child(odd) { background: rgba(255,255,255,0.05); }
  .piRankNum  { min-width: 22px; font-size: 1rem; font-weight: 900; color: #cc0000; text-align: right; }
  .piRankTeam { flex: 1; font-size: 0.95rem; font-weight: 600; color: #e8e8e8; }
  .piRankRecord { font-size: 0.82rem; color: #777; }

  .piPanelHead {
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #cc0000;
    margin-bottom: 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(180,0,0,0.3);
    text-shadow: 0 0 6px rgba(200,0,0,0.4);
  }
  .piPanelHead.gold { color: #c8a000; border-bottom-color: rgba(200,160,0,0.3); text-shadow: 0 0 6px rgba(200,160,0,0.35); }

  /* ---- Rich score cards — BIG fonts for TV ---- */
  .piShopCard {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 14px;
    margin-bottom: 0;
    background: rgba(255,255,255,0.04);
    border-radius: 9px;
    border-left: 4px solid #555;
    pointer-events: none;
  }
  .piShopCard.live    { border-left-color: #cc0000; background: rgba(180,0,0,0.09); }
  .piShopCard.final   { border-left-color: #444; }
  .piShopCard.sched   { border-left-color: rgba(0,140,0,0.7); }
  .piShopCard.upcoming { border-left-color: rgba(0,100,200,0.7); background: rgba(0,60,120,0.07); }

  .piShopCardTop { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .piShopLeagueBadge {
    font-size: 0.9rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 10px;
    color: #fff;
    flex-shrink: 0;
  }
  .piShopStatusLabel { font-size: 1rem; font-weight: 700; color: #999; text-align: right; white-space: nowrap; }
  .piShopStatusLabel.live     { color: #ff4444; }
  .piShopStatusLabel.upcoming { color: #4499ff; }

  .piShopTeamsRow { display: flex; flex-direction: column; gap: 4px; }
  .piShopTeamLine { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .piShopTeamLineLeft { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .piShopTeamLogo { width: 30px; height: 30px; object-fit: contain; flex-shrink: 0; border-radius: 3px; }
  .piShopTeamNameFull {
    font-size: clamp(1.25rem, 2.2vw, 1.65rem);
    font-weight: 800;
    color: #eee;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .piShopTeamNameFull.fav { color: #ffcc66; }
  .piShopTeamRecord { font-size: 0.85rem; color: #666; white-space: nowrap; flex-shrink: 0; }
  .piShopTeamScore {
    font-size: clamp(1.6rem, 3vw, 2.4rem);
    font-weight: 900;
    color: #fff;
    min-width: 42px;
    text-align: right;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 8px rgba(255,200,0,0.3);
  }

  /* Playoff series badge */
  .piSeriesLine { display: flex; align-items: center; gap: 6px; margin-top: 2px; padding: 2px 4px; }
  .piSeriesBadge {
    font-size: 0.88rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #ffcc44;
    background: rgba(200,160,0,0.15);
    border: 1px solid rgba(200,160,0,0.3);
    border-radius: 4px;
    padding: 2px 8px;
    white-space: nowrap;
  }
  .piSeriesBadge.tied { color: #aaa; background: rgba(180,180,180,0.1); border-color: rgba(180,180,180,0.2); }

  .piShopMeta { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 2px; }
  .piShopMetaItem { font-size: 0.8rem; color: #666; white-space: nowrap; }
  .piShopMetaItem.odds  { color: #aaa; font-weight: 600; }
  .piShopMetaItem.venue { color: #666; }

  /* ---- Bottom banner ---- */
  #piBanner {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 7px 20px;
    background: linear-gradient(90deg, rgba(100,0,0,0.9) 0%, rgba(30,0,0,0.95) 50%, rgba(100,0,0,0.9) 100%);
    border-top: 1px solid rgba(180,0,0,0.5);
    box-shadow: 0 -2px 12px rgba(180,0,0,0.3);
    flex-wrap: wrap;
    row-gap: 3px;
  }
  .piBannerChunk { font-size: clamp(0.82rem, 1.4vw, 1rem); font-weight: 600; color: #f0e0e0; letter-spacing: 0.02em; white-space: nowrap; }
  .piBannerChunk strong { color: #ff6644; }
  .piLeafSep { height: 18px; width: auto; object-fit: contain; filter: drop-shadow(0 0 3px rgba(200,50,0,0.6)); flex-shrink: 0; }
  .piNoGames { color: #444; font-size: 1rem; text-align: center; padding: 24px 0; grid-column: 1 / -1; }

  /* ---- Putt Putt pill ---- */
  .piPuttPuttBtn { background: rgba(0,160,80,0.18); border-color: rgba(0,200,100,0.35); color: #7dffb3; }
  .piPuttPuttBtn:hover { background: rgba(0,160,80,0.45); color: #fff; border-color: rgba(0,220,120,0.7); }
  .piPuttPuttBtn.active { background: linear-gradient(135deg, #007a3a, #005528); color: #fff; border-color: #00cc66; box-shadow: 0 0 12px rgba(0,200,80,0.55); }

  /* ---- Pi Putt Putt Scorecard (in scores panel) ---- */
  .piPuttWrap { grid-column: 1 / -1; padding: 4px 0; }
  .piPuttHeader { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .piPuttCourseName { font-size: clamp(1.4rem, 2.5vw, 1.9rem); font-weight: 900; color: #fff; text-shadow: 0 0 8px rgba(0,200,80,0.4); }
  .piPuttStatus { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 12px; border-radius: 12px; }
  .piPuttStatus.live { background: rgba(200,0,0,0.4); color: #ff6644; border: 1px solid rgba(220,0,0,0.5); }
  .piPuttStatus.final { background: rgba(0,120,50,0.35); color: #7dffb3; border: 1px solid rgba(0,180,80,0.4); }
  .piPuttScTableWrap { overflow-x: auto; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,160,60,0.2); }
  .piPuttScorecard { width: 100%; border-collapse: collapse; }
  .piPuttScorecard th, .piPuttScorecard td { text-align: center; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: clamp(1.2rem, 2.1vw, 1.65rem); font-variant-numeric: tabular-nums; }
  .piPuttScorecard thead th { font-size: clamp(1rem, 1.5vw, 1.25rem); font-weight: 800; letter-spacing: 0.08em; color: #aaa; background: rgba(0,0,0,0.25); border-bottom: 2px solid rgba(0,160,60,0.3); }
  .piPuttScorecard .piPuttNameCol { text-align: left; padding-left: 14px; font-weight: 800; font-size: clamp(1.25rem, 2.2vw, 1.6rem); color: #f0f0f0; min-width: 100px; }
  .piPuttScorecard .piPuttParRow td { color: #888; font-size: clamp(1rem, 1.5vw, 1.25rem); background: rgba(0,0,0,0.15); font-weight: 600; }
  .piPuttScorecard .piPuttParRow td:first-child { text-align: left; padding-left: 14px; }
  .piPuttScorecard .piPuttTotalCol { font-weight: 900; font-size: clamp(1.25rem, 2.2vw, 1.65rem); }
  .piPuttScorecard .pi-sc-under { color: #4fffaa; font-weight: 800; text-shadow: 0 0 8px rgba(0,255,150,0.4); }
  .piPuttScorecard .pi-sc-over  { color: #ff7766; font-weight: 800; }
  .piPuttScorecard .pi-sc-even  { color: #fff; font-weight: 700; }
  .piPuttScorecard .pi-sc-empty { color: #444; }
  .piPuttScorecard tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
  .piPuttScorecard tbody tr:hover { background: rgba(0,160,60,0.07); }
  .piPuttLeader { margin-top: 10px; padding: 10px 16px; background: rgba(0,120,50,0.25); border: 1px solid rgba(0,200,80,0.3); border-radius: 8px; font-size: clamp(0.95rem, 1.6vw, 1.2rem); font-weight: 800; color: #7dffb3; text-align: center; letter-spacing: 0.04em; text-shadow: 0 0 8px rgba(0,255,140,0.3); }
  .piPuttNoRound { grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: #555; font-size: 1rem; }
</style>

<div id="piWrap">
  <div id="piHeader">
    <div id="piHeaderLeft">
      <img src="${BLOCK_O}" alt="Block O" />
      <div id="piHeaderTitle">
        The Shop Scoreboard
        <span>Scarlet &amp; Gray &bull; Game Day HQ</span>
      </div>
    </div>
    <div id="piCountdown">
      <span class="piCdLabel">🏈 The Game:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdD">--</span><span class="piCdSub">days</span></div>
      <span class="piCdColon">:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdH">--</span><span class="piCdSub">hrs</span></div>
      <span class="piCdColon">:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdM">--</span><span class="piCdSub">min</span></div>
      <span class="piCdColon">:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdS">--</span><span class="piCdSub">sec</span></div>
    </div>
    <div id="piHeaderRight">
      <div id="piWeatherWidget"><div class="piWeatherInner"><div class="piWeatherEmoji">🌡️</div><div class="piWeatherData"><div class="piWeatherTemp">--°</div><div class="piWeatherLabel">Loading weather…</div></div></div></div>
      <button id="piCloseBtn" type="button">&#x2715; Exit</button>
    </div>
  </div>

  <div id="piLeagueBar">${leagueBtns}</div>

  <div id="piScoresPanel">
    <div class="piPanelHeadWrapper">
      <div class="piPanelHead gold" id="piPanelHeadLabel">Shop Teams</div>
    </div>
    <div id="piScoresContent"><div class="piNoGames">Loading&hellip;</div></div>
  </div>

  <div id="piRightPanel">
    <div id="piRightToggleBar">
      <button class="piRightToggleBtn active" data-panel="youtube" type="button">&#x25B6; Natty Replay</button>
      <button class="piRightToggleBtn" data-panel="top25" type="button">&#x1F3C6; CFB Top 25</button>
    </div>
    <div id="piRightContent">
      <div id="piYoutubeSlot"></div>
      <div id="piRightBottom"></div>
    </div>
  </div>

  <div id="piBanner">
    <span class="piBannerChunk">Our honor defend, so we'll fight to the end for <strong>Ohio</strong></span>
    ${leaf}
    <span class="piBannerChunk"><strong>TTUN Sucks</strong> and Are Cheating Bastards</span>
    ${leaf}
    <span class="piBannerChunk" id="piBannerDays">${days} days since TTUN has won in The Game</span>
  </div>
</div>
`;
  }

  // ----------------------------------------------------------------
  // League button binding
  // ----------------------------------------------------------------
  function _bindLeagueButtons() {
    document.querySelectorAll(".piLeagueBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        _activeLeague = btn.getAttribute("data-league");
        document.querySelectorAll(".piLeagueBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const head = document.getElementById("piPanelHeadLabel");
        if (head) {
          head.style.color = "";
          head.style.borderBottomColor = "";
          head.style.textShadow = "";
          if (_activeLeague === "shop") {
            head.textContent = "Shop Teams";
            head.classList.add("gold");
          } else if (_activeLeague === "puttputt") {
            head.textContent = "⛳ Putt Putt Scorecard";
            head.classList.remove("gold");
            head.style.color = "#00cc66";
            head.style.borderBottomColor = "rgba(0,180,80,0.4)";
            head.style.textShadow = "0 0 6px rgba(0,200,80,0.4)";
          } else {
            const league = LEAGUES.find(l => l.key === _activeLeague);
            head.textContent = league ? league.label + " Scores" : "Scores";
            head.classList.remove("gold");
          }
        }
        _renderScores();
      });
    });
  }

  // ----------------------------------------------------------------
  // Right panel
  // ----------------------------------------------------------------
  function _bindRightToggle() {
    document.querySelectorAll(".piRightToggleBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        _rightPanel = btn.getAttribute("data-panel");
        document.querySelectorAll(".piRightToggleBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        _loadRightPanel();
      });
    });
  }

  function _loadRightPanel() {
    const youtubeSlot = document.getElementById("piYoutubeSlot");
    const bottomSlot  = document.getElementById("piRightBottom");
    if (!youtubeSlot || !bottomSlot) return;

    if (_rightPanel === "youtube") {
      // YouTube in top slot only — only inject if iframe isn't already there
      // (prevents the 5-min news refresh timer from restarting the video)
      youtubeSlot.style.display = "block";
      if (!youtubeSlot.querySelector("iframe")) {
        youtubeSlot.innerHTML = `<iframe
          src="https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=0&modestbranding=1&rel=0"
          allow="autoplay; encrypted-media" allowfullscreen title="OSU Natty Replay"></iframe>`;
      }
      bottomSlot.innerHTML = ""; // empty space — will circle back
    } else {
      // Top 25 fills the whole right content area
      youtubeSlot.style.display = "none";
      bottomSlot.innerHTML = "";
      _renderTop25(bottomSlot);
    }
  }

  // ----------------------------------------------------------------
  // Top 25
  // ----------------------------------------------------------------
  function _renderTop25(el) {
    el.innerHTML = `<div id="piTop25List"><div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.95rem;padding:16px 0;">Loading rankings&hellip;</div></div>`;
    fetch("https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const ap    = (data?.rankings || []).find(p => String(p?.name || "").toLowerCase().includes("ap")) || (data?.rankings || [])[0];
        const ranks = ap?.ranks || [];
        const list  = el.querySelector("#piTop25List") || el;
        if (!ranks.length) { list.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.95rem;">Rankings not available.</div>`; return; }
        list.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div>` +
          ranks.map(r => {
            const name = _applyTTUN(String(r?.team?.name || r?.team?.displayName || "Unknown"));
            return `<div class="piRankRow"><span class="piRankNum">${r.current}</span><span class="piRankTeam">${_esc(name)}</span><span class="piRankRecord">${_esc(String(r?.recordSummary || ""))}</span></div>`;
          }).join("");
      })
      .catch(() => { el.innerHTML = `<div id="piTop25List"><div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.95rem;">Rankings unavailable.</div></div>`; });
  }

  // ----------------------------------------------------------------
  // Countdown
  // ----------------------------------------------------------------
  function _startCountdown() {
    function tick() {
      const diff = THE_GAME_DATE.getTime() - Date.now();
      const d = document.getElementById("piCdD");
      if (!d) return;
      if (diff <= 0) { d.textContent = "0"; ["piCdH","piCdM","piCdS"].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = "00"; }); return; }
      const tot  = Math.floor(diff / 1000);
      const days = Math.floor(tot / 86400);
      const hrs  = Math.floor((tot % 86400) / 3600);
      const mins = Math.floor((tot % 3600) / 60);
      const secs = tot % 60;
      d.textContent = String(days);
      const h = document.getElementById("piCdH"); if (h) h.textContent = String(hrs).padStart(2,"0");
      const m = document.getElementById("piCdM"); if (m) m.textContent = String(mins).padStart(2,"0");
      const s = document.getElementById("piCdS"); if (s) s.textContent = String(secs).padStart(2,"0");
    }
    tick();
    _intervals.push(setInterval(tick, COUNTDOWN_TICK_MS));
  }

  // ----------------------------------------------------------------
  // Scores dispatcher
  // ----------------------------------------------------------------
  function _renderScores() {
    if (_activeLeague === "shop")     _renderShopTeams();
    else if (_activeLeague === "pga") _renderPGA();
    else if (_activeLeague === "puttputt") _renderPuttPutt();
    else _renderLeagueScores();
  }

  // ----------------------------------------------------------------
  // Putt Putt — real-time Firebase listener
  // ----------------------------------------------------------------
  async function _renderPuttPutt() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading Putt Putt round…</div>`;

    // Update panel head
    const head = document.getElementById("piPanelHeadLabel");
    if (head) { head.textContent = "⛳ Putt Putt Scorecard"; head.classList.remove("gold"); head.style.color = "#00cc66"; head.style.borderBottomColor = "rgba(0,180,80,0.4)"; head.style.textShadow = "0 0 6px rgba(0,200,80,0.4)"; }

    const db = window.firebase && firebase.apps && firebase.apps.length ? firebase.firestore() : null;
    if (!db) { el.innerHTML = `<div class="piPuttNoRound">Firebase not available — open the Shop App to start a round.</div>`; return; }

    // Wait up to 6s for Firebase auth to be ready before attaching listener
    await new Promise((resolve) => {
      if (!window.firebase || !firebase.auth) { resolve(); return; }
      const unsub = firebase.auth().onAuthStateChanged(user => { unsub(); resolve(user); });
      setTimeout(resolve, 6000);
    });

    // Real-time listener — updates scorecard automatically as holes are scored on the phone
    if (window._puttPuttUnsub) { window._puttPuttUnsub(); window._puttPuttUnsub = null; }
    window._puttPuttUnsub = db.collection("putt_rounds")
      .orderBy("startedAt", "desc")
      .limit(1)
      .onSnapshot(snap => {
        if (snap.empty) { el.innerHTML = `<div class="piPuttNoRound">No rounds found. Start one in the Shop App!</div>`; return; }
        const round = { id: snap.docs[0].id, ...snap.docs[0].data() };
        el.innerHTML = `<div class="piPuttWrap">${_buildPiPuttScorecardHTML(round)}</div>`;
      }, err => {
        el.innerHTML = `<div class="piPuttNoRound">Could not load round data.</div>`;
      });
  }

  function _buildPiPuttScorecardHTML(round) {
    const pars     = round.holePars || [];
    const players  = round.players  || [];
    const totalPar = pars.reduce((a,b) => a+b, 0);
    const isLive   = round.status !== "complete";

    function totalVsPar(holes) {
      let diff = 0, played = 0;
      holes.forEach((s,i) => { if (typeof s === "number" && s > 0) { diff += s - (pars[i] || 0); played++; } });
      return { diff, played };
    }

    function vpLabel(diff) {
      if (diff === 0) return { text: "E", cls: "pi-sc-even" };
      if (diff < 0)   return { text: String(diff), cls: "pi-sc-under" };
      return { text: "+" + diff, cls: "pi-sc-over" };
    }

    // Sort players by current score (leader first)
    const ranked = players.map(p => {
      const holes = Array.isArray(round.scores?.[p]?.holes)
  ? round.scores[p].holes
  : Object.values(round.scores?.[p]?.holes || {});
      const { diff, played } = totalVsPar(holes);
      return { p, holes, diff, played };
    }).sort((a,b) => a.diff - b.diff);

    const holeCells = pars.map((_,i) => `<th>${i+1}</th>`).join("");
    const parCells  = pars.map(p => `<td>${p}</td>`).join("");

    const playerRows = ranked.map(({ p, holes, diff, played }) => {
      const vp = played > 0 ? vpLabel(diff) : { text: "—", cls: "" };
      const cells = pars.map((_,i) => {
        const s = holes[i];
        if (s == null) return `<td class="pi-sc-empty">·</td>`;
        const d = s - pars[i];
        const cls = d < 0 ? "pi-sc-under" : d > 0 ? "pi-sc-over" : "pi-sc-even";
        return `<td class="${cls}">${s}</td>`;
      }).join("");
      return `<tr><td class="piPuttNameCol piPuttScorecard">${_esc(p)}</td>${cells}<td class="piPuttTotalCol ${vp.cls}">${vp.text}</td></tr>`;
    }).join("");

    // Leader line
    const leader = ranked[0];
    let leaderText = "";
    if (leader && leader.played > 0) {
      const vp = vpLabel(leader.diff);
      leaderText = isLive
        ? `🏌️ Leading: ${_esc(leader.p)} (${vp.text}) · Hole ${round.currentHole + 1} of ${pars.length}`
        : `🏆 Winner: ${_esc(leader.p)} (${vp.text})`;
    }

    return `
      <div class="piPuttHeader">
        <span style="font-size:1.8rem;">⛳</span>
        <span class="piPuttCourseName">${_esc(round.courseName || "Putt Putt")}</span>
        <span class="piPuttStatus ${isLive ? "live" : "final"}">${isLive ? "LIVE" : "FINAL"}</span>
      </div>
      <div class="piPuttScTableWrap">
        <table class="piPuttScorecard">
          <thead>
            <tr><th class="piPuttNameCol">Player</th>${holeCells}<th>Total</th></tr>
            <tr class="piPuttParRow"><td>Par</td>${parCells}<td>${totalPar}</td></tr>
          </thead>
          <tbody>${playerRows}</tbody>
        </table>
      </div>
      ${leaderText ? `<div class="piPuttLeader">${leaderText}</div>` : ""}
    `;
  }

  // ----------------------------------------------------------------
  // PGA
  // ----------------------------------------------------------------
  async function _renderPGA() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading PGA Tour&hellip;</div>`;

    const now     = new Date();
    const dow     = now.getDay();
    const isPostWeek = dow >= 0 && dow <= 3;
    let queryDate;
    if (isPostWeek) {
      const lastSun = new Date(now);
      lastSun.setDate(now.getDate() - (dow === 0 ? 0 : dow));
      queryDate = _dateStr(lastSun);
    } else {
      queryDate = _todayStr();
    }

    let events = [];
    try {
      const pgaUrl = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${queryDate}&limit=50`;
      const data   = await fetch(pgaUrl).then(r => r.ok ? r.json() : Promise.reject(r.status));
      events = (data?.events || []).filter(_isPGATour);
    } catch {
      el.innerHTML = `<div class="piNoGames">PGA scores unavailable.</div>`;
      return;
    }

    if (!events.length) {
      try {
        const data = await fetch(`https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${_todayStr()}&limit=50`).then(r => r.ok ? r.json() : null);
        if (data) events = (data?.events || []).filter(_isPGATour);
      } catch {}
    }

    if (!events.length) { el.innerHTML = `<div class="piNoGames">No PGA Tour events found.</div>`; return; }

    el.innerHTML = events.map(ev => _buildShopCard("pga", "PGA", ev, null, null)).join("");

    const CONCURRENCY = 4;
    let idx = 0;
    async function worker() {
      while (idx < events.length) {
        const i = idx++;
        const ev = events[i];
        const eventId = String(ev?.id || "");
        if (!eventId) continue;
        try {
          const data = await fetch(SUMMARY_URLS.pga(eventId)).then(r => r.ok ? r.json() : null);
          if (!data) continue;
          const odds = _parseOddsFromSummary(data, ev?.competitions?.[0]);
          if (odds.favored || odds.ou) {
            const card = el.querySelector(`.piShopCard[data-eventid="${eventId}"]`);
            if (card) { const o = card.querySelector(".piShopMetaItem.odds"); if (o) o.textContent = _buildOddsLine(odds.favored, odds.ou); }
          }
        } catch {}
      }
    }
    await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker));
  }

  function _isPGATour(ev) {
    const name = String(ev?.league?.name || ev?.league?.abbreviation || ev?.name || "").toLowerCase();
    if (name.includes("champions") || name.includes("korn ferry") || name.includes("dp world")) return false;
    const slug = String(ev?.league?.slug || "").toLowerCase();
    if (slug && !slug.includes("pga")) return false;
    return true;
  }

  // ----------------------------------------------------------------
  // Standard league scores
  // ----------------------------------------------------------------
  async function _renderLeagueScores() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    const league = LEAGUES.find(l => l.key === _activeLeague) || LEAGUES[0];
    const date   = _todayStr();
    el.innerHTML = `<div class="piNoGames">Loading&hellip;</div>`;

    let events = [];
    try {
      const data = await fetch(league.url(date)).then(r => r.ok ? r.json() : Promise.reject(r.status));
      events = data?.events || [];
    } catch {
      el.innerHTML = `<div class="piNoGames">Scores unavailable.</div>`;
      return;
    }

    if (!events.length) { el.innerHTML = `<div class="piNoGames">No games today.</div>`; return; }

    el.innerHTML = events.map(ev =>
      _buildShopCard(_activeLeague, league.label.replace(/^\S+\s/, ""), ev, null, null)
    ).join("");

    try { if (typeof window.replaceMichiganText === "function") window.replaceMichiganText(el); } catch {}

    if (!SUMMARY_URLS[_activeLeague]) return;
    const CONCURRENCY = 4;
    let idx = 0;
    async function worker() {
      while (idx < events.length) {
        const i = idx++;
        const ev = events[i];
        const eventId = String(ev?.id || "");
        if (!eventId) continue;
        try {
          const data = await fetch(SUMMARY_URLS[_activeLeague](eventId)).then(r => r.ok ? r.json() : null);
          if (!data) continue;
          const odds = _parseOddsFromSummary(data, ev?.competitions?.[0]);
          if (odds.favored || odds.ou) {
            const card = el.querySelector(`.piShopCard[data-eventid="${eventId}"]`);
            if (card) { const o = card.querySelector(".piShopMetaItem.odds"); if (o) o.textContent = _buildOddsLine(odds.favored, odds.ou); }
          }
          if (PLAYOFF_LEAGUES.has(_activeLeague)) {
            const card = el.querySelector(`.piShopCard[data-eventid="${eventId}"]`);
            if (card) {
              const s = card.querySelector(".piSeriesLine");
              if (s && !s.innerHTML.trim()) {
                const series = _parseSeriesFromSummary(data, ev?.competitions?.[0]);
                if (series) s.innerHTML = _buildSeriesHTML(series);
              }
            }
          }
        } catch {}
      }
    }
    await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker));
  }

  // ----------------------------------------------------------------
  // Shop Teams
  // ----------------------------------------------------------------
  async function _renderShopTeams() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading Shop Teams…</div>`;

    const now = new Date();
    const primaryDate = now.getHours() < 9
      ? _dateStr(new Date(now.getTime() - 86400000))
      : _todayStr();

    const results = await Promise.allSettled(
      LEAGUES.map(lg =>
        fetch(lg.url(primaryDate))
          .then(r => r.ok ? r.json() : Promise.reject(r.status))
          .then(data => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: data?.events || [] }))
          .catch(() => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: [] }))
      )
    );

    const matched = [];
    const teamsFound = new Set();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { leagueKey, leagueLabel, events } = result.value;
      for (const ev of events) {
        if (_eventHasShopTeam(ev)) {
          matched.push({ leagueKey, leagueLabel, ev, upcoming: false });
          const comp = (ev?.competitions || [])[0] || {};
          for (const c of (comp?.competitors || [])) {
            if (_isShopTeam(c?.team)) teamsFound.add(_shopTeamKey(c.team));
          }
        }
      }
    }

    const missingTeams = SHOP_TEAMS_NORM.filter(t => !teamsFound.has(t));
    if (missingTeams.length) {
      const lookaheadFetches = [];
      for (const lg of LEAGUES) {
        const days = LOOKAHEAD_DAYS[lg.key] || 0;
        if (!days) continue;
        for (let d = 1; d <= days; d++) {
          const futureDate = _dateStr(new Date(now.getTime() + d * 86400000));
          lookaheadFetches.push(
            fetch(lg.url(futureDate))
              .then(r => r.ok ? r.json() : Promise.reject())
              .then(data => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: data?.events || [], daysAhead: d }))
              .catch(() => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: [], daysAhead: d }))
          );
        }
      }

      const lookaheadResults = await Promise.allSettled(lookaheadFetches);
      const upcomingByTeam = new Map();

      for (const res of lookaheadResults) {
        if (res.status !== "fulfilled") continue;
        const { leagueKey, leagueLabel, events, daysAhead } = res.value;
        for (const ev of events) {
          const comp = (ev?.competitions || [])[0] || {};
          for (const c of (comp?.competitors || [])) {
            if (!_isShopTeam(c?.team)) continue;
            const tKey = _shopTeamKey(c.team);
            if (teamsFound.has(tKey)) continue;
            const existing = upcomingByTeam.get(tKey);
            if (!existing || daysAhead < existing.daysAhead) {
              upcomingByTeam.set(tKey, { leagueKey, leagueLabel, ev, daysAhead });
            }
          }
        }
      }

      const addedEventIds = new Set(matched.map(m => m.ev?.id));
      for (const { leagueKey, leagueLabel, ev, daysAhead } of upcomingByTeam.values()) {
        if (!addedEventIds.has(ev?.id)) {
          matched.push({ leagueKey, leagueLabel, ev, upcoming: true });
          addedEventIds.add(ev?.id);
        }
      }
    }

    if (!matched.length) {
      el.innerHTML = `<div class="piNoGames">No Shop Teams games found. Enjoy the day off.</div>`;
      return;
    }

    matched.sort((a, b) => {
      const sRank = m => {
        if (m.upcoming) return 3;
        const s = _getState(m.ev);
        return s === "in" ? 0 : s === "pre" ? 1 : 2;
      };
      if (sRank(a) !== sRank(b)) return sRank(a) - sRank(b);
      if (a.upcoming && b.upcoming) return new Date(a.ev.date || 0) - new Date(b.ev.date || 0);
      return _shopTeamRank(a.ev) - _shopTeamRank(b.ev);
    });

    el.innerHTML = matched.map(({ leagueKey, leagueLabel, ev, upcoming }) =>
      _buildShopCard(leagueKey, leagueLabel, ev, null, null, upcoming)
    ).join("");

    const CONCURRENCY = 4;
    let idx = 0;
    async function worker() {
      while (idx < matched.length) {
        const i = idx++;
        const { leagueKey, ev } = matched[i];
        const eventId = String(ev?.id || "");
        if (!eventId || !SUMMARY_URLS[leagueKey]) continue;
        try {
          const data = await fetch(SUMMARY_URLS[leagueKey](eventId)).then(r => r.ok ? r.json() : null);
          if (!data) continue;
          const odds = _parseOddsFromSummary(data, ev?.competitions?.[0]);
          if (odds.favored || odds.ou) {
            const card = el.querySelector(`.piShopCard[data-eventid="${eventId}"]`);
            if (card) { const o = card.querySelector(".piShopMetaItem.odds"); if (o) o.textContent = _buildOddsLine(odds.favored, odds.ou); }
          }
          if (PLAYOFF_LEAGUES.has(leagueKey)) {
            const card = el.querySelector(`.piShopCard[data-eventid="${eventId}"]`);
            if (card) {
              const s = card.querySelector(".piSeriesLine");
              if (s && !s.innerHTML.trim()) {
                const series = _parseSeriesFromSummary(data, ev?.competitions?.[0]);
                if (series) s.innerHTML = _buildSeriesHTML(series);
              }
            }
          }
        } catch {}
      }
    }
    await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker));
  }

  // ----------------------------------------------------------------
  // Helpers — team matching
  // ----------------------------------------------------------------
  function _eventHasShopTeam(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    return (comp?.competitors || []).some(c => _isShopTeam(c?.team));
  }

  function _isShopTeam(team) {
    if (!team) return false;
    const displayName = String(team.displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
    const shortName   = String(team.shortDisplayName || "").trim().toLowerCase().replace(/\s+/g, " ");
    const combo       = String((team.location || "") + " " + (team.name || "")).trim().toLowerCase().replace(/\s+/g, " ");
    const name        = String(team.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    return SHOP_TEAMS_NORM.some(t =>
      t === displayName || t === shortName || t === combo || t === name ||
      displayName.includes(t) || t.includes(displayName)
    );
  }

  function _shopTeamKey(team) {
    return String(team?.displayName || team?.shortDisplayName || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function _shopTeamRank(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    let best = Infinity;
    for (const c of (comp?.competitors || [])) {
      const team = c?.team;
      if (!team) continue;
      const displayName = String(team.displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
      const i = SHOP_TEAMS_NORM.findIndex(t => t === displayName || displayName.includes(t) || t.includes(displayName));
      if (i !== -1 && i < best) best = i;
    }
    return best;
  }

  function _getState(ev) {
    return String(ev?.status?.type?.state || "pre");
  }

  // ----------------------------------------------------------------
  // Playoff series parsing — scoreboard competition object (primary)
  // ----------------------------------------------------------------
  function _parseSeriesFromComp(comp, leagueKey) {
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
      const _nameForSeriesComp = (sc) => {
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
      const n0 = _nameForSeriesComp(seriesComps[0]) || "Team A";
      const n1 = _nameForSeriesComp(seriesComps[1]) || "Team B";
      return { name0: _applyTTUN(n0), wins0: w0, name1: _applyTTUN(n1), wins1: w1 };
    } catch { return null; }
  }

  // ----------------------------------------------------------------
  // Playoff series parsing — summary endpoint (fallback)
  // ----------------------------------------------------------------
  function _parseSeriesFromSummary(data, fallbackComp) {
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
      const _nameForSeriesComp = (sc) => {
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
      const n0 = _nameForSeriesComp(seriesComps[0]) || "Team A";
      const n1 = _nameForSeriesComp(seriesComps[1]) || "Team B";
      if (w0 === 0 && w1 === 0) {
        const title = String(series?.title || series?.summary || "");
        if (title) return { seriesSummary: title };
      } else {
        return { name0: _applyTTUN(n0), wins0: w0, name1: _applyTTUN(n1), wins1: w1 };
      }
      const competitors = comp?.competitors || [];
      if (competitors.length >= 2) {
        const s0 = String(competitors[0]?.seriesSummary || "");
        if (s0) return { seriesSummary: s0 };
      }
      return null;
    } catch { return null; }
  }

  function _buildSeriesHTML(series) {
    if (!series) return "";
    if (series.seriesSummary) return `<span class="piSeriesBadge">🏆 ${_esc(series.seriesSummary)}</span>`;
    const { name0, wins0, name1, wins1 } = series;
    if (wins0 === wins1) return `<span class="piSeriesBadge tied">🏆 Series Tied ${wins0}-${wins1}</span>`;
    const leader = wins0 > wins1 ? `${_esc(name0)} leads ${wins0}-${wins1}` : `${_esc(name1)} leads ${wins1}-${wins0}`;
    return `<span class="piSeriesBadge">🏆 ${leader}</span>`;
  }

  // ----------------------------------------------------------------
  // Odds helpers
  // ----------------------------------------------------------------
  function _parseOddsFromSummary(data, fallbackComp) {
    try {
      const comp = data?.header?.competitions?.[0] || data?.competitions?.[0] || fallbackComp || {};
      const odds = comp?.odds?.[0] || comp?.situation?.lastPlay?.probability || null;
      if (!odds) return {};
      const favored = String(odds?.details || odds?.spread || "").trim();
      const ou      = odds?.overUnder != null ? String(odds.overUnder) : "";
      return { favored: favored || null, ou: ou || null };
    } catch { return {}; }
  }

  function _buildOddsLine(favored, ou) {
    const parts = [];
    if (favored) parts.push(favored);
    if (ou)      parts.push(`O/U ${ou}`);
    return parts.join(" · ");
  }

  // ----------------------------------------------------------------
  // Score card builder
  // ----------------------------------------------------------------
  function _buildShopCard(leagueKey, leagueLabel, ev, seriesOverride, oddsOverride, upcoming = false) {
    const comp       = (ev?.competitions || [])[0] || {};
    const competitors = comp?.competitors || [];
    const state      = _getState(ev);
    const statusDetail = String(ev?.status?.type?.detail || ev?.status?.type?.shortDetail || "");
    const statusName   = String(ev?.status?.type?.name || "").toLowerCase();

    let cardClass = "piShopCard";
    let statusClass = "";
    let statusText = "";

    if (upcoming) {
      cardClass += " upcoming";
      statusClass = "upcoming";
      const evDate = new Date(ev?.date || "");
      const now = new Date();
      const diffDays = Math.round((evDate - now) / 86400000);
      statusText = diffDays <= 0 ? "Today" : diffDays === 1 ? "Tomorrow" : `In ${diffDays} days`;
    } else if (state === "in" || statusName.includes("in_progress") || statusName === "in") {
      cardClass += " live";
      statusClass = "live";
      statusText = statusDetail || "LIVE";
    } else if (state === "post" || statusName.includes("final") || statusName === "post") {
      cardClass += " final";
      statusText = statusDetail || "Final";
    } else {
      cardClass += " sched";
      const evDate = new Date(ev?.date || "");
      statusText = evDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    const color = LEAGUE_COLORS[leagueKey] || "#555";

    const teamsHTML = competitors.map(c => {
      const team     = c?.team || {};
      const isFav    = _isShopTeam(team);
      const logoUrl  = team?.logo || "";
      const nameRaw  = String(team?.displayName || team?.shortDisplayName || team?.name || "TBD");
      const name     = _applyTTUN(nameRaw);
      const score    = c?.score != null ? String(c.score) : (upcoming ? "" : "--");
      const record   = String(c?.records?.[0]?.summary || "");
      const logoHTML = logoUrl ? `<img class="piShopTeamLogo" src="${_esc(logoUrl)}" alt="${_esc(name)}" loading="lazy" />` : "";
      return `
        <div class="piShopTeamLine">
          <div class="piShopTeamLineLeft">
            ${logoHTML}
            <span class="piShopTeamNameFull${isFav ? " fav" : ""}">${_esc(name)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${record ? `<span class="piShopTeamRecord">${_esc(record)}</span>` : ""}
            ${score !== "" ? `<span class="piShopTeamScore">${_esc(score)}</span>` : ""}
          </div>
        </div>`;
    }).join("");

    // Series
    const seriesFromComp = _parseSeriesFromComp(comp, leagueKey);
    const series = seriesOverride || seriesFromComp;
    const seriesHTML = series ? `<div class="piSeriesLine">${_buildSeriesHTML(series)}</div>` : `<div class="piSeriesLine"></div>`;

    // Odds / venue meta
    const venue    = String(comp?.venue?.fullName || comp?.venue?.shortName || "");
    const oddsLine = oddsOverride ? _buildOddsLine(oddsOverride.favored, oddsOverride.ou) : "";
    const metaHTML = (venue || oddsLine) ? `
      <div class="piShopMeta">
        ${oddsLine ? `<span class="piShopMetaItem odds">${_esc(oddsLine)}</span>` : ""}
        ${venue    ? `<span class="piShopMetaItem venue">📍 ${_esc(venue)}</span>` : ""}
      </div>` : "";

    return `
      <div class="${cardClass}" data-eventid="${_esc(String(ev?.id || ""))}">
        <div class="piShopCardTop">
          <span class="piShopLeagueBadge" style="background:${color};">${_esc(leagueLabel)}</span>
          <span class="piShopStatusLabel ${statusClass}">${_esc(statusText)}</span>
        </div>
        <div class="piShopTeamsRow">${teamsHTML}</div>
        ${seriesHTML}
        ${metaHTML}
      </div>`;
  }

  // ----------------------------------------------------------------
  // Utilities
  // ----------------------------------------------------------------
  function _todayStr() {
    return _dateStr(new Date());
  }

  function _dateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  function _daysSince(date) {
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function _applyTTUN(name) {
    return name
      .replace(/\bMichigan\b/g, "TTUN")
      .replace(/\bWolverines\b/g, "Cheating Bastards");
  }

})();
