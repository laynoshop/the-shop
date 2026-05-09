/* =========================
   SCORES RENDER
   UI rendering, live‑update loop, modal, sorting.
   Depends on window.__SD (scores-data.js)
   ========================= */

(function ScoresRenderModule () {
  // Ensure data module is loaded
  if (!window.__SD) {
    console.error("[scores-render] window.__SD not found — load scores-data.js first.");
    return;
  }
  const SD = window.__SD;

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
        const ms = getLiveRefreshMs(events);
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
    const comp = ev?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const status = comp?.status;
    const stateStr = String(status?.type?.state || "").toLowerCase();
    const displayClock = String(status?.displayClock || "").trim();
    const period = Number(status?.period || 0);
    const statusDetail = String(status?.type?.shortDetail || status?.type?.detail || "").trim();
    const isLive = stateStr === "in";
    const isPost = stateStr === "post";
    const isPre = stateStr === "pre";

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

    const isPlayoff = SD.PLAYOFF_LEAGUES.has(leagueKey);
    const seriesStatus = isPlayoff ? (comp?.series?.summary || comp?.series?.title || "") : "";
    const seriesBadge = seriesStatus
      ? `<div class="seriesBadge">${SD.escapeHtml(seriesStatus)}</div>`
      : "";

    // Status line
    let statusLine = "";
    if (isLive) {
      let periodLabel = "";
      if (leagueKey === "nba" || leagueKey === "ncaam") periodLabel = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period - 2}OT`);
      else if (leagueKey === "nhl") periodLabel = period <= 3 ? ["1st", "2nd", "3rd"][period - 1] || `P${period}` : "OT";
      else if (leagueKey === "nfl" || leagueKey === "cfb") periodLabel = ["1st", "2nd", "3rd", "4th"][period - 1] || `Q${period}`;
      else if (leagueKey === "mlb") periodLabel = `Inn ${period}`;
      else periodLabel = period ? `P${period}` : "";
      statusLine = `<div class="statusLive">🔴 LIVE${periodLabel ? " · " + periodLabel : ""}${displayClock ? " · " + displayClock : ""}</div>`;
    } else if (isPost) {
      statusLine = `<div class="statusFinal">Final${statusDetail && statusDetail.toLowerCase() !== "final" ? " · " + statusDetail : ""}</div>`;
    } else {
      // Pre-game: show tip/start time
      const gameDate = comp?.date || ev?.date || "";
      let timeStr = "";
      if (gameDate) {
        try {
          const d = new Date(gameDate);
          timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        } catch {}
      }
      statusLine = `<div class="statusPre">${SD.escapeHtml(timeStr || statusDetail || "Scheduled")}</div>`;
    }

    function logoImg(url, abbr) {
      if (!url) return `<div class="teamLogoPlaceholder">${SD.escapeHtml(abbr.slice(0, 3))}</div>`;
      return `<img class="teamLogo" src="${SD.escapeHtml(url)}" alt="${SD.escapeHtml(abbr)}" loading="lazy" width="36" height="36" />`;
    }

    function scoreSpan(score, isWinner, isPostGame) {
      const cls = isPostGame ? (isWinner ? "score winner" : "score loser") : "score";
      return `<span class="${cls}">${SD.escapeHtml(score || "")}</span>`;
    }

    const homeNameDisplay = SD.teamDisplayNameWithRank(homeRank, homeName);
    const awayNameDisplay = SD.teamDisplayNameWithRank(awayRank, awayName);

    const homeMetaInit = SD.metaLineWithConference("home", homeConf, homeRecord);
    const awayMetaInit = SD.metaLineWithConference("away", awayConf, awayRecord);

    // Odds placeholder (populated async)
    const oddsPlaceholder = `<div class="oddsLine" data-oddsline="${SD.escapeHtml(eventId)}"></div>`;

    return `
<div class="scoreCard${isFavHome || isFavAway ? " favCard" : ""}" data-eventid="${SD.escapeHtml(eventId)}">
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
  ${venueLine ? `<div class="venueLine">${venueLine}</div>` : ""}
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
      // Targeted DOM updates only
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
        // Update scores
        const scoreEls = card.querySelectorAll(".score");
        if (scoreEls[0]) scoreEls[0].textContent = String(away?.score ?? "");
        if (scoreEls[1]) scoreEls[1].textContent = String(home?.score ?? "");
        // Update winner classes
        if (isPost) {
          const awayWinner = String(away?.winner || "") === "true";
          const homeWinner = String(home?.winner || "") === "true";
          if (scoreEls[0]) { scoreEls[0].classList.toggle("winner", awayWinner); scoreEls[0].classList.toggle("loser", !awayWinner); }
          if (scoreEls[1]) { scoreEls[1].classList.toggle("winner", homeWinner); scoreEls[1].classList.toggle("loser", !homeWinner); }
        }
        // Update status line
        const statusEl = card.querySelector(".statusLive, .statusFinal, .statusPre");
        if (statusEl) {
          const displayClock = String(status?.displayClock || "").trim();
          const period = Number(status?.period || 0);
          if (isLive) {
            let periodLabel = "";
            if (leagueKey === "nba" || leagueKey === "ncaam") periodLabel = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period - 2}OT`);
            else if (leagueKey === "nhl") periodLabel = period <= 3 ? ["1st", "2nd", "3rd"][period - 1] || `P${period}` : "OT";
            else if (leagueKey === "nfl" || leagueKey === "cfb") periodLabel = ["1st", "2nd", "3rd", "4th"][period - 1] || `Q${period}`;
            else if (leagueKey === "mlb") periodLabel = `Inn ${period}`;
            else periodLabel = period ? `P${period}` : "";
            statusEl.className = "statusLive";
            statusEl.textContent = `🔴 LIVE${periodLabel ? " · " + periodLabel : ""}${displayClock ? " · " + displayClock : ""}`;
          } else if (isPost) {
            const detail = String(status?.type?.shortDetail || status?.type?.detail || "").trim();
            statusEl.className = "statusFinal";
            statusEl.textContent = `Final${detail && detail.toLowerCase() !== "final" ? " · " + detail : ""}`;
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
    // Update conference select
    const confs = SD.buildConferenceListFromMap(teamIdToConf);
    if (confs.length) SD.updateConferenceSelectOptions(confs, leagueKey);
    // Apply to DOM
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

    const leagueKey = SD.getSavedLeagueKey();
    const dateYYYYMMDD = SD.getSavedDateYYYYMMDD();
    const renderKey = `${leagueKey}_${dateYYYYMMDD}`;
    const isRefresh = !forceRefresh && lastRenderedKey === renderKey;
    lastRenderedKey = renderKey;

    const league = SD.getLeagueByKey(leagueKey);
    const color = SD.LEAGUE_COLORS[leagueKey] || "#444";

    // Build toolbar
    const isCollege = SD.isCollegeLeagueKey(leagueKey);
    const savedConf = SD.getSavedConferenceFilter(leagueKey);
    const confSelectHTML = isCollege
      ? SD.buildConferenceSelectHTML([], savedConf, true)
      : "";

    const toolbarHTML = `
      <div class="scoresToolbar" style="--league-color:${color}">
        <div class="toolbarRow">
          ${SD.buildLeagueSelectHTML(leagueKey)}
          ${SD.buildCalendarButtonHTML()}
        </div>
        ${isCollege ? `<div class="toolbarRow">${confSelectHTML}</div>` : ""}
        <div class="dateLabel">${SD.escapeHtml(SD.yyyymmddToPretty(dateYYYYMMDD))}</div>
      </div>
      <div id="scoresContainer" class="scoresContainer"></div>
    `;

    const content = document.getElementById("content");
    if (content) content.innerHTML = toolbarHTML;

    // Fetch events
    let events = [];
    try {
      const url = SD.withLangRegion(league.endpoint(dateYYYYMMDD));
      const data = await SD.fetchJsonNoStore(url);
      events = data?.events || [];
    } catch (err) {
      const container = document.getElementById("scoresContainer");
      if (container) container.innerHTML = `<div class="emptyState">Failed to load scores. Check your connection.</div>`;
      return;
    }

    // Conference filter
    let filteredEvents = events;
    if (isCollege) {
      const confFilterNorm = SD.norm(savedConf);
      if (confFilterNorm) {
        const cached = SD.loadConfCache(leagueKey, dateYYYYMMDD);
        const teamIdToConf = cached ? cached.teamIdToConf : {};
        filteredEvents = SD.filterEventsByConferenceUsingMap(events, confFilterNorm, teamIdToConf);
      }
      // Async: hydrate conf metadata & update select options
      hydrateConferenceMeta(league, leagueKey, dateYYYYMMDD, events).then(map => {
        if (map && savedConf) {
          const confFilterNorm2 = SD.norm(savedConf);
          if (confFilterNorm2) {
            const reFiltered = SD.filterEventsByConferenceUsingMap(events, confFilterNorm2, map);
            renderScoreCards(reFiltered, leagueKey, dateYYYYMMDD, false);
          }
        }
      }).catch(() => {});
    }

    renderScoreCards(filteredEvents, leagueKey, dateYYYYMMDD, false);

    // Odds hydration (async, no-wait)
    SD.loadOddsCacheFromSession
      ? SD._oddsCache  // already loaded; skip re-init
      : null;
    SD.hydrateAllOdds(league, leagueKey, dateYYYYMMDD, filteredEvents).catch(() => {});

    // Start live ticker
    startLiveTicker(league, leagueKey, dateYYYYMMDD);
  };

  // Expose stop for tab cleanup
  window.__stopScoresTicker = stopLiveTicker;

})();
