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

  // ─── Inject styles ────────────────────────────────────────────
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
}
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
.scoresHeaderTop { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.scoresHeaderTitle { font-size: 20px; font-weight: 900; color: #fff; letter-spacing: 0.02em; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scoresHeaderTitle span { display: block; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
.scoresLeagueRow { display: flex; align-items: center; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
.scoresLeagueRow::-webkit-scrollbar { display: none; }
.scoresPageHeader .leagueSelect { display: none; }
.scoresLeaguePill {
  flex-shrink: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.05em;
  padding: 6px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); cursor: pointer;
  white-space: nowrap; transition: background 160ms ease, color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  -webkit-tap-highlight-color: transparent; min-height: 32px; display: flex; align-items: center;
}
.scoresLeaguePill:active { opacity: 0.7; }
.scoresLeaguePill.active {
  background: var(--scores-header-accent, rgba(187,0,0,0.75));
  border-color: var(--scores-header-accent, rgba(187,0,0,0.6));
  color: #fff; box-shadow: 0 0 12px var(--scores-header-accent, rgba(187,0,0,0.4));
}
/* Shop pill — always gold when active */
.scoresLeaguePill[data-league="shop"].active {
  background: rgba(200,154,0,0.75);
  border-color: rgba(200,154,0,0.6);
  color: #fff;
  box-shadow: 0 0 14px rgba(200,154,0,0.45);
}

/* ── Date navigator ── */
.scoresDateNav { display: flex; align-items: center; justify-content: center; gap: 0; padding: 10px 16px 6px; }
.scoresDateNavBtn {
  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
  border-radius: 10px; color: rgba(255,255,255,0.7); font-size: 18px; line-height: 1;
  cursor: pointer; flex-shrink: 0; -webkit-tap-highlight-color: transparent;
  transition: background 140ms ease, color 140ms ease; user-select: none;
}
.scoresDateNavBtn:active { background: rgba(255,255,255,0.13); color: #fff; }
.scoresDateNavLabel {
  flex: 1; text-align: center; font-size: 15px; font-weight: 800; color: #fff;
  letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  padding: 0 6px; cursor: pointer; -webkit-tap-highlight-color: transparent;
  line-height: 36px; user-select: none; position: relative;
}
.scoresDateNavLabel:active { opacity: 0.7; }
.scoresDateNavLabel input[type="date"] {
  position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%;
  cursor: pointer; border: none; background: transparent; padding: 0; margin: 0;
  font-size: 16px; -webkit-appearance: none;
}

/* ── Scores container ── */
.scoresContainer { display: flex; flex-direction: column; gap: 10px; padding: 4px 12px 80px; }

/* ── Score card shell ── */
.scoreCard {
  position: relative; display: flex; flex-direction: column; gap: 0;
  background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; border-left: 4px solid #555; overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
}
.scoreCard.cardLive { background: rgba(200,0,0,0.07); }
.scoreCard.favCard {
  border-left-color: #c89a00 !important; background: rgba(200,160,0,0.07);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(200,160,0,0.18), inset 0 1px 0 rgba(255,220,100,0.08);
}
.cardHeader { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 12px 6px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.statusLive { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #ff4444; }
.statusLive::before {
  content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #ff3333; box-shadow: 0 0 6px rgba(255,50,50,0.9);
  animation: scLivePulse 1.2s ease-in-out infinite; flex-shrink: 0;
}
@keyframes scLivePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }
.statusFinal { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
.statusPre { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.65); }
.oddsLine { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.seriesBadge { margin: 6px 12px 0; display: inline-flex; align-items: center; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; color: #ffcc44; background: rgba(200,160,0,0.14); border: 1px solid rgba(200,160,0,0.28); border-radius: 6px; padding: 2px 8px; align-self: flex-start; }
.matchup { display: flex; flex-direction: column; padding: 6px 12px 10px; gap: 2px; }
.teamRow { display: flex; align-items: center; gap: 10px; padding: 6px 0; min-height: 44px; border-radius: 8px; transition: background 150ms ease; }
.teamRow.favTeam .teamName { color: #ffcc66; text-shadow: 0 0 10px rgba(255,200,80,0.35); }
.teamLogo { width: 40px; height: 40px; object-fit: contain; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); padding: 3px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.teamLogoPlaceholder { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 800; letter-spacing: 0.3px; flex-shrink: 0; }
.teamInfo { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.teamName { font-size: 16px; font-weight: 800; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; letter-spacing: 0.1px; }
.teamMeta { font-size: 11px; color: rgba(255,255,255,0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.score { font-size: 26px; font-weight: 900; color: rgba(255,255,255,0.88); min-width: 38px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; line-height: 1; text-shadow: 0 0 10px rgba(255,200,0,0.2); }
.score.winner { color: #fff; text-shadow: 0 0 12px rgba(255,220,80,0.55), 0 0 28px rgba(255,160,0,0.25); }
.score.loser { color: rgba(255,255,255,0.3); text-shadow: none; }
.venueLine { padding: 0 12px 8px; font-size: 11px; color: rgba(255,255,255,0.28); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.venueLine::before { content: "📍 "; }
.scoresRefreshBtn {
  margin-left: auto;
  height: 32px;
  padding: 0 12px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.65);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: background 140ms ease, color 140ms ease;
}
.scoresRefreshBtn:active { background: rgba(255,255,255,0.14); color: #fff; }
.scoresRefreshBtn.spinning { opacity: 0.5; pointer-events: none; }

.emptyState { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.38); font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }

/* ── Broadcast chip ── */
.broadcastChip {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 5px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.13);
  color: rgba(255,255,255,0.55); flex-shrink: 0; white-space: nowrap;
}
.cardHeaderRight {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0; max-width: 60%;
  overflow: hidden;
}
/* ── Win probability bar ── */
.winProbBar {
  height: 3px; width: 100%; display: flex; overflow: hidden;
  border-radius: 0 0 10px 10px; margin-top: 0;
}
.winProbAway { height: 100%; transition: width 600ms cubic-bezier(0.4,0,0.2,1); }
.winProbHome { height: 100%; flex: 1; transition: width 600ms cubic-bezier(0.4,0,0.2,1); }
/* ── Fav spotlight ── */
.scoreCard.favSpotlight {
  border: 1.5px solid rgba(200,160,0,0.45) !important;
  border-left: 4px solid #c89a00 !important;
  background: rgba(200,160,0,0.065);
  box-shadow:
    0 0 0 1px rgba(200,160,0,0.22),
    0 6px 28px rgba(0,0,0,0.45),
    inset 0 1px 0 rgba(255,220,100,0.07);
  animation: favGlow 2.8s ease-in-out infinite;
}
@keyframes favGlow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(200,160,0,0.22), 0 6px 28px rgba(0,0,0,0.45), 0 0 18px rgba(200,160,0,0.12), inset 0 1px 0 rgba(255,220,100,0.07); }
  50%       { box-shadow: 0 0 0 1px rgba(200,160,0,0.38), 0 6px 28px rgba(0,0,0,0.45), 0 0 32px rgba(200,160,0,0.22), inset 0 1px 0 rgba(255,220,100,0.07); }
}
/* ── Fav ribbon ── */
.favRibbon {
  position: absolute; top: 0; right: 0; width: 0; height: 0;
  border-style: solid;
  border-width: 0 44px 44px 0;
  border-color: transparent rgba(200,154,0,0.85) transparent transparent;
  border-radius: 0 14px 0 0;
}
.favRibbon::after {
  content: "⭐";
  position: absolute;
  top: 5px;
  right: -39px;
  font-size: 11px;
  line-height: 1;
}
/* ── Shop-tab ribbon variant ── */
.shopRibbon {
  position: absolute; top: 0; right: 0; width: 0; height: 0;
  border-style: solid;
  border-width: 0 44px 44px 0;
  border-color: transparent rgba(200,154,0,0.85) transparent transparent;
  border-radius: 0 14px 0 0;
}
.shopRibbon::after {
  content: "🏪";
  position: absolute;
  top: 4px;
  right: -40px;
  font-size: 11px;
  line-height: 1;
}

/* ── Conference filter strip ── */
.confFilterStrip {
  display: flex; align-items: center; gap: 6px; overflow-x: auto;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
  padding: 6px 14px 4px; background: transparent;
}
.confFilterStrip::-webkit-scrollbar { display: none; }
.confFilterChip {
  flex-shrink: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
  padding: 4px 12px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.5); cursor: pointer; white-space: nowrap;
  transition: background 140ms, color 140ms, border-color 140ms;
  -webkit-tap-highlight-color: transparent; min-height: 28px;
  display: flex; align-items: center;
}
.confFilterChip.active {
  background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25); color: #fff;
}

/* ── Shop league badge on card ── */
.shopLeagueBadge {
  margin: 0 12px 6px;
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  padding: 2px 8px; border-radius: 5px;
  background: rgba(200,154,0,0.14); border: 1px solid rgba(200,154,0,0.28);
  color: rgba(200,180,80,0.9); align-self: flex-start;
}

/* ── Shop next-game card ── */
.shopNextCard {
  margin: 12px;
  padding: 14px 16px;
  background: rgba(200,154,0,0.08);
  border: 1px solid rgba(200,154,0,0.25);
  border-radius: 14px;
  display: flex; flex-direction: column; gap: 6px;
}
.shopNextLabel {
  font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  color: rgba(200,180,80,0.8);
}
.shopNextTeams {
  font-size: 17px; font-weight: 900; color: #fff; letter-spacing: 0.01em;
}
.shopNextMeta {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 2px;
}
.shopNextMetaPill {
  font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
  border-radius: 999px; padding: 3px 10px;
}
.shopNextCountdown {
  font-size: 12px; font-weight: 800; color: #c89a00; letter-spacing: 0.04em;
}

/* ── Shop empty state ── */
.shopEmptyState {
  padding: 32px 24px 16px; text-align: center;
}
.shopEmptyIcon { font-size: 32px; line-height: 1; margin-bottom: 4px; }
.shopEmptyTitle {
  font-size: 16px; font-weight: 800; color: rgba(255,255,255,0.75); margin-bottom: 4px;
}
.shopEmptySubtitle {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.38); letter-spacing: 0.2px;
}
`;
    document.head.appendChild(style);
  })();

  // ─── Constants ────────────────────────────────────────────────
  const LEAGUE_LABELS = {
    ncaam: "NCAAM",
    cfb:   "CFB",
    nba:   "NBA",
    nhl:   "NHL",
    mls:   "MLS",
    nfl:   "NFL",
    mlb:   "MLB",
    pga:   "PGA",
    ufc:   "UFC",
    shop:  "🏪 Shop",
  };

  // Short labels shown on Shop tab score cards
  const SHOP_LEAGUE_LABELS = {
    ncaam: "🏀 NCAAM",
    cfb:   "🏈 CFB",
    nba:   "🏀 NBA",
    nhl:   "🏒 NHL",
    mls:   "⚽ MLS",
    nfl:   "🏈 NFL",
    mlb:   "⚾ MLB",
  };

  const COLLEGE_LEAGUES = new Set(["ncaam", "cfb"]);

  // ─── Header / pill builder ────────────────────────────────────
  function buildScoresHeader(leagueKey, dateStr) {
    const league      = SD.getLeagueByKey(leagueKey);
    const prettyDate  = SD.yyyymmddToPretty(dateStr);
    const accentColor = SD.LEAGUE_COLORS?.[leagueKey] || "#bb0000";

    // Shop pill is always first, then all other leagues
    const shopPill = `<button class="scoresLeaguePill${leagueKey === "shop" ? " active" : ""}" data-league="shop" type="button">${LEAGUE_LABELS["shop"]}</button>`;
    const leaguePills = (SD.LEAGUES || []).map(l => {
      const active = l.key === leagueKey ? " active" : "";
      return `<button class="scoresLeaguePill${active}" data-league="${SD.escapeHtml(l.key)}" type="button">${SD.escapeHtml(LEAGUE_LABELS[l.key] || l.name)}</button>`;
    }).join("");

    return `
  <div class="scoresPageHeader" id="scoresPageHeader" style="--scores-header-accent:${accentColor};">
    <div class="scoresHeaderTop">
      <div class="scoresHeaderTitle">${SD.escapeHtml(LEAGUE_LABELS[leagueKey] || league?.name || leagueKey)}<span>${SD.escapeHtml(prettyDate)}</span></div>
      <button class="scoresRefreshBtn" id="scoresRefreshBtn" type="button">↻ Refresh</button>
    </div>
    <div class="scoresLeagueRow" id="scoresLeagueRow">${shopPill}${leaguePills}</div>
  </div>`;
  }

  // ─── Date navigator ──────────────────────────────────────────
  function buildDateNav(dateStr) {
    const today = SD.todayYYYYMMDD();
    const isToday = dateStr === today;
    return `
  <div class="scoresDateNav" id="scoresDateNav">
    <button class="scoresDateNavBtn" id="scoreDatePrev" type="button" aria-label="Previous day">&#8249;</button>
    <div class="scoresDateNavLabel" id="scoreDateLabel">
      ${isToday ? "Today" : SD.escapeHtml(SD.yyyymmddToPretty(dateStr))}
      <input type="date" id="scoreDatePicker" value="${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}" aria-label="Pick a date">
    </div>
    <button class="scoresDateNavBtn" id="scoreDateNext" type="button" aria-label="Next day">&#8250;</button>
  </div>`;
  }

  // ─── Event listeners ─────────────────────────────────────────
  function attachHeaderListeners() {
    const row = document.getElementById("scoresLeagueRow");
    if (row) {
      row.addEventListener("click", e => {
        const btn = e.target.closest(".scoresLeaguePill");
        if (!btn) return;
        const key = btn.dataset.league;
        if (!key) return;
        SD.setSavedLeagueKey(key);
        window.loadScores(true);
      });
    }

    const refreshBtn = document.getElementById("scoresRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        refreshBtn.classList.add("spinning");
        window.loadScores(true);
        setTimeout(() => refreshBtn.classList.remove("spinning"), 1200);
      });
    }

    const prevBtn = document.getElementById("scoreDatePrev");
    const nextBtn = document.getElementById("scoreDateNext");
    const label   = document.getElementById("scoreDateLabel");
    const picker  = document.getElementById("scoreDatePicker");

    if (prevBtn) prevBtn.addEventListener("click", () => {
      const cur = SD.getSavedDateYYYYMMDD();
      SD.setSavedDateYYYYMMDD(SD.yyyymmddOffset(cur, -1));
      window.loadScores(true);
    });
    if (nextBtn) nextBtn.addEventListener("click", () => {
      const cur = SD.getSavedDateYYYYMMDD();
      SD.setSavedDateYYYYMMDD(SD.yyyymmddOffset(cur, +1));
      window.loadScores(true);
    });
    if (label) label.addEventListener("click", () => {
      if (picker) picker.showPicker?.();
    });
    if (picker) picker.addEventListener("change", e => {
      const v = e.target.value; // YYYY-MM-DD
      if (v && v.length === 10) {
        SD.setSavedDateYYYYMMDD(v.replace(/-/g, ""));
        window.loadScores(true);
      }
    });
  }

  // ─── Card click handler (opens modal) ───────────────────────
  function attachCardListeners(container) {
    container.addEventListener("click", e => {
      const card = e.target.closest(".scoreCard");
      if (!card) return;
      const eventId  = card.dataset.eventId;
      const leagueKey = card.dataset.leagueKey;
      if (!eventId) return;
      if (SD.openGameModal) SD.openGameModal(eventId, leagueKey);
    });
  }

  // Build a score card. shopLeagueKey is set when rendering from Shop tab so a league badge appears.
  function buildScoreCardHTML(ev, leagueKey, shopLeagueKey) {
    const comp        = ev?.competitions?.[0] || {};
    const competitors = comp?.competitors   || [];
    const status      = comp?.status        || {};
    const situation   = comp?.situation     || null;

    const home = competitors.find(c => String(c?.homeAway || "").toLowerCase() === "home") || competitors[1] || {};
    const away = competitors.find(c => String(c?.homeAway || "").toLowerCase() === "away") || competitors[0] || {};

    const homeTeam = home?.team || {};
    const awayTeam = away?.team || {};

    const isFavHome = SD.isFavoriteTeam(homeTeam);
    const isFavAway = SD.isFavoriteTeam(awayTeam);
    const isShopHome = SD.isShopTeam ? SD.isShopTeam(homeTeam) : isFavHome;
    const isShopAway = SD.isShopTeam ? SD.isShopTeam(awayTeam) : isFavAway;
    const isFavGame = isFavHome || isFavAway;
    const isShopGame = isShopHome || isShopAway;

    const stateType   = String(status?.type?.state  || "").toLowerCase();
    const completed   = status?.type?.completed === true;
    const clockDisp   = String(status?.displayClock || "");
    const periodNum   = Number(status?.period       || 0);
    const statusDesc  = String(status?.type?.detail || status?.type?.shortDetail || "");
    const isLive      = stateType === "in";
    const isPre       = stateType === "pre";
    const isPost      = stateType === "post" || completed;

    const homeScore = String(home?.score ?? "");
    const awayScore = String(away?.score ?? "");
    const homeWin   = completed && homeScore !== "" && awayScore !== "" && Number(homeScore) > Number(awayScore);
    const awayWin   = completed && homeScore !== "" && awayScore !== "" && Number(awayScore) > Number(homeScore);

    const homeRank  = Number(home?.curatedRank?.current || 0);
    const awayRank  = Number(away?.curatedRank?.current || 0);

    const homeName  = SD.teamDisplayNameWithRank(homeRank, SD.getTeamDisplayNameUI(homeTeam));
    const awayName  = SD.teamDisplayNameWithRank(awayRank, SD.getTeamDisplayNameUI(awayTeam));
    const homeAbbr  = SD.getTeamAbbrevUI(homeTeam);
    const awayAbbr  = SD.getTeamAbbrevUI(awayTeam);
    const homeLogo  = SD.getTeamLogoUrl(homeTeam);
    const awayLogo  = SD.getTeamLogoUrl(awayTeam);

    const homeRecord = String(home?.records?.[0]?.summary || "");
    const awayRecord = String(away?.records?.[0]?.summary || "");

    const broadcasts  = comp?.broadcasts || [];
    const broadcastNames = broadcasts.flatMap(b => b?.names || []).slice(0, 2);
    const broadcastHTML  = broadcastNames.map(n => `<span class="broadcastChip">${SD.escapeHtml(n)}</span>`).join("");

    // Status label
    let statusHTML = "";
    if (isLive) {
      const clockParts = [];
      if (clockDisp) clockParts.push(clockDisp);
      if (periodNum) clockParts.push(`P${periodNum}`);
      statusHTML = `<span class="statusLive">${clockParts.length ? SD.escapeHtml(clockParts.join(" · ")) : "LIVE"}</span>`;
    } else if (isPost) {
      statusHTML = `<span class="statusFinal">Final${statusDesc && statusDesc.toLowerCase() !== "final" ? " · " + SD.escapeHtml(statusDesc) : ""}</span>`;
    } else {
      let preLabel = statusDesc || "";
      if (!preLabel && ev?.date) {
        try { preLabel = new Date(ev.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch {}
      }
      statusHTML = `<span class="statusPre">${SD.escapeHtml(preLabel)}</span>`;
    }

    // On the Shop tab, highlight any Shop team (not just favorites)
    const highlightHome = shopLeagueKey ? isShopHome : isFavHome;
    const highlightAway = shopLeagueKey ? isShopAway : isFavAway;

    // Logo or abbreviation placeholder
    function logoOrPlaceholder(logo, abbr) {
      if (logo) return `<img class="teamLogo" src="${SD.escapeHtml(logo)}" alt="${SD.escapeHtml(abbr)}" loading="lazy">`;
      return `<div class="teamLogoPlaceholder">${SD.escapeHtml(abbr)}</div>`;
    }

    // Fav / Shop ribbon
    const ribbonLabel = shopLeagueKey ? "🏪 Shop Team" : "⭐ Shop Team";
    const ribbonClass = shopLeagueKey ? "shopRibbon" : "favRibbon";
    const showRibbon  = shopLeagueKey ? isShopGame : isFavGame;
    const ribbonHTML  = showRibbon ? `<div class="${ribbonClass}" aria-label="${ribbonLabel}"></div>` : "";

    // League badge shown on Shop tab cards
    const leagueBadgeHTML = shopLeagueKey
      ? `<div class="shopLeagueBadge">${SD.escapeHtml(SHOP_LEAGUE_LABELS[shopLeagueKey] || shopLeagueKey.toUpperCase())}</div>`
      : "";

    const cardClasses = ["scoreCard"];
    if (isLive) cardClasses.push("cardLive");
    if (isFavGame) cardClasses.push("favCard");
    if (shopLeagueKey && isShopGame) cardClasses.push("favSpotlight");

    const eventId = String(ev?.id || comp?.id || "");
    const accentColor = SD.LEAGUE_COLORS?.[leagueKey] || "#555";

    // Win probability bar
    let winProbHTML = "";
    if (situation?.lastPlay?.probability) {
      const p = situation.lastPlay.probability;
      const awayPct = Math.round((p.awayWinPercentage || 0) * 100);
      const homePct = 100 - awayPct;
      const awayColor = SD.LEAGUE_COLORS?.[leagueKey] || "#bb0000";
      winProbHTML = `<div class="winProbBar"><div class="winProbAway" style="width:${awayPct}%;background:${awayColor};"></div><div class="winProbHome" style="background:rgba(255,255,255,0.2);"></div></div>`;
    }

    return `
<div class="${cardClasses.join(" ")}" data-event-id="${SD.escapeHtml(eventId)}" data-league-key="${SD.escapeHtml(leagueKey)}" style="border-left-color:${accentColor};">
  ${ribbonHTML}
  <div class="cardHeader">
    <div>${statusHTML}</div>
    <div class="cardHeaderRight">
      <div class="oddsLine" data-oddsline="${SD.escapeHtml(eventId)}"></div>
      ${broadcastHTML}
    </div>
  </div>
  ${leagueBadgeHTML}
  <div class="matchup">
    <div class="teamRow${highlightAway ? " favTeam" : ""}">
      ${logoOrPlaceholder(awayLogo, awayAbbr)}
      <div class="teamInfo">
        <div class="teamName">${SD.escapeHtml(awayName)}</div>
        ${awayRecord ? `<div class="teamMeta">${SD.escapeHtml(awayRecord)}</div>` : ""}
      </div>
      ${!isPre ? `<div class="score${awayWin ? " winner" : isPost ? " loser" : ""}">${SD.escapeHtml(awayScore)}</div>` : ""}
    </div>
    <div class="teamRow${highlightHome ? " favTeam" : ""}">
      ${logoOrPlaceholder(homeLogo, homeAbbr)}
      <div class="teamInfo">
        <div class="teamName">${SD.escapeHtml(homeName)}</div>
        ${homeRecord ? `<div class="teamMeta">${SD.escapeHtml(homeRecord)}</div>` : ""}
      </div>
      ${!isPre ? `<div class="score${homeWin ? " winner" : isPost ? " loser" : ""}">${SD.escapeHtml(homeScore)}</div>` : ""}
    </div>
  </div>
  ${comp?.venue?.fullName ? `<div class="venueLine">${SD.escapeHtml(comp.venue.fullName)}${comp.venue.address?.city ? ", " + SD.escapeHtml(comp.venue.address.city) : ""}</div>` : ""}
  ${winProbHTML}
</div>`;
  }

  // ─── Render a list of score cards ────────────────────────────
  function renderScoreCards(events, leagueKey, dateStr, showConfFilter) {
    const container = document.getElementById("scoresContainer");
    if (!container) return;
    if (!events || events.length === 0) {
      container.innerHTML = `<div class="emptyState">No games scheduled.</div>`;
      return;
    }

    // Sort: live → pre → post, then by start time
    const sorted = [...events].sort((a, b) => {
      const sA = SD.stateRank(a?.competitions?.[0]?.status);
      const sB = SD.stateRank(b?.competitions?.[0]?.status);
      if (sA !== sB) return sA - sB;
      return SD.getStartTimeMs(a) - SD.getStartTimeMs(b);
    });

    container.innerHTML = sorted.map(ev => buildScoreCardHTML(ev, leagueKey)).join("");
  }

  // ─── Conference / odds hydration ───────────────────────────────────────────
  async function hydrateConferenceMeta(league, leagueKey, dateYYYYMMDD, events) {
    if (!SD.fetchConferenceMeta) return null;
    const cached = SD.loadConfCache(leagueKey, dateYYYYMMDD);
    if (cached) return cached.teamIdToConf;
    const map = await SD.fetchConferenceMeta(league, events);
    if (map) SD.saveConfCache(leagueKey, dateYYYYMMDD, map);
    return map;
  }

  // ─── Live ticker ─────────────────────────────────────────────
  let _tickerTimer = null;

  function stopLiveTicker() {
    if (_tickerTimer) { clearTimeout(_tickerTimer); _tickerTimer = null; }
  }

  function startLiveTicker(league, leagueKey, dateStr, initialEvents) {
    stopLiveTicker();
    const hasLive = initialEvents.some(ev => {
      const s = String(ev?.competitions?.[0]?.status?.type?.state || "").toLowerCase();
      return s === "in";
    });
    if (!hasLive) return;

    async function tick() {
      try {
        const url  = SD.withLangRegion(league.endpoint(dateStr));
        const data = await SD.fetchJsonNoStore(url);
        const evs  = data?.events || [];
        if (!evs.length) return;

        const container = document.getElementById("scoresContainer");
        if (!container) return;

        for (const ev of evs) {
          const eventId = String(ev?.id || ev?.competitions?.[0]?.id || "");
          if (!eventId) continue;
          const card = container.querySelector(`.scoreCard[data-event-id="${CSS.escape(eventId)}"]`);
          if (!card) continue;

          const comp    = ev?.competitions?.[0] || {};
          const status  = comp?.status || {};
          const stateT  = String(status?.type?.state || "").toLowerCase();
          const isLive  = stateT === "in";
          const isPost  = stateT === "post" || status?.type?.completed === true;
          const clockD  = String(status?.displayClock || "");
          const period  = Number(status?.period || 0);
          const detail  = String(status?.type?.detail || status?.type?.shortDetail || "");

          // Update status label
          const statusEl = card.querySelector(".statusLive, .statusFinal, .statusPre");
          if (statusEl) {
            if (isLive) {
              const parts = [];
              if (clockD) parts.push(clockD);
              if (period) parts.push(`P${period}`);
              statusEl.className = "statusLive";
              statusEl.textContent = parts.length ? parts.join(" · ") : "LIVE";
            } else if (isPost) {
              statusEl.className = "statusFinal";
              statusEl.textContent = "Final" + (detail && detail.toLowerCase() !== "final" ? " · " + detail : "");
            }
          }

          // Update scores
          const competitors = comp?.competitors || [];
          for (const c of competitors) {
            const isHome = String(c?.homeAway || "").toLowerCase() === "home";
            const rows   = card.querySelectorAll(".teamRow");
            const row    = isHome ? rows[1] : rows[0];
            if (!row) continue;
            const scoreEl = row.querySelector(".score");
            if (scoreEl && c?.score != null) scoreEl.textContent = String(c.score);
          }

          // Update win probability
          const situation = comp?.situation || null;
          if (situation?.lastPlay?.probability) {
            const p       = situation.lastPlay.probability;
            const awayPct = Math.round((p.awayWinPercentage || 0) * 100);
            const homePct = 100 - awayPct;
            const awayBar = card.querySelector(".winProbAway");
            const homeBar = card.querySelector(".winProbHome");
            if (awayBar) awayBar.style.width = awayPct + "%";
            if (homeBar) homeBar.style.width = homePct + "%";
          }
        }
      } catch (err) {
        console.warn("[scores-render] ticker error:", err);
      }
      _tickerTimer = setTimeout(tick, 30000);
    }
    _tickerTimer = setTimeout(tick, 30000);
  }

  // ─── Shop tab: fetch all leagues in parallel, filter to Shop teams ────────
  async function loadShopScores(dateStr) {
    const container = document.getElementById("scoresContainer");
    if (!container) return;

    container.innerHTML = `<div class="emptyState">Loading Shop teams...</div>`;

    const scanKeys = SD.SHOP_SCAN_LEAGUES || ["ncaam","cfb","nba","nhl","mls","nfl","mlb"];

    // Fetch all leagues simultaneously
    const results = await Promise.allSettled(
      scanKeys.map(async key => {
        const league = SD.getLeagueByKey(key);
        if (!league) return { key, events: [] };
        const url  = SD.withLangRegion(league.endpoint(dateStr));
        const data = await SD.fetchJsonNoStore(url);
        return { key, events: data?.events || [] };
      })
    );

    // Collect all Shop-team events, tagging each with its source league key
    const shopEvents = [];
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const { key, events } = r.value;
      for (const ev of events) {
        if (SD.isShopEvent(ev)) shopEvents.push({ ev, leagueKey: key });
      }
    }

    if (shopEvents.length > 0) {
      // Sort: live first, then pre, then post; within same state by start time
      shopEvents.sort((a, b) => {
        const stA = SD.stateRank(a.ev?.competitions?.[0]?.status);
        const stB = SD.stateRank(b.ev?.competitions?.[0]?.status);
        if (stA !== stB) return stA - stB;
        return SD.getStartTimeMs(a.ev) - SD.getStartTimeMs(b.ev);
      });
      container.innerHTML = shopEvents
        .map(({ ev, leagueKey }) => buildScoreCardHTML(ev, leagueKey, leagueKey))
        .join("");
      // Hydrate odds for each league group that has Shop events
      const leagueGroups = {};
      for (const { ev, leagueKey } of shopEvents) {
        if (!leagueGroups[leagueKey]) leagueGroups[leagueKey] = [];
        leagueGroups[leagueKey].push(ev);
      }
      for (const [key, evList] of Object.entries(leagueGroups)) {
        const lg = SD.getLeagueByKey(key);
        if (lg && SD.hydrateAllOdds) SD.hydrateAllOdds(lg, key, dateStr, evList).catch(() => {});
      }
      return;
    }

    // ── No games today: find the next upcoming Shop team game (up to 14 days ahead) ──
    container.innerHTML = `<div class="shopEmptyState"><div class="shopEmptyIcon">🏪</div><div class="shopEmptyTitle">No Shop teams in action today.</div><div class="shopEmptySubtitle">Searching for the next upcoming game…</div></div>`;

    let nextFound = null;
    for (let delta = 1; delta <= 14 && !nextFound; delta++) {
      const searchDate = SD.yyyymmddOffset ? SD.yyyymmddOffset(dateStr, delta) : shiftDate(dateStr, delta);
      const nextResults = await Promise.allSettled(
        scanKeys.map(async key => {
          const league = SD.getLeagueByKey(key);
          if (!league) return { key, events: [] };
          const url  = SD.withLangRegion(league.endpoint(searchDate));
          const data = await SD.fetchJsonNoStore(url);
          return { key, events: data?.events || [], date: searchDate };
        })
      );
      for (const r of nextResults) {
        if (r.status !== "fulfilled") continue;
        const { key, events, date } = r.value;
        for (const ev of events) {
          if (SD.isShopEvent(ev)) {
            nextFound = { ev, leagueKey: key, date, delta };
            break;
          }
        }
        if (nextFound) break;
      }
    }

    if (!nextFound) {
      container.innerHTML = `<div class="shopEmptyState"><div class="shopEmptyIcon">🏪</div><div class="shopEmptyTitle">No Shop teams in action today.</div><div class="shopEmptySubtitle">No upcoming Shop team games found in the next 14 days.</div></div>`;
      return;
    }

    // Build a "next game" preview card
    const { ev, leagueKey, date, delta } = nextFound;
    const comp = ev?.competitions?.[0];
    const competitors = comp?.competitors || [];
    const home = competitors.find(c => String(c?.homeAway||"") === "home") || competitors[1] || {};
    const away = competitors.find(c => String(c?.homeAway||"") === "away") || competitors[0] || {};
    const homeName = SD.getTeamDisplayNameUI(home?.team || {});
    const awayName = SD.getTeamDisplayNameUI(away?.team || {});
    const gameDate = comp?.date || ev?.date || "";
    let timeStr = "";
    if (gameDate) { try { timeStr = new Date(gameDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch {} }
    const prettyDate = SD.yyyymmddToPretty ? SD.yyyymmddToPretty(date) : date;
    const countdownLabel = delta === 1 ? "Tomorrow" : `Game in ${delta} days`;
    const leagueBadge = SHOP_LEAGUE_LABELS[leagueKey] || leagueKey.toUpperCase();

    container.innerHTML = `
<div class="shopEmptyState">
  <div class="shopEmptyIcon">🏪</div>
  <div class="shopEmptyTitle">No Shop teams in action today.</div>
  <div class="shopEmptySubtitle">Next upcoming Shop team game:</div>
</div>
<div class="shopNextCard">
  <div class="shopNextLabel">⏭ Next Shop Game</div>
  <div class="shopNextTeams">${SD.escapeHtml(awayName)} vs. ${SD.escapeHtml(homeName)}</div>
  <div class="shopNextMeta">
    <span class="shopNextMetaPill">📅 ${SD.escapeHtml(prettyDate)}</span>
    ${timeStr ? `<span class="shopNextMetaPill">🕐 ${SD.escapeHtml(timeStr)} ET</span>` : ""}
    <span class="shopNextMetaPill">${SD.escapeHtml(leagueBadge)}</span>
    <span class="shopNextCountdown">${SD.escapeHtml(countdownLabel)}</span>
  </div>
</div>`;
  }

  // ─── PGA Leaderboard ──────────────────────────────────────────────────────
  function renderPGALeaderboard(data, leagueKey, dateYYYYMMDD) {
    const container = document.getElementById("scoresContainer");
    if (!container) return;

    const events = data?.events || [];
    if (!events.length) {
      container.innerHTML = `<div class="emptyState">No PGA events this week.</div>`;
      return;
    }

    const ev      = events[0];
    const evName  = SD.escapeHtml(ev?.name || ev?.shortName || "PGA Tour Event");
    const status  = ev?.competitions?.[0]?.status || {};
    const stateT  = String(status?.type?.state || "").toLowerCase();
    const isLive  = stateT === "in";
    const isPost  = stateT === "post" || status?.type?.completed === true;
    const detail  = SD.escapeHtml(String(status?.type?.detail || ""));

    let statusBadge = "";
    if (isLive)      statusBadge = `<span class="statusLive">LIVE · ${detail}</span>`;
    else if (isPost) statusBadge = `<span class="statusFinal">Final · ${detail}</span>`;
    else             statusBadge = `<span class="statusPre">${detail || "Upcoming"}</span>`;

    const competitors = ev?.competitions?.[0]?.competitors || [];
    const sorted      = [...competitors].sort((a, b) => {
      const aP = Number(a?.statistics?.find(s => s.name === "scoreToPar")?.value ?? 999);
      const bP = Number(b?.statistics?.find(s => s.name === "scoreToPar")?.value ?? 999);
      return aP - bP;
    });

    const rows = sorted.slice(0, 30).map((c, i) => {
      const athlete = c?.athlete || {};
      const name    = SD.escapeHtml(athlete?.displayName || athlete?.fullName || "Unknown");
      const logo    = athlete?.headshot?.href || athlete?.flag?.href || "";
      const country = SD.escapeHtml(athlete?.flag?.alt || athlete?.nationality || "");
      const scoreStat = c?.statistics?.find(s => s.name === "scoreToPar");
      const score     = scoreStat ? String(scoreStat.value) : "--";
      const scoreNum  = Number(score);
      const scoreColor = isNaN(scoreNum) ? "#aaa"
        : scoreNum < 0 ? "#ff6b6b"
        : scoreNum === 0 ? "#aaa"
        : "#888";
      const scoreDisp = isNaN(scoreNum) ? score : scoreNum === 0 ? "E" : (scoreNum > 0 ? "+" + score : score);
      const pos   = c?.status?.position?.displayName || String(i + 1);
      const thru  = c?.status?.thru || "";
      const isFav = SD.isFavoriteTeam({ displayName: athlete?.displayName, name: athlete?.displayName });
      return `
<div class="scoreCard${isFav ? " favCard" : ""}" style="border-left-color:#3d7a40;">
  <div class="matchup" style="padding: 8px 12px;">
    <div class="teamRow" style="gap:10px;min-height:40px;">
      ${logo ? `<img class="teamLogo" src="${SD.escapeHtml(logo)}" alt="" loading="lazy" style="width:32px;height:32px;border-radius:50%;">` : `<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);flex-shrink:0;"></div>`}
      <div class="teamInfo">
        <div class="teamName" style="font-size:14px;">${name}${country ? ` <span style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);">${country}</span>` : ""}</div>
        <div class="teamMeta">Pos: ${SD.escapeHtml(pos)}${thru ? " · Thru " + SD.escapeHtml(String(thru)) : ""}</div>
      </div>
      <div class="score" style="font-size:20px;color:${scoreColor};">${SD.escapeHtml(scoreDisp)}</div>
    </div>
  </div>
</div>`;
    }).join("");

    container.innerHTML = `
<div class="scoreCard" style="border-left-color:#3d7a40;margin-bottom:4px;">
  <div class="cardHeader">
    <div>${statusBadge}</div>
    <div style="font-size:13px;font-weight:800;color:#fff;">${evName}</div>
  </div>
</div>
${rows}`;
  }

  // ─── UFC card renderer ────────────────────────────────────────────────────
  function renderUFCCards(data, leagueKey) {
    const container = document.getElementById("scoresContainer");
    if (!container) return;
    const events = data?.events || [];
    if (!events.length) {
      container.innerHTML = `<div class="emptyState">No UFC events scheduled.</div>`;
      return;
    }
    const cards = events.map(ev => buildScoreCardHTML(ev, leagueKey)).join("");
    container.innerHTML = cards;
  }

  // ─── Playoff series badge hydration ───────────────────────────────────────
  async function hydratePlayoffBadges(league, leagueKey, events) {
    if (!SD.PLAYOFF_LEAGUES?.has(leagueKey)) return;
    const ids = events.map(ev => String(ev?.id || "")).filter(Boolean);
    if (!ids.length) return;
    await Promise.allSettled(ids.map(async id => {
      try {
        const url  = SD.withLangRegion(league.summaryEndpoint(id));
        const data = await SD.fetchJsonNoStore(url);
        const series = data?.header?.competitions?.[0]?.series;
        if (!series) return;
        const wins    = series.competitors || [];
        const summary = series.summary || "";
        if (!summary) return;
        const card  = document.querySelector(`.scoreCard[data-event-id="${CSS.escape(id)}"]`);
        if (!card) return;
        if (card.querySelector(".seriesBadge")) return;
        const badge   = document.createElement("div");
        badge.className = "seriesBadge";
        badge.textContent = summary;
        const matchup = card.querySelector(".matchup");
        if (matchup) card.insertBefore(badge, matchup);
      } catch {}
    }));
  }

  // ─── Main loadScores ─────────────────────────────────────────────────────
  window.loadScores = async function (forceRefresh) {
    stopLiveTicker();

    const leagueKey = SD.getSavedLeagueKey();
    const dateStr   = SD.getSavedDateYYYYMMDD();
    const isCollege = COLLEGE_LEAGUES.has(leagueKey);

    // Rebuild the full header + date nav + container shell
    const pageEl = document.getElementById("scoresPage");
    if (!pageEl) return;
    pageEl.innerHTML =
      buildScoresHeader(leagueKey, dateStr) +
      buildDateNav(dateStr) +
      `<div class="scoresContainer" id="scoresContainer"></div>`;
    attachHeaderListeners();

    const container = document.getElementById("scoresContainer");
    container.innerHTML = `<div class="emptyState">Loading…</div>`;

    // ── Shop tab: special cross-league path ──
    if (leagueKey === "shop") {
      await loadShopScores(dateStr);
      const container2 = document.getElementById("scoresContainer");
      if (container2) attachCardListeners(container2);
      return;
    }

    const league = SD.getLeagueByKey(leagueKey);
    const url    = SD.withLangRegion(league.endpoint(dateStr));

    let data;
    try {
      data = await SD.fetchJsonNoStore(url);
    } catch {
      const c = document.getElementById("scoresContainer");
      if (c) c.innerHTML = `<div class="emptyState">Failed to load scores. Check your connection.</div>`;
      return;
    }

    const events = data?.events || [];

    // PGA special renderer
    if (leagueKey === "pga") {
      renderPGALeaderboard(data, leagueKey, dateStr);
      const c2 = document.getElementById("scoresContainer");
      if (c2) attachCardListeners(c2);
      return;
    }

    // Conference filter (college leagues)
    let filteredEvents = events;
    if (isCollege) {
      const savedConf = SD.getSavedConferenceFilter(leagueKey);
      const confNorm  = SD.norm(savedConf);
      if (confNorm) {
        const cached = SD.loadConfCache(leagueKey, dateStr);
        const map    = cached ? cached.teamIdToConf : {};
        filteredEvents = SD.filterEventsByConferenceUsingMap(events, confNorm, map);
      }
      hydrateConferenceMeta(league, leagueKey, dateStr, events).then(map => {
        const savedConf2 = SD.getSavedConferenceFilter(leagueKey);
        const norm2 = SD.norm(savedConf2);
        if (map && norm2) {
          const re = SD.filterEventsByConferenceUsingMap(events, norm2, map);
          renderScoreCards(re, leagueKey, dateStr, false);
        }
      }).catch(() => {});
    }

    renderScoreCards(filteredEvents, leagueKey, dateStr, false);
    SD.hydrateAllOdds(league, leagueKey, dateStr, filteredEvents).catch(() => {});
    startLiveTicker(league, leagueKey, dateStr, filteredEvents);
  };

  window.__stopScoresTicker = stopLiveTicker;

})();
