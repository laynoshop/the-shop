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

/* ── Status labels ── */
.statusLive {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #ff4444;
}
.statusLive::before {
  content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #ff3333; box-shadow: 0 0 6px rgba(255,50,50,0.9);
  animation: scLivePulse 1.2s ease-in-out infinite; flex-shrink: 0;
}
@keyframes scLivePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.75); } }
.statusFinal { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.4); }
.statusPre { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.65); }

/* ── Card header right (broadcast + odds) ── */
.cardHeaderRight {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0; max-width: 60%; overflow: hidden;
}
.oddsLine { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }

/* ── Broadcast chip ── */
.broadcastChip {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 5px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.13);
  color: rgba(255,255,255,0.55); flex-shrink: 0; white-space: nowrap;
}

/* ── Series badge (playoffs) ── */
.seriesBadge {
  margin: 6px 12px 0; display: inline-flex; align-items: center;
  font-size: 11px; font-weight: 800; letter-spacing: 0.06em; color: #ffcc44;
  background: rgba(200,160,0,0.14); border: 1px solid rgba(200,160,0,0.28);
  border-radius: 6px; padding: 2px 8px; align-self: flex-start;
}

/* ── Fav ribbon ── */
.favRibbon {
  display: flex; align-items: center; gap: 5px; width: 100%;
  padding: 4px 12px;
  background: linear-gradient(90deg, rgba(200,160,0,0.22) 0%, rgba(200,160,0,0.08) 100%);
  border-bottom: 1px solid rgba(200,160,0,0.18);
  color: #f0c040; font-size: 10px; font-weight: 900; letter-spacing: 0.1em;
  text-transform: uppercase; line-height: 1.4;
}

/* ── Fav spotlight ── */
.scoreCard.favSpotlight {
  border: 1.5px solid rgba(200,160,0,0.45) !important;
  border-left: 4px solid #c89a00 !important;
  background: rgba(200,160,0,0.07);
  box-shadow: 0 6px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,160,0,0.18),
    0 0 22px rgba(200,155,0,0.13), inset 0 1px 0 rgba(255,220,100,0.09);
}

/* ── Matchup rows wrapper ── */
.matchup { display: flex; flex-direction: column; padding: 6px 12px 10px; gap: 2px; }

/* ── Individual team row ── */
.teamRow { display: flex; align-items: center; gap: 10px; padding: 6px 0; min-height: 44px; border-radius: 8px; transition: background 150ms ease; }
.teamRow.favTeam .teamName { color: #ffcc66; text-shadow: 0 0 10px rgba(255,200,80,0.35); }

/* ── Logo ── */
.teamLogo { width: 40px; height: 40px; object-fit: contain; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); padding: 3px; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
.teamLogoPlaceholder { width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 800; letter-spacing: 0.3px; flex-shrink: 0; }

/* ── Team info ── */
.teamInfo { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.teamName { font-size: 16px; font-weight: 800; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; letter-spacing: 0.1px; }
.teamMeta { font-size: 11px; color: rgba(255,255,255,0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }

/* ── Score ── */
.score {
  font-size: 26px; font-weight: 900; color: rgba(255,255,255,0.88);
  min-width: 38px; text-align: right; flex-shrink: 0;
  font-variant-numeric: tabular-nums; letter-spacing: -0.5px; line-height: 1;
  text-shadow: 0 0 10px rgba(255,200,0,0.2);
}
.score.winner { color: #fff; text-shadow: 0 0 12px rgba(255,220,80,0.55), 0 0 28px rgba(255,160,0,0.25); }
.score.loser  { color: rgba(255,255,255,0.3); text-shadow: none; }

/* Score flash on live update */
@keyframes scoreFlash {
  0%   { color: #ffd700; text-shadow: 0 0 16px rgba(255,210,0,0.9); }
  100% { }
}
.score.flashed { animation: scoreFlash 600ms ease-out forwards; }

/* ── Win probability bar ── */
.winProbBar { height: 3px; width: 100%; display: flex; overflow: hidden; border-radius: 0 0 10px 10px; margin-top: 0; }
.winProbAway { height: 100%; transition: width 600ms cubic-bezier(0.4,0,0.2,1); }
.winProbHome { height: 100%; flex: 1; transition: width 600ms cubic-bezier(0.4,0,0.2,1); }

/* ── Venue line ── */
.venueLine { padding: 0 12px 8px; font-size: 11px; color: rgba(255,255,255,0.28); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.venueLine::before { content: "\uD83D\uDCCD "; }

/* ── Empty state ── */
.emptyState { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.38); font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }

/* ════════════════════════════════
   PGA LEADERBOARD
   ════════════════════════════════ */
.pgaHero {
  margin: 0 0 14px; border-radius: 18px; overflow: hidden;
  background: linear-gradient(135deg, rgba(20,60,22,0.95) 0%, rgba(10,38,12,0.98) 60%, rgba(5,20,8,1) 100%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
  padding: 18px 18px 16px; position: relative;
}
.pgaHero::before {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(ellipse at 80% 20%, rgba(100,200,80,0.08) 0%, transparent 60%);
  pointer-events: none;
}
.pgaTournamentName { font-size: 19px; font-weight: 900; color: #fff; letter-spacing: 0.01em; line-height: 1.15; margin-bottom: 3px; }
.pgaVenue { font-size: 12px; color: rgba(255,255,255,0.52); font-weight: 600; letter-spacing: 0.04em; margin-bottom: 10px; display: flex; align-items: center; gap: 4px; }
.pgaVenue::before { content: "\uD83D\uDCCD"; font-size: 11px; }
.pgaStatusRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.pgaStatusPill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; }
.pgaStatusPill.live { background: rgba(255,50,50,0.18); border: 1px solid rgba(255,50,50,0.4); color: #ff5555; }
.pgaStatusPill.live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #ff4444; box-shadow: 0 0 6px rgba(255,50,50,0.9); animation: scLivePulse 1.2s ease-in-out infinite; flex-shrink: 0; }
.pgaStatusPill.final { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.55); }
.pgaStatusPill.pre { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.45); }
.pgaRoundBadge { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; padding: 3px 10px; border-radius: 999px; background: rgba(80,180,60,0.15); border: 1px solid rgba(80,180,60,0.3); color: rgba(140,230,110,0.9); }
.pgaWeather { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); margin-top: 4px; }
.pgaWeatherIcon { font-size: 22px; line-height: 1; flex-shrink: 0; }
.pgaWeatherDetails { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.pgaWeatherCondition { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.88); line-height: 1.2; }
.pgaWeatherTemps { font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.03em; }
.pgaWeatherWind { font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 600; }
.pgaRoundPills { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px 12px 8px; }
.pgaRoundPills::-webkit-scrollbar { display: none; }
.pgaRoundPill { flex-shrink: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.05em; padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 150ms ease, color 150ms ease; }
.pgaRoundPill:active { opacity: 0.7; }
.pgaRoundPill.active { background: rgba(61,122,64,0.7); border-color: rgba(100,200,80,0.4); color: #fff; box-shadow: 0 0 10px rgba(80,200,60,0.25); }
.pgaLeaderboard { border-radius: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.025); }
.pgaLeaderRow { display: grid; grid-template-columns: 36px 1fr 52px 52px; align-items: center; padding: 10px 12px; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 120ms ease; }
.pgaLeaderRow:last-child { border-bottom: none; }
.pgaLeaderRow:active { background: rgba(255,255,255,0.05); }
.pgaLeaderRow.top3 { background: rgba(255,210,50,0.05); }
.pgaLeaderRow.top3:active { background: rgba(255,210,50,0.1); }
.pgaLeaderHeaderRow { display: grid; grid-template-columns: 36px 1fr 52px 52px; padding: 7px 12px; gap: 6px; border-bottom: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.04); }
.pgaLeaderHeaderCell { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.35); }
.pgaLeaderHeaderCell.right { text-align: right; }
.pgaRank { font-size: 13px; font-weight: 900; color: rgba(255,255,255,0.45); text-align: center; letter-spacing: 0.02em; }
.pgaRank.gold   { color: #ffd040; text-shadow: 0 0 8px rgba(255,200,0,0.5); }
.pgaRank.silver { color: #c0c8d8; }
.pgaRank.bronze { color: #cd8860; }
.pgaPlayerInfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-left: 2px; }
.pgaPlayerName { font-size: 15px; font-weight: 800; color: #eee; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pgaPlayerMeta { font-size: 11px; color: rgba(255,255,255,0.38); font-weight: 600; letter-spacing: 0.02em; }
.pgaScoreTotal { font-size: 17px; font-weight: 900; text-align: right; font-variant-numeric: tabular-nums; letter-spacing: -0.3px; color: rgba(255,255,255,0.8); }
.pgaScoreToday { font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.5); }
.pgaScoreTotal.under, .pgaScoreToday.under { color: #6edb64; }
.pgaScoreTotal.over,  .pgaScoreToday.over  { color: #ff7070; }
.pgaScoreTotal.even,  .pgaScoreToday.even  { color: rgba(255,255,255,0.7); }
.pgaLeaderRow.cut { opacity: 0.38; }
.pgaCutDivider { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.02); }
.pgaCutDividerLabel { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.28); white-space: nowrap; }
.pgaCutDividerLine { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }

    `;
    document.head.appendChild(style);
  })();

  // ─── League pill labels ───────────────────────────────────────────
  const LEAGUE_LABELS = {
    ncaam: "\uD83C\uDFC0 NCAAB",
    cfb:   "\uD83C\uDFC8 CFB",
    nba:   "\uD83C\uDFC0 NBA",
    nhl:   "\uD83C\uDFD2 NHL",
    mls:   "\u26BD MLS",
    nfl:   "\uD83C\uDFC8 NFL",
    mlb:   "\u26BE MLB",
    pga:   "\u26F3 PGA",
    ufc:   "\uD83E\uDD4A UFC",
  };

  // ─── League pill row scroll memory ────────────────────────────────
  let leagueRowScrollLeft = 0;
  function saveLeagueRowScroll() {
    const row = document.getElementById("scoresLeagueRow");
    if (row) leagueRowScrollLeft = row.scrollLeft || 0;
  }
  function restoreLeagueRowScroll() {
    const row = document.getElementById("scoresLeagueRow");
    if (row) row.scrollLeft = leagueRowScrollLeft;
  }

  // ─── Date helpers ──────────────────────────────────────────────────
  function formatDateNav(yyyymmdd) {
    try {
      const y = parseInt(yyyymmdd.slice(0,4), 10);
      const m = parseInt(yyyymmdd.slice(4,6), 10) - 1;
      const d = parseInt(yyyymmdd.slice(6,8), 10);
      return new Date(y, m, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    } catch { return yyyymmdd; }
  }
  function toInputValue(yyyymmdd) { return `${yyyymmdd.slice(0,4)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(6,8)}`; }
  function fromInputValue(val) { return val.replace(/-/g, ""); }
  function shiftDate(yyyymmdd, deltaDays) {
    try {
      const y = parseInt(yyyymmdd.slice(0,4), 10);
      const m = parseInt(yyyymmdd.slice(4,6), 10) - 1;
      const d = parseInt(yyyymmdd.slice(6,8), 10);
      const dt = new Date(y, m, d);
      dt.setDate(dt.getDate() + deltaDays);
      return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,"0")}${String(dt.getDate()).padStart(2,"0")}`;
    } catch { return yyyymmdd; }
  }
  function todayYYYYMMDD() {
    if (SD.todayYYYYMMDD) return SD.todayYYYYMMDD();
    const n = new Date();
    return `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}`;
  }

  // ─── Build header HTML ────────────────────────────────────────────
  function buildHeaderHTML(leagueKey, color) {
    const leagueLabel = LEAGUE_LABELS[leagueKey] || leagueKey.toUpperCase();
    const pillsHTML = (SD.LEAGUES || []).map(l => {
      const isActive = l.key === leagueKey;
      return `<button class="scoresLeaguePill${isActive ? " active" : ""}" data-league="${SD.escapeHtml(l.key)}" type="button">${SD.escapeHtml(LEAGUE_LABELS[l.key] || l.key.toUpperCase())}</button>`;
    }).join("");
    return `
<div class="scoresPageHeader" style="--scores-header-accent:${SD.escapeHtml(color)}">
  <div class="scoresHeaderTop">
    <div class="scoresHeaderTitle">${SD.escapeHtml(leagueLabel)}<span>Scores</span></div>
  </div>
  <div class="scoresLeagueRow" id="scoresLeagueRow">${pillsHTML}</div>
</div>`;
  }

  // ─── Build date navigator HTML ────────────────────────────────────
  function buildDateNavHTML(dateYYYYMMDD) {
    const inputVal = toInputValue(dateYYYYMMDD);
    return `
<div class="scoresDateNav" id="scoresDateNav">
  <button class="scoresDateNavBtn" id="scoresDatePrev" type="button" aria-label="Previous day">&#8249;</button>
  <div class="scoresDateNavLabel" id="scoresDateNavLabel">
    <span id="scoresDateNavText">${SD.escapeHtml(formatDateNav(dateYYYYMMDD))}</span>
    <input type="date" id="scoresDatePicker" value="${SD.escapeHtml(inputVal)}" aria-label="Jump to date" tabindex="-1" />
  </div>
  <button class="scoresDateNavBtn" id="scoresDateNext" type="button" aria-label="Next day">&#8250;</button>
</div>`;
  }

  // ─── Bind pill tab clicks ──────────────────────────────────────────
  function bindLeaguePills() {
    const row = document.getElementById("scoresLeagueRow");
    if (!row) return;
    row.addEventListener("scroll", () => { leagueRowScrollLeft = row.scrollLeft || 0; }, { passive: true });
    row.addEventListener("click", e => {
      const pill = e.target.closest(".scoresLeaguePill");
      if (!pill) return;
      const key = pill.dataset.league;
      if (!key) return;
      saveLeagueRowScroll();
      SD.setSavedLeagueKey(key);
      window.loadScores(true);
    });
  }

  // ─── Bind date navigator ──────────────────────────────────────────
  function bindDateNav() {
    const prev   = document.getElementById("scoresDatePrev");
    const next   = document.getElementById("scoresDateNext");
    const label  = document.getElementById("scoresDateNavLabel");
    const text   = document.getElementById("scoresDateNavText");
    const picker = document.getElementById("scoresDatePicker");
    function applyDate(yyyymmdd) {
      SD.setSavedDateYYYYMMDD(yyyymmdd);
      if (text)   text.textContent = formatDateNav(yyyymmdd);
      if (picker) picker.value     = toInputValue(yyyymmdd);
      window.loadScores(true);
    }
    if (prev) prev.addEventListener("click", () => applyDate(shiftDate(SD.getSavedDateYYYYMMDD(), -1)));
    if (next) next.addEventListener("click", () => applyDate(shiftDate(SD.getSavedDateYYYYMMDD(), +1)));
    if (picker) picker.addEventListener("change", e => { const v = e.target.value; if (v) applyDate(fromInputValue(v)); });
    if (label) label.addEventListener("click", e => {
      if (e.target === picker) return;
      if (picker) picker.showPicker ? picker.showPicker() : picker.click();
    });
  }

  // ─── Live ticker ──────────────────────────────────────────────────
  let liveInterval = null;
  let lastRenderedKey = null;

  function getLiveRefreshMs(events) {
    const hasLive = (events || []).some(ev => String(ev?.competitions?.[0]?.status?.type?.state || "").toLowerCase() === "in");
    return hasLive ? 22000 : 120000;
  }
  function stopLiveTicker() { if (liveInterval) { clearInterval(liveInterval); liveInterval = null; } }
  function startLiveTicker(league, leagueKey, dateYYYYMMDD) {
    stopLiveTicker();
    liveInterval = setInterval(async () => {
      try {
        const data = await SD.fetchJsonNoStore(SD.withLangRegion(league.endpoint(dateYYYYMMDD)));
        const evts = data?.events || [];
        renderScoreCards(evts, leagueKey, dateYYYYMMDD, true);
        clearInterval(liveInterval); liveInterval = null;
        startLiveTicker(league, leagueKey, dateYYYYMMDD);
      } catch {}
    }, getLiveRefreshMs([]));
  }

  // ─── MLB inning label ─────────────────────────────────────────────
  function mlbInningLabel(period, situation) {
    const suffix = ["1st","2nd","3rd"][period-1] || `${period}th`;
    const isTop = situation?.isTopHalfInning !== false;
    return `${isTop ? "Top" : "Bot"} ${suffix}`;
  }

  // ─── Score card rendering ─────────────────────────────────────────
  function sortEvents(events) {
    return [...(events || [])].sort((a, b) => {
      const favA = SD.favoriteRankForEvent(a), favB = SD.favoriteRankForEvent(b);
      const aIsFav = favA < Infinity, bIsFav = favB < Infinity;
      if (aIsFav !== bIsFav) return aIsFav ? -1 : 1;
      const stA = SD.stateRank(a?.competitions?.[0]?.status), stB = SD.stateRank(b?.competitions?.[0]?.status);
      if (stA !== stB) return stA - stB;
      if (aIsFav && bIsFav && favA !== favB) return favA - favB;
      return SD.getStartTimeMs(a) - SD.getStartTimeMs(b);
    });
  }

  function buildScoreCardHTML(ev, leagueKey) {
    const comp         = ev?.competitions?.[0];
    const competitors  = comp?.competitors || [];
    const status       = comp?.status;
    const situation    = comp?.situation || null;
    const stateStr     = String(status?.type?.state || "").toLowerCase();
    const displayClock = String(status?.displayClock || "").trim();
    const period       = Number(status?.period || 0);
    const statusDetail = String(status?.type?.shortDetail || status?.type?.detail || "").trim();
    const isLive = stateStr === "in";
    const isPost = stateStr === "post";
    const isMLB  = leagueKey === "mlb";

    const home = competitors.find(c => String(c?.homeAway || "") === "home") || competitors[1] || {};
    const away = competitors.find(c => String(c?.homeAway || "") === "away") || competitors[0] || {};
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
    const homeWinner = isPost && String(home?.winner || "") === "true";
    const awayWinner = isPost && String(away?.winner || "") === "true";
    const homeLogoUrl = SD.getTeamLogoUrl(homeTeam);
    const awayLogoUrl = SD.getTeamLogoUrl(awayTeam);
    const isFavHome = SD.isFavoriteTeam(homeTeam);
    const isFavAway = SD.isFavoriteTeam(awayTeam);
    const eventId   = String(ev?.id || "");

    // ── Broadcast network ──
    const broadcasts = comp?.broadcasts || ev?.broadcasts || [];
    const broadcastName = (() => {
      for (const b of broadcasts) {
        const names = b?.names || (b?.media?.shortName ? [b.media.shortName] : (b?.name ? [b.name] : []));
        for (const n of names) { if (n) return String(n).trim(); }
      }
      const geo = comp?.geoBroadcasts || [];
      for (const g of geo) {
        const n = g?.media?.shortName || g?.media?.callLetters || "";
        if (n) return String(n).trim();
      }
      return "";
    })();

    // ── Win probability ──
    const winProb = (() => {
      const preds = comp?.predictor || comp?.winProbability || null;
      const homeChance = Number(preds?.homeTeam?.teamChancePct ?? preds?.homeWinPercentage ?? -1);
      if (homeChance >= 0 && homeChance <= 100) return { home: homeChance, away: 100 - homeChance };
      const sitProb = comp?.situation?.lastPlay?.probability;
      const hc2 = Number(sitProb?.homeWinPercentage ?? -1);
      if (hc2 >= 0 && hc2 <= 100) return { home: hc2, away: 100 - hc2 };
      return null;
    })();

    const venueLine     = SD.buildVenueLine(comp);
    const leagueColor   = SD.LEAGUE_COLORS[leagueKey] || "#555";
    const isPlayoff     = SD.PLAYOFF_LEAGUES.has(leagueKey);
    const seriesStatus  = isPlayoff ? (comp?.series?.summary || comp?.series?.title || "") : "";
    const seriesBadge   = seriesStatus ? `<div class="seriesBadge">${SD.escapeHtml(seriesStatus)}</div>` : "";

    // ── Status line ──
    let statusLine = "";
    if (isLive) {
      let periodLabel = "";
      if      (isMLB)                                          periodLabel = mlbInningLabel(period, situation);
      else if (leagueKey === "nba"  || leagueKey === "ncaam") periodLabel = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period-2}OT`);
      else if (leagueKey === "nhl")                            periodLabel = period <= 3 ? (["1st","2nd","3rd"][period-1] || `P${period}`) : "OT";
      else if (leagueKey === "nfl"  || leagueKey === "cfb")   periodLabel = ["1st","2nd","3rd","4th"][period-1] || `Q${period}`;
      else periodLabel = period ? `P${period}` : "";
      const clockPart = (!isMLB && displayClock) ? " \u00b7 " + displayClock : "";
      statusLine = `<div class="statusLive">LIVE${periodLabel ? " \u00b7 "+periodLabel : ""}${clockPart}</div>`;
    } else if (isPost) {
      let finalDetail = "";
      if (statusDetail && statusDetail.toLowerCase() !== "final" && !/^\d+:\d+$/.test(statusDetail)) finalDetail = statusDetail;
      statusLine = `<div class="statusFinal">Final${finalDetail ? " \u00b7 "+finalDetail : ""}</div>`;
    } else {
      const gameDate = comp?.date || ev?.date || "";
      let timeStr = "";
      if (gameDate) { try { timeStr = new Date(gameDate).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } catch {} }
      statusLine = `<div class="statusPre">${SD.escapeHtml(timeStr || statusDetail || "Scheduled")}</div>`;
    }

    const homeRankPrefix = homeRank > 0 && homeRank <= 25 ? `#${homeRank} ` : "";
    const awayRankPrefix = awayRank > 0 && awayRank <= 25 ? `#${awayRank} ` : "";

    function logoImg(url, abbr) {
      if (!url) return `<div class="teamLogoPlaceholder">${SD.escapeHtml(abbr.slice(0,3))}</div>`;
      return `<img class="teamLogo" src="${SD.escapeHtml(url)}" alt="${SD.escapeHtml(abbr)}" loading="lazy" width="40" height="40" />`;
    }
    function scoreSpan(sc, isWinner, isPostGame) {
      if (!isPostGame) return `<span class="score">${SD.escapeHtml(sc)}</span>`;
      return `<span class="score ${isWinner ? "winner" : "loser"}">${SD.escapeHtml(sc)}</span>`;
    }

    const isFavSpotlight = isFavHome || isFavAway;
    let cardClasses = "scoreCard";
    if (isFavSpotlight) cardClasses += " favCard favSpotlight";
    if (isLive) cardClasses += " cardLive";

    // Win prob bar — only on live games with data
    const winProbBarHTML = (() => {
      if (!winProb || !isLive) return "";
      const awayColor = awayTeam.color ? "#" + awayTeam.color.replace(/^#/,"") : "rgba(120,120,255,0.7)";
      const homeColor = homeTeam.color ? "#" + homeTeam.color.replace(/^#/,"") : "rgba(255,120,120,0.7)";
      return `<div class="winProbBar">
        <div class="winProbAway" style="width:${winProb.away.toFixed(1)}%;background:${SD.escapeHtml(awayColor)}"></div>
        <div class="winProbHome" style="width:${winProb.home.toFixed(1)}%;background:${SD.escapeHtml(homeColor)}"></div>
      </div>`;
    })();

    // Fav ribbon
    const favRibbonHTML = isFavSpotlight
      ? `<div class="favRibbon">\u2B50 Shop Team</div>`
      : "";

    return `
<div class="${cardClasses}" data-eventid="${SD.escapeHtml(eventId)}" style="border-left-color:${SD.escapeHtml(leagueColor)}">
  ${seriesBadge}
  <div class="cardHeader">
    ${statusLine}
    <div class="cardHeaderRight">
      ${broadcastName ? `<div class="broadcastChip">${SD.escapeHtml(broadcastName)}</div>` : ""}
      <div class="oddsLine" data-oddsline="${SD.escapeHtml(eventId)}"></div>
    </div>
  </div>
  ${favRibbonHTML}
  <div class="matchup">
    <div class="teamRow away${isFavAway ? " favTeam" : ""}">
      ${logoImg(awayLogoUrl, awayAbbr)}
      <div class="teamInfo">
        <div class="teamName">${SD.escapeHtml(awayRankPrefix + awayName)}</div>
        <div class="teamMeta" data-teammeta="${SD.escapeHtml(eventId)}_away">${SD.escapeHtml(SD.metaLineWithConference("away", SD.getConferenceNameFromCompetitor(away), SD.getOverallRecordFromCompetitor(away)))}</div>
      </div>
      ${scoreSpan(awayScore, awayWinner, isPost)}
    </div>
    <div class="teamRow home${isFavHome ? " favTeam" : ""}">
      ${logoImg(homeLogoUrl, homeAbbr)}
      <div class="teamInfo">
        <div class="teamName">${SD.escapeHtml(homeRankPrefix + homeName)}</div>
        <div class="teamMeta" data-teammeta="${SD.escapeHtml(eventId)}_home">${SD.escapeHtml(SD.metaLineWithConference("home", SD.getConferenceNameFromCompetitor(home), SD.getOverallRecordFromCompetitor(home)))}</div>
      </div>
      ${scoreSpan(homeScore, homeWinner, isPost)}
    </div>
  </div>
  ${venueLine ? `<div class="venueLine">${SD.escapeHtml(venueLine)}</div>` : ""}
  ${winProbBarHTML}
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
        const situation = comp?.situation || null;
        const stateStr = String(status?.type?.state || "").toLowerCase();
        const isMLB = leagueKey === "mlb";
        const isLive = stateStr === "in", isPost = stateStr === "post";
        const competitors = comp?.competitors || [];
        const home = competitors.find(c => String(c?.homeAway || "") === "home") || competitors[1] || {};
        const away = competitors.find(c => String(c?.homeAway || "") === "away") || competitors[0] || {};
        card.classList.toggle("cardLive", isLive);
        const scoreEls = card.querySelectorAll(".score");
        function setScoreWithFlash(el, newVal) {
          if (!el) return;
          if (el.textContent !== newVal && newVal !== "") {
            el.classList.remove("flashed");
            void el.offsetWidth;
            el.classList.add("flashed");
          }
          el.textContent = newVal;
        }
        setScoreWithFlash(scoreEls[0], String(away?.score ?? ""));
        setScoreWithFlash(scoreEls[1], String(home?.score ?? ""));
        if (isPost) {
          const aw = String(away?.winner || "") === "true", hw = String(home?.winner || "") === "true";
          if (scoreEls[0]) { scoreEls[0].classList.toggle("winner", aw); scoreEls[0].classList.toggle("loser", !aw); }
          if (scoreEls[1]) { scoreEls[1].classList.toggle("winner", hw); scoreEls[1].classList.toggle("loser", !hw); }
        }
        // Update win prob bar
        const probBar = card.querySelector(".winProbBar");
        if (probBar && isLive) {
          const preds = comp?.predictor || comp?.winProbability || null;
          const homeChance = Number(preds?.homeTeam?.teamChancePct ?? preds?.homeWinPercentage ?? -1);
          if (homeChance >= 0 && homeChance <= 100) {
            const awayEl = probBar.querySelector(".winProbAway");
            const homeEl = probBar.querySelector(".winProbHome");
            if (awayEl) awayEl.style.width = `${(100 - homeChance).toFixed(1)}%`;
            if (homeEl) homeEl.style.width = `${homeChance.toFixed(1)}%`;
          }
        }
        // Update status label
        const statusEl = card.querySelector(".statusLive, .statusFinal, .statusPre");
        if (statusEl && (isLive || isPost)) {
          const displayClock = String(status?.displayClock || "").trim();
          const period = Number(status?.period || 0);
          if (isLive) {
            let pl = "";
            if      (isMLB)                                          pl = mlbInningLabel(period, situation);
            else if (leagueKey === "nba"  || leagueKey === "ncaam") pl = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period-2}OT`);
            else if (leagueKey === "nhl")                            pl = period <= 3 ? (["1st","2nd","3rd"][period-1] || `P${period}`) : "OT";
            else if (leagueKey === "nfl"  || leagueKey === "cfb")   pl = ["1st","2nd","3rd","4th"][period-1] || `Q${period}`;
            else pl = period ? `P${period}` : "";
            const clockPart = (!isMLB && displayClock) ? " \u00b7 " + displayClock : "";
            statusEl.className = "statusLive";
            statusEl.textContent = `LIVE${pl ? " \u00b7 "+pl : ""}${clockPart}`;
          } else if (isPost) {
            const detail = String(status?.type?.shortDetail || status?.type?.detail || "").trim();
            let finalDetail = "";
            if (detail && detail.toLowerCase() !== "final" && !/^\d+:\d+$/.test(detail)) finalDetail = detail;
            statusEl.className = "statusFinal";
            statusEl.textContent = `Final${finalDetail ? " \u00b7 "+finalDetail : ""}`;
          }
        }
      }
      return;
    }
    container.innerHTML = sorted.map(ev => buildScoreCardHTML(ev, leagueKey)).join("");
  }

  // ─── Conference hydration ──────────────────────────────────────────
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
    for (const ev of (events || [])) {
      const id = String(ev?.id || "");
      const comp = ev?.competitions?.[0];
      for (const c of (comp?.competitors || [])) {
        const teamId = String(c?.team?.id || "");
        const conf = teamIdToConf[teamId] || SD.getConferenceNameFromCompetitor(c) || "";
        SD.applyConferenceMetaToDom(id, String(c?.homeAway || ""), conf, SD.getOverallRecordFromCompetitor(c));
      }
    }
    return teamIdToConf;
  }

  // ══════════════════════════════════════════════════════════════════
  //  PGA LEADERBOARD
  // ══════════════════════════════════════════════════════════════════

  function weatherIcon(condition) {
    const c = String(condition || "").toLowerCase();
    if (c.includes("thunder") || c.includes("storm")) return "\u26C8\uFE0F";
    if (c.includes("rain") || c.includes("shower") || c.includes("drizzle")) return "\uD83C\uDF27\uFE0F";
    if (c.includes("snow")) return "\u2744\uFE0F";
    if (c.includes("fog") || c.includes("mist")) return "\uD83C\uDF2B\uFE0F";
    if (c.includes("partly") || c.includes("partial") || c.includes("cloud")) return "\u26C5";
    if (c.includes("clear") || c.includes("sunny")) return "\u2600\uFE0F";
    return "\u26C5";
  }

  function wmoToCondition(code) {
    if (code === 0) return "Clear";
    if (code === 1) return "Mostly Clear";
    if (code === 2) return "Partly Cloudy";
    if (code === 3) return "Overcast";
    if ([45,48].includes(code)) return "Foggy";
    if ([51,53,55].includes(code)) return "Drizzle";
    if ([61,63,65].includes(code)) return "Rain";
    if ([71,73,75].includes(code)) return "Snow";
    if ([80,81,82].includes(code)) return "Rain Showers";
    if ([95,96,99].includes(code)) return "Thunderstorm";
    return "Partly Cloudy";
  }

  async function fetchPGAWeather(lat, lon) {
    if (!lat || !lon) return null;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
      const data = await SD.fetchJsonNoStore(url);
      const hi  = Math.round(data?.daily?.temperature_2m_max?.[0] ?? 0);
      const lo  = Math.round(data?.daily?.temperature_2m_min?.[0] ?? 0);
      const wmo = Number(data?.daily?.weathercode?.[0] ?? 0);
      const cond = wmoToCondition(wmo);
      return { hi, lo, condition: cond, icon: weatherIcon(cond) };
    } catch { return null; }
  }

  async function geocodeVenue(city, stateOrCountry) {
    if (!city) return null;
    try {
      const q = encodeURIComponent(`${city}${stateOrCountry ? ", " + stateOrCountry : ""}`);
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`;
      const data = await SD.fetchJsonNoStore(url);
      const r = data?.results?.[0];
      if (!r) return null;
      return { lat: r.latitude, lon: r.longitude };
    } catch { return null; }
  }

  async function renderPGALeaderboard(container, leagueKey, dateYYYYMMDD) {
    const league = SD.getLeagueByKey(leagueKey);
    if (!league) { container.innerHTML = `<div class="emptyState">PGA data unavailable.</div>`; return; }

    container.innerHTML = `<div class="emptyState" style="padding:32px">Loading PGA leaderboard\u2026</div>`;
    let data;
    try {
      data = await SD.fetchJsonNoStore(SD.withLangRegion(league.endpoint(dateYYYYMMDD)));
    } catch {
      container.innerHTML = `<div class="emptyState">Failed to load PGA data.</div>`;
      return;
    }

    const events = data?.events || [];
    if (!events.length) { container.innerHTML = `<div class="emptyState">No PGA events found.</div>`; return; }

    const ev       = events[0];
    const comp     = ev?.competitions?.[0];
    const status   = comp?.status;
    const stateStr = String(status?.type?.state || "").toLowerCase();
    const isLive   = stateStr === "in";
    const isPost   = stateStr === "post";

    const tournamentName = ev?.name || ev?.shortName || "PGA Tour Event";
    const venue          = comp?.venue || ev?.venue || {};
    const venueName      = venue?.fullName || venue?.name || "";
    const venueCity      = venue?.address?.city || "";
    const venueState     = venue?.address?.state || venue?.address?.country || "";
    const round          = Number(status?.period || comp?.currentRound || 1);
    const totalRounds    = Number(comp?.totalRounds || 4);

    // Fetch weather async — update DOM when ready
    const weatherEl = document.getElementById("pgaWeatherWidget");
    geocodeVenue(venueCity, venueState).then(coords => {
      if (!coords) return;
      return fetchPGAWeather(coords.lat, coords.lon);
    }).then(wx => {
      if (!wx) return;
      const el = document.getElementById("pgaWeatherWidget");
      if (!el) return;
      el.innerHTML = `
        <div class="pgaWeatherIcon">${wx.icon}</div>
        <div class="pgaWeatherDetails">
          <div class="pgaWeatherCondition">${SD.escapeHtml(wx.condition)}</div>
          <div class="pgaWeatherTemps">Hi ${wx.hi}\u00b0 / Lo ${wx.lo}\u00b0F</div>
        </div>`;
    }).catch(() => {});

    // Status pill
    let pillClass = isLive ? "live" : isPost ? "final" : "pre";
    const roundLabel = `Round ${round} of ${totalRounds}`;
    const statusDetailText = String(status?.type?.shortDetail || status?.type?.detail || "").trim();

    // Leaderboard competitors
    const comps = (comp?.competitors || []).slice();
    comps.sort((a, b) => Number(a?.status?.position?.id || a?.position || 999) - Number(b?.status?.position?.id || b?.position || 999));

    let selectedRound = round;

    function buildLeaderboardHTML(roundIdx) {
      const rows = comps.map((c, idx) => {
        const pos      = String(c?.status?.position?.displayName || c?.position || (idx+1));
        const posNum   = parseInt(pos, 10);
        const athlete  = c?.athlete || {};
        const name     = athlete?.displayName || athlete?.fullName || "Unknown";
        const country  = athlete?.flag?.description || athlete?.countryFlag?.description || athlete?.nationality || "";
        const isCut    = String(c?.status?.type?.name || "").toLowerCase().includes("cut");
        const isWD     = String(c?.status?.type?.name || "").toLowerCase().includes("wd");

        // Score — total
        const scoreVal = String(c?.score ?? c?.linescores?.find(l => l?.type?.name === "total")?.displayValue ?? "--");

        // Today's round score
        const todayRoundScore = (() => {
          const ls = c?.linescores || [];
          const roundScore = ls.find(l => Number(l?.period?.number || l?.round) === roundIdx);
          return roundScore ? String(roundScore.displayValue ?? "--") : "--";
        })();

        function scoreClass(val) {
          if (!val || val === "--" || val === "E") return "even";
          if (val.startsWith("-")) return "under";
          if (val.startsWith("+") || /^\d/.test(val)) return "over";
          return "even";
        }

        let rankClass = "";
        if (posNum === 1) rankClass = "gold";
        else if (posNum === 2) rankClass = "silver";
        else if (posNum === 3) rankClass = "bronze";

        let rowClass = "pgaLeaderRow";
        if (posNum <= 3 && !isCut && !isWD) rowClass += " top3";
        if (isCut || isWD) rowClass += " cut";

        return `
<div class="${rowClass}">
  <div class="pgaRank ${rankClass}">${SD.escapeHtml(pos)}</div>
  <div class="pgaPlayerInfo">
    <div class="pgaPlayerName">${SD.escapeHtml(name)}</div>
    ${country ? `<div class="pgaPlayerMeta">${SD.escapeHtml(country)}</div>` : ""}
  </div>
  <div class="pgaScoreTotal ${scoreClass(scoreVal)}">${SD.escapeHtml(scoreVal)}</div>
  <div class="pgaScoreToday ${scoreClass(todayRoundScore)}">${SD.escapeHtml(todayRoundScore)}</div>
</div>`;
      });

      // Insert cut divider
      const cutIdx = comps.findIndex(c => String(c?.status?.type?.name || "").toLowerCase().includes("cut"));
      if (cutIdx > 0) {
        const divider = `<div class="pgaCutDivider"><div class="pgaCutDividerLine"></div><div class="pgaCutDividerLabel">Missed Cut</div><div class="pgaCutDividerLine"></div></div>`;
        rows.splice(cutIdx, 0, divider);
      }

      const headerRow = `
<div class="pgaLeaderHeaderRow">
  <div class="pgaLeaderHeaderCell">Pos</div>
  <div class="pgaLeaderHeaderCell">Player</div>
  <div class="pgaLeaderHeaderCell right">Total</div>
  <div class="pgaLeaderHeaderCell right">Today</div>
</div>`;

      return `<div class="pgaLeaderboard">${headerRow}${rows.join("")}</div>`;
    }

    // Round pills
    function buildRoundPillsHTML(active) {
      return Array.from({ length: totalRounds }, (_, i) => {
        const r = i + 1;
        return `<button class="pgaRoundPill${r === active ? " active" : ""}" data-round="${r}" type="button">R${r}</button>`;
      }).join("");
    }

    container.innerHTML = `
<div class="pgaHero">
  <div class="pgaTournamentName">${SD.escapeHtml(tournamentName)}</div>
  ${venueName ? `<div class="pgaVenue">${SD.escapeHtml(venueName)}${venueCity ? ", " + SD.escapeHtml(venueCity) : ""}</div>` : ""}
  <div class="pgaStatusRow">
    <div class="pgaStatusPill ${pillClass}">${SD.escapeHtml(isLive ? "Live" : isPost ? "Final" : "Upcoming")}</div>
    <div class="pgaRoundBadge">${SD.escapeHtml(roundLabel)}</div>
  </div>
  <div class="pgaWeather" id="pgaWeatherWidget" style="min-height:48px"></div>
</div>
<div class="pgaRoundPills" id="pgaRoundPills">${buildRoundPillsHTML(selectedRound)}</div>
<div id="pgaLeaderboardTable">${buildLeaderboardHTML(selectedRound)}</div>
    `;

    // Bind round pill clicks
    const pillsRow = document.getElementById("pgaRoundPills");
    if (pillsRow) {
      pillsRow.addEventListener("click", e => {
        const pill = e.target.closest(".pgaRoundPill");
        if (!pill) return;
        const r = Number(pill.dataset.round);
        if (!r) return;
        selectedRound = r;
        pillsRow.querySelectorAll(".pgaRoundPill").forEach(p => p.classList.toggle("active", Number(p.dataset.round) === r));
        const tableEl = document.getElementById("pgaLeaderboardTable");
        if (tableEl) tableEl.innerHTML = buildLeaderboardHTML(r);
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════
  //  MAIN LOAD
  // ══════════════════════════════════════════════════════════════════

  window.loadScores = async function (forceRefresh) {
    stopLiveTicker();

    const leagueKey    = SD.getSavedLeagueKey();
    const dateYYYYMMDD = SD.getSavedDateYYYYMMDD();
    const isPGA        = leagueKey === "pga";
    const league       = SD.getLeagueByKey(leagueKey);
    const color        = SD.LEAGUE_COLORS[leagueKey] || "#444";

    const isCollege  = SD.isCollegeLeagueKey(leagueKey);
    const savedConf  = SD.getSavedConferenceFilter(leagueKey);

    // ── Build page shell ──
    const content = document.getElementById("content");
    if (content) {
      content.innerHTML = buildHeaderHTML(leagueKey, color)
        + buildDateNavHTML(dateYYYYMMDD)
        + (isCollege ? `<div id="confFilterRow" style="padding:0 12px 4px">${SD.buildConferenceSelectHTML([], savedConf, true)}</div>` : "")
        + `<div id="scoresContainer" class="scoresContainer"></div>`;
    }

    // Restore league pill scroll after rebuild
    requestAnimationFrame(() => {
      restoreLeagueRowScroll();
      bindLeaguePills();
      bindDateNav();
      if (isCollege) {
        const sel = document.getElementById("confSelect");
        if (sel) sel.addEventListener("change", e => {
          SD.setSavedConferenceFilter(leagueKey, e.target.value);
          window.loadScores(true);
        });
      }
    });

    const container = document.getElementById("scoresContainer");

    // ── PGA branch ──
    if (isPGA) {
      if (container) await renderPGALeaderboard(container, leagueKey, dateYYYYMMDD);
      return;
    }

    // ── Sports scores branch ──
    let events = [];
    try {
      const url  = SD.withLangRegion(league.endpoint(dateYYYYMMDD));
      const data = await SD.fetchJsonNoStore(url);
      events = data?.events || [];
    } catch {
      if (container) container.innerHTML = `<div class="emptyState">Failed to load scores. Check your connection.</div>`;
      return;
    }

    let filteredEvents = events;
    if (isCollege && savedConf) {
      const confFilterNorm = SD.norm(savedConf);
      if (confFilterNorm) {
        const cached = SD.loadConfCache(leagueKey, dateYYYYMMDD);
        const teamIdToConf = cached ? cached.teamIdToConf : {};
        filteredEvents = SD.filterEventsByConferenceUsingMap(events, confFilterNorm, teamIdToConf);
      }
    }

    renderScoreCards(filteredEvents, leagueKey, dateYYYYMMDD, false);

    SD.hydrateAllOdds(league, leagueKey, dateYYYYMMDD, filteredEvents).catch(() => {});

    if (isCollege) {
      hydrateConferenceMeta(league, leagueKey, dateYYYYMMDD, events).then(map => {
        if (map && savedConf) {
          const norm2 = SD.norm(savedConf);
          if (norm2) {
            const reFiltered = SD.filterEventsByConferenceUsingMap(events, norm2, map);
            renderScoreCards(reFiltered, leagueKey, dateYYYYMMDD, false);
          }
        }
        const confs = SD.buildConferenceListFromMap(map || {});
        if (confs.length) SD.updateConferenceSelectOptions(confs, leagueKey);
      }).catch(() => {});
    }

    startLiveTicker(league, leagueKey, dateYYYYMMDD);
    lastRenderedKey = `${leagueKey}_${dateYYYYMMDD}`;
  };

  window.__stopScoresTicker = stopLiveTicker;

})();
