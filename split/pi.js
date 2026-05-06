// split/pi.js
// Pi Scoreboard — full-screen TV dashboard for the Raspberry Pi.
// Admin only. Launched from the entry screen via window.launchPiScoreboard().
// Exits back to the entry screen via the close button or Escape key.
// Self-contained: no changes needed to any other split file.

(function () {
  "use strict";

  // ----------------------------------------------------------------
  // Constants
  // ----------------------------------------------------------------
  const REFRESH_SCORES_MS  = 60 * 1000;   // re-render scores panel every 60s
  const REFRESH_NEWS_MS    = 5  * 60 * 1000; // re-render news panel every 5min
  const COUNTDOWN_TICK_MS  = 1000;         // countdown ticks every second

  // The Game date: Saturday, Nov 28, 2026 @ noon ET
  const THE_GAME_DATE = new Date("2026-11-28T17:00:00Z"); // noon ET = 17:00 UTC

  let _intervals = [];

  // ----------------------------------------------------------------
  // Guard: admin only
  // ----------------------------------------------------------------
  function isAdmin() {
    return typeof window.getRole === "function" && window.getRole() === "admin";
  }

  // ----------------------------------------------------------------
  // Launch
  // ----------------------------------------------------------------
  function launchPiScoreboard() {
    if (!isAdmin()) return;

    // Hide entry screen, show Pi overlay
    const entry = document.getElementById("entry");
    const overlay = document.getElementById("piScoreboard");
    if (!overlay) return;

    if (entry) entry.style.display = "none";

    overlay.innerHTML = buildShell();
    overlay.style.cssText = [
      "display:block",
      "position:fixed",
      "inset:0",
      "z-index:9999",
      "background:#0a0a0a",
      "color:#f0f0f0",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "overflow:hidden",
    ].join(";");

    // Close button
    const closeBtn = document.getElementById("piCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", exitPiScoreboard);

    // Escape key exits
    document.addEventListener("keydown", _handleEscKey);

    // Start all panels
    _startCountdown();
    _startScoresPanel();
    _startNewsPanel();
    _startRivalryTicker();
  }
  window.launchPiScoreboard = launchPiScoreboard;

  // ----------------------------------------------------------------
  // Exit
  // ----------------------------------------------------------------
  function exitPiScoreboard() {
    // Clear all refresh intervals
    _intervals.forEach(id => clearInterval(id));
    _intervals = [];
    document.removeEventListener("keydown", _handleEscKey);

    const overlay = document.getElementById("piScoreboard");
    if (overlay) {
      overlay.style.display = "none";
      overlay.innerHTML = "";
    }

    // Return to entry screen
    if (typeof window.showEntryScreen === "function") {
      window.showEntryScreen();
    }
  }
  window.exitPiScoreboard = exitPiScoreboard;

  function _handleEscKey(e) {
    if (e.key === "Escape") exitPiScoreboard();
  }

  // ----------------------------------------------------------------
  // HTML Shell
  // ----------------------------------------------------------------
  function buildShell() {
    return `
      <style>
        #piWrap {
          display: grid;
          grid-template-rows: auto 1fr auto;
          grid-template-columns: 1fr 1fr;
          height: 100vh;
          height: 100dvh;
          gap: 0;
          background: #0a0a0a;
        }

        /* ---- Top bar ---- */
        #piTopBar {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #bb0000;
          padding: 10px 20px;
          gap: 12px;
        }
        #piTopBar .piTitle {
          font-size: clamp(1.1rem, 2.5vw, 1.6rem);
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #fff;
          text-transform: uppercase;
        }
        #piCountdownWrap {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: clamp(0.75rem, 1.6vw, 1rem);
          color: #ffe0e0;
          font-weight: 600;
        }
        #piCountdownWrap .piCdLabel {
          color: #ffd0d0;
          font-weight: 400;
          margin-right: 4px;
        }
        .piCdUnit { text-align: center; min-width: 42px; }
        .piCdNum {
          display: block;
          font-size: clamp(1rem, 2.2vw, 1.5rem);
          font-weight: 900;
          color: #fff;
          line-height: 1;
        }
        .piCdSub {
          display: block;
          font-size: 0.55rem;
          letter-spacing: 0.08em;
          color: #ffaaaa;
          text-transform: uppercase;
        }
        .piCdSep { font-size: clamp(1rem, 2vw, 1.4rem); color: #ff8888; align-self: flex-start; margin-top: 2px; }
        #piCloseBtn {
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.3);
          color: #fff;
          border-radius: 6px;
          padding: 6px 14px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        #piCloseBtn:hover { background: rgba(255,255,255,0.28); }

        /* ---- Panels ---- */
        #piScoresPanel, #piNewsPanel {
          overflow-y: auto;
          padding: 16px 14px;
          border-right: 1px solid #1e1e1e;
        }
        #piNewsPanel { border-right: none; }

        .piPanelHead {
          font-size: clamp(0.7rem, 1.4vw, 0.95rem);
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #bb0000;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #222;
        }

        /* Scores */
        .piScoreGame {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 10px;
          margin-bottom: 6px;
          background: #141414;
          border-radius: 6px;
          font-size: clamp(0.7rem, 1.5vw, 0.92rem);
          border-left: 3px solid #333;
        }
        .piScoreGame.live   { border-left-color: #bb0000; }
        .piScoreGame.final  { border-left-color: #555; }
        .piScoreGame.sched  { border-left-color: #2a4a2a; }
        .piGameTeams { display: flex; flex-direction: column; gap: 3px; flex: 1; }
        .piTeamRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .piTeamName { font-weight: 600; color: #e8e8e8; }
        .piTeamScore { font-weight: 800; font-size: 1.05em; color: #fff; }
        .piGameStatus {
          font-size: 0.7em;
          color: #888;
          text-align: right;
          min-width: 52px;
          padding-left: 8px;
        }
        .piGameStatus.live { color: #ff4444; font-weight: 700; }

        /* News */
        .piNewsItem {
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #1a1a1a;
        }
        .piNewsItem:last-child { border-bottom: none; }
        .piNewsHeadline {
          font-size: clamp(0.72rem, 1.5vw, 0.9rem);
          font-weight: 600;
          color: #e8e8e8;
          line-height: 1.4;
          margin-bottom: 3px;
        }
        .piNewsSource {
          font-size: 0.68rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* ---- Bottom ticker ---- */
        #piTicker {
          grid-column: 1 / -1;
          background: #111;
          border-top: 1px solid #222;
          padding: 7px 16px;
          font-size: clamp(0.7rem, 1.3vw, 0.85rem);
          color: #888;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #piTicker span { color: #bb0000; font-weight: 700; margin-right: 6px; }

        /* Scrollbar styling for dark mode */
        #piScoresPanel::-webkit-scrollbar,
        #piNewsPanel::-webkit-scrollbar { width: 4px; }
        #piScoresPanel::-webkit-scrollbar-track,
        #piNewsPanel::-webkit-scrollbar-track { background: #111; }
        #piScoresPanel::-webkit-scrollbar-thumb,
        #piNewsPanel::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      </style>

      <div id="piWrap">

        <!-- Top bar -->
        <div id="piTopBar">
          <div class="piTitle">&#x1F3AA; The Shop &mdash; Pi Scoreboard</div>

          <div id="piCountdownWrap">
            <span class="piCdLabel">The Game:</span>
            <div class="piCdUnit">
              <span class="piCdNum" id="piCdDays">--</span>
              <span class="piCdSub">days</span>
            </div>
            <span class="piCdSep">:</span>
            <div class="piCdUnit">
              <span class="piCdNum" id="piCdHrs">--</span>
              <span class="piCdSub">hrs</span>
            </div>
            <span class="piCdSep">:</span>
            <div class="piCdUnit">
              <span class="piCdNum" id="piCdMins">--</span>
              <span class="piCdSub">min</span>
            </div>
            <span class="piCdSep">:</span>
            <div class="piCdUnit">
              <span class="piCdNum" id="piCdSecs">--</span>
              <span class="piCdSub">sec</span>
            </div>
          </div>

          <button id="piCloseBtn" type="button">&#x2715; Exit</button>
        </div>

        <!-- Scores panel (left) -->
        <div id="piScoresPanel">
          <div class="piPanelHead">&#x1F3C8; Scores</div>
          <div id="piScoresContent"><div style="color:#555;font-size:0.85rem;">Loading scores&hellip;</div></div>
        </div>

        <!-- News panel (right) -->
        <div id="piNewsPanel">
          <div class="piPanelHead">&#x1F4F0; Top News</div>
          <div id="piNewsContent"><div style="color:#555;font-size:0.85rem;">Loading news&hellip;</div></div>
        </div>

        <!-- Bottom ticker -->
        <div id="piTicker">
          <span>THE SHOP</span> Pi Scoreboard &mdash; Admin Dashboard
        </div>

      </div>
    `;
  }

  // ----------------------------------------------------------------
  // Countdown
  // ----------------------------------------------------------------
  function _startCountdown() {
    function tick() {
      const now = Date.now();
      const diff = THE_GAME_DATE.getTime() - now;

      const daysEl  = document.getElementById("piCdDays");
      const hrsEl   = document.getElementById("piCdHrs");
      const minsEl  = document.getElementById("piCdMins");
      const secsEl  = document.getElementById("piCdSecs");

      if (!daysEl) return; // overlay was closed

      if (diff <= 0) {
        daysEl.textContent = "0";
        hrsEl.textContent  = "0";
        minsEl.textContent = "0";
        secsEl.textContent = "0";
        return;
      }

      const totalSecs = Math.floor(diff / 1000);
      const days  = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins  = Math.floor((totalSecs % 3600) / 60);
      const secs  = totalSecs % 60;

      daysEl.textContent = String(days);
      hrsEl.textContent  = String(hours).padStart(2, "0");
      minsEl.textContent = String(mins).padStart(2, "0");
      secsEl.textContent = String(secs).padStart(2, "0");
    }

    tick();
    _intervals.push(setInterval(tick, COUNTDOWN_TICK_MS));
  }

  // ----------------------------------------------------------------
  // Scores Panel
  // ----------------------------------------------------------------
  function _startScoresPanel() {
    _renderScores();
    _intervals.push(setInterval(_renderScores, REFRESH_SCORES_MS));
  }

  function _renderScores() {
    const el = document.getElementById("piScoresContent");
    if (!el) return;

    // Pull from the existing scores module if available
    // We read window.__piLastScoresHTML if scores.js exposes rendered HTML,
    // otherwise fall back to calling loadScores into a shadow container and
    // extracting what we need. For now we display a styled placeholder that
    // will be wired to live data in a future update once we confirm the
    // scores.js data shape.
    try {
      // Attempt to reuse the same ESPN feed scores.js uses
      const today = (function() {
        try {
          return localStorage.getItem("theShopDate_v1") || _todayStr();
        } catch { return _todayStr(); }
      })();

      const url = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${today}&groups=80&limit=50`;

      fetch(url)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => {
          const events = (data && data.events) || [];
          if (!events.length) {
            el.innerHTML = `<div style="color:#555;font-size:0.85rem;">No games scheduled today.</div>`;
            return;
          }
          el.innerHTML = events.map(ev => _buildGameCard(ev)).join("");
        })
        .catch(() => {
          el.innerHTML = `<div style="color:#555;font-size:0.85rem;">Scores unavailable &mdash; check connection.</div>`;
        });
    } catch (err) {
      el.innerHTML = `<div style="color:#555;font-size:0.85rem;">Scores unavailable.</div>`;
    }
  }

  function _buildGameCard(ev) {
    try {
      const comp   = (ev.competitions || [])[0] || {};
      const comps  = comp.competitors || [];
      const status = (ev.status || {});
      const stateVal = (status.type || {}).state || "pre";
      const clock  = status.displayClock || "";
      const period = status.period || 0;
      const completed = (status.type || {}).completed || false;

      let statusClass = "sched";
      let statusText  = ev.date ? _fmtDate(ev.date) : "Scheduled";
      if (stateVal === "in") { statusClass = "live"; statusText = `Q${period} ${clock}`; }
      if (stateVal === "post" || completed) { statusClass = "final"; statusText = "Final"; }

      const teams = comps.map(c => ({
        name:  (c.team || {}).abbreviation || (c.team || {}).shortDisplayName || "TBD",
        score: c.score || "",
        home:  c.homeAway === "home"
      }));

      const rows = teams.map(t => `
        <div class="piTeamRow">
          <span class="piTeamName">${t.name}</span>
          <span class="piTeamScore">${t.score}</span>
        </div>
      `).join("");

      return `
        <div class="piScoreGame ${statusClass}">
          <div class="piGameTeams">${rows}</div>
          <div class="piGameStatus ${statusClass === 'live' ? 'live' : ''}">${statusText}</div>
        </div>
      `;
    } catch { return ""; }
  }

  function _todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  function _fmtDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch { return ""; }
  }

  // ----------------------------------------------------------------
  // News Panel
  // ----------------------------------------------------------------
  function _startNewsPanel() {
    _renderNews();
    _intervals.push(setInterval(_renderNews, REFRESH_NEWS_MS));
  }

  function _renderNews() {
    const el = document.getElementById("piNewsContent");
    if (!el) return;

    const url = "https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?limit=12";

    fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        const articles = (data && data.articles) || [];
        if (!articles.length) {
          el.innerHTML = `<div style="color:#555;font-size:0.85rem;">No news available.</div>`;
          return;
        }
        el.innerHTML = articles.slice(0, 12).map(a => `
          <div class="piNewsItem">
            <div class="piNewsHeadline">${_esc(a.headline || a.title || "")}</div>
            <div class="piNewsSource">${_esc((a.source || a.byline || ""))}</div>
          </div>
        `).join("");

        // Run TTUN text replacer if available
        try {
          if (typeof window.replaceMichiganText === "function") {
            window.replaceMichiganText(el);
          }
        } catch {}
      })
      .catch(() => {
        el.innerHTML = `<div style="color:#555;font-size:0.85rem;">News unavailable &mdash; check connection.</div>`;
      });
  }

  // ----------------------------------------------------------------
  // Bottom Ticker
  // ----------------------------------------------------------------
  function _startRivalryTicker() {
    const ticker = document.getElementById("piTicker");
    if (!ticker) return;

    const LAST_TTUN_WIN = new Date(2024, 10, 30);
    const start = new Date(LAST_TTUN_WIN.getFullYear(), LAST_TTUN_WIN.getMonth(), LAST_TTUN_WIN.getDate());
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days  = Math.max(0, Math.floor((today - start) / 86400000));

    ticker.innerHTML = `<span>THE SHOP</span>${days} days since TTUN has won in The Game &nbsp;&nbsp;&bull;&nbsp;&nbsp; Admin Dashboard &nbsp;&nbsp;&bull;&nbsp;&nbsp; Pi Scoreboard`;
  }

  // ----------------------------------------------------------------
  // Utility
  // ----------------------------------------------------------------
  function _esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

})();
