// split/beat.js
// Beat TTUN tab only (no News code in here).

/* =========================
   BEAT TTUN (TUNNEL ENTRANCE MODE)
   ========================= */

(function () {
  "use strict";

  // Safety: if escapeHtml is not defined yet, provide a tiny fallback.
  if (typeof window.escapeHtml !== "function") {
    window.escapeHtml = function (s) {
      return String(s ?? "").replace(/[&<>"']/g, function (c) {
        return ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "\"": "&quot;",
          "'": "&#39;"
        })[c];
      });
    };
  }

  // ESPN CDN logos (fast + reliable)
  const OSU_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png";
  const TTUN_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa/500/130.png";

  // All-time series (update anytime you want)
  const THE_GAME_ALL_TIME = {
    michWins: 62,
    osuWins: 52,
    ties: 6
  };

  // Last 10 *played* matchups (excludes 2020 canceled)
  const THE_GAME_LAST_10 = [
    { year: 2025, winner: "Ohio State", score: "27–9" },
    { year: 2024, winner: "TTUN",       score: "13–10" },
    { year: 2023, winner: "TTUN",       score: "30–24" },
    { year: 2022, winner: "TTUN",       score: "45–23" },
    { year: 2021, winner: "TTUN",       score: "42–27" },
    { year: 2019, winner: "Ohio State", score: "56–27" },
    { year: 2018, winner: "Ohio State", score: "62–39" },
    { year: 2017, winner: "Ohio State", score: "31–20" },
    { year: 2016, winner: "Ohio State", score: "30–27 (2OT)" },
    { year: 2015, winner: "Ohio State", score: "42–13" }
  ];

  // Timers (kept in module scope; also safely stopped between renders)
  let beatCountdownTimer = null;
  let beatRotateTimer = null;

  function stopBeatCountdown() {
    if (beatCountdownTimer) clearInterval(beatCountdownTimer);
    beatCountdownTimer = null;

    if (beatRotateTimer) clearInterval(beatRotateTimer);
    beatRotateTimer = null;
  }

  // “The Game” is typically the last Saturday of November.
  // Count down to **noon local** for consistency.
  function getNextTheGameDateLocalNoon() {
    const now = new Date();
    const year = now.getFullYear();
    const candidate = lastSaturdayOfNovemberAtNoon(year);
    if (candidate.getTime() > now.getTime()) return candidate;
    return lastSaturdayOfNovemberAtNoon(year + 1);
  }

  function lastSaturdayOfNovemberAtNoon(year) {
    const d = new Date(year, 10, 30, 12, 0, 0, 0); // month 10 = November
    while (d.getDay() !== 6) d.setDate(d.getDate() - 1); // 6 = Saturday
    return d;
  }

  function countdownParts(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(total / 86400);
    const hrs  = Math.floor((total % 86400) / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return { days, hrs, mins, secs };
  }

  function isGameWeek(targetDate) {
    const now = new Date();
    const diffMs = targetDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    return diffDays >= 0 && diffDays <= 7;
  }

  // Calculate current streak from THE_GAME_LAST_10 (most recent first)
  function computeCurrentStreak() {
    const list = Array.isArray(THE_GAME_LAST_10) ? THE_GAME_LAST_10 : [];
    if (!list.length) return { label: "—", owner: "" };

    const first = String(list[0].winner || "").trim();
    if (!first) return { label: "—", owner: "" };

    let streak = 0;
    for (const g of list) {
      if (String(g.winner || "").trim() === first) streak++;
      else break;
    }

    if (first === "Ohio State") {
      return { label: `CURRENT STREAK: ${streak}`, owner: "osu" };
    }
    // If they’ve been winning recently:
    return { label: `REVENGE PENDING: ${streak}`, owner: "ttun" };
  }

  function renderBeatTTUN() {
    const content = document.getElementById("content");
    if (!content) return;

    stopBeatCountdown();

    const target = getNextTheGameDateLocalNoon();
    const targetLabel = target.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

    const hypeLines = [
      "SILENCE THEIR STADIUM",
      "FINISH THE FIGHT",
      "LEAVE NO DOUBT",
      "NO MERCY",
      "DOMINATE"
    ];

    const streak = computeCurrentStreak();
    const gameWeek = isGameWeek(target);

    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Beat TTUN</h2>
            <span class="badge">Hype</span>
          </div>
        </div>
        <div class="subline">
          <div>${gameWeek ? "IT’S GAME WEEK." : "Scarlet Mode"}</div>
          <div>❌ichigan Week Energy</div>
        </div>
      </div>

      <!-- TUNNEL HERO -->
      <div class="beatHero ${gameWeek ? "gameWeek" : ""}">
        <div class="beatHeroTop">
          <div class="beatHeroTitle">MISSION: BEAT TTUN</div>
          <div class="beatHeroSub">Ohio State vs The Team Up North • ${window.escapeHtml(targetLabel)} • Noon</div>
        </div>

        <div class="beatBig">
          <div id="beatDays" class="beatBigDays">—</div>
          <div class="beatBigLabel">DAYS</div>
        </div>

        <div class="beatHmsRow" aria-label="Hours minutes seconds">
          <div class="beatHmsUnit"><span id="beatHrs">—</span><small>HRS</small></div>
          <div class="beatHmsUnit"><span id="beatMins">—</span><small>MINS</small></div>
          <div class="beatHmsUnit"><span id="beatSecs">—</span><small>SECS</small></div>
        </div>

        <div class="beatDivider"></div>

        <div id="beatHypeLine" class="beatHypeLine">${hypeLines[0]}</div>
        <div class="beatStreak ${streak.owner === "osu" ? "osu" : "ttun"}">${window.escapeHtml(streak.label)}</div>
      </div>

      <div class="notice">
        <div style="font-weight:800; letter-spacing:0.5px;">ALL-TIME RECORD</div>
        <div style="margin-top:6px; opacity:0.9;">TTUN are cheating bastards</div>

        <div class="rivalRecordRow">
          <div class="rivalTeam">
            <img class="rivalLogo" src="${OSU_LOGO}" alt="Ohio State logo" loading="lazy" decoding="async" />
            <div class="rivalText"><strong>Ohio State:</strong> ${THE_GAME_ALL_TIME.osuWins}</div>
          </div>

          <div class="rivalTeam">
            <img class="rivalLogo" src="${TTUN_LOGO}" alt="TTUN logo" loading="lazy" decoding="async" />
            <div class="rivalText"><strong>The Team Up North:</strong> ${THE_GAME_ALL_TIME.michWins}</div>
          </div>

          <div class="rivalTie"><strong>Ties:</strong> ${THE_GAME_ALL_TIME.ties}</div>
        </div>
      </div>

      <div class="notice">
        <div style="font-weight:800; letter-spacing:0.5px;">LAST 10 MATCHUPS</div>
        <div class="last10List">
          ${THE_GAME_LAST_10.map(g => {
            const winner = window.escapeHtml(String(g.winner || ""));
            const score  = window.escapeHtml(String(g.score || ""));
            return `
              <div class="last10Row">
                <div class="last10Year">${g.year}</div>
                <div class="last10Winner">${winner}</div>
                <div class="last10Score">${score}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    // Countdown tick (updates big days + h/m/s)
    const daysEl = document.getElementById("beatDays");
    const hrsEl  = document.getElementById("beatHrs");
    const minsEl = document.getElementById("beatMins");
    const secsEl = document.getElementById("beatSecs");

    const tick = () => {
      const ms = target.getTime() - Date.now();
      const p = countdownParts(ms);

      if (daysEl) daysEl.textContent = String(p.days);
      if (hrsEl)  hrsEl.textContent  = String(p.hrs).padStart(2, "0");
      if (minsEl) minsEl.textContent = String(p.mins).padStart(2, "0");
      if (secsEl) secsEl.textContent = String(p.secs).padStart(2, "0");
    };

    tick();
    beatCountdownTimer = setInterval(tick, 1000);

    // Rotate hype line every 5s
    const hypeEl = document.getElementById("beatHypeLine");
    let idx = 0;
    beatRotateTimer = setInterval(() => {
      idx = (idx + 1) % hypeLines.length;
      if (hypeEl) hypeEl.textContent = hypeLines[idx];
    }, 5000);
  }

  // Keep compatibility with shared.js router
  window.renderBeatTTUN = renderBeatTTUN;

})();