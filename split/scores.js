      // status accent classes (your “sexy up” styles)
      if (state === "in") card.classList.add("statusLive");
      else if (state === "pre") card.classList.add("statusPre");
      else if (state === "post") card.classList.add("statusFinal");
      if (!initialOdds?.favored && !initialOdds?.ou) card.classList.add("edgeNone");

      if (eventId) card.setAttribute("data-eventid", eventId);

      const shouldShowAI = (state === "pre") && !!initialOddsText && !!eventId;

      card.innerHTML = `
        <div class="gameHeader">
          <div class="statusPill ${pillClass}">${pillText}</div>
        </div>

        <div class="gameMetaTopPlain" aria-label="Venue">
          ${escapeHtml(venueLine)}
        </div>

        ${initialOddsText ? `
          <div class="gameMetaOddsPlain" aria-label="Betting line">
            ${escapeHtml(initialOddsText)}
          </div>
        ` : ""}

        ${shouldShowAI ? `
          <div class="gameMetaAIPlain" aria-label="AI insight">
            <div class="aiRow" data-ai-line1="${escapeHtml(eventId)}">AI EDGE: — • Lean: —</div>
            <div class="aiConfidenceRow" data-ai-line2="${escapeHtml(eventId)}">Confidence: —/10</div>
          </div>
        ` : ""}

        <div class="teamRow">
          <div class="teamLeft">
            <div class="teamLine">
              ${
                awayLogo
                  ? `<img class="teamLogo" src="${awayLogo}" alt="${escapeHtml(awayName)} logo" loading="lazy" decoding="async" />`
                  : `<div class="teamLogoFallback">${awayAbbrev || "—"}</div>`
              }
              <div class="teamText">
                <div class="teamName">${escapeHtml(awayName)}</div>
                <div class="teamMeta">${escapeHtml(homeAwayWithRecord("Away", away, selectedKey))}</div>
              </div>
            </div>
          </div>
          <div class="score">${awayScore}</div>
        </div>

        <div class="teamRow">
          <div class="teamLeft">
            <div class="teamLine">
              ${
                homeLogo
                  ? `<img class="teamLogo" src="${homeLogo}" alt="${escapeHtml(homeName)} logo" loading="lazy" decoding="async" />`
                  : `<div class="teamLogoFallback">${homeAbbrev || "—"}</div>`
              }
              <div class="teamText">
                <div class="teamName">${escapeHtml(homeName)}</div>
                <div class="teamMeta">${escapeHtml(homeAwayWithRecord("Home", home, selectedKey))}</div>
              </div>
            </div>
          </div>
          <div class="score">${homeScore}</div>
        </div>
      `;

      grid.appendChild(card);

      if (shouldShowAI) {
        aiJobs.push({
          eventId,
          leagueKey: selectedKey,
          dateYYYYMMDD: selectedDate,
          home: homeBaseName,
          away: awayBaseName,
          spread: initialOdds.favored || "",
          total: initialOdds.ou || ""
        });
      }
    });

    content.appendChild(grid);

    // Odds hydration
    hydrateAllOdds(events, league, selectedKey, selectedDate);

    // AI hydration (small concurrency)
    const limit = 4;
    let idx = 0;

    async function runNext() {
      while (idx < aiJobs.length) {
        const job = aiJobs[idx++];

        const line1 = document.querySelector(`[data-ai-line1="${CSS.escape(String(job.eventId))}"]`);
        const line2 = document.querySelector(`[data-ai-line2="${CSS.escape(String(job.eventId))}"]`);

        const alreadyHasText =
          (line1 && line1.textContent && line1.textContent.trim().length > 0) ||
          (line2 && line2.textContent && line2.textContent.trim().length > 0);

        if (!alreadyHasText) {
          if (line1) line1.textContent = job.spread ? "AI EDGE: Analyzing…" : "AI EDGE: Waiting for line…";
          if (line2) line2.textContent = "Confidence: —/10";
        }

        const data = await fetchAIInsight({
          eventId: job.eventId,
          league: job.leagueKey,
          date: job.dateYYYYMMDD,
          home: job.home,
          away: job.away,
          spread: job.spread || "",
          total: job.total || ""
        });

        if (!data) continue;

        const edge = (data.edge || "—");
        const lean = (data.lean || "");
        const conf = (data.confidence ?? "—");

        const leanPart = lean ? ` • Lean: ${lean}` : "";
        if (line1) line1.textContent = `AI EDGE: ${edge}${leanPart}`;
        if (line2) line2.textContent = `Confidence: ${conf}/10`;
      }
    }

    await Promise.all(new Array(Math.min(limit, aiJobs.length)).fill(0).map(runNext));

  } catch (error) {
    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <div class="headerActions">
            <button class="smallBtn" onclick="loadScores(true)">Retry</button>
            <button class="smallBtn logoutBtn" onclick="logout()">Log Out</button>
          </div>
        </div>
        <div class="subline">
          <div class="sublineLeft">
            ${buildLeagueSelectHTML(getSavedLeagueKey())}
            ${buildCalendarButtonHTML()}
          </div>
          <div>Error</div>
        </div>
      </div>
      <div class="notice">Couldn’t load scores right now.</div>
    `;
  }
}

/* =========================
   AI fetch (cached + no flicker)
   ========================= */
async function fetchAIInsight(payload) {
  const key = [
    payload.league || "",
    payload.date || "",
    payload.eventId || "",
    payload.home || "",
    payload.away || "",
    payload.spread || "",
    payload.total || ""
  ].join("|");

  const cached = aiInsightCache[key];
  if (isAiCacheFresh(cached)) return cached;

  // ---- LOCAL FALLBACK (always available) ----
  function localCompute() {
    // Use your existing helper (already in your script)
    const g = generateAIInsight({
      homeName: payload.home,
      awayName: payload.away,
      homeScore: "",   // pregame
      awayScore: "",
      favoredText: payload.spread || "",
      ouText: payload.total || "",
      state: "pre"
    });

    return {
      edge: g.edge || "Stay Away",
      lean: g.lean || "",
      confidence: g.confidence ?? "5.0",
      ts: Date.now()
    };
  }

  // If no endpoint configured, just use local
  if (!AI_ENDPOINT) {
    const stored = localCompute();
    aiInsightCache[key] = stored;
    saveAiCacheToSessionThrottled();
    return stored;
  }

  // ---- REMOTE (optional if you deploy later) ----
  try {
    const resp = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // If remote fails, fallback local
    if (!resp.ok) {
      const stored = localCompute();
      aiInsightCache[key] = stored;
      saveAiCacheToSessionThrottled();
      return stored;
    }

    const data = await resp.json();

    const stored = {
      edge: data.edge || "—",
      lean: data.lean || "",
      confidence: (data.confidence ?? "—"),
      ts: Date.now()
    };

    aiInsightCache[key] = stored;
    saveAiCacheToSessionThrottled();
    return stored;

  } catch {
    const stored = localCompute();
    aiInsightCache[key] = stored;
    saveAiCacheToSessionThrottled();
    return stored;
  }
}

/* =========================
   BEAT TTUN (TUNNEL ENTRANCE MODE)
   ========================= */

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
        <div class="beatHeroSub">Ohio State vs The Team Up North • ${escapeHtml(targetLabel)} • Noon</div>
      </div>

      <div class="beatBig">
        <div id="beatDays" class="beatBigDays">—</div>
        <div class="beatBigLabel">DAYS</div>
      </div>

      <div class="beatHmsRow" aria-label="Hours minutes seconds">
        <div class="beatHmsUnit"><span id="beatHrs">—</span><small>HRS</small></div>
        <div class="beatHmsUnit"><span id="beatMins">—</span><small>MINS</small></div>
        <div class="beatHmsUnit"><span id="beatSecs">—</span><small>SECS</small></div>
