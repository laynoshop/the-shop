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
  padding: 10px 14px 10px;
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
.gpHeaderTop {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.gpHeaderTitle {
  font-size: 20px; font-weight: 900; color: #fff;
  letter-spacing: 0.02em; line-height: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpHeaderTitle span {
  display: block; font-size: 11px; font-weight: 600;
  color: rgba(255,255,255,0.45); letter-spacing: 0.08em;
  text-transform: uppercase; margin-top: 2px;
}
.gpHeaderActions {
  margin-left: auto;
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.gpSubline {
  display: flex; align-items: center; gap: 8px;
  overflow-x: auto; -webkit-overflow-scrolling: touch;
  scrollbar-width: none; padding-bottom: 2px;
}
.gpSubline::-webkit-scrollbar { display: none; }

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
  font-size: 12px; font-weight: 600;
  color: rgba(255,255,255,0.42); white-space: nowrap;
  margin-left: auto; flex-shrink: 0;
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
.gpScoreCard.gpPickedCard {
  border-left-color: rgba(80,200,120,0.8) !important;
  background: rgba(0,200,100,0.05);
}
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
  text-overflow: ellipsis; max-width: 100%;
}
.gpMatchup {
  display: flex; flex-direction: column;
  padding: 6px 12px 10px; gap: 2px;
}

/* Team pick buttons */
.gpTeamPickBtn {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 0; min-height: 44px; border-radius: 8px;
  background: none; border: none; width: 100%;
  text-align: left; cursor: pointer;
  transition: background 150ms ease;
  -webkit-tap-highlight-color: transparent;
}
.gpTeamPickBtn:active { background: rgba(255,255,255,0.05); }
.gpTeamPickBtn.gpPickRowActive {
  background: rgba(80,200,120,0.12);
  border-radius: 8px;
}
.gpTeamPickBtn.gpPickRowActive .gpTeamName { color: #6dff9a; }
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
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 7px 12px 9px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.gpYouPicked {
  font-size: 12px; font-weight: 900;
  color: rgba(100,255,160,0.9); letter-spacing: 0.03em;
}
.gpYouPicked.gpPending { color: rgba(255,210,60,0.9); }
.gpNoPick  { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.3); }
.gpLocked  { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.3); }

/* Everyone's Picks expandable */
.gpEveryoneDetails {
  padding: 0 12px 8px;
}
.gpEveryoneSummary {
  font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.38);
  cursor: pointer; list-style: none; user-select: none;
  -webkit-tap-highlight-color: transparent;
  letter-spacing: 0.04em;
}
.gpEveryoneSummary::-webkit-details-marker { display: none; }
.gpEveryoneSummary::before { content: "▸ "; font-size: 10px; }
details[open] .gpEveryoneSummary::before { content: "▾ "; }
.gpEveryoneBody { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.gpPickLine {
  font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.7);
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.gpPickLine:last-child { border-bottom: none; }
.gpPickLine b { color: #fff; }

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

/* Header bar */
.gpLeaderHeader {
  display: flex; align-items: center; justify-content: space-between;
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

/* Standings list */
.gpLeaderList {
  display: flex; flex-direction: column;
  padding: 4px 10px 6px;
  gap: 5px;
}

.gpLeaderRow {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255,255,255,0.035);
  border: 1px solid rgba(255,255,255,0.06);
  transition: background 150ms ease;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.gpLeaderRow:active { background: rgba(255,255,255,0.07); }

/* Rank number circle */
.gpLeaderRankBadge {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.6);
  font-variant-numeric: tabular-nums;
}

/* Avatar initials circle in list */
.gpLeaderAvatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 900; text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.10);
}

.gpLeaderInfo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.gpLeaderName {
  font-size: 15px; font-weight: 800; color: #eee;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.2;
}

/* Record + pick breakdown */
.gpLeaderRecord {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.gpRecordBadge {
  font-size: 12px; font-weight: 900; letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.7);
}
.gpRecordBreakdown {
  font-size: 11px; font-weight: 700;
  color: rgba(255,255,255,0.32);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpRecordBreakdown .gpDogCount  { color: rgba(120,190,255,0.7); }
.gpRecordBreakdown .gpFavCount  { color: rgba(255,160,160,0.7); }

/* Points pill */
.gpLeaderPtsPill {
  display: flex; align-items: baseline; gap: 2px;
  padding: 5px 11px; border-radius: 999px;
  white-space: nowrap; flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.6);
}
.gpLeaderPtsNum  { font-size: 16px; font-weight: 900; line-height: 1; }
.gpLeaderPtsUnit { font-size: 11px; font-weight: 800; opacity: 0.7; margin-left: 1px; }

/* Scoring legend — bottom of card */
.gpLeaderScoringFooter {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 10px 16px 14px;
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

  function safeOddsLine(g) {
    const hydratedDetails   = String(g?.__odds?.details   || "").trim();
    const hydratedOverUnder = String(g?.__odds?.overUnder  || "").trim();
    const legacyDetails     = String(g?.oddsDetails || g?.odds?.details || "").trim();
    const legacyOverUnder   = String(g?.odds?.overUnder || "").trim();
    const d  = hydratedDetails   || legacyDetails;
    const ou = hydratedOverUnder || legacyOverUnder;
    const parts = [];
    if (d)  parts.push(`Fav: ${d}`);
    if (ou) parts.push(`O/U ${ou}`);
    return parts.join("  ·  ");
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
      bodyEl.innerHTML = `<div class="muted" style="font-size:12px">Loading…</div>`;
      try {
        const Data = () => window.GP_Data || {};
        await (Data().ensureFirebaseReadySafe || (async () => {}))();
        const db  = firebase.firestore();
        const all = await (Data().gpEnsureAllPicksForWeek || (async () => ({})))(db, weekId);
        const arr = Array.isArray(all?.[eventId]) ? all[eventId] : [];
        const awayName = String(det.getAttribute("data-away") || "Away");
        const homeName = String(det.getAttribute("data-home") || "Home");
        if (!arr.length) {
          bodyEl.innerHTML = `<div class="muted" style="font-size:12px">No picks yet.</div>`;
        } else {
          bodyEl.innerHTML = arr.map(p => {
            const nm   = esc(String(p?.name || "Someone"));
            const side = String(p?.side || "");
            const team = esc(side === "away" ? awayName : side === "home" ? homeName : side);
            return `<div class="gpPickLine"><b>${nm}</b> → ${team}</div>`;
          }).join("");
        }
        bodyEl.setAttribute("data-loaded", "1");
      } catch {
        const bodyEl2 = document.getElementById(bodyId);
        if (bodyEl2) bodyEl2.innerHTML = `<div class="muted" style="font-size:12px">Couldn't load picks.</div>`;
      }
    }, true);
  }

  // ─── Single game card ────────────────────────────────────────────
  function buildGameCard(g, weekId, myMap, pendingGet) {
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

    let cardCls = "gpScoreCard";
    if (isLive)  cardCls += " gpCardLive";
    if (hasPick) cardCls += " gpPickedCard";

    const leagueKey = String(g?.leagueKey || "").trim();
    const LEAGUE_COLORS = {
      nfl: "#013369", cfb: "#8B1A1A", nba: "#C9082A", ncaam: "#003087",
      nhl: "#1E90FF", mlb: "#002D72", mls: "#005DAA",
    };
    const borderColor = LEAGUE_COLORS[leagueKey] || "#555";

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
    </div>
  </div>
  ${kickoffDate || kickoffTime ? `
  <div style="padding:4px 12px 0;display:flex;justify-content:space-between;gap:8px">
    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35)">${esc(kickoffDate)}</div>
    <div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.35)">${esc(kickoffTime)}</div>
  </div>` : ""}
  ${venueLine ? `<div class="gpVenueLine">${esc(venueLine)}</div>` : ""}
  <div class="gpMatchup">
    <button class="gpTeamPickBtn${awayActive ? " gpPickRowActive" : ""}${awayFade ? " gpFaded" : ""}"
      type="button"
      ${locked ? "disabled" : ""}
      data-gppick="away" data-eid="${esc(eventId)}" data-slate="${esc(weekId)}">
      ${logoImg(awayLogo, safeAbbr(away))}
      <div class="gpTeamInfo">
        <div class="gpTeamName">${esc(safeTeam(away))}</div>
        ${safeRecord(away) ? `<div class="gpTeamMeta">${esc(safeRecord(away))}</div>` : ""}
      </div>
      ${showScores ? scoreHTML(awayScore, awayWinner, isFinal && !awayWinner) : ""}
    </button>
    <button class="gpTeamPickBtn${homeActive ? " gpPickRowActive" : ""}${homeFade ? " gpFaded" : ""}"
      type="button"
      ${locked ? "disabled" : ""}
      data-gppick="home" data-eid="${esc(eventId)}" data-slate="${esc(weekId)}">
      ${logoImg(homeLogo, safeAbbr(home))}
      <div class="gpTeamInfo">
        <div class="gpTeamName">${esc(safeTeam(home))}</div>
        ${safeRecord(home) ? `<div class="gpTeamMeta">${esc(safeRecord(home))}</div>` : ""}
      </div>
      ${showScores ? scoreHTML(homeScore, homeWinner, isFinal && !homeWinner) : ""}
    </button>
  </div>
  <div class="gpPickStrip">
    <div>
      ${hasPick
        ? `<div class="gpYouPicked${isPending ? " gpPending" : ""}">${isPending ? "⏳ Pending: " : "✓ Picked: "}${esc(my === "away" ? safeTeam(away) : safeTeam(home))}</div>`
        : locked ? `<div class="gpLocked">🔒 Locked</div>` : `<div class="gpNoPick">No pick yet</div>`}
    </div>
    <details class="gpEveryoneDetails" data-gpeveryone="1"
      data-weekid="${esc(weekId)}" data-eid="${esc(eventId)}"
      data-away="${esc(safeTeam(away))}" data-home="${esc(safeTeam(home))}">
      <summary class="gpEveryoneSummary">Everyone's Picks</summary>
      <div class="gpEveryoneBody" id="gpEv_${esc(weekId)}_${esc(eventId)}">
        <div class="muted" style="font-size:12px">Loading picks…</div>
      </div>
    </details>
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

  // ─── Pick breakdown helper ────────────────────────────────────────
  function pickBreakdown(u) {
    const dogs = Number(u?.dogWins ?? 0);
    const favs = Number(u?.favWins ?? 0);
    if (!dogs && !favs) return "";
    const parts = [];
    if (dogs) parts.push(`<span class="gpDogCount">🐶 ${dogs} dog${dogs !== 1 ? "s" : ""}</span>`);
    if (favs) parts.push(`<span class="gpFavCount">❤️ ${favs} fav${favs !== 1 ? "s" : ""}</span>`);
    return parts.join(" &middot; ");
  }

  // ─── Player Picks Overlay ─────────────────────────────────────────
  // Builds the bottom-sheet overlay showing one player's picks for the week.
  // `playerName`  — display name string
  // `games`       — array of game objects (same shape as used by buildGameCard)
  // `picksMap`    — { [eventId]: { side: "away"|"home" } }  (the player's picks for this week)
  function gpBuildPlayerPicksOverlayHTML(playerName, games, picksMap) {
    const nm = String(playerName || "Someone");
    const { bg, color } = avatarStyle(nm);
    const list = Array.isArray(games) ? [...games].sort((a, b) => startMs(a) - startMs(b)) : [];

    const rows = list.map(g => {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";

      const away = g?.awayTeam || { name: g?.awayName || "Away", abbr: "", logo: g?.awayLogo || "" };
      const home = g?.homeTeam || { name: g?.homeName || "Home", abbr: "", logo: g?.homeLogo || "" };
      const awayLogo = String(g?.awayLogo || away?.logo || "").trim();
      const homeLogo = String(g?.homeLogo || home?.logo || "").trim();

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

      // Determine result from live state
      const live      = g?.__live || g?.live || null;
      const state     = String(live?.state || "").toLowerCase();
      const isFinal   = state === "post";
      const awayScore = Number(live?.awayScore ?? -1);
      const homeScore = Number(live?.homeScore ?? -1);
      let resultCls   = "gpResultPending";
      let resultIcon  = "·";
      if (isFinal && awayScore >= 0 && homeScore >= 0) {
        const pickedWon = side === "away" ? awayScore > homeScore : homeScore > awayScore;
        resultCls  = pickedWon ? "gpResultWin"  : "gpResultLoss";
        resultIcon = pickedWon ? "✓"            : "✕";
      }

      const logoEl = pickedLogo
        ? `<img class="gpOverlayPickTeamLogo" src="${esc(pickedLogo)}" alt="${esc(safeAbbr(pickedTeam))}" loading="lazy" width="36" height="36" onerror="this.style.display='none'"/>`
        : `<div class="gpOverlayPickTeamLogoPlaceholder">${esc(safeAbbr(pickedTeam).slice(0,3))}</div>`;

      return `
<div class="gpOverlayPickRow">
  ${logoEl}
  <div style="flex:1;min-width:0">
    <div class="gpOverlayPickTeamName">${esc(safeTeam(pickedTeam))}</div>
    <div class="gpOverlayPickGameLabel">vs ${esc(safeTeam(oppTeam))}</div>
  </div>
  <div class="gpOverlayPickResult ${resultCls}">${resultIcon}</div>
</div>`;
    }).filter(Boolean).join("");

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
      ${rows || `<div class="gpOverlayEmpty">No picks to show.</div>`}
    </div>
  </div>
</div>`;
  }

  // ─── Show / dismiss overlay (DOM management) ─────────────────────
  function gpShowPlayerPicksOverlay(playerName, games, picksMap) {
    // Remove any existing overlay first
    const existing = document.getElementById("gpPicksOverlay");
    if (existing) existing.remove();

    // Inject into body
    document.body.insertAdjacentHTML("beforeend",
      gpBuildPlayerPicksOverlayHTML(playerName, games, picksMap)
    );

    const backdrop = document.getElementById("gpPicksOverlay");
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

  // ─── Leaderboard ─────────────────────────────────────────────────
  function buildLeaderboardHTML(weekLabel, leaderboard) {
    const { rows, finalsCount } = leaderboard || {};
    const list  = Array.isArray(rows) ? rows : [];
    const label = String(weekLabel || "");

    const scoringFooter = `
<div class="gpLeaderScoringFooter">
  <span>🐶 Underdog = 2 pts</span>
  <span>❤️ Favorite = 1 pt</span>
</div>`;

    // ── No finals yet ──
    if (!finalsCount) {
      return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Leaderboard</div>
      ${label ? `<div class="gpLeaderWeekLabel">${esc(label)}</div>` : ""}
    </div>
  </div>
  <div class="gpEmpty" style="padding:28px 20px">
    <div style="font-size:28px;margin-bottom:8px">⏳</div>
    <div style="font-size:14px;font-weight:800;color:rgba(255,255,255,0.5)">Leaderboard locks in once games go final</div>
  </div>
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
      ${label ? `<div class="gpLeaderWeekLabel">${esc(label)}</div>` : ""}
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
    const allRows = list.map((u, i) => {
      const rank   = i + 1;
      const nm     = String(u?.name || "Someone");
      const pts    = Number(u?.points ?? 0);
      const wins   = Number(u?.wins   ?? 0);
      const losses = Number(u?.losses ?? 0);
      const { bg, color } = avatarStyle(nm);

      const record    = `${wins}–${losses}`;
      const breakdown = pickBreakdown(u);

      const topStyle = rank <= 3
        ? rank === 1 ? " style=\"border-color:rgba(255,210,60,0.18);background:rgba(255,200,40,0.05)\""
        : rank === 2 ? " style=\"border-color:rgba(190,190,210,0.14)\""
        : " style=\"border-color:rgba(200,120,60,0.14)\""
        : "";

      // Encode name safely for data attribute (esc handles quotes)
      return `
<div class="gpLeaderRow" data-gpplayername="${esc(nm)}"${topStyle}>
  <div class="gpLeaderRankBadge">${esc(String(rank))}</div>
  <div class="gpLeaderAvatar" style="background:${bg};color:${color}">${esc(initials(nm))}</div>
  <div class="gpLeaderInfo">
    <div class="gpLeaderName">${esc(nm)}</div>
    <div class="gpLeaderRecord">
      <span class="gpRecordBadge">${esc(record)}</span>
      ${breakdown ? `<span class="gpRecordBreakdown">${breakdown}</span>` : ""}
    </div>
  </div>
  <div class="gpLeaderPtsPill">
    <span class="gpLeaderPtsNum">${esc(String(pts))}</span>
    <span class="gpLeaderPtsUnit">pts</span>
  </div>
</div>`;
    }).join("");

    return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Leaderboard</div>
      ${label ? `<div class="gpLeaderWeekLabel">${esc(label)}</div>` : ""}
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
  <div class="gpLeaderList">${allRows}</div>
  ${scoringFooter}
</div>`;
  }

  // ─── Admin builder  (rendered at TOP of page) ────────────────────
  function gpBuildAdminBuilderHTML({ weekId, weekLabel, availableEvents, leagueKey, dateLabel }) {
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

    const dl           = String(dateLabel || "").replace(/-/g, "");
    const dateInputVal = /^\d{8}$/.test(dl) ? `${dl.slice(0,4)}-${dl.slice(4,6)}-${dl.slice(6,8)}` : "";

    const sorted = [...(Array.isArray(availableEvents) ? availableEvents : [])]
      .sort((a, b) => kickoffMs(a) - kickoffMs(b));

    const gameRows = sorted.map(ev => {
      const id   = String(ev?.id || "");
      if (!id) return "";
      const comp  = ev?.competitions?.[0];
      const comps = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const home  = comps.find(c => c?.homeAway === "home") || comps[1] || {};
      const away  = comps.find(c => c?.homeAway === "away") || comps[0] || {};
      const hn    = String(home?.team?.displayName || home?.team?.name || "Home").trim();
      const an    = String(away?.team?.displayName || away?.team?.name || "Away").trim();
      const ms    = kickoffMs(ev);
      const started = ms > 0 && ms < Date.now();
      return `
<div class="gpAdminRow">
  <label>
    <input type="checkbox" data-gpgamesel value="${esc(id)}" />
    <span style="flex:1;min-width:0">${esc(an)} <span style="color:rgba(255,255,255,0.38)">@</span> ${esc(hn)}</span>
    <span class="gpAdminTime">${ms ? esc(fmtTime(ms)) : ""}${started ? " ✓" : ""}</span>
  </label>
</div>`;
    }).join("");

    return `
<div class="gpAdminPanel" data-gpadminpanel>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
    <div class="gpAdminPanelTitle">⚙ Admin · ${esc(weekLabel || weekId || "")}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="smallBtn" type="button" data-gpaction="adminCreateWeek">+ New Week</button>
    </div>
  </div>
  <div class="gpAdminControls">
    <select data-league-select style="background:rgba(255,255,255,0.07);color:inherit;border:1px solid rgba(255,255,255,0.14);padding:8px 12px;border-radius:12px;font-weight:800;font-size:13px">
      ${leagueOptions}
    </select>
    <input type="date" data-date-input value="${esc(dateInputVal)}"
      style="background:rgba(255,255,255,0.07);color:inherit;border:1px solid rgba(255,255,255,0.14);padding:8px 12px;border-radius:12px;font-weight:800;font-size:13px"/>
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
    <button class="smallBtn" type="button" data-gpaction="adminPublish" data-weekid="${esc(weekId)}">Publish Week</button>
  </div>` : ""}
  <div class="gpAdminStatus" id="gpAdminStatus"></div>
</div>`;
  }

  // ─── Main group picks card block ──────────────────────────────────
  function gpBuildGroupPicksCardHTML({ weekId, weekLabel, games, myMap, published, allPicks, isAdmin }) {
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

    const sorted    = [...list].sort((a, b) => startMs(a) - startMs(b));
    const gameCards = sorted.map(g => buildGameCard(g, weekId, myMap, pendingGet)).filter(Boolean);

    const GP_Data = window.GP_Data || {};
    let leaderboardHTML = "";
    if (!isDraft) {
      const lb = typeof GP_Data.gpComputeWeeklyLeaderboard === "function"
        ? GP_Data.gpComputeWeeklyLeaderboard(list, allPicks)
        : { rows: [], finalsCount: 0 };
      leaderboardHTML = buildLeaderboardHTML(weekLabel, lb);
    }

    const saveRow = `
<div class="gpSaveRow">
  <button class="smallBtn" type="button" data-gpaction="savePicks" disabled>Save</button>
  <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.4)">Saves your pending picks</span>
</div>`;

    return `
${isDraft ? `<div style="padding:0 0 10px"><span class="gpDraftBadge">DRAFT — only admins see this</span></div>` : ""}
${leaderboardHTML}
${gameCards.join("")}
${saveRow}`;
  }

  // ─── Header ─────────────────────────────────────────────────────
  function renderPicksHeaderHTML({ weekSelectHTML, weekId, weekLabel, isAdmin }) {
    return `
<div class="gpPageHeader">
  <div class="gpHeaderTop">
    <div class="gpHeaderTitle">Picks<span>Group Picks${weekLabel ? " · " + weekLabel : ""}</span></div>
    <div class="gpHeaderActions">
      <button class="smallBtn" type="button" data-gpaction="name">Name</button>
      <button class="smallBtn" type="button" data-gpaction="savePicks" disabled>Save</button>
      <button class="smallBtn" type="button" data-gpaction="refresh">↺</button>
    </div>
  </div>
  <div class="gpSubline">
    ${weekSelectHTML || ""}
  </div>
</div>`;
  }

  // ─── Select all / none helper ────────
  function gpApplyAdminSelection(mode) {
    const checks = document.querySelectorAll("[data-gpgamesel]");
    checks.forEach(c => { c.checked = (mode === "all"); });
  }

  // ─── Leaderboard row click → player overlay ──────────────────────
  // Delegated listener: tapping any .gpLeaderRow fires the overlay.
  // Requires window.__gpCurrentGames and window.__gpCurrentAllPicks to be
  // kept up-to-date by groupPicks.js (the orchestrator) after each render.
  if (!window.__GP_LEADER_ROW_BOUND) {
    window.__GP_LEADER_ROW_BOUND = true;
    document.addEventListener("click", (e) => {
      const row = e.target.closest(".gpLeaderRow[data-gpplayername]");
      if (!row) return;
      const playerName = String(row.getAttribute("data-gpplayername") || "");
      if (!playerName) return;

      const games    = Array.isArray(window.__gpCurrentGames)    ? window.__gpCurrentGames    : [];
      const allPicks = window.__gpCurrentAllPicks || {};

      // allPicks shape: { [eventId]: [ { name, side }, ... ] }
      // We need to flip it to { [eventId]: { side } } for this player
      const picksMap = {};
      for (const [eventId, arr] of Object.entries(allPicks)) {
        if (!Array.isArray(arr)) continue;
        const entry = arr.find(p => String(p?.name || "") === playerName);
        if (entry?.side) picksMap[eventId] = { side: entry.side };
      }

      gpShowPlayerPicksOverlay(playerName, games, picksMap);
    });
  }

  // ─── Expose public API ──────────────────────────────────────────
  window.GP_Render = {
    renderPicksHeaderHTML,
    gpBuildGroupPicksCardHTML,
    gpBuildAdminBuilderHTML,
    buildLeaderboardHTML,
    gpApplyAdminSelection,
    gpShowPlayerPicksOverlay,
  };

})();
