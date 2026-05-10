/* =========================
   SCORES RENDER
   UI rendering, live‑update loop, modal, sorting.
   Depends on window.__SD (scores-data.js)
   ========================= */

(function ScoresRenderModule () {
  if (!window.__SD) {
    console.error("[scores-render] window.__SD not found — load scores-data.js first.");
    return;
  }
  const SD = window.__SD;

  // ─── Inject mobile scorecard styles ───────────────────────────────────────
  (function injectStyles() {
    if (document.getElementById("__scoresRenderStyles")) return;
    const style = document.createElement("style");
    style.id = "__scoresRenderStyles";
    style.textContent = `

/* ── Scores page header ── */
.scoresPageHeader {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(13,10,10,0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding: 10px 14px 0;
  box-shadow: 0 4px 24px rgba(0,0,0,0.45);
  transition: border-bottom-color 300ms ease;
}

/* Colored underline that matches the active league */
.scoresPageHeader::after {
  content: "";
  display: block;
  height: 3px;
  border-radius: 999px;
  margin-top: 10px;
  background: var(--scores-header-accent, rgba(187,0,0,0.8));
  box-shadow: 0 0 10px var(--scores-header-accent, rgba(187,0,0,0.6));
  opacity: 0.85;
}

/* Top row: title left, date-picker right */
.scoresHeaderTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.scoresHeaderTitle {
  font-size: 20px;
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scoresHeaderTitle span {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 2px;
}

.scoresHeaderRight {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Date label pill */
.scoresDatePill {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 999px;
  padding: 5px 12px;
  white-space: nowrap;
  letter-spacing: 0.03em;
}

/* Calendar icon button (the datePickerWrap .iconBtn) */
.scoresPageHeader .iconBtn {
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 10px;
  padding: 7px 10px;
  font-size: 16px;
  line-height: 1;
  color: #fff;
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Bottom row: league select scrollable pill tabs */
.scoresLeagueRow {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px;
}
.scoresLeagueRow::-webkit-scrollbar { display: none; }

/* Hide the native select; we'll build pill tabs */
.scoresPageHeader .leagueSelect {
  display: none;
}

/* League pill tabs */
.scoresLeaguePill {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  white-space: nowrap;
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  -webkit-tap-highlight-color: transparent;
  min-height: 32px;
  display: flex;
  align-items: center;
}

.scoresLeaguePill:active {
  opacity: 0.7;
}

.scoresLeaguePill.active {
  background: var(--scores-header-accent, rgba(187,0,0,0.75));
  border-color: var(--scores-header-accent, rgba(187,0,0,0.6));
  color: #fff;
  box-shadow: 0 0 12px var(--scores-header-accent, rgba(187,0,0,0.4));
}

/* Conference row (college only) */
.scoresConfRow {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 6px 0 2px;
}
.scoresConfRow::-webkit-scrollbar { display: none; }
.scoresConfRow select {
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.14);
  background: rgba(255,255,255,0.07);
  color: white;
  outline: none;
  max-width: 100%;
  -webkit-appearance: none;
  appearance: none;
}

/* ── Scores container ── */
.scoresContainer {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 80px;
}

/* ── Score card shell ── */
.scoreCard {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  border-left: 4px solid #555;
  overflow: hidden;
  box-shadow:
    0 4px 16px rgba(0,0,0,0.35),
    inset 0 1px 0 rgba(255,255,255,0.06);
}

/* Live card: subtle red wash */
.scoreCard.cardLive {
  background: rgba(200,0,0,0.07);
}

/* Fav card: subtle gold shimmer */
.scoreCard.favCard {
  border-left-color: #c89a00 !important;
  background: rgba(200,160,0,0.07);
  box-shadow:
    0 4px 20px rgba(0,0,0,0.4),
    0 0 0 1px rgba(200,160,0,0.18),
    inset 0 1px 0 rgba(255,220,100,0.08);
}

/* ── Card header (status + odds) ── */
.cardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

/* ── Status labels ── */
.statusLive {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ff4444;
}
.statusLive::before {
  content: "";
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff3333;
  box-shadow: 0 0 6px rgba(255,50,50,0.9);
  animation: scLivePulse 1.2s ease-in-out infinite;
  flex-shrink: 0;
}
@keyframes scLivePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}

.statusFinal {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
}

.statusPre {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,255,255,0.65);
}

/* ── Odds line ── */
.oddsLine {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 48%;
}

/* ── Series badge (playoffs) ── */
.seriesBadge {
  margin: 6px 12px 0;
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #ffcc44;
  background: rgba(200,160,0,0.14);
  border: 1px solid rgba(200,160,0,0.28);
  border-radius: 6px;
  padding: 2px 8px;
  align-self: flex-start;
}

/* ── Matchup rows wrapper ── */
.matchup {
  display: flex;
  flex-direction: column;
  padding: 6px 12px 10px;
  gap: 2px;
}

/* ── Individual team row ── */
.teamRow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  min-height: 44px;
  border-radius: 8px;
  transition: background 150ms ease;
}

/* Favorite team highlight */
.teamRow.favTeam .teamName {
  color: #ffcc66;
  text-shadow: 0 0 10px rgba(255,200,80,0.35);
}

/* ── Logo ── */
.teamLogo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  padding: 3px;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.teamLogoPlaceholder {
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.7);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

/* ── Team info (name + meta) ── */
.teamInfo {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.teamName {
  font-size: 16px;
  font-weight: 800;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
  letter-spacing: 0.1px;
}

.teamMeta {
  font-size: 11px;
  color: rgba(255,255,255,0.42);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

/* ── Score ── */
.score {
  font-size: 26px;
  font-weight: 900;
  color: rgba(255,255,255,0.88);
  min-width: 38px;
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  line-height: 1;
  text-shadow: 0 0 10px rgba(255,200,0,0.2);
}

.score.winner {
  color: #fff;
  text-shadow:
    0 0 12px rgba(255,220,80,0.55),
    0 0 28px rgba(255,160,0,0.25);
}

.score.loser {
  color: rgba(255,255,255,0.3);
  text-shadow: none;
}

/* ── Venue line ── */
.venueLine {
  padding: 0 12px 8px;
  font-size: 11px;
  color: rgba(255,255,255,0.28);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.venueLine::before { content: "\uD83D\uDCCD "; }

/* ── Empty state ── */
.emptyState {
  padding: 48px 24px;
  text-align: center;
  color: rgba(255,255,255,0.38);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

    `;
    document.head.appendChild(style);
  })();

  // ─── League pill labels ────────────────────────────────────────────────────
  const LEAGUE_LABELS = {
    ncaam: "🏀 NCAAB",
    cfb:   "🏈 CFB",
    nba:   "🏀 NBA",
    nhl:   "🏒 NHL",
    mls:   "⚽ MLS",
    nfl:   "🏈 NFL",
    mlb:   "⚾ MLB",
    pga:   "⛳ PGA",
    ufc:   "🥊 UFC",
  };

  // ─── Build header HTML ─────────────────────────────────────────────────────
  function buildHeaderHTML(leagueKey, dateYYYYMMDD, color, isCollege, savedConf) {
    const leagueLabel = LEAGUE_LABELS[leagueKey] || leagueKey.toUpperCase();
    const datePretty  = SD.yyyymmddToPretty(dateYYYYMMDD);

    const pillsHTML = (SD.LEAGUES || []).map(l => {
      const isActive = l.key === leagueKey;
      return `<button class="scoresLeaguePill${isActive ? " active" : ""}" data-league="${SD.escapeHtml(l.key)}" type="button">${SD.escapeHtml(LEAGUE_LABELS[l.key] || l.key.toUpperCase())}</button>`;
    }).join("");

    const confRowHTML = isCollege
      ? `<div class="scoresConfRow">${SD.buildConferenceSelectHTML([], savedConf, true)}</div>`
      : "";

    return `
<div class="scoresPageHeader" style="--scores-header-accent:${SD.escapeHtml(color)}">
  <div class="scoresHeaderTop">
    <div class="scoresHeaderTitle">
      ${SD.escapeHtml(leagueLabel)}
      <span>Scores</span>
    </div>
    <div class="scoresHeaderRight">
      <div class="scoresDatePill" id="scoresDatePill">${SD.escapeHtml(datePretty)}</div>
      ${SD.buildCalendarButtonHTML()}
    </div>
  </div>
  <div class="scoresLeagueRow" id="scoresLeagueRow">
    ${pillsHTML}
  </div>
  ${confRowHTML}
</div>
`;
  }

  // ─── Bind pill tab clicks ──────────────────────────────────────────────────
  function bindLeaguePills() {
    const row = document.getElementById("scoresLeagueRow");
    if (!row) return;
    row.addEventListener("click", e => {
      const pill = e.target.closest(".scoresLeaguePill");
      if (!pill) return;
      const key = pill.dataset.league;
      if (!key) return;
      SD.saveLeagueKey(key);
      // Scroll active pill into view
      pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      window.loadScores(true);
    });
  }

  // ─── Live ticker ──────────────────────────────────────────────────────────
  let liveInterval = null;
  let lastRenderedKey = null;

  function getLiveRefreshMs(events) {
    const hasLive = (events || []).some(ev => {
      const state = String(ev?.competitions?.[0]?.status?.type?.state || "").toLowerCase();
      return state === "in";
    });
    return hasLive ? 22000 : 120000;
  }

  function stopLiveTicker() {
    if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }
  }

  function startLiveTicker(league, leagueKey, dateYYYYMMDD) {
    stopLiveTicker();
    liveInterval = setInterval(async () => {
      try {
        const url = SD.withLangRegion(league.endpoint(dateYYYYMMDD));
        const data = await SD.fetchJsonNoStore(url);
        const events = data?.events || [];
        renderScoreCards(events, leagueKey, dateYYYYMMDD, true);
        if (liveInterval) { clearInterval(liveInterval); liveInterval = null; }
        startLiveTicker(league, leagueKey, dateYYYYMMDD);
      } catch {}
    }, getLiveRefreshMs([]));
  }

  // ─── Score card rendering ──────────────────────────────────────────────────
  function sortEvents(events) {
    return [...(events || [])].sort((a, b) => {
      const favA = SD.favoriteRankForEvent(a);
      const favB = SD.favoriteRankForEvent(b);
      const aIsFav = favA < Infinity;
      const bIsFav = favB < Infinity;
      if (aIsFav !== bIsFav) return aIsFav ? -1 : 1;
      const stA = SD.stateRank(a?.competitions?.[0]?.status);
      const stB = SD.stateRank(b?.competitions?.[0]?.status);
      if (stA !== stB) return stA - stB;
      if (aIsFav && bIsFav && favA !== favB) return favA - favB;
      return SD.getStartTimeMs(a) - SD.getStartTimeMs(b);
    });
  }

  function buildScoreCardHTML(ev, leagueKey) {
    const comp        = ev?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const status      = comp?.status;
    const stateStr    = String(status?.type?.state || "").toLowerCase();
    const displayClock = String(status?.displayClock || "").trim();
    const period      = Number(status?.period || 0);
    const statusDetail = String(status?.type?.shortDetail || status?.type?.detail || "").trim();
    const isLive = stateStr === "in";
    const isPost = stateStr === "post";

    const home = competitors.find(c => String(c?.homeAway || "") === "home");
    const away = competitors.find(c => String(c?.homeAway || "") === "away");

    const homeTeam = home?.team || {};
    const awayTeam = away?.team || {};

    const homeName = SD.getTeamDisplayNameUI(homeTeam);
    const awayName = SD.getTeamDisplayNameUI(awayTeam);
    const homeAbbr = SD.getTeamAbbrevUI(homeTeam);
    const awayAbbr = SD.getTeamAbbrevUI(awayTeam);

    const homeRank = Number(home?.curatedRank?.current || home?.rank || 0);
    const awayRank = Number(away?.curatedRank?.current || away?.rank || 0);

    const homeScore = String(home?.score ?? "");
    const awayScore = String(away?.score ?? "");

    const homeRecord = SD.getOverallRecordFromCompetitor(home);
    const awayRecord = SD.getOverallRecordFromCompetitor(away);

    const homeConf = SD.getConferenceNameFromCompetitor(home);
    const awayConf = SD.getConferenceNameFromCompetitor(away);

    const homeWinner = isPost && String(home?.winner || "") === "true";
    const awayWinner = isPost && String(away?.winner || "") === "true";

    const homeLogoUrl = SD.getTeamLogoUrl(homeTeam);
    const awayLogoUrl = SD.getTeamLogoUrl(awayTeam);

    const isFavHome = SD.isFavoriteTeam(homeTeam);
    const isFavAway = SD.isFavoriteTeam(awayTeam);

    const eventId = String(ev?.id || "");
    const venueLine = SD.buildVenueLine(comp);

    const leagueColor = SD.LEAGUE_COLORS[leagueKey] || "#555";

    const isPlayoff = SD.PLAYOFF_LEAGUES.has(leagueKey);
    const seriesStatus = isPlayoff ? (comp?.series?.summary || comp?.series?.title || "") : "";
    const seriesBadge = seriesStatus
      ? `<div class="seriesBadge">${SD.escapeHtml(seriesStatus)}</div>`
      : "";

    let statusLine = "";
    if (isLive) {
      let periodLabel = "";
      if      (leagueKey === "nba"  || leagueKey === "ncaam") periodLabel = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period - 2}OT`);
      else if (leagueKey === "nhl") periodLabel = period <= 3 ? (["1st","2nd","3rd"][period-1] || `P${period}`) : "OT";
      else if (leagueKey === "nfl"  || leagueKey === "cfb")   periodLabel = ["1st","2nd","3rd","4th"][period-1] || `Q${period}`;
      else if (leagueKey === "mlb") periodLabel = `Inn ${period}`;
      else periodLabel = period ? `P${period}` : "";
      const clockPart = displayClock ? ` \u00b7 ${displayClock}` : "";
      statusLine = `<div class="statusLive">LIVE${periodLabel ? " \u00b7 " + periodLabel : ""}${clockPart}</div>`;
    } else if (isPost) {
      statusLine = `<div class="statusFinal">Final${statusDetail && statusDetail.toLowerCase() !== "final" ? " \u00b7 " + statusDetail : ""}</div>`;
    } else {
      const gameDate = comp?.date || ev?.date || "";
      let timeStr = "";
      if (gameDate) {
        try { timeStr = new Date(gameDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch {}
      }
      statusLine = `<div class="statusPre">${SD.escapeHtml(timeStr || statusDetail || "Scheduled")}</div>`;
    }

    function logoImg(url, abbr) {
      if (!url) return `<div class="teamLogoPlaceholder">${SD.escapeHtml(abbr.slice(0,3))}</div>`;
      return `<img class="teamLogo" src="${SD.escapeHtml(url)}" alt="${SD.escapeHtml(abbr)}" loading="lazy" width="40" height="40" />`;
    }

    function scoreSpan(score, isWinner, isPostGame) {
      const cls = isPostGame ? (isWinner ? "score winner" : "score loser") : "score";
      return `<span class="${cls}">${SD.escapeHtml(score || "")}</span>`;
    }

    const homeNameDisplay = SD.teamDisplayNameWithRank(homeRank, homeName);
    const awayNameDisplay = SD.teamDisplayNameWithRank(awayRank, awayName);

    const homeMetaInit = SD.metaLineWithConference("home", homeConf, homeRecord);
    const awayMetaInit = SD.metaLineWithConference("away", awayConf, awayRecord);

    const oddsPlaceholder = `<div class="oddsLine" data-oddsline="${SD.escapeHtml(eventId)}"></div>`;

    let cardClasses = "scoreCard";
    if (isFavHome || isFavAway) cardClasses += " favCard";
    if (isLive) cardClasses += " cardLive";

    return `
<div class="${cardClasses}" data-eventid="${SD.escapeHtml(eventId)}" style="border-left-color:${SD.escapeHtml(leagueColor)}">
  ${seriesBadge}
  <div class="cardHeader">
    ${statusLine}
    ${oddsPlaceholder}
  </div>
  <div class="matchup">
    <div class="teamRow away${isFavAway ? " favTeam" : ""}">
      ${logoImg(awayLogoUrl, awayAbbr)}
      <div class="teamInfo">
        <div class="teamName">${SD.escapeHtml(awayNameDisplay)}</div>
        <div class="teamMeta" data-teammeta="${SD.escapeHtml(eventId)}_away">${SD.escapeHtml(awayMetaInit)}</div>
      </div>
      ${scoreSpan(awayScore, awayWinner, isPost)}
    </div>
    <div class="teamRow home${isFavHome ? " favTeam" : ""}">
      ${logoImg(homeLogoUrl, homeAbbr)}
      <div class="teamInfo">
        <div class="teamName">${SD.escapeHtml(homeNameDisplay)}</div>
        <div class="teamMeta" data-teammeta="${SD.escapeHtml(eventId)}_home">${SD.escapeHtml(homeMetaInit)}</div>
      </div>
      ${scoreSpan(homeScore, homeWinner, isPost)}
    </div>
  </div>
  ${venueLine ? `<div class="venueLine">${SD.escapeHtml(venueLine)}</div>` : ""}
</div>`;
  }

  function renderScoreCards(events, leagueKey, dateYYYYMMDD, isRefresh) {
    const container = document.getElementById("scoresContainer");
    if (!container) return;

    const sorted = sortEvents(events);
    if (!sorted.length) {
      container.innerHTML = `<div class="emptyState">No games found for this date.</div>`;
      return;
    }

    if (isRefresh) {
      for (const ev of sorted) {
        const id = String(ev?.id || "");
        if (!id) continue;
        const card = container.querySelector(`[data-eventid="${CSS.escape(id)}"]`);
        if (!card) continue;
        const comp = ev?.competitions?.[0];
        const status = comp?.status;
        const stateStr = String(status?.type?.state || "").toLowerCase();
        const isLive = stateStr === "in";
        const isPost = stateStr === "post";
        const competitors = comp?.competitors || [];
        const home = competitors.find(c => String(c?.homeAway || "") === "home");
        const away = competitors.find(c => String(c?.homeAway || "") === "away");

        card.classList.toggle("cardLive", isLive);

        const scoreEls = card.querySelectorAll(".score");
        if (scoreEls[0]) scoreEls[0].textContent = String(away?.score ?? "");
        if (scoreEls[1]) scoreEls[1].textContent = String(home?.score ?? "");

        if (isPost) {
          const awayWinner = String(away?.winner || "") === "true";
          const homeWinner = String(home?.winner || "") === "true";
          if (scoreEls[0]) { scoreEls[0].classList.toggle("winner", awayWinner); scoreEls[0].classList.toggle("loser", !awayWinner); }
          if (scoreEls[1]) { scoreEls[1].classList.toggle("winner", homeWinner); scoreEls[1].classList.toggle("loser", !homeWinner); }
        }

        const statusEl = card.querySelector(".statusLive, .statusFinal, .statusPre");
        if (statusEl) {
          const displayClock = String(status?.displayClock || "").trim();
          const period = Number(status?.period || 0);
          if (isLive) {
            let periodLabel = "";
            if      (leagueKey === "nba"  || leagueKey === "ncaam") periodLabel = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period - 2}OT`);
            else if (leagueKey === "nhl") periodLabel = period <= 3 ? (["1st","2nd","3rd"][period-1] || `P${period}`) : "OT";
            else if (leagueKey === "nfl"  || leagueKey === "cfb")   periodLabel = ["1st","2nd","3rd","4th"][period-1] || `Q${period}`;
            else if (leagueKey === "mlb") periodLabel = `Inn ${period}`;
            else periodLabel = period ? `P${period}` : "";
            statusEl.className = "statusLive";
            statusEl.textContent = `LIVE${periodLabel ? " \u00b7 " + periodLabel : ""}${displayClock ? " \u00b7 " + displayClock : ""}`;
          } else if (isPost) {
            const detail = String(status?.type?.shortDetail || status?.type?.detail || "").trim();
            statusEl.className = "statusFinal";
            statusEl.textContent = `Final${detail && detail.toLowerCase() !== "final" ? " \u00b7 " + detail : ""}`;
          }
        }
      }
      return;
    }

    container.innerHTML = sorted.map(ev => buildScoreCardHTML(ev, leagueKey)).join("");
  }

  // ─── Conference hydration ──────────────────────────────────────────────────
  async function hydrateConferenceMeta(league, leagueKey, dateYYYYMMDD, events) {
    if (!SD.isCollegeLeagueKey(leagueKey)) return;
    const cached = SD.loadConfCache(leagueKey, dateYYYYMMDD);
    let teamIdToConf = cached ? cached.teamIdToConf : {};
    if (!cached) {
      const sampleIds = (events || []).slice(0, 8).map(ev => String(ev?.id || "")).filter(Boolean);
      for (const eid of sampleIds) {
        const partialMap = await SD.fetchConferenceMapFromSummary(league, eid);
        Object.assign(teamIdToConf, partialMap);
      }
      if (Object.keys(teamIdToConf).length) SD.saveConfCache(leagueKey, dateYYYYMMDD, teamIdToConf);
    }
    const confs = SD.buildConferenceListFromMap(teamIdToConf);
    if (confs.length) SD.updateConferenceSelectOptions(confs, leagueKey);
    for (const ev of (events || [])) {
      const id = String(ev?.id || "");
      const comp = ev?.competitions?.[0];
      for (const c of (comp?.competitors || [])) {
        const teamId = String(c?.team?.id || "");
        const conf = teamIdToConf[teamId] || SD.getConferenceNameFromCompetitor(c) || "";
        const side = String(c?.homeAway || "");
        const record = SD.getOverallRecordFromCompetitor(c);
        SD.applyConferenceMetaToDom(id, side, conf, record);
      }
    }
    return teamIdToConf;
  }

  // ─── Main load function ───────────────────────────────────────────────────
  window.loadScores = async function (forceRefresh) {
    stopLiveTicker();

    const leagueKey    = SD.getSavedLeagueKey();
    const dateYYYYMMDD = SD.getSavedDateYYYYMMDD();
    const renderKey    = `${leagueKey}_${dateYYYYMMDD}`;
    const isRefresh    = !forceRefresh && lastRenderedKey === renderKey;
    lastRenderedKey    = renderKey;

    const league = SD.getLeagueByKey(leagueKey);
    const color  = SD.LEAGUE_COLORS[leagueKey] || "#bb0000";

    const isCollege   = SD.isCollegeLeagueKey(leagueKey);
    const savedConf   = SD.getSavedConferenceFilter(leagueKey);

    const pageHTML = `
      ${buildHeaderHTML(leagueKey, dateYYYYMMDD, color, isCollege, savedConf)}
      <div id="scoresContainer" class="scoresContainer"></div>
    `;

    const content = document.getElementById("content");
    if (content) content.innerHTML = pageHTML;

    bindLeaguePills();

    // Scroll active pill into view on load
    const activePill = document.querySelector(".scoresLeaguePill.active");
    if (activePill) activePill.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });

    let events = [];
    try {
      const url  = SD.withLangRegion(league.endpoint(dateYYYYMMDD));
      const data = await SD.fetchJsonNoStore(url);
      events = data?.events || [];
    } catch {
      const container = document.getElementById("scoresContainer");
      if (container) container.innerHTML = `<div class="emptyState">Failed to load scores. Check your connection.</div>`;
      return;
    }

    let filteredEvents = events;
    if (isCollege) {
      const confFilterNorm = SD.norm(savedConf);
      if (confFilterNorm) {
        const cached = SD.loadConfCache(leagueKey, dateYYYYMMDD);
        const teamIdToConf = cached ? cached.teamIdToConf : {};
        filteredEvents = SD.filterEventsByConferenceUsingMap(events, confFilterNorm, teamIdToConf);
      }
      hydrateConferenceMeta(league, leagueKey, dateYYYYMMDD, events).then(map => {
        if (map && savedConf) {
          const norm2 = SD.norm(savedConf);
          if (norm2) {
            const reFiltered = SD.filterEventsByConferenceUsingMap(events, norm2, map);
            renderScoreCards(reFiltered, leagueKey, dateYYYYMMDD, false);
          }
        }
      }).catch(() => {});
    }

    renderScoreCards(filteredEvents, leagueKey, dateYYYYMMDD, false);

    SD.hydrateAllOdds(league, leagueKey, dateYYYYMMDD, filteredEvents).catch(() => {});

    startLiveTicker(league, leagueKey, dateYYYYMMDD);
  };

  window.__stopScoresTicker = stopLiveTicker;

})();
