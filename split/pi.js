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
    if (code >= 80 && code <= 82)        return { emoji: "🌦️",                   label: code === 82 ? "Heavy Showers" : "Rain Showers",  bg: "rgba(40,80,180,0.14)" };
    if (code >= 95 && code <= 99)        return { emoji: "⛈️",                   label: "Thunderstorm",                                  bg: "rgba(60,0,120,0.18)" };
    return { emoji: "🌡️", label: "Mixed", bg: "rgba(100,100,100,0.1)" };
  }

  // ----------------------------------------------------------------
  // Shell HTML
  // ----------------------------------------------------------------
  function buildShell() {
    const leagueBtns = [
      `<button class="piLeagueBtn piShopTeamsBtn${_activeLeague === "shop" ? " active" : ""}" data-league="shop">⭐ Shop Teams</button>`,
      ...LEAGUES.map(l =>
        `<button class="piLeagueBtn${_activeLeague === l.key ? " active" : ""}" data-league="${l.key}">${l.label}</button>`
      ),
      `<button class="piLeagueBtn piPuttPuttBtn${_activeLeague === "puttputt" ? " active" : ""}" data-league="puttputt">⛳ Putt Putt</button>`,
    ].join("\n      ");

    return `
<style>
  /* ---- Reset / Base ---- */
  #piScoreboard * { box-sizing: border-box; margin: 0; padding: 0; }
  #piScoreboard {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #e8e8e8;
    overflow: hidden;
    user-select: none;
    background: #0d0000;
  }

  /* ---- Layout ---- */
  #piLayout {
    display: grid;
    grid-template-columns: 1fr 420px;
    grid-template-rows: auto 1fr;
    height: 100vh;
    width: 100vw;
    background:
      radial-gradient(ellipse at 20% 50%, rgba(140,0,0,0.18) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 20%, rgba(100,0,0,0.12) 0%, transparent 50%),
      linear-gradient(160deg, #0d0000 0%, #1a0000 40%, #0d0000 100%);
  }

  /* ---- Top bar ---- */
  #piTopBar {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    background: linear-gradient(90deg, #8b0000 0%, #bb0000 40%, #8b0000 100%);
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    flex-wrap: wrap;
    min-height: 52px;
  }
  #piTopBar .piLogo { font-size: clamp(1rem, 2vw, 1.4rem); font-weight: 900; letter-spacing: 0.08em; color: #fff; white-space: nowrap; }
  #piTopBar .piDivider { width: 1px; height: 28px; background: rgba(255,255,255,0.25); flex-shrink: 0; }
  #piLeagueTabs { display: flex; gap: 5px; flex-wrap: wrap; flex: 1; }
  .piLeagueBtn {
    padding: 4px 10px; border-radius: 6px; font-size: clamp(0.72rem, 1.1vw, 0.88rem);
    font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,0.18);
    color: rgba(255,255,255,0.8); background: rgba(0,0,0,0.25);
    transition: background 0.2s;
  }
  .piLeagueBtn:hover { background: rgba(180,0,0,0.4); color: #fff; border-color: rgba(200,0,0,0.6); }
  .piLeagueBtn.active { background: linear-gradient(135deg, #bb0000, #880000); color: #fff; border-color: #cc0000; box-shadow: 0 0 10px rgba(200,0,0,0.5); }
  .piShopTeamsBtn.active { background: linear-gradient(135deg, #a07800, #7a5500); border-color: #c89a00; box-shadow: 0 0 10px rgba(200,160,0,0.5); }
  #piTopRight { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0; }
  #piCloseBtn {
    width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 1rem; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  #piCloseBtn:hover { background: rgba(0,0,0,0.6); }

  /* ---- Left: Scores ---- */
  #piLeft {
    grid-column: 1; grid-row: 2;
    display: flex; flex-direction: column;
    border-right: 1px solid rgba(255,255,255,0.07);
    overflow: hidden;
  }
  #piPanelHead {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 14px 6px;
    border-bottom: 2px solid #bb0000;
    flex-shrink: 0;
    background: rgba(0,0,0,0.55);
  }
  #piPanelHeadLabel { font-size: clamp(0.95rem, 1.5vw, 1.2rem); font-weight: 900; letter-spacing: 0.06em; color: #cc0000; }
  #piPanelHeadLabel.gold { color: #d4a800; }
  #piPanelHeadMeta { font-size: clamp(0.7rem, 1vw, 0.85rem); color: #777; }
  #piScoresPanel {
    flex: 1; overflow-y: auto; padding: 10px 12px;
    scrollbar-width: thin; scrollbar-color: #440000 #0d0000;
  }
  #piScoresPanel::-webkit-scrollbar { width: 4px; }
  #piScoresPanel::-webkit-scrollbar-track { background: #0d0000; }
  #piScoresPanel::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }
  #piScoresContent { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }

  /* ---- Countdown ---- */
  .piCountdownBlock { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; padding: 20px 0 10px; gap: 8px; }
  .piCdTitle { font-size: clamp(1rem, 2vw, 1.5rem); font-weight: 900; letter-spacing: 0.12em; color: #cc0000; text-transform: uppercase; text-shadow: 0 0 12px rgba(200,0,0,0.5); }
  .piCdUnits { display: flex; gap: 12px; }
  .piCdUnit { display: flex; flex-direction: column; align-items: center; gap: 2px; background: rgba(0,0,0,0.5); border: 1px solid rgba(200,0,0,0.25); border-radius: 8px; padding: 8px 14px; min-width: 64px; }
  .piCdNum { font-size: clamp(1.8rem, 4vw, 3rem); font-weight: 900; color: #fff; line-height: 1; font-variant-numeric: tabular-nums; }
  .piCdLabel { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.14em; color: #777; text-transform: uppercase; }
  .piCdSub { font-size: 0.75rem; color: #555; letter-spacing: 0.08em; }

  /* ---- Shop Cards ---- */
  .piShopCard {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px; padding: 10px 12px; font-size: clamp(0.82rem, 1.3vw, 1rem);
    border-left: 3px solid rgba(180,0,0,0.4);
    transition: background 0.2s;
  }
  .piShopCard.live    { border-left-color: #cc0000; background: rgba(180,0,0,0.09); }
  .piShopCard.final   { border-left-color: rgba(100,100,100,0.5); }
  .piShopCard.sched   { border-left-color: rgba(80,80,80,0.4); }
  .piShopCard.upcoming { border-left-color: rgba(0,100,200,0.7); background: rgba(0,60,120,0.07); }
  .piShopLeagueTag { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px; opacity: 0.65; }
  .piShopTeamRow { display: flex; align-items: center; gap: 7px; padding: 3px 0; }
  .piShopTeamLogo { width: 24px; height: 24px; object-fit: contain; flex-shrink: 0; }
  .piShopTeamName { flex: 1; font-weight: 700; font-size: clamp(0.85rem, 1.4vw, 1.05rem); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .piShopTeamScore { font-size: clamp(1rem, 1.7vw, 1.35rem); font-weight: 900; min-width: 28px; text-align: right; font-variant-numeric: tabular-nums; }
  .piShopTeamScore.winner { color: #fff; }
  .piShopTeamScore.loser  { color: #666; }
  .piShopDivider { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }
  .piShopStatusRow { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; flex-wrap: wrap; gap: 4px; }
  .piShopStatusLabel { font-size: clamp(0.72rem, 1.1vw, 0.88rem); font-weight: 800; letter-spacing: 0.07em; color: #999; }
  .piShopStatusLabel.live { color: #ff4444; }
  .piShopStatusLabel.upcoming { color: #4499ff; }
  .piShopMetaRow { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .piShopMetaItem { font-size: clamp(0.65rem, 0.95vw, 0.78rem); color: #666; background: rgba(255,255,255,0.04); border-radius: 4px; padding: 1px 5px; }
  .piShopMetaItem.odds { color: #aaa; }

  /* ---- Series badge ---- */
  .piSeriesLine { margin-top: 5px; }
  .piSeriesBadge {
    display: inline-block; font-size: clamp(0.68rem, 1vw, 0.82rem); font-weight: 800;
    letter-spacing: 0.07em; padding: 2px 8px; border-radius: 5px;
    border: 1px solid rgba(200,160,0,0.35); color: #d4a800; background: rgba(200,160,0,0.15);
  }
  .piSeriesBadge.tied { color: #aaa; background: rgba(180,180,180,0.1); border-color: rgba(180,180,180,0.2); }

  /* ---- No games ---- */
  .piNoGames { grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #444; font-size: 1rem; }

  /* ---- Right panel ---- */
  #piRight {
    grid-column: 2; grid-row: 2;
    display: flex; flex-direction: column;
    overflow: hidden;
    background: linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(10,0,0,0.95) 100%);
  }

  /* ---- Right top (YouTube or countdown) ---- */
  #piRightTop {
    flex-shrink: 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    display: flex; flex-direction: column;
    background: #000;
  }
  #piRightToggle {
    display: flex; gap: 0; border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(0,0,0,0.6); flex-shrink: 0;
  }
  .piRightToggleBtn {
    flex: 1; padding: 6px 4px; font-size: clamp(0.68rem, 1vw, 0.82rem); font-weight: 700;
    cursor: pointer; background: transparent; border: none; border-bottom: 2px solid transparent;
    color: #666; letter-spacing: 0.06em; text-transform: uppercase; transition: all 0.2s;
  }
  .piRightToggleBtn:hover { color: #fff; background: rgba(180,0,0,0.25); }
  .piRightToggleBtn.active { color: #ff4444; border-bottom-color: #cc0000; background: rgba(180,0,0,0.15); }

  #piYoutubeWrap {
    position: relative; width: 100%; aspect-ratio: 16/9; flex-shrink: 0;
    background: #000;
  }
  #piYoutubeWrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }

  #piCountdownWrap {
    padding: 16px 12px; display: flex; flex-direction: column; align-items: center; gap: 10px;
  }
  #piCountdownWrap .piLeafRow { display: flex; align-items: center; gap: 8px; }
  #piCountdownWrap .piLeafImg { width: 32px; height: 32px; object-fit: contain; }
  #piCountdownWrap .piCdBigTitle { font-size: clamp(0.9rem, 1.5vw, 1.15rem); font-weight: 900; letter-spacing: 0.1em; color: #cc0000; text-transform: uppercase; text-align: center; text-shadow: 0 0 8px rgba(200,0,0,0.4); }

  /* ---- Right bottom (news) ---- */
  #piRightBottom {
    flex: 1; overflow-y: auto; padding: 8px 10px;
    scrollbar-width: thin; scrollbar-color: #440000 #0d0000;
  }
  #piRightBottom::-webkit-scrollbar { width: 4px; }
  #piRightBottom::-webkit-scrollbar-track { background: #0d0000; }
  #piRightBottom::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }

  /* ---- Rankings ---- */
  #piTop25List { padding: 4px 0; }
  .piRankHead { font-size: clamp(0.85rem, 1.3vw, 1rem); font-weight: 900; color: #cc0000; letter-spacing: 0.08em; margin-bottom: 8px; }
  .piRankRow { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 5px; margin-bottom: 3px; background: rgba(255,255,255,0.03); }
  .piRankRow:nth-child(odd) { background: rgba(255,255,255,0.05); }
  .piRankNum { font-size: 0.75rem; font-weight: 900; color: #777; min-width: 22px; }
  .piRankLogo { width: 20px; height: 20px; object-fit: contain; }
  .piRankName { flex: 1; font-size: clamp(0.78rem, 1.1vw, 0.9rem); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .piRankRecord { font-size: 0.7rem; color: #666; }

  /* ---- News items ---- */
  .piNewsItem { padding: 8px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.15s; border-radius: 4px; }
  .piNewsItem:hover { background: rgba(255,255,255,0.04); }
  .piNewsHeadline { font-size: clamp(0.78rem, 1.1vw, 0.92rem); font-weight: 700; color: #ddd; line-height: 1.3; margin-bottom: 3px; }
  .piNewsSource { font-size: 0.68rem; color: #555; }

  /* ---- Weather widget ---- */
  #piWeatherWidget { padding: 0 0 8px 0; }
  .piWeatherInner { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); }
  .piWeatherEmoji { font-size: clamp(1.4rem, 2.5vw, 2rem); flex-shrink: 0; }
  .piWeatherData { display: flex; flex-direction: column; gap: 1px; }
  .piWeatherTemp { font-size: clamp(1.1rem, 1.8vw, 1.4rem); font-weight: 900; color: #fff; }
  .piWeatherFeels { font-size: 0.75rem; font-weight: 400; color: #888; margin-left: 6px; }
  .piWeatherLabel { font-size: clamp(0.72rem, 1vw, 0.85rem); color: #aaa; font-weight: 600; }
  .piWeatherMeta { font-size: clamp(0.65rem, 0.9vw, 0.75rem); color: #666; }

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
</style>

<div id="piLayout">
  <!-- Top bar -->
  <div id="piTopBar">
    <div class="piLogo">🏪 The Shop</div>
    <div class="piDivider"></div>
    <div id="piLeagueTabs">
      ${leagueBtns}
    </div>
    <div id="piTopRight">
      <div id="piWeatherWidget"><div class="piWeatherInner"><div class="piWeatherEmoji">🌡️</div><div class="piWeatherData"><div class="piWeatherTemp">--°</div><div class="piWeatherLabel">Loading…</div></div></div></div>
      <button id="piCloseBtn" aria-label="Close scoreboard" title="Close (Esc)">✕</button>
    </div>
  </div>

  <!-- Left: Scores -->
  <div id="piLeft">
    <div id="piPanelHead">
      <span id="piPanelHeadLabel">⭐ Shop Teams</span>
      <span id="piPanelHeadMeta"></span>
    </div>
    <div id="piScoresPanel">
      <div id="piScoresContent"><div class="piNoGames">Loading…</div></div>
    </div>
  </div>

  <!-- Right: YouTube + News/Rankings -->
  <div id="piRight">
    <div id="piRightTop">
      <div id="piRightToggle">
        <button class="piRightToggleBtn${_rightPanel === "youtube" ? " active" : ""}" data-panel="youtube" type="button">📺 Hype Video</button>
        <button class="piRightToggleBtn${_rightPanel === "countdown" ? " active" : ""}" data-panel="countdown" type="button">⏱ Countdown</button>
        <button class="piRightToggleBtn${_rightPanel === "top25" ? " active" : ""}" data-panel="top25" type="button">🏆 CFB Top 25</button>
      </div>
      <div id="piRightTopContent"></div>
    </div>
    <div id="piRightBottom"></div>
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
        _activeLeague = btn.dataset.league;
        document.querySelectorAll(".piLeagueBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const head = document.getElementById("piPanelHeadLabel");
        if (head) {
          head.style.color = "";
          head.style.borderBottomColor = "";
          head.style.textShadow = "";
          head.classList.remove("gold");
          if (_activeLeague === "shop") { head.textContent = "⭐ Shop Teams"; head.classList.add("gold"); }
          else if (_activeLeague === "puttputt") { head.textContent = "⛳ Putt Putt Scorecard"; }
          else { const l = LEAGUES.find(x => x.key === _activeLeague); head.textContent = l ? l.label : _activeLeague.toUpperCase(); }
        }

        _renderScores();
      });
    });
  }

  // ----------------------------------------------------------------
  // Right panel toggle
  // ----------------------------------------------------------------
  function _bindRightToggle() {
    document.querySelectorAll(".piRightToggleBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        _rightPanel = btn.dataset.panel;
        document.querySelectorAll(".piRightToggleBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        _loadRightPanel();
      });
    });
  }

  // ----------------------------------------------------------------
  // Right panel content
  // ----------------------------------------------------------------
  function _loadRightPanel() {
    const el = document.getElementById("piRightTopContent");
    if (!el) return;

    if (_rightPanel === "youtube") {
      el.innerHTML = `
        <div id="piYoutubeWrap">
          <iframe
            src="https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=0&modestbranding=1"
            allow="autoplay; encrypted-media"
            allowfullscreen
          ></iframe>
        </div>`;
    } else if (_rightPanel === "countdown") {
      el.innerHTML = `
        <div id="piCountdownWrap">
          <div class="piLeafRow">
            <img class="piLeafImg" src="${LEAF_URL}" alt="Buckeye Leaf" />
            <img class="piLeafImg" src="${BLOCK_O}" alt="Block O" />
            <img class="piLeafImg" src="${LEAF_URL}" alt="Buckeye Leaf" />
          </div>
          <div class="piCdBigTitle">Days Until The Game</div>
          <div class="piCdUnits">
            <div class="piCdUnit"><div class="piCdNum" id="piCdDays">--</div><div class="piCdLabel">Days</div></div>
            <div class="piCdUnit"><div class="piCdNum" id="piCdHrs">--</div><div class="piCdLabel">Hours</div></div>
            <div class="piCdUnit"><div class="piCdNum" id="piCdMins">--</div><div class="piCdLabel">Mins</div></div>
            <div class="piCdUnit"><div class="piCdNum" id="piCdSecs">--</div><div class="piCdLabel">Secs</div></div>
          </div>
        </div>`;
      _tickCountdown();
    } else if (_rightPanel === "top25") {
      const el2 = document.getElementById("piRightTopContent");
      el2.innerHTML = `<div id="piTop25List"><div class="piRankHead">🏆 CFB AP Top 25</div><div style="color:#555;font-size:0.95rem;padding:16px 0;">Loading rankings…</div></div>`;
      fetch("https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings")
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          const polls = data?.rankings || [];
          const ap = polls.find(p => String(p?.name || "").toLowerCase().includes("ap top 25")) || polls[0];
          const ranks = ap?.ranks || [];
          const list = document.getElementById("piTop25List");
          if (!list) return;
          if (!ranks.length) { list.innerHTML = `<div class="piRankHead">🏆 CFB AP Top 25</div><div style="color:#555;font-size:0.95rem;">Rankings not available.</div>`; return; }
          list.innerHTML = `<div class="piRankHead">🏆 CFB AP Top 25</div>` +
            ranks.slice(0, 25).map(r => {
              const t = r?.team || {};
              const logo = (t.logos || [])[0]?.href || "";
              return `<div class="piRankRow"><span class="piRankNum">${r.current || "?"}</span>${logo ? `<img class="piRankLogo" src="${logo}" alt="" />` : ""}<span class="piRankName">${_esc(t.displayName || t.name || "")}</span><span class="piRankRecord">${_esc(r.recordSummary || "")}</span></div>`;
            }).join("");
        })
        .catch(() => { el.innerHTML = `<div id="piTop25List"><div class="piRankHead">🏆 CFB AP Top 25</div><div style="color:#555;font-size:0.95rem;">Rankings unavailable.</div></div>`; });
    }

    // Always reload news below
    _loadNews();
  }

  function _loadNews() {
    const el = document.getElementById("piRightBottom");
    if (!el) return;
    el.innerHTML = `<div style="color:#444;font-size:0.85rem;padding:10px 4px;">Loading headlines…</div>`;

    const feeds = [
      "https://www.espn.com/espn/rss/news/rss.xml",
      "https://rss.app/feeds/v1.1/TVi2JpvFgH9aINHJ.json",
    ];

    const tried = [];
    function tryNext(i) {
      if (i >= feeds.length) { el.innerHTML = `<div style="color:#444;font-size:0.85rem;padding:10px 4px;">Headlines unavailable.</div>`; return; }
      fetch(feeds[i])
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(text => {
          const items = _parseRSS(text);
          if (!items.length) { tryNext(i + 1); return; }
          el.innerHTML = items.slice(0, 20).map(item =>
            `<div class="piNewsItem" onclick="window.open('${_esc(item.link || "#")}','_blank')">
              <div class="piNewsHeadline">${_esc(item.title || "")}</div>
              <div class="piNewsSource">${_esc(item.source || "ESPN")}</div>
            </div>`
          ).join("");
        })
        .catch(() => tryNext(i + 1));
    }
    tryNext(0);
  }

  function _parseRSS(text) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");
      const items = Array.from(doc.querySelectorAll("item"));
      return items.map(item => ({
        title: item.querySelector("title")?.textContent?.trim() || "",
        link:  item.querySelector("link")?.textContent?.trim() || item.querySelector("link")?.getAttribute("href") || "",
        source: item.querySelector("source")?.textContent?.trim() || "ESPN",
      }));
    } catch { return []; }
  }

  // ----------------------------------------------------------------
  // Countdown tick
  // ----------------------------------------------------------------
  function _startCountdown() {
    _tickCountdown();
    _intervals.push(setInterval(_tickCountdown, COUNTDOWN_TICK_MS));
  }

  function _tickCountdown() {
    const now  = new Date();
    const diff = THE_GAME_DATE.getTime() - now.getTime();
    if (diff <= 0) return;

    const days = Math.floor(diff / 86400000);
    const hrs  = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v).padStart(2, "0"); };
    set("piCdDays", days);
    set("piCdHrs",  hrs);
    set("piCdMins", mins);
    set("piCdSecs", secs);
  }

  // ----------------------------------------------------------------
  // Scores dispatch
  // ----------------------------------------------------------------
  function _renderScores() {
    const meta = document.getElementById("piPanelHeadMeta");
    if (meta) meta.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if      (_activeLeague === "shop")     _renderShopTeams();
    else if (_activeLeague === "pga")      _renderPGA();
    else if (_activeLeague === "puttputt") _renderPuttPutt();
    else                                   _renderLeagueScores();
  }

  // ----------------------------------------------------------------
  // PGA
  // ----------------------------------------------------------------
  async function _renderPGA() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading PGA Tour…</div>`;

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
    el.innerHTML = `<div class="piNoGames">Loading…</div>`;

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

    // Hydrate odds in background
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
  // Putt Putt — Firebase auth-safe loader
  // ----------------------------------------------------------------

  // Wait for Firebase anonymous auth to settle before querying Firestore.
  // The Pi TV browser loads the page without going through the normal login flow,
  // so auth may still be pending when the Putt Putt button is pressed.
  function _waitForFirebaseAuth(timeoutMs = 6000) {
    return new Promise((resolve) => {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) { resolve(false); return; }
      const auth = firebase.auth();
      if (auth.currentUser) { resolve(true); return; }
      let settled = false;
      const unsub = auth.onAuthStateChanged((user) => {
        if (settled) return;
        settled = true;
        unsub();
        resolve(!!user);
      });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        try { unsub(); } catch {}
        resolve(false);
      }, timeoutMs);
    });
  }

  async function _renderPuttPutt() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading Putt Putt round…</div>`;

    // Update panel head
    const head = document.getElementById("piPanelHeadLabel");
    if (head) { head.textContent = "⛳ Putt Putt Scorecard"; head.classList.remove("gold"); head.style.color = "#00cc66"; head.style.borderBottomColor = "rgba(0,180,80,0.4)"; head.style.textShadow = "0 0 6px rgba(0,200,80,0.4)"; }

    // Ensure Firebase is initialized
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      if (window.FIREBASE_CONFIG) {
        try { firebase.initializeApp(window.FIREBASE_CONFIG); } catch {}
      }
    }

    // Wait for anonymous auth to settle before hitting Firestore
    const authed = await _waitForFirebaseAuth(6000);
    if (!authed) {
      try {
        await firebase.auth().signInAnonymously();
      } catch {}
    }

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
      console.error("PuttPutt load error:", e);
      el.innerHTML = `<div class="piPuttNoRound">Could not load round data. (${e?.code || e?.message || "unknown error"})</div>`;
    }
  }

  function _buildPiPuttScorecardHTML(round) {
    const pars     = round.holePars || [];
    const players  = round.players  || [];
    const totalPar = pars.reduce((a,b) => a+b, 0);
    const isLive   = round.status !== "complete";

    // Build per-player totals
    const playerTotals = players.map(p => {
      const holes = round.scores?.[p]?.holes || [];
      const total = holes.reduce((s, v) => s + (v != null ? Number(v) : 0), 0);
      const played = holes.filter(v => v != null).length;
      return { name: p, holes, total, played };
    });

    // Leader line
    const finished = playerTotals.filter(p => p.played > 0);
    let leaderText = "";
    if (finished.length) {
      const sorted = [...finished].sort((a, b) => a.total - b.total);
      const leader = sorted[0];
      const rel = leader.total - totalPar;
      const relStr = rel === 0 ? "E" : rel > 0 ? `+${rel}` : `${rel}`;
      leaderText = isLive
        ? `${_esc(leader.name)} leads — ${relStr} (Hole ${leader.played}/${pars.length})`
        : `🏆 ${_esc(leader.name)} wins — ${relStr}`;
    }

    const numHoles = pars.length;
    const holeHeaders = pars.map((_, i) => `<th>${i + 1}</th>`).join("");
    const parCells    = pars.map(p => `<td>${p}</td>`).join("");

    const playerRows = playerTotals.map(pt => {
      const holeCells = pars.map((par, i) => {
        const score = pt.holes[i];
        if (score == null) return `<td class="pi-sc-empty">—</td>`;
        const diff = Number(score) - Number(par);
        const cls  = diff < 0 ? "pi-sc-under" : diff > 0 ? "pi-sc-over" : "pi-sc-even";
        return `<td class="${cls}">${score}</td>`;
      }).join("");

      const rel = pt.played > 0 ? pt.total - pars.slice(0, pt.played).reduce((a,b)=>a+b,0) : null;
      const relStr = rel == null ? "—" : rel === 0 ? "E" : rel > 0 ? `+${rel}` : `${rel}`;
      const totalCls = rel == null ? "pi-sc-empty" : rel < 0 ? "pi-sc-under" : rel > 0 ? "pi-sc-over" : "pi-sc-even";

      return `<tr>
        <td class="piPuttNameCol">${_esc(pt.name)}</td>
        ${holeCells}
        <td class="piPuttTotalCol ${totalCls}">${pt.played > 0 ? pt.total : "—"}</td>
        <td class="piPuttTotalCol ${totalCls}">${relStr}</td>
      </tr>`;
    }).join("");

    return `
      <div class="piPuttHeader">
        <span class="piPuttCourseName">⛳ ${_esc(round.courseName || "Putt Putt")}</span>
        <span class="piPuttStatus ${isLive ? "live" : "final"}">${isLive ? "🔴 LIVE" : "✅ FINAL"}</span>
      </div>
      <div class="piPuttScTableWrap">
        <table class="piPuttScorecard">
          <thead>
            <tr>
              <th class="piPuttNameCol">Player</th>
              ${holeHeaders}
              <th>Score</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            <tr class="piPuttParRow">
              <td class="piPuttNameCol">Par</td>
              ${parCells}
              <td>${totalPar}</td>
              <td>—</td>
            </tr>
            ${playerRows}
          </tbody>
        </table>
      </div>
      ${leaderText ? `<div class="piPuttLeader">${leaderText}</div>` : ""}
    `;
  }

  // ----------------------------------------------------------------
  // Shop Team helpers
  // ----------------------------------------------------------------
  function _isShopTeam(team) {
    if (!team) return false;
    const ids = [
      team.displayName,
      team.shortDisplayName,
      team.name,
      team.location && team.name ? `${team.location} ${team.name}` : null,
      team.abbreviation,
    ].filter(Boolean).map(s => String(s).trim().toLowerCase().replace(/\s+/g, " "));
    return ids.some(id => SHOP_TEAMS_NORM.includes(id));
  }

  function _shopTeamKey(team) {
    if (!team) return "";
    const ids = [
      team.displayName,
      team.shortDisplayName,
      team.location && team.name ? `${team.location} ${team.name}` : null,
      team.name,
    ].filter(Boolean).map(s => String(s).trim().toLowerCase().replace(/\s+/g, " "));
    for (const id of ids) { if (SHOP_TEAMS_NORM.includes(id)) return id; }
    return ids[0] || "";
  }

  function _eventHasShopTeam(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    return (comp?.competitors || []).some(c => _isShopTeam(c?.team));
  }

  function _shopTeamRank(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    const competitors = comp?.competitors || [];
    for (const c of competitors) {
      const key = _shopTeamKey(c?.team);
      const idx = SHOP_TEAMS_NORM.indexOf(key);
      if (idx >= 0) return idx;
    }
    return Infinity;
  }

  // ----------------------------------------------------------------
  // Card builder
  // ----------------------------------------------------------------
  function _buildShopCard(leagueKey, leagueLabel, ev, favored, ou, upcoming) {
    const comp        = (ev?.competitions || [])[0] || {};
    const competitors = comp?.competitors || [];
    const home = competitors.find(c => c.homeAway === "home") || competitors[0] || {};
    const away = competitors.find(c => c.homeAway === "away") || competitors[1] || {};

    const state = _getState(ev);
    const done  = comp?.status?.type?.completed;

    let cls = upcoming ? "upcoming" : "sched";
    let statusLabel = ev.date ? _fmtTime(ev.date) : "Scheduled";
    if (upcoming) statusLabel = "📆 " + (ev.date ? _fmtGameDate(ev.date) : "Upcoming");
    if (!upcoming && state === "in")             { cls = "live";  statusLabel = `${_getPeriodLabel(leagueKey, comp)} ${_getClock(comp)}`; }
    if (!upcoming && (state === "post" || done)) { cls = "final"; statusLabel = "Final"; }

    const statusCls  = cls === "live" ? " live" : cls === "upcoming" ? " upcoming" : "";
    const eventId    = String(ev?.id || "");
    const dataAttr   = eventId ? ` data-eventid="${eventId}"` : "";

    const homeScore  = state !== "pre" && !upcoming ? (home?.score ?? "—") : "";
    const awayScore  = state !== "pre" && !upcoming ? (away?.score ?? "—") : "";

    const homeWinner = !upcoming && (state === "post" || done) && Number(home?.score) > Number(away?.score);
    const awayWinner = !upcoming && (state === "post" || done) && Number(away?.score) > Number(home?.score);

    function teamRow(c, score, isWinner, isLoser) {
      const team  = c?.team || {};
      const logo  = (team.logos || [])[0]?.href || team.logo || "";
      const name  = _getTeamDisplayName(team);
      const scoreCls = isWinner ? " winner" : isLoser ? " loser" : "";
      return `
        <div class="piShopTeamRow">
          ${logo ? `<img class="piShopTeamLogo" src="${logo}" alt="" loading="lazy" />` : ""}
          <span class="piShopTeamName">${_esc(name)}</span>
          <span class="piShopTeamScore${scoreCls}">${score}</span>
        </div>`;
    }

    const venue = comp?.venue?.fullName || comp?.venue?.name || "";
    const gameDateStr = !upcoming && ev?.date ? _fmtShortDate(ev.date) : "";
    const oddsText = (favored || ou) ? _buildOddsLine(favored || "", ou || "") : "";

    const series = null; // hydrated async below for playoff leagues

    return `
<div class="piShopCard ${cls}"${dataAttr}>
  <div class="piShopLeagueTag">${_esc(leagueLabel)}</div>
  ${teamRow(away, awayScore, awayWinner, homeWinner)}
  <div class="piShopDivider"></div>
  ${teamRow(home, homeScore, homeWinner, awayWinner)}
  <div class="piShopStatusRow">
    <span class="piShopStatusLabel${statusCls}">${_esc(statusLabel)}</span>
  </div>
  <div class="piShopMetaRow">
    ${venue ? `<span class="piShopMetaItem">📍 ${_esc(venue)}</span>` : ""}
    ${!upcoming && gameDateStr ? `<span class="piShopMetaItem">📅 ${_esc(gameDateStr)}</span>` : ""}
    <span class="piShopMetaItem odds">${oddsText ? _esc(oddsText) : (state === "pre" || upcoming ? "Fetching lines…" : "")}</span>
  </div>
  <div class="piSeriesLine"></div>
</div>`;
  }

  function _getPeriodLabel(leagueKey, comp) {
    const period = comp?.status?.period || 1;
    switch (leagueKey) {
      case "cfb": case "nfl":   return `Q${period}`;
      case "nba": case "ncaam": return `Q${period}`;
      case "nhl":               return `P${period}`;
      case "mlb":               return `Inn${period}`;
      case "mls":               return `${period}'`;
      default:                  return `${period}`;
    }
  }

  function _getClock(comp) {
    return comp?.status?.displayClock || comp?.status?.type?.shortDetail || "";
  }

  function _getState(ev) {
    return String(ev?.status?.type?.state || ev?.competitions?.[0]?.status?.type?.state || "pre").toLowerCase();
  }

  function _getTeamDisplayName(team) {
    if (!team) return "";
    const full   = String(team.displayName || "").toLowerCase();
    const id     = String(team.id || "");
    const abbrev = String(team.abbreviation || "").toLowerCase();

    if (full.includes("michigan wolverines") || id === "130") return "The Team Up North";
    if (full.includes("north carolina tar heels") || abbrev === "unc" || id === "153") return "Paper Classes U";

    return team.displayName || team.name || "";
  }

  // ----------------------------------------------------------------
  // Odds helpers
  // ----------------------------------------------------------------
  function _parseOddsFromSummary(summaryData, fallbackComp) {
    const pcArr = summaryData?.pickcenter;
    if (Array.isArray(pcArr) && pcArr.length) {
      const comp = summaryData?.header?.competitions?.[0] || fallbackComp || null;
      const competitors = comp?.competitors || [];
      const home = competitors.find(t => t.homeAway === "home");
      const away = competitors.find(t => t.homeAway === "away");
      const homeName = home?.team?.displayName || "Home";
      const awayName = away?.team?.displayName || "Away";
      const parsed = _parseOddsFromPickcenter(pcArr[0], homeName, awayName);
      if (parsed.favored || parsed.ou) return parsed;
    }
    const sc0 = summaryData?.header?.competitions?.[0] || fallbackComp || null;
    const o = (sc0?.odds || [])[0] || (sc0?.pickcenter || [])[0] || null;
    if (o) {
      return {
        favored: String(o.details || o.displayValue || "").trim().replace(/^Line:\s*/i, ""),
        ou: String(o.overUnder ?? o.total ?? "").trim()
      };
    }
    return { favored: "", ou: "" };
  }

  function _parseOddsFromPickcenter(pc, homeName, awayName) {
    if (!pc) return { favored: "", ou: "" };
    const ou = String(pc.overUnder ?? pc.total ?? "").trim();
    const details = String(pc.details || pc.displayValue || "").trim().replace(/^Line:\s*/i, "");
    if (details) return { favored: details, ou };
    const spread = Number(pc.spread ?? pc.line ?? pc.handicap);
    if (!Number.isFinite(spread)) return { favored: "", ou: "" };
    const homeFav = !!pc.homeTeamOdds?.favorite;
    const awayFav = !!pc.awayTeamOdds?.favorite;
    let fav = "";
    if (homeFav) fav = homeName;
    else if (awayFav) fav = awayName;
    else fav = spread < 0 ? homeName : awayName;
    const abs = Math.abs(spread);
    return { favored: `${fav} -${abs % 1 === 0 ? abs.toFixed(0) : abs}`, ou };
  }

  function _buildOddsLine(favored, ou) {
    const hasFav = favored && favored !== "-";
    const hasOu  = ou && ou !== "-";
    if (hasFav && hasOu) return `Favored: ${favored} • O/U: ${ou}`;
    if (hasFav) return `Favored: ${favored}`;
    if (hasOu)  return `O/U: ${ou}`;
    return "";
  }

  // ----------------------------------------------------------------
  // Series / Playoff helper
  // ----------------------------------------------------------------
  function _parseSeriesFromSummary(summaryData, fallbackComp) {
    const comp = summaryData?.header?.competitions?.[0] || fallbackComp || null;
    if (!comp) return null;
    const series = comp?.series || comp?.seriesSummary || summaryData?.series || null;
    if (!series) return null;
    const competitors = comp?.competitors || [];
    const home = competitors.find(c => c.homeAway === "home");
    const away = competitors.find(c => c.homeAway === "away");
    const homeWins = Number(series?.competitors?.find(c => c.homeAway === "home")?.wins ?? home?.seriesWins ?? 0);
    const awayWins = Number(series?.competitors?.find(c => c.homeAway === "away")?.wins ?? away?.seriesWins ?? 0);
    const summary = String(series?.summary || series?.displayValue || "").trim();
    if (!summary && homeWins === 0 && awayWins === 0) return null;
    return { homeWins, awayWins, summary };
  }

  function _buildSeriesHTML(series) {
    if (!series) return "";
    const text = series.summary || `Series: ${series.homeWins}-${series.awayWins}`;
    const isTied = series.homeWins === series.awayWins;
    return `<span class="piSeriesBadge${isTied ? " tied" : ""}">${_esc(text)}</span>`;
  }

  // ----------------------------------------------------------------
  // Utility
  // ----------------------------------------------------------------
  function _todayStr() { return _dateStr(new Date()); }
  function _dateStr(d) {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}${mm}${dd}`;
  }
  function _fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
  }
  function _fmtShortDate(iso) {
    try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" }); } catch { return ""; }
  }
  function _fmtGameDate(iso) { try { return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); } catch { return ""; } }
  function _esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

})();
