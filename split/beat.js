// split/beat.js
// Beat TTUN tab — fully upgraded with visual drama, stats, personality & motion.

(function () {
  "use strict";

  // Auto-inject beat-styles.css once
  (function () {
    if (!document.getElementById("beatStyles")) {
      const lnk = document.createElement("link");
      lnk.id   = "beatStyles";
      lnk.rel  = "stylesheet";
      lnk.href = "split/beat-styles.css";
      document.head.appendChild(lnk);
    }
  })();

  if (typeof window.escapeHtml !== "function") {
    window.escapeHtml = function (s) {
      return String(s ?? "").replace(/[&<>"']/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c];
      });
    };
  }

  const OSU_LOGO  = "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png";
  const TTUN_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa/500/130.png";

  const THE_GAME_ALL_TIME = { michWins: 62, osuWins: 52, ties: 6 };

  const THE_GAME_LAST_10 = [
    { year: 2025, winner: "Ohio State", score: "27\u20139"          },
    { year: 2024, winner: "TTUN",       score: "13\u201310"         },
    { year: 2023, winner: "TTUN",       score: "30\u201324"         },
    { year: 2022, winner: "TTUN",       score: "45\u201323"         },
    { year: 2021, winner: "TTUN",       score: "42\u201327"         },
    { year: 2019, winner: "Ohio State", score: "56\u201327 \uD83D\uDC80"      },
    { year: 2018, winner: "Ohio State", score: "62\u201339 \uD83D\uDC80"      },
    { year: 2017, winner: "Ohio State", score: "31\u201320"         },
    { year: 2016, winner: "Ohio State", score: "30\u201327 (2OT)"   },
    { year: 2015, winner: "Ohio State", score: "42\u201313 \uD83D\uDC80"      },
  ];

  const HYPE_QUOTES = [
    { quote: "You can't spell GREAT without OHIO STATE.", attr: "Fan tradition" },
    { quote: "This is the game. Everything else is just practice.", attr: "Woody Hayes" },
    { quote: "We don't use that word. We call them The Team Up North.", attr: "Woody Hayes" },
    { quote: "Michigan is a joke. Ann Arbor is a toilet.", attr: "Cardale Jones, 2015" },
    { quote: "I still hate TTUN. I hate them with every fiber of my being.", attr: "Kirk Herbstreit" },
    { quote: "No place like The Shoe. No feeling like beating TTUN.", attr: "OSU faithful" },
    { quote: "The most important game in college football is played in November.", attr: "Jim Tressel" },
    { quote: "Every year this game is circled on the calendar. It never gets old.", attr: "Ryan Day" },
  ];

  const SHAME_CARDS = [
    { emoji: "\uD83D\uDCCB", title: "Sign-Stealing Scandal", body: "Caught red-handed running an elaborate sign-stealing operation. The NCAA investigation confirmed what everyone already knew." },
    { emoji: "\uD83C\uDFC6", title: "Rose Bowl Drought", body: "Couldn't close at the Rose Bowl when it mattered most. Scarlet and Gray have owned Pasadena." },
    { emoji: "\uD83D\uDE2C", title: "Harbaugh's OSU Record", body: "Jim Harbaugh: 3-5 against Ohio State in eight seasons. The man never figured it out." },
    { emoji: "\uD83C\uDF3D", title: "Corn Belt Reputation", body: "Their fans stormed the field after beating a team ranked #2. Ohio State doesn't storm fields. We build trophies." },
    { emoji: "\uD83D\uDCC9", title: "Bowl Struggles Since '97", body: "Elite regular season. Mediocre bowl outcomes. The gap in big-game execution tells the whole story." },
    { emoji: "\uD83E\uDD21", title: "The Fake Rivalry Narrative", body: "Every year their media declares them back. Every year The Game settles it on the field." },
  ];

  const HYPE_LINES = [
    "SILENCE THEIR STADIUM",
    "FINISH THE FIGHT",
    "LEAVE NO DOUBT",
    "NO MERCY",
    "DOMINATE",
  ];

  let beatCountdownTimer = null;
  let beatRotateTimer    = null;
  let beatHypeTimer      = null;
  let beatShameTimer     = null;

  function stopAllTimers() {
    [beatCountdownTimer, beatRotateTimer, beatHypeTimer, beatShameTimer].forEach(t => t && clearInterval(t));
    beatCountdownTimer = beatRotateTimer = beatHypeTimer = beatShameTimer = null;
  }

  function getNextTheGameDateLocalNoon() {
    const now = new Date();
    const year = now.getFullYear();
    const candidate = lastSaturdayOfNovemberAtNoon(year);
    if (candidate.getTime() > now.getTime()) return candidate;
    return lastSaturdayOfNovemberAtNoon(year + 1);
  }

  function lastSaturdayOfNovemberAtNoon(year) {
    const d = new Date(year, 10, 30, 12, 0, 0, 0);
    while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
    return d;
  }

  function countdownParts(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hrs:  Math.floor((total % 86400) / 3600),
      mins: Math.floor((total % 3600) / 60),
      secs: total % 60,
    };
  }

  function isGameWeek(targetDate) {
    const diffDays = Math.floor((targetDate.getTime() - Date.now()) / 86400000);
    return diffDays >= 0 && diffDays <= 7;
  }

  function computeCurrentStreak() {
    const list = THE_GAME_LAST_10;
    if (!list.length) return { label: "\u2014", owner: "" };
    const first = String(list[0].winner || "").trim();
    let streak = 0;
    for (const g of list) {
      if (String(g.winner || "").trim() === first) streak++;
      else break;
    }
    if (first === "Ohio State") return { label: `CURRENT STREAK: ${streak}`, owner: "osu" };
    return { label: `REVENGE PENDING: ${streak}`, owner: "ttun" };
  }

  function buildStreakBar() {
    return THE_GAME_LAST_10.map(g => {
      const isOSU = g.winner === "Ohio State";
      const cls   = isOSU ? "streakDot osu" : "streakDot ttun";
      const tip   = `${g.year}: ${g.winner} ${g.score}`;
      return `<div class="${cls}" title="${window.escapeHtml(tip)}"></div>`;
    }).join("");
  }

  function buildDonut(osuW, michW, ties) {
    const total = osuW + michW + ties;
    const pOSU  = osuW / total;
    const pTTUN = michW / total;
    const pTies = ties / total;
    const r = 38, cx = 46, cy = 46, stroke = 12;
    const circ = 2 * Math.PI * r;

    function arc(pct) {
      return `${(pct * circ).toFixed(2)} ${circ.toFixed(2)}`;
    }
    const offTTUN = -((0) * circ);
    const offTies  = -(pTTUN * circ);
    const offOSU   = -((pTTUN + pTies) * circ);

    return `
      <svg class="donutChart" viewBox="0 0 92 92" width="92" height="92" aria-label="Win percentage chart">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}" />
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="#c5a503" stroke-width="${stroke}"
          stroke-dasharray="${arc(pTTUN)}"
          stroke-dashoffset="${offTTUN.toFixed(2)}"
          stroke-linecap="butt"
          style="transform:rotate(-90deg);transform-origin:50% 50%"
        />
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="rgba(156,163,175,0.55)" stroke-width="${stroke}"
          stroke-dasharray="${arc(pTies)}"
          stroke-dashoffset="${offTies.toFixed(2)}"
          stroke-linecap="butt"
          style="transform:rotate(-90deg);transform-origin:50% 50%"
        />
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="#bb0000" stroke-width="${stroke}"
          stroke-dasharray="${arc(pOSU)}"
          stroke-dashoffset="${offOSU.toFixed(2)}"
          stroke-linecap="butt"
          style="transform:rotate(-90deg);transform-origin:50% 50%"
        />
        <text x="${cx}" y="${cy - 5}" text-anchor="middle" fill="#fff" font-size="11" font-weight="900" font-family="-apple-system,sans-serif">${Math.round(pOSU * 100)}%</text>
        <text x="${cx}" y="${cy + 8}" text-anchor="middle" fill="rgba(255,255,255,0.6)" font-size="8" font-weight="800" font-family="-apple-system,sans-serif">OSU</text>
      </svg>`;
  }

  function launchConfetti(container) {
    if (!container) return;
    const colors = ["#bb0000","#ffffff","#888888","#dd3333","#ff6666"];
    for (let i = 0; i < 60; i++) {
      const dot = document.createElement("div");
      dot.className = "confettiDot";
      dot.style.cssText = `
        left:${Math.random() * 100}%;
        background:${colors[Math.floor(Math.random() * colors.length)]};
        width:${5 + Math.random() * 6}px;
        height:${5 + Math.random() * 6}px;
        animation-delay:${Math.random() * 1.2}s;
        animation-duration:${1.8 + Math.random() * 1.4}s;
      `;
      container.appendChild(dot);
    }
    setTimeout(() => {
      container.querySelectorAll(".confettiDot").forEach(d => d.remove());
    }, 4000);
  }

  function renderBeatTTUN() {
    const content = document.getElementById("content");
    if (!content) return;

    stopAllTimers();

    const target      = getNextTheGameDateLocalNoon();
    const targetLabel = target.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    const streak      = computeCurrentStreak();
    const gameWeek    = isGameWeek(target);
    const { osuWins, michWins, ties } = THE_GAME_ALL_TIME;
    const donutSVG    = buildDonut(osuWins, michWins, ties);
    const streakBar   = buildStreakBar();

    const initialQuote = HYPE_QUOTES[0];

    content.innerHTML = `
      <!-- ===== HERO ===== -->
      <div class="beatHero ${gameWeek ? "gameWeek" : ""}" id="beatHeroCard">
        ${gameWeek ? '<div class="confettiZone" id="confettiZone"></div>' : ""}

        <div class="beatHeroPulseRing" id="beatPulseRing"></div>

        <div class="beatHeroTop">
          <div class="beatHeroTitle">MISSION: BEAT TTUN</div>
          <div class="beatHeroSub">Ohio State vs The Team Up North &middot; ${window.escapeHtml(targetLabel)} &middot; Noon</div>
        </div>

        <div class="beatBig">
          <div id="beatDays" class="beatBigDays">&mdash;</div>
          <div class="beatBigLabel">DAYS</div>
        </div>

        <div class="beatHmsRow" aria-label="Hours minutes seconds">
          <div class="beatHmsUnit" id="beatHrsUnit"><span id="beatHrs">&mdash;</span><small>HRS</small></div>
          <div class="beatHmsUnit" id="beatMinsUnit"><span id="beatMins">&mdash;</span><small>MINS</small></div>
          <div class="beatHmsUnit" id="beatSecsUnit"><span id="beatSecs">&mdash;</span><small>SECS</small></div>
        </div>

        <div class="beatDivider"></div>

        <div id="beatHypeLine" class="beatHypeLine">${HYPE_LINES[0]}</div>

        <div class="beatStreakBadge ${streak.owner === "osu" ? "osu" : "ttun"}">
          ${window.escapeHtml(streak.label)}
        </div>
      </div>

      <!-- ===== STATS: Win% Donut + Streak Bar ===== -->
      <div class="notice beatStatsSection">
        <div class="beatSectionLabel">ALL-TIME SERIES</div>

        <div class="beatDonutRow" id="beatDonutRow">
          <div class="rivalClashLogo" id="clashOSU">
            <img src="${OSU_LOGO}" alt="Ohio State" width="48" height="48" loading="lazy" decoding="async" class="rivalClashImg" />
            <div class="rivalClashNum osu">${osuWins}</div>
          </div>

          <div class="donutWrap">${donutSVG}</div>

          <div class="rivalClashLogo" id="clashTTUN">
            <img src="${TTUN_LOGO}" alt="TTUN" width="48" height="48" loading="lazy" decoding="async" class="rivalClashImg ttun" />
            <div class="rivalClashNum ttun">${michWins}</div>
          </div>
        </div>

        <div class="rivalTiesLine">Ties: ${ties}</div>

        <div class="beatSectionLabel" style="margin-top:18px;">LAST 10 MATCHUPS</div>
        <div class="streakBarWrap">
          <div class="streakBarLegend">
            <span class="streakLegDot osu"></span><span>OSU</span>
            <span class="streakLegDot ttun" style="margin-left:10px;"></span><span>TTUN</span>
          </div>
          <div class="streakBar" id="streakBar">${streakBar}</div>
        </div>

        <div class="last10List" id="last10List">
          ${THE_GAME_LAST_10.map((g, i) => {
            const isOSU   = g.winner === "Ohio State";
            const blowout = g.score.includes("\uD83D\uDC80");
            const scoreClean = window.escapeHtml(g.score);
            return `
              <div class="last10Row ${isOSU ? "winOSU" : "winTTUN"}" style="animation-delay:${i * 55}ms">
                <div class="last10Year">${g.year}</div>
                <div class="last10Winner">${window.escapeHtml(g.winner)}</div>
                <div class="last10Score">
                  ${scoreClean}
                  ${blowout ? '<span class="blowoutBadge">BLOWOUT</span>' : ""}
                </div>
              </div>`;
          }).join("")}
        </div>
      </div>

      <!-- ===== HYPE QUOTE WALL ===== -->
      <div class="notice beatQuoteSection">
        <div class="beatSectionLabel">HYPE WALL</div>
        <div id="beatQuoteCard" class="beatQuoteCard">
          <div class="beatQuoteText" id="beatQuoteText">&ldquo;${window.escapeHtml(initialQuote.quote)}&rdquo;</div>
          <div class="beatQuoteAttr" id="beatQuoteAttr">&mdash; ${window.escapeHtml(initialQuote.attr)}</div>
        </div>
        <div class="beatQuoteDots" id="beatQuoteDots">
          ${HYPE_QUOTES.map((_, i) => `<div class="quoteDot ${i === 0 ? "active" : ""}" data-qi="${i}"></div>`).join("")}
        </div>
      </div>

      <!-- ===== XICHIGAN HALL OF SHAME ===== -->
      <div class="notice beatShameSection">
        <div class="beatSectionLabel">&#x274C;ichigan Hall of Shame</div>
        <div class="beatShameGrid" id="beatShameGrid">
          ${SHAME_CARDS.map((c, i) => `
            <div class="shameCard" style="animation-delay:${i * 70}ms">
              <div class="shameEmoji">${c.emoji}</div>
              <div class="shameTitle">${window.escapeHtml(c.title)}</div>
              <div class="shameBody">${window.escapeHtml(c.body)}</div>
            </div>`).join("")}
        </div>
      </div>
    `;

    const daysEl   = document.getElementById("beatDays");
    const hrsEl    = document.getElementById("beatHrs");
    const minsEl   = document.getElementById("beatMins");
    const secsEl   = document.getElementById("beatSecs");
    const minsUnit = document.getElementById("beatMinsUnit");

    let prevMins = -1;

    const tick = () => {
      const ms = target.getTime() - Date.now();
      const p  = countdownParts(ms);

      if (daysEl) daysEl.textContent = String(p.days);
      if (hrsEl)  hrsEl.textContent  = String(p.hrs).padStart(2, "0");
      if (minsEl) minsEl.textContent = String(p.mins).padStart(2, "0");
      if (secsEl) secsEl.textContent = String(p.secs).padStart(2, "0");

      const ring = document.getElementById("beatPulseRing");
      if (ring) {
        ring.classList.remove("beatPulse");
        void ring.offsetWidth;
        ring.classList.add("beatPulse");
      }

      if (p.secs === 0 && p.mins !== prevMins) {
        prevMins = p.mins;
        if (minsUnit) {
          minsUnit.classList.remove("beatUnitShake");
          void minsUnit.offsetWidth;
          minsUnit.classList.add("beatUnitShake");
        }
      }
    };

    tick();
    beatCountdownTimer = setInterval(tick, 1000);

    const hypeEl = document.getElementById("beatHypeLine");
    let hypeIdx = 0;
    beatHypeTimer = setInterval(() => {
      if (!hypeEl) return;
      hypeEl.classList.add("hypeOut");
      setTimeout(() => {
        hypeIdx = (hypeIdx + 1) % HYPE_LINES.length;
        hypeEl.textContent = HYPE_LINES[hypeIdx];
        hypeEl.classList.remove("hypeOut");
        hypeEl.classList.add("hypeIn");
        setTimeout(() => hypeEl.classList.remove("hypeIn"), 400);
      }, 300);
    }, 5000);

    let quoteIdx = 0;
    function showQuote(idx) {
      const qEl  = document.getElementById("beatQuoteText");
      const aEl  = document.getElementById("beatQuoteAttr");
      const dots = document.querySelectorAll(".quoteDot");
      if (!qEl || !aEl) return;

      qEl.classList.add("quoteOut");
      aEl.classList.add("quoteOut");
      setTimeout(() => {
        quoteIdx = idx;
        qEl.textContent = `\u201c${HYPE_QUOTES[quoteIdx].quote}\u201d`;
        aEl.textContent = `\u2014 ${HYPE_QUOTES[quoteIdx].attr}`;
        qEl.classList.remove("quoteOut");
        aEl.classList.remove("quoteOut");
        qEl.classList.add("quoteIn");
        aEl.classList.add("quoteIn");
        setTimeout(() => { qEl.classList.remove("quoteIn"); aEl.classList.remove("quoteIn"); }, 400);
        dots.forEach((d, i) => d.classList.toggle("active", i === quoteIdx));
      }, 280);
    }

    beatRotateTimer = setInterval(() => showQuote((quoteIdx + 1) % HYPE_QUOTES.length), 8000);

    document.querySelectorAll(".quoteDot").forEach(d => {
      d.addEventListener("click", () => showQuote(parseInt(d.dataset.qi, 10)));
    });

    requestAnimationFrame(() => {
      document.querySelectorAll(".last10Row").forEach(row => {
        row.classList.add("slideIn");
      });
      document.querySelectorAll(".shameCard").forEach(card => {
        card.classList.add("slideIn");
      });
    });

    setTimeout(() => {
      const osuEl  = document.getElementById("clashOSU");
      const ttunEl = document.getElementById("clashTTUN");
      if (osuEl)  osuEl.classList.add("clashEnter");
      if (ttunEl) ttunEl.classList.add("clashEnter");
    }, 120);

    if (gameWeek) {
      setTimeout(() => launchConfetti(document.getElementById("confettiZone")), 300);
    }
  }

  window.renderBeatTTUN = renderBeatTTUN;

})();
