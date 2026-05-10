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

  // ─── Inject styles ───────────────────────────────────────────────────────
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
.venueLine::before { content: "\uD83D\uDCCD "; }
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
  display: flex; align-items: center; gap: 6px; flex-shrink: 0; max-width: 55%;
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
  background: rgba(200,160,0,0.07);
  box-shadow: 0 6px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,160,0,0.18),
    0 0 22px rgba(200,155,0,0.13), inset 0 1px 0 rgba(255,220,100,0.09);
}
.favRibbon {
  position: absolute; top: 0; right: 0;
  background: linear-gradient(135deg, rgba(200,160,0,0.85), rgba(240,190,30,0.9));
  color: #1a1200; font-size: 9px; font-weight: 900; letter-spacing: 0.09em;
  text-transform: uppercase; padding: 3px 9px 3px 11px;
  border-radius: 0 12px 0 10px; line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 2;
}
@keyframes scoreFlash {
  0%   { color: #ffd700; text-shadow: 0 0 16px rgba(255,210,0,0.9); }
  100% { }
}
.score.flashed { animation: scoreFlash 600ms ease-out forwards; }

/* ════════════════════════════════
   PGA LEADERBOARD
   ════════════════════════════════ */

/* Hero banner */
.pgaHero {
  margin: 0 0 14px;
  border-radius: 18px;
  overflow: hidden;
  background: linear-gradient(135deg,
    rgba(20,60,22,0.95) 0%,
    rgba(10,38,12,0.98) 60%,
    rgba(5,20,8,1) 100%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
  padding: 18px 18px 16px;
  position: relative;
}
.pgaHero::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 80% 20%, rgba(100,200,80,0.08) 0%, transparent 60%);
  pointer-events: none;
}
.pgaTournamentName {
  font-size: 19px;
  font-weight: 900;
  color: #fff;
  letter-spacing: 0.01em;
  line-height: 1.15;
  margin-bottom: 3px;
}
.pgaVenue {
  font-size: 12px;
  color: rgba(255,255,255,0.52);
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.pgaVenue::before { content: "\uD83D\uDCCD"; font-size: 11px; }

/* Status pill */
.pgaStatusRow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.pgaStatusPill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 999px;
}
.pgaStatusPill.live {
  background: rgba(255,50,50,0.18); border: 1px solid rgba(255,50,50,0.4); color: #ff5555;
}
.pgaStatusPill.live::before {
  content: ""; width: 7px; height: 7px; border-radius: 50%; background: #ff4444;
  box-shadow: 0 0 6px rgba(255,50,50,0.9); animation: scLivePulse 1.2s ease-in-out infinite; flex-shrink: 0;
}
.pgaStatusPill.final {
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.55);
}
.pgaStatusPill.pre {
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.45);
}

/* Round badge */
.pgaRoundBadge {
  font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
  padding: 3px 10px; border-radius: 999px;
  background: rgba(80,180,60,0.15); border: 1px solid rgba(80,180,60,0.3);
  color: rgba(140,230,110,0.9);
}

/* Weather widget */
.pgaWeather {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  margin-top: 4px;
}
.pgaWeatherIcon { font-size: 22px; line-height: 1; flex-shrink: 0; }
.pgaWeatherDetails { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.pgaWeatherCondition { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.88); line-height: 1.2; }
.pgaWeatherTemps { font-size: 11px; color: rgba(255,255,255,0.5); font-weight: 600; letter-spacing: 0.03em; }
.pgaWeatherWind { font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 600; }

/* Round pills */
.pgaRoundPills { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px 12px 8px; }
.pgaRoundPills::-webkit-scrollbar { display: none; }
.pgaRoundPill {
  flex-shrink: 0; font-size: 12px; font-weight: 800; letter-spacing: 0.05em;
  padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background 150ms ease, color 150ms ease;
}
.pgaRoundPill:active { opacity: 0.7; }
.pgaRoundPill.active {
  background: rgba(61,122,64,0.7); border-color: rgba(100,200,80,0.4);
  color: #fff; box-shadow: 0 0 10px rgba(80,200,60,0.25);
}

/* Leaderboard table */
.pgaLeaderboard {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.025);
}
.pgaLeaderRow {
  display: grid;
  grid-template-columns: 36px 1fr 52px 52px;
  align-items: center;
  padding: 10px 12px;
  gap: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 120ms ease;
}
.pgaLeaderRow:last-child { border-bottom: none; }
.pgaLeaderRow:active { background: rgba(255,255,255,0.05); }
.pgaLeaderRow.top3 { background: rgba(255,210,50,0.05); }
.pgaLeaderRow.top3:active { background: rgba(255,210,50,0.1); }

/* Header row */
.pgaLeaderHeaderRow {
  display: grid;
  grid-template-columns: 36px 1fr 52px 52px;
  padding: 7px 12px;
  gap: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
}
.pgaLeaderHeaderCell {
  font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(255,255,255,0.35);
}
.pgaLeaderHeaderCell.right { text-align: right; }

/* Rank number */
.pgaRank {
  font-size: 13px; font-weight: 900; color: rgba(255,255,255,0.45);
  text-align: center; letter-spacing: 0.02em;
}
.pgaRank.gold { color: #ffd040; text-shadow: 0 0 8px rgba(255,200,0,0.5); }
.pgaRank.silver { color: #c0c8d8; }
.pgaRank.bronze { color: #cd8860; }

/* Player name + country */
.pgaPlayerInfo { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding-left: 2px; }
.pgaPlayerName { font-size: 15px; font-weight: 800; color: #eee; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pgaPlayerMeta { font-size: 11px; color: rgba(255,255,255,0.38); font-weight: 600; letter-spacing: 0.02em; }

/* Score columns */
.pgaScoreTotal {
  font-size: 17px; font-weight: 900; text-align: right;
  font-variant-numeric: tabular-nums; letter-spacing: -0.3px;
  color: rgba(255,255,255,0.8);
}
.pgaScoreToday {
  font-size: 14px; font-weight: 700; text-align: right;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.5);
}
.pgaScoreTotal.under, .pgaScoreToday.under { color: #6edb64; }
.pgaScoreTotal.over,  .pgaScoreToday.over  { color: #ff7070; }
.pgaScoreTotal.even,  .pgaScoreToday.even  { color: rgba(255,255,255,0.7); }

/* Missed cut / WD rows */
.pgaLeaderRow.cut { opacity: 0.38; }

/* Cut divider */
.pgaCutDivider {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid rgba(255,255,255,0.06);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}
.pgaCutDividerLabel {
  font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
  color: rgba(255,255,255,0.28); white-space: nowrap;
}
.pgaCutDividerLine { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }

    `;
    document.head.appendChild(style);
  })();

  // ─── League pill labels ──────────────────────────────────────────────
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

  // ─── Date helpers ────────────────────────────────────────────
  function formatDateNav(yyyymmdd) {
    try {
      const y = parseInt(yyyymmdd.slice(0,4), 10);
      const m = parseInt(yyyymmdd.slice(4,6), 10) - 1;
      const d = parseInt(yyyymmdd.slice(6,8), 10);
      return new Date(y, m, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    } catch { return yyyymmdd; }
  }
  function toInputValue(yyyymmdd) {
    return `${yyyymmdd.slice(0,4)}-${yyyymmdd.slice(4,6)}-${yyyymmdd.slice(6,8)}`;
  }
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

  // ─── Build header HTML ───────────────────────────────────────────
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

  // ─── Build date navigator HTML ───────────────────────────────────────────
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

  // ─── Bind pill tab clicks ───────────────────────────────────────────────
  function bindLeaguePills() {
    const row = document.getElementById("scoresLeagueRow");
    if (!row) return;
    row.addEventListener("click", e => {
      const pill = e.target.closest(".scoresLeaguePill");
      if (!pill) return;
      const key = pill.dataset.league;
      if (!key) return;
      SD.saveLeagueKey(key);
      pill.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      window.loadScores(true);
    });
  }

  // ─── Bind date navigator ─────────────────────────────────────────────
  function bindDateNav() {
    const prev   = document.getElementById("scoresDatePrev");
    const next   = document.getElementById("scoresDateNext");
    const label  = document.getElementById("scoresDateNavLabel");
    const text   = document.getElementById("scoresDateNavText");
    const picker = document.getElementById("scoresDatePicker");

    function applyDate(yyyymmdd) {
      SD.saveDateYYYYMMDD(yyyymmdd);
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

  // ─── Live ticker ─────────────────────────────────────────────────────────
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

  // ─── MLB inning label ───────────────────────────────────────────────────
  function mlbInningLabel(period, situation) {
    const suffix = ["1st","2nd","3rd"][period-1] || `${period}th`;
    const isTop = situation?.isTopHalfInning !== false;
    return `${isTop ? "Top" : "Bot"} ${suffix}`;
  }

  // ─── Score card rendering ──────────────────────────────────────────────────
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
    const eventId  = String(ev?.id || "");

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

    const venueLine = SD.buildVenueLine(comp);
    const leagueColor = SD.LEAGUE_COLORS[leagueKey] || "#555";
    const isPlayoff = SD.PLAYOFF_LEAGUES.has(leagueKey);
    const seriesStatus = isPlayoff ? (comp?.series?.summary || comp?.series?.title || "") : "";
    const seriesBadge  = seriesStatus ? `<div class="seriesBadge">${SD.escapeHtml(seriesStatus)}</div>` : "";

    let statusLine = "";
    if (isLive) {
      let periodLabel = "";
      if      (isMLB)                                            periodLabel = mlbInningLabel(period, situation);
      else if (leagueKey === "nba"  || leagueKey === "ncaam")   periodLabel = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period-2}OT`);
      else if (leagueKey === "nhl")                              periodLabel = period <= 3 ? (["1st","2nd","3rd"][period-1] || `P${period}`) : "OT";
      else if (leagueKey === "nfl"  || leagueKey === "cfb")     periodLabel = ["1st","2nd","3rd","4th"][period-1] || `Q${period}`;
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

    // Win prob bar HTML — only on live games where data is available
    const winProbBarHTML = (() => {
      if (!winProb || !isLive) return "";
      const awayColor = awayTeam.color ? "#" + awayTeam.color.replace(/^#/,"") : "rgba(120,120,255,0.7)";
      const homeColor = homeTeam.color ? "#" + homeTeam.color.replace(/^#/,"") : "rgba(255,120,120,0.7)";
      return `<div class="winProbBar">
        <div class="winProbAway" style="width:${winProb.away.toFixed(1)}%;background:${SD.escapeHtml(awayColor)}"></div>
        <div class="winProbHome" style="width:${winProb.home.toFixed(1)}%;background:${SD.escapeHtml(homeColor)}"></div>
      </div>`;
    })();

    return `
<div class="${cardClasses}" data-eventid="${SD.escapeHtml(eventId)}" style="border-left-color:${SD.escapeHtml(leagueColor)}">
  ${isFavSpotlight ? `<div class="favRibbon">\u2B50 Your Team</div>` : ""}
  ${seriesBadge}
  <div class="cardHeader">
    ${statusLine}
    <div class="cardHeaderRight">
      <div class="oddsLine" data-oddsline="${SD.escapeHtml(eventId)}"></div>
      ${broadcastName ? `<div class="broadcastChip">${SD.escapeHtml(broadcastName)}</div>` : ""}
    </div>
  </div>
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
        // Flash score if it changed during live update
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
        // Update win prob bar if present
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
        const statusEl = card.querySelector(".statusLive, .statusFinal, .statusPre");
        if (statusEl && (isLive || isPost)) {
          const displayClock = String(status?.displayClock || "").trim();
          const period = Number(status?.period || 0);
          if (isLive) {
            let pl = "";
            if      (isMLB)                                            pl = mlbInningLabel(period, situation);
            else if (leagueKey === "nba"  || leagueKey === "ncaam")   pl = period <= 2 ? `${period}H` : (period === 3 ? "OT" : `${period-2}OT`);
            else if (leagueKey === "nhl")                              pl = period <= 3 ? (["1st","2nd","3rd"][period-1] || `P${period}`) : "OT";
            else if (leagueKey === "nfl"  || leagueKey === "cfb")     pl = ["1st","2nd","3rd","4th"][period-1] || `Q${period}`;
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

  // ─── Conference hydration ──────────────────────────────────────────────────────
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

  // ════════════════════════════════════════════════════════════════════
  //  PGA LEADERBOARD
  // ════════════════════════════════════════════════════════════════════

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

  function pgaRoundLabel(status, isLive, isPost) {
    const detail = String(status?.type?.shortDetail || status?.type?.detail || "").toLowerCase();
    const period = Number(status?.period || 0);
    if (detail.includes("round")) return detail.replace(/^.*?(round\s*\d+).*$/i, "$1").trim().replace(/^\w/, c => c.toUpperCase());
    if (period >= 1 && period <= 4) return `Round ${period}`;
    return "";
  }

  function rankMedalClass(posNum) {
    if (posNum === 1) return "gold";
    if (posNum === 2) return "silver";
    if (posNum === 3) return "bronze";
    return "";
  }

  function toParClass(n) {
    if (n < 0)  return "under";
    if (n > 0)  return "over";
    return "even";
  }

  function formatToPar(n) {
    if (n === 0)  return "E";
    if (n < 0)   return String(n);
    return `+${n}`;
  }

  function parsePGACompetitors(events) {
    const ev   = (events || [])[0];
    const comp = ev?.competitions?.[0];
    const competitors = [];
    for (const c of (comp?.competitors || [])) {
      const name = String(c?.athlete?.displayName || c?.athlete?.fullName || "").trim();
      if (!name) continue;
      const position = Number(c?.order ?? 999);
      const toParNum = (c?.score !== undefined && c?.score !== null && c?.score !== "")
        ? Number(c.score) : null;
      const validLS = (c?.linescores || []).filter(
        l => l?.period > 0 && l?.displayValue !== null && l?.displayValue !== undefined && l?.displayValue !== ""
      );
      const todayRaw = validLS.length > 0
        ? validLS.sort((a, b) => Number(b.period) - Number(a.period))[0]?.displayValue
        : null;
      const todayNum = (todayRaw !== null && todayRaw !== undefined) ? Number(todayRaw) : null;
      competitors.push({
        id:         String(c?.athlete?.id || c?.id || ""),
        name,
        country:    String(c?.athlete?.flag?.alt || c?.athlete?.country?.abbreviation || ""),
        toPar:      Number.isFinite(toParNum)  ? toParNum  : null,
        todayScore: Number.isFinite(todayNum)  ? todayNum  : null,
        position:   Number.isFinite(position)  ? position  : 999,
        isCut:      false,
        isWD:       false,
        rounds:     validLS.sort((a,b) => a.period - b.period).map(l => l.displayValue),
      });
    }
    competitors.sort((a, b) => a.position - b.position);
    return competitors;
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

  async function renderPGALeaderboard(events, league, leagueKey, dateYYYYMMDD) {
    const container = document.getElementById("scoresContainer");
    if (!container) return;

    const firstEv   = events?.[0];
    const comp       = firstEv?.competitions?.[0];
    const tournName  = String(
      firstEv?.name || firstEv?.shortName ||
      comp?.name || "PGA Tour"
    );
    const venue      = comp?.venue;
    const venueCity  = String(venue?.address?.city  || "").trim();
    const venueState = String(venue?.address?.state || venue?.address?.country || "").trim();
    const venueDisplay = [venueCity, venueState].filter(Boolean).join(", ");
    const lat = venue?.address?.latitude  || null;
    const lon = venue?.address?.longitude || null;

    const status   = comp?.status;
    const stateStr = String(status?.type?.state || "").toLowerCase();
    const isLive   = stateStr === "in";
    const isPost   = stateStr === "post";
    const stDetail = String(status?.type?.shortDetail || status?.type?.detail || "").trim();

    const roundLabel = pgaRoundLabel(status, isLive, isPost);

    const competitors = parsePGACompetitors(events);
    const top20       = competitors.filter(c => !c.isCut && !c.isWD).slice(0, 20);
    const cutPlayers  = competitors.filter(c => c.isCut || c.isWD).slice(0, 5);

    let statusPillHTML = "";
    if (isLive) {
      statusPillHTML = `<div class="pgaStatusPill live">Live${stDetail ? " \u00b7 " + stDetail : ""}</div>`;
    } else if (isPost) {
      statusPillHTML = `<div class="pgaStatusPill final">Final</div>`;
    } else {
      statusPillHTML = `<div class="pgaStatusPill pre">${SD.escapeHtml(stDetail || "Upcoming")}</div>`;
    }

    const roundBadgeHTML = roundLabel
      ? `<div class="pgaRoundBadge">\u26F3 ${SD.escapeHtml(roundLabel)}</div>`
      : "";

    const rankDisplays = top20.map((p, i) => String(i + 1));

    container.innerHTML = `
<div class="pgaHero">
  <div class="pgaTournamentName">${SD.escapeHtml(tournName)}</div>
  ${venueDisplay ? `<div class="pgaVenue">${SD.escapeHtml(venueDisplay)}</div>` : ""}
  <div class="pgaStatusRow">
    ${statusPillHTML}
    ${roundBadgeHTML}
  </div>
  <div id="pgaWeatherSlot"></div>
</div>
<div class="pgaLeaderboard">
  <div class="pgaLeaderHeaderRow">
    <div class="pgaLeaderHeaderCell">#</div>
    <div class="pgaLeaderHeaderCell">Player</div>
    <div class="pgaLeaderHeaderCell right">Today</div>
    <div class="pgaLeaderHeaderCell right">Total</div>
  </div>
  ${top20.map((p, i) => {
    const rankTxt  = rankDisplays[i];
    const posNum   = i + 1;
    const rMedal   = posNum <= 3 ? rankMedalClass(posNum) : "";
    const totalCls = p.toPar !== null ? toParClass(p.toPar) : "";
    const todayCls = p.todayScore !== null ? toParClass(p.todayScore) : "";
    const isT3     = posNum <= 3;
    const totalDisp = p.toPar !== null ? formatToPar(p.toPar) : "-";
    const todayDisp = p.todayScore !== null ? formatToPar(p.todayScore) : "-";
    return `
<div class="pgaLeaderRow${isT3 ? " top3" : ""}">
  <div class="pgaRank${rMedal ? " " + rMedal : ""}">${SD.escapeHtml(rankTxt)}</div>
  <div class="pgaPlayerInfo">
    <div class="pgaPlayerName">${SD.escapeHtml(p.name)}</div>
    ${p.country ? `<div class="pgaPlayerMeta">${SD.escapeHtml(p.country)}</div>` : ""}
  </div>
  <div class="pgaScoreToday ${todayCls}">${SD.escapeHtml(todayDisp)}</div>
  <div class="pgaScoreTotal ${totalCls}">${SD.escapeHtml(totalDisp)}</div>
</div>`;
  }).join("")}
</div>`;

    // Async: fetch weather and inject
    if (lat && lon) {
      fetchPGAWeather(lat, lon).then(w => {
        if (!w) return;
        const slot = document.getElementById("pgaWeatherSlot");
        if (!slot) return;
        slot.innerHTML = `<div class="pgaWeather"><div class="pgaWeatherIcon">${w.icon}</div><div class="pgaWeatherDetails"><div class="pgaWeatherCondition">${SD.escapeHtml(w.condition)}</div><div class="pgaWeatherTemps">High ${w.hi}\u00b0 / Low ${w.lo}\u00b0</div></div></div>`;
      }).catch(() => {});
    } else if (venueCity) {
      geocodeVenue(venueCity, venueState).then(coords => {
        if (!coords) return;
        return fetchPGAWeather(coords.lat, coords.lon);
      }).then(w => {
        if (!w) return;
        const slot = document.getElementById("pgaWeatherSlot");
        if (!slot) return;
        slot.innerHTML = `<div class="pgaWeather"><div class="pgaWeatherIcon">${w.icon}</div><div class="pgaWeatherDetails"><div class="pgaWeatherCondition">${SD.escapeHtml(w.condition)}</div><div class="pgaWeatherTemps">High ${w.hi}\u00b0 / Low ${w.lo}\u00b0</div></div></div>`;
      }).catch(() => {});
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  MAIN LOAD
  // ════════════════════════════════════════════════════════════════════

  window.loadScores = async function (forceRefresh) {
    stopLiveTicker();
    const leagueKey    = SD.getSavedLeagueKey();
    const dateYYYYMMDD = SD.getSavedDateYYYYMMDD();
    const league       = SD.getLeagueByKey(leagueKey);
    const color        = SD.LEAGUE_COLORS[leagueKey] || "#444";

    const content = document.getElementById("content");
    if (!content) return;

    // Build chrome (header + date nav + container)
    content.innerHTML =
      buildHeaderHTML(leagueKey, color) +
      buildDateNavHTML(dateYYYYMMDD) +
      `<div id="scoresContainer" class="scoresContainer"></div>`;

    bindLeaguePills();
    bindDateNav();

    const container = document.getElementById("scoresContainer");

    // Show skeleton while loading
    container.innerHTML = Array.from({length: 4}, () =>
      `<div class="scoreCard" style="border-left-color:#333;min-height:90px;background:rgba(255,255,255,0.03);"></div>`
    ).join("");

    let events = [];
    try {
      const url  = SD.withLangRegion(league.endpoint(dateYYYYMMDD));
      const data = await SD.fetchJsonNoStore(url);
      events = data?.events || [];
    } catch {
      container.innerHTML = `<div class="emptyState">Failed to load scores. Check your connection.</div>`;
      return;
    }

    // PGA gets its own leaderboard renderer
    if (leagueKey === "pga") {
      await renderPGALeaderboard(events, league, leagueKey, dateYYYYMMDD);
      return;
    }

    let filteredEvents = events;
    if (SD.isCollegeLeagueKey(leagueKey)) {
      const savedConf   = SD.getSavedConferenceFilter(leagueKey);
      const confFilterNorm = SD.norm(savedConf);
      if (confFilterNorm) {
        const cached = SD.loadConfCache(leagueKey, dateYYYYMMDD);
        const teamIdToConf = cached ? cached.teamIdToConf : {};
        filteredEvents = SD.filterEventsByConferenceUsingMap(events, confFilterNorm, teamIdToConf);
      }
      hydrateConferenceMeta(league, leagueKey, dateYYYYMMDD, events).then(map => {
        if (map && SD.getSavedConferenceFilter(leagueKey)) {
          const norm2 = SD.norm(SD.getSavedConferenceFilter(leagueKey));
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
