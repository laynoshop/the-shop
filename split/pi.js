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
    // Shop Teams first, then leagues, no emoji on Shop Teams pill
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

  /* Fire background */
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
  #piHeaderLeft {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  #piHeaderLeft img {
    height: 44px;
    width: 44px;
    object-fit: contain;
    filter: drop-shadow(0 0 6px rgba(255,200,0,0.6));
  }
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

  /* Countdown */
  #piCountdown {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .piCdLabel {
    font-size: clamp(0.6rem, 1.2vw, 0.8rem);
    color: #ffccaa;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-right: 6px;
    white-space: nowrap;
  }
  .piCdBlock { text-align: center; min-width: 38px; }
  .piCdNum {
    display: block;
    font-size: clamp(0.9rem, 2vw, 1.4rem);
    font-weight: 900;
    color: #fff;
    line-height: 1;
    text-shadow: 0 0 8px rgba(255,150,0,0.6);
  }
  .piCdSub {
    display: block;
    font-size: 0.5rem;
    letter-spacing: 0.1em;
    color: #ffaa88;
    text-transform: uppercase;
  }
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

  /* ---- League buttons ---- */
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
  .piLeagueBtn.active {
    background: linear-gradient(135deg, #bb0000, #880000);
    color: #fff;
    border-color: #cc0000;
    box-shadow: 0 0 10px rgba(200,0,0,0.5);
  }
  /* Shop Teams button gets a special gold accent when active */
  .piShopTeamsBtn.active {
    background: linear-gradient(135deg, #a07800, #7a5500);
    border-color: #c89a00;
    box-shadow: 0 0 10px rgba(200,160,0,0.5);
  }

  /* ---- Main panels ---- */
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

  #piRightPanel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid rgba(180,0,0,0.2);
  }

  /* Right panel toggle bar */
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
  .piRightToggleBtn.active {
    color: #ff4444;
    border-bottom-color: #cc0000;
    background: rgba(180,0,0,0.15);
  }

  #piRightContent {
    flex: 1;
    overflow: hidden;
    position: relative;
  }
  #piRightContent iframe {
    width: 100%;
    height: 100%;
    border: none;
    display: block;
  }

  /* Top 25 list */
  #piTop25List {
    padding: 10px 12px;
    overflow-y: auto;
    height: 100%;
    scrollbar-width: thin;
    scrollbar-color: #330000 #0d0000;
  }
  #piTop25List::-webkit-scrollbar { width: 4px; }
  #piTop25List::-webkit-scrollbar-track { background: #0d0000; }
  #piTop25List::-webkit-scrollbar-thumb { background: #440000; border-radius: 2px; }
  .piRankHead {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #bb0000;
    margin-bottom: 8px;
    padding-bottom: 5px;
    border-bottom: 1px solid rgba(180,0,0,0.3);
  }
  .piRankRow {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 6px;
    border-radius: 5px;
    margin-bottom: 3px;
    background: rgba(255,255,255,0.03);
  }
  .piRankRow:nth-child(odd) { background: rgba(255,255,255,0.05); }
  .piRankNum {
    min-width: 22px;
    font-size: 0.8rem;
    font-weight: 900;
    color: #cc0000;
    text-align: right;
  }
  .piRankTeam {
    flex: 1;
    font-size: 0.78rem;
    font-weight: 600;
    color: #e8e8e8;
  }
  .piRankRecord {
    font-size: 0.68rem;
    color: #777;
  }

  /* ---- Panel heading ---- */
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
  .piPanelHead.gold {
    color: #c8a000;
    border-bottom-color: rgba(200,160,0,0.3);
    text-shadow: 0 0 6px rgba(200,160,0,0.35);
  }

  /* ---- Rich score cards (used for ALL leagues + Shop Teams) ---- */
  .piShopCard {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 9px 11px;
    margin-bottom: 7px;
    background: rgba(255,255,255,0.04);
    border-radius: 7px;
    border-left: 3px solid #555;
    pointer-events: none; /* read-only */
  }
  .piShopCard.live  { border-left-color: #cc0000; background: rgba(180,0,0,0.09); }
  .piShopCard.final { border-left-color: #444; }
  .piShopCard.sched { border-left-color: rgba(0,140,0,0.7); }

  .piShopCardTop {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .piShopLeagueBadge {
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 7px;
    border-radius: 10px;
    color: #fff;
    flex-shrink: 0;
  }
  .piShopStatusLabel {
    font-size: 0.68rem;
    font-weight: 700;
    color: #777;
    text-align: right;
    white-space: nowrap;
  }
  .piShopStatusLabel.live { color: #ff4444; }

  .piShopTeamsRow {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .piShopTeamLine {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .piShopTeamLineLeft {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .piShopTeamLogo {
    width: 20px;
    height: 20px;
    object-fit: contain;
    flex-shrink: 0;
    border-radius: 2px;
  }
  .piShopTeamNameFull {
    font-size: clamp(0.7rem, 1.4vw, 0.86rem);
    font-weight: 700;
    color: #eee;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .piShopTeamNameFull.fav { color: #ffcc66; }
  .piShopTeamRecord {
    font-size: 0.62rem;
    color: #666;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .piShopTeamScore {
    font-size: clamp(0.8rem, 1.6vw, 1rem);
    font-weight: 900;
    color: #fff;
    min-width: 28px;
    text-align: right;
    flex-shrink: 0;
  }

  .piShopMeta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-top: 2px;
  }
  .piShopMetaItem {
    font-size: 0.61rem;
    color: #666;
    white-space: nowrap;
  }
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
  .piBannerChunk {
    font-size: clamp(0.68rem, 1.3vw, 0.88rem);
    font-weight: 600;
    color: #f0e0e0;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .piBannerChunk strong { color: #ff6644; }
  .piLeafSep {
    height: 18px;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 0 3px rgba(200,50,0,0.6));
    flex-shrink: 0;
  }
</style>

<div id="piWrap">

  <!-- Header -->
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

  <!-- League buttons -->
  <div id="piLeagueBar">${leagueBtns}</div>

  <!-- Scores panel (left) -->
  <div id="piScoresPanel">
    <div class="piPanelHead gold" id="piPanelHeadLabel">Shop Teams</div>
    <div id="piScoresContent"><div class="piNoGames">Loading&hellip;</div></div>
  </div>

  <!-- Right panel -->
  <div id="piRightPanel">
    <div id="piRightToggleBar">
      <button class="piRightToggleBtn active" data-panel="youtube" type="button">&#x25B6; Natty Replay</button>
      <button class="piRightToggleBtn" data-panel="top25" type="button">&#x1F3C6; CFB Top 25</button>
    </div>
    <div id="piRightContent"></div>
  </div>

  <!-- Bottom banner -->
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
        // Update panel heading
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
  // Right panel toggle
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
        allow="autoplay; encrypted-media"
        allowfullscreen
        title="OSU Natty Replay"
      ></iframe>`;
    } else {
      _renderTop25(el);
    }
  }

  // ----------------------------------------------------------------
  // Top 25
  // ----------------------------------------------------------------
  function _renderTop25(el) {
    el.innerHTML = `<div id="piTop25List"><div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.82rem;padding:16px 0;">Loading rankings&hellip;</div></div>`;
    const url = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings";
    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const polls  = data?.rankings || [];
        const ap     = polls.find(p => String(p?.name || "").toLowerCase().includes("ap")) || polls[0];
        const ranks  = ap?.ranks || [];
        const list   = document.getElementById("piTop25List");
        if (!list) return;
        if (!ranks.length) {
          list.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.82rem;">Rankings not available.</div>`;
          return;
        }
        list.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div>` +
          ranks.map(r => {
            const name   = _applyTTUN(String(r?.team?.name || r?.team?.displayName || "Unknown"));
            const record = String(r?.recordSummary || "");
            return `<div class="piRankRow"><span class="piRankNum">${r.current}</span><span class="piRankTeam">${_esc(name)}</span><span class="piRankRecord">${_esc(record)}</span></div>`;
          }).join("");
      })
      .catch(() => {
        const list = document.getElementById("piTop25List");
        if (list) list.innerHTML = `<div class="piRankHead">&#x1F3C6; CFB AP Top 25</div><div style="color:#555;font-size:0.82rem;">Rankings unavailable.</div>`;
      });
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
    if (_activeLeague === "shop") {
      _renderShopTeams();
    } else {
      _renderLeagueScores();
    }
  }

  // ----------------------------------------------------------------
  // Standard league scores — now uses rich card format with odds hydration
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

    if (!events.length) {
      el.innerHTML = `<div class="piNoGames">No games today.</div>`;
      return;
    }

    // Render all cards immediately (no odds yet)
    el.innerHTML = events.map(ev =>
      _buildShopCard(_activeLeague, league.label.replace(/^\S+\s/, ""), ev, null, null)
    ).join("");

    try { if (typeof window.replaceMichiganText === "function") window.replaceMichiganText(el); } catch {}

    // Hydrate odds in background — up to 4 concurrent summary fetches
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
            if (card) {
              const oddsEl = card.querySelector(".piShopMetaItem.odds");
              if (oddsEl) oddsEl.textContent = _buildOddsLine(odds.favored, odds.ou);
            }
          }
        } catch {}
      }
    }
    await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker));
  }

  // ----------------------------------------------------------------
  // Shop Teams — cross-league favorites view
  // ----------------------------------------------------------------
  async function _renderShopTeams() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    el.innerHTML = `<div class="piNoGames">Loading Shop Teams&hellip;</div>`;

    // Determine display date: before 9am show yesterday's games, after 9am show today's
    const now = new Date();
    const displayDate = now.getHours() < 9
      ? _dateStr(new Date(now.getTime() - 86400000))
      : _todayStr();

    // Fan out all league fetches in parallel
    const results = await Promise.allSettled(
      LEAGUES.map(lg =>
        fetch(lg.url(displayDate))
          .then(r => r.ok ? r.json() : Promise.reject(r.status))
          .then(data => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: data?.events || [] }))
          .catch(() => ({ leagueKey: lg.key, leagueLabel: lg.label.replace(/^\S+\s/, ""), events: [] }))
      )
    );

    // Collect all events that involve at least one Shop Team
    const matched = [];
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      const { leagueKey, leagueLabel, events } = result.value;
      for (const ev of events) {
        if (_eventHasShopTeam(ev)) {
          matched.push({ leagueKey, leagueLabel, ev });
        }
      }
    }

    if (!matched.length) {
      el.innerHTML = `<div class="piNoGames">No Shop Teams games today. Enjoy the day off.</div>`;
      return;
    }

    // Sort: live first → scheduled → final, then by shop team rank
    matched.sort((a, b) => {
      const stateA = _getState(a.ev);
      const stateB = _getState(b.ev);
      const sRank = s => s === "in" ? 0 : s === "pre" ? 1 : 2;
      if (sRank(stateA) !== sRank(stateB)) return sRank(stateA) - sRank(stateB);
      return _shopTeamRank(a.ev) - _shopTeamRank(b.ev);
    });

    // Render cards immediately (no odds yet)
    el.innerHTML = matched.map(({ leagueKey, leagueLabel, ev }) =>
      _buildShopCard(leagueKey, leagueLabel, ev, null, null)
    ).join("");

    // Hydrate odds in background — up to 4 concurrent summary fetches
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
            if (card) {
              const oddsEl = card.querySelector(".piShopMetaItem.odds");
              if (oddsEl) oddsEl.textContent = _buildOddsLine(odds.favored, odds.ou);
            }
          }
        } catch {}
      }
    }
    await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker));
  }

  function _eventHasShopTeam(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    const competitors = comp?.competitors || [];
    return competitors.some(c => _isShopTeam(c?.team));
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

  function _shopTeamRank(ev) {
    const comp = (ev?.competitions || [])[0] || {};
    const competitors = comp?.competitors || [];
    let best = Infinity;
    for (const c of competitors) {
      const team = c?.team;
      if (!team) continue;
      const displayName = String(team.displayName || "").trim().toLowerCase().replace(/\s+/g, " ");
      const idx = SHOP_TEAMS_NORM.findIndex(t =>
        t === displayName || displayName.includes(t) || t.includes(displayName)
      );
      if (idx !== -1 && idx < best) best = idx;
    }
    return best;
  }

  function _getState(ev) {
    return String(ev?.status?.type?.state || "pre");
  }

  // ----------------------------------------------------------------
  // Rich card builder — used for BOTH Shop Teams view AND all league views
  // ----------------------------------------------------------------
  function _buildShopCard(leagueKey, leagueLabel, ev, favored, ou) {
    try {
      const comp       = (ev?.competitions || [])[0] || {};
      const status     = ev?.status || {};
      const state      = String(status?.type?.state || "pre");
      const done       = !!(status?.type?.completed);
      const clock      = String(status?.displayClock || "");
      const period     = Number(status?.period || 0);
      const eventId    = String(ev?.id || "");

      let cls = "sched", statusLabel = ev.date ? _fmtTime(ev.date) : "Scheduled";
      if (state === "in")           { cls = "live";  statusLabel = `Q${period} ${clock}`; }
      if (state === "post" || done) { cls = "final"; statusLabel = "Final"; }

      const badgeColor = LEAGUE_COLORS[leagueKey] || "#555";

      // Venue
      const venue = comp?.venue;
      const venueName   = String(venue?.fullName || venue?.name || "");
      const city        = String(venue?.address?.city || "");
      const stateCode   = String(venue?.address?.state || "");
      const venueText   = [venueName, [city, stateCode].filter(Boolean).join(", ")].filter(Boolean).join(" — ");

      // Date display
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
        return `
          <div class="piShopTeamLine">
            <div class="piShopTeamLineLeft">
              ${logoImg}
              <span class="piShopTeamNameFull${favCls}">${_esc(name)}</span>
              ${rec ? `<span class="piShopTeamRecord">${_esc(rec)}</span>` : ""}
            </div>
            <span class="piShopTeamScore">${_esc(score)}</span>
          </div>`;
      }).join("");

      const oddsText = _buildOddsLine(favored || "", ou || "");

      return `
<div class="piShopCard ${cls}" data-eventid="${_esc(eventId)}">
  <div class="piShopCardTop">
    <span class="piShopLeagueBadge" style="background:${badgeColor};">${_esc(leagueLabel)}</span>
    <span class="piShopStatusLabel${cls === 'live' ? ' live' : ''}">${_esc(statusLabel)}</span>
  </div>
  <div class="piShopTeamsRow">${teamsHTML}</div>
  <div class="piShopMeta">
    ${gameDateStr ? `<span class="piShopMetaItem">📅 ${_esc(gameDateStr)}</span>` : ""}
    ${venueText    ? `<span class="piShopMetaItem venue">📍 ${_esc(venueText)}</span>` : ""}
    <span class="piShopMetaItem odds">${oddsText ? _esc(oddsText) : "Fetching lines…"}</span>
  </div>
</div>`;
    } catch { return ""; }
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
  // Odds parsing from summary endpoint
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
    const oddsArr = data?.odds;
    const o = Array.isArray(oddsArr) ? oddsArr[0] : null;
    if (o) {
      return {
        favored: String(o.details || o.displayValue || "").replace(/^(Line|Spread|Odds):\s*/i, "").trim(),
        ou: String(o.overUnder ?? o.total ?? "").trim()
      };
    }
    return { favored: "", ou: "" };
  }

  function _parsePickcenter(pc, homeName, awayName) {
    if (!pc) return { favored: "", ou: "" };
    const ou = String(pc.overUnder ?? pc.total ?? pc.overunder ?? "").trim();
    const details = String(pc.details || pc.displayValue || "").replace(/^(Line|Spread|Odds):\s*/i, "").trim();
    if (details) return { favored: details, ou };
    const spreadNum = Number(pc.spread ?? pc.line ?? pc.handicap);
    if (!Number.isFinite(spreadNum)) return { favored: "", ou };
    const homeFav = !!pc.homeTeamOdds?.favorite;
    const awayFav = !!pc.awayTeamOdds?.favorite;
    let favoredTeam = homeFav ? homeName : awayFav ? awayName : (spreadNum < 0 ? homeName : awayName);
    const abs = Math.abs(spreadNum);
    return { favored: `${favoredTeam} -${abs % 1 === 0 ? abs.toFixed(0) : abs}`, ou };
  }

  function _buildOddsLine(favored, ou) {
    const hasFav = favored && favored !== "-";
    const hasOu  = ou && ou !== "-";
    if (!hasFav && !hasOu) return "";
    if (hasFav && hasOu) return `Favored: ${favored} • O/U: ${ou}`;
    if (hasFav) return `Favored: ${favored}`;
    return `O/U: ${ou}`;
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  function _daysSince(d) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = new Date(); const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.floor((t - start) / 86400000));
  }

  function _todayStr() {
    return _dateStr(new Date());
  }

  function _dateStr(d) {
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }

  function _fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
  }

  function _fmtGameDate(iso) {
    try {
      return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    } catch { return ""; }
  }

  function _applyTTUN(s) {
    return String(s || "").replace(/Michigan\s+Wolverines/gi, "TTUN").replace(/\bMichigan\b/gi, "TTUN");
  }

  function _esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

})();
