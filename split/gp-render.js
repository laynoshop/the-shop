/* split/gp-render.js
   =========================
   GP RENDER
   All HTML builders for the Group Picks tab.
   Exports via window.GP_Render = { ... }

   Key fix: ESPN hydration stores data on g.__live and g.__odds
   (double-underscore). All score/odds reads now use those keys.
   ========================= */

(function GPRenderModule() {
  "use strict";

  // ─── Inject styles ──────────────────────────────────────────────
  (function injectStyles() {
    if (document.getElementById("__gpRenderStyles")) return;
    const style = document.createElement("style");
    style.id = "__gpRenderStyles";
    style.textContent = `

/* ══════════════════════════════════════════════
   GP HEADER
   ══════════════════════════════════════════════ */
.gpPageHeader {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(13,10,10,0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255,255,255,0.07);
  padding: 12px 14px 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.45);
}
.gpPageHeader::after {
  content: "";
  display: block;
  height: 3px;
  border-radius: 999px;
  margin-top: 10px;
  background: rgba(187,0,0,0.8);
  box-shadow: 0 0 10px rgba(187,0,0,0.6);
  opacity: 0.85;
}
.gpHeaderTopRow {
  display: flex; align-items: center;
  gap: 12px; margin-bottom: 10px;
}
.gpHeaderTitleBlock { min-width: 0; margin-left: auto; text-align: right; }
.gpHeaderTitle {
  font-size: 28px; font-weight: 950; color: #fff;
  letter-spacing: 0.01em; line-height: 1.05;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpHeaderTitle span {
  display: block; font-size: 14px; font-weight: 700;
  color: rgba(255,255,255,0.55); letter-spacing: 0.03em;
  margin-top: 3px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpHeaderWelcome {
  flex: 0 1 auto; min-width: 0;
  font-size: 20px; font-weight: 800; color: rgba(255,255,255,0.82);
  letter-spacing: 0.005em; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpHeaderActions {
  display: flex; align-items: stretch; gap: 8px;
}
.gpHeaderActions .gpHeaderBtn {
  flex: 1 1 0;
  text-align: center;
  padding: 10px 6px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* ══════════════════════════════════════════════
   LOADING BLIP — shown while a full render is in flight
   (initial load, identity/login, or a slow reload)
   ══════════════════════════════════════════════ */
.gpLoadingBlip {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center;
  padding: 20px;
  min-height: calc(100vh - var(--tabsH, 44px) - var(--bannerH, 28px) - env(safe-area-inset-bottom));
  box-sizing: border-box;
}
#gpLoadingBlipInner {
  display: flex; flex-direction: column; align-items: center;
  gap: 18px; text-align: center;
}
.gpLoadingGif {
  width: 280px; height: 280px; max-width: 90%; border-radius: 16px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
}
/* Not square like the gif — sized by width only, height auto, so the
   whole photo (every corner, including the game clock) always shows
   instead of getting cropped by a fixed square box. */
.gpLoadingPhoto {
  width: 252px; height: auto; max-width: 90%; border-radius: 16px;
  object-fit: contain;
  border: 1px solid rgba(255,255,255,0.10);
  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
}
.gpLoadingTitle {
  font-size: 24px; font-weight: 900; color: #fff;
}
.gpLoadingSub {
  font-size: 18px; font-weight: 700; line-height: 1.5;
  color: rgba(255,255,255,0.65);
  max-width: 360px;
}

/* ══════════════════════════════════════════════
   GP CONTAINER
   ══════════════════════════════════════════════ */
.gpContainer {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 12px 80px;
}

/* ══════════════════════════════════════════════
   GP ADMIN BUILDER  (top-of-page panel)
   ══════════════════════════════════════════════ */
.gpAdminPanel {
  background: rgba(255,200,0,0.06);
  border: 1px solid rgba(255,200,0,0.22);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.gpAdminPanelTitle {
  font-size: 12px; font-weight: 900; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255,220,80,0.85);
}
.gpAdminControls {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
}
.gpAdminGameList {
  display: flex; flex-direction: column; gap: 6px;
  max-height: 280px; overflow-y: auto;
}
.gpAdminRow label {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  cursor: pointer; font-size: 14px; font-weight: 700;
  -webkit-tap-highlight-color: transparent;
}
.gpAdminRow label:active { background: rgba(255,255,255,0.08); }
.gpAdminTime {
  display: flex; flex-direction: column; align-items: flex-end; gap: 1px;
  white-space: nowrap; margin-left: auto; flex-shrink: 0;
}
.gpAdminTimeDate {
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em;
  color: rgba(255,255,255,0.32); text-transform: uppercase;
}
.gpAdminTimeClock {
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.42);
}
.gpAdminStatus {
  font-size: 12px; font-weight: 700; color: rgba(255,220,100,0.7);
  min-height: 18px;
}

/* ══════════════════════════════════════════════
   SCORE CARD  (matches scores-render.js exactly)
   ══════════════════════════════════════════════ */
.gpScoreCard {
  position: relative; display: flex; flex-direction: column; gap: 0;
  background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; border-left: 4px solid #555; overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
}
.gpScoreCard.gpCardLive { background: rgba(200,0,0,0.07); }
.gpCardHeader {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 8px 12px 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpStatusLive {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: #ff4444;
}
.gpStatusLive::before {
  content: ""; display: inline-block; width: 7px; height: 7px;
  border-radius: 50%; background: #ff3333;
  box-shadow: 0 0 6px rgba(255,50,50,0.9);
  animation: gpLivePulse 1.2s ease-in-out infinite; flex-shrink: 0;
}
@keyframes gpLivePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}
.gpStatusFinal {
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: rgba(255,255,255,0.4);
}
.gpStatusPre { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.65); }
.gpCardHeaderRight {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
  max-width: 60%; overflow: hidden;
}
.gpOddsLine {
  font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.45);
  text-align: right; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 100%; min-width: 0; flex-shrink: 1;
}
.gpMatchup {
  display: flex; flex-direction: column;
  padding: 6px 12px 10px; gap: 6px;
}

/* Team pick buttons — the subtle border on every option is a "tap to
   pick" affordance. Once chosen it goes a neutral bold gray (no verdict
   yet — win/loss isn't decided), then green once the game is final and
   the pick was right, or red if it was wrong. A push (ATS) or tie
   (straight) is neither, so it stays neutral gray permanently. */
.gpTeamPickBtn {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; min-height: 44px; border-radius: 10px;
  background: rgba(255,255,255,0.02);
  border: 1.5px solid rgba(255,255,255,0.10);
  width: 100%; box-sizing: border-box;
  text-align: left; cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
  -webkit-tap-highlight-color: transparent;
}
.gpTeamPickBtn:active { background: rgba(255,255,255,0.06); }
.gpTeamPickBtn.gpPickNeutral {
  background: rgba(255,255,255,0.11);
  border-color: rgba(255,255,255,0.4);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.14) inset;
}
.gpTeamPickBtn.gpPickNeutral .gpTeamName { color: #fff; font-weight: 900; }
.gpTeamPickBtn.gpPickResultWin {
  background: rgba(80,200,120,0.14);
  border-color: rgba(90,220,140,0.6);
  box-shadow: 0 0 0 1px rgba(90,220,140,0.2) inset;
}
.gpTeamPickBtn.gpPickResultWin .gpTeamName { color: #6dff9a; font-weight: 900; }
.gpTeamPickBtn.gpPickResultLoss {
  background: rgba(220,60,60,0.14);
  border-color: rgba(230,90,90,0.6);
  box-shadow: 0 0 0 1px rgba(230,90,90,0.2) inset;
}
.gpTeamPickBtn.gpPickResultLoss .gpTeamName { color: #ff8f8f; font-weight: 900; }
.gpTeamPickBtn.gpFaded { opacity: 0.38; }
.gpTeamPickBtn:disabled { cursor: default; pointer-events: none; }

.gpTeamLogo {
  width: 40px; height: 40px; object-fit: contain;
  border-radius: 10px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10); padding: 3px;
  flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}
.gpTeamLogoPlaceholder {
  width: 40px; height: 40px; display: inline-flex;
  align-items: center; justify-content: center; border-radius: 10px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 800;
  letter-spacing: 0.3px; flex-shrink: 0;
}
.gpTeamInfo { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.gpTeamName {
  font-size: 16px; font-weight: 800; color: #eee;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.15; letter-spacing: 0.1px;
}
.gpTeamMeta {
  font-size: 11px; color: rgba(255,255,255,0.42);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.2;
}
.gpScore {
  font-size: 26px; font-weight: 900; color: rgba(255,255,255,0.88);
  min-width: 38px; text-align: right; flex-shrink: 0;
  font-variant-numeric: tabular-nums; letter-spacing: -0.5px;
  line-height: 1; text-shadow: 0 0 10px rgba(255,200,0,0.2);
}
.gpScore.gpWinner { color: #fff; text-shadow: 0 0 12px rgba(255,220,80,0.55), 0 0 28px rgba(255,160,0,0.25); }
.gpScore.gpLoser  { color: rgba(255,255,255,0.3); text-shadow: none; }

.gpVenueLine {
  padding: 0 12px 8px; font-size: 11px;
  color: rgba(255,255,255,0.28); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
}
.gpVenueLine::before { content: "📍 "; }

/* Pick badge strip at bottom of card */
.gpPickStrip {
  display: flex; flex-direction: column; align-items: stretch;
  gap: 6px; padding: 7px 12px 9px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.gpYouPicked {
  font-size: 12px; font-weight: 900;
  color: rgba(255,255,255,0.85); letter-spacing: 0.03em;
}
.gpYouPicked.gpPending { color: rgba(255,210,60,0.9); }
.gpYouPicked.gpResultWin { color: rgba(100,255,160,0.9); }
.gpYouPicked.gpResultLoss { color: rgba(255,110,110,0.95); }
.gpNoPick  { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.3); }
.gpLocked  { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.3); }

/* Everyone's Picks / Everyone's Predictions — roster reveal */
.gpEveryoneDetails { padding: 0; }
.gpEveryoneSummary {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 900; letter-spacing: 0.03em;
  color: rgba(255,255,255,0.55);
  cursor: pointer; list-style: none; user-select: none;
  -webkit-tap-highlight-color: transparent;
  padding: 6px 12px; border-radius: 999px;
  background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.09);
  transition: background 120ms ease;
}
.gpEveryoneSummary:active { background: rgba(255,255,255,0.08); }
.gpEveryoneSummary::-webkit-details-marker { display: none; }
.gpEveryoneSummary::after { content: "▸"; margin-left: 2px; font-size: 9px; color: rgba(255,255,255,0.3); }
details[open] > .gpEveryoneSummary::after { content: "▾"; }
.gpEveryoneBody {
  margin-top: 8px; display: flex; flex-direction: column;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px; padding: 2px 12px;
}
.gpEveryoneLocked {
  font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em;
  color: rgba(255,255,255,0.28);
}

/* One player's pick/guess inside Everyone's Picks or Everyone's Predictions */
.gpRosterRow {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.gpRosterRow:last-child { border-bottom: none; }
.gpRosterAvatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10.5px; font-weight: 900; text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.12);
}
.gpRosterInfo { flex: 1; min-width: 0; }
.gpRosterName {
  font-size: 13px; font-weight: 800; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpRosterTeam {
  font-size: 11.5px; font-weight: 700; margin-top: 1px;
  color: rgba(255,255,255,0.5);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpRosterTeam.gpResultWin  { color: #5ddb8a; }
.gpRosterTeam.gpResultLoss { color: #e88888; }
.gpRosterSavedAt {
  font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.28);
  margin-top: 2px;
}
.gpRosterResult {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; line-height: 1;
}
.gpRosterResult.gpResultWin     { background: rgba(50,200,100,0.15); border: 1px solid rgba(50,200,100,0.3); color: #5ddb8a; }
.gpRosterResult.gpResultLoss    { background: rgba(220,60,60,0.12); border: 1px solid rgba(220,60,60,0.28); color: #e05555; }
.gpRosterResult.gpResultTie     { background: rgba(255,200,80,0.12); border: 1px solid rgba(255,200,80,0.28); color: rgba(255,210,100,0.9); }
.gpRosterResult.gpResultPending { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.3); }

/* Tiebreaker guess + current-leader highlight */
.gpRosterGuess {
  font-size: 16px; font-weight: 900; color: #fff;
  font-variant-numeric: tabular-nums; flex-shrink: 0;
}
.gpRosterRow.gpTbLeader {
  background: rgba(150,105,255,0.07);
  border-radius: 10px; margin: 0 -8px; padding: 9px 8px;
}
.gpRosterRow.gpTbLeader .gpRosterGuess { color: rgba(210,190,255,0.95); }
.gpTbLeaderBadge { font-size: 10px; font-weight: 900; color: rgba(210,190,255,0.8); margin-top: 1px; }

/* Win prob bar */
.gpWinProbBar {
  height: 3px; width: 100%; display: flex; overflow: hidden;
  border-radius: 0 0 10px 10px; margin-top: 0;
}
.gpWinProbAway { height: 100%; transition: width 600ms cubic-bezier(0.4,0,0.2,1); }
.gpWinProbHome { height: 100%; flex: 1; transition: width 600ms cubic-bezier(0.4,0,0.2,1); }

/* Save row */
.gpSaveRow {
  padding: 12px 14px 4px;
  display: flex; align-items: center; gap: 10px;
}

/* ══════════════════════════════════════════════
   LEADERBOARD  — redesigned
   ══════════════════════════════════════════════ */

/* Outer card */
.gpLeaderCard {
  border-radius: 18px;
  overflow: hidden;
  background: rgba(10,10,12,0.7);
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
}

/* Weekly recap — sits above the leaderboard once a week is fully final */
.gpRecapCard {
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 14px;
  background: linear-gradient(160deg, rgba(255,200,40,0.10) 0%, rgba(20,10,10,0.75) 55%);
  border: 1px solid rgba(255,210,60,0.28);
  box-shadow: 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
}
.gpRecapHeader {
  display: flex; align-items: baseline; gap: 8px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid rgba(255,210,60,0.18);
}
.gpRecapTitle {
  font-size: 16px; font-weight: 900; color: #fff; letter-spacing: 0.01em;
}
.gpRecapSub {
  font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: rgba(255,214,110,0.65);
}
.gpRecapBody {
  display: flex; flex-direction: column;
  padding: 6px 16px 14px;
}
.gpRecapRow {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpRecapRow:last-child { border-bottom: none; }
.gpRecapIcon { font-size: 17px; line-height: 1.3; flex-shrink: 0; }
.gpRecapText {
  font-size: 13px; font-weight: 600; line-height: 1.45;
  color: rgba(255,255,255,0.8);
}
.gpRecapText b { color: #fff; font-weight: 900; }

/* Head-to-Head weekly matchups */
.gpH2HMatchupsList {
  display: flex; flex-direction: column;
  padding: 10px 16px 16px;
}
.gpH2HMatchupRow {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpH2HMatchupRow:last-child { border-bottom: none; }
.gpH2HSide {
  flex: 1; min-width: 0;
  display: flex; align-items: center; gap: 8px;
}
.gpH2HSideRight { flex-direction: row-reverse; text-align: right; }
.gpH2HAvatar {
  width: 34px; height: 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900; letter-spacing: -0.3px;
  text-transform: uppercase; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.12);
}
.gpH2HName {
  font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.75);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gpH2HPts {
  font-size: 16px; font-weight: 900; color: rgba(255,255,255,0.6);
  flex-shrink: 0;
}
.gpH2HSide.gpH2HWinner .gpH2HName { color: #fff; }
.gpH2HSide.gpH2HWinner .gpH2HPts { color: #ffd76a; }
.gpH2HVs {
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
  flex-shrink: 0; padding: 0 2px;
}
.gpH2HByeRow { justify-content: flex-start; }
.gpH2HByeLabel {
  margin-left: auto;
  font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
  text-transform: uppercase; color: rgba(255,255,255,0.35);
}

/* Header bar */
.gpLeaderHeader {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; row-gap: 8px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  background: rgba(255,255,255,0.03);
}
.gpLeaderHeaderLeft {
  display: flex; flex-direction: column; gap: 2px;
}
.gpLeaderTitle {
  font-size: 17px; font-weight: 900; color: #fff;
  letter-spacing: 0.01em; line-height: 1;
}
.gpLeaderWeekLabel {
  font-size: 11px; font-weight: 700;
  color: rgba(255,255,255,0.38); letter-spacing: 0.08em;
  text-transform: uppercase; margin-top: 3px;
}

/* Kickoff countdown widget — shared by the leaderboard header (right
   side, while pre-lock) and league picker cards (bottom row) */
.gpCountdownWidget {
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 4px; flex-shrink: 0;
}
.gpCountdownLabel {
  font-size: 9.5px; font-weight: 800;
  color: rgba(255,255,255,0.4); letter-spacing: 0.09em;
  text-transform: uppercase; white-space: nowrap;
}
.gpCountdownClock {
  display: flex; align-items: baseline; gap: 5px;
}
.gpCdUnit {
  display: flex; align-items: baseline; gap: 1px;
  background: rgba(255,210,60,0.1);
  border: 1px solid rgba(255,210,60,0.22);
  border-radius: 7px;
  padding: 3px 6px 2px;
}
.gpCdVal {
  font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
  font-size: 14px; font-weight: 800; color: #ffd76a;
  font-variant-numeric: tabular-nums;
}
.gpCdUnitLabel {
  font-size: 9px; font-weight: 700; color: rgba(255,215,106,0.55);
  text-transform: lowercase;
}
.gpCountdownLive {
  font-size: 12px; font-weight: 800; color: rgba(120,220,150,0.85);
  white-space: nowrap;
}

/* League picker card — countdown sits on its own full-width row at the
   bottom of the card, below the icon/name/CTA row */
.gpLeagueCardCountdownRow {
  margin-top: 12px; padding-top: 12px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.gpLeagueCardCountdownRow .gpCountdownWidget {
  align-items: stretch;
}
.gpLeagueCardCountdownRow .gpCountdownLabel {
  text-align: left;
}
.gpLeagueCardCountdownRow .gpCountdownClock {
  justify-content: flex-start;
}
.gpLeagueCardCountdownRow .gpCountdownLive {
  text-align: left; display: block;
}

/* Podium — top 3 */
.gpLeaderPodium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  padding: 20px 12px 0;
  background: linear-gradient(180deg, rgba(255,200,40,0.04) 0%, transparent 100%);
}
.gpPodiumSlot {
  display: flex; flex-direction: column; align-items: center;
  flex: 1; max-width: 130px;
  position: relative;
}
/* 1st place sits higher visually */
.gpPodiumSlot[data-rank="1"] { order: 2; margin-bottom: 0; }
.gpPodiumSlot[data-rank="2"] { order: 1; margin-bottom: -12px; }
.gpPodiumSlot[data-rank="3"] { order: 3; margin-bottom: -20px; }

.gpPodiumAvatar {
  width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 21px; font-weight: 900; letter-spacing: -0.5px;
  text-transform: uppercase; flex-shrink: 0;
  border: 2px solid rgba(255,255,255,0.12);
  box-shadow: 0 4px 16px rgba(0,0,0,0.5);
  position: relative; z-index: 1;
}
.gpPodiumSlot[data-rank="1"] .gpPodiumAvatar {
  width: 62px; height: 62px; font-size: 25px;
  border-color: rgba(255,210,60,0.55);
  box-shadow: 0 0 0 3px rgba(255,210,60,0.18), 0 6px 20px rgba(0,0,0,0.55);
  background: linear-gradient(145deg, rgba(60,50,20,0.9), rgba(30,24,6,0.9));
}
.gpPodiumSlot[data-rank="2"] .gpPodiumAvatar {
  border-color: rgba(190,190,200,0.45);
  background: linear-gradient(145deg, rgba(40,40,50,0.9), rgba(20,20,26,0.9));
}
.gpPodiumSlot[data-rank="3"] .gpPodiumAvatar {
  border-color: rgba(180,110,60,0.45);
  background: linear-gradient(145deg, rgba(45,28,18,0.9), rgba(22,14,8,0.9));
}

.gpPodiumCrown {
  position: absolute; top: -18px; left: 50%; transform: translateX(-50%);
  font-size: 18px; line-height: 1;
  filter: drop-shadow(0 1px 4px rgba(255,180,0,0.5));
  animation: gpCrownBob 3s ease-in-out infinite;
}
@keyframes gpCrownBob {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50%       { transform: translateX(-50%) translateY(-3px); }
}

.gpPodiumName {
  margin-top: 8px;
  font-size: 12px; font-weight: 900; color: rgba(255,255,255,0.9);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%; text-align: center; letter-spacing: 0.02em;
}
.gpPodiumSlot[data-rank="1"] .gpPodiumName { font-size: 13px; color: #fff; }

.gpPodiumPoints {
  margin-top: 4px; margin-bottom: 8px;
  font-size: 13px; font-weight: 900; letter-spacing: 0.04em;
}
.gpPodiumSlot[data-rank="1"] .gpPodiumPoints { color: rgba(255,218,80,0.95); font-size: 15px; }
.gpPodiumSlot[data-rank="2"] .gpPodiumPoints { color: rgba(200,200,210,0.85); }
.gpPodiumSlot[data-rank="3"] .gpPodiumPoints { color: rgba(200,130,80,0.85); }

/* Podium platform blocks */
.gpPodiumBase {
  width: 100%; border-radius: 8px 8px 0 0;
  display: flex; align-items: center; justify-content: center;
  padding: 10px 6px; font-size: 18px; line-height: 1;
}
.gpPodiumSlot[data-rank="1"] .gpPodiumBase {
  height: 60px;
  background: linear-gradient(180deg, rgba(255,200,40,0.22) 0%, rgba(255,180,0,0.10) 100%);
  border: 1px solid rgba(255,210,60,0.25); border-bottom: none;
}
.gpPodiumSlot[data-rank="2"] .gpPodiumBase {
  height: 46px;
  background: linear-gradient(180deg, rgba(190,190,210,0.15) 0%, rgba(150,150,170,0.07) 100%);
  border: 1px solid rgba(190,190,210,0.18); border-bottom: none;
}
.gpPodiumSlot[data-rank="3"] .gpPodiumBase {
  height: 36px;
  background: linear-gradient(180deg, rgba(200,120,60,0.15) 0%, rgba(160,90,40,0.07) 100%);
  border: 1px solid rgba(200,120,60,0.18); border-bottom: none;
}

/* Full standings section label */
.gpStandingsDivider {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 14px 4px;
}
.gpStandingsDividerLine {
  flex: 1; height: 1px;
  background: rgba(255,255,255,0.07);
}
.gpStandingsDividerLabel {
  font-size: 10px; font-weight: 900; letter-spacing: 0.12em;
  text-transform: uppercase; color: rgba(255,255,255,0.25);
  white-space: nowrap;
}

/* Standings table — one compact table, no horizontal scroll */
.gpStandingsTableWrap { padding: 2px 10px 6px; }
.gpStandingsHint {
  font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.3);
  text-align: center; padding: 0 4px 8px;
}
.gpStandingsTable {
  width: 100%; table-layout: fixed; border-collapse: collapse;
}
.gpStandingsTable th {
  font-size: 11px; font-weight: 900; letter-spacing: 0.03em; text-transform: uppercase;
  color: rgba(255,255,255,0.4); text-align: center;
  padding: 0 3px 9px; white-space: nowrap;
}
.gpStandingsTable th.gpStName, .gpStandingsTable td.gpStName { text-align: left; }
.gpStandingsTable td {
  font-size: 14.5px; font-weight: 800; color: rgba(255,255,255,0.85);
  text-align: center; padding: 12px 3px;
  border-top: 1px solid rgba(255,255,255,0.07);
  font-variant-numeric: tabular-nums;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpStandingsRow { cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background 120ms ease; }
.gpStandingsRow:active td { background: rgba(255,255,255,0.06); }
.gpStandingsRow.gpStRowGold   td { background: rgba(255,200,40,0.06); }
.gpStandingsRow.gpStRowSilver td { background: rgba(190,190,210,0.05); }
.gpStandingsRow.gpStRowBronze td { background: rgba(200,120,60,0.05); }
.gpStRank { color: rgba(255,255,255,0.4); font-weight: 900; font-size: 13px; }
.gpStNameWrap { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.gpStNameText {
  color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  text-decoration: underline; text-decoration-style: dotted;
  text-decoration-color: rgba(255,255,255,0.25); text-underline-offset: 3px;
}
.gpStChevron { color: rgba(255,255,255,0.25); font-size: 15px; font-weight: 900; flex-shrink: 0; }
.gpStPts  { color: rgba(255,218,80,0.95); font-weight: 900; font-size: 16px; }
.gpStDogs { color: rgba(120,190,255,0.9); }
.gpStTbWins { color: rgba(190,150,255,0.95); font-weight: 900; }
.gpStTbBadge { font-size: 11px; margin-left: 4px; }
.gpTbUsedNote {
  font-size: 10.5px; font-weight: 700; color: rgba(150,105,255,0.7);
  text-align: center; padding: 8px 10px 0;
}

/* Legends — bottom of card */
.gpLeaderScoringFooter {
  display: flex; align-items: center; justify-content: center; gap: 8px 10px;
  flex-wrap: wrap;
  padding: 10px 16px 10px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.gpLeaderScoringFooter span {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.04em;
  color: rgba(255,255,255,0.3);
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px; padding: 3px 10px;
}
.gpColumnLegend {
  padding: 0 16px 14px;
  font-size: 10.5px; font-weight: 600; line-height: 1.6;
  color: rgba(255,255,255,0.3); text-align: center;
}
.gpColumnLegend b { color: rgba(255,255,255,0.5); font-weight: 900; }

/* Draft badge */
.gpDraftBadge {
  display: inline-flex; align-items: center;
  background: rgba(255,200,0,0.14); border: 1px solid rgba(255,200,0,0.30);
  color: rgba(255,230,170,0.95); font-weight: 950;
  padding: 4px 10px; border-radius: 999px;
  font-size: 11px; letter-spacing: 0.06em; white-space: nowrap;
}

/* Empty / notice */
.gpEmpty {
  padding: 40px 24px; text-align: center;
  color: rgba(255,255,255,0.38); font-size: 15px; font-weight: 600;
}
.gpNotice {
  padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  font-size: 13px; font-weight: 700;
  color: rgba(255,255,255,0.5);
}

/* ══════════════════════════════════════════════
   PRE-LOCK PROGRESS — leaderboard before any game is final
   ══════════════════════════════════════════════ */
.gpPreLockList {
  display: flex; flex-direction: column;
  gap: 14px;
  padding: 18px 16px 22px;
}
.gpPreLockRow {
  display: flex; align-items: center; gap: 12px;
}
.gpPreLockAvatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900; letter-spacing: -0.3px;
  text-transform: uppercase; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.12);
}
.gpPreLockInfo {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 5px;
}
.gpPreLockName {
  font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gpPreLockBarWrap {
  position: relative;
  height: 22px; border-radius: 999px; overflow: hidden;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.1);
}
.gpPreLockBarFill {
  position: absolute; top: 0; bottom: 0; left: 0; width: 0%;
  background: linear-gradient(90deg, rgba(120,150,255,0.55), rgba(130,175,255,0.85));
  transition: width 0.35s ease, background 0.35s ease;
}
.gpPreLockBarFillDone {
  background: linear-gradient(90deg, #1a8f5c, #2ecf82);
}
.gpPreLockBarLabel {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.02em;
  color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.65);
  white-space: nowrap; padding: 0 8px;
}

/* ══════════════════════════════════════════════
   SPREAD CHIP (ATS weeks)
   ══════════════════════════════════════════════ */
.gpSpreadChip {
  display: inline-block; margin-left: 6px;
  font-size: 11px; font-weight: 800;
  color: rgba(255,255,255,0.4);
  vertical-align: middle;
}
.gpSpreadChip.gpSpreadFav { color: rgba(255,180,80,0.85); }

/* ══════════════════════════════════════════════
   VIEW TOGGLE (This Week / Season)
   ══════════════════════════════════════════════ */
.gpViewToggle {
  display: flex; gap: 4px; padding: 3px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 999px;
}
.gpViewToggleBtn {
  flex: 1; text-align: center; padding: 8px 12px;
  border-radius: 999px; border: none; background: none;
  color: rgba(255,255,255,0.5); font-size: 13px; font-weight: 800;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpViewToggleBtn.gpViewToggleActive {
  background: rgba(255,255,255,0.12); color: #fff;
}

/* ══════════════════════════════════════════════
   TIEBREAKER CARD
   ══════════════════════════════════════════════ */
.gpTiebreakerCard {
  background: rgba(140,90,255,0.07);
  border: 1px solid rgba(160,120,255,0.22);
  border-radius: 14px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 8px;
}
.gpTiebreakerTitle { font-size: 13px; font-weight: 900; color: rgba(210,190,255,0.9); }
.gpTiebreakerSub { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.5); }
.gpTiebreakerOU {
  display: inline-flex; align-items: center; gap: 5px;
  margin-top: 4px; padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px; font-weight: 800; letter-spacing: 0.01em;
  color: rgba(220,200,255,0.85);
  background: rgba(150,100,255,0.12);
  border: 1px solid rgba(150,100,255,0.3);
}
.gpTiebreakerRule { font-size: 11px; font-weight: 600; color: rgba(210,190,255,0.6); }
.gpTiebreakerRule b { color: rgba(220,200,255,0.9); font-weight: 900; }
.gpTiebreakerRow { display: flex; align-items: center; gap: 10px; }
.gpTiebreakerInput {
  width: 110px; padding: 9px 12px; border-radius: 10px;
  background: rgba(0,0,0,0.22); border: 1px solid rgba(255,255,255,0.14);
  color: inherit; font-weight: 800; font-size: 16px; outline: none;
}
.gpTiebreakerInput:disabled { opacity: 0.5; }
.gpTiebreakerActual { font-size: 12px; font-weight: 800; color: rgba(120,220,160,0.85); }

/* ══════════════════════════════════════════════
   LEAGUE ANNOUNCEMENT BANNER — admin-authored, top of the week view
   ══════════════════════════════════════════════ */
.gpAnnouncementBanner {
  display: flex; align-items: flex-start; gap: 12px;
  margin-bottom: 14px; padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(160deg, rgba(40,140,255,0.16) 0%, rgba(12,16,26,0.8) 60%);
  border: 1px solid rgba(90,170,255,0.4);
  box-shadow: 0 8px 26px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
}
.gpAnnouncementIcon { font-size: 22px; line-height: 1.2; flex-shrink: 0; }
.gpAnnouncementBody { min-width: 0; }
.gpAnnouncementTitle {
  font-size: 15px; font-weight: 900; color: #fff; letter-spacing: 0.01em;
}
.gpAnnouncementMessage {
  margin-top: 4px; font-size: 13px; font-weight: 600; line-height: 1.45;
  color: rgba(255,255,255,0.82);
}

/* ══════════════════════════════════════════════
   LOCK REMINDER BANNER
   ══════════════════════════════════════════════ */
.gpLockBanner {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px;
  background: linear-gradient(135deg, rgba(220,40,40,0.18) 0%, rgba(30,10,10,0.55) 100%);
  border: 1px solid rgba(255,90,80,0.5);
  border-radius: 14px; padding: 12px 16px;
  font-size: 13.5px; font-weight: 700; color: rgba(255,225,220,0.95);
  box-shadow: 0 0 0 1px rgba(255,90,80,0.08), 0 6px 20px rgba(200,30,30,0.25);
  animation: gpLockBannerPulse 2.4s ease-in-out infinite;
}
.gpLockBanner b { color: #fff; font-weight: 950; }
.gpLockBanner .gpLockBannerIcon { font-size: 17px; flex-shrink: 0; }
@keyframes gpLockBannerPulse {
  0%, 100% { box-shadow: 0 0 0 1px rgba(255,90,80,0.08), 0 6px 20px rgba(200,30,30,0.25); }
  50%      { box-shadow: 0 0 0 1px rgba(255,90,80,0.18), 0 6px 26px rgba(200,30,30,0.4); }
}
@media (prefers-reduced-motion: reduce) {
  .gpLockBanner { animation: none; }
}

/* ══════════════════════════════════════════════
   ADMIN — date range / mode controls
   ══════════════════════════════════════════════ */
.gpAdminDateRange { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.gpAdminInlineLabel { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.4); }
.gpAdminPriorityBadge {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.02em;
  color: rgba(255,210,110,0.9);
  background: rgba(255,180,40,0.12);
  border: 1px solid rgba(255,180,40,0.25);
  border-radius: 999px; padding: 2px 8px; white-space: nowrap;
}
.gpAdminOddsHint {
  font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.42);
  white-space: nowrap;
}
.gpRemoveGameBtn {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,60,60,0.12); border: 1px solid rgba(255,80,80,0.3);
  color: rgba(255,140,140,0.9); font-size: 13px; line-height: 1;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpRemoveGameBtn:active { background: rgba(255,60,60,0.22); }

/* ══════════════════════════════════════════════
   PICKS SECTION HEADERS (Outright Winners / Against the
   Spread / Tiebreaker — dividers between pick groups)
   ══════════════════════════════════════════════ */
.gpPicksSectionHeader {
  display: flex; align-items: center; gap: 12px;
  padding: 20px 2px 6px;
}
.gpPicksSectionLine { flex: 1; height: 2px; border-radius: 2px; background: rgba(255,255,255,0.08); }
.gpPicksSectionLabel {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 900; letter-spacing: 0.05em;
  text-transform: uppercase; white-space: nowrap;
  padding: 6px 16px; border-radius: 999px;
}
/* Outright Winners — red */
.gpPicksSection-outright .gpPicksSectionLabel {
  color: #ffe3e3;
  background: linear-gradient(135deg, rgba(214,45,70,0.95), rgba(150,20,45,0.95));
  box-shadow: 0 4px 16px rgba(209,38,63,0.4);
}
.gpPicksSection-outright .gpPicksSectionLine { background: rgba(209,38,63,0.35); }
/* Against the Spread — green */
.gpPicksSection-ats .gpPicksSectionLabel {
  color: #e7fff3;
  background: linear-gradient(135deg, rgba(50,208,140,0.95), rgba(20,150,95,0.95));
  box-shadow: 0 4px 16px rgba(46,204,135,0.4);
}
.gpPicksSection-ats .gpPicksSectionLine { background: rgba(46,204,135,0.35); }
/* Tiebreaker — purple */
.gpPicksSection-tiebreaker .gpPicksSectionLabel {
  color: #f4eeff;
  background: linear-gradient(135deg, rgba(155,105,255,0.95), rgba(110,60,220,0.95));
  box-shadow: 0 4px 16px rgba(150,100,255,0.4);
}
.gpPicksSection-tiebreaker .gpPicksSectionLine { background: rgba(150,100,255,0.35); }

.gpPicksSectionSubtitle {
  padding: 2px 4px 4px;
  font-size: 12.5px; font-weight: 600; line-height: 1.45;
  color: rgba(255,255,255,0.5);
}
.gpPicksSectionSubtitle b { color: rgba(255,255,255,0.75); font-weight: 800; }

/* ══════════════════════════════════════════════
   WEEK PAGER (replaces the old week <select>)
   ══════════════════════════════════════════════ */
.gpWeekPager {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 2px;
}
.gpWeekPagerArrow {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.85); font-size: 18px; font-weight: 900;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpWeekPagerArrow:active { background: rgba(255,255,255,0.12); }
.gpWeekPagerArrow:disabled { opacity: 0.25; cursor: default; pointer-events: none; }
.gpWeekPagerLabel { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.gpWeekPagerTitle { font-size: 17px; font-weight: 900; color: #fff; letter-spacing: 0.01em; }
.gpWeekPagerSub { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.38); text-transform: uppercase; letter-spacing: 0.06em; }

/* ══════════════════════════════════════════════
   LEAGUE PICKER
   ══════════════════════════════════════════════ */
.gpLeaguePickerGrid {
  display: flex; flex-direction: column; gap: 10px;
}
.gpLeagueCard {
  display: flex; flex-direction: column;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.09);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpLeagueCard:active { background: rgba(255,255,255,0.08); }
.gpLeagueCard.gpLeagueArchived { opacity: 0.5; }
.gpLeagueCardMain { display: flex; align-items: center; gap: 12px; }
.gpLeagueCardIcon {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; background: rgba(187,0,0,0.12); border: 1px solid rgba(187,0,0,0.25);
}
.gpLeagueCardInfo { flex: 1; min-width: 0; }
.gpLeagueCardName { font-size: 16px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gpLeagueActivePill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase;
  color: #17301f;
  background: linear-gradient(135deg, rgba(120,255,170,0.95), rgba(60,220,140,0.95));
  border-radius: 999px; padding: 3px 9px 3px 7px;
  box-shadow: 0 2px 8px rgba(60,220,140,0.35);
}
.gpLeagueActiveDot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #0f3d20;
  animation: gpLivePulse 1.2s ease-in-out infinite;
}
.gpLeagueCardMeta { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); margin-top: 2px; }
.gpLeagueCardCta {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12.5px; font-weight: 900; letter-spacing: 0.01em;
  white-space: nowrap;
}
.gpLeagueCardCtaJoin {
  color: #fff5ea;
  background: linear-gradient(135deg, #ff5a3c 0%, #c81e1e 100%);
  box-shadow: 0 4px 16px rgba(200,30,30,0.4);
}
.gpLeagueCardCtaVisit {
  color: rgba(255,255,255,0.65);
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
}
.gpLeagueCardCtaGroup {
  flex-shrink: 0;
  display: flex; flex-direction: column; align-items: stretch; gap: 6px;
}
.gpLeagueCardCtaGroup .gpLeagueCardCta { text-align: center; }
.gpLeagueCardCtaInvite {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: 999px; text-align: center;
  font-size: 11.5px; font-weight: 800; letter-spacing: 0.01em;
  white-space: nowrap;
  color: rgba(140,200,255,0.9);
  background: rgba(70,150,255,0.1);
  border: 1px dashed rgba(90,170,255,0.4);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpLeagueCardCtaInvite:active { background: rgba(70,150,255,0.2); }
.gpLeagueCardGear {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 15px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpLeagueCreateTile {
  display: flex; align-items: center; justify-content: center;
  gap: 8px; padding: 16px; border-radius: 16px;
  border: 1px dashed rgba(255,255,255,0.25);
  color: rgba(255,255,255,0.6); font-weight: 800; font-size: 14px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpLeagueCreateTile:active { background: rgba(255,255,255,0.05); }

/* ══════════════════════════════════════════════
   LEAGUE SETTINGS FORM
   ══════════════════════════════════════════════ */
.gpLeagueSettingsForm {
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px; border-radius: 16px;
  background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.09);
}
.gpLeagueSettingsRow { display: flex; flex-direction: column; gap: 6px; }
.gpLeagueSettingsLabel { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); }
.gpLeagueSettingsInput {
  width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px;
  background: rgba(0,0,0,0.18); border: 1px solid rgba(255,255,255,0.12);
  color: inherit; font-weight: 700; font-size: 16px; outline: none;
}
.gpLeagueSettingsCheckRow { display: flex; align-items: center; gap: 10px; }
.gpAnnouncementSlot {
  padding: 10px 0 12px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.gpAnnouncementSlot:last-child { border-bottom: none; padding-bottom: 0; }
.gpLeagueSettingsActions { display: flex; gap: 10px; margin-top: 4px; }

/* Head-to-Head roster: registered-player checklist */
.gpH2HPlayerChecklist {
  display: flex; flex-direction: column; gap: 2px;
  max-height: 220px; overflow-y: auto;
  border-radius: 12px; background: rgba(0,0,0,0.14);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 4px 6px;
}
.gpH2HPlayerCheckRow {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 8px; border-radius: 8px;
  font-size: 14px; font-weight: 700;
}
.gpH2HPlayerCheckRow:active { background: rgba(255,255,255,0.05); }

/* ══════════════════════════════════════════════
   PLAYER PICKS OVERLAY
   ══════════════════════════════════════════════ */
.gpPicksOverlayBackdrop {
  position: fixed; inset: 0; z-index: 999;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: flex-end; justify-content: center;
  opacity: 0;
  transition: opacity 220ms cubic-bezier(0.16,1,0.3,1);
  pointer-events: none;
}
.gpPicksOverlayBackdrop.gpOverlayVisible {
  opacity: 1;
  pointer-events: all;
}
.gpPicksOverlaySheet {
  width: 100%; max-width: 480px;
  background: #17161a;
  border: 1px solid rgba(255,255,255,0.10);
  border-bottom: none;
  border-radius: 22px 22px 0 0;
  padding: 0 0 calc(env(safe-area-inset-bottom) + 24px);
  box-shadow: 0 -8px 48px rgba(0,0,0,0.7);
  transform: translateY(32px);
  transition: transform 260ms cubic-bezier(0.16,1,0.3,1);
  max-height: 82dvh;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.gpPicksOverlayBackdrop.gpOverlayVisible .gpPicksOverlaySheet {
  transform: translateY(0);
}

/* Drag handle */
.gpOverlayHandle {
  width: 40px; height: 4px; border-radius: 999px;
  background: rgba(255,255,255,0.18);
  margin: 12px auto 0;
  flex-shrink: 0;
}

/* Header row inside sheet */
.gpOverlayHeader {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
}
.gpOverlayTitle {
  display: flex; align-items: center; gap: 10px;
}
.gpOverlayAvatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 900; text-transform: uppercase;
  flex-shrink: 0;
}
.gpOverlayName {
  font-size: 17px; font-weight: 900; color: #fff; line-height: 1.2;
}
.gpOverlaySubtitle {
  font-size: 11px; font-weight: 700;
  color: rgba(255,255,255,0.38); letter-spacing: 0.06em;
  text-transform: uppercase; margin-top: 2px;
}
.gpOverlayCloseBtn {
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  color: rgba(255,255,255,0.7);
  font-size: 18px; line-height: 1;
  transition: background 150ms ease;
  -webkit-tap-highlight-color: transparent;
}
.gpOverlayCloseBtn:active { background: rgba(255,255,255,0.16); }

/* Scrollable picks list */
.gpOverlayBody {
  overflow-y: auto; -webkit-overflow-scrolling: touch;
  flex: 1;
  padding: 10px 14px 0;
  display: flex; flex-direction: column; gap: 6px;
}
.gpOverlayBody::-webkit-scrollbar { display: none; }

/* Each pick row */
.gpOverlayPickRow {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
}
.gpOverlayPickTeamLogo {
  width: 36px; height: 36px; object-fit: contain;
  border-radius: 8px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10); padding: 3px;
  flex-shrink: 0;
}
.gpOverlayPickTeamLogoPlaceholder {
  width: 36px; height: 36px; border-radius: 8px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.6);
  flex-shrink: 0;
}
.gpOverlayPickTeamName {
  flex: 1; min-width: 0;
  font-size: 15px; font-weight: 800; color: #ddd;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpOverlayPickGameLabel {
  font-size: 10px; font-weight: 700;
  color: rgba(255,255,255,0.3); letter-spacing: 0.04em;
  margin-top: 2px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.gpOverlayPickResult {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; line-height: 1;
}
.gpOverlayPickResult.gpResultWin {
  background: rgba(50,200,100,0.15);
  border: 1px solid rgba(50,200,100,0.3);
  color: #5ddb8a;
}
.gpOverlayPickResult.gpResultLoss {
  background: rgba(220,60,60,0.12);
  border: 1px solid rgba(220,60,60,0.28);
  color: #e05555;
}
.gpOverlayPickResult.gpResultTie {
  background: rgba(255,200,80,0.12);
  border: 1px solid rgba(255,200,80,0.28);
  color: rgba(255,210,100,0.9);
  font-size: 17px;
}
.gpOverlayPickResult.gpResultPending {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.3);
}

/* Empty state inside overlay */
.gpOverlayEmpty {
  padding: 32px 16px; text-align: center;
  color: rgba(255,255,255,0.35); font-size: 14px; font-weight: 700;
}

/* ══════════════════════════════════════════════
   JOIN LEAGUE OVERLAY (built on the shared overlay shell above)
   ══════════════════════════════════════════════ */
.gpJoinHeaderIcon {
  width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; background: rgba(187,0,0,0.16); border: 1px solid rgba(187,0,0,0.3);
}
.gpJoinStatsRow {
  display: flex; gap: 10px;
  padding: 4px 2px 14px;
}
.gpJoinStatTile {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 14px 10px;
  border-radius: 14px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.09);
}
.gpJoinStatNum {
  font-size: 22px; font-weight: 950; color: #fff; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.gpJoinStatLabel {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  color: rgba(255,255,255,0.42);
}
.gpJoinMembersLabel {
  font-size: 11px; font-weight: 900; letter-spacing: 0.07em; text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  padding: 2px 4px 8px;
}
.gpJoinMembersList {
  display: flex; flex-direction: column; gap: 6px;
}
.gpJoinMemberRow {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(255,255,255,0.06);
}
.gpJoinMemberAvatar {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 900; letter-spacing: -0.3px; text-transform: uppercase;
}
.gpJoinMemberName {
  font-size: 13.5px; font-weight: 800; color: rgba(255,255,255,0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gpJoinMembersEmpty {
  padding: 22px 14px; text-align: center; border-radius: 14px;
  background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.42); font-size: 13px; font-weight: 700;
}
.gpJoinCtaRow {
  flex-shrink: 0;
  padding: 14px 18px calc(env(safe-area-inset-bottom) + 6px);
  border-top: 1px solid rgba(255,255,255,0.07);
  background: rgba(23,22,26,0.96);
}
.gpJoinCtaBtn {
  width: 100%;
  padding: 15px 18px;
  border: 0; border-radius: 16px;
  font-size: 16px; font-weight: 900; letter-spacing: 0.01em;
  color: #fff5ea;
  background: linear-gradient(135deg, #ff5a3c 0%, #c81e1e 100%);
  box-shadow: 0 8px 26px rgba(200,30,30,0.45), inset 0 1px 0 rgba(255,255,255,0.18);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: transform 120ms ease;
}
.gpJoinCtaBtn:active { transform: scale(0.98); }
.gpJoinCtaBtn:disabled { opacity: 0.6; }

    `;
    document.head.appendChild(style);
  })();

  // ─── Escape helper ─────────────────────────────────────────────
  function esc(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ─── Format helpers ─────────────────────────────────────────────
  function fmtTime(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function fmtDate(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    const weekday  = d.toLocaleDateString(undefined, { weekday: "long" });
    const monthDay = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${weekday} ${monthDay}`;
  }
  // Compact "Sat 9/6" form — used where space is tight (admin picker list).
  function fmtShortDate(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    return `${weekday} ${d.getMonth() + 1}/${d.getDate()}`;
  }
  // "9/6, 5:47pm" — when a pick/prediction was last saved, for the
  // Everyone's Picks / Everyone's Predictions rosters.
  function fmtSavedAt(ts) {
    const ms = ts?.toMillis ? ts.toMillis() : (Number(ts?.seconds) ? Number(ts.seconds) * 1000 : 0);
    if (!ms) return "";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    let h = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return `${d.getMonth() + 1}/${d.getDate()}, ${h}:${min}${ampm}`;
  }
  function startMs(g) {
    return g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
  }
  function safeTeam(t) {
    const nm = String(t?.name || "").trim();
    const rk = t?.rank > 0 && t.rank <= 25 ? `#${t.rank} ` : "";
    return (rk + nm).trim() || "Team";
  }
  function safeRecord(t) { return String(t?.record || "").trim(); }
  function safeAbbr(t)   { return String(t?.abbr   || t?.name || "").slice(0, 4); }

  // The over/under is persisted on the game doc as `oddsOU` (see
  // gpAdminAddSelectedGamesToWeek's buildOdds() capture) — this used to
  // only check a `g.odds.overUnder` path that was never actually
  // written anywhere, so the O/U silently never showed even though it
  // was sitting right there on the game the whole time.
  function safeOverUnder(g) {
    const hydrated = String(g?.__odds?.overUnder || "").trim();
    const legacy    = String(g?.oddsOU || g?.odds?.overUnder || "").trim();
    return hydrated || legacy;
  }

  function safeOddsLine(g) {
    const hydratedDetails = String(g?.__odds?.details || "").trim();
    const legacyDetails   = String(g?.oddsDetails || g?.odds?.details || "").trim();
    const d  = hydratedDetails || legacyDetails;
    const ou = safeOverUnder(g);
    const parts = [];
    if (d)  parts.push(`Fav: ${d}`);
    if (ou) parts.push(`O/U ${ou}`);
    return parts.join("  ·  ");
  }

  // ─── Spread chip (ATS weeks only) ─────────────────────────────────
  function spreadChipHTML(g, side) {
    const val     = Number(g?.spreadValue);
    const favSide = String(g?.spreadFavoredSide || "").toLowerCase();
    if (!Number.isFinite(val) || !(favSide === "home" || favSide === "away")) return "";
    const isFav = side === favSide;
    const num   = val % 1 === 0 ? val.toFixed(0) : String(val);
    const text  = isFav ? `-${num}` : `+${num}`;
    return `<span class="gpSpreadChip${isFav ? " gpSpreadFav" : ""}">${esc(text)}</span>`;
  }

  // ─── Logo / score HTML helpers ──────────────────────────────────
  function logoImg(url, abbr) {
    if (!url) return `<div class="gpTeamLogoPlaceholder">${esc(abbr.slice(0,3))}</div>`;
    return `<img class="gpTeamLogo" src="${esc(url)}" alt="${esc(abbr)}" loading="lazy" width="40" height="40" onerror="this.style.display='none'"/>`;
  }
  function scoreHTML(sc, isWinner, isLoser) {
    const cls = isWinner ? " gpWinner" : isLoser ? " gpLoser" : "";
    return `<span class="gpScore${cls}">${esc(sc)}</span>`;
  }

  // ─── Status line HTML ────────────────────────────────────────────
  function buildStatusHTML(g) {
    const live   = g?.__live || g?.live || null;
    const state  = String(live?.state || "").toLowerCase();
    const detail = String(live?.detail || "").trim();
    if (state === "in") {
      return `<div class="gpStatusLive">LIVE${detail ? " · " + esc(detail) : ""}</div>`;
    }
    if (state === "post") {
      const fd = detail && detail.toLowerCase() !== "final" && !/^\d+:\d+$/.test(detail) ? detail : "";
      return `<div class="gpStatusFinal">Final${fd ? " · " + esc(fd) : ""}</div>`;
    }
    const ms = startMs(g);
    const timeStr = ms ? fmtTime(ms) : "";
    return `<div class="gpStatusPre">${esc(timeStr || "Scheduled")}</div>`;
  }

  // ─── Everyone's picks lazy panel ─────────────────────────────────
  if (!window.__GP_EVERYONE_BOUND) {
    window.__GP_EVERYONE_BOUND = true;
    document.addEventListener("toggle", async (e) => {
      const det = e.target;
      if (!det || det.tagName !== "DETAILS") return;
      if (det.getAttribute("data-gpeveryone") !== "1") return;
      if (!det.open) return;
      const weekId  = String(det.getAttribute("data-weekid")  || "");
      const eventId = String(det.getAttribute("data-eid")     || "");
      const bodyId  = `gpEv_${weekId}_${eventId}`;
      const bodyEl  = document.getElementById(bodyId);
      if (!bodyEl || bodyEl.getAttribute("data-loaded") === "1") return;
      bodyEl.innerHTML = `<div class="muted" style="font-size:12px;padding:8px 0">Loading…</div>`;
      try {
        const Data = () => window.GP_Data || {};
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db  = firebase.firestore();
        const all = await (Data().gpEnsureAllPicksForWeek || (async () => ({})))(db, weekId);
        const arr = Array.isArray(all?.[eventId]) ? all[eventId] : [];
        const awayName = String(det.getAttribute("data-away") || "Away");
        const homeName = String(det.getAttribute("data-home") || "Home");

        // Look up the live game object for win/loss coloring — same
        // grading helpers the leaderboard and player overlay use, so
        // every place a pick's result shows up always agrees.
        const games      = Array.isArray(window.__gpCurrentGames) ? window.__gpCurrentGames : [];
        const g          = games.find(gg => String(gg?.eventId || gg?.id || "") === eventId) || null;
        const atsIdSet   = new Set((Array.isArray(window.__gpCurrentAtsEventIds) ? window.__gpCurrentAtsEventIds : []).map(String));
        const isAtsGame  = atsIdSet.has(eventId);
        const isFinalG   = String(g?.__live?.state || "").toLowerCase() === "post";

        if (!arr.length) {
          bodyEl.innerHTML = `<div class="muted" style="font-size:12px;padding:8px 0">No picks yet.</div>`;
        } else {
          bodyEl.innerHTML = arr.map(p => {
            const nm    = String(p?.name || "Someone");
            const side  = String(p?.side || "");
            const team  = side === "away" ? awayName : side === "home" ? homeName : side;
            const saved = fmtSavedAt(p?.updatedAt);
            const { bg, color } = avatarStyle(nm);

            let resultCls = "gpResultPending", resultIcon = "·";
            if (g && isFinalG && side) {
              if (isAtsGame) {
                const grade = typeof Data().gpGradeAtsForGame === "function" ? Data().gpGradeAtsForGame(g) : { ok: false };
                if (grade.ok) {
                  if (grade.pushed) { resultCls = "gpResultTie"; resultIcon = "🤝"; }
                  else { const won = side === grade.coverSide; resultCls = won ? "gpResultWin" : "gpResultLoss"; resultIcon = won ? "✓" : "✕"; }
                }
              } else {
                const winningSide = typeof Data().gpGetGameWinningSide === "function" ? Data().gpGetGameWinningSide(g) : "";
                if (winningSide) { const won = side === winningSide; resultCls = won ? "gpResultWin" : "gpResultLoss"; resultIcon = won ? "✓" : "✕"; }
                else { resultCls = "gpResultTie"; resultIcon = "🤝"; }
              }
            }

            return `
<div class="gpRosterRow">
  <div class="gpRosterAvatar" style="background:${bg};color:${color}">${esc(initials(nm))}</div>
  <div class="gpRosterInfo">
    <div class="gpRosterName">${esc(nm)}</div>
    <div class="gpRosterTeam ${resultCls}">${esc(team)}</div>
    ${saved ? `<div class="gpRosterSavedAt">${esc(nm)} last saved at ${esc(saved)}</div>` : ""}
  </div>
  <div class="gpRosterResult ${resultCls}">${resultIcon}</div>
</div>`;
          }).join("");
        }
        try { window.replaceMichiganText && window.replaceMichiganText(bodyEl, "The Team Up North"); } catch {}
        bodyEl.setAttribute("data-loaded", "1");
      } catch {
        const bodyEl2 = document.getElementById(bodyId);
        if (bodyEl2) bodyEl2.innerHTML = `<div class="muted" style="font-size:12px;padding:8px 0">Couldn't load picks.</div>`;
      }
    }, true);
  }

  // ─── Single game card ────────────────────────────────────────────
  function buildGameCard(g, weekId, myMap, pendingGet, isAts, isAdmin) {
    const eventId = String(g?.eventId || g?.id || "");
    if (!eventId) return "";

    const away = g?.awayTeam || { name: g?.awayName || "Away", abbr: "", logo: g?.awayLogo || "", rank: g?.awayRank, record: g?.awayRecord };
    const home = g?.homeTeam || { name: g?.homeName || "Home", abbr: "", logo: g?.homeLogo || "", rank: g?.homeRank, record: g?.homeRecord };

    const awayLogo = String(g?.awayLogo || away?.logo || "").trim();
    const homeLogo = String(g?.homeLogo || home?.logo || "").trim();

    const ms     = startMs(g);
    const now    = Date.now();
    const locked = ms > 0 && now >= ms;

    const live     = g?.__live || g?.live || null;
    const state    = String(live?.state || "").toLowerCase();
    const isLive   = state === "in";
    const isFinal  = state === "post";

    const awayScoreRaw = live?.awayScore;
    const homeScoreRaw = live?.homeScore;
    const showScores   = (isLive || isFinal) &&
                         awayScoreRaw != null && awayScoreRaw !== "" &&
                         homeScoreRaw != null && homeScoreRaw !== "";

    const awayScore  = showScores ? String(awayScoreRaw) : "";
    const homeScore  = showScores ? String(homeScoreRaw) : "";
    const awayNum    = showScores ? Number(awayScoreRaw) : 0;
    const homeNum    = showScores ? Number(homeScoreRaw) : 0;
    const awayWinner = isFinal && awayNum > homeNum;
    const homeWinner = isFinal && homeNum > awayNum;

    const pending    = typeof pendingGet === "function" ? pendingGet(eventId) : "";
    const saved      = String(myMap?.[eventId]?.side || "");
    const my         = pending || saved;
    const isPending  = !!pending && pending !== saved;
    const hasPick    = !!my;

    const awayActive = my === "away";
    const homeActive = my === "home";
    const awayFade   = hasPick && !awayActive;
    const homeFade   = hasPick && !homeActive;

    // — did my pick win, lose, or push, once the game is final? —
    // Grades the same way the leaderboard does: straight games by final
    // score, the ATS game by its stored spread — so a team can lose the
    // game outright but still be a correct (green) ATS cover. Until the
    // game is final, or if it's a push/tie, there's no verdict yet, so
    // the pick just shows as picked (neutral gray) rather than green.
    let myPickResult = "unresolved";
    if (hasPick && isFinal) {
      const GP_Data = window.GP_Data || {};
      if (isAts) {
        const grade = typeof GP_Data.gpGradeAtsForGame === "function" ? GP_Data.gpGradeAtsForGame(g) : { ok: false };
        if (grade.ok) myPickResult = grade.pushed ? "push" : (my === grade.coverSide ? "win" : "loss");
      } else {
        const winningSide = typeof GP_Data.gpGetGameWinningSide === "function" ? GP_Data.gpGetGameWinningSide(g) : "";
        if (winningSide) myPickResult = (my === winningSide) ? "win" : "loss";
        else if (showScores) myPickResult = "push"; // tie
      }
    }
    function pickResultCls(isActive) {
      if (!isActive) return "";
      if (myPickResult === "win")  return " gpPickResultWin";
      if (myPickResult === "loss") return " gpPickResultLoss";
      return " gpPickNeutral"; // unresolved or push
    }

    let cardCls = "gpScoreCard";
    if (isLive) cardCls += " gpCardLive";

    // Left border edge is a type indicator, not a sport color: red for
    // outright/straight-up games, green for the designated ATS game(s).
    const borderColor = isAts ? "#2ecc87" : "#d1263f";

    const oddsLine   = safeOddsLine(g);
    const venueLine  = String(g?.venueLine || "").trim();
    const statusHTML = buildStatusHTML(g);
    const kickoffTime = ms ? fmtTime(ms) : "";
    const kickoffDate = ms ? fmtDate(ms) : "";

    return `
<div class="${cardCls}" style="border-left-color:${esc(borderColor)}">
  <div class="gpCardHeader">
    ${statusHTML}
    <div class="gpCardHeaderRight">
      ${oddsLine ? `<div class="gpOddsLine">${esc(oddsLine)}</div>` : ""}
      ${isAdmin ? `<button type="button" class="gpRemoveGameBtn" data-gpaction="adminRemoveGame" data-eid="${esc(eventId)}" data-weekid="${esc(weekId)}" title="Remove from week" aria-label="Remove game from week">✕</button>` : ""}
    </div>
  </div>
  ${kickoffDate || kickoffTime ? `
  <div style="padding:4px 12px 0;display:flex;justify-content:space-between;gap:8px">
    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35)">${esc(kickoffDate)}</div>
    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35)">${esc(kickoffTime)}</div>
  </div>` : ""}
  ${venueLine ? `<div class="gpVenueLine">${esc(venueLine)}</div>` : ""}
  <div class="gpMatchup">
    <button class="gpTeamPickBtn${pickResultCls(awayActive)}${awayFade ? " gpFaded" : ""}"
      type="button"
      ${locked ? "disabled" : ""}
      data-gppick="away" data-eid="${esc(eventId)}" data-slate="${esc(weekId)}">
      ${logoImg(awayLogo, safeAbbr(away))}
      <div class="gpTeamInfo">
        <div class="gpTeamName">${esc(safeTeam(away))}${isAts ? spreadChipHTML(g, "away") : ""}</div>
        ${safeRecord(away) ? `<div class="gpTeamMeta">${esc(safeRecord(away))}</div>` : ""}
      </div>
      ${showScores ? scoreHTML(awayScore, awayWinner, isFinal && !awayWinner) : ""}
    </button>
    <button class="gpTeamPickBtn${pickResultCls(homeActive)}${homeFade ? " gpFaded" : ""}"
      type="button"
      ${locked ? "disabled" : ""}
      data-gppick="home" data-eid="${esc(eventId)}" data-slate="${esc(weekId)}">
      ${logoImg(homeLogo, safeAbbr(home))}
      <div class="gpTeamInfo">
        <div class="gpTeamName">${esc(safeTeam(home))}${isAts ? spreadChipHTML(g, "home") : ""}</div>
        ${safeRecord(home) ? `<div class="gpTeamMeta">${esc(safeRecord(home))}</div>` : ""}
      </div>
      ${showScores ? scoreHTML(homeScore, homeWinner, isFinal && !homeWinner) : ""}
    </button>
  </div>
  <div class="gpPickStrip">
    <div>
      ${hasPick
        ? `<div class="gpYouPicked${isPending ? " gpPending" : ""}${myPickResult === "win" ? " gpResultWin" : ""}${myPickResult === "loss" ? " gpResultLoss" : ""}">${
            isPending ? "⏳ Pending: " : myPickResult === "win" ? "✓ Won: " : myPickResult === "loss" ? "✕ Lost: " : (isAts ? "Covering: " : "Picked: ")
          }${esc(my === "away" ? safeTeam(away) : safeTeam(home))}</div>`
        : locked ? `<div class="gpLocked">🔒 Locked</div>` : `<div class="gpNoPick">No pick yet</div>`}
    </div>
    ${locked ? `
    <details class="gpEveryoneDetails" data-gpeveryone="1"
      data-weekid="${esc(weekId)}" data-eid="${esc(eventId)}"
      data-away="${esc(safeTeam(away))}" data-home="${esc(safeTeam(home))}">
      <summary class="gpEveryoneSummary">👥 Everyone's Picks</summary>
      <div class="gpEveryoneBody" id="gpEv_${esc(weekId)}_${esc(eventId)}">
      </div>
    </details>` : `
    <div class="gpEveryoneLocked">🔒 Picks reveal when the game locks in</div>`}
  </div>
</div>`;
  }

  // ─── Avatar color palette (deterministic from name) ──────────────
  const AVATAR_COLORS = [
    ["#1a2a4a","#4a8fd4"],["#1a3a1a","#4ad46a"],["#3a1a1a","#d46a4a"],
    ["#2a1a3a","#8a4ad4"],["#3a2a1a","#d4a44a"],["#1a3a3a","#4ad4c4"],
    ["#3a1a2a","#d44a8a"],["#2a3a1a","#a4d44a"],
  ];
  function avatarStyle(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const [bg, color] = AVATAR_COLORS[h % AVATAR_COLORS.length];
    return { bg, color };
  }
  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return String(name || "?").slice(0, 2).toUpperCase();
  }

  // ─── Standings table (shared by weekly + season leaderboards) ─────
  // Columns: rank · player · total points · [🎯 tiebreakers won, season
  // view only] · Outright Winner record (W-L-T) · correct underdog picks
  // · Against-the-Spread record (W-L-P). One fixed-layout table so it
  // never needs horizontal scrolling on mobile.
  // opts.showTbWins: season view adds a 🎯 column (season tie-break #1).
  function gpBuildStandingsTableHTML(list, opts) {
    const showTbWins = !!opts?.showTbWins;

    const rows = (Array.isArray(list) ? list : []).map((u, i) => {
      const rank = i + 1;
      const nm   = String(u?.name || "Someone");
      const pts  = Number(u?.points ?? 0);

      const owW = Number(u?.owWins ?? 0), owL = Number(u?.owLosses ?? 0), owT = Number(u?.owTies ?? 0);
      const owRecord = owT > 0 ? `${owW}-${owL}-${owT}` : `${owW}-${owL}`;

      const dogs = Number(u?.dogWins ?? 0);

      const atsW = Number(u?.atsWins ?? 0), atsL = Number(u?.atsLosses ?? 0), atsP = Number(u?.atsPushes ?? 0);
      const atsRecord = (atsW + atsL + atsP) > 0
        ? (atsP > 0 ? `${atsW}-${atsL}-${atsP}` : `${atsW}-${atsL}`)
        : "–";

      const rowCls = rank === 1 ? " gpStRowGold" : rank === 2 ? " gpStRowSilver" : rank === 3 ? " gpStRowBronze" : "";
      const tbBadge = u?.tiebreakerUsed
        ? `<span class="gpStTbBadge" title="Rank decided by the tiebreaker">🎯</span>` : "";

      return `
<tr class="gpStandingsRow${rowCls}" data-gpplayername="${esc(nm)}">
  <td class="gpStRank">${rank}</td>
  <td class="gpStName">
    <div class="gpStNameWrap">
      <span class="gpStNameText">${esc(nm)}${tbBadge}</span>
      <span class="gpStChevron">›</span>
    </div>
  </td>
  <td class="gpStPts">${esc(String(pts))}</td>
  ${showTbWins ? `<td class="gpStTbWins">${Number(u?.tbWins ?? 0)}</td>` : ""}
  <td>${esc(owRecord)}</td>
  <td class="gpStDogs">${dogs}</td>
  <td>${esc(atsRecord)}</td>
</tr>`;
    }).join("");

    const anyTiebreakerUsed = (Array.isArray(list) ? list : []).some(u => u?.tiebreakerUsed);

    const colgroupHTML = showTbWins ? `
    <colgroup>
      <col style="width:8%"/>
      <col style="width:29%"/>
      <col style="width:10%"/>
      <col style="width:9%"/>
      <col style="width:14%"/>
      <col style="width:9%"/>
      <col style="width:14%"/>
    </colgroup>` : `
    <colgroup>
      <col style="width:9%"/>
      <col style="width:38%"/>
      <col style="width:13%"/>
      <col style="width:16%"/>
      <col style="width:10%"/>
      <col style="width:14%"/>
    </colgroup>`;

    return `
<div class="gpStandingsTableWrap">
  <div class="gpStandingsHint">Tap a player to see their full picks ›</div>
  <table class="gpStandingsTable">
    ${colgroupHTML}
    <thead>
      <tr>
        <th class="gpStRank">#</th>
        <th class="gpStName">Player</th>
        <th>Pts</th>
        ${showTbWins ? `<th>🎯</th>` : ""}
        <th>OW</th>
        <th>🐶</th>
        <th>ATS</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  ${anyTiebreakerUsed ? `<div class="gpTbUsedNote">🎯 = these players were tied and ranked by the tiebreaker (closest guess without going over)</div>` : ""}
</div>`;
  }

  function gpBuildColumnLegendHTML(opts) {
    const season = !!opts?.season;
    return `
<div class="gpColumnLegend">
  <b>Pts</b> total points &middot; ${season ? `🎯 tiebreakers won this season &middot; ` : ""}<b>OW</b> Outright Winner record (W-L-T) &middot; 🐶 correct underdog picks &middot; <b>ATS</b> Against-the-Spread record (W-L-P)
  ${season ? "" : `<br/>Ties in points/record are broken by the tiebreaker: closest guess to the actual combined score <b>without going over</b> wins.`}
</div>`;
  }

  // ─── Player Picks Overlay ─────────────────────────────────────────
  // Builds the bottom-sheet overlay showing one player's picks for the week.
  // `playerName`        — display name string
  // `games`             — array of game objects (same shape as used by buildGameCard)
  // `picksMap`          — { [eventId]: { side: "away"|"home" } }  (the player's picks for this week)
  // `atsEventIds`       — eventIds graded against the spread this week
  // `tiebreakerEventId` — eventId of this week's designated tiebreaker game
  // `myTiebreaker`      — { name, guess, updatedAt } for this player, or null
  function gpBuildPlayerPicksOverlayHTML(playerName, games, picksMap, atsEventIds, tiebreakerEventId, myTiebreaker) {
    const nm = String(playerName || "Someone");
    const { bg, color } = avatarStyle(nm);
    const list = Array.isArray(games) ? [...games].sort((a, b) => startMs(a) - startMs(b)) : [];
    const atsIdSet = new Set((Array.isArray(atsEventIds) ? atsEventIds : []).map(String));
    const tbEventId = String(tiebreakerEventId || "");

    function buildOverlayGameRow(g) {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";

      const away = g?.awayTeam || { name: g?.awayName || "Away", abbr: "", logo: g?.awayLogo || "" };
      const home = g?.homeTeam || { name: g?.homeName || "Home", abbr: "", logo: g?.homeLogo || "" };
      const awayLogo = String(g?.awayLogo || away?.logo || "").trim();
      const homeLogo = String(g?.homeLogo || home?.logo || "").trim();

      // Not locked yet — never reveal whether/what this player picked,
      // regardless of what picksMap has for it.
      const gameLocked = startMs(g) > 0 && Date.now() >= startMs(g);
      if (!gameLocked) {
        return `
<div class="gpOverlayPickRow" style="opacity:0.5">
  <div class="gpOverlayPickTeamLogoPlaceholder">🔒</div>
  <div style="flex:1;min-width:0">
    <div class="gpOverlayPickTeamName" style="color:rgba(255,255,255,0.35)">Locked</div>
    <div class="gpOverlayPickGameLabel">${esc(safeTeam(away))} @ ${esc(safeTeam(home))}</div>
  </div>
  <div class="gpOverlayPickResult gpResultPending">🔒</div>
</div>`;
      }

      const pick = picksMap?.[eventId];
      if (!pick?.side) {
        // Player didn't pick this game — show as no pick
        return `
<div class="gpOverlayPickRow" style="opacity:0.45">
  <div class="gpOverlayPickTeamLogoPlaceholder">–</div>
  <div style="flex:1;min-width:0">
    <div class="gpOverlayPickTeamName" style="color:rgba(255,255,255,0.35)">No pick</div>
    <div class="gpOverlayPickGameLabel">${esc(safeTeam(away))} @ ${esc(safeTeam(home))}</div>
  </div>
  <div class="gpOverlayPickResult gpResultPending">–</div>
</div>`;
      }

      const side       = String(pick.side);
      const pickedTeam = side === "away" ? away : home;
      const pickedLogo = side === "away" ? awayLogo : homeLogo;
      const oppTeam    = side === "away" ? home     : away;
      const isAts      = atsIdSet.has(eventId);

      // Determine result — ATS games grade against the stored spread (a
      // team can lose outright but still cover, and vice versa), straight
      // games grade by final score. Same helpers gp-data.js's leaderboard
      // and buildGameCard's per-card coloring use, so this always agrees.
      const live    = g?.__live || g?.live || null;
      const state   = String(live?.state || "").toLowerCase();
      const isFinal = state === "post";
      let resultCls  = "gpResultPending";
      let resultIcon = "·";
      if (isFinal) {
        const GP_Data = window.GP_Data || {};
        if (isAts) {
          const grade = typeof GP_Data.gpGradeAtsForGame === "function" ? GP_Data.gpGradeAtsForGame(g) : { ok: false };
          if (grade.ok) {
            if (grade.pushed) { resultCls = "gpResultTie"; resultIcon = "🤝"; }
            else { const won = side === grade.coverSide; resultCls = won ? "gpResultWin" : "gpResultLoss"; resultIcon = won ? "✓" : "✕"; }
          }
        } else {
          const winningSide = typeof GP_Data.gpGetGameWinningSide === "function" ? GP_Data.gpGetGameWinningSide(g) : "";
          if (winningSide) {
            const won = side === winningSide;
            resultCls  = won ? "gpResultWin" : "gpResultLoss";
            resultIcon = won ? "✓" : "✕";
          } else {
            const awayScore = Number(live?.awayScore ?? NaN);
            const homeScore = Number(live?.homeScore ?? NaN);
            if (Number.isFinite(awayScore) && Number.isFinite(homeScore)) { resultCls = "gpResultTie"; resultIcon = "🤝"; }
          }
        }
      }

      const logoEl = pickedLogo
        ? `<img class="gpOverlayPickTeamLogo" src="${esc(pickedLogo)}" alt="${esc(safeAbbr(pickedTeam))}" loading="lazy" width="36" height="36" onerror="this.style.display='none'"/>`
        : `<div class="gpOverlayPickTeamLogoPlaceholder">${esc(safeAbbr(pickedTeam).slice(0,3))}</div>`;

      return `
<div class="gpOverlayPickRow">
  ${logoEl}
  <div style="flex:1;min-width:0">
    <div class="gpOverlayPickTeamName">${esc(safeTeam(pickedTeam))}${isAts ? spreadChipHTML(g, side) : ""}</div>
    <div class="gpOverlayPickGameLabel">vs ${esc(safeTeam(oppTeam))}</div>
  </div>
  <div class="gpOverlayPickResult ${resultCls}">${resultIcon}</div>
</div>`;
    }

    // Same grouping/order as the main picks page: Outright Winners, then
    // Against the Spread, then the Tiebreaker guess last.
    const outrightRows = list.filter(g => !atsIdSet.has(String(g?.eventId || g?.id || ""))).map(buildOverlayGameRow).filter(Boolean).join("");
    const atsRows       = list.filter(g =>  atsIdSet.has(String(g?.eventId || g?.id || ""))).map(buildOverlayGameRow).filter(Boolean).join("");

    let tiebreakerHTML = "";
    const tbGame = tbEventId ? list.find(g => String(g?.eventId || g?.id || "") === tbEventId) : null;
    if (tbGame) {
      const away = tbGame?.awayTeam || { name: tbGame?.awayName || "Away" };
      const home = tbGame?.homeTeam || { name: tbGame?.homeName || "Home" };
      const gameLocked = startMs(tbGame) > 0 && Date.now() >= startMs(tbGame);
      const GP_Data = window.GP_Data || {};
      const actual  = typeof GP_Data.gpComputeTiebreakerActual === "function"
        ? GP_Data.gpComputeTiebreakerActual(list, tbEventId) : null;
      const guess = Number.isFinite(Number(myTiebreaker?.guess)) ? Number(myTiebreaker.guess) : null;

      let tbRow;
      if (!gameLocked) {
        tbRow = `
<div class="gpOverlayPickRow" style="opacity:0.5">
  <div class="gpOverlayPickTeamLogoPlaceholder">🔒</div>
  <div style="flex:1;min-width:0">
    <div class="gpOverlayPickTeamName" style="color:rgba(255,255,255,0.35)">Locked</div>
    <div class="gpOverlayPickGameLabel">${esc(safeTeam(away))} @ ${esc(safeTeam(home))}</div>
  </div>
  <div class="gpOverlayPickResult gpResultPending">🔒</div>
</div>`;
      } else if (guess == null) {
        tbRow = `
<div class="gpOverlayPickRow" style="opacity:0.45">
  <div class="gpOverlayPickTeamLogoPlaceholder">–</div>
  <div style="flex:1;min-width:0">
    <div class="gpOverlayPickTeamName" style="color:rgba(255,255,255,0.35)">No guess</div>
    <div class="gpOverlayPickGameLabel">${esc(safeTeam(away))} @ ${esc(safeTeam(home))}</div>
  </div>
  <div class="gpOverlayPickResult gpResultPending">–</div>
</div>`;
      } else {
        tbRow = `
<div class="gpOverlayPickRow">
  <div class="gpOverlayPickTeamLogoPlaceholder">🎯</div>
  <div style="flex:1;min-width:0">
    <div class="gpOverlayPickTeamName">Guessed ${esc(String(guess))}${actual != null ? ` <span style="color:rgba(255,255,255,0.4);font-weight:700">(Actual: ${esc(String(actual))})</span>` : ""}</div>
    <div class="gpOverlayPickGameLabel">${esc(safeTeam(away))} @ ${esc(safeTeam(home))}</div>
  </div>
</div>`;
      }
      tiebreakerHTML = gpBuildSectionHeaderHTML("🎯 Tiebreaker", "tiebreaker") + tbRow;
    }

    const outrightHTML = outrightRows ? gpBuildSectionHeaderHTML("🏈 Outright Winners", "outright") + outrightRows : "";
    const atsHTML       = atsRows      ? gpBuildSectionHeaderHTML("📈 Against the Spread", "ats")     + atsRows      : "";
    const bodyContent   = outrightHTML + atsHTML + tiebreakerHTML;

    return `
<div class="gpPicksOverlayBackdrop" id="gpPicksOverlay" role="dialog" aria-modal="true" aria-label="${esc(nm)}'s picks">
  <div class="gpPicksOverlaySheet" id="gpPicksOverlaySheet">
    <div class="gpOverlayHandle"></div>
    <div class="gpOverlayHeader">
      <div class="gpOverlayTitle">
        <div class="gpOverlayAvatar" style="background:${bg};color:${color}">${esc(initials(nm))}</div>
        <div>
          <div class="gpOverlayName">${esc(nm)}</div>
          <div class="gpOverlaySubtitle">This week's picks</div>
        </div>
      </div>
      <button class="gpOverlayCloseBtn" id="gpPicksOverlayClose" aria-label="Close">✕</button>
    </div>
    <div class="gpOverlayBody">
      ${bodyContent || `<div class="gpOverlayEmpty">No picks to show.</div>`}
    </div>
  </div>
</div>`;
  }

  // ─── Show / dismiss overlay (DOM management) ─────────────────────
  function gpShowPlayerPicksOverlay(playerName, games, picksMap, atsEventIds, tiebreakerEventId, myTiebreaker) {
    // Remove any existing overlay first
    const existing = document.getElementById("gpPicksOverlay");
    if (existing) existing.remove();

    // Inject into body
    document.body.insertAdjacentHTML("beforeend",
      gpBuildPlayerPicksOverlayHTML(playerName, games, picksMap, atsEventIds, tiebreakerEventId, myTiebreaker)
    );

    const backdrop = document.getElementById("gpPicksOverlay");
    try { window.replaceMichiganText && window.replaceMichiganText(backdrop, "The Team Up North"); } catch {}
    const sheet    = document.getElementById("gpPicksOverlaySheet");
    const closeBtn = document.getElementById("gpPicksOverlayClose");
    if (!backdrop) return;

    // Animate in (next frame so CSS transition fires)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => backdrop.classList.add("gpOverlayVisible"));
    });

    function dismiss() {
      backdrop.classList.remove("gpOverlayVisible");
      backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
    }

    // X button
    closeBtn?.addEventListener("click", dismiss);

    // Click outside the sheet (on the backdrop itself)
    backdrop.addEventListener("click", (e) => {
      if (!sheet.contains(e.target)) dismiss();
    });

    // Escape key
    function onKey(e) {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onKey); }
    }
    document.addEventListener("keydown", onKey);
  }

  // ─── Weekly recap — shown above the leaderboard once every game in
  // the week has gone final ──────────────────────────────────────────
  function gpBuildWeeklyRecapHTML(recap, weekLabel) {
    if (!recap) return "";
    const { champions, biggestUpset, perfectWeekPlayers, tiebreaker } = recap;

    const rows = [];

    if (Array.isArray(champions) && champions.length) {
      const names = champions.map(c => esc(c.name)).join(" &amp; ");
      const pts   = champions[0]?.points;
      const verb  = champions.length > 1 ? "tie atop" : "takes";
      rows.push(`
<div class="gpRecapRow">
  <div class="gpRecapIcon">👑</div>
  <div class="gpRecapText"><b>${names}</b> ${verb} ${esc(weekLabel || "the week")} with ${esc(String(pts))} pts.</div>
</div>`);
    }

    if (biggestUpset) {
      rows.push(`
<div class="gpRecapRow">
  <div class="gpRecapIcon">😱</div>
  <div class="gpRecapText"><b>Biggest upset:</b> ${esc(biggestUpset.winnerName)} (+${esc(String(biggestUpset.spread))}) knocked off ${esc(biggestUpset.loserName)}.</div>
</div>`);
    }

    if (Array.isArray(perfectWeekPlayers) && perfectWeekPlayers.length) {
      rows.push(`
<div class="gpRecapRow">
  <div class="gpRecapIcon">💯</div>
  <div class="gpRecapText"><b>Perfect week:</b> ${perfectWeekPlayers.map(esc).join(", ")} didn&#8217;t lose a single pick.</div>
</div>`);
    }

    if (tiebreaker) {
      rows.push(`
<div class="gpRecapRow">
  <div class="gpRecapIcon">🎯</div>
  <div class="gpRecapText"><b>Tiebreaker:</b> actual was ${esc(String(tiebreaker.actual))} — ${esc(tiebreaker.winnerName)} called it closest with ${esc(String(tiebreaker.guess))}.</div>
</div>`);
    }

    if (!rows.length) return "";

    return `
<div class="gpRecapCard">
  <div class="gpRecapHeader">
    <div class="gpRecapTitle">🏆 Week Recap</div>
    ${weekLabel ? `<div class="gpRecapSub">${esc(weekLabel)}</div>` : ""}
  </div>
  <div class="gpRecapBody">${rows.join("")}</div>
</div>`;
  }

  // ─── Head-to-Head weekly matchups ──────────────────────────────────
  // `results` is gpComputeH2HWeekResults' output: [{ bye } | { players,
  // points, winner }, ...]. Winner reflects current (possibly still-live)
  // points, same as the rest of the page shows before a week is final.
  function gpBuildH2HMatchupsHTML(results, weekLabel) {
    const list = Array.isArray(results) ? results : [];
    if (!list.length) return "";

    const rows = list.map(m => {
      if (m.bye) {
        const nm = String(m.bye || "Someone");
        const { bg, color } = avatarStyle(nm);
        return `
<div class="gpH2HMatchupRow gpH2HByeRow">
  <div class="gpH2HAvatar" style="background:${bg};color:${color}">${esc(initials(nm))}</div>
  <div class="gpH2HName">${esc(nm)}</div>
  <div class="gpH2HByeLabel">BYE</div>
</div>`;
      }
      const [nameA, nameB] = m.players;
      const [ptsA, ptsB] = m.points;
      const aWin = m.winner === "a", bWin = m.winner === "b", tie = m.winner === "tie";
      const { bg: bgA, color: colorA } = avatarStyle(nameA);
      const { bg: bgB, color: colorB } = avatarStyle(nameB);
      return `
<div class="gpH2HMatchupRow">
  <div class="gpH2HSide${aWin ? " gpH2HWinner" : ""}">
    <div class="gpH2HAvatar" style="background:${bgA};color:${colorA}">${esc(initials(nameA))}</div>
    <div class="gpH2HName">${esc(nameA)}${aWin ? " 🏆" : ""}</div>
    <div class="gpH2HPts">${esc(String(ptsA))}</div>
  </div>
  <div class="gpH2HVs">${tie ? "TIE" : "vs"}</div>
  <div class="gpH2HSide gpH2HSideRight${bWin ? " gpH2HWinner" : ""}">
    <div class="gpH2HPts">${esc(String(ptsB))}</div>
    <div class="gpH2HName">${bWin ? "🏆 " : ""}${esc(nameB)}</div>
    <div class="gpH2HAvatar" style="background:${bgB};color:${colorB}">${esc(initials(nameB))}</div>
  </div>
</div>`;
    }).join("");

    return `
<div class="gpLeaderCard gpH2HMatchupsCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">⚔️ Head-to-Head Matchups</div>
      ${weekLabel ? `<div class="gpLeaderWeekLabel">${esc(weekLabel)}</div>` : ""}
    </div>
  </div>
  <div class="gpH2HMatchupsList">${rows}</div>
</div>`;
  }

  // ─── Pre-lock progress (leaderboard before any game has gone final) ──
  // Every league member should be visible from the moment a week opens,
  // not just once someone's picks start scoring — so instead of an empty
  // "check back later" card, each member gets a "N of N games locked in"
  // progress bar. Falls back to whoever's picked so far for leagues
  // created before the Join League members list existed, so this never
  // regresses to showing nobody.
  function gpComputePreLockProgress(members, games, allPicks) {
    const total = Array.isArray(games) ? games.length : 0;
    const picks = (allPicks && typeof allPicks === "object") ? allPicks : {};

    const nameById = new Map();
    for (const m of (Array.isArray(members) ? members : [])) {
      const pid = String(m?.playerId || m?.uid || "").trim();
      if (!pid) continue;
      nameById.set(pid, String(m?.name || "Someone").trim() || "Someone");
    }

    const countById = new Map();
    for (const eventId of Object.keys(picks)) {
      const eventPicks = Array.isArray(picks[eventId]) ? picks[eventId] : [];
      for (const p of eventPicks) {
        const pid = String(p?.uid || "").trim();
        if (!pid) continue;
        if (!nameById.has(pid)) nameById.set(pid, String(p?.name || "Someone").trim() || "Someone");
        countById.set(pid, (countById.get(pid) || 0) + 1);
      }
    }

    const rows = [...nameById.entries()].map(([pid, name]) => {
      const done = Math.min(total, countById.get(pid) || 0);
      const pct  = total > 0 ? Math.round((done / total) * 100) : 0;
      return { pid, name, done, total, pct };
    });

    rows.sort((a, b) => (b.pct - a.pct) || String(a.name).localeCompare(String(b.name)));
    return rows;
  }

  function gpBuildPreLockProgressHTML(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      return `
<div class="gpEmpty" style="padding:28px 20px">
  <div style="font-size:28px;margin-bottom:8px">⏳</div>
  <div style="font-size:14px;font-weight:800;color:rgba(255,255,255,0.5)">Leaderboard locks in once games go final</div>
</div>`;
    }
    const rowsHTML = list.map(r => {
      const { bg, color } = avatarStyle(r.name);
      const complete = r.total > 0 && r.done >= r.total;
      const barLabel = complete ? "100% locked in" : `${r.done} of ${r.total} games locked in`;
      return `
<div class="gpPreLockRow">
  <div class="gpPreLockAvatar" style="background:${bg};color:${color}">${esc(initials(r.name))}</div>
  <div class="gpPreLockInfo">
    <div class="gpPreLockName">${esc(r.name)}</div>
    <div class="gpPreLockBarWrap">
      <div class="gpPreLockBarFill${complete ? " gpPreLockBarFillDone" : ""}" style="width:${r.pct}%"></div>
      <div class="gpPreLockBarLabel">${esc(barLabel)}</div>
    </div>
  </div>
</div>`;
    }).join("");
    return `<div class="gpPreLockList">${rowsHTML}</div>`;
  }

  // ─── Kickoff countdown widget ──────────────────────────────────────
  // Shared by the leaderboard header ("First game starts in") and league
  // picker cards ("Week N starts in") — any number of these can be on
  // screen at once. Each is rendered with a data-target timestamp;
  // groupPicks.js's gpStartAllCountdowns() finds every one of them after
  // each render (by class, not id, since there can be several) and ticks
  // their digits live off one shared 1s interval, same pattern as the
  // Beat TTUN countdown.
  function gpEarliestKickoffMs(games) {
    let min = null;
    for (const g of (Array.isArray(games) ? games : [])) {
      const ms = g?.startTime?.toMillis ? g.startTime.toMillis() : null;
      if (ms != null && (min == null || ms < min)) min = ms;
    }
    return min;
  }

  function gpBuildCountdownWidgetHTML({ label, targetMs, liveLabel, extraClass }) {
    if (targetMs == null) return "";
    const cls = `gpCountdownWidget${extraClass ? ` ${extraClass}` : ""}`;
    if (targetMs <= Date.now()) {
      return liveLabel ? `<div class="${cls} gpCountdownLive">${esc(liveLabel)}</div>` : "";
    }
    return `
<div class="${cls}" data-gp-countdown data-target="${targetMs}">
  <div class="gpCountdownLabel">${esc(label || "Starts in")}</div>
  <div class="gpCountdownClock">
    <div class="gpCdUnit"><span class="gpCdVal" data-cd="d">0</span><span class="gpCdUnitLabel">d</span></div>
    <div class="gpCdUnit"><span class="gpCdVal" data-cd="h">00</span><span class="gpCdUnitLabel">h</span></div>
    <div class="gpCdUnit"><span class="gpCdVal" data-cd="m">00</span><span class="gpCdUnitLabel">m</span></div>
    <div class="gpCdUnit"><span class="gpCdVal" data-cd="s">00</span><span class="gpCdUnitLabel">s</span></div>
  </div>
</div>`;
  }

  // ─── Leaderboard ─────────────────────────────────────────────────
  function buildLeaderboardHTML(weekLabel, leaderboard, opts) {
    const { rows, finalsCount } = leaderboard || {};
    const list  = Array.isArray(rows) ? rows : [];

    // A week can have both straight-up games and one ATS game at once,
    // so the legend always covers every point source rather than
    // switching between two mutually-exclusive modes.
    const scoringFooter = `
<div class="gpLeaderScoringFooter">
  <span>🐶 Underdog win = 2 pts</span>
  <span>❤️ Favorite win = 1 pt</span>
  <span>✅ ATS cover = 1 pt</span>
  <span>🤝 Tie/Push = 0.5 pts</span>
</div>`;

    // ── No finals yet — show everyone in the league with how many of
    //    this week's games they've locked in a pick for, instead of an
    //    empty/all-zero table nobody can do anything with yet ──
    if (!finalsCount) {
      const progressRows = gpComputePreLockProgress(opts?.leagueMembers, opts?.games, opts?.allPicks);
      const countdownHTML = gpBuildCountdownWidgetHTML({
        label: "First game starts in",
        targetMs: gpEarliestKickoffMs(opts?.games),
        liveLabel: "🏈 Games underway"
      });
      return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Leaderboard</div>
    </div>
    ${countdownHTML}
  </div>
  ${gpBuildPreLockProgressHTML(progressRows)}
  ${scoringFooter}
</div>`;
    }

    // ── No picks at all ──
    if (!list.length) {
      return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Leaderboard</div>
    </div>
  </div>
  <div class="gpEmpty" style="padding:28px 20px">No picks recorded this week.</div>
  ${scoringFooter}
</div>`;
    }

    // ── Podium (top 3) ──
    const podiumSlots = list.slice(0, 3);
    const podiumHTML = podiumSlots.map((u, i) => {
      const rank = i + 1;
      const nm   = String(u?.name || "Someone");
      const { bg, color } = avatarStyle(nm);
      const pts  = Number(u?.points ?? 0);
      const CROWNS = ["👑", "🥈", "🥉"];
      return `
<div class="gpPodiumSlot" data-rank="${rank}">
  <div class="gpPodiumAvatar" style="background:${bg};color:${color}">
    ${rank === 1 ? `<span class="gpPodiumCrown">${CROWNS[0]}</span>` : ""}
    ${esc(initials(nm))}
  </div>
  <div class="gpPodiumName">${esc(nm)}</div>
  <div class="gpPodiumPoints">${pts} pts</div>
  <div class="gpPodiumBase">${rank === 1 ? "" : rank === 2 ? CROWNS[1] : CROWNS[2]}</div>
</div>`;
    }).join("");

    // ── Full Standings — clicking a row opens the player picks overlay ──
    const standingsTableHTML = gpBuildStandingsTableHTML(list);

    return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Leaderboard</div>
    </div>
  </div>
  <div class="gpLeaderPodium">
    ${podiumHTML}
  </div>
  <div class="gpStandingsDivider">
    <div class="gpStandingsDividerLine"></div>
    <div class="gpStandingsDividerLabel">Full Standings</div>
    <div class="gpStandingsDividerLine"></div>
  </div>
  ${standingsTableHTML}
  ${scoringFooter}
  ${gpBuildColumnLegendHTML()}
</div>`;
  }

  // ─── Season standings (cumulative across all published weeks) ────
  function buildSeasonLeaderboardHTML(seasonLeaderboard) {
    const { rows, weeksCount } = seasonLeaderboard || {};
    const list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
      return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Season Standings</div>
      <div class="gpLeaderWeekLabel">${weeksCount || 0} week${weeksCount === 1 ? "" : "s"} played</div>
    </div>
  </div>
  <div class="gpEmpty" style="padding:28px 20px">No completed weeks yet.</div>
</div>`;
    }

    const podiumSlots = list.slice(0, 3);
    const podiumHTML = podiumSlots.map((u, i) => {
      const rank = i + 1;
      const nm   = String(u?.name || "Someone");
      const { bg, color } = avatarStyle(nm);
      const pts  = Number(u?.points ?? 0);
      const CROWNS = ["👑", "🥈", "🥉"];
      return `
<div class="gpPodiumSlot" data-rank="${rank}">
  <div class="gpPodiumAvatar" style="background:${bg};color:${color}">
    ${rank === 1 ? `<span class="gpPodiumCrown">${CROWNS[0]}</span>` : ""}
    ${esc(initials(nm))}
  </div>
  <div class="gpPodiumName">${esc(nm)}</div>
  <div class="gpPodiumPoints">${pts} pts</div>
  <div class="gpPodiumBase">${rank === 1 ? "" : rank === 2 ? CROWNS[1] : CROWNS[2]}</div>
</div>`;
    }).join("");

    const standingsTableHTML = gpBuildStandingsTableHTML(list, { showTbWins: true });

    return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Season Standings</div>
      <div class="gpLeaderWeekLabel">${weeksCount || 0} week${weeksCount === 1 ? "" : "s"} played</div>
    </div>
  </div>
  <div class="gpLeaderPodium">
    ${podiumHTML}
  </div>
  <div class="gpStandingsDivider">
    <div class="gpStandingsDividerLine"></div>
    <div class="gpStandingsDividerLabel">Full Standings</div>
    <div class="gpStandingsDividerLine"></div>
  </div>
  ${standingsTableHTML}
  ${gpBuildColumnLegendHTML({ season: true })}
  ${gpBuildSeasonTiebreakRulesHTML()}
</div>`;
  }

  // ─── Head-to-Head season standings (win-loss-tie record) ──────────
  function gpBuildH2HSeasonStandingsHTML(seasonStandings) {
    const { rows, weeksCount } = seasonStandings || {};
    const list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
      return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">⚔️ Head-to-Head Standings</div>
      <div class="gpLeaderWeekLabel">${weeksCount || 0} week${weeksCount === 1 ? "" : "s"} played</div>
    </div>
  </div>
  <div class="gpEmpty" style="padding:28px 20px">No completed weeks yet.</div>
</div>`;
    }

    const podiumSlots = list.slice(0, 3);
    const podiumHTML = podiumSlots.map((u, i) => {
      const rank = i + 1;
      const nm   = String(u?.name || "Someone");
      const { bg, color } = avatarStyle(nm);
      const record = u.ties > 0 ? `${u.wins}-${u.losses}-${u.ties}` : `${u.wins}-${u.losses}`;
      const CROWNS = ["👑", "🥈", "🥉"];
      return `
<div class="gpPodiumSlot" data-rank="${rank}">
  <div class="gpPodiumAvatar" style="background:${bg};color:${color}">
    ${rank === 1 ? `<span class="gpPodiumCrown">${CROWNS[0]}</span>` : ""}
    ${esc(initials(nm))}
  </div>
  <div class="gpPodiumName">${esc(nm)}</div>
  <div class="gpPodiumPoints">${esc(record)}</div>
  <div class="gpPodiumBase">${rank === 1 ? "" : rank === 2 ? CROWNS[1] : CROWNS[2]}</div>
</div>`;
    }).join("");

    const rowsHTML = list.map((u, i) => {
      const rank = i + 1;
      const nm   = String(u?.name || "Someone");
      const record = u.ties > 0 ? `${u.wins}-${u.losses}-${u.ties}` : `${u.wins}-${u.losses}`;
      const diff = Number(u.pointsFor || 0) - Number(u.pointsAgainst || 0);
      const diffStr = diff > 0 ? `+${diff}` : String(diff);
      const rowCls = rank === 1 ? " gpStRowGold" : rank === 2 ? " gpStRowSilver" : rank === 3 ? " gpStRowBronze" : "";
      return `
<tr class="gpStandingsRow${rowCls}">
  <td class="gpStRank">${rank}</td>
  <td class="gpStName"><div class="gpStNameWrap"><span class="gpStNameText">${esc(nm)}</span></div></td>
  <td>${esc(record)}</td>
  <td>${esc(String(u.pointsFor ?? 0))}</td>
  <td>${esc(String(u.pointsAgainst ?? 0))}</td>
  <td>${esc(diffStr)}</td>
</tr>`;
    }).join("");

    const standingsTableHTML = `
<div class="gpStandingsTableWrap">
  <table class="gpStandingsTable">
    <colgroup>
      <col style="width:9%"/>
      <col style="width:33%"/>
      <col style="width:16%"/>
      <col style="width:14%"/>
      <col style="width:14%"/>
      <col style="width:14%"/>
    </colgroup>
    <thead>
      <tr>
        <th class="gpStRank">#</th>
        <th class="gpStName">Player</th>
        <th>W-L-T</th>
        <th>PF</th>
        <th>PA</th>
        <th>Diff</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>
</div>`;

    return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">⚔️ Head-to-Head Standings</div>
      <div class="gpLeaderWeekLabel">${weeksCount || 0} week${weeksCount === 1 ? "" : "s"} played</div>
    </div>
  </div>
  <div class="gpLeaderPodium">
    ${podiumHTML}
  </div>
  <div class="gpStandingsDivider">
    <div class="gpStandingsDividerLine"></div>
    <div class="gpStandingsDividerLabel">Full Standings</div>
    <div class="gpStandingsDividerLine"></div>
  </div>
  ${standingsTableHTML}
  <div class="gpColumnLegend">
    <b>W-L-T</b> matchup record &middot; <b>PF</b> points scored in matchups &middot; <b>PA</b> points allowed &middot; <b>Diff</b> point differential
  </div>
  <div class="gpColumnLegend">
    <b>Ties</b> (after wins) are broken by point differential, then name.
  </div>
</div>`;
  }

  // ─── Season standings tie-break chain (fine print) ────────────────
  function gpBuildSeasonTiebreakRulesHTML() {
    return `
<div class="gpColumnLegend">
  <b>Season ties</b> (after total points) are broken in order: 1) most 🎯 tiebreakers won, 2) best ATS win percentage, 3) most correct underdog picks.
</div>`;
  }

  // ─── View toggle (This Week / Season) ─────────────────────────────
  function gpBuildViewToggleHTML(mode) {
    const m = mode === "season" ? "season" : "week";
    return `
<div class="gpViewToggle">
  <button type="button" class="gpViewToggleBtn${m === "week" ? " gpViewToggleActive" : ""}" data-gpaction="viewWeek">This Week</button>
  <button type="button" class="gpViewToggleBtn${m === "season" ? " gpViewToggleActive" : ""}" data-gpaction="viewSeason">Season</button>
</div>`;
  }

  // ─── Tiebreaker card ────────────────────────────────────────────
  function gpBuildTiebreakerCardHTML({ game, myGuess, pendingGuess, locked, actualTotal, tiebreakers }) {
    if (!game) return "";
    const eventId = String(game?.eventId || game?.id || "");
    if (!eventId) return "";
    const away = game?.awayTeam || { name: game?.awayName || "Away" };
    const home = game?.homeTeam || { name: game?.homeName || "Home" };
    const val  = (pendingGuess != null) ? pendingGuess : (myGuess != null ? myGuess : "");
    const ou   = safeOverUnder(game);

    // Everyone's guesses are already loaded (no per-game lazy fetch needed
    // here, unlike Everyone's Picks) — same lock rule though: nobody sees
    // any prediction, including their own guess's status vs. others, until
    // the tiebreaker game has actually started.
    let everyoneHTML = "";
    if (locked) {
      const entries = Object.values(tiebreakers && typeof tiebreakers === "object" ? tiebreakers : {});

      // Find the current tiebreaker leader (closest without going over) so
      // players can see, at a glance, that the rule from above is actually
      // deciding something — same scoring gp-data.js's leaderboard uses.
      let leader = null;
      if (actualTotal != null && entries.length) {
        const OVER_PENALTY = 1e6;
        const scored = entries
          .map(t => {
            const guess = Number(t?.guess);
            if (!Number.isFinite(guess)) return null;
            const diff = guess - actualTotal;
            return { t, score: diff > 0 ? diff + OVER_PENALTY : -diff };
          })
          .filter(Boolean)
          .sort((a, b) => a.score - b.score);
        if (scored.length) leader = scored[0].t;
      }

      const lines = entries.length
        ? entries.map(t => {
            const nm    = String(t?.name || "Someone");
            const guess = String(t?.guess ?? "—");
            const saved = fmtSavedAt(t?.updatedAt);
            const { bg, color } = avatarStyle(nm);
            const isLeader = t === leader;
            return `
<div class="gpRosterRow${isLeader ? " gpTbLeader" : ""}">
  <div class="gpRosterAvatar" style="background:${bg};color:${color}">${esc(initials(nm))}</div>
  <div class="gpRosterInfo">
    <div class="gpRosterName">${esc(nm)}</div>
    ${isLeader ? `<div class="gpTbLeaderBadge">🏆 Leading the tiebreaker</div>` : ""}
    ${saved ? `<div class="gpRosterSavedAt">${esc(nm)} last saved at ${esc(saved)}</div>` : ""}
  </div>
  <div class="gpRosterGuess">${esc(guess)}</div>
</div>`;
          }).join("")
        : `<div class="muted" style="font-size:12px;padding:8px 0">No predictions yet.</div>`;
      everyoneHTML = `
<details class="gpEveryoneDetails">
  <summary class="gpEveryoneSummary">🎯 Everyone's Predictions</summary>
  <div class="gpEveryoneBody">${lines}</div>
</details>`;
    } else {
      everyoneHTML = `<div class="gpEveryoneLocked">🔒 Predictions reveal when the game locks in</div>`;
    }

    return `
<div class="gpTiebreakerCard">
  <div class="gpTiebreakerTitle">🎯 Tiebreaker</div>
  <div class="gpTiebreakerSub">Guess the combined final score: ${esc(safeTeam(away))} @ ${esc(safeTeam(home))}</div>
  ${ou ? `<div class="gpTiebreakerOU">Vegas O/U: ${esc(ou)}</div>` : ""}
  <div class="gpTiebreakerRule">Breaks ties in the standings — closest guess <b>without going over</b> wins.</div>
  <div class="gpTiebreakerRow">
    <input type="number" inputmode="numeric" min="0" max="200" step="1"
      class="gpTiebreakerInput" data-gptiebreakerinput="1" data-eid="${esc(eventId)}"
      value="${esc(val === "" ? "" : String(val))}" ${locked ? "disabled" : ""} placeholder="Total pts"/>
    ${actualTotal != null ? `<div class="gpTiebreakerActual">Actual: ${esc(String(actualTotal))}</div>` : ""}
  </div>
  ${locked ? `<div class="gpLocked">🔒 Locked</div>` : ""}
  ${everyoneHTML}
</div>`;
  }

  // ─── Lock reminder banner ──────────────────────────────────────────
  // ─── League announcement — admin-authored notice at the very top of
  // the week view. Absent entirely (returns "") when there's nothing
  // set, for every user including admins — editing happens in League
  // Settings, not inline here.
  function gpBuildLeagueAnnouncementHTML(announcement) {
    const title   = String(announcement?.title || "").trim();
    const message = String(announcement?.message || "").trim();
    if (!title && !message) return "";
    return `
<div class="gpAnnouncementBanner">
  <div class="gpAnnouncementIcon">📣</div>
  <div class="gpAnnouncementBody">
    ${title ? `<div class="gpAnnouncementTitle">${esc(title)}</div>` : ""}
    ${message ? `<div class="gpAnnouncementMessage">${esc(message)}</div>` : ""}
  </div>
</div>`;
  }

  // Up to 3 announcements, stacked in the order the admin entered them.
  // Each one reuses the exact same banner as a single announcement, so
  // one, two, or three all look consistent — an empty/missing list just
  // renders nothing, same as before.
  function gpBuildLeagueAnnouncementsHTML(announcements) {
    const list = Array.isArray(announcements) ? announcements : [];
    return list.map(gpBuildLeagueAnnouncementHTML).filter(Boolean).join("");
  }

  // Shows whenever this player has open, unlocked games without a pick,
  // and/or an unanswered tiebreaker for this week — every time they land
  // on the league, not just when a lock is imminent, per the "make it
  // feel official" ask. Time-to-lock is still shown as a supplementary
  // detail when it's known, not as a gate on whether the banner appears.
  function gpBuildLockReminderHTML({ missingCount, tiebreakerMissing, minutesUntilLock }) {
    if (!missingCount && !tiebreakerMissing) return "";

    let timeStr = "";
    if (minutesUntilLock != null) {
      const hrs = Math.floor(minutesUntilLock / 60);
      const mins = minutesUntilLock % 60;
      timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }

    const parts = [];
    if (missingCount) {
      parts.push(`${missingCount} game${missingCount !== 1 ? "s" : ""} you haven&#8217;t picked yet`);
    }
    if (tiebreakerMissing) {
      parts.push(`the tiebreaker`);
    }
    const what = parts.join(" and ");
    const lockNote = timeStr ? ` — earliest lock in ${esc(timeStr)}` : "";

    return `
<div class="gpLockBanner">
  <span class="gpLockBannerIcon">⚠️</span>
  <span><b>IMPORTANT:</b> You still have ${what}${lockNote}.</span>
</div>`;
  }

  // ─── Admin builder  (rendered at TOP of page) ────────────────────
  function gpBuildAdminBuilderHTML({
    weekId, weekLabel, availableEvents, leagueKey, dateStart, dateEnd,
    games, atsEventIds, tiebreakerEventId, pickLeagueId
  }) {
    function kickoffMs(ev) {
      const comp = ev?.competitions?.[0];
      const iso  = ev?.date || comp?.date || "";
      const t    = Date.parse(iso);
      return Number.isFinite(t) ? t : 0;
    }

    const LEAGUES = (typeof window.LEAGUES !== "undefined" && Array.isArray(window.LEAGUES))
      ? window.LEAGUES
      : [
          { key: "nfl",   name: "NFL"   }, { key: "cfb",   name: "CFB"   },
          { key: "nba",   name: "NBA"   }, { key: "ncaam", name: "NCAAB" },
          { key: "nhl",   name: "NHL"   }, { key: "mlb",   name: "MLB"   },
          { key: "mls",   name: "MLS"   },
        ];

    const leagueOptions = LEAGUES.map(l => {
      const k = String(l.key);
      return `<option value="${esc(k)}"${k === leagueKey ? " selected" : ""}>${esc(String(l.name || k))}</option>`;
    }).join("");

    function toDateInputVal(dl8) {
      const dl = String(dl8 || "").replace(/-/g, "");
      return /^\d{8}$/.test(dl) ? `${dl.slice(0,4)}-${dl.slice(4,6)}-${dl.slice(6,8)}` : "";
    }
    const startInputVal = toDateInputVal(dateStart);
    const endInputVal   = toDateInputVal(dateEnd);

    // ── summarize + prioritize available events ──
    // Surfaces the games most worth picking first: ranked-vs-ranked
    // matchups, then any game with a ranked team, then close spreads
    // (Vegas thinks it's a toss-up), then everything else chronologically.
    const summarizeFn = window.GP_Admin?.gpAdminSummarizeEvent;
    function summarize(ev) {
      if (typeof summarizeFn === "function") return summarizeFn(ev);
      // Fallback if gp-admin.js hasn't loaded for some reason
      const comp  = ev?.competitions?.[0] || {};
      const comps = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const home  = comps.find(c => c?.homeAway === "home") || comps[1] || {};
      const away  = comps.find(c => c?.homeAway === "away") || comps[0] || {};
      return {
        id: String(ev?.id || ""),
        homeTeam: { name: String(home?.team?.displayName || home?.team?.name || "Home"), rank: null },
        awayTeam: { name: String(away?.team?.displayName || away?.team?.name || "Away"), rank: null },
        kickoffMs: kickoffMs(ev), spreadValue: null, spreadFavoredSide: "", oddsDetails: ""
      };
    }
    // Rank and spread are independent facts about a game, so a game can
    // earn both badges at once (e.g. a ranked matchup that's also a
    // toss-up). "Ranked team" only applies when exactly one side is
    // ranked — a ranked-vs-ranked game shows just "Ranked matchup".
    function priorityFor(summary) {
      const awayRank = Number(summary?.awayTeam?.rank);
      const homeRank = Number(summary?.homeTeam?.rank);
      const awayRanked = Number.isFinite(awayRank) && awayRank > 0;
      const homeRanked = Number.isFinite(homeRank) && homeRank > 0;
      const bothRanked = awayRanked && homeRanked;
      const oneRanked  = (awayRanked || homeRanked) && !bothRanked;

      // summary.spreadValue is null when there's no odds at all — Number(null)
      // is 0, which would otherwise look like a real (tight) spread, so require
      // an actual value before treating this as having odds.
      const spreadVal = Number(summary?.spreadValue);
      const hasSpread = summary?.spreadValue != null && Number.isFinite(spreadVal);
      const isTossup  = hasSpread && spreadVal <= 3;
      const isClose   = hasSpread && !isTossup && spreadVal <= 5;

      const badges = [];
      if (bothRanked) badges.push("🏆 Ranked matchup");
      else if (oneRanked) badges.push("🏅 Ranked team");
      if (isTossup) badges.push("🎯 Toss-up");
      else if (isClose) badges.push("🔥 Close matchup");

      let tier, sortKey;
      if (bothRanked)      { tier = 0; sortKey = awayRank + homeRank; }
      else if (oneRanked)  { tier = 1; sortKey = awayRanked ? awayRank : homeRank; }
      else if (isTossup)   { tier = 2; sortKey = spreadVal; }
      else if (isClose)    { tier = 3; sortKey = spreadVal; }
      else                 { tier = 4; sortKey = 0; }

      return { tier, badges, sortKey };
    }

    const summarized = [...(Array.isArray(availableEvents) ? availableEvents : [])]
      .map(ev => ({ ev, summary: summarize(ev) }))
      .map(x => ({ ...x, priority: priorityFor(x.summary) }))
      .sort((a, b) => {
        if (a.priority.tier !== b.priority.tier) return a.priority.tier - b.priority.tier;
        if (a.priority.tier === 4) return a.summary.kickoffMs - b.summary.kickoffMs;
        return a.priority.sortKey - b.priority.sortKey;
      });

    const sorted = summarized.map(x => x.ev);

    // ── committed games (already added to this week) ──
    const committedGames = [...(Array.isArray(games) ? games : [])].sort((a, b) => startMs(a) - startMs(b));

    // ── ATS games checklist — up to 5 games this week graded against their spread ──
    const MAX_ATS_GAMES_UI = 5;
    let atsHTML = "";
    if (committedGames.length) {
      const atsIdSet = new Set((Array.isArray(atsEventIds) ? atsEventIds : []).map(String));
      const atsRows = committedGames.map(g => {
        const id = String(g?.eventId || g?.id || "");
        const an = safeTeam(g?.awayTeam || { name: g?.awayName });
        const hn = safeTeam(g?.homeTeam || { name: g?.homeName });
        return `
<div class="gpAdminRow">
  <label>
    <input type="checkbox" data-gpatscheck value="${esc(id)}" ${atsIdSet.has(id) ? "checked" : ""} />
    <span style="flex:1;min-width:0">${esc(an)} <span style="color:rgba(255,255,255,0.38)">@</span> ${esc(hn)}</span>
  </label>
</div>`;
      }).join("");
      atsHTML = `
<div class="gpAdminInlineLabel" style="padding:4px 2px 0">Against-the-spread games (up to ${MAX_ATS_GAMES_UI}):</div>
<div class="gpAdminGameList" style="max-height:180px">
  ${atsRows}
</div>
<div class="gpAdminControls">
  <button class="smallBtn" type="button" data-gpaction="adminSetAtsGames" data-weekid="${esc(weekId)}">Save ATS Games</button>
</div>`;
    }

    // ── tiebreaker select (from games already committed to this week) ──
    let tiebreakerHTML = "";
    if (committedGames.length) {
      const options = [`<option value="">— None —</option>`].concat(
        committedGames.map(g => {
          const id = String(g?.eventId || g?.id || "");
          const an = safeTeam(g?.awayTeam || { name: g?.awayName });
          const hn = safeTeam(g?.homeTeam || { name: g?.homeName });
          return `<option value="${esc(id)}"${id === String(tiebreakerEventId || "") ? " selected" : ""}>${esc(an)} @ ${esc(hn)}</option>`;
        })
      ).join("");
      tiebreakerHTML = `
<div class="gpAdminDateRange">
  <span class="gpAdminInlineLabel">Tiebreaker game:</span>
  <select data-gptiebreakerselect="1"
    style="background:rgba(255,255,255,0.07);color:inherit;border:1px solid rgba(255,255,255,0.14);padding:8px 12px;border-radius:12px;font-weight:800;font-size:16px;max-width:100%">
    ${options}
  </select>
  <button class="smallBtn" type="button" data-gpaction="adminSetTiebreaker" data-weekid="${esc(weekId)}">Set</button>
</div>`;
    }

    const gameRows = summarized.map(({ ev, summary, priority }) => {
      const id = String(summary?.id || ev?.id || "");
      if (!id) return "";
      const an = safeTeam(summary.awayTeam);
      const hn = safeTeam(summary.homeTeam);
      const ms = summary.kickoffMs;
      const started  = ms > 0 && ms < Date.now();
      const oddsLine   = summary.oddsDetails ? `Fav: ${summary.oddsDetails}` : "";
      const badgesHTML = (priority.badges || [])
        .map(b => `<span class="gpAdminPriorityBadge">${esc(b)}</span>`).join("");
      return `
<div class="gpAdminRow">
  <label>
    <input type="checkbox" data-gpgamesel value="${esc(id)}" />
    <span style="flex:1;min-width:0">
      <span style="display:block">${esc(an)} <span style="color:rgba(255,255,255,0.38)">@</span> ${esc(hn)}</span>
      ${(badgesHTML || oddsLine) ? `<span style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">
        ${badgesHTML}
        ${oddsLine ? `<span class="gpAdminOddsHint">${esc(oddsLine)}</span>` : ""}
      </span>` : ""}
    </span>
    <span class="gpAdminTime">
      ${ms ? `<span class="gpAdminTimeDate">${esc(fmtShortDate(ms))}</span>` : ""}
      <span class="gpAdminTimeClock">${ms ? esc(fmtTime(ms)) : ""}${started ? " ✓" : ""}</span>
    </span>
  </label>
</div>`;
    }).join("");

    return `
<div class="gpAdminPanel" data-gpadminpanel>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
    <div class="gpAdminPanelTitle">⚙ Admin · ${esc(weekLabel || weekId || "")}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="smallBtn" type="button" data-gpaction="editLeague" data-leagueid="${esc(pickLeagueId || "")}">League Settings</button>
      <button class="smallBtn" type="button" data-gpaction="adminCreateWeek" data-leagueid="${esc(pickLeagueId || "")}">+ New Week</button>
    </div>
  </div>
  <div class="gpAdminControls">
    <select data-league-select style="background:rgba(255,255,255,0.07);color:inherit;border:1px solid rgba(255,255,255,0.14);padding:8px 12px;border-radius:12px;font-weight:800;font-size:16px">
      ${leagueOptions}
    </select>
    <button class="smallBtn" type="button" data-gpaction="adminQuickWeekRange">This Week (Thu–Mon)</button>
  </div>
  <div class="gpAdminDateRange">
    <span class="gpAdminInlineLabel">From</span>
    <input type="date" data-date-start-input value="${esc(startInputVal)}"
      style="background:rgba(255,255,255,0.07);color:inherit;border:1px solid rgba(255,255,255,0.14);padding:8px 12px;border-radius:12px;font-weight:800;font-size:16px"/>
    <span class="gpAdminInlineLabel">to</span>
    <input type="date" data-date-end-input value="${esc(endInputVal)}"
      style="background:rgba(255,255,255,0.07);color:inherit;border:1px solid rgba(255,255,255,0.14);padding:8px 12px;border-radius:12px;font-weight:800;font-size:16px"/>
    <button class="smallBtn" type="button" data-gpaction="adminLoadGames">Load</button>
  </div>
  <div id="gpAdminGameList" class="gpAdminGameList">
    ${sorted.length ? gameRows : `<div class="muted" style="font-size:13px">No games loaded yet — tap Load.</div>`}
  </div>
  ${sorted.length ? `
  <div class="gpAdminControls">
    <button class="smallBtn" type="button" data-gpselect="all">All</button>
    <button class="smallBtn" type="button" data-gpselect="none">None</button>
    <button class="smallBtn" type="button" data-gpaction="adminAddGames" data-weekid="${esc(weekId)}">Add Selected</button>
  </div>` : ""}
  ${committedGames.length ? `
  <div class="gpAdminControls">
    <button class="smallBtn" type="button" data-gpaction="adminPublish" data-weekid="${esc(weekId)}" data-leagueid="${esc(pickLeagueId || "")}">Publish Week</button>
  </div>` : ""}
  ${atsHTML}
  ${tiebreakerHTML}
  <div class="gpAdminStatus" id="gpAdminStatus"></div>
</div>`;
  }

  // ─── Main group picks card block ──────────────────────────────────
  function gpBuildSectionHeaderHTML(label, theme, subtitle) {
    return `
<div class="gpPicksSectionHeader gpPicksSection-${esc(theme || "")}">
  <span class="gpPicksSectionLine"></span>
  <span class="gpPicksSectionLabel">${esc(label)}</span>
  <span class="gpPicksSectionLine"></span>
</div>
${subtitle ? `<div class="gpPicksSectionSubtitle">${subtitle}</div>` : ""}`;
  }

  function gpBuildGroupPicksCardHTML({
    weekId, weekLabel, games, myMap, published, allPicks, isAdmin,
    atsEventIds, tiebreakerEventId, tiebreakers, myTiebreakerGuess, pendingTiebreakerGuess,
    lockReminder, h2hFormat, h2hSchedule, weekIndex, leagueMembers
  }) {
    if (!weekId) {
      return `<div class="gpEmpty">No active week yet. Ask your admin to create one.</div>`;
    }
    if (!published && !isAdmin) {
      return `<div class="gpEmpty">Week not published yet. Check back soon.</div>`;
    }

    const list = Array.isArray(games) ? games : [];
    if (!list.length) {
      return `<div class="gpNotice">No games in this week yet.</div>`;
    }

    const pendingGet = window.gpPendingGet || (() => "");
    const isDraft    = !published && isAdmin;
    const atsIdSet   = new Set((Array.isArray(atsEventIds) ? atsEventIds : []).map(String));

    const sorted = [...list].sort((a, b) => startMs(a) - startMs(b));
    const straightGames = sorted.filter(g => !atsIdSet.has(String(g?.eventId || g?.id || "")));
    const atsGames      = sorted.filter(g => atsIdSet.has(String(g?.eventId || g?.id || "")));

    const straightCardsHTML = straightGames.map(g => buildGameCard(g, weekId, myMap, pendingGet, false, isAdmin)).filter(Boolean).join("");
    const atsCardsHTML      = atsGames.map(g => buildGameCard(g, weekId, myMap, pendingGet, true, isAdmin)).filter(Boolean).join("");

    const GP_Data = window.GP_Data || {};
    let leaderboardHTML = "";
    let recapHTML = "";
    let matchupsHTML = "";
    if (!isDraft) {
      const lb = typeof GP_Data.gpComputeWeeklyLeaderboard === "function"
        ? GP_Data.gpComputeWeeklyLeaderboard(list, allPicks, { atsEventIds: [...atsIdSet], tiebreakers, tiebreakerEventId })
        : { rows: [], finalsCount: 0 };
      leaderboardHTML = buildLeaderboardHTML(weekLabel, lb, { leagueMembers, games: list, allPicks });

      if (h2hFormat && typeof GP_Data.gpGetH2HRoundForWeek === "function" && typeof GP_Data.gpComputeH2HWeekResults === "function") {
        const round = GP_Data.gpGetH2HRoundForWeek(h2hSchedule, weekIndex);
        const results = GP_Data.gpComputeH2HWeekResults(round, lb.rows);
        matchupsHTML = gpBuildH2HMatchupsHTML(results, weekLabel);
      }

      // Recap only once every committed game for the week has gone
      // final — same signal the season view uses to permanently cache a
      // week, so it's never shown (or shown wrong) mid-week.
      if (lb.finalsCount > 0 && lb.finalsCount === list.length) {
        const recap = typeof GP_Data.gpComputeWeeklyRecap === "function"
          ? GP_Data.gpComputeWeeklyRecap(list, lb, tiebreakers, tiebreakerEventId, lb.tiebreakerActual)
          : null;
        recapHTML = gpBuildWeeklyRecapHTML(recap, weekLabel);
      }
    }

    // ── tiebreaker section (last, right before the save row) ──
    let tiebreakerHTML = "";
    if (tiebreakerEventId) {
      const tbGame = list.find(g => String(g?.eventId || g?.id || "") === String(tiebreakerEventId));
      if (tbGame) {
        const tbMs     = startMs(tbGame);
        // No admin bypass here, unlike some other admin affordances — once
        // the tiebreaker game starts, the input locks for everyone.
        const tbLocked = tbMs > 0 && Date.now() >= tbMs;
        const live     = tbGame?.__live || null;
        const isFinal  = String(live?.state || tbGame?.finalState || "").toLowerCase() === "post";
        const homeNum  = Number(live?.homeScore ?? tbGame?.finalHomeScore ?? NaN);
        const awayNum  = Number(live?.awayScore ?? tbGame?.finalAwayScore ?? NaN);
        const actualTotal = (isFinal && Number.isFinite(homeNum) && Number.isFinite(awayNum)) ? (homeNum + awayNum) : null;
        tiebreakerHTML = gpBuildSectionHeaderHTML("🎯 Tiebreaker", "tiebreaker") + gpBuildTiebreakerCardHTML({
          game: tbGame,
          myGuess: myTiebreakerGuess,
          pendingGuess: pendingTiebreakerGuess,
          locked: tbLocked,
          actualTotal,
          tiebreakers
        });
      }
    }

    const saveRow = `
<div class="gpSaveRow">
  <button class="smallBtn" type="button" data-gpaction="savePicks" disabled>Save</button>
  <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.4)">Saves your pending picks</span>
</div>`;

    return `
${isDraft ? `<div style="padding:0 0 10px"><span class="gpDraftBadge">DRAFT — only admins see this</span></div>` : ""}
${lockReminder || ""}
${matchupsHTML}
${recapHTML}
${leaderboardHTML}
${straightCardsHTML ? gpBuildSectionHeaderHTML(
  "🏈 Outright Winners", "outright",
  "Pick the team you think will <b>win the game</b> — margin of victory doesn't matter, just get the winner right."
) + straightCardsHTML : ""}
${atsCardsHTML ? gpBuildSectionHeaderHTML(
  "📈 Against the Spread", "ats",
  `Pick the team you think will <b>cover the spread</b>, not just win outright. Example: Ohio State &minus;7.5 must win by 8+ points to cover. The underdog (+7.5) covers with a loss of 7 points or less &mdash; or a win.`
) + atsCardsHTML : ""}
${tiebreakerHTML}
${saveRow}`;
  }

  // ─── Loading blip — shown while the Picks page does a full render ──
  // phase 1 (light — league picker, 5s): the gif + a rotating joke.
  // phase 2 (heavy — inside an actual league, 4s): the "one more
  // second" photo. Only one plays per render, chosen by what's about
  // to load, not stacked together.
  const GP_LOADING_JOKES = [
    "Please be patient — the page is loading while we make sure Connor Stallions isn't in the stands filming our picks.",
    "Hang tight… sweeping the press box for hidden cameras and anyone in a hoodie who looks a little too interested in our signs.",
    "Loading… also confirming nobody bought a same-day sideline pass just to scout this pick&#8217;em league.",
    "One sec — encrypting your picks so they don&#8217;t end up in a $500,000 scouting operation.",
  ];
  function gpBuildLoadingBlipHTML(phase) {
    if (phase === 2) {
      return `
<div class="gpLoadingBlip">
  <div id="gpLoadingBlipInner">
    <img class="gpLoadingPhoto" src="onemoresecond.jpg" alt="" />
    <div class="gpLoadingSub">Hold on, we just need one more second&#8230;</div>
  </div>
</div>`;
    }
    const joke = GP_LOADING_JOKES[Math.floor(Math.random() * GP_LOADING_JOKES.length)];
    return `
<div class="gpLoadingBlip">
  <div id="gpLoadingBlipInner">
    <img class="gpLoadingGif" src="spygate.gif" alt="" />
    <div class="gpLoadingTitle">Hang tight, loading the pick&#8217;em page&#8230;</div>
    <div class="gpLoadingSub">${joke}</div>
  </div>
</div>`;
  }

  // ─── Header ─────────────────────────────────────────────────────
  function renderPicksHeaderHTML({ leagueName, isAdmin, showLeaguesBtn, showSaveBtn = true, playerName }) {
    const welcomeName = String(playerName || "").trim();
    return `
<div class="gpPageHeader">
  <div class="gpHeaderTopRow">
    ${welcomeName ? `<div class="gpHeaderWelcome">Welcome, ${esc(welcomeName)}</div>` : ""}
    <div class="gpHeaderTitleBlock">
      <div class="gpHeaderTitle">Pick&#8217;em<span>${esc(leagueName || "Group Picks")}</span></div>
    </div>
  </div>
  <div class="gpHeaderActions">
    ${showLeaguesBtn ? `<button class="smallBtn gpHeaderBtn" type="button" data-gpaction="showLeaguePicker">Leagues</button>` : ""}
    <button class="smallBtn gpHeaderBtn" type="button" data-gpaction="name">Logout</button>
    ${showSaveBtn ? `<button class="smallBtn gpHeaderBtn" type="button" data-gpaction="savePicks" disabled>Save</button>` : ""}
    <button class="smallBtn gpHeaderBtn" type="button" data-gpaction="refresh">↺</button>
  </div>
</div>`;
  }

  // ─── Week pager (◀ Week N ▶ — replaces the old week dropdown) ─────
  function gpBuildWeekPagerHTML({ weekLabel, isDraft, canPrev, canNext }) {
    return `
<div class="gpWeekPager">
  <button type="button" class="gpWeekPagerArrow" data-gpaction="weekPrev" ${canPrev ? "" : "disabled"} aria-label="Previous week">‹</button>
  <div class="gpWeekPagerLabel">
    <div class="gpWeekPagerTitle">${esc(weekLabel || "")}</div>
    ${isDraft ? `<div class="gpWeekPagerSub">Draft</div>` : ""}
  </div>
  <button type="button" class="gpWeekPagerArrow" data-gpaction="weekNext" ${canNext ? "" : "disabled"} aria-label="Next week">›</button>
</div>`;
  }

  // ─── League picker (shown after identity, before entering a league) ──
  function gpBuildLeaguePickerHTML({ leagues, isAdmin }) {
    const list = Array.isArray(leagues) ? leagues : [];
    const visible = list.filter(l => !l.archived || isAdmin);
    const sorted  = [...visible].sort((a, b) => {
      if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const cards = sorted.map(l => {
      const weeksCount = Array.isArray(l.weeks) ? l.weeks.length : 0;
      const totalWeeks = Number(l.totalWeeks) || 0;
      const weeksLabel = totalWeeks ? `${weeksCount} of ${totalWeeks} weeks` : `${weeksCount} week${weeksCount !== 1 ? "s" : ""}`;
      const meta = `${esc(String(l.seasonYear || ""))} · ${weeksLabel}${l.archived ? " · Archived" : ""}`;
      const activePill = (l.active && !l.archived) ? `<span class="gpLeagueActivePill"><span class="gpLeagueActiveDot"></span>Active</span>` : "";
      const isMember = !!l.isMember;
      const cta = isMember
        ? `<div class="gpLeagueCardCtaGroup">
    <div class="gpLeagueCardCta gpLeagueCardCtaVisit">Visit League ›</div>
    <div class="gpLeagueCardCtaInvite" data-gpaction="inviteToLeague" data-leagueid="${esc(l.id)}" data-leaguename="${esc(l.name || "")}" title="Invite someone to this league">📤 Invite</div>
  </div>`
        : `<div class="gpLeagueCardCta gpLeagueCardCtaJoin">Join</div>`;

      // Countdown to the current week's first kickoff — groupPicks.js
      // stashes this on the league object before handing it here (a
      // week's games aren't otherwise fetched on the picker screen).
      // Once that week is actually underway there's nothing meaningful
      // to count down to, so the row just doesn't render.
      const cdLabel = l.currentWeekLabel ? `${l.currentWeekLabel} starts in` : "Next week starts in";
      const countdownHTML = (!l.archived && l.currentWeekFirstKickoffMs != null)
        ? gpBuildCountdownWidgetHTML({ label: cdLabel, targetMs: l.currentWeekFirstKickoffMs })
        : "";
      const countdownRowHTML = countdownHTML ? `<div class="gpLeagueCardCountdownRow">${countdownHTML}</div>` : "";

      return `
<div class="gpLeagueCard${l.archived ? " gpLeagueArchived" : ""}" data-gpaction="${isMember ? "selectLeague" : "openJoinOverlay"}" data-leagueid="${esc(l.id)}">
  <div class="gpLeagueCardMain">
    <div class="gpLeagueCardIcon">🏈</div>
    <div class="gpLeagueCardInfo">
      <div class="gpLeagueCardName">${esc(l.name || "League")}${activePill}</div>
      <div class="gpLeagueCardMeta">${meta}</div>
    </div>
    ${cta}
    ${isAdmin ? `<div class="gpLeagueCardGear" data-gpaction="editLeague" data-leagueid="${esc(l.id)}" title="League settings">⚙</div>` : ""}
  </div>
  ${countdownRowHTML}
</div>`;
    }).join("");

    const createTile = isAdmin
      ? `<div class="gpLeagueCreateTile" data-gpaction="createLeague">+ Create League</div>`
      : "";

    const empty = !sorted.length
      ? `<div class="gpEmpty">${isAdmin ? "No leagues yet — create one to get started." : "No leagues yet. Check back soon."}</div>`
      : "";

    return `
<div class="gpLeaguePickerGrid">
  ${empty}
  ${cards}
  ${createTile}
</div>`;
  }

  // ─── Join League overlay — shown before a first-time visitor enters a
  // league, so joining feels like a real decision rather than an
  // accidental tap. Reuses the same bottom-sheet shell as the player
  // picks overlay (gpPicksOverlayBackdrop/Sheet) for a consistent feel.
  function gpBuildJoinLeagueOverlayHTML({ league, members }) {
    const list = Array.isArray(members) ? members : [];
    const weeksCount = Array.isArray(league?.weeks) ? league.weeks.length : 0;
    const totalWeeks = Number(league?.totalWeeks) || 0;
    const weeksLabel = totalWeeks ? `${weeksCount} of ${totalWeeks}` : String(weeksCount);
    const formatLabel = league?.format === "h2h" ? "Head-to-Head" : "Points";

    const memberRows = list.map(m => {
      const { bg, color } = avatarStyle(String(m.name || "Someone"));
      return `
<div class="gpJoinMemberRow">
  <div class="gpJoinMemberAvatar" style="background:${bg};color:${color}">${esc(initials(m.name))}</div>
  <div class="gpJoinMemberName">${esc(m.name)}</div>
</div>`;
    }).join("");

    const membersHTML = list.length
      ? `<div class="gpJoinMembersList">${memberRows}</div>`
      : `<div class="gpJoinMembersEmpty">Nobody's joined yet — be the first! 🎉</div>`;

    return `
<div class="gpPicksOverlayBackdrop" id="gpJoinOverlay" role="dialog" aria-modal="true" aria-label="Join ${esc(league?.name || "League")}">
  <div class="gpPicksOverlaySheet" id="gpJoinOverlaySheet">
    <div class="gpOverlayHandle"></div>
    <div class="gpOverlayHeader">
      <div class="gpOverlayTitle">
        <div class="gpJoinHeaderIcon">🏈</div>
        <div>
          <div class="gpOverlayName">${esc(league?.name || "League")}</div>
          <div class="gpOverlaySubtitle">${esc(String(league?.seasonYear || ""))} &middot; ${esc(formatLabel)}</div>
        </div>
      </div>
      <button class="gpOverlayCloseBtn" id="gpJoinOverlayClose" aria-label="Close">✕</button>
    </div>
    <div class="gpOverlayBody">
      <div class="gpJoinStatsRow">
        <div class="gpJoinStatTile">
          <div class="gpJoinStatNum">${esc(weeksLabel)}</div>
          <div class="gpJoinStatLabel">Weeks</div>
        </div>
        <div class="gpJoinStatTile">
          <div class="gpJoinStatNum">${list.length}</div>
          <div class="gpJoinStatLabel">Player${list.length !== 1 ? "s" : ""} In</div>
        </div>
      </div>
      <div class="gpJoinMembersLabel">Who&#8217;s already playing</div>
      ${membersHTML}
    </div>
    <div class="gpJoinCtaRow">
      <button class="gpJoinCtaBtn" type="button" data-gpaction="confirmJoinLeague" data-leagueid="${esc(league?.id || "")}">
        Join League 🏆
      </button>
    </div>
  </div>
</div>`;
  }

  function gpShowJoinLeagueOverlay(league, members) {
    const existing = document.getElementById("gpJoinOverlay");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", gpBuildJoinLeagueOverlayHTML({ league, members }));

    const backdrop = document.getElementById("gpJoinOverlay");
    const sheet    = document.getElementById("gpJoinOverlaySheet");
    const closeBtn = document.getElementById("gpJoinOverlayClose");
    if (!backdrop) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => backdrop.classList.add("gpOverlayVisible"));
    });

    function dismiss() {
      backdrop.classList.remove("gpOverlayVisible");
      backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
    }

    closeBtn?.addEventListener("click", dismiss);
    backdrop.addEventListener("click", (e) => {
      if (!sheet.contains(e.target)) dismiss();
    });
    function onKey(e) {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onKey); }
    }
    document.addEventListener("keydown", onKey);
  }

  function gpDismissJoinLeagueOverlay() {
    const backdrop = document.getElementById("gpJoinOverlay");
    if (backdrop) backdrop.remove();
  }

  // ─── League settings form (create or edit) ────────────────────────
  function gpBuildLeagueSettingsHTML({ mode, league, registeredPlayers, leagueMembers }) {
    const isEdit = mode === "edit" && league;
    const name    = esc(String(league?.name ?? ""));
    const year    = Number(league?.seasonYear) || new Date().getFullYear();
    const totalWeeks = Number(league?.totalWeeks) || "";
    const archived = !!league?.archived;
    const isH2H = league?.format === "h2h";
    // Backward-compat: a league saved before multi-announcement support
    // only has the old singular `announcement` field — treat it as slot 1.
    const existingAnnouncements = Array.isArray(league?.announcements)
      ? league.announcements
      : (league?.announcement ? [league.announcement] : []);
    const announcementSlotsHTML = [0, 1, 2].map(i => {
      const a = existingAnnouncements[i] || {};
      const t = esc(String(a?.title ?? ""));
      const m = esc(String(a?.message ?? ""));
      return `
    <div class="gpAnnouncementSlot">
      <div class="gpLeagueSettingsLabel">Announcement ${i + 1}</div>
      <input type="text" id="gpLeagueAnnouncementTitle${i}" class="gpLeagueSettingsInput" value="${t}" placeholder="e.g. Playoffs start next week!" maxlength="60"/>
      <textarea id="gpLeagueAnnouncementMessage${i}" class="gpLeagueSettingsInput" rows="2" maxlength="280"
        placeholder="Optional message shown below the title" style="margin-top:8px">${m}</textarea>
    </div>`;
    }).join("");

    // Registered players (anyone who's ever completed the name+code screen)
    // get a checkbox each; the roster's chosen names not found in that
    // list (someone who hasn't logged in yet) fall through to the
    // free-text "add anyone else" box below instead.
    const registered = Array.isArray(registeredPlayers) ? registeredPlayers : [];
    const rosterNames = Array.isArray(league?.h2hRoster) ? league.h2hRoster : [];
    const registeredNameSet = new Set(registered.map(p => String(p.name).toLowerCase()));
    const selectedSet = new Set(rosterNames.map(n => String(n).toLowerCase()));
    const extraNames = rosterNames.filter(n => !registeredNameSet.has(String(n).toLowerCase()));
    const rosterText = esc(extraNames.join("\n"));

    // Who has actually joined this league — admin-only visibility, using
    // the same avatar/name row styling as the player-facing Join overlay.
    const membersList = Array.isArray(leagueMembers) ? leagueMembers : [];
    const membersRowsHTML = membersList.map(m => {
      const { bg, color } = avatarStyle(String(m.name || "Someone"));
      return `
      <div class="gpJoinMemberRow">
        <div class="gpJoinMemberAvatar" style="background:${bg};color:${color}">${esc(initials(m.name))}</div>
        <div class="gpJoinMemberName">${esc(m.name)}</div>
      </div>`;
    }).join("");
    const membersSectionHTML = isEdit ? `
  <div class="gpLeagueSettingsRow">
    <div class="gpLeagueSettingsLabel">Joined Players (${membersList.length})</div>
    ${membersList.length
      ? `<div class="gpJoinMembersList">${membersRowsHTML}</div>`
      : `<div class="gpJoinMembersEmpty">Nobody's joined this league yet.</div>`}
  </div>` : "";

    const playerChecklistHTML = registered.length ? `
    <div class="gpH2HPlayerChecklist">
      ${registered.map(p => `
      <label class="gpH2HPlayerCheckRow">
        <input type="checkbox" data-gp-h2h-player="1" value="${esc(p.name)}" ${selectedSet.has(String(p.name).toLowerCase()) ? "checked" : ""}/>
        <span>${esc(p.name)}</span>
      </label>`).join("")}
    </div>` : `<div class="muted" style="font-size:12px">No registered players yet — they'll show up here once someone logs in on the entry page.</div>`;

    return `
<div class="gpLeagueSettingsForm" data-leagueid="${esc(league?.id || "")}">
  <div class="gpAdminPanelTitle">${isEdit ? "⚙ League Settings" : "⚙ Create League"}</div>
  <div class="gpLeagueSettingsRow">
    <div class="gpLeagueSettingsLabel">League Name</div>
    <input type="text" id="gpLeagueName" class="gpLeagueSettingsInput" value="${name}" placeholder="e.g. Work League" maxlength="40"/>
  </div>
  ${membersSectionHTML}
  <div class="gpLeagueSettingsRow">
    <div class="gpLeagueSettingsLabel">Season Year</div>
    <input type="number" id="gpLeagueYear" class="gpLeagueSettingsInput" value="${esc(String(year))}"/>
  </div>
  <div class="gpLeagueSettingsRow">
    <div class="gpLeagueSettingsLabel">Number of Weeks</div>
    <input type="number" id="gpLeagueTotalWeeks" class="gpLeagueSettingsInput" min="1" step="1"
      value="${esc(String(totalWeeks))}" placeholder="e.g. 12 (leave blank for no fixed length)"/>
  </div>
  <div class="gpLeagueSettingsRow">
    <div class="gpLeagueSettingsLabel">Format</div>
    <select id="gpLeagueFormat" class="gpLeagueSettingsInput" data-gp-format-select="1">
      <option value="points" ${!isH2H ? "selected" : ""}>Points (cumulative leaderboard)</option>
      <option value="h2h" ${isH2H ? "selected" : ""}>Head-to-Head (weekly matchups)</option>
    </select>
  </div>
  <div class="gpLeagueSettingsRow" id="gpLeagueH2HRosterRow" ${isH2H ? "" : 'style="display:none"'}>
    <div class="gpLeagueSettingsLabel">Head-to-Head Roster</div>
    ${playerChecklistHTML}
    <div class="muted" style="font-size:12px;margin-top:10px">Add anyone not listed above:</div>
    <textarea id="gpLeagueH2HRoster" class="gpLeagueSettingsInput" rows="3"
      placeholder="One player name per line (or comma-separated)&#10;e.g. Alice, Bob">${rosterText}</textarea>
    <div class="muted" style="font-size:12px;margin-top:4px">The season schedule is auto-generated (round robin) and only reshuffles if you change this roster.</div>
  </div>
  <div class="gpLeagueSettingsRow">
    <div class="gpLeagueSettingsLabel">League Announcements (up to 3)</div>
    <div class="muted" style="font-size:12px;margin-bottom:6px">Shown stacked at the top of the week view for everyone in this league. Leave a slot's fields blank to remove it.</div>
    ${announcementSlotsHTML}
  </div>
  ${isEdit ? `
  <label class="gpLeagueSettingsCheckRow">
    <input type="checkbox" id="gpLeagueArchived" ${archived ? "checked" : ""}/>
    <span class="muted" style="font-weight:800">Archived (hidden from players)</span>
  </label>` : ""}
  <div class="gpLeagueSettingsActions">
    <button class="smallBtn" type="button" data-gpaction="submitLeagueSettings" data-leagueid="${esc(league?.id || "")}">${isEdit ? "Save Settings" : "Create League"}</button>
    <button class="smallBtn" type="button" data-gpaction="cancelLeagueSettings">Cancel</button>
  </div>
</div>`;
  }

  // ─── Select all / none helper ────────
  function gpApplyAdminSelection(mode) {
    const checks = document.querySelectorAll("[data-gpgamesel]");
    checks.forEach(c => { c.checked = (mode === "all"); });
  }

  // ─── Leaderboard row click → player overlay ──────────────────────
  // Delegated listener: tapping any .gpStandingsRow fires the overlay.
  // Requires window.__gpCurrentGames and window.__gpCurrentAllPicks to be
  // kept up-to-date by groupPicks.js (the orchestrator) after each render.
  if (!window.__GP_LEADER_ROW_BOUND) {
    window.__GP_LEADER_ROW_BOUND = true;
    document.addEventListener("click", (e) => {
      const row = e.target.closest(".gpStandingsRow[data-gpplayername]");
      if (!row) return;
      const playerName = String(row.getAttribute("data-gpplayername") || "");
      if (!playerName) return;

      const games      = Array.isArray(window.__gpCurrentGames)       ? window.__gpCurrentGames       : [];
      const allPicks   = window.__gpCurrentAllPicks || {};
      const atsEventIds = Array.isArray(window.__gpCurrentAtsEventIds) ? window.__gpCurrentAtsEventIds : [];
      const tiebreakerEventId = String(window.__gpCurrentTiebreakerEventId || "");
      const tiebreakers       = window.__gpCurrentTiebreakers || {};

      // allPicks shape: { [eventId]: [ { name, side }, ... ] }
      // We need to flip it to { [eventId]: { side } } for this player
      const picksMap = {};
      for (const [eventId, arr] of Object.entries(allPicks)) {
        if (!Array.isArray(arr)) continue;
        const entry = arr.find(p => String(p?.name || "") === playerName);
        if (entry?.side) picksMap[eventId] = { side: entry.side };
      }

      // tiebreakers shape: { [playerKey]: { name, guess, updatedAt } } —
      // keyed by uid, not name, so find this player's guess by name.
      const myTiebreaker = Object.values(tiebreakers).find(t => String(t?.name || "") === playerName) || null;

      gpShowPlayerPicksOverlay(playerName, games, picksMap, atsEventIds, tiebreakerEventId, myTiebreaker);
    });
  }

  // ─── Expose public API ──────────────────────────────────────────
  window.GP_Render = {
    renderPicksHeaderHTML,
    gpBuildLoadingBlipHTML,
    gpBuildWeekPagerHTML,
    gpBuildLeaguePickerHTML,
    gpBuildLeagueSettingsHTML,
    gpBuildGroupPicksCardHTML,
    gpBuildAdminBuilderHTML,
    buildLeaderboardHTML,
    buildSeasonLeaderboardHTML,
    gpBuildH2HMatchupsHTML,
    gpBuildH2HSeasonStandingsHTML,
    gpBuildViewToggleHTML,
    gpBuildTiebreakerCardHTML,
    gpBuildLockReminderHTML,
    gpBuildLeagueAnnouncementHTML,
    gpBuildLeagueAnnouncementsHTML,
    gpApplyAdminSelection,
    gpShowPlayerPicksOverlay,
    gpBuildJoinLeagueOverlayHTML,
    gpShowJoinLeagueOverlay,
    gpDismissJoinLeagueOverlay,
    gpEarliestKickoffMs,
  };

})();
