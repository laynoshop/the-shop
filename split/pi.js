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
  // CFB/NFL: show next weekend's game starting Tuesday morning (lookahead up to 6 days)
  // NHL/NBA/MLB: 3 days ahead
  // Others: 3 days ahead
  const LOOKAHEAD_DAYS = {
    cfb:   6,
    nfl:   6,
    nhl:   3,
    nba:   3,
    mlb:   3,
    ncaam: 3,
    mls:   3,
    pga:   0, // PGA handled separately
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

  // Summary endpoints for odds hydration (keyed by league key)
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

  // League badge colors
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
  let _activeLeague = "shop"; // default to Shop Teams on load
  let _rightPanel   = "youtube"; // "youtube" | "top25"

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
  // Shell HTML
  // ----------------------------------------------------------------
  function buildShell() {
    const leagueBtns = [
      `<button class="piLeagueBtn piShopTeamsBtn${_activeLeague === "shop" ? " active" : ""}" data-league="shop">Shop Teams</button>`,
      ...LEAGUES.map(l =>
        `<button class="piLeagueBtn${l.key === _activeLeague ? " active" : ""}" data-league="${l.key}">${l.label}</button>`
      )
    ].join("");

    const days = _daysSince(LAST_TTUN_WIN);
    const leaf  = `<img src="${LEAF_URL}" class="piLeafSep" alt="leaf" />`;

    return `
<style>
  #piWrap {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    grid-template-columns: 1fr 420px;
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
  #piCountdown { display: flex; align-items: center; gap: 4px; }
  .piCdLabel { font-size: clamp(0.6rem, 1.2vw, 0.8rem); color: #ffccaa; font-weight: 600; letter-spacing: 0.04em; margin-right: 6px; white-space: nowrap; }
  .piCdBlock { text-align: center; min-width: 38px; }
  .piCdNum { display: block; font-size: clamp(0.9rem, 2vw, 1.4rem); font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 0 8px rgba(255,150,0,0.6); }
  .piCdSub { display: block; font-size: 0.5rem; letter-spacing: 0.1em; color: #ffaa88; text-transform: uppercase; }
  .piCdColon { font-size: clamp(0.9rem, 1.8vw, 1.3rem); color: #ff8844; align-self: flex-start; margin-top: 1px; padding: 0 1px; }
  #piCloseBtn {
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(255,255,255,0.25);
    color: #fff;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }
  #piCloseBtn:hover { background: rgba(0,0,0,0.6); }

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
    padding: 4px 14px;
    font-size: clamp(0.65rem, 1.3vw, 0.82rem);
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

  #piRightPanel { display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid rgba(180,0,0,0.2); }
  #piRightToggleBar { display: flex; gap: 0; background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(180,0,0,0.25); flex-shrink: 0; }
  .piRightToggleBtn {
    flex: 1;
    background: transparent;
    border: none;
    color: #999;
    font-size: 0.75rem;
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
  #piRightContent { flex: 1; overflow: hidden; position: relative; }
  #piRightContent iframe { width: 100%; height: 100%; border: none; display: block; }

  #piTop25List { padding: 10px 12px; overflow-y: auto; height: 100%; scrollbar-width: thin; scrollbar-color: #330000 #0d0000; }
  #piTop25List::-webkit-scrollbar { width: 4px; }
  #piTop25List::-webkit-scrollbar-track { background: #0d0000; }
  #piTop25List::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }
  .piRankHead { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #bb0000; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid rgba(180,0,0,0.3); }
  .piRankRow { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 5px; margin-bottom: 3px; background: rgba(255,255,255,0.03); }
  .piRankRow:nth-child(odd) { background: rgba(255,255,255,0.05); }
  .piRankNum { min-width: 22px; font-size: 0.8rem; font-weight: 900; color: #cc0000; text-align: right; }
  .piRankTeam { flex: 1; font-size: 0.78rem; font-weight: 600; color: #e8e8e8; }
  .piRankRecord { font-size: 0.68rem; color: #777; }

  .piPanelHead {
    font-size: 0.7rem;
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

  /* ---- Rich score cards ---- */
  .piShopCard {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 9px 11px;
    margin-bottom: 7px;
    background: rgba(255,255,255,0.04);
    border-radius: 7px;
    border-left: 3px solid #555;
    pointer-events: none;
  }
  .piShopCard.live  { border-left-color: #cc0000; background: rgba(180,0,0,0.09); }
  .piShopCard.final { border-left-color: #444; }
  .piShopCard.sched { border-left-color: rgba(0,140,0,0.7); }
  .piShopCard.upcoming { border-left-color: rgba(0,100,200,0.7); background: rgba(0,60,120,0.07); }

  .piShopCardTop { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .piShopLeagueBadge { font-size: 0.58rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; color: #fff; flex-shrink: 0; }
  .piShopStatusLabel { font-size: 0.68rem; font-weight: 700; color: #777; text-align: right; white-space: nowrap; }
  .piShopStatusLabel.live { color: #ff4444; }
  .piShopStatusLabel.upcoming { color: #4499ff; }

  .piShopTeamsRow { display: flex; flex-direction: column; gap: 2px; }
  .piShopTeamLine { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .piShopTeamLineLeft { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .piShopTeamLogo { width: 20px; height: 20px; object-fit: contain; flex-shrink: 0; border-radius: 2px; }
  .piShopTeamNameFull { font-size: clamp(0.7rem, 1.4vw, 0.86rem); font-weight: 700; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .piShopTeamNameFull.fav { color: #ffcc66; }
  .piShopTeamRecord { font-size: 0.62rem; color: #666; white-space: nowrap; flex-shrink: 0; }
  .piShopTeamScore { font-size: clamp(0.8rem, 1.6vw, 1rem); font-weight: 900; color: #fff; min-width: 28px; text-align: right; flex-shrink: 0; }

  /* Playoff series badge */
  .piSeriesLine {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 1px;
    padding: 2px 4px;
  }
  .piSeriesBadge {
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: #ffcc44;
    background: rgba(200,160,0,0.15);
    border: 1px solid rgba(200,160,0,0.3);
    border-radius: 4px;
    padding: 1px 6px;
    white-space: nowrap;
  }
  .piSeriesBadge.tied { color: #aaa; background: rgba(180,180,180,0.1); border-color: rgba(180,180,180,0.2); }

  .piShopMeta { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 2px; }
  .piShopMetaItem { font-size: 0.61rem; color: #666; white-space: nowrap; }
  .piShopMetaItem.odds { color: #aaa; font-weight: 600; }
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
  .piBannerChunk { font-size: clamp(0.68rem, 1.3vw, 0.88rem); font-weight: 600; color: #f0e0e0; letter-spacing: 0.02em; white-space: nowrap; }
  .piBannerChunk strong { color: #ff6644; }
  .piLeafSep { height: 18px; width: auto; object-fit: contain; filter: drop-shadow(0 0 3px rgba(200,50,0,0.6)); flex-shrink: 0; }
  .piNoGames { color: #444; font-size: 0.85rem; text-align: center; padding: 24px 0; }
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
      <span class="piCdLabel">&#x1F3C8; The Game:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdD">--</span><span class="piCdSub">days</span></div>
      <span class="piCdColon">:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdH">--</span><span class="piCdSub">hrs</span></div>
      <span class="piCdColon">:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdM">--</span><span class="piCdSub">min</span></div>
      <span class="piCdColon">:</span>
      <div class="piCdBlock"><span class="piCdNum" id="piCdS">--</span><span class="piCdSub">sec</span></div>
    </div>
    <button id="piCloseBtn" type="button">&#x2715; Exit</button>
  </div>

  <div id="piLeagueBar">${leagueBtns}</div>

  <div id="piScoresPanel">
    <div class="piPanelHead gold" id="piPanelHeadLabel">Shop Teams</div>
    <div id="piScoresContent"><div class="piNoGames">Loading&hellip;</div></div>
  </div>

  <div id="piRightPanel">
    <div id="piRightToggleBar">
      <button class="piRightToggleBtn active" data-panel="youtube" type="button">&#x25B6; Natty Replay</button>
      <button class="piRightToggleBtn" data-panel="top25" type="button">&#x1F3C6; CFB Top 25</button>
    </div>
    <div id="piRightContent"></div>
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
          if (_activeLeague === "shop") {
            head.textContent = "Shop Teams";
            head.classList.add("gold");
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
    const el = document.getElementById("piRightContent");
    if (!el) return;
    if (_rightPanel === "youtube") {
      el.innerHTML = `<iframe
        src="https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_VIDEO_ID}&controls=0&modestbranding=1&rel=0"
        allow="autoplay; encrypted-media" allowfullscreen title="OSU Natty Replay"></iframe>`;
    } else {
      _renderTop25(el);
    }
  }

  // ----------------------------------------------------------------
  // Top 25
  // ----------------------------------------------------------------
  function _renderTop25(el) {
    el.innerHTML = `<div id="piTop25List"><div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.82rem;padding:16px 0;">Loading rankings&hellip;</div></div>`;
    fetch("https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings")
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const ap    = (data?.rankings || []).find(p => String(p?.name || "").toLowerCase().includes("ap")) || (data?.rankings || [])[0];
        const ranks = ap?.ranks || [];
        const list  = document.getElementById("piTop25List");
        if (!list) return;
        if (!ranks.length) { list.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.82rem;">Rankings not available.</div>`; return; }
        list.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div>` +
          ranks.map(r => {
            const name = _applyTTUN(String(r?.team?.name || r?.team?.displayName || "Unknown"));
            return `<div class="piRankRow"><span class="piRankNum">${r.current}</span><span class="piRankTeam">${_esc(name)}</span><span class="piRankRecord">${_esc(String(r?.recordSummary || ""))}</span></div>`;
          }).join("");
      })
      .catch(() => { const l = document.getElementById("piTop25List"); if (l) l.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.82rem;">Rankings unavailable.</div>`; });
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
    if (_activeLeague === "shop") _renderShopTeams();
    else if (_activeLeague === "pga") _renderPGA();
    else _renderLeagueScores();
  }

  // ----------------------------------------------------------------
  // PGA — PGA Tour only, smart date window
  // Sun after round ends through Wed 11:59pm: show last week's tournament
  // Thu 00:00 onward: show current week's tournament
  // ----------------------------------------------------------------
  async function _renderPGA() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading PGA Tour&hellip;</div>`;

    // Determine which date to query:
    // Day 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
    // Thu–Sat: show current week → use today's date
    // Sun–Wed: show last Sunday (previous tournament round) → walk back to last Sunday
    const now     = new Date();
    const dow     = now.getDay(); // 0=Sun ... 6=Sat
    const isPostWeek = dow >= 0 && dow <= 3; // Sun(0) Mon(1) Tue(2) Wed(3)
    let queryDate;
    if (isPostWeek) {
      // Walk back to last Sunday
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
      // Try current week if last-week query returned nothing
      try {
        const data = await fetch(`https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${_todayStr()}&limit=50`).then(r => r.ok ? r.json() : null);
        if (data) events = (data?.events || []).filter(_isPGATour);
      } catch {}
    }

    if (!events.length) { el.innerHTML = `<div class="piNoGames">No PGA Tour events found.</div>`; return; }

    el.innerHTML = events.map(ev => _buildShopCard("pga", "PGA", ev, null, null)).join("");

    // Odds hydration
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

  // Only keep PGA Tour (filter out Champions Tour, Korn Ferry, etc.)
  function _isPGATour(ev) {
    const name   = String(ev?.league?.name || ev?.league?.abbreviation || ev?.name || "").toLowerCase();
    const season = String(ev?.season?.type || "");
    // Accept if name contains "pga tour" but not "champions" or "korn ferry"
    if (name.includes("champions") || name.includes("korn ferry") || name.includes("dp world")) return false;
    // ESPN's PGA endpoint generally only returns PGA Tour but double-check via league slug
    const slug = String(ev?.league?.slug || "").toLowerCase();
    if (slug && !slug.includes("pga")) return false;
    return true;
  }

  // ----------------------------------------------------------------
  // Standard league scores — rich card format with odds + series hydration
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

    // Build cards — series badge populated directly from scoreboard comp object
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
          // Odds
          const odds = _parseOddsFromSummary(data, ev?.competitions?.[0]);
          if (odds.favored || odds.ou) {
            const card = el.querySelector(`.piShopCard[data-eventid="${eventId}"]`);
            if (card) { const o = card.querySelector(".piShopMetaItem.odds"); if (o) o.textContent = _buildOddsLine(odds.favored, odds.ou); }
          }
          // Playoff series fallback from summary (fills in if scoreboard comp had no series data)
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
  // Shop Teams — cross-league favorites with lookahead
  // ----------------------------------------------------------------
  async function _renderShopTeams() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading Shop Teams&hellip;</div>`;

    const now = new Date();
    // Before 9am show yesterday's results, otherwise today
    const primaryDate = now.getHours() < 9
      ? _dateStr(new Date(now.getTime() - 86400000))
      : _todayStr();

    // Fetch all leagues for primary date
    const results = await Promise.allSettled(
      LEAGUES.map(lg =>
        fetch(lg.url(primaryDate))
          .then(r => r.ok ? r.json() : Promise.reject(r.status))
          .then(data => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: data?.events || [] }))
          .catch(() => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: [] }))
      )
    );

    const matched = [];
    // Track which shop teams already have a game found for today/yesterday
    const teamsFound = new Set();

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { leagueKey, leagueLabel, events } = result.value;
      for (const ev of events) {
        if (_eventHasShopTeam(ev)) {
          matched.push({ leagueKey, leagueLabel, ev, upcoming: false });
          // Mark which shop teams are covered
          const comp = (ev?.competitions || [])[0] || {};
          for (const c of (comp?.competitors || [])) {
            if (_isShopTeam(c?.team)) teamsFound.add(_shopTeamKey(c.team));
          }
        }
      }
    }

    // For shop teams with no game today, look ahead per-league
    const missingTeams = SHOP_TEAMS_NORM.filter(t => !teamsFound.has(t));
    if (missingTeams.length) {
      // Group missing teams by which leagues they belong to
      // We'll fetch upcoming days for each league that has lookahead > 0
      const lookaheadFetches = [];
      for (const lg of LEAGUES) {
        const days = LOOKAHEAD_DAYS[lg.key] || 0;
        if (!days) continue;
        // Check if any missing team could be in this league
        // We'll just fetch all days and filter — it's parallel so cost is low
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

      // For each missing team, find the soonest upcoming game (avoid duplicates per team)
      const upcomingByTeam = new Map(); // teamKey -> { leagueKey, leagueLabel, ev, daysAhead }

      for (const res of lookaheadResults) {
        if (res.status !== "fulfilled") continue;
        const { leagueKey, leagueLabel, events, daysAhead } = res.value;
        for (const ev of events) {
          const comp = (ev?.competitions || [])[0] || {};
          for (const c of (comp?.competitors || [])) {
            if (!_isShopTeam(c?.team)) continue;
            const tKey = _shopTeamKey(c.team);
            if (teamsFound.has(tKey)) continue; // already has a game today
            const existing = upcomingByTeam.get(tKey);
            if (!existing || daysAhead < existing.daysAhead) {
              upcomingByTeam.set(tKey, { leagueKey, leagueLabel, ev, daysAhead });
            }
          }
        }
      }

      // Deduplicate: same event might match multiple team keys — add each event once
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

    // Sort: live → today scheduled → final → upcoming future games
    matched.sort((a, b) => {
      const sRank = m => {
        if (m.upcoming) return 3;
        const s = _getState(m.ev);
        return s === "in" ? 0 : s === "pre" ? 1 : 2;
      };
      if (sRank(a) !== sRank(b)) return sRank(a) - sRank(b);
      if (a.upcoming && b.upcoming) {
        // Sort upcoming by date
        return new Date(a.ev.date || 0) - new Date(b.ev.date || 0);
      }
      return _shopTeamRank(a.ev) - _shopTeamRank(b.ev);
    });

    // Build cards — series badge populated directly from scoreboard comp object
    el.innerHTML = matched.map(({ leagueKey, leagueLabel, ev, upcoming }) =>
      _buildShopCard(leagueKey, leagueLabel, ev, null, null, upcoming)
    ).join("");

    // Hydrate odds + series fallback in background
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
          // Playoff series fallback from summary (only fills if scoreboard comp had no series data)
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
  // ESPN puts series wins on comp.series.competitors[], but those objects
  // often only have a team ID — not a usable display name. The fix is to
  // cross-reference by team ID against the game-level comp.competitors[]
  // which always carries full team name data.
  function _parseSeriesFromComp(comp, leagueKey) {
    if (!comp || !PLAYOFF_LEAGUES.has(leagueKey)) return null;
    try {
      const series = comp?.series;
      if (!series) return null;

      const seriesComps = series?.competitors || [];
      if (seriesComps.length < 2) return null;

      const w0 = Number(seriesComps[0]?.wins || 0);
      const w1 = Number(seriesComps[1]?.wins || 0);

      // Only render if series has actually started
      if (w0 === 0 && w1 === 0) {
        const title = String(series?.title || series?.summary || "");
        if (title) return { seriesSummary: title };
        return null;
      }

      // Cross-reference series competitor IDs against game-level competitors
      // to get reliable display names (series objects often lack displayName)
      const gameComps = comp?.competitors || [];
      const _nameForSeriesComp = (sc) => {
        const scId = String(sc?.id || sc?.team?.id || "");
        if (scId) {
          const match = gameComps.find(gc =>
            String(gc?.id || gc?.team?.id || "") === scId ||
            String(gc?.team?.id || "") === scId
          );
          if (match) {
            return String(
              match?.team?.shortDisplayName ||
              match?.team?.displayName ||
              match?.team?.abbreviation ||
              ""
            );
          }
        }
        // Fallback: use whatever name is on the series competitor itself
        return String(
          sc?.team?.shortDisplayName ||
          sc?.team?.displayName ||
          sc?.team?.abbreviation ||
          ""
        );
      };

      const n0 = _nameForSeriesComp(seriesComps[0]) || "Team A";
      const n1 = _nameForSeriesComp(seriesComps[1]) || "Team B";

      return { name0: _applyTTUN(n0), wins0: w0, name1: _applyTTUN(n1), wins1: w1 };
    } catch { return null; }
  }

  // ----------------------------------------------------------------
  // Playoff series parsing — summary endpoint (fallback)
  // ----------------------------------------------------------------
  // Same cross-reference trick: use summary header competitors for names,
  // but fall back to game comp names if series objects lack them.
  function _parseSeriesFromSummary(data, fallbackComp) {
    try {
      const comp = data?.header?.competitions?.[0] || data?.competitions?.[0];
      if (!comp) return null;

      // Accept any playoff season type (2=postseason, 3=playoffs — varies by sport)
      const seasonType = Number(data?.header?.season?.type || data?.season?.type || 0);
      if (seasonType < 2) return null;

      const series = comp?.series;
      if (!series) return null;

      const seriesComps = series?.competitors || [];
      if (seriesComps.length < 2) return null;

      const w0 = Number(seriesComps[0]?.wins || 0);
      const w1 = Number(seriesComps[1]?.wins || 0);

      // Cross-reference: try summary header comps first, then fallback game comp
      const gameComps = [
        ...(comp?.competitors || []),
        ...((fallbackComp?.competitors) || [])
      ];

      const _nameForSeriesComp = (sc) => {
        const scId = String(sc?.id || sc?.team?.id || "");
        if (scId) {
          const match = gameComps.find(gc =>
            String(gc?.id || gc?.team?.id || "") === scId ||
            String(gc?.team?.id || "") === scId
          );
          if (match) {
            return String(
              match?.team?.shortDisplayName ||
              match?.team?.displayName ||
              match?.team?.abbreviation ||
              ""
            );
          }
        }
        return String(
          sc?.team?.shortDisplayName ||
          sc?.team?.displayName ||
          sc?.team?.abbreviation ||
          ""
        );
      };

      const n0 = _nameForSeriesComp(seriesComps[0]) || "Team A";
      const n1 = _nameForSeriesComp(seriesComps[1]) || "Team B";

      if (w0 === 0 && w1 === 0) {
        // Series exists but hasn't started — show title if available
        const title = String(series?.title || series?.summary || "");
        if (title) return { seriesSummary: title };
        // Fall through to competitor seriesSummary strings
      } else {
        return { name0: _applyTTUN(n0), wins0: w0, name1: _applyTTUN(n1), wins1: w1 };
      }

      // Fallback: seriesSummary on competitors
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
    if (series.seriesSummary) {
      return `<span class="piSeriesBadge">🏆 ${_esc(series.seriesSummary)}</span>`;
    }
    const { name0, wins0, name1, wins1 } = series;
    if (wins0 === wins1) {
      return `<span class="piSeriesBadge tied">🏆 Series Tied ${wins0}-${wins1}</span>`;
    }
    const leader = wins0 > wins1 ? name0 : name1;
    const lWins  = wins0 > wins1 ? wins0 : wins1;
    const tWins  = wins0 > wins1 ? wins1 : wins0;
    return `<span class="piSeriesBadge">🏆 ${_esc(leader)} leads ${lWins}-${tWins}</span>`;
  }

  // ----------------------------------------------------------------
  // Rich card builder
  // ----------------------------------------------------------------
  function _buildShopCard(leagueKey, leagueLabel, ev, favored, ou, upcoming) {
    try {
      const comp       = (ev?.competitions || [])[0] || {};
      const status     = ev?.status || {};
      const state      = String(status?.type?.state || "pre");
      const done       = !!(status?.type?.completed);
      const clock      = String(status?.displayClock || "");
      const period     = Number(status?.period || 0);
      const eventId    = String(ev?.id || "");
      const isPlayoff  = PLAYOFF_LEAGUES.has(leagueKey);

      // Period label varies by sport
      const periodLabel = _periodLabel(leagueKey, period);

      let cls = upcoming ? "upcoming" : "sched";
      let statusLabel = ev.date ? _fmtTime(ev.date) : "Scheduled";
      if (upcoming) statusLabel = "📆 " + (ev.date ? _fmtGameDate(ev.date) : "Upcoming");
      if (!upcoming && state === "in")           { cls = "live";  statusLabel = `${periodLabel} ${clock}`; }
      if (!upcoming && (state === "post" || done)) { cls = "final"; statusLabel = "Final"; }

      const statusCls = cls === "live" ? " live" : cls === "upcoming" ? " upcoming" : "";
      const badgeColor = LEAGUE_COLORS[leagueKey] || "#555";

      const venue = comp?.venue;
      const venueName = String(venue?.fullName || venue?.name || "");
      const city      = String(venue?.address?.city || "");
      const stateCode = String(venue?.address?.state || "");
      const venueText = [venueName, [city, stateCode].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
      const gameDateStr = ev.date ? _fmtGameDate(ev.date) : "";

      const competitors = comp?.competitors || [];
      const teamsHTML = competitors.map(c => {
        const team   = c?.team || {};
        const isFav  = _isShopTeam(team);
        const name   = _applyTTUN(String(team.displayName || team.shortDisplayName || team.abbreviation || "TBD"));
        const logo   = String(team.logo || (Array.isArray(team.logos) ? team.logos[0]?.href : "") || "");
        const score  = String(c?.score || "");
        const rec    = _getRecord(c);
        const favCls = isFav ? " fav" : "";
        const logoImg = logo
          ? `<img src="${_esc(logo)}" class="piShopTeamLogo" alt="" loading="lazy" />`
          : `<span style="width:20px;height:20px;flex-shrink:0;display:inline-block;"></span>`;
        return `<div class="piShopTeamLine">
          <div class="piShopTeamLineLeft">
            ${logoImg}
            <span class="piShopTeamNameFull${favCls}">${_esc(name)}</span>
            ${rec ? `<span class="piShopTeamRecord">${_esc(rec)}</span>` : ""}
          </div>
          <span class="piShopTeamScore">${_esc(score)}</span>
        </div>`;
      }).join("");

      const oddsText = _buildOddsLine(favored || "", ou || "");

      // --- Series badge: parse directly from scoreboard comp (no summary fetch needed) ---
      let seriesHTML = "";
      if (isPlayoff) {
        const seriesFromComp = _parseSeriesFromComp(comp, leagueKey);
        seriesHTML = `<div class="piSeriesLine">${seriesFromComp ? _buildSeriesHTML(seriesFromComp) : ""}</div>`;
      }

      return `
<div class="piShopCard ${cls}" data-eventid="${_esc(eventId)}">
  <div class="piShopCardTop">
    <span class="piShopLeagueBadge" style="background:${badgeColor};">${_esc(leagueLabel)}</span>
    <span class="piShopStatusLabel${statusCls}">${_esc(statusLabel)}</span>
  </div>
  <div class="piShopTeamsRow">${teamsHTML}</div>
  ${seriesHTML}
  <div class="piShopMeta">
    ${!upcoming && gameDateStr ? `<span class="piShopMetaItem">📅 ${_esc(gameDateStr)}</span>` : ""}
    ${venueText ? `<span class="piShopMetaItem venue">📍 ${_esc(venueText)}</span>` : ""}
    <span class="piShopMetaItem odds">${oddsText ? _esc(oddsText) : (state === "pre" || upcoming ? "Fetching lines…" : "")}</span>
  </div>
</div>`;
    } catch { return ""; }
  }

  function _periodLabel(leagueKey, period) {
    switch (leagueKey) {
      case "nhl": return `P${period}`;
      case "mlb": return period <= 9 ? `${period}th` : `${period}th`; // inning handled by clock
      case "nba": case "ncaam": return `Q${period}`;
      case "cfb": case "nfl": return `Q${period}`;
      default: return `${period}`;
    }
  }

  function _getRecord(competitor) {
    const recs = competitor?.records;
    if (!Array.isArray(recs) || !recs.length) return "";
    const overall = recs.find(r => String(r?.name || "").toLowerCase() === "overall") ||
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
