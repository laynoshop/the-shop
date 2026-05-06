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

  // Per-league lookahead windows for Shop Teams (days ahead to search when no game today).
  // mls/nfl/cfb use 7 so that from Tuesday onward the full upcoming week is visible.
  const LOOKAHEAD_DAYS = {
    cfb:   7,
    nfl:   7,
    nhl:   3,
    nba:   3,
    mlb:   3,
    ncaam: 3,
    mls:   7,
    pga:   0,
    ufc:   3,
  };

  // Leagues that show the "upcoming week" window when it's Tuesday or later.
  // These are primarily weekend-schedule leagues (MLS, NFL, CFB).
  const WEEK_PREVIEW_LEAGUES = new Set(["mls", "nfl", "cfb"]);

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
    if (code >= 85 && code <= 86)        return { emoji: "🌨️",                   label: "Snow Showers",                                  bg: "rgba(180,220,255,0.15)" };
    if (code >= 95 && code <= 99)        return { emoji: "⛈️",                   label: "Thunderstorm",                                  bg: "rgba(60,20,120,0.18)" };
    return { emoji: "🌡️", label: "Unknown", bg: "rgba(100,100,100,0.1)" };
  }

  // ----------------------------------------------------------------
  // Shell HTML
  // ----------------------------------------------------------------
  function buildShell() {
    const leagueBtns = LEAGUES.map(l =>
      `<button class="piLeagueBtn${_activeLeague === l.key ? " active" : ""}" data-league="${l.key}">${l.label}</button>`
    ).join("");

    return `
<style>
  #piScoreboard * { box-sizing: border-box; margin: 0; padding: 0; }
  #piScoreboard {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0a0a0a; color: #e8e8e8; display: flex; flex-direction: column;
    height: 100vh; width: 100vw; overflow: hidden;
  }
  .piTopBar {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 16px; background: #111; border-bottom: 1px solid #222;
    flex-shrink: 0;
  }
  .piTopBarLeft { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .piTopBarRight { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .piLogo { font-size: 1.2rem; font-weight: 800; color: #fff; white-space: nowrap; }
  #piWeatherWidget { flex-shrink: 0; }
  .piWeatherInner { display: flex; align-items: center; gap: 8px; padding: 4px 10px; border-radius: 8px; }
  .piWeatherEmoji { font-size: 1.4rem; }
  .piWeatherData { display: flex; flex-direction: column; }
  .piWeatherTemp { font-size: 1rem; font-weight: 700; }
  .piWeatherFeels { font-size: 0.75rem; color: #aaa; margin-left: 6px; font-weight: 400; }
  .piWeatherLabel { font-size: 0.72rem; color: #bbb; }
  .piWeatherMeta  { font-size: 0.68rem; color: #888; }
  .piCloseBtn {
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
    color: #fff; border-radius: 6px; padding: 5px 12px; cursor: pointer; font-size: 0.82rem;
  }
  .piCloseBtn:hover { background: rgba(255,255,255,0.14); }
  .piLeagueTabs {
    display: flex; gap: 6px; padding: 8px 16px;
    background: #0e0e0e; border-bottom: 1px solid #1e1e1e;
    flex-shrink: 0; flex-wrap: wrap;
  }
  .piLeagueBtn {
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    color: #ccc; border-radius: 6px; padding: 5px 12px; cursor: pointer;
    font-size: 0.82rem; transition: background 0.15s, color 0.15s;
  }
  .piLeagueBtn:hover  { background: rgba(255,255,255,0.12); color: #fff; }
  .piLeagueBtn.active { background: #bb0000; border-color: #cc2222; color: #fff; }
  .piShopTeamsBtn.active { background: linear-gradient(135deg, #a07800, #7a5500); border-color: #c89a00; box-shadow: 0 0 10px rgba(200,160,0,0.5); }
  .piMain { display: flex; flex: 1; overflow: hidden; }
  .piLeft  { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 0; }
  .piRight { width: 380px; flex-shrink: 0; border-left: 1px solid #1e1e1e; display: flex; flex-direction: column; overflow: hidden; }
  .piRightHeader { display: flex; border-bottom: 1px solid #1e1e1e; background: #0e0e0e; flex-shrink: 0; }
  .piRightTab { flex: 1; padding: 8px; text-align: center; cursor: pointer; font-size: 0.78rem; color: #888; border: none; background: none; }
  .piRightTab:hover { color: #ccc; }
  .piRightTab.active { color: #fff; border-bottom: 2px solid #bb0000; }
  .piRightContent { flex: 1; overflow-y: auto; padding: 12px; }
  .piNoGames { color: #555; font-size: 0.88rem; padding: 20px; text-align: center; }

  /* Countdown */
  .piCdBlock { display: flex; flex-direction: column; align-items: center; padding: 6px 10px; }
  .piCdVal  { font-size: 1.5rem; font-weight: 800; line-height: 1; }
  .piCdLbl  { font-size: 0.6rem; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
  .piCdSep  { font-size: 1.4rem; font-weight: 800; padding-bottom: 2px; }
  #piCdContainer { display: flex; align-items: center; gap: 0; }
  .piCdTitle { font-size: 0.7rem; color: #bb0000; text-transform: uppercase; letter-spacing: 0.08em; margin-right: 6px; font-weight: 700; }

  /* Shop card */
  .piShopCard {
    border-left: 3px solid #333; border-radius: 8px;
    padding: 10px 12px; margin-bottom: 8px;
    background: rgba(255,255,255,0.03);
    transition: background 0.2s;
  }
  .piShopCard.live   { border-left-color: #22cc44; background: rgba(0,80,0,0.07); }
  .piShopCard.final  { border-left-color: #555; }
  .piShopCard.upcoming { border-left-color: rgba(0,100,200,0.7); background: rgba(0,60,120,0.07); }
  .piShopCardTop { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .piShopLeagueTag { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; }
  .piShopStatusLabel { font-size: 0.72rem; font-weight: 700; }
  .piShopStatusLabel.live  { color: #22cc44; }
  .piShopStatusLabel.upcoming { color: #4499ff; }
  .piShopStatusLabel.final { color: #777; }
  .piShopTeamsRow { display: flex; flex-direction: column; gap: 4px; }
  .piShopTeamLine { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .piShopTeamLineLeft { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .piShopTeamLogo { width: 30px; height: 30px; object-fit: contain; flex-shrink: 0; border-radius: 3px; }
  .piShopTeamNameFull {
    font-size: 0.88rem; font-weight: 600; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; max-width: 160px;
  }
  .piShopTeamNameFull.fav { color: #ffcc66; }
  .piShopTeamRecord { font-size: 0.85rem; color: #666; white-space: nowrap; flex-shrink: 0; }
  .piShopTeamScore {
    font-size: 1.1rem; font-weight: 800; min-width: 34px; text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .piShopMeta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; font-size: 0.68rem; color: #666; }
  .piShopMetaItem { white-space: nowrap; }
  .piShopMetaItem.odds { color: #aaa; }
  .piSeriesLine { margin-top: 4px; font-size: 0.72rem; color: #88aacc; }
  .piSectionHeader { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #aaa; padding: 8px 10px 4px; margin-top: 6px; border-bottom: 1px solid rgba(255,255,255,0.08); }

  /* News */
  .piNewsItem { padding: 8px 0; border-bottom: 1px solid #1a1a1a; }
  .piNewsItem:last-child { border-bottom: none; }
  .piNewsHeadline { font-size: 0.82rem; font-weight: 600; line-height: 1.35; margin-bottom: 3px; }
  .piNewsSource   { font-size: 0.68rem; color: #666; }

  /* YouTube */
  #piYouTubeFrame { width: 100%; height: 100%; border: none; }

  /* Buckeye leaf floaters */
  @keyframes piLeafFall {
    0%   { transform: translateY(-60px) rotate(0deg) scale(0.8); opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(100vh) rotate(720deg) scale(1.1); opacity: 0; }
  }
  .piLeaf { position: fixed; pointer-events: none; z-index: 10000; animation: piLeafFall linear forwards; }
  @keyframes piCountdownPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .piCdPulse { animation: piCountdownPulse 1s ease-in-out infinite; }
</style>

<div class="piTopBar">
  <div class="piTopBarLeft">
    <span class="piLogo">🏪 The Shop</span>
    <span id="piCdTitle" class="piCdTitle">THE GAME</span>
    <div id="piCdContainer">
      <div class="piCdBlock"><span id="piCdD" class="piCdVal">--</span><span class="piCdLbl">Days</span></div>
      <span class="piCdSep">:</span>
      <div class="piCdBlock"><span id="piCdH" class="piCdVal">--</span><span class="piCdLbl">Hrs</span></div>
      <span class="piCdSep">:</span>
      <div class="piCdBlock"><span id="piCdM" class="piCdVal">--</span><span class="piCdLbl">Min</span></div>
      <span class="piCdSep">:</span>
      <div class="piCdBlock"><span id="piCdS" class="piCdVal">--</span><span class="piCdLbl">Sec</span></div>
    </div>
    <div id="piWeatherWidget"></div>
  </div>
  <div class="piTopBarRight">
    <button id="piCloseBtn" class="piCloseBtn">✕ Exit</button>
  </div>
</div>

<div class="piLeagueTabs">
  ${[
    `<button class="piLeagueBtn piShopTeamsBtn${_activeLeague === "shop" ? " active" : ""}" data-league="shop">Shop Teams</button>`,
    ...LEAGUES.map(l => `<button class="piLeagueBtn${_activeLeague === l.key ? " active" : ""}" data-league="${l.key}">${l.label}</button>`)
  ].join("")}
</div>

<div class="piMain">
  <div class="piLeft">
    <div id="piScoresContent"><div class="piNoGames">Loading…</div></div>
  </div>
  <div class="piRight">
    <div class="piRightHeader">
      <button class="piRightTab${_rightPanel === "youtube" ? " active" : ""}" data-panel="youtube">📺 YouTube</button>
      <button class="piRightTab${_rightPanel === "news"    ? " active" : ""}" data-panel="news">📰 News</button>
    </div>
    <div class="piRightContent" id="piRightContent"></div>
  </div>
</div>`;
  }

  // ----------------------------------------------------------------
  // League button binding
  // ----------------------------------------------------------------
  function _bindLeagueButtons() {
    const overlay = document.getElementById("piScoreboard");
    if (!overlay) return;
    overlay.querySelectorAll(".piLeagueBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        _activeLeague = btn.dataset.league;
        overlay.querySelectorAll(".piLeagueBtn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        _renderScores();
      });
    });
  }

  // ----------------------------------------------------------------
  // Right panel toggle
  // ----------------------------------------------------------------
  function _bindRightToggle() {
    const overlay = document.getElementById("piScoreboard");
    if (!overlay) return;
    overlay.querySelectorAll(".piRightTab").forEach(tab => {
      tab.addEventListener("click", () => {
        _rightPanel = tab.dataset.panel;
        overlay.querySelectorAll(".piRightTab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        _loadRightPanel();
      });
    });
  }

  async function _loadRightPanel() {
    const el = document.getElementById("piRightContent");
    if (!el) return;
    if (_rightPanel === "youtube") {
      el.style.padding = "0";
      el.innerHTML = `<iframe id="piYouTubeFrame" src="https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
      return;
    }
    el.style.padding = "12px";
    el.innerHTML = `<div class="piNoGames">Loading news…</div>`;
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/news?limit=20`;
      const data = await fetch(url).then(r => r.ok ? r.json() : Promise.reject());
      const articles = data?.articles || [];
      if (!articles.length) { el.innerHTML = `<div class="piNoGames">No news available.</div>`; return; }
      el.innerHTML = articles.slice(0, 20).map(a => `
        <div class="piNewsItem">
          <div class="piNewsHeadline">${_esc(a.headline || a.title || "")}</div>
          <div class="piNewsSource">${_esc(a.source || a.byline || "ESPN")}</div>
        </div>
      `).join("");
    } catch {
      el.innerHTML = `<div class="piNoGames">News unavailable.</div>`;
    }
  }

  // ----------------------------------------------------------------
  // Countdown
  // ----------------------------------------------------------------
  function _startCountdown() {
    function tick() {
      const now  = new Date();
      const diff = THE_GAME_DATE - now;

      const daysEl = document.getElementById("piCdD");
      const cdCont = document.getElementById("piCdContainer");

      if (diff <= 0) {
        // The Game has passed — show days since TTUN last won
        const since = _daysSince(LAST_TTUN_WIN);
        if (daysEl) daysEl.textContent = since;
        const titleEl = document.getElementById("piCdTitle");
        if (titleEl) titleEl.textContent = "DAYS SINCE TTUN WIN";
        const hEl = document.getElementById("piCdH"); if (hEl) hEl.closest(".piCdBlock").style.display = "none";
        const mEl = document.getElementById("piCdM"); if (mEl) mEl.closest(".piCdBlock").style.display = "none";
        const sEl = document.getElementById("piCdS"); if (sEl) sEl.closest(".piCdBlock").style.display = "none";
        cdCont.querySelectorAll(".piCdSep").forEach(s => s.style.display = "none");
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hrs  = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      const d = document.getElementById("piCdD"); if (d) d.textContent = String(days);
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
    if (_activeLeague === "shop") _renderShopTeams();
    else if (_activeLeague === "pga") _renderPGA();
    else _renderLeagueScores();
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
    el.innerHTML = `<div class="piNoGames">Loading&hellip;</div>`;

    // ── MLS: show the full weekend window (Fri–Sun) plus any midweek games ──
    if (_activeLeague === "mls") {
      await _renderMLSWeekend(el, league);
      return;
    }

    const date   = _todayStr();
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
  // MLS — Weekend window + midweek games
  // Shows Fri/Sat/Sun of the current/nearest weekend.
  // If midweek games exist in the next 5 days they are appended.
  // ----------------------------------------------------------------
  async function _renderMLSWeekend(el, league) {
    const now  = new Date();
    const dow  = now.getDay(); // 0=Sun … 6=Sat

    // ── Determine the Fri/Sat/Sun window for this weekend ──
    // If today is Mon–Thu we look forward to the coming weekend.
    // If today is Fri/Sat/Sun we show the current weekend.
    // If today is Sun we also look back to include Fri/Sat (already passed).
    function offsetDate(base, offsetDays) {
      const d = new Date(base);
      d.setDate(d.getDate() + offsetDays);
      return d;
    }

    let fridayDate;
    if (dow === 0)       fridayDate = offsetDate(now, -2); // Sun → prev Fri
    else if (dow === 1)  fridayDate = offsetDate(now,  4); // Mon → next Fri
    else if (dow === 2)  fridayDate = offsetDate(now,  3); // Tue → next Fri
    else if (dow === 3)  fridayDate = offsetDate(now,  2); // Wed → next Fri
    else if (dow === 4)  fridayDate = offsetDate(now,  1); // Thu → next Fri
    else if (dow === 5)  fridayDate = offsetDate(now,  0); // Fri → today
    else                 fridayDate = offsetDate(now, -1); // Sat → prev Fri

    const weekendDates = [
      _dateStr(fridayDate),
      _dateStr(offsetDate(fridayDate, 1)),
      _dateStr(offsetDate(fridayDate, 2)),
    ];

    // ── Also look for midweek games in the next 5 days (Mon–Thu) ──
    const midweekDates = [];
    for (let i = 0; i <= 5; i++) {
      const d    = offsetDate(now, i);
      const dDow = d.getDay();
      const ds   = _dateStr(d);
      // Mon(1), Tue(2), Wed(3), Thu(4) only; skip if already in weekend window
      if (dDow >= 1 && dDow <= 4 && !weekendDates.includes(ds)) {
        midweekDates.push(ds);
      }
    }

    const allDates = [...weekendDates, ...midweekDates];

    // Fetch all dates in parallel
    const fetches = allDates.map(d =>
      fetch(league.url(d))
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => ({ date: d, events: data?.events || [] }))
        .catch(() => ({ date: d, events: [] }))
    );

    const results = await Promise.allSettled(fetches);

    // Deduplicate by event ID; preserve date-order
    const seen    = new Set();
    const weekend = [];
    const midweek = [];

    for (const res of results) {
      if (res.status !== "fulfilled") continue;
      const { date: ds, events } = res.value;
      const isMidweek = midweekDates.includes(ds);
      for (const ev of events) {
        const id = String(ev?.id || ev?.uid || "");
        if (!id || seen.has(id)) continue;
        seen.add(id);
        if (isMidweek) midweek.push(ev);
        else           weekend.push(ev);
      }
    }

    // Sort each group: live first, then pre by time, then final
    function sortGroup(arr) {
      return arr.sort((a, b) => {
        const sa = _getState(a), sb = _getState(b);
        const rank = s => s === "in" ? 0 : s === "pre" ? 1 : 2;
        if (rank(sa) !== rank(sb)) return rank(sa) - rank(sb);
        return new Date(a.date || 0) - new Date(b.date || 0);
      });
    }
    sortGroup(weekend);
    sortGroup(midweek);

    if (!weekend.length && !midweek.length) {
      el.innerHTML = `<div class="piNoGames">No MLS matches found for this window.</div>`;
      return;
    }

    // Build HTML — weekend section, then midweek section if present
    let html = "";
    if (weekend.length) {
      const fri = fridayDate.toLocaleDateString([], { month: "short", day: "numeric" });
      const sun = offsetDate(fridayDate, 2).toLocaleDateString([], { month: "short", day: "numeric" });
      html += `<div class="piSectionHeader">⚽ Weekend Matches — ${fri}–${sun}</div>`;
      html += weekend.map(ev => _buildShopCard("mls", "MLS", ev, null, null)).join("");
    }
    if (midweek.length) {
      html += `<div class="piSectionHeader">⚽ Midweek Matches</div>`;
      html += midweek.map(ev => _buildShopCard("mls", "MLS", ev, null, null)).join("");
    }

    el.innerHTML = html;

    // Hydrate odds via summary
    const allEvents = [...weekend, ...midweek];
    const CONCURRENCY = 4;
    let idx = 0;
    async function worker() {
      while (idx < allEvents.length) {
        const i = idx++;
        const ev = allEvents[i];
        const eventId = String(ev?.id || "");
        if (!eventId) continue;
        try {
          const data = await fetch(SUMMARY_URLS.mls(eventId)).then(r => r.ok ? r.json() : null);
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

  // ----------------------------------------------------------------
  // Shop Teams
  // ----------------------------------------------------------------
  async function _renderShopTeams() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading Shop Teams&hellip;</div>`;

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
      // From Tuesday onward, WEEK_PREVIEW_LEAGUES (mls/nfl/cfb) get the full
      // 7-day lookahead so the upcoming weekend's games show on Shop Teams.
      // Monday and earlier keep a tight 3-day window to avoid showing games
      // that are too far out.
      const isTuesdayOrLater = now.getDay() >= 2; // 0=Sun,1=Mon,2=Tue...

      const lookaheadFetches = [];
      for (const lg of LEAGUES) {
        const baseDays = LOOKAHEAD_DAYS[lg.key] || 0;
        if (!baseDays) continue;
        // For WEEK_PREVIEW_LEAGUES, cap at 3 before Tuesday, use full window from Tue onward
        const days = (WEEK_PREVIEW_LEAGUES.has(lg.key) && !isTuesdayOrLater) ? Math.min(baseDays, 3) : baseDays;
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

  function _eventHasShopTeam(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    return (comp?.competitors || []).some(c => _isShopTeam(c?.team));
  }

  function _isShopTeam(team) {
    if (!team) return false;
    const display  = String(team.displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
    const shortDis = String(team.shortDisplayName || "").trim().toLowerCase().replace(/\s+/g, " ");
    const name     = String(team.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    const location = String(team.location || "").trim().toLowerCase().replace(/\s+/g, " ");
    const combo    = location && name ? `${location} ${name}` : "";
    return SHOP_TEAMS_NORM.some(t =>
      t === display || t === shortDis || t === name || t === combo ||
      (display && display.includes(t)) || (t && t.includes(display))
    );
  }

  function _shopTeamKey(team) {
    return String(team?.displayName || team?.name || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function _shopTeamRank(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    for (const c of (comp?.competitors || [])) {
      const displayName = _shopTeamKey(c?.team);
      const i = SHOP_TEAMS_NORM.findIndex(t => t === displayName || displayName.includes(t) || t.includes(displayName));
      if (i >= 0) return i;
    }
    return 999;
  }

  // ----------------------------------------------------------------
  // State helpers
  // ----------------------------------------------------------------
  function _getState(ev) {
    return String(ev?.status?.type?.state || ev?.competitions?.[0]?.status?.type?.state || "unknown");
  }

  function _getStatusDetail(ev) {
    return String(ev?.status?.type?.detail || ev?.competitions?.[0]?.status?.type?.detail || "");
  }

  function _getPeriodLabel(ev, leagueKey) {
    const comp = ev?.competitions?.[0] || {};
    const status = comp?.status || ev?.status || {};
    const period = Number(status?.period ?? status?.displayClock ?? 0);
    const clock  = String(status?.displayClock || "");
    const state  = String(status?.type?.state || "");
    if (state !== "in") return { periodLabel: "", clock: "" };

    if (leagueKey === "nfl" || leagueKey === "cfb") {
      const labels = ["1st", "2nd", "3rd", "4th", "OT"];
      return { periodLabel: labels[Math.min(period - 1, 4)] || `Q${period}`, clock };
    }
    if (leagueKey === "nba" || leagueKey === "ncaam") {
      const labels = ["1st", "2nd", "3rd", "4th", "OT"];
      return { periodLabel: labels[Math.min(period - 1, 4)] || `Q${period}`, clock };
    }
    if (leagueKey === "nhl") {
      const labels = ["1st", "2nd", "3rd", "OT", "SO"];
      return { periodLabel: labels[Math.min(period - 1, 4)] || `P${period}`, clock };
    }
    if (leagueKey === "mlb") {
      const inning = String(status?.type?.shortDetail || status?.type?.description || "").replace(/^Top |^Bot /, "");
      const half   = String(status?.type?.shortDetail || "").startsWith("Top") ? "▲" : "▼";
      return { periodLabel: `${half} ${inning || period}`, clock: "" };
    }
    if (leagueKey === "mls") {
      return { periodLabel: period <= 1 ? "1st Half" : "2nd Half", clock };
    }
    return { periodLabel: `P${period}`, clock };
  }

  // ----------------------------------------------------------------
  // Record helper
  // ----------------------------------------------------------------
  function _getRecord(competitor) {
    const recs = competitor?.records;
    if (!Array.isArray(recs) || !recs.length) return "";
    const overall = recs.find(r => String(r?.name || "").toLowerCase() === "overall") || recs[0];
    return String(overall?.summary || "").trim();
  }

  // ----------------------------------------------------------------
  // Series (playoff) parser
  // ----------------------------------------------------------------
  function _parseSeriesFromSummary(data, fallbackComp) {
    const comp  = data?.header?.competitions?.[0] || fallbackComp || null;
    const series = comp?.series || data?.series || null;
    if (!series) return null;

    const competitors = comp?.competitors || [];
    const away = competitors.find(c => c.homeAway === "away");
    const home = competitors.find(c => c.homeAway === "home");

    const awayWins = Number(away?.series?.wins ?? series?.competitors?.find(c => c.homeAway === "away")?.wins ?? 0);
    const homeWins = Number(home?.series?.wins ?? series?.competitors?.find(c => c.homeAway === "home")?.wins ?? 0);

    const awayName = String(away?.team?.abbreviation || away?.team?.shortDisplayName || "Away");
    const homeName = String(home?.team?.abbreviation || home?.team?.shortDisplayName || "Home");

    const completed = !!series.completed;
    return { awayName, homeName, awayWins, homeWins, completed };
  }

  function _buildSeriesHTML({ awayName, homeName, awayWins, homeWins, completed }) {
    const leader = awayWins > homeWins
      ? `${awayName} leads ${awayWins}–${homeWins}`
      : homeWins > awayWins
        ? `${homeName} leads ${homeWins}–${awayWins}`
        : `Series tied ${awayWins}–${homeWins}`;
    return completed ? `Series: ${leader} (Final)` : `Series: ${leader}`;
  }

  // ----------------------------------------------------------------
  // Build shop card
  // ----------------------------------------------------------------
  function _buildShopCard(leagueKey, leagueLabel, ev, favored, ou, upcoming) {
    const comp        = (ev?.competitions || [])[0] || {};
    const state       = _getState(ev);
    const done        = !!comp?.status?.type?.completed;
    const { periodLabel, clock } = _getPeriodLabel(ev, leagueKey);
    const competitors = comp?.competitors || [];
    const away        = competitors.find(c => c.homeAway === "away") || competitors[0] || {};
    const home        = competitors.find(c => c.homeAway === "home") || competitors[1] || {};

    const color = LEAGUE_COLORS[leagueKey] || "#555";

    if (leagueKey === "pga") {
      const athlete = ev?.competitions?.[0]?.competitors?.[0]?.athlete || {};
      const score   = ev?.competitions?.[0]?.competitors?.[0]?.score || "--";
      const name    = athlete?.displayName || ev?.name || "Unknown";
      const logo    = athlete?.headshot?.href || "";
      return `
        <div class="piShopCard${state === "in" ? " live" : state === "post" ? " final" : ""}" style="border-left-color:${color}" data-eventid="${_esc(String(ev?.id || ""))}">
          <div class="piShopCardTop">
            <span class="piShopLeagueTag">${_esc(leagueLabel)}</span>
            <span class="piShopStatusLabel${state === "in" ? " live" : ""}">${state === "in" ? `LIVE • ${periodLabel}` : state === "post" ? "Final" : _fmtGameDate(ev?.date)}</span>
          </div>
          <div class="piShopTeamsRow">
            <div class="piShopTeamLine">
              <div class="piShopTeamLineLeft">
                ${logo ? `<img src="${_esc(logo)}" class="piShopTeamLogo" alt="" loading="lazy" />` : ""}
                <span class="piShopTeamNameFull">${_esc(name)}</span>
              </div>
              <span class="piShopTeamScore">${_esc(String(score))}</span>
            </div>
          </div>
          <div class="piShopMeta">
            <span class="piShopMetaItem">${_esc(ev?.name || "")}</span>
            <span class="piShopMetaItem odds"></span>
          </div>
        </div>`;
    }

    let cls = upcoming ? "upcoming" : "sched";
    let statusLabel = state === "pre" ? _fmtTime(ev?.date) : "";
    if (upcoming) statusLabel = "📆 " + (ev.date ? _fmtGameDate(ev.date) : "Upcoming");
    if (!upcoming && state === "in")             { cls = "live";  statusLabel = `${periodLabel} ${clock}`; }
    if (!upcoming && (state === "post" || done)) { cls = "final"; statusLabel = "Final"; }

    const statusCls  = cls === "live" ? " live" : cls === "upcoming" ? " upcoming" : "";
    const gameDateStr = (!upcoming && state === "pre") ? _fmtGameDate(ev?.date) : "";
    const oddsText   = favored || ou ? _buildOddsLine(favored, ou) : "";
    const eventId    = String(ev?.id || "");

    const teamsHTML = [away, home].map((competitor, idx2) => {
      const team    = competitor?.team || {};
      const logo    = team?.logos?.[0]?.href || team?.logo || "";
      const abbrev  = String(team?.abbreviation || "").slice(0, 4);
      const name    = _applyTTUN(String(team?.displayName || team?.name || (idx2 === 0 ? "Away" : "Home")));
      const score   = state === "pre" || upcoming ? "" : String(competitor?.score ?? "");
      const rec     = _getRecord(competitor);
      const isFav   = _isShopTeam(team);
      const favCls  = isFav ? " fav" : "";
      return `<div class="piShopTeamLine">
        <div class="piShopTeamLineLeft">
          ${logo
            ? `<img src="${_esc(logo)}" class="piShopTeamLogo" alt="" loading="lazy" />`
            : `<div class="piShopTeamLogo" style="background:#222;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:#888;">${_esc(abbrev)}</div>`}
          <span class="piShopTeamNameFull${favCls}">${_esc(name)}</span>
          ${rec ? `<span class="piShopTeamRecord">${_esc(rec)}</span>` : ""}
        </div>
        <span class="piShopTeamScore">${_esc(score)}</span>
      </div>`;
    }).join("");

    return `
      <div class="piShopCard ${cls}" style="border-left-color:${color}" data-eventid="${_esc(eventId)}">
        <div class="piShopCardTop">
          <span class="piShopLeagueTag">${_esc(leagueLabel)}</span>
          <span class="piShopStatusLabel${statusCls}">${_esc(statusLabel)}</span>
        </div>
        <div class="piShopTeamsRow">${teamsHTML}</div>
        <div class="piShopMeta">
          ${!upcoming && gameDateStr ? `<span class="piShopMetaItem">📅 ${_esc(gameDateStr)}</span>` : ""}
          <span class="piShopMetaItem">${_esc(_buildVenueLine(comp))}</span>
          <span class="piShopMetaItem odds">${oddsText ? _esc(oddsText) : (state === "pre" || upcoming ? "Fetching lines…" : "")}</span>
        </div>
        <div class="piSeriesLine"></div>
      </div>`;
  }

  // ----------------------------------------------------------------
  // Venue
  // ----------------------------------------------------------------
  function _buildVenueLine(comp) {
    const v = comp?.venue || null;
    if (!v) return "";
    const name = String(v?.fullName || v?.name || "").trim();
    const city  = String(v?.address?.city || "").trim();
    const state = String(v?.address?.state || "").trim();
    const loc   = city && state ? `${city}, ${state}` : city || state;
    return [name, loc].filter(Boolean).join(" – ");
  }

  // ----------------------------------------------------------------
  // Record helper (scoreboard competitor)
  // ----------------------------------------------------------------
  function _getOverallRecord(competitor) {
    const recs = competitor?.records;
    if (!Array.isArray(recs) || !recs.length) return "";
    const overall =
      recs.find(r => String(r?.name || "").toLowerCase() === "overall") ||
      recs.find(r => String(r?.type || "").toLowerCase() === "total") ||
      recs[0];
    return String(overall?.summary || "").trim();
  }

  // ----------------------------------------------------------------
  // Odds parsing
  // ----------------------------------------------------------------
  function _parseOddsFromSummary(data, fallbackComp) {
    const pcArr = data?.pickcenter;
    if (Array.isArray(pcArr) && pcArr.length) {
      const comp = data?.header?.competitions?.[0] || fallbackComp || null;
      const competitors = comp?.competitors || [];
      const home = competitors.find(t => t.homeAway === "home");
      const away = competitors.find(t => t.homeAway === "away");
      const homeName = String(home?.team?.displayName || home?.team?.shortDisplayName || "Home");
      const awayName = String(away?.team?.displayName || away?.team?.shortDisplayName || "Away");
      const parsed = _parsePickcenter(pcArr[0], homeName, awayName);
      if (parsed.favored || parsed.ou) return parsed;
    }
    const o = Array.isArray(data?.odds) ? data.odds[0] : null;
    if (o) return {
      favored: String(o.details || o.displayValue || "").replace(/^(Line|Spread|Odds):\s*/i, "").trim(),
      ou: String(o.overUnder ?? o.total ?? "").trim()
    };
    return { favored: "", ou: "" };
  }

  function _parsePickcenter(pc, homeName, awayName) {
    if (!pc) return { favored: "", ou: "" };
    const ou      = String(pc.overUnder ?? pc.total ?? pc.overunder ?? "").trim();
    const details = String(pc.details || pc.displayValue || "").replace(/^(Line|Spread|Odds):\s*/i, "").trim();
    if (details) return { favored: details, ou };
    const spreadNum = Number(pc.spread ?? pc.line ?? pc.handicap);
    if (!Number.isFinite(spreadNum)) return { favored: "", ou };
    const homeFav = !!pc.homeTeamOdds?.favorite;
    const awayFav = !!pc.awayTeamOdds?.favorite;
    const favoredTeam = homeFav ? homeName : awayFav ? awayName : (spreadNum < 0 ? homeName : awayName);
    const abs = Math.abs(spreadNum);
    return { favored: `${favoredTeam} -${abs % 1 === 0 ? abs.toFixed(0) : abs}`, ou };
  }

  function _buildOddsLine(favored, ou) {
    const hasFav = favored && favored !== "-";
    const hasOu  = ou && ou !== "-";
    if (!hasFav && !hasOu) return "";
    if (hasFav && hasOu)  return `Favored: ${favored} • O/U: ${ou}`;
    if (hasFav)            return `Favored: ${favored}`;
    return `O/U: ${ou}`;
  }

  // ----------------------------------------------------------------
  // Date helpers
  // ----------------------------------------------------------------
  function _daysSince(d) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(); const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.floor((t - start) / 86400000));
  }
  function _todayStr() { return _dateStr(new Date()); }
  function _dateStr(d) { return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`; }
  function _fmtTime(iso) { try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; } }
  function _fmtGameDate(iso) { try { return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }); } catch { return ""; } }
  function _applyTTUN(s) { return String(s || "").replace(/Michigan\s+Wolverines/gi, "TTUN").replace(/\bMichigan\b/gi, "TTUN"); }
  function _esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

})();
