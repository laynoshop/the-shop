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

  const LEAGUES = [
    { key: "cfb",   label: "CFB",    url: d => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${d}&limit=50` },
    { key: "nfl",   label: "NFL",    url: d => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${d}&limit=50` },
    { key: "nba",   label: "NBA",    url: d => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d}&limit=50` },
    { key: "mlb",   label: "MLB",    url: d => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${d}&limit=50` },
    { key: "nhl",   label: "NHL",    url: d => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${d}&limit=50` },
    { key: "ncaam", label: "NCAAB",  url: d => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${d}&groups=50&limit=100` },
    { key: "mls",   label: "MLS",    url: d => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${d}&limit=50` },
    { key: "pga",   label: "PGA",    url: d => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${d}&limit=50` },
    { key: "ufc",   label: "UFC",    url: d => `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${d}&limit=50` },
  ];

  let _intervals  = [];
  let _activeLeague = "cfb";
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
    const leagueBtns = LEAGUES.map(l =>
      `<button class="piLeagueBtn${l.key === _activeLeague ? " active" : ""}" data-league="${l.key}">${l.label}</button>`
    ).join("");

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

  /* ---- Score cards ---- */
  .piGame {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 10px;
    margin-bottom: 5px;
    background: rgba(255,255,255,0.04);
    border-radius: 6px;
    border-left: 3px solid #333;
    transition: border-color 0.2s;
  }
  .piGame.live   { border-left-color: #cc0000; background: rgba(180,0,0,0.08); }
  .piGame.final  { border-left-color: #444; }
  .piGame.sched  { border-left-color: rgba(0,120,0,0.6); }
  .piGameTeams   { display: flex; flex-direction: column; gap: 3px; flex: 1; }
  .piTeamRow     { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .piTeamName    { font-size: clamp(0.68rem, 1.4vw, 0.88rem); font-weight: 600; color: #e8e8e8; }
  .piTeamScore   { font-size: clamp(0.72rem, 1.5vw, 0.95rem); font-weight: 900; color: #fff; }
  .piGameStatus  { font-size: 0.68rem; color: #777; text-align: right; min-width: 52px; padding-left: 8px; }
  .piGameStatus.live { color: #ff4444; font-weight: 800; }
  .piNoGames { color: #444; font-size: 0.85rem; text-align: center; padding: 24px 0; }

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
    <div class="piPanelHead">Scores</div>
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
  // Scores
  // ----------------------------------------------------------------
  function _renderScores() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;
    const league = LEAGUES.find(l => l.key === _activeLeague) || LEAGUES[0];
    const date   = _todayStr();
    fetch(league.url(date))
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const events = data?.events || [];
        if (!events.length) { el.innerHTML = `<div class="piNoGames">No games today.</div>`; return; }
        el.innerHTML = events.map(ev => _buildGameCard(ev)).join("");
        try { if (typeof window.replaceMichiganText === "function") window.replaceMichiganText(el); } catch {}
      })
      .catch(() => { el.innerHTML = `<div class="piNoGames">Scores unavailable.</div>`; });
  }

  function _buildGameCard(ev) {
    try {
      const comp   = (ev.competitions || [])[0] || {};
      const status = ev.status || {};
      const state  = (status.type || {}).state || "pre";
      const done   = (status.type || {}).completed || false;
      const clock  = status.displayClock || "";
      const period = status.period || 0;

      let cls = "sched", label = ev.date ? _fmtTime(ev.date) : "Scheduled";
      if (state === "in")          { cls = "live";  label = `Q${period} ${clock}`; }
      if (state === "post" || done) { cls = "final"; label = "Final"; }

      const teams = (comp.competitors || []).map(c => ({
        name:  _applyTTUN(String((c.team || {}).abbreviation || (c.team || {}).shortDisplayName || "TBD")),
        score: c.score || ""
      }));

      const rows = teams.map(t =>
        `<div class="piTeamRow"><span class="piTeamName">${_esc(t.name)}</span><span class="piTeamScore">${_esc(t.score)}</span></div>`
      ).join("");

      return `<div class="piGame ${cls}"><div class="piGameTeams">${rows}</div><div class="piGameStatus ${cls === 'live' ? 'live' : ''}">${label}</div></div>`;
    } catch { return ""; }
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
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  }

  function _fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
  }

  function _applyTTUN(s) {
    return String(s || "").replace(/Michigan\s+Wolverines/gi, "TTUN").replace(/\bMichigan\b/gi, "TTUN");
  }

  function _esc(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

})();
