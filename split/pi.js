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
      `<button class="piLeagueBtn piPuttPuttBtn${_activeLeague === "puttputt" ? " active" : ""}" data-league="puttputt">⛳ Putt Putt</button>`,
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
  /* Fire background */
  #piWrap::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 40% at 20% 110%, rgba(200,60,0,0.18) 0%, transparent 70%),
      radial-gradient(ellipse 50% 35% at 80% 110%, rgba(180,40,0,0.14) 0%, transparent 70%),
      radial-gradient(ellipse 80% 50% at 50% 120%, rgba(120,20,0,0.12) 0%, transparent 60%);
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
    padding: 10px 20px 8px;
    background: linear-gradient(180deg, rgba(30,0,0,0.98) 0%, rgba(15,0,0,0.92) 100%);
    border-bottom: 2px solid rgba(180,0,0,0.5);
    box-shadow: 0 2px 16px rgba(180,0,0,0.25);
  }
  #piHeaderLeft { display: flex; align-items: center; gap: 12px; }
  #piHeaderLeft img { height: 44px; width: 44px; object-fit: contain; filter: drop-shadow(0 0 6px rgba(255,200,0,0.6)); }
  #piHeaderTitle {
    font-size: clamp(1.3rem, 2.2vw, 1.7rem);
    font-weight: 900;
    color: #fff;
    letter-spacing: 0.04em;
    text-shadow: 0 0 12px rgba(200,0,0,0.5), 0 1px 0 rgba(0,0,0,0.8);
    line-height: 1.1;
  }
  #piHeaderTitle span {
    display: block;
    font-size: clamp(0.7rem, 1.1vw, 0.95rem);
    font-weight: 600;
    color: #cc4444;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-shadow: none;
    margin-top: 1px;
  }

  /* Countdown */
  #piCountdown {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(180,0,0,0.35);
    border-radius: 10px;
    padding: 6px 14px;
  }
  .piCdLabel { font-size: clamp(0.7rem, 1vw, 0.9rem); color: #cc4444; font-weight: 700; letter-spacing: 0.08em; margin-right: 2px; white-space: nowrap; }
  .piCdBlock { display: flex; flex-direction: column; align-items: center; min-width: 32px; }
  .piCdNum {
    font-size: clamp(1.1rem, 1.8vw, 1.5rem);
    font-weight: 900;
    color: #fff;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    text-shadow: 0 0 8px rgba(255,100,0,0.4);
  }
  .piCdSub { font-size: 0.6rem; color: #666; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 1px; }
  .piCdColon { font-size: clamp(1rem, 1.6vw, 1.3rem); font-weight: 900; color: #cc2200; line-height: 1; align-self: flex-start; margin-top: 2px; }

  /* Days since TTUN counter */
  #piDaysSince {
    font-size: clamp(0.72rem, 1.1vw, 0.92rem);
    font-weight: 700;
    color: #aa3300;
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(140,0,0,0.3);
    border-radius: 8px;
    padding: 5px 12px;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  #piDaysSince strong { color: #ff6633; font-size: 1.1em; }

  #piHeaderRight { display: flex; align-items: center; gap: 12px; }

  /* Close button */
  #piCloseBtn {
    background: rgba(180,0,0,0.2);
    border: 1px solid rgba(180,0,0,0.4);
    color: #cc4444;
    font-size: 1.2rem;
    width: 36px; height: 36px;
    border-radius: 50%;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.18s;
    flex-shrink: 0;
  }
  #piCloseBtn:hover { background: rgba(200,0,0,0.5); color: #fff; border-color: #cc0000; }

  /* Weather widget */
  #piWeatherWidget { min-width: 180px; }
  .piWeatherInner { display: flex; align-items: center; gap: 8px; border-radius: 8px; padding: 5px 10px; border: 1px solid rgba(255,255,255,0.07); }
  .piWeatherEmoji { font-size: clamp(1.4rem, 2vw, 1.8rem); line-height: 1; }
  .piWeatherData { display: flex; flex-direction: column; gap: 1px; }
  .piWeatherTemp { font-size: clamp(1rem, 1.6vw, 1.3rem); font-weight: 900; color: #fff; line-height: 1; }
  .piWeatherFeels { font-size: 0.75rem; color: #888; font-weight: 500; margin-left: 6px; }
  .piWeatherLabel { font-size: clamp(0.7rem, 1vw, 0.85rem); color: #aaa; font-weight: 600; }
  .piWeatherMeta { font-size: clamp(0.62rem, 0.9vw, 0.75rem); color: #666; }

  /* ---- League Bar ---- */
  #piLeagueBar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    background: rgba(8,0,0,0.97);
    border-bottom: 1px solid rgba(140,0,0,0.35);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  #piLeagueBar::-webkit-scrollbar { display: none; }
  .piLeagueBtn {
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    color: #aaa;
    font-size: clamp(0.78rem, 1.2vw, 0.95rem);
    font-weight: 700;
    padding: 6px 14px;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.18s;
    white-space: nowrap;
    letter-spacing: 0.03em;
  }
  .piLeagueBtn:hover { background: rgba(180,0,0,0.35); color: #fff; border-color: rgba(200,0,0,0.5); }
  .piLeagueBtn.active { background: linear-gradient(135deg, #8b0000, #5a0000); color: #fff; border-color: #cc0000; box-shadow: 0 0 10px rgba(180,0,0,0.5); }
  .piShopTeamsBtn { background: rgba(180,0,0,0.12); border-color: rgba(180,0,0,0.3); color: #cc6666; }
  .piShopTeamsBtn:hover { background: rgba(180,0,0,0.4); color: #fff; border-color: rgba(200,0,0,0.6); }
  .piShopTeamsBtn.active { background: linear-gradient(135deg, #8b0000, #5a0000); color: #fff; border-color: #ff4444; box-shadow: 0 0 12px rgba(220,0,0,0.6); }

  /* ---- Scores Panel (left) ---- */
  #piScoresPanel {
    overflow-y: auto;
    padding: 10px 14px;
    background: rgba(5,0,0,0.6);
    border-right: 1px solid rgba(120,0,0,0.3);
    scrollbar-width: thin;
    scrollbar-color: #440000 #0d0000;
  }
  #piScoresPanel::-webkit-scrollbar { width: 4px; }
  #piScoresPanel::-webkit-scrollbar-track { background: #0d0000; }
  #piScoresPanel::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }
  #piScoresContent {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-content: start;
  }
  .piPanelHeadWrapper { grid-column: 1 / -1; }
  #piPanelHeadLabel {
    font-size: clamp(0.85rem, 1.3vw, 1.05rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #cc4444;
    border-bottom: 1px solid rgba(180,0,0,0.3);
    padding-bottom: 6px;
    margin-bottom: 2px;
  }
  #piPanelHeadLabel.gold { color: #ffcc44; border-bottom-color: rgba(200,160,0,0.3); }

  /* ---- Right Panel ---- */
  #piRightPanel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(8,0,0,0.85);
  }

  /* Right panel toggle header */
  #piRightToggleBar {
    display: flex;
    border-bottom: 1px solid rgba(120,0,0,0.35);
    background: rgba(10,0,0,0.9);
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
    aspect-ratio: 16 / 9;
    max-height: 45%;
    background: #000;
    display: none;
  }
  #piYoutubeSlot.visible { display: block; }
  #piYoutubeSlot iframe {
    width: 100%; height: 100%; border: none; display: block;
  }

  #piNewsScroll {
    flex: 1;
    overflow-y: auto;
    padding: 10px 14px;
    scrollbar-width: thin;
    scrollbar-color: #440000 #0d0000;
  }
  #piNewsScroll::-webkit-scrollbar { width: 4px; }
  #piNewsScroll::-webkit-scrollbar-track { background: #0d0000; }
  #piNewsScroll::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }

  .piNewsItem {
    padding: 9px 0;
    border-bottom: 1px solid rgba(120,0,0,0.2);
    cursor: pointer;
  }
  .piNewsItem:last-child { border-bottom: none; }
  .piNewsItem:hover { background: rgba(180,0,0,0.07); margin: 0 -14px; padding: 9px 14px; border-radius: 4px; }
  .piNewsHeadline {
    font-size: clamp(0.82rem, 1.2vw, 1rem);
    font-weight: 700;
    color: #e8e0e0;
    line-height: 1.3;
    margin-bottom: 3px;
  }
  .piNewsMeta { font-size: clamp(0.68rem, 0.95vw, 0.8rem); color: #666; }
  .piNewsMeta span { color: #cc4444; font-weight: 600; }

  /* ---- Score Cards ---- */
  .piGameCard {
    background: rgba(20,0,0,0.7);
    border: 1px solid rgba(120,0,0,0.25);
    border-radius: 8px;
    padding: 10px 12px;
    transition: border-color 0.18s, background 0.18s;
    cursor: default;
  }
  .piGameCard:hover { border-color: rgba(180,0,0,0.5); background: rgba(30,0,0,0.8); }
  .piGameCard.wide { grid-column: 1 / -1; }
  .piGameCard.live { border-color: rgba(200,0,0,0.5); box-shadow: 0 0 8px rgba(200,0,0,0.15); }

  .piCardLeague {
    font-size: clamp(0.62rem, 0.9vw, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 5px;
  }
  .piCardStatus {
    display: inline-block;
    font-size: clamp(0.6rem, 0.85vw, 0.72rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 1px 8px;
    border-radius: 10px;
    margin-left: 6px;
    vertical-align: middle;
  }
  .piCardStatus.live { background: rgba(200,0,0,0.3); color: #ff6644; border: 1px solid rgba(220,0,0,0.4); }
  .piCardStatus.final { background: rgba(60,60,60,0.4); color: #888; border: 1px solid rgba(100,100,100,0.3); }
  .piCardStatus.pre { background: rgba(0,80,160,0.3); color: #66aaff; border: 1px solid rgba(0,100,200,0.4); }

  .piTeamRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 3px 0;
  }
  .piTeamName {
    font-size: clamp(0.92rem, 1.5vw, 1.15rem);
    font-weight: 800;
    color: #f0e8e8;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .piTeamName.winner { color: #fff; text-shadow: 0 0 6px rgba(255,200,0,0.3); }
  .piTeamName.loser  { color: #666; }
  .piTeamScore {
    font-size: clamp(1.3rem, 2.5vw, 1.9rem);
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
  .piPuttCourseName { font-size: clamp(1.1rem, 2vw, 1.5rem); font-weight: 900; color: #fff; text-shadow: 0 0 8px rgba(0,200,80,0.4); }
  .piPuttStatus { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; padding: 3px 12px; border-radius: 12px; }
  .piPuttStatus.live { background: rgba(200,0,0,0.4); color: #ff6644; border: 1px solid rgba(220,0,0,0.5); }
  .piPuttStatus.final { background: rgba(0,120,50,0.35); color: #7dffb3; border: 1px solid rgba(0,180,80,0.4); }
  .piPuttScTableWrap { overflow-x: auto; border-radius: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,160,60,0.2); }
  .piPuttScorecard { width: 100%; border-collapse: collapse; }
  .piPuttScorecard th, .piPuttScorecard td { text-align: center; padding: 9px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: clamp(0.95rem, 1.6vw, 1.25rem); font-variant-numeric: tabular-nums; }
  .piPuttScorecard thead th { font-size: clamp(0.8rem, 1.2vw, 1rem); font-weight: 800; letter-spacing: 0.08em; color: #aaa; background: rgba(0,0,0,0.25); border-bottom: 2px solid rgba(0,160,60,0.3); }
  .piPuttScorecard .piPuttNameCol { text-align: left; padding-left: 14px; font-weight: 800; font-size: clamp(1rem, 1.8vw, 1.35rem); color: #f0f0f0; min-width: 100px; }
  .piPuttScorecard .piPuttParRow td { color: #888; font-size: clamp(0.8rem, 1.2vw, 1rem); background: rgba(0,0,0,0.15); font-weight: 600; }
  .piPuttScorecard .piPuttTotalCol { font-weight: 900; font-size: clamp(1.05rem, 1.8vw, 1.4rem); }
  .piPuttScorecard .pi-sc-under { color: #4fffaa; font-weight: 800; text-shadow: 0 0 8px rgba(0,255,150,0.4); }
  .piPuttScorecard .pi-sc-over  { color: #ff7766; font-weight: 800; }
  .piPuttScorecard .pi-sc-even  { color: #fff; font-weight: 700; }
  .piPuttScorecard .pi-sc-empty { color: #444; }
  .piPuttScorecard tbody tr:nth-child(even) { background: rgba(255,255,255,0.02); }
  .piPuttScorecard tbody tr:hover { background: rgba(0,160,60,0.07); }
  .piPuttLeader { margin-top: 10px; padding: 10px 16px; background: rgba(0,120,50,0.25); border: 1px solid rgba(0,200,80,0.3); border-radius: 8px; font-size: clamp(0.95rem, 1.6vw, 1.2rem); font-weight: 800; color: #7dffb3; text-align: center; letter-spacing: 0.04em; text-shadow: 0 0 8px rgba(0,255,140,0.3); }
  .piPuttNoRound { grid-column: 1 / -1; text-align: center; padding: 32px 16px; color: #555; font-size: 1rem; }

  /* Section headers for MLS multi-day view */
  .piSectionHeader {
    grid-column: 1 / -1;
    font-size: clamp(0.7rem, 1vw, 0.85rem);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #666;
    padding: 8px 2px 4px;
    border-bottom: 1px solid rgba(120,0,0,0.2);
    margin-top: 4px;
  }
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
      <div id="piDaysSince">Days since TTUN last won: <strong id="piDaysSinceNum">--</strong></div>
      <div id="piWeatherWidget"><div class="piWeatherInner"><div class="piWeatherEmoji">🌡️</div><div class="piWeatherData"><div class="piWeatherTemp">--°</div><div class="piWeatherLabel">Loading…</div></div></div></div>
      <button id="piCloseBtn" aria-label="Close scoreboard">✕</button>
    </div>
  </div>

  <div id="piLeagueBar">${leagueBtns}</div>

  <div id="piScoresPanel">
    <div class="piPanelHeadWrapper"><div id="piPanelHeadLabel">Shop Teams</div></div>
    <div id="piScoresContent"><div class="piNoGames">Loading&hellip;</div></div>
  </div>

  <div id="piRightPanel">
    <div id="piRightToggleBar">
      <button class="piRightToggleBtn active" data-panel="youtube">▶ YouTube</button>
      <button class="piRightToggleBtn" data-panel="news">📰 News</button>
    </div>
    <div id="piRightContent">
      <div id="piYoutubeSlot" class="visible">
        <iframe
          src="https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=0&modestbranding=1"
          allow="autoplay; encrypted-media"
          allowfullscreen>
        </iframe>
      </div>
      <div id="piNewsScroll"><div class="piNoGames">Loading news…</div></div>
    </div>
  </div>

  <div id="piBanner">
    <span class="piBannerChunk">🏈 <strong>Go Bucks</strong></span>
    ${leaf}
    <span class="piBannerChunk">Beat <strong>That Team Up North</strong></span>
    ${leaf}
    <span class="piBannerChunk">☠️ <strong>TTUN</strong> still sucks</span>
    ${leaf}
    <span class="piBannerChunk">O-H <strong>I-O</strong></span>
    ${leaf}
    <span class="piBannerChunk">🐻 <strong>The Shop</strong> — Marysville, OH</span>
  </div>
</div>`;
  }

  // ----------------------------------------------------------------
  // Countdown
  // ----------------------------------------------------------------
  function _startCountdown() {
    const dEl = document.getElementById("piCdD");
    const hEl = document.getElementById("piCdH");
    const mEl = document.getElementById("piCdM");
    const sEl = document.getElementById("piCdS");
    const dsEl = document.getElementById("piDaysSinceNum");
    if (dsEl) dsEl.textContent = _daysSince(LAST_TTUN_WIN);
    function tick() {
      const now  = new Date();
      const diff = THE_GAME_DATE - now;
      if (diff <= 0) {
        if (dEl) dEl.textContent = "0";
        if (hEl) hEl.textContent = "00";
        if (mEl) mEl.textContent = "00";
        if (sEl) sEl.textContent = "00";
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000)  / 60000);
      const s = Math.floor((diff % 60000)    / 1000);
      if (dEl) dEl.textContent = d;
      if (hEl) hEl.textContent = String(h).padStart(2, "0");
      if (mEl) mEl.textContent = String(m).padStart(2, "0");
      if (sEl) sEl.textContent = String(s).padStart(2, "0");
    }
    tick();
    _intervals.push(setInterval(tick, COUNTDOWN_TICK_MS));
  }

  function _daysSince(date) {
    return Math.floor((Date.now() - date.getTime()) / 86400000);
  }

  // ----------------------------------------------------------------
  // Right panel toggle
  // ----------------------------------------------------------------
  function _bindRightToggle() {
    const bar = document.getElementById("piRightToggleBar");
    if (!bar) return;
    bar.addEventListener("click", e => {
      const btn = e.target.closest(".piRightToggleBtn");
      if (!btn) return;
      const panel = btn.dataset.panel;
      _rightPanel = panel;
      bar.querySelectorAll(".piRightToggleBtn").forEach(b => b.classList.toggle("active", b.dataset.panel === panel));
      const yt = document.getElementById("piYoutubeSlot");
      if (yt) yt.classList.toggle("visible", panel === "youtube");
    });
  }

  // ----------------------------------------------------------------
  // Right panel — news/ESPN
  // ----------------------------------------------------------------
  async function _loadRightPanel() {
    const el = document.getElementById("piNewsScroll");
    if (!el) return;
    try {
      const data = await fetch("https://site.api.espn.com/apis/site/v2/sports/news?limit=20").then(r => r.ok ? r.json() : Promise.reject());
      const articles = data?.articles || [];
      if (!articles.length) { el.innerHTML = `<div class="piNoGames">No news available.</div>`; return; }
      el.innerHTML = articles.map(a => {
        const src  = a.source || a.categories?.find(c => c.type === "league")?.shortName || "ESPN";
        const time = a.published ? _fmtNewsTime(new Date(a.published)) : "";
        return `<div class="piNewsItem" onclick="window.open('${_esc(a.links?.web?.href || "#")}','_blank')">
          <div class="piNewsHeadline">${_esc(a.headline || a.title || "")}</div>
          <div class="piNewsMeta"><span>${_esc(src)}</span>${time ? " · " + time : ""}</div>
        </div>`;
      }).join("");
    } catch {
      el.innerHTML = `<div class="piNoGames">Could not load news.</div>`;
    }
  }

  function _fmtNewsTime(d) {
    const now  = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 1)   return "just now";
    if (diff < 60)  return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return `${Math.floor(diff/1440)}d ago`;
  }

  // ----------------------------------------------------------------
  // League buttons
  // ----------------------------------------------------------------
  function _bindLeagueButtons() {
    const bar = document.getElementById("piLeagueBar");
    if (!bar) return;
    bar.addEventListener("click", e => {
      const btn = e.target.closest(".piLeagueBtn");
      if (!btn) return;
      const league = btn.dataset.league;
      _activeLeague = league;
      bar.querySelectorAll(".piLeagueBtn").forEach(b => b.classList.toggle("active", b === btn));
      _resetPanelHead();
      _renderScores();
    });
  }

  function _resetPanelHead() {
    const head = document.getElementById("piPanelHeadLabel");
    if (!head) return;
    head.classList.remove("gold");
    head.style.color = "";
    head.style.borderBottomColor = "";
    head.style.textShadow = "";
  }

  // ----------------------------------------------------------------
  // Render scores dispatcher
  // ----------------------------------------------------------------
  async function _renderScores() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;

    const head = document.getElementById("piPanelHeadLabel");

    if (_activeLeague === "shop") {
      if (head) { head.textContent = "Shop Teams"; head.classList.remove("gold"); head.style.color = ""; head.style.borderBottomColor = ""; head.style.textShadow = ""; }
      return _renderShopTeams();
    }
    if (_activeLeague === "puttputt") {
      return _renderPuttPutt();
    }

    const league = LEAGUES.find(l => l.key === _activeLeague);
    if (!league) return;

    if (head) {
      head.textContent = league.label + " Scores";
      head.classList.remove("gold");
      head.style.color = "";
      head.style.borderBottomColor = "";
      head.style.textShadow = "";
    }

    el.innerHTML = `<div class="piNoGames" style="grid-column:1/-1">Loading ${league.label}…</div>`;
    try {
      const today = _dateStr(new Date());
      const data  = await fetch(league.url(today)).then(r => r.ok ? r.json() : Promise.reject());
      let events  = data?.events || [];

      // MLS: show full weekend window (Fri–Sun), midweek separately
      if (_activeLeague === "mls" && events.length === 0) {
        const result = await _fetchMLSWindow();
        _renderMLSWindow(el, result, head);
        return;
      }

      if (!events.length) {
        el.innerHTML = `<div class="piNoGames" style="grid-column:1/-1">No ${league.label} games today.</div>`;
        return;
      }

      el.innerHTML = events.map(ev => _buildGameCard(ev, _activeLeague)).join("");
    } catch (err) {
      el.innerHTML = `<div class="piNoGames" style="grid-column:1/-1">Could not load ${league.label} scores.</div>`;
    }
  }

  // ----------------------------------------------------------------
  // MLS weekend window
  // ----------------------------------------------------------------
  async function _fetchMLSWindow() {
    const now     = new Date();
    const dow     = now.getDay(); // 0=Sun,1=Mon,...,6=Sat
    const isMidweek = dow >= 1 && dow <= 4; // Mon–Thu

    // Always fetch today first
    const today = _dateStr(now);
    let todayEvents = [];
    try {
      const d = await fetch(LEAGUES.find(l => l.key === "mls").url(today)).then(r => r.ok ? r.json() : Promise.reject());
      todayEvents = d?.events || [];
    } catch {}

    if (todayEvents.length) return { type: "today", events: todayEvents };

    if (isMidweek) {
      // Look ahead to the next weekend (Fri/Sat/Sun)
      const weekendDates = _nextWeekendDates(now);
      const allEvents = [];
      for (const d of weekendDates) {
        try {
          const data = await fetch(LEAGUES.find(l => l.key === "mls").url(d)).then(r => r.ok ? r.json() : Promise.reject());
          (data?.events || []).forEach(e => allEvents.push({ ...e, _fetchDate: d }));
        } catch {}
      }
      return { type: "weekend", events: allEvents, weekendDates };
    } else {
      // Weekend — look at Fri/Sat/Sun window
      const windowDates = _currentWeekendDates(now);
      const allEvents = [];
      for (const d of windowDates) {
        try {
          const data = await fetch(LEAGUES.find(l => l.key === "mls").url(d)).then(r => r.ok ? r.json() : Promise.reject());
          (data?.events || []).forEach(e => allEvents.push({ ...e, _fetchDate: d }));
        } catch {}
      }
      return { type: "weekend", events: allEvents, weekendDates: windowDates };
    }
  }

  function _renderMLSWindow(el, result, head) {
    if (head) { head.textContent = "⚽ MLS Scores"; head.classList.remove("gold"); }
    if (!result.events.length) {
      el.innerHTML = `<div class="piNoGames" style="grid-column:1/-1">No MLS games this weekend.</div>`;
      return;
    }
    if (result.type === "today") {
      el.innerHTML = result.events.map(ev => _buildGameCard(ev, "mls")).join("");
      return;
    }
    // Group by date
    const byDate = {};
    result.events.forEach(ev => {
      const d = ev._fetchDate || _dateStr(new Date(ev.date));
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(ev);
    });
    let html = "";
    Object.keys(byDate).sort().forEach(d => {
      const label = _friendlyDate(d);
      html += `<div class="piSectionHeader">${label}</div>`;
      html += byDate[d].map(ev => _buildGameCard(ev, "mls")).join("");
    });
    el.innerHTML = html || `<div class="piNoGames" style="grid-column:1/-1">No MLS games found.</div>`;
  }

  function _nextWeekendDates(from) {
    const dow = from.getDay();
    const daysToFri = (5 - dow + 7) % 7 || 7;
    return [0, 1, 2].map(offset => {
      const d = new Date(from);
      d.setDate(d.getDate() + daysToFri + offset);
      return _dateStr(d);
    });
  }

  function _currentWeekendDates(from) {
    const dow = from.getDay(); // 0=Sun,5=Fri,6=Sat
    const dates = [];
    // Include Fri, Sat, Sun of current weekend
    const offsets = {
      0: [-2, -1, 0],  // Sun: Fri(-2), Sat(-1), Sun(0)
      5: [0, 1, 2],    // Fri: Fri(0), Sat(+1), Sun(+2)
      6: [-1, 0, 1],   // Sat: Fri(-1), Sat(0), Sun(+1)
    };
    const offs = offsets[dow] || [0, 1, 2];
    offs.forEach(o => {
      const d = new Date(from);
      d.setDate(d.getDate() + o);
      dates.push(_dateStr(d));
    });
    return dates;
  }

  function _friendlyDate(dateStr) {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  // ----------------------------------------------------------------
  // Shop Teams view
  // ----------------------------------------------------------------
  async function _renderShopTeams() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames" style="grid-column:1/-1">Loading Shop Teams…</div>`;

    const now   = new Date();
    const dow   = now.getDay(); // 0=Sun ... 6=Sat
    // Tuesday+ → look 7 days ahead for MLS/NFL/CFB; otherwise 3 days
    const isTuesdayOrLater = dow >= 2; // Tue=2 through Sat=6
    // Sunday/Monday = tight window to avoid clutter
    const results = [];

    await Promise.all(LEAGUES.map(async league => {
      if (league.key === "pga") return; // no team concept

      const maxDays = (() => {
        if (["mls","nfl","cfb"].includes(league.key)) {
          return isTuesdayOrLater ? 7 : 3;
        }
        return LOOKAHEAD_DAYS[league.key] ?? 3;
      })();

      for (let offset = 0; offset <= maxDays; offset++) {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        const dateStr = _dateStr(d);
        try {
          const data   = await fetch(league.url(dateStr)).then(r => r.ok ? r.json() : Promise.reject());
          const events = data?.events || [];
          for (const ev of events) {
            if (_isShopTeamGame(ev)) {
              results.push({ ev, league: league.key, offset });
            }
          }
          if (results.some(r => r.league === league.key && r.offset === offset)) break;
        } catch {}
      }
    }));

    if (!results.length) {
      el.innerHTML = `<div class="piNoGames" style="grid-column:1/-1">No Shop Teams games right now. Check back soon.</div>`;
      return;
    }

    results.sort((a, b) => {
      const sa = _statusOrder(a.ev);
      const sb = _statusOrder(b.ev);
      if (sa !== sb) return sa - sb;
      return (a.ev.date || "").localeCompare(b.ev.date || "");
    });

    el.innerHTML = results.map(({ ev, league }) => _buildGameCard(ev, league, true)).join("");
  }

  function _isShopTeamGame(ev) {
    const comps = ev.competitions?.[0]?.competitors || [];
    return comps.some(c => {
      const names = [
        c.team?.displayName,
        c.team?.shortDisplayName,
        c.team?.name,
        c.team?.location,
        c.team?.abbreviation,
      ].filter(Boolean).map(s => s.trim().toLowerCase().replace(/\s+/g, " "));
      return names.some(n => SHOP_TEAMS_NORM.some(t => n.includes(t) || t.includes(n)));
    });
  }

  function _statusOrder(ev) {
    const state = ev.status?.type?.state || "";
    if (state === "in")   return 0;
    if (state === "pre")  return 1;
    if (state === "post") return 2;
    return 3;
  }

  // ----------------------------------------------------------------
  // Game card builder
  // ----------------------------------------------------------------
  function _buildGameCard(ev, leagueKey, isShop = false) {
    const comp     = ev.competitions?.[0] || {};
    const teams    = comp.competitors   || [];
    const status   = ev.status?.type    || {};
    const state    = status.state       || "pre";
    const detail   = status.shortDetail || status.detail || "";
    const isLive   = state === "in";
    const isFinal  = state === "post";
    const isPre    = state === "pre";

    const home = teams.find(t => t.homeAway === "home") || teams[0] || {};
    const away = teams.find(t => t.homeAway === "away") || teams[1] || {};

    const homeScore = home.score ?? "";
    const awayScore = away.score ?? "";
    const homeName  = home.team?.shortDisplayName || home.team?.displayName || "Home";
    const awayName  = away.team?.shortDisplayName || away.team?.displayName || "Away";

    const homeWin = isFinal && homeScore !== "" && awayScore !== "" && Number(homeScore) > Number(awayScore);
    const awayWin = isFinal && homeScore !== "" && awayScore !== "" && Number(awayScore) > Number(homeScore);

    // Playoff series
    let seriesHTML = "";
    if (PLAYOFF_LEAGUES.has(leagueKey)) {
      const series = comp.series;
      if (series) {
        const wins = series.competitors || [];
        const hw = wins.find(w => {
          const wId = w.id || w.uid;
          return wId === (home.team?.id || home.id);
        });
        const aw = wins.find(w => {
          const wId = w.id || w.uid;
          return wId === (away.team?.id || away.id);
        });
        const hwins = hw?.wins ?? 0;
        const awins = aw?.wins ?? 0;
        if (hwins > 0 || awins > 0) {
          const leader = hwins > awins ? homeName : awins > hwins ? awayName : null;
          const badge  = leader
            ? `${leader} leads ${Math.max(hwins,awins)}-${Math.min(hwins,awins)}`
            : `Series tied ${hwins}-${awins}`;
          const cls = leader ? "" : " tied";
          seriesHTML = `<div class="piSeriesLine"><span class="piSeriesBadge${cls}">${badge}</span></div>`;
        }
      }
    }

    // Shop meta (odds/venue for shop view)
    let shopMetaHTML = "";
    if (isShop) {
      const odds  = comp.odds?.[0];
      const venue = comp.venue?.fullName;
      const items = [];
      if (odds?.details) items.push(`<span class="piShopMetaItem odds">${_esc(odds.details)}</span>`);
      if (venue)         items.push(`<span class="piShopMetaItem venue">📍 ${_esc(venue)}</span>`);
      if (items.length)  shopMetaHTML = `<div class="piShopMeta">${items.join("")}</div>`;
    }

    const statusCls  = isLive ? "live" : isFinal ? "final" : "pre";
    const statusText = isLive ? detail || "LIVE" : isFinal ? "FINAL" : _fmtGameTime(ev.date);
    const leagueColor = LEAGUE_COLORS[leagueKey] || "#888";
    const cardCls = isShop ? "piGameCard wide" : "piGameCard";

    return `
<div class="${cardCls}${isLive ? " live" : ""}">
  <div class="piCardLeague" style="color:${leagueColor}">${leagueKey.toUpperCase()}<span class="piCardStatus ${statusCls}">${_esc(statusText)}</span></div>
  <div class="piTeamRow">
    <span class="piTeamName${awayWin ? " loser" : homeWin ? "" : ""}">${_esc(awayName)}</span>
    ${awayScore !== "" ? `<span class="piTeamScore">${_esc(String(awayScore))}</span>` : ""}
  </div>
  <div class="piTeamRow">
    <span class="piTeamName${homeWin ? " winner" : awayWin ? " loser" : ""}">${_esc(homeName)}</span>
    ${homeScore !== "" ? `<span class="piTeamScore">${_esc(String(homeScore))}</span>` : ""}
  </div>
  ${seriesHTML}
  ${shopMetaHTML}
</div>`;
  }

  // ----------------------------------------------------------------
  // Putt Putt
  // ----------------------------------------------------------------
  async function _renderPuttPutt() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading Putt Putt round…</div>`;

    // Update panel head
    const head = document.getElementById("piPanelHeadLabel");
    if (head) { head.textContent = "⛳ Putt Putt Scorecard"; head.classList.remove("gold"); head.style.color = "#00cc66"; head.style.borderBottomColor = "rgba(0,180,80,0.4)"; head.style.textShadow = "0 0 6px rgba(0,200,80,0.4)"; }

    // Ensure Firebase app is initialized
    if (window.firebase && firebase.apps && !firebase.apps.length && window.FIREBASE_CONFIG) {
      try { firebase.initializeApp(window.FIREBASE_CONFIG); } catch {}
    }

    // Wait up to 6s for anonymous auth to settle before hitting Firestore
    await new Promise(resolve => {
      if (!window.firebase || !firebase.auth) return resolve();
      const unsub = firebase.auth().onAuthStateChanged(user => {
        unsub();
        resolve(user);
      });
      setTimeout(resolve, 6000);
    });

    // If still not signed in, try anonymous sign-in
    try {
      if (firebase.auth && !firebase.auth().currentUser) {
        await firebase.auth().signInAnonymously();
      }
    } catch {}

    const db = window.firebase && firebase.apps && firebase.apps.length ? firebase.firestore() : null;
    if (!db) { el.innerHTML = `<div class="piPuttNoRound">Firebase not available — open the Shop App to start a round.</div>`; return; }

    try {
      const snap = await db.collection("putt_rounds")
        .orderBy("startedAt", "desc")
        .limit(1)
        .get();

      if (snap.empty) { el.innerHTML = `<div class="piPuttNoRound">No rounds found. Start one in the Shop App!</div>`; return; }

      const round = { id: snap.docs[0].id, ...snap.docs[0].data() };
      el.innerHTML = `<div class="piPuttWrap">${_buildPiPuttScorecardHTML(round)}</div>`;
    } catch(e) {
      // Fallback: fetch unordered and sort client-side (works without index)
      try {
        const snap2 = await db.collection("putt_rounds").limit(50).get();
        if (snap2.empty) { el.innerHTML = `<div class="piPuttNoRound">No rounds found. Start one in the Shop App!</div>`; return; }
        const docs = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => {
          const ta = a.startedAt?.toMillis ? a.startedAt.toMillis() : Number(a.startedAt || 0);
          const tb = b.startedAt?.toMillis ? b.startedAt.toMillis() : Number(b.startedAt || 0);
          return tb - ta;
        });
        el.innerHTML = `<div class="piPuttWrap">${_buildPiPuttScorecardHTML(docs[0])}</div>`;
      } catch(e2) {
        el.innerHTML = `<div class="piPuttNoRound">Could not load round data. (${e2?.code || e2?.message || "unknown"})</div>`;
      }
    }
  }

  function _buildPiPuttScorecardHTML(round) {
    const pars     = round.holePars || [];
    const players  = round.players  || [];
    const totalPar = pars.reduce((a,b) => a+b, 0);
    const isLive   = round.status !== "complete";
    const holeCount = pars.length || 9;

    // Build scores map: scores[player][hole] = strokes (1-indexed)
    const scoresMap = {};
    players.forEach(p => { scoresMap[p] = {}; });
    (round.scores || []).forEach(s => {
      if (!scoresMap[s.player]) scoresMap[s.player] = {};
      scoresMap[s.player][s.hole] = s.strokes;
    });

    // Compute totals for sorting
    const totals = players.map(p => {
      let strokes = 0, holesPlayed = 0;
      for (let h = 1; h <= holeCount; h++) {
        const s = scoresMap[p][h];
        if (s != null) { strokes += s; holesPlayed++; }
      }
      return { p, strokes, holesPlayed, vspar: strokes - pars.slice(0, holesPlayed).reduce((a,b)=>a+b,0) };
    });
    totals.sort((a, b) => {
      if (a.holesPlayed === 0 && b.holesPlayed === 0) return 0;
      if (a.holesPlayed === 0) return 1;
      if (b.holesPlayed === 0) return -1;
      return a.vspar - b.vspar;
    });

    const holeCells = Array.from({length: holeCount}, (_, i) => `<th>${i+1}</th>`).join("") + `<th>Tot</th>`;
    const parCells  = pars.map(p => `<td>${p}</td>`).join("") + `<td>${totalPar}</td>`;

    const rows = totals.map(({ p, strokes, holesPlayed, vspar }) => {
      const cells = Array.from({length: holeCount}, (_, i) => {
        const s   = scoresMap[p][i+1];
        const par = pars[i] ?? 3;
        if (s == null) return `<td class="pi-sc-empty">—</td>`;
        const diff = s - par;
        const cls  = diff < 0 ? "pi-sc-under" : diff > 0 ? "pi-sc-over" : "pi-sc-even";
        return `<td class="${cls}">${s}</td>`;
      }).join("");
      const vp = holesPlayed === 0
        ? { cls: "pi-sc-empty", text: "—" }
        : vspar < 0 ? { cls: "pi-sc-under", text: vspar }
        : vspar > 0 ? { cls: "pi-sc-over",  text: `+${vspar}` }
        : { cls: "pi-sc-even", text: "E" };
      return `<tr><td class="piPuttNameCol piPuttScorecard">${_esc(p)}</td>${cells}<td class="piPuttTotalCol ${vp.cls}">${vp.text}</td></tr>`;
    }).join("");

    // Leader line
    const leader = totals.find(t => t.holesPlayed > 0);
    const leaderHTML = leader
      ? `<div class="piPuttLeader">🏌️ Leading: ${_esc(leader.p)} (${leader.vspar < 0 ? leader.vspar : leader.vspar > 0 ? "+"+leader.vspar : "E"}) · Hole ${leader.holesPlayed} of ${holeCount}</div>`
      : "";

    return `
      <div class="piPuttHeader">
        <span class="piPuttCourseName">${_esc(round.courseName || "Putt Putt")}</span>
        <span class="piPuttStatus ${isLive ? "live" : "final"}">${isLive ? "LIVE" : "FINAL"}</span>
      </div>
      <div class="piPuttScTableWrap">
        <table class="piPuttScorecard">
          <thead><tr><th class="piPuttNameCol">Player</th>${holeCells}</tr></thead>
          <tbody>
            <tr class="piPuttParRow"><td class="piPuttNameCol">Par</td>${parCells}</tr>
            ${rows}
          </tbody>
        </table>
      </div>
      ${leaderHTML}`;
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function _dateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  function _fmtGameTime(isoStr) {
    if (!isoStr) return "TBD";
    const d = new Date(isoStr);
    if (isNaN(d)) return "TBD";
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  }

  function _esc(str) {
    return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

})();
