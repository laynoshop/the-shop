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

/* Guarantee the native [hidden] attribute always actually hides —
   without this, any element elsewhere in this file that sets its own
   "display" (flex/grid/etc.) at the same specificity as the browser's
   built-in [hidden] rule silently wins over it by source order, so
   toggling .hidden in JS updates the attribute but nothing visually
   changes. Bit us once already (the Admin Tools collapse toggle); this
   is a blanket fix so it can't happen again anywhere in this file. */
[hidden] { display: none !important; }

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
/* Five equal-width buttons truncating their own labels ("Leag…",
   "Chan…") was the old approach — replaced with a fixed hierarchy: a
   ⋮ menu (Leagues/Change Code/Logout, all secondary and infrequent)
   on the left, Refresh + Save — the two things actually touched every
   visit — full-width and legible on the right. */
.gpHeaderActions {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px;
}
.gpHeaderActionsLeft {
  display: flex; align-items: center; gap: 8px;
}
.gpHeaderActionsRight {
  display: flex; align-items: center; gap: 8px;
}
.gpHeaderAdminBtn {
  background: rgba(255,200,0,0.12);
  border-color: rgba(255,200,0,0.35);
  color: rgba(255,222,120,0.95);
}
.gpHeaderIconBtn {
  flex: 0 0 auto;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 12px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.92);
  font-size: 18px; line-height: 1;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}
.gpHeaderIconBtn:active { background: rgba(255,255,255,0.16); transform: scale(0.96); }
.gpHeaderSaveBtn {
  flex: 0 0 auto;
  padding: 10px 24px;
  border-radius: 12px;
  font-size: 14.5px; font-weight: 800; letter-spacing: 0.02em;
  color: #fff;
  background: linear-gradient(135deg, #d81f1f, #970d0d);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 6px 16px rgba(187,0,0,0.35);
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}
.gpHeaderSaveBtn:active { transform: scale(0.97); }
.gpHeaderSaveBtn:disabled {
  color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.06);
  border-color: rgba(255,255,255,0.1);
  box-shadow: none;
  cursor: default;
}

/* ── Header ⋮ menu overlay (Leagues / Change Code / Logout) ── */
.gpMenuRow {
  display: flex; align-items: center; gap: 14px;
  width: 100%;
  padding: 14px 6px;
  background: none; border: none;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.92);
  font: inherit;
  font-size: 15px; font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.gpMenuRow:last-child { border-bottom: none; }
.gpMenuRow:active { background: rgba(255,255,255,0.05); }
.gpMenuRowIcon { font-size: 19px; flex: 0 0 auto; width: 24px; text-align: center; }
.gpMenuRowLogout { color: #ff9d9d; }

/* ══════════════════════════════════════════════
   GP AUTH CARD — login + change-password screens
   Shared component so "enter your name/password" and "set a new
   password" read as one designed moment instead of two different
   generic score-card layouts repurposed for credential entry.
   ══════════════════════════════════════════════ */
.gpAuthWrap {
  display: flex; justify-content: center;
  padding-top: 14px;
}
.gpAuthCard {
  width: 100%; max-width: 420px;
  position: relative;
  padding: 30px 22px 26px;
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: 0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
  overflow: hidden;
}
.gpAuthCard::before {
  content: "";
  position: absolute;
  top: -70px; left: 50%;
  width: 240px; height: 240px;
  transform: translateX(-50%);
  background: radial-gradient(circle, rgba(216,31,31,0.32), transparent 70%);
  pointer-events: none;
}
.gpAuthIconBadge {
  position: relative;
  width: 56px; height: 56px;
  margin: 0 auto 16px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 18px;
  background: linear-gradient(135deg, #d81f1f, #8f0c0c);
  box-shadow: 0 10px 24px rgba(187,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25);
  font-size: 26px;
}
.gpAuthEyebrow {
  position: relative;
  text-align: center;
  font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  margin-bottom: 6px;
}
.gpAuthTitle {
  position: relative;
  text-align: center;
  font-size: 21px; font-weight: 900; color: #fff;
  letter-spacing: -0.01em; line-height: 1.25;
  margin-bottom: 8px;
}
.gpAuthBlurb {
  position: relative;
  text-align: center;
  font-size: 13.5px; font-weight: 600; line-height: 1.5;
  color: rgba(255,255,255,0.6);
  max-width: 320px; margin: 0 auto 22px;
}
.gpAuthFields { position: relative; display: flex; flex-direction: column; gap: 14px; }
.gpAuthField { text-align: left; }
.gpAuthLabel {
  font-size: 11.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  margin-bottom: 7px;
}
.gpAuthInput {
  width: 100%; box-sizing: border-box;
  padding: 15px 16px;
  border-radius: 14px;
  background: rgba(0,0,0,0.28);
  border: 1.5px solid rgba(255,255,255,0.1);
  color: #fff; font-weight: 700; font-size: 16px;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.gpAuthInput::placeholder { color: rgba(255,255,255,0.32); font-weight: 600; }
.gpAuthInput:focus { border-color: rgba(216,31,31,0.65); background: rgba(0,0,0,0.36); }
.gpAuthInput.gpAuthInputMatch { border-color: rgba(90,200,120,0.6); }
.gpAuthInput.gpAuthInputMismatch { border-color: rgba(226,80,80,0.65); }
.gpAuthMatchHint {
  margin-top: 7px;
  font-size: 12.5px; font-weight: 800;
  min-height: 15px;
}
.gpAuthMatchHint.ok { color: #6fd08a; }
.gpAuthMatchHint.bad { color: #ff8f8f; }
.gpAuthHelp {
  margin-top: 6px;
  font-size: 12px; font-weight: 700;
  color: rgba(255,255,255,0.4);
}
.gpAuthRememberRow {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  margin-top: 16px;
}
.gpAuthRememberRow input[type="checkbox"] { width: 18px; height: 18px; accent-color: #d81f1f; }
.gpAuthRememberRow span { font-size: 13.5px; font-weight: 700; color: rgba(255,255,255,0.65); }
.gpAuthActions {
  position: relative;
  display: flex; flex-direction: column; gap: 10px;
  margin-top: 22px;
}
.gpAuthPrimaryBtn {
  width: 100%;
  padding: 15px;
  border-radius: 14px;
  font-size: 15.5px; font-weight: 800; letter-spacing: 0.01em;
  color: #fff;
  background: linear-gradient(135deg, #d81f1f, #970d0d);
  border: 1px solid rgba(255,255,255,0.14);
  box-shadow: 0 10px 22px rgba(187,0,0,0.35);
  cursor: pointer;
  transition: transform 0.1s ease;
}
.gpAuthPrimaryBtn:active { transform: scale(0.98); }
.gpAuthPrimaryBtn:disabled { opacity: 0.45; box-shadow: none; cursor: default; }
.gpAuthGhostBtn {
  width: 100%;
  padding: 12px;
  border-radius: 14px;
  font-size: 14px; font-weight: 700;
  color: rgba(255,255,255,0.55);
  background: transparent;
  border: none;
  cursor: pointer;
}
.gpAuthGhostBtn:active { color: rgba(255,255,255,0.85); }
.gpAuthError {
  position: relative;
  margin-top: 14px;
  text-align: center;
  font-size: 13px; font-weight: 800;
  color: #ff8f8f;
  min-height: 16px;
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
   GP ADMIN BUILDER  (Admin Tools overlay content)
   Restyled as labeled blocks (Load / Available / Publish / ATS /
   Tiebreaker) instead of one undifferentiated stack of controls, so the
   workflow reads left-to-right, top-to-bottom without guessing what
   each row does. Every data-gpaction / data-* hook is unchanged — this
   only touches markup structure and appearance.
   ══════════════════════════════════════════════ */
.gpAdminPanel {
  background: rgba(255,200,0,0.055);
  border: 1px solid rgba(255,200,0,0.22);
  border-radius: 16px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05);
}
.gpAdminOverlayTop {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}
/* Still used by League Settings' own header block (icon + "Editing
   League"/"League Settings" label), not just the old admin panel. */
.gpAdminHead {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap;
}
.gpAdminHeadTitle { display: flex; align-items: center; gap: 10px; min-width: 0; }
.gpAdminHeadIcon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,200,0,0.14); border: 1px solid rgba(255,200,0,0.32);
  font-size: 17px;
}
.gpAdminHeadLabel {
  font-size: 10px; font-weight: 900; letter-spacing: 0.12em;
  text-transform: uppercase; color: rgba(255,220,80,0.75);
  line-height: 1.3;
}
.gpAdminHeadWeek {
  font-size: 16px; font-weight: 900; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpAdminHeadActions { display: flex; gap: 8px; flex-wrap: wrap; }

.gpAdminBlock {
  display: flex; flex-direction: column; gap: 9px;
  padding-top: 14px;
  border-top: 1px solid rgba(255,255,255,0.07);
}
.gpAdminBlock:first-of-type { padding-top: 0; border-top: none; }
.gpAdminBlockLabel {
  display: flex; align-items: center; gap: 7px;
  font-size: 11.5px; font-weight: 900; letter-spacing: 0.05em;
  text-transform: uppercase; color: rgba(255,255,255,0.55);
}
.gpAdminBlockCount {
  background: rgba(255,200,0,0.16); color: rgba(255,222,120,0.95);
  border-radius: 999px; padding: 1px 8px; font-size: 10.5px;
}
.gpAdminBlockHint {
  font-weight: 700; text-transform: none; letter-spacing: 0;
  color: rgba(255,255,255,0.35); font-size: 10.5px;
}

/* Buttons — ghost for secondary/navigational actions, primary (amber)
   for the main action in a block, publish (green) for the one action
   that takes a week live. Scoped to the admin panel so the shared global
   .smallBtn class elsewhere in the app is untouched. */
.gpAdminPanel .gpAdminBtn {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.16);
  color: rgba(255,255,255,0.8);
  padding: 9px 14px; border-radius: 10px;
  font-weight: 800; font-size: 13px;
  cursor: pointer; white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: transform 100ms ease, background 100ms ease;
}
.gpAdminPanel .gpAdminBtn:active { transform: scale(0.97); }
.gpAdminPanel .gpAdminBtnGhost:active { background: rgba(255,255,255,0.11); }
.gpAdminPanel .gpAdminBtnPrimary {
  background: linear-gradient(135deg, rgba(255,195,50,0.92), rgba(255,140,20,0.92));
  border-color: rgba(255,195,70,0.6);
  color: #241700;
  box-shadow: 0 4px 14px rgba(255,160,0,0.25);
}
.gpAdminPanel .gpAdminBtnPublish {
  background: linear-gradient(135deg, #1a8f5c, #2ecf82);
  border-color: rgba(70,225,150,0.6);
  color: #052b16;
  font-size: 14.5px; padding: 12px 18px;
  box-shadow: 0 4px 18px rgba(40,200,120,0.32);
  width: 100%;
}

.gpAdminControls {
  display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
}
.gpAdminDateRange { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.gpAdminInlineLabel { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.4); }
.gpAdminSelect, .gpAdminDateInput {
  background: rgba(255,255,255,0.07); color: inherit;
  border: 1px solid rgba(255,255,255,0.16);
  padding: 9px 12px; border-radius: 10px;
  font-weight: 800; font-size: 14px;
}
.gpAdminSelectWide { flex: 1 1 160px; min-width: 0; }

.gpAdminGameList {
  display: flex; flex-direction: column; gap: 6px;
  max-height: 280px; overflow-y: auto;
}
.gpAdminEmptyHint {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.4);
  text-align: center; padding: 16px 10px;
  background: rgba(255,255,255,0.03); border-radius: 10px;
  border: 1px dashed rgba(255,255,255,0.12);
}
.gpAdminRow label {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px; border-radius: 10px;
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
.gpAdminStatusError { color: rgba(255,110,110,0.9); }

/* ══════════════════════════════════════════════
   SCORE CARD  (matches scores-render.js exactly)
   ══════════════════════════════════════════════ */
.gpScoreCard {
  position: relative; display: flex; flex-direction: row; align-items: stretch; gap: 0;
  background: rgba(255,255,255,0.045); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
}
.gpScoreCard.gpCardLive { background: rgba(200,0,0,0.07); }
/* Type bar — thick enough to carry a rotated label ("OUTRIGHT WINNER" /
   "AGAINST THE SPREAD") instead of the old 4px color-only sliver, so the
   pick type stays legible card-by-card while scrolling a long section
   without widening the card itself — gpCardBody's own paddings/font
   sizes were trimmed slightly to give this room without wrapping. */
.gpCardTypeBar {
  flex: 0 0 24px;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.gpCardTypeBarLabel {
  display: inline-block; white-space: nowrap;
  transform: rotate(-90deg);
  font-size: 10px; font-weight: 900; letter-spacing: 0.09em;
  text-transform: uppercase; color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.35);
}
.gpCardBody {
  flex: 1 1 auto; min-width: 0;
  display: flex; flex-direction: column;
}
.gpCardHeader {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 8px 10px 6px;
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
/* Date/kickoff-time row, below the header — the broadcast logo moved
   here (stacked above the time, right-justified) instead of sitting in
   gpCardHeaderRight, where it was crowding the odds line to the point
   of getting clipped. */
.gpCardDateTimeRow {
  padding: 4px 10px 0; display: flex; justify-content: space-between;
  align-items: flex-start; gap: 8px;
}
.gpCardDateCol { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gpCardDateText { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.35); }
.gpCardTimeCol { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.gpCardTimeTop { display: flex; align-items: center; gap: 6px; }
.gpCardTimeText { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.35); }
.gpLeagueBadge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 2px 8px; border-radius: 5px;
  background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.13);
  color: rgba(255,255,255,0.5); flex-shrink: 0; white-space: nowrap;
}
.gpBroadcastChip {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
  padding: 2px 7px; border-radius: 5px;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.13);
  color: rgba(255,255,255,0.55); flex-shrink: 0; white-space: nowrap;
}
.gpBroadcastChip.gpBroadcastChipLogo {
  background: #fff; border-color: rgba(0,0,0,0.06); padding: 3px 8px;
}
.gpBroadcastChip.gpBroadcastChipBare { background: transparent; border: none; padding: 0; }
.gpBroadcastChip.gpBroadcastChipBare .gpBroadcastLogoImg { border-radius: 3px; }
.gpBroadcastChip.gpBroadcastChipBare .gpBroadcastLogoFallback { color: rgba(255,255,255,0.55); }
.gpBroadcastLogoImg { height: 13px; width: auto; max-width: 60px; display: block; }
.gpBroadcastLogoFallback { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #222; }
.gpMatchup {
  display: flex; flex-direction: column;
  padding: 6px 10px 10px; gap: 6px;
}

/* Team pick buttons — the subtle border on every option is a "tap to
   pick" affordance. Once chosen it goes a neutral bold gray (no verdict
   yet — win/loss isn't decided), then green once the game is final and
   the pick was right, or red if it was wrong. A push (ATS) or tie
   (straight) is neither, so it stays neutral gray permanently. */
.gpTeamPickBtn {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; min-height: 44px; border-radius: 10px;
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
  width: 36px; height: 36px; object-fit: contain;
  border-radius: 10px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.10); padding: 3px;
  flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}
.gpTeamLogoPlaceholder {
  width: 36px; height: 36px; display: inline-flex;
  align-items: center; justify-content: center; border-radius: 10px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.10);
  color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 800;
  letter-spacing: 0.3px; flex-shrink: 0;
}
.gpTeamInfo { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.gpTeamName {
  font-size: 15px; font-weight: 800; color: #eee;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.15; letter-spacing: 0.1px;
}
.gpTeamMeta {
  font-size: 11px; color: rgba(255,255,255,0.42);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.2;
}
.gpScore {
  font-size: 24px; font-weight: 900; color: rgba(255,255,255,0.88);
  min-width: 34px; text-align: right; flex-shrink: 0;
  font-variant-numeric: tabular-nums; letter-spacing: -0.5px;
  line-height: 1; text-shadow: 0 0 10px rgba(255,200,0,0.2);
}
.gpScore.gpWinner { color: #fff; text-shadow: 0 0 12px rgba(255,220,80,0.55), 0 0 28px rgba(255,160,0,0.25); }
.gpScore.gpLoser  { color: rgba(255,255,255,0.3); text-shadow: none; }

.gpVenueLine {
  /* Nested inside gpCardDateCol now (paired with gpCardTimeCol in the
     same row) rather than a standalone full-width line below it, so no
     horizontal padding of its own — gpCardDateTimeRow already has it. */
  padding: 0 0 8px; font-size: 11px; min-width: 0;
  color: rgba(255,255,255,0.28); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
}
.gpVenueLine::before { content: "📍 "; }

/* Pick badge strip at bottom of card */
.gpPickStrip {
  display: flex; flex-direction: column; align-items: stretch;
  gap: 6px; padding: 7px 10px 9px;
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

/* Pick tally — two tiles (logo beside a big pick count) shown at the top
   of Everyone's Picks, before the roster list, so the group's split is
   visible at a glance before scanning who picked what. */
.gpPickTally {
  display: flex; align-items: center; justify-content: center;
  gap: 14px; padding: 14px 4px 12px;
}
.gpPickTallySquare {
  display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 12px;
  flex: 1; max-width: 150px;
  padding: 12px 16px;
  border-radius: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  transition: background 150ms ease, border-color 150ms ease;
}
.gpPickTallySquare.gpPickTallyLeading {
  background: linear-gradient(160deg, rgba(255,190,40,0.14) 0%, rgba(255,255,255,0.03) 100%);
  border-color: rgba(255,200,60,0.4);
  box-shadow: 0 0 0 1px rgba(255,200,60,0.12), 0 8px 22px rgba(0,0,0,0.35);
}
.gpPickTallyLogo {
  width: 48px; height: 48px; object-fit: contain;
  border-radius: 12px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1); padding: 4px;
}
.gpPickTallyLogoPlaceholder {
  width: 48px; height: 48px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 900; letter-spacing: 0.3px;
}
.gpPickTallyCount {
  font-size: 30px; font-weight: 950; line-height: 1;
  color: rgba(255,255,255,0.55);
  font-variant-numeric: tabular-nums;
}
.gpPickTallySquare.gpPickTallyLeading .gpPickTallyCount {
  color: #fff; text-shadow: 0 0 16px rgba(255,200,60,0.4);
}
.gpPickTallyVs {
  font-size: 10.5px; font-weight: 900; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.28); flex-shrink: 0;
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

/* Save row — reuses .gpHeaderSaveBtn so the bottom Save button looks
   and behaves identically to the header's (same red-gradient CTA,
   same disabled state, same [data-gpaction="savePicks"] toggle via
   syncSaveBtnState). Stacked instead of side-by-side with the caption
   so the button can stay full-width like its header counterpart. */
.gpSaveRow {
  padding: 12px 14px 4px;
  display: flex; flex-direction: column; align-items: stretch; gap: 8px;
}
.gpSaveRow > span { text-align: center; }

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
  padding: 14px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpH2HMatchupRow:last-child { border-bottom: none; }
.gpH2HName {
  flex: 1 1 0; min-width: 0;
  font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.75);
  /* Wraps instead of truncating — a long name should always be fully
     readable, never cut off with an ellipsis. */
  overflow-wrap: break-word; word-break: break-word; line-height: 1.25;
}
.gpH2HNameLeft { text-align: left; }
.gpH2HNameRight { text-align: right; }
.gpH2HName.gpH2HWinner { color: #fff; }
.gpH2HScoreCluster {
  flex-shrink: 0; display: flex; align-items: center; gap: 10px;
  padding: 7px 14px; border-radius: 999px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}
.gpH2HPts {
  font-size: 21px; font-weight: 900; letter-spacing: -0.01em;
  color: rgba(255,255,255,0.5); font-variant-numeric: tabular-nums;
  min-width: 20px; text-align: center;
}
.gpH2HPts.gpH2HPtsWin {
  color: #ffd76a;
  text-shadow: 0 0 14px rgba(255,215,100,0.55);
}
.gpH2HVs {
  font-size: 9.5px; font-weight: 900; letter-spacing: 0.1em;
  text-transform: uppercase; color: rgba(255,255,255,0.3);
  flex-shrink: 0;
}
.gpH2HByeRow { justify-content: space-between; }
.gpH2HByeLabel {
  font-size: 11px; font-weight: 800; letter-spacing: 0.06em;
  text-transform: uppercase; color: rgba(255,255,255,0.35);
  flex-shrink: 0;
}
.gpH2HMatchupRowClickable { cursor: pointer; -webkit-tap-highlight-color: transparent; }
.gpH2HMatchupRowClickable:active { background: rgba(255,255,255,0.04); }

/* Weekly High Score callout — Matchup tab */
.gpH2HHighScoreCallout {
  display: flex; align-items: center; gap: 12px;
  margin: 0 0 14px; padding: 14px 16px; border-radius: 16px;
  background: linear-gradient(120deg, rgba(255,120,40,0.14) 0%, rgba(20,10,10,0.7) 70%);
  border: 1px solid rgba(255,140,60,0.28);
}
.gpH2HHighScoreIcon { font-size: 24px; flex-shrink: 0; }
.gpH2HHighScoreBody { flex: 1 1 0; min-width: 0; }
.gpH2HHighScoreLabel {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  color: rgba(255,170,110,0.75);
}
.gpH2HHighScoreNames {
  font-size: 14.5px; font-weight: 900; color: #fff; margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gpH2HHighScorePts { font-size: 24px; font-weight: 900; color: #ff9a52; flex-shrink: 0; }

/* Schedule tab */
.gpH2HScheduleFilterActive { color: #ffd76a; border-color: rgba(255,215,100,0.4); }
.gpH2HScheduleList { display: flex; flex-direction: column; padding: 4px 16px 16px; gap: 16px; }
.gpH2HScheduleWeek { display: flex; flex-direction: column; }
.gpH2HScheduleWeekLabel {
  font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
  color: rgba(255,255,255,0.4); margin-bottom: 6px;
}
.gpH2HScheduleRow {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 4px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpH2HScheduleRow:last-child { border-bottom: none; }
.gpH2HScheduleRowMine { background: rgba(255,215,100,0.05); border-radius: 10px; }

/* Playoffs tab — bracket skeleton */
.gpH2HBracket { display: flex; flex-direction: column; gap: 10px; padding: 6px 16px 16px; }
.gpH2HBracketMatchup {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 12px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
}
.gpH2HBracketSlot { flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 8px; }
.gpH2HBracketSeed {
  flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 900; color: #ffd76a;
  background: rgba(255,215,100,0.12); border: 1px solid rgba(255,215,100,0.3);
}
.gpH2HBracketName {
  font-size: 13.5px; font-weight: 800; color: rgba(255,255,255,0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gpH2HBracketSlotEmpty .gpH2HBracketName { color: rgba(255,255,255,0.3); }

/* Champion banner — shouted from the rooftops */
.gpChampionBanner {
  position: relative; overflow: hidden;
  margin-bottom: 14px; padding: 26px 20px 24px; border-radius: 20px;
  text-align: center;
  background: radial-gradient(120% 140% at 50% 0%, rgba(255,215,100,0.22) 0%, rgba(20,14,4,0.9) 60%), #0c0a06;
  border: 1px solid rgba(255,215,100,0.4);
  box-shadow: 0 10px 40px rgba(255,180,40,0.18), inset 0 1px 0 rgba(255,255,255,0.08);
  animation: gpChampionGlow 2.6s ease-in-out infinite;
}
@keyframes gpChampionGlow {
  0%, 100% { box-shadow: 0 10px 40px rgba(255,180,40,0.18), inset 0 1px 0 rgba(255,255,255,0.08); }
  50% { box-shadow: 0 10px 52px rgba(255,195,60,0.32), inset 0 1px 0 rgba(255,255,255,0.1); }
}
.gpChampionConfetti { font-size: 26px; letter-spacing: 0.3em; margin-bottom: 6px; }
.gpChampionLabel {
  font-size: 11.5px; font-weight: 900; letter-spacing: 0.18em; text-transform: uppercase;
  color: rgba(255,214,110,0.8);
}
.gpChampionName {
  font-size: 30px; font-weight: 900; color: #fff; letter-spacing: -0.01em;
  margin-top: 4px; text-shadow: 0 0 24px rgba(255,210,100,0.5);
  overflow-wrap: break-word; word-break: break-word;
}
.gpChampionSub {
  font-size: 12.5px; font-weight: 600; color: rgba(255,255,255,0.55);
  margin-top: 8px;
}
.gpChampionBannerCompact { padding: 18px 18px 16px; margin-bottom: 14px; }
.gpChampionBannerCompact .gpChampionConfetti { font-size: 20px; }
.gpChampionBannerCompact .gpChampionName { font-size: 23px; }

/* Playoffs tab — live bracket */
.gpPlayoffsLive .gpPlayoffRoundBlock { margin: 0 0 4px; }
.gpPlayoffRoundBlock {
  padding: 4px 16px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.gpPlayoffRoundBlock:last-child { border-bottom: none; }
.gpPlayoffChampionshipBlock {
  background: linear-gradient(160deg, rgba(255,200,40,0.08) 0%, rgba(10,10,12,0) 60%);
}
.gpPlayoffRoundHead {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0 8px;
}
.gpPlayoffRoundLabel {
  font-size: 13px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase;
  color: rgba(255,255,255,0.7);
}
.gpPlayoffRoundStatus {
  font-size: 10px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 3px 9px; border-radius: 999px; flex-shrink: 0;
}
.gpPlayoffStatusFinal { color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); }
.gpPlayoffStatusLive {
  color: #ff5c5c; background: rgba(255,60,60,0.12); border: 1px solid rgba(255,80,80,0.35);
  animation: gpPlayoffLivePulse 1.6s ease-in-out infinite;
}
@keyframes gpPlayoffLivePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
.gpPlayoffStatusUpcoming { color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); }

.gpPlayoffMatchupRow {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpPlayoffMatchupRow:last-child { border-bottom: none; }
.gpPlayoffByeRow { justify-content: space-between; }
.gpPlayoffTbNote {
  font-size: 10.5px; font-weight: 700; color: rgba(255,214,110,0.6);
  text-align: center; padding: 0 4px 10px; margin-top: -8px;
}

/* Player profile overlay — all-time H2H record */
.gpH2HProfileRow {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpH2HProfileRow:last-child { border-bottom: none; }
.gpH2HProfileOpp { font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.85); }
.gpH2HProfileRecord { font-size: 14px; font-weight: 900; color: #ffd76a; font-variant-numeric: tabular-nums; }

/* H2H pre-season placeholder (no active week yet — admin hasn't hit
   "Start Season") — a hero card explaining the wait, plus a Competitors
   card listing who's already joined. Same gold hero-gradient treatment
   as the Matchup Detail overlay header, for a consistent "this is the
   H2H part of the app" look. */
.gpH2HPreSeasonHero {
  text-align: center; padding: 32px 24px 28px; border-radius: 18px;
  margin-bottom: 14px;
  background:
    radial-gradient(120% 160% at 50% -20%, rgba(255,210,100,0.14) 0%, rgba(255,210,100,0) 62%),
    rgba(10,10,12,0.7);
  border: 1px solid rgba(255,255,255,0.09);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07);
}
.gpH2HPreSeasonIcon {
  font-size: 34px; line-height: 1; margin-bottom: 12px;
  filter: drop-shadow(0 0 16px rgba(255,210,100,0.35));
}
.gpH2HPreSeasonTitle {
  font-size: 19px; font-weight: 900; color: #fff; letter-spacing: 0.01em;
  margin-bottom: 8px;
}
.gpH2HPreSeasonSub {
  font-size: 13px; font-weight: 500; line-height: 1.5;
  color: rgba(255,255,255,0.5); max-width: 320px; margin: 0 auto;
}
.gpH2HCompetitorsCount {
  font-size: 12px; font-weight: 900; color: rgba(255,210,100,0.9);
  background: rgba(255,210,100,0.12); border: 1px solid rgba(255,210,100,0.28);
  border-radius: 999px; padding: 3px 11px; flex-shrink: 0;
}
.gpH2HCompetitorsList {
  display: flex; flex-direction: column;
  padding: 4px 16px 14px;
}
.gpH2HCompetitorRow {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.gpH2HCompetitorRow:last-child { border-bottom: none; }
.gpH2HCompetitorAvatar {
  width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 900; letter-spacing: -0.3px; text-transform: uppercase;
  border: 1px solid rgba(255,255,255,0.14);
}
.gpH2HCompetitorName {
  flex: 1 1 0; min-width: 0;
  font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.85);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gpH2HCompetitorJoined {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.03em;
  color: #5ddb8a; flex-shrink: 0;
}

/* Head-to-Head matchup detail overlay — a centered modal (unlike every
   other overlay in the app, which slides up as a bottom sheet), since
   this one's a detail/inspection view rather than a form or a list to
   scroll through. ID selectors here (both elements already have one,
   for the JS in gpShowH2HMatchupOverlay) beat the shared
   .gpPicksOverlayBackdrop/.gpPicksOverlaySheet bottom-sheet rules
   regardless of source order, without needing an extra modifier class.
   The header below it is a hero treatment reusing the same
   score-cluster look as the weekly Matchups card
   (gpH2HScoreCluster/gpH2HPts/gpH2HVs) so the two screens read as one
   system instead of the overlay looking like a generic sheet bolted
   on top of it. */
#gpH2HDetailOverlay { align-items: center; padding: 24px 16px; }
#gpH2HDetailSheet {
  max-height: 80vh;
  display: flex; flex-direction: column;
  border-radius: 22px;
  border-bottom: 1px solid rgba(255,255,255,0.10);
  padding-bottom: 20px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
  transform: translateY(10px) scale(0.97);
}
#gpH2HDetailOverlay.gpOverlayVisible #gpH2HDetailSheet {
  transform: translateY(0) scale(1);
}
#gpH2HDetailSheet .gpOverlayHandle { display: none; }
/* Compound selector (beats .gpOverlayHeader's own display/padding/
   border-bottom on specificity rather than source order, since that
   base rule is defined later in this file). */
.gpOverlayHeader.gpH2HDetailHeader {
  position: relative;
  display: flex; flex-direction: column; align-items: stretch; gap: 12px;
  padding: 18px 20px 16px;
  background:
    radial-gradient(120% 160% at 50% -20%, rgba(255,210,100,0.16) 0%, rgba(255,210,100,0) 62%),
    linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%);
  border-bottom: 1px solid rgba(255,210,100,0.22);
}
.gpH2HDetailCloseBtn { position: absolute; top: 14px; right: 16px; }
.gpH2HDetailEyebrow {
  text-align: center; font-size: 10.5px; font-weight: 900; letter-spacing: 0.12em;
  text-transform: uppercase; color: rgba(255,210,100,0.7);
}
.gpH2HDetailHeaderRow {
  display: flex; align-items: center; gap: 12px;
}
.gpH2HDetailName {
  flex: 1 1 0; min-width: 0;
  font-size: 16px; font-weight: 900; color: rgba(255,255,255,0.6);
  /* Wraps instead of truncating — a long name should always be fully
     readable, never cut off with an ellipsis. */
  overflow-wrap: break-word; word-break: break-word; line-height: 1.2;
  transition: color 150ms ease;
}
.gpH2HDetailNameLeft { text-align: left; }
.gpH2HDetailNameRight { text-align: right; }
.gpH2HDetailName.gpH2HDetailNameLead { color: #fff; }
.gpH2HDetailScoreCluster { flex-shrink: 0; padding: 8px 18px; gap: 12px; border-radius: 14px; }
.gpH2HDetailPts { font-size: 25px; }
.gpH2HDetailGames {
  display: flex; flex-direction: column; gap: 8px;
  overflow-y: auto; padding-bottom: 12px;
}
/* Inline (Matchup tab) version isn't height-constrained like the overlay
   sheet is, so it doesn't need its own scroll — and needs its own
   horizontal padding since it's not nested inside .gpOverlayBody here. */
.gpH2HMyMatchupCard .gpH2HDetailGames { overflow: visible; padding: 10px 14px 14px; }
.gpH2HDetailGameRow {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 8px; border-radius: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
}
.gpH2HDetailPickCell { flex: 0 0 auto; width: 76px; display: flex; justify-content: center; }
.gpH2HDetailGameInfo {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
}
.gpH2HDetailTeams {
  display: flex; align-items: center; justify-content: center;
  flex-wrap: wrap; gap: 7px; row-gap: 2px;
  font-size: 13.5px; font-weight: 900; color: rgba(255,255,255,0.85);
  letter-spacing: 0.01em;
}
.gpH2HDetailScore { font-size: 12px; font-weight: 900; color: rgba(255,255,255,0.85); }
.gpH2HDetailAt { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.3); }
/* Day + date + time for a scheduled game (LIVE/Final keep the plain
   .gpStatusLive/.gpStatusFinal treatment shared with the rest of the
   app) — a soft gold tint ties it to the same accent color used
   throughout the rest of this hero card. */
.gpH2HDetailDateTime {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.03em;
  color: rgba(255,210,100,0.6);
}
.gpH2HDetailTiebreakerLabel {
  font-size: 12px; font-weight: 900; letter-spacing: 0.03em;
  color: rgba(210,190,255,0.9);
}
.gpH2HPickChip {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 6px 8px; border-radius: 10px; width: 100%;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
}
/* Underdog win badge — a little gold medallion perched on the corner of
   a winning pick chip, only when that pick was the underdog. */
.gpH2HDogBadge {
  position: absolute; top: -7px; right: -7px;
  width: 20px; height: 20px; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; line-height: 1;
  background: radial-gradient(circle at 32% 28%, #ffe9a8, #ffb020 70%);
  box-shadow: 0 2px 7px rgba(255,160,40,0.55), 0 0 0 2px rgba(13,10,10,0.92);
}
.gpH2HPickChip.gpH2HPickNone { color: rgba(255,255,255,0.25); font-size: 16px; font-weight: 900; }
/* One box, not a box-in-a-box — position:relative so the lock emoji
   (below) can lay itself over the whole chip instead of sitting in its
   own smaller square. */
.gpH2HPickChip.gpH2HPickHidden { position: relative; color: rgba(255,255,255,0.3); font-size: 15px; }
/* Invisible — same 36x36 footprint as .gpTeamLogo, purely to reserve
   the same overall chip height/width a revealed pick's logo+text
   occupies. Game picks only (the tiebreaker's chip is plain text and
   doesn't need this). */
.gpH2HPickLockSpacer { width: 36px; height: 36px; visibility: hidden; }
/* The actual visible lock — centered over the entire chip (both axes),
   ignoring the invisible spacer/ghost-text stacked beneath it. */
.gpH2HPickLockIcon {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
}
.gpH2HPickAbbr { font-size: 11px; font-weight: 900; letter-spacing: 0.02em; color: rgba(255,255,255,0.8); }
/* Invisible — reserves the exact same line height as a revealed pick's
   real abbreviation text, so a locked chip's box comes out exactly as
   tall, not just as wide, as one showing a real pick. */
.gpH2HPickAbbrGhost { visibility: hidden; }
.gpH2HPickChip.gpH2HPickWin { background: rgba(50,200,100,0.14); border-color: rgba(50,200,100,0.35); }
.gpH2HPickChip.gpH2HPickWin .gpH2HPickAbbr { color: #5ddb8a; }
.gpH2HPickChip.gpH2HPickLoss { background: rgba(220,60,60,0.1); border-color: rgba(220,60,60,0.26); }
.gpH2HPickChip.gpH2HPickLoss .gpH2HPickAbbr { color: #e05555; }
.gpH2HPickChip.gpH2HPickTie { background: rgba(255,200,80,0.1); border-color: rgba(255,200,80,0.26); }
.gpH2HPickChip.gpH2HPickTie .gpH2HPickAbbr { color: rgba(255,210,100,0.9); }

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
  align-items: center;
}
.gpLeagueCardCountdownRow .gpCountdownLabel {
  text-align: center;
}
.gpLeagueCardCountdownRow .gpCountdownClock {
  justify-content: center;
  gap: 8px;
}
.gpLeagueCardCountdownRow .gpCdUnit {
  padding: 6px 10px 4px;
}
.gpLeagueCardCountdownRow .gpCdVal {
  font-size: 28px;
}
.gpLeagueCardCountdownRow .gpCdUnitLabel {
  font-size: 12px;
}
.gpLeagueCardCountdownRow .gpCountdownLive {
  text-align: center; display: block;
}

/* League picker card — top-3 season standings, shown underneath the
   countdown row (or on its own once the countdown drops off once the
   week's underway) so the reminder of where things stand doesn't
   disappear along with it. Rank chip on the left, name in the middle,
   points on the right — same left-to-right order the countdown above
   it reads in. Each row is its own gold/silver/bronze-tinted pill
   rather than a bare line, to match the weight of the rank chip. */
.gpLeagueCardTop3 {
  margin-top: 14px; padding-top: 14px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.gpLeagueCardTop3Label {
  font-size: 12px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  margin-bottom: 10px; text-align: center;
}
.gpLeagueCardTop3Row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px;
  border-radius: 12px;
  margin-bottom: 6px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}
.gpLeagueCardTop3Row:last-child { margin-bottom: 0; }
.gpLeagueCardTop3Row.gpRank1 {
  background: linear-gradient(90deg, rgba(255,224,138,0.14), rgba(255,224,138,0.03));
  border-color: rgba(255,224,138,0.25);
}
.gpLeagueCardTop3Row.gpRank2 {
  background: linear-gradient(90deg, rgba(232,232,236,0.11), rgba(232,232,236,0.02));
  border-color: rgba(232,232,236,0.2);
}
.gpLeagueCardTop3Row.gpRank3 {
  background: linear-gradient(90deg, rgba(224,168,120,0.12), rgba(224,168,120,0.02));
  border-color: rgba(224,168,120,0.22);
}
.gpLeagueCardTop3Rank {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 900;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}
.gpLeagueCardTop3Rank.gpRank1 { background: linear-gradient(135deg,#ffe08a,#c9931c); color: #3a2600; }
.gpLeagueCardTop3Rank.gpRank2 { background: linear-gradient(135deg,#e8e8ec,#a3a3ac); color: #262629; }
.gpLeagueCardTop3Rank.gpRank3 { background: linear-gradient(135deg,#e0a878,#9c5f2e); color: #2e1600; }
.gpLeagueCardTop3Name {
  flex: 1 1 auto; min-width: 0;
  font-size: 16px; font-weight: 800; color: rgba(255,255,255,0.94);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpLeagueCardTop3Pts {
  flex-shrink: 0;
  font-size: 15px; font-weight: 900; color: rgba(255,255,255,0.6);
  font-variant-numeric: tabular-nums;
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
/* H2H standings' name column wraps instead of truncating, so a long
   name is always fully readable rather than cut off with an ellipsis. */
.gpStandingsTable td.gpH2HStName {
  white-space: normal; overflow: visible; text-overflow: clip;
}
.gpH2HStName .gpStNameText {
  overflow: visible; text-overflow: clip; white-space: normal;
  overflow-wrap: break-word; word-break: break-word;
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
/* H2H's 5-tab bar — a fixed 5-column grid (bottom-nav style) so every
   tab always fits on screen with no horizontal scrolling, regardless
   of viewport width. */
.gpH2HTabBar {
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 2px; padding: 4px;
  background: rgba(13,10,10,0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  /* Stays visible while scrolling, docked right below the page's own
     sticky header — --gpHeaderH is set from that header's real measured
     height in groupPicks.js's postRender (a fixed guess would break the
     moment the header's admin-only row changes its height). */
  position: sticky;
  top: var(--gpHeaderH, 104px);
  z-index: 90;
  box-shadow: 0 8px 20px rgba(0,0,0,0.35);
}
/* Points format's This Week/Season toggle — same bar, just 2 columns
   instead of 5, for visual consistency with the H2H tab bar. */
.gpH2HTabBar.gpViewToggle2Col { grid-template-columns: repeat(2, 1fr); }
.gpH2HTabBtn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 8px 2px 7px;
  border-radius: 12px; border: none; background: none;
  color: rgba(255,255,255,0.45);
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  min-width: 0;
}
.gpH2HTabBtn.gpH2HTabBtnActive {
  background: rgba(255,210,100,0.14); color: #ffd76a;
}
.gpH2HTabIcon { font-size: 15px; line-height: 1; }
.gpH2HTabLabel {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.01em;
  line-height: 1.15; text-align: center;
  overflow-wrap: break-word; word-break: break-word;
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
   PUSH NOTIFICATION OPT-IN BANNER
   ══════════════════════════════════════════════ */
.gpNotifBanner {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px; padding: 12px 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(255,190,40,0.14) 0%, rgba(20,16,8,0.6) 100%);
  border: 1px solid rgba(255,200,60,0.35);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
}
.gpNotifBannerIcon { font-size: 18px; flex-shrink: 0; }
.gpNotifBannerBody {
  flex: 1; min-width: 0;
  font-size: 12.5px; font-weight: 700; line-height: 1.4;
  color: rgba(255,240,210,0.9);
}
.gpNotifBannerBtn {
  flex-shrink: 0;
  background: rgba(255,200,60,0.9); color: #201400;
  border: none; border-radius: 10px;
  padding: 8px 14px; font-weight: 900; font-size: 13px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpNotifBannerBtn:active { transform: scale(0.97); }
.gpNotifBannerDismiss {
  flex-shrink: 0;
  width: 26px; height: 26px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.14);
  color: rgba(255,255,255,0.6); font-size: 12px;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.gpNotifBannerDismiss:active { background: rgba(255,255,255,0.15); }

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
.gpAnnouncementBody { min-width: 0; flex: 1; }
.gpAnnouncementTitle {
  font-size: 15px; font-weight: 900; color: #fff; letter-spacing: 0.01em;
}
.gpAnnouncementMessage {
  margin-top: 4px; font-size: 13px; font-weight: 600; line-height: 1.45;
  color: rgba(255,255,255,0.82);
}
.gpAnnouncementPostedAt {
  margin-top: 8px; font-size: 10.5px; font-weight: 700;
  color: rgba(255,255,255,0.38); text-align: right;
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
   ADMIN — game list priority badges / remove button
   ══════════════════════════════════════════════ */
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

/* Mini version of the same OW/ATS section pills above, for tagging an
   individual game row (e.g. the H2H matchup detail) rather than heading
   a whole section — same colors/wording, just small enough to sit
   inline above one row's date/time. */
.gpH2HTypeBadge {
  display: inline-flex; align-items: center;
  font-size: 9px; font-weight: 900; letter-spacing: 0.05em;
  text-transform: uppercase; white-space: nowrap;
  padding: 2px 9px; border-radius: 999px;
  margin-bottom: 3px;
}
.gpH2HTypeBadgeOw {
  color: #ffe3e3;
  background: linear-gradient(135deg, rgba(214,45,70,0.95), rgba(150,20,45,0.95));
}
.gpH2HTypeBadgeAts {
  color: #e7fff3;
  background: linear-gradient(135deg, rgba(50,208,140,0.95), rgba(20,150,95,0.95));
}

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

.gpArchivedLeaguesToggle {
  display: flex; align-items: center; gap: 8px;
  margin-top: 16px; padding: 10px 4px;
  font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.5);
  letter-spacing: 0.02em;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.gpArchivedLeaguesToggle:active { color: rgba(255,255,255,0.75); }
.gpArchivedLeaguesArrow { font-size: 11px; width: 12px; text-align: center; }
.gpArchivedLeaguesGrid { margin-top: 8px; }
.gpArchivedLeaguesGrid[hidden] { display: none; }

/* ══════════════════════════════════════════════
   LEAGUE SETTINGS FORM
   ══════════════════════════════════════════════ */
.gpLeagueSettingsForm {
  display: flex; flex-direction: column; gap: 16px;
  padding: 18px; border-radius: 18px;
  background: linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.14) 100%);
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: 0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05);
}
.gpLeagueSettingsRow { display: flex; flex-direction: column; gap: 6px; }
.gpLeagueSettingsLabel { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.4); }
.gpLeagueSettingsInput {
  width: 100%; box-sizing: border-box; padding: 12px 14px; border-radius: 12px;
  background: rgba(0,0,0,0.22); border: 1px solid rgba(255,255,255,0.12);
  color: inherit; font-weight: 700; font-size: 16px; outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.gpLeagueSettingsInput:focus {
  border-color: rgba(255,200,60,0.55);
  box-shadow: 0 0 0 3px rgba(255,200,60,0.14);
}
.gpLeagueSettingsCheckRow { display: flex; align-items: center; gap: 10px; }

/* Each announcement slot is its own card — clearer than a bare divider
   when the slot also carries a date field and two shortcut buttons. */
.gpAnnouncementSlot {
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px; border-radius: 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
}
.gpAnnouncementSlotLabel {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;
  color: rgba(255,210,110,0.85);
}
/* Stacked (label+date on one line, the two shortcut buttons on the next)
   instead of one wrapping row — on a narrow phone a single flex-wrap row
   let "1 month" spill onto its own orphan line below a half-empty date
   input, which is the "weirdly formatted" mess this replaces. */
.gpAnnouncementExpiryRow {
  display: flex; flex-direction: column; gap: 10px;
  margin-top: 2px; padding-top: 12px;
  border-top: 1px dashed rgba(255,255,255,0.1);
}
.gpAnnouncementExpiryField { display: flex; align-items: center; gap: 10px; }
.gpAnnouncementExpiryField .gpAdminInlineLabel { white-space: nowrap; }
.gpAnnouncementExpiryInput { flex: 1; min-width: 0; }
.gpAnnouncementExpiryQuick { display: flex; gap: 8px; }
.gpAnnouncementExpiryQuickBtn {
  flex: 1; text-align: center;
  background: rgba(90,170,255,0.12);
  border: 1px solid rgba(90,170,255,0.35);
  color: rgba(205,228,255,0.95);
}
.gpAnnouncementExpiryQuickBtn:active { background: rgba(90,170,255,0.24); }

.gpLeagueSettingsActions { display: flex; gap: 10px; margin-top: 4px; }
.gpLeagueSettingsSaveBtn {
  flex: 1;
  background: linear-gradient(135deg, rgba(255,195,50,0.95), rgba(255,140,20,0.95));
  border: 1px solid rgba(255,195,70,0.6);
  color: #241700;
  font-weight: 900;
  box-shadow: 0 6px 18px rgba(255,160,0,0.28);
}
.gpLeagueSettingsCancelBtn { flex: 1; }

.gpDangerZone {
  border: 1px solid rgba(216,31,31,0.35);
  background: rgba(216,31,31,0.06);
}
.gpDangerZone .gpAdminBlockLabel { color: rgba(255,140,140,0.9); }
.gpLeagueDeleteBtn {
  width: 100%; margin-top: 8px;
  background: rgba(216,31,31,0.14);
  border: 1px solid rgba(216,31,31,0.5);
  color: #ffb3b3;
  font-weight: 800;
}
.gpLeagueDeleteBtn:active { background: rgba(216,31,31,0.26); }

/* Head-to-Head season: Start Season button + manual schedule editor */
.gpH2HStartSeasonBtn {
  width: 100%; margin-top: 8px;
  background: linear-gradient(135deg, rgba(255,195,50,0.95), rgba(255,140,20,0.95));
  border: 1px solid rgba(255,195,70,0.6);
  color: #241700; font-weight: 900;
}
.gpH2HStartSeasonBtn:disabled { opacity: 0.4; }
.gpH2HEditSchedule {
  display: flex; flex-direction: column; gap: 10px;
  margin-top: 10px; max-height: 360px; overflow-y: auto;
  padding: 2px 2px 2px 0;
}
.gpH2HEditRound {
  border-radius: 12px; background: rgba(0,0,0,0.14);
  border: 1px solid rgba(255,255,255,0.1);
  padding: 8px 10px;
}
.gpH2HEditRoundPlayoff {
  background: rgba(255,200,40,0.06);
  border-color: rgba(255,210,100,0.3);
}
.gpH2HPlayoffDivider {
  display: flex; align-items: center; gap: 8px;
  margin: 4px 2px 2px;
  font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.08em;
  color: rgba(255,210,110,0.85);
}
.gpH2HPlayoffDivider::after {
  content: ""; flex: 1 1 auto; height: 1px;
  background: linear-gradient(90deg, rgba(255,210,100,0.4), rgba(255,210,100,0));
}
.gpH2HEditRoundHead { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.gpH2HEditRoundLabel {
  font-size: 10.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.06em;
  color: rgba(255,210,110,0.85);
}
.gpH2HEditRow { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.gpH2HEditRow:last-child { margin-bottom: 0; }
.gpH2HEditSelect { flex: 1; min-width: 0; padding: 8px 10px; font-size: 13px; }
.gpH2HEditVs { font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.35); flex-shrink: 0; }
.gpH2HRemoveRowBtn, .gpH2HRemoveRoundBtn {
  flex-shrink: 0; background: rgba(220,60,60,0.12); border: 1px solid rgba(220,60,60,0.3);
  color: rgba(255,140,140,0.9); border-radius: 7px; cursor: pointer;
}
.gpH2HRemoveRowBtn { width: 28px; height: 28px; font-size: 13px; line-height: 1; padding: 0; }
.gpH2HRemoveRoundBtn { font-size: 10px; font-weight: 800; letter-spacing: 0.03em; padding: 4px 9px; }
.gpH2HAddPairBtn {
  width: 100%; margin-top: 2px; background: rgba(255,255,255,0.06);
  border: 1px dashed rgba(255,255,255,0.22); color: rgba(255,255,255,0.65);
  font-size: 11.5px; font-weight: 800; padding: 7px 0; border-radius: 8px; cursor: pointer;
}
.gpH2HAddRoundBtn {
  width: 100%; margin-top: 10px; background: rgba(255,210,110,0.1);
  border: 1px dashed rgba(255,210,110,0.4); color: rgba(255,210,110,0.9);
  font-size: 12px; font-weight: 800; padding: 9px 0; border-radius: 10px; cursor: pointer;
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
/* Admin Tools — "nearly full page" rather than a normal bottom sheet,
   since it has a lot to show (game lists, schedule editor, etc.) at once. */
.gpAdminToolsSheet {
  max-height: 94dvh;
  height: 94dvh;
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
  flex: 1 1 auto; min-width: 0;
}
.gpMemberManageBtn {
  flex: 0 0 auto;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  cursor: pointer;
}
.gpMergeTargetRow {
  width: 100%;
  text-align: left;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.gpMergeTargetRow:hover {
  background: rgba(255,255,255,0.07);
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
    const ms = ts?.toMillis ? ts.toMillis()
      : Number.isFinite(ts) ? Number(ts)
      : (Number(ts?.seconds) ? Number(ts.seconds) * 1000 : 0);
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
  // Mascot/nickname only ("Buckeyes", not "Ohio State Buckeyes") — from
  // the `nickname` field gpAdminAddSelectedGamesToWeek's buildTeam()
  // captures off ESPN's own team.name (their short form). Only games
  // added after that field existed have it, so this falls back to the
  // existing abbreviation rather than the full team name for older
  // games — full names would overflow the compact H2H matchup row this
  // is built for.
  function safeNickname(t) {
    const nm = String(t?.nickname || "").trim();
    return nm || safeAbbr(t);
  }

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

  // ─── Broadcast network logo (falls back to plain text) ─────────────
  // Mirrors scores-render.js's version — kept a separate copy since these
  // are independent modules, but same real local logo files (under
  // assets/networks/, not a guessed CDN url) and the same `bare` flag
  // for a logo that's already a self-contained badge vs. one that needs
  // the white chip behind it for contrast.
  const GP_NETWORK_LOGO_FILES = {
    "espn":         { file: "assets/networks/espn.webp" },
    "espn2":        { file: "assets/networks/espn2.webp" },
    "abc":          { file: "assets/networks/abc.webp", bare: true },
    "cbs":          { file: "assets/networks/cbs.webp" },
    "fox":          { file: "assets/networks/fox.png", bare: true },
    "fs1":          { file: "assets/networks/fs1.webp", bare: true },
    "fox sports 1": { file: "assets/networks/fs1.webp", bare: true },
    "nbc":          { file: "assets/networks/nbc.webp" },
    "peacock":      { file: "assets/networks/peacock.webp" },
    "secn":         { file: "assets/networks/sec-network.webp", bare: true },
    "sec network":  { file: "assets/networks/sec-network.webp", bare: true },
    "btn":               { file: "assets/networks/btn.png" },
    "big ten network":   { file: "assets/networks/btn.png" },
    "cw":                { file: "assets/networks/cw.webp" },
    "the cw":            { file: "assets/networks/cw.webp" },
    "cbssn":                    { file: "assets/networks/cbssn.webp" },
    "cbs sports network":       { file: "assets/networks/cbssn.webp" },
    "accn":            { file: "assets/networks/accn.webp" },
    "acc network":     { file: "assets/networks/accn.webp" },
    "tnt":             { file: "assets/networks/tnt.webp" },
    "apple tv":        { file: "assets/networks/apple-tv.webp" },
    "apple tv+":       { file: "assets/networks/apple-tv.webp" },
    "espn+":           { file: "assets/networks/espn-plus.webp" },
    "espn plus":       { file: "assets/networks/espn-plus.webp" },
    "usa":             { file: "assets/networks/usa.webp" },
    "usa network":     { file: "assets/networks/usa.webp" },
    "usa net":         { file: "assets/networks/usa.webp" },
    "espnu":           { file: "assets/networks/espnu.webp" },
    "espn unlimited":  { file: "assets/networks/espn.webp" },
    "espn unlmtd":     { file: "assets/networks/espn.webp" },
    "nfln":            { file: "assets/networks/nfl-network.webp" },
    "nfl network":     { file: "assets/networks/nfl-network.webp" },
    "nfl net":         { file: "assets/networks/nfl-network.webp" },
    "msgsn":           { file: "assets/networks/msgsn.png" },
    "msg sn":          { file: "assets/networks/msgsn.png" },
    "msg network":     { file: "assets/networks/msgsn.png" },
    "nhln":            { file: "assets/networks/nhl-network.webp" },
    "nhl network":     { file: "assets/networks/nhl-network.webp" },
    "nhl net":         { file: "assets/networks/nhl-network.webp" },
    "scripps sports":  { file: "assets/networks/scripps-sports.png" },
    "scripps":         { file: "assets/networks/scripps-sports.png" },
    "disney+":         { file: "assets/networks/disney-plus.webp" },
    "disney plus":     { file: "assets/networks/disney-plus.webp" },
    "tbs":             { file: "assets/networks/tbs.webp", bare: true },
    "prime video":        { file: "assets/networks/prime-video.webp" },
    "amazon prime video": { file: "assets/networks/prime-video.webp" },
    "amazon prime":       { file: "assets/networks/prime-video.webp" },
    "prime":              { file: "assets/networks/prime-video.webp" },
    "amzn":               { file: "assets/networks/prime-video.webp" },
  };
  function gpNorm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function buildBroadcastChipHTML(name) {
    const nm = String(name || "").trim();
    if (!nm) return "";
    const entry = GP_NETWORK_LOGO_FILES[gpNorm(nm)];
    if (!entry) return `<div class="gpBroadcastChip">${esc(nm)}</div>`;
    const chipCls = entry.bare ? "gpBroadcastChip gpBroadcastChipBare" : "gpBroadcastChip gpBroadcastChipLogo";
    return `<div class="${chipCls}">
      <img src="${esc(entry.file)}" alt="${esc(nm)}" class="gpBroadcastLogoImg" loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='inline';" />
      <span class="gpBroadcastLogoFallback" style="display:none">${esc(nm)}</span>
    </div>`;
  }

  // ─── League/sport badge — sits to the left of the broadcast chip so
  // players can tell what sport a game is without reading team names.
  // leagueKey is whatever the admin picker's <select> was set to when the
  // game got added (gpAdminAddSelectedGamesToWeek), e.g. "nfl"/"cfb"/"mlb".
  // Same label map/styling as the Shop tab's league badge elsewhere in
  // the app, just under this file's own class name.
  const GP_LEAGUE_BADGE_LABELS = {
    ncaam: "NCAAB", cfb: "CFB", nba: "NBA",
    nhl: "NHL", mls: "MLS", nfl: "NFL", mlb: "MLB",
  };
  function leagueBadgeHTML(leagueKey) {
    const key = String(leagueKey || "").trim().toLowerCase();
    if (!key) return "";
    const label = GP_LEAGUE_BADGE_LABELS[key] || key.toUpperCase();
    return `<div class="gpLeagueBadge">${esc(label)}</div>`;
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
          // Tally squares (logo + big pick count) — the group's split at
          // a glance before scanning who picked what below.
          const awayCount = arr.filter(p => String(p?.side) === "away").length;
          const homeCount = arr.filter(p => String(p?.side) === "home").length;
          const awayLogo  = String(g?.awayLogo || g?.awayTeam?.logo || "").trim();
          const homeLogo  = String(g?.homeLogo || g?.homeTeam?.logo || "").trim();
          const tallySquare = (name, logo, count, leading) => `
<div class="gpPickTallySquare${leading ? " gpPickTallyLeading" : ""}">
  ${logo
    ? `<img class="gpPickTallyLogo" src="${esc(logo)}" alt="${esc(name)}" loading="lazy" onerror="this.style.display='none'"/>`
    : `<div class="gpPickTallyLogoPlaceholder">${esc(name.slice(0, 3).toUpperCase())}</div>`}
  <div class="gpPickTallyCount">${count}</div>
</div>`;
          const tallyHTML = `
<div class="gpPickTally">
  ${tallySquare(awayName, awayLogo, awayCount, awayCount > 0 && awayCount >= homeCount)}
  <div class="gpPickTallyVs">VS</div>
  ${tallySquare(homeName, homeLogo, homeCount, homeCount > awayCount)}
</div>`;

          bodyEl.innerHTML = tallyHTML + arr.map(p => {
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

    // Left bar is a type indicator, not a sport color: red for
    // outright/straight-up games, green for the designated ATS game(s).
    // Thick enough to carry its own rotated label so the pick type stays
    // legible card-by-card scrolling through a long section, not just
    // from the section header at the top.
    const borderColor = isAts ? "#2ecc87" : "#d1263f";
    const typeLabel    = isAts ? "Against the Spread" : "Outright Winner";

    const oddsLine   = safeOddsLine(g);
    const venueLine  = String(g?.venueLine || "").trim();
    const statusHTML = buildStatusHTML(g);
    const kickoffTime = ms ? fmtTime(ms) : "";
    const kickoffDate = ms ? fmtDate(ms) : "";

    return `
<div class="${cardCls}">
  <div class="gpCardTypeBar" style="background:${esc(borderColor)}">
    <span class="gpCardTypeBarLabel">${esc(typeLabel)}</span>
  </div>
  <div class="gpCardBody">
  <div class="gpCardHeader">
    ${statusHTML}
    <div class="gpCardHeaderRight">
      ${oddsLine ? `<div class="gpOddsLine">${esc(oddsLine)}</div>` : ""}
      ${isAdmin ? `<button type="button" class="gpRemoveGameBtn" data-gpaction="adminRemoveGame" data-eid="${esc(eventId)}" data-weekid="${esc(weekId)}" title="Remove from week" aria-label="Remove game from week">✕</button>` : ""}
    </div>
  </div>
  ${kickoffDate || kickoffTime || venueLine || g?.broadcastName ? `
  <div class="gpCardDateTimeRow">
    <div class="gpCardDateCol">
      <div class="gpCardDateText">${esc(kickoffDate)}</div>
      ${venueLine ? `<div class="gpVenueLine">${esc(venueLine)}</div>` : ""}
    </div>
    <div class="gpCardTimeCol">
      <div class="gpCardTimeTop">
        ${leagueBadgeHTML(g?.leagueKey)}
        ${buildBroadcastChipHTML(g?.broadcastName)}
      </div>
      <div class="gpCardTimeText">${esc(kickoffTime)}</div>
    </div>
  </div>` : ""}
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
  <td>${esc(owRecord)}</td>
  <td>${esc(atsRecord)}</td>
  <td class="gpStDogs">${dogs}</td>
  ${showTbWins ? `<td class="gpStTbWins">${Number(u?.tbWins ?? 0)}</td>` : ""}
</tr>`;
    }).join("");

    const anyTiebreakerUsed = (Array.isArray(list) ? list : []).some(u => u?.tiebreakerUsed);

    const colgroupHTML = showTbWins ? `
    <colgroup>
      <col style="width:8%"/>
      <col style="width:29%"/>
      <col style="width:10%"/>
      <col style="width:14%"/>
      <col style="width:14%"/>
      <col style="width:9%"/>
      <col style="width:9%"/>
    </colgroup>` : `
    <colgroup>
      <col style="width:9%"/>
      <col style="width:38%"/>
      <col style="width:13%"/>
      <col style="width:16%"/>
      <col style="width:14%"/>
      <col style="width:10%"/>
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
        <th>OW</th>
        <th>ATS</th>
        <th>🐶</th>
        ${showTbWins ? `<th>🎯</th>` : ""}
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
  <b>Pts</b> total points &middot; <b>OW</b> Outright Winner record (W-L-T) &middot; <b>ATS</b> Against-the-Spread record (W-L-P) &middot; 🐶 correct underdog picks${season ? ` &middot; 🎯 tiebreakers won this season` : ""}
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

    const outrightHTML = outrightRows ? gpBuildSectionHeaderHTML("☑️ Outright Winners", "outright") + outrightRows : "";
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
  function gpBuildWeeklyRecapHTML(recap, weekLabel, opts) {
    if (!recap) return "";
    const { champions, biggestUpset, perfectWeekPlayers, tiebreaker } = recap;
    const hideTiebreaker = !!opts?.hideTiebreaker;

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

    if (tiebreaker && !hideTiebreaker) {
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
        return `
<div class="gpH2HMatchupRow gpH2HByeRow">
  <div class="gpH2HName gpH2HNameLeft">${esc(nm)}</div>
  <div class="gpH2HByeLabel">BYE</div>
</div>`;
      }
      const [nameA, nameB] = m.players;
      const [ptsA, ptsB] = m.points;
      const aWin = m.winner === "a", bWin = m.winner === "b", tie = m.winner === "tie";
      return `
<div class="gpH2HMatchupRow gpH2HMatchupRowClickable" data-gpaction="openH2HMatchup"
  data-namea="${esc(nameA)}" data-nameb="${esc(nameB)}" data-ptsa="${esc(String(ptsA))}" data-ptsb="${esc(String(ptsB))}">
  <div class="gpH2HName gpH2HNameLeft${aWin ? " gpH2HWinner" : ""}">${esc(nameA)}${aWin ? " 🏆" : ""}</div>
  <div class="gpH2HScoreCluster">
    <span class="gpH2HPts${aWin ? " gpH2HPtsWin" : ""}">${esc(String(ptsA))}</span>
    <span class="gpH2HVs">${tie ? "TIE" : "vs"}</span>
    <span class="gpH2HPts${bWin ? " gpH2HPtsWin" : ""}">${esc(String(ptsB))}</span>
  </div>
  <div class="gpH2HName gpH2HNameRight${bWin ? " gpH2HWinner" : ""}">${bWin ? "🏆 " : ""}${esc(nameB)}</div>
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

  // ─── H2H pre-season placeholder — shown in place of the week card
  // whenever an H2H league has no active week yet, which for this format
  // almost always means the admin hasn't hit "Start Season" (not just
  // "hasn't made a week"), so this explains that rather than pointing
  // players at the wrong fix. Doubles as a roster check so joined players
  // can see who else is in before things kick off.
  function gpBuildH2HPreSeasonHTML(leagueMembers) {
    const list = Array.isArray(leagueMembers) ? leagueMembers : [];
    const rows = list.map(m => {
      const nm = String(m?.name || "Someone");
      const { bg, color } = avatarStyle(nm);
      return `
<div class="gpH2HCompetitorRow">
  <div class="gpH2HCompetitorAvatar" style="background:${bg};color:${color}">${esc(initials(nm))}</div>
  <div class="gpH2HCompetitorName">${esc(nm)}</div>
  <div class="gpH2HCompetitorJoined">✓ Joined</div>
</div>`;
    }).join("");

    return `
<div class="gpH2HPreSeasonHero">
  <div class="gpH2HPreSeasonIcon">⚔️</div>
  <div class="gpH2HPreSeasonTitle">Season Hasn't Started Yet</div>
  <div class="gpH2HPreSeasonSub">Your admin hasn't started the season yet. Once they do, your weekly matchups and games will show up right here.</div>
</div>
<div class="gpLeaderCard gpH2HCompetitorsCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🥊 Competitors</div>
    </div>
    <div class="gpH2HCompetitorsCount">${list.length}</div>
  </div>
  ${rows ? `<div class="gpH2HCompetitorsList">${rows}</div>` : `<div class="gpEmpty">No one has joined yet.</div>`}
</div>`;
  }

  // ─── Head-to-Head matchup detail — one game per row, both players'
  // picks side by side with the game itself in the middle. `allPicks` is
  // gpGetAllPicksForSlate's shape ({ [eventId]: [{name, side, ...}] }),
  // matched to each named player the same case-insensitive way the rest
  // of H2H matches names. `games` is this week's already-loaded game
  // list (window.__gpCurrentGames) — no extra Firestore round trip.
  // Shared by the Matchup Detail overlay (any matchup, opened by tapping
  // a row) and the Matchup tab's own inline "your matchup" hero (always
  // expanded, no tap needed) — same hero header + game-by-game pick
  // comparison either way, just wrapped differently by the caller.
  function gpBuildH2HMatchupBodyHTML({ nameA, nameB, ptsA, ptsB, weekLabel, games, allPicks, atsEventIds, viewerSide, tiebreakerEventId, tiebreakers }) {
    const GP_Data = window.GP_Data || {};
    const atsSet = new Set((Array.isArray(atsEventIds) ? atsEventIds : []).map(String));
    const numA = Number(ptsA) || 0;
    const numB = Number(ptsB) || 0;
    const aLead = numA > numB;
    const bLead = numB > numA;

    function findPick(eventId, playerName) {
      const arr = Array.isArray(allPicks?.[eventId]) ? allPicks[eventId] : [];
      const key = String(playerName || "").trim().toLowerCase();
      const row = arr.find(p => String(p?.name || "").trim().toLowerCase() === key);
      return row ? String(row.side || "") : "";
    }
    function resultFor(g, side, isAts) {
      if (!side) return "";
      const isFinalG = String(g?.__live?.state || "").toLowerCase() === "post";
      if (!isFinalG) return "";
      if (isAts) {
        const grade = typeof GP_Data.gpGradeAtsForGame === "function" ? GP_Data.gpGradeAtsForGame(g) : { ok: false };
        if (!grade.ok) return "";
        if (grade.pushed) return "tie";
        return side === grade.coverSide ? "win" : "loss";
      }
      const winningSide = typeof GP_Data.gpGetGameWinningSide === "function" ? GP_Data.gpGetGameWinningSide(g) : "";
      if (!winningSide) return "tie";
      return side === winningSide ? "win" : "loss";
    }
    // `revealed` — true once this specific game/tiebreaker has locked, OR
    // unconditionally true for whichever side is the viewer's own (you
    // always see your own pick; your opponent's stays hidden until their
    // game starts, same as everyone else's). Viewing someone else's
    // matchup (viewerSide unset) never gets that exception — both sides
    // stay hidden until lock, exactly as before.
    function pickChipHTML(g, side, result, revealed, isDogWin) {
      // One box, not two — the spacer + ghost line below are invisible,
      // reserving the exact same footprint a revealed pick's logo+text
      // occupy (so the chip is pixel-identical in height/width either
      // way), while the lock itself is a single emoji absolutely
      // centered over the whole box, not boxed in on its own.
      if (!revealed) return `<div class="gpH2HPickChip gpH2HPickHidden"><div class="gpH2HPickLockSpacer"></div><span class="gpH2HPickAbbr gpH2HPickAbbrGhost">--</span><span class="gpH2HPickLockIcon">🔒</span></div>`;
      if (!side) return `<div class="gpH2HPickChip gpH2HPickNone">—</div>`;
      const away = g?.awayTeam || { name: g?.awayName || "Away", abbr: "", logo: g?.awayLogo || "" };
      const home = g?.homeTeam || { name: g?.homeName || "Home", abbr: "", logo: g?.homeLogo || "" };
      const t = side === "away" ? away : home;
      const cls = result === "win" ? " gpH2HPickWin" : result === "loss" ? " gpH2HPickLoss" : result === "tie" ? " gpH2HPickTie" : "";
      return `
      <div class="gpH2HPickChip${cls}">
        ${logoImg(t?.logo || g?.[side + "Logo"], safeAbbr(t))}
        <span class="gpH2HPickAbbr">${esc(safeAbbr(t))}</span>
        ${isDogWin ? `<span class="gpH2HDogBadge" title="Underdog win">🐶</span>` : ""}
      </div>`;
    }
    function tiebreakerChipHTML(guess, revealed) {
      if (!revealed) return `<div class="gpH2HPickChip gpH2HPickHidden">🔒</div>`;
      if (guess == null) return `<div class="gpH2HPickChip gpH2HPickNone">—</div>`;
      return `<div class="gpH2HPickChip"><span class="gpH2HPickAbbr">${esc(String(guess))}</span></div>`;
    }
    // Same LIVE/Final treatment as buildStatusHTML (shared with the rest
    // of the app), but a scheduled game shows day + date + time here
    // instead of just the time — this row doesn't have the picks list's
    // separate date line, so a bare "2:00 PM" reads ambiguous.
    function matchupStatusHTML(g) {
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
      if (!ms) return `<div class="gpStatusPre">Scheduled</div>`;
      return `<div class="gpH2HDetailDateTime">${esc(fmtDate(ms))} &middot; ${esc(fmtTime(ms))}</div>`;
    }

    const sorted = [...(Array.isArray(games) ? games : [])].sort((a, b) => startMs(a) - startMs(b));
    const rowsHTML = sorted.map(g => {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";
      const isAts = atsSet.has(eventId);
      const away = g?.awayTeam || { name: g?.awayName || "Away", abbr: "" };
      const home = g?.homeTeam || { name: g?.homeName || "Home", abbr: "" };
      // Same "picks reveal once this game locks" rule the rest of the
      // page uses — each game locks independently, so an early game
      // going final doesn't reveal picks for a later game that hasn't
      // even started yet.
      const gameMs = startMs(g);
      const locked = gameMs > 0 && Date.now() >= gameMs;
      const sideA = findPick(eventId, nameA);
      const sideB = findPick(eventId, nameB);
      const resA = resultFor(g, sideA, isAts);
      const resB = resultFor(g, sideB, isAts);
      // Underdog win badge — outright picks only (ATS already has its
      // own "beat the spread" framing), matching the same favorite
      // detection gpComputeWeeklyLeaderboard uses to award the 2pt
      // underdog bonus, so the badge always agrees with the score.
      const favSide = (!isAts && typeof GP_Data.gpComputeStraightFavSide === "function")
        ? GP_Data.gpComputeStraightFavSide(g) : "";
      const dogWinA = resA === "win" && !!favSide && !!sideA && sideA !== favSide;
      const dogWinB = resB === "win" && !!favSide && !!sideB && sideB !== favSide;
      const live = g?.__live || null;
      const liveState = String(live?.state || "").toLowerCase();
      const showScores = (liveState === "in" || liveState === "post") &&
                          live?.awayScore != null && live?.awayScore !== "" &&
                          live?.homeScore != null && live?.homeScore !== "";
      const typeBadgeHTML = isAts
        ? `<span class="gpH2HTypeBadge gpH2HTypeBadgeAts">ATS</span>`
        : `<span class="gpH2HTypeBadge gpH2HTypeBadgeOw">OW</span>`;
      // Spread chip — ATS games only, next to whichever team is favored,
      // same chip/formatting spreadChipHTML already uses on the Picks page.
      const spreadFavSide = String(g?.spreadFavoredSide || "").toLowerCase();
      const favSpreadHTML = isAts ? spreadChipHTML(g, spreadFavSide) : "";
      return `
<div class="gpH2HDetailGameRow">
  <div class="gpH2HDetailPickCell">${pickChipHTML(g, sideA, resA, locked || viewerSide === "a", dogWinA)}</div>
  <div class="gpH2HDetailGameInfo">
    ${typeBadgeHTML}
    ${matchupStatusHTML(g)}
    <div class="gpH2HDetailTeams">
      <span>${esc(safeNickname(away))}${spreadFavSide === "away" ? favSpreadHTML : ""}</span>
      ${showScores ? `<span class="gpH2HDetailScore">${esc(String(live.awayScore))}&ndash;${esc(String(live.homeScore))}</span>` : `<span class="gpH2HDetailAt">@</span>`}
      <span>${esc(safeNickname(home))}${spreadFavSide === "home" ? favSpreadHTML : ""}</span>
    </div>
  </div>
  <div class="gpH2HDetailPickCell">${pickChipHTML(g, sideB, resB, locked || viewerSide === "b", dogWinB)}</div>
</div>`;
    }).join("");

    // Tiebreaker row — appended to the same games list (not a separate
    // section), same reveal-on-lock rule as every other row above.
    let tiebreakerRowHTML = "";
    const tbEventId = String(tiebreakerEventId || "").trim();
    if (tbEventId) {
      const tbGame = sorted.find(g => String(g?.eventId || g?.id || "") === tbEventId);
      if (tbGame) {
        const tbMs = startMs(tbGame);
        const tbLocked = tbMs > 0 && Date.now() >= tbMs;
        const tbMap = tiebreakers && typeof tiebreakers === "object" ? tiebreakers : {};
        function guessFor(playerName) {
          const key = String(playerName || "").trim().toLowerCase();
          const entry = Object.values(tbMap).find(t => String(t?.name || "").trim().toLowerCase() === key);
          return entry && Number.isFinite(Number(entry.guess)) ? Number(entry.guess) : null;
        }
        const guessA = guessFor(nameA);
        const guessB = guessFor(nameB);
        tiebreakerRowHTML = `
<div class="gpH2HDetailGameRow">
  <div class="gpH2HDetailPickCell">${tiebreakerChipHTML(guessA, tbLocked || viewerSide === "a")}</div>
  <div class="gpH2HDetailGameInfo">
    ${matchupStatusHTML(tbGame)}
    <div class="gpH2HDetailTeams">
      <span class="gpH2HDetailTiebreakerLabel">🎯 Tiebreaker</span>
    </div>
  </div>
  <div class="gpH2HDetailPickCell">${tiebreakerChipHTML(guessB, tbLocked || viewerSide === "b")}</div>
</div>`;
      }
    }

    return {
      headerHTML: `
      <div class="gpH2HDetailEyebrow">${esc(weekLabel || "")}${weekLabel ? " · " : ""}Matchup</div>
      <div class="gpH2HDetailHeaderRow">
        <div class="gpH2HDetailName gpH2HDetailNameLeft${aLead ? " gpH2HDetailNameLead" : ""}">${esc(nameA)}</div>
        <div class="gpH2HScoreCluster gpH2HDetailScoreCluster">
          <div class="gpH2HPts gpH2HDetailPts${aLead ? " gpH2HPtsWin" : ""}">${esc(String(ptsA ?? 0))}</div>
          <div class="gpH2HVs">VS</div>
          <div class="gpH2HPts gpH2HDetailPts${bLead ? " gpH2HPtsWin" : ""}">${esc(String(ptsB ?? 0))}</div>
        </div>
        <div class="gpH2HDetailName gpH2HDetailNameRight${bLead ? " gpH2HDetailNameLead" : ""}">${esc(nameB)}</div>
      </div>`,
      gamesHTML: `<div class="gpH2HDetailGames">${rowsHTML || `<div class="gpEmpty">No games this week.</div>`}${tiebreakerRowHTML}</div>`,
    };
  }

  // ─── Matchup Detail overlay — any matchup in the week, opened by
  // tapping its row in the matchups list (own or someone else's). ──
  function gpBuildH2HMatchupDetailHTML(opts) {
    const { headerHTML, gamesHTML } = gpBuildH2HMatchupBodyHTML(opts);
    return `
<div class="gpPicksOverlayBackdrop" id="gpH2HDetailOverlay" role="dialog" aria-modal="true" aria-label="${esc(opts?.nameA)} vs ${esc(opts?.nameB)}">
  <div class="gpPicksOverlaySheet gpH2HDetailSheet" id="gpH2HDetailSheet">
    <div class="gpOverlayHandle"></div>
    <div class="gpOverlayHeader gpH2HDetailHeader">
      <button class="gpOverlayCloseBtn gpH2HDetailCloseBtn" id="gpH2HDetailClose" aria-label="Close">✕</button>
      ${headerHTML}
    </div>
    <div class="gpOverlayBody">
      ${gamesHTML}
    </div>
  </div>
</div>`;
  }

  // ─── Matchup tab — your matchup, always expanded inline (no tap
  // needed), reusing the exact same hero header + game-by-game pick
  // comparison as the overlay above, just in a plain card instead of a
  // modal sheet. Falls back to a simple "BYE" card on a bye week.
  function gpBuildH2HMyMatchupCardHTML(opts) {
    if (opts?.bye) {
      return `
<div class="gpLeaderCard gpH2HMyMatchupCard">
  <div class="gpH2HDetailEyebrow" style="padding-top:16px">${esc(opts?.weekLabel || "")}${opts?.weekLabel ? " · " : ""}Matchup</div>
  <div class="gpEmpty" style="padding:8px 20px 24px">You're on a bye this week — sit back and watch the rest of the league.</div>
</div>`;
    }
    const { headerHTML, gamesHTML } = gpBuildH2HMatchupBodyHTML(opts);
    return `
<div class="gpLeaderCard gpH2HMyMatchupCard">
  <div class="gpOverlayHeader gpH2HDetailHeader">
    ${headerHTML}
  </div>
  ${gamesHTML}
</div>`;
  }

  // ─── Matchup tab — composes: your matchup (always expanded), the
  // weekly high score callout, the week recap (once final), pre-lock
  // pick progress (reuses buildLeaderboardHTML exactly as the old
  // single-page "This Week" did — it already no-ops once the week has
  // any final game, via its own h2hFormat guard), then every other
  // matchup in the league. All of it built from the same
  // gpComputeWeeklyLeaderboard/gpGetH2HRoundForWeek/gpComputeH2HWeekResults
  // primitives the rest of the H2H feature already uses — nothing new
  // computed here beyond finding "which result is mine."
  function gpBuildH2HMatchupTabHTML({ weekLabel, games, allPicks, atsEventIds, tiebreakers, tiebreakerEventId, h2hSchedule, weekIndex, myName, leagueMembers, champion }) {
    const GP_Data = window.GP_Data || {};
    const list = Array.isArray(games) ? games : [];
    const championBannerHTML = champion ? `
<div class="gpChampionBanner gpChampionBannerCompact">
  <div class="gpChampionConfetti">🎉 🏆 🎉</div>
  <div class="gpChampionLabel">LEAGUE CHAMPION</div>
  <div class="gpChampionName">${esc(champion)}</div>
  <div class="gpChampionSub">The season is final — check the Standings tab for the full final order.</div>
</div>` : "";
    if (!list.length) return `${championBannerHTML}<div class="gpNotice">No games in this week yet.</div>`;

    const lb = typeof GP_Data.gpComputeWeeklyLeaderboard === "function"
      ? GP_Data.gpComputeWeeklyLeaderboard(list, allPicks, { atsEventIds, tiebreakers, tiebreakerEventId })
      : { rows: [], finalsCount: 0 };

    // Per-matchup tiebreaker winner needs each row's own guess alongside
    // the actual — attach it here the same way gpLoadWeeklyResultsForSeason
    // does for the season/standings path, so both agree on who won.
    if (lb.tiebreakerActual != null) {
      for (const r of lb.rows) {
        const guess = tiebreakers?.[r.key]?.guess;
        r.tbGuess = Number.isFinite(Number(guess)) ? Number(guess) : null;
      }
    }

    const round = typeof GP_Data.gpGetH2HRoundForWeek === "function" ? GP_Data.gpGetH2HRoundForWeek(h2hSchedule, weekIndex) : [];
    const results = typeof GP_Data.gpComputeH2HWeekResults === "function" ? GP_Data.gpComputeH2HWeekResults(round, lb.rows, lb.tiebreakerActual) : [];

    const myKey = String(myName || "").trim().toLowerCase();
    const myResult = results.find(m => m.bye
      ? String(m.bye).trim().toLowerCase() === myKey
      : m.players.some(p => String(p).trim().toLowerCase() === myKey));

    let myCardHTML = "";
    if (myResult) {
      if (myResult.bye) {
        myCardHTML = gpBuildH2HMyMatchupCardHTML({ bye: true, weekLabel });
      } else {
        // Which side of the pairing is the viewer, so the shared body
        // builder can always reveal their own pick/tiebreaker guess
        // while still hiding the opponent's until each one locks.
        const viewerSide = String(myResult.players[0]).trim().toLowerCase() === myKey ? "a" : "b";
        myCardHTML = gpBuildH2HMyMatchupCardHTML({
          nameA: myResult.players[0], nameB: myResult.players[1],
          ptsA: myResult.points[0], ptsB: myResult.points[1],
          weekLabel, games: list, allPicks, atsEventIds, viewerSide,
          tiebreakerEventId, tiebreakers
        });
      }
    }

    const otherResults = results.filter(m => m !== myResult);
    const otherMatchupsHTML = gpBuildH2HMatchupsHTML(otherResults, weekLabel);
    const highScoreHTML = gpBuildH2HHighScoreCalloutHTML({ rows: lb.rows, weekLabel });
    // Anyone without a real matchup this round (byed, or simply absent
    // from a round pared down to just playoff qualifiers) isn't making
    // any picks this week — Pick Progress shouldn't list them at all.
    const roundParticipants = typeof GP_Data.gpGetH2HRoundParticipants === "function"
      ? GP_Data.gpGetH2HRoundParticipants(round)
      : null;
    const progressHTML = buildLeaderboardHTML(weekLabel, lb, { leagueMembers, games: list, allPicks, h2hFormat: true, h2hParticipants: roundParticipants });

    let recapHTML = "";
    if (lb.finalsCount > 0 && lb.finalsCount === list.length) {
      const recap = typeof GP_Data.gpComputeWeeklyRecap === "function"
        ? GP_Data.gpComputeWeeklyRecap(list, lb, tiebreakers, tiebreakerEventId, lb.tiebreakerActual)
        : null;
      // H2H matchups each crown their own tiebreaker winner (see the
      // per-matchup tbWinner logic), so the single league-wide "closest
      // guess" line from the shared recap would be redundant/confusing here.
      recapHTML = gpBuildWeeklyRecapHTML(recap, weekLabel, { hideTiebreaker: true });
    }

    return `
${championBannerHTML}
${myCardHTML}
${highScoreHTML}
${recapHTML}
${progressHTML}
${otherMatchupsHTML}`;
  }

  function gpShowH2HMatchupOverlay(opts) {
    const existing = document.getElementById("gpH2HDetailOverlay");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", gpBuildH2HMatchupDetailHTML(opts));

    const backdrop = document.getElementById("gpH2HDetailOverlay");
    const sheet    = document.getElementById("gpH2HDetailSheet");
    const closeBtn = document.getElementById("gpH2HDetailClose");
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

  function gpDismissH2HMatchupOverlay() {
    const backdrop = document.getElementById("gpH2HDetailOverlay");
    if (backdrop) backdrop.remove();
  }

  // ─── Pre-lock progress (leaderboard before any game has gone final) ──
  // Every league member should be visible from the moment a week opens,
  // not just once someone's picks start scoring — so instead of an empty
  // "check back later" card, each member gets a "N of N games locked in"
  // progress bar. Falls back to whoever's picked so far for leagues
  // created before the Join League members list existed, so this never
  // regresses to showing nobody.
  // participantNames (optional): H2H only — names with a real matchup
  // this round (gpGetH2HRoundParticipants). When given, anyone byed or
  // excluded from a pared-down playoff round is left out entirely —
  // they're not making any picks this week, so they have no business in
  // a "games locked in" list.
  function gpComputePreLockProgress(members, games, allPicks, participantNames) {
    const total = Array.isArray(games) ? games.length : 0;
    const picks = (allPicks && typeof allPicks === "object") ? allPicks : {};
    const participantKeys = Array.isArray(participantNames)
      ? new Set(participantNames.map(n => String(n).trim().toLowerCase()))
      : null;
    const isParticipant = (name) => !participantKeys || participantKeys.has(String(name).trim().toLowerCase());

    const nameById = new Map();
    for (const m of (Array.isArray(members) ? members : [])) {
      const pid = String(m?.playerId || m?.uid || "").trim();
      const nm = String(m?.name || "Someone").trim() || "Someone";
      if (!pid || !isParticipant(nm)) continue;
      nameById.set(pid, nm);
    }

    const countById = new Map();
    for (const eventId of Object.keys(picks)) {
      const eventPicks = Array.isArray(picks[eventId]) ? picks[eventId] : [];
      for (const p of eventPicks) {
        const pid = String(p?.uid || "").trim();
        const nm = String(p?.name || "Someone").trim() || "Someone";
        if (!pid || !isParticipant(nm)) continue;
        if (!nameById.has(pid)) nameById.set(pid, nm);
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
    const rawList = Array.isArray(rows) ? rows : [];

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
      const progressRows = gpComputePreLockProgress(opts?.leagueMembers, opts?.games, opts?.allPicks, opts?.h2hParticipants);
      const countdownHTML = gpBuildCountdownWidgetHTML({
        label: "First game starts in",
        targetMs: gpEarliestKickoffMs(opts?.games),
        liveLabel: "🏈 Games underway"
      });
      const preLockTitle = opts?.h2hFormat ? "🎯 Pick Progress" : "🏆 Leaderboard";
      return `
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">${preLockTitle}</div>
    </div>
    ${countdownHTML}
  </div>
  ${gpBuildPreLockProgressHTML(progressRows)}
  ${scoringFooter}
</div>`;
    }

    // H2H leagues get their own "real leaderboard" — the weekly
    // Head-to-Head Matchups card — once any game's gone final, so the
    // cumulative-points table below (which isn't meaningful head-to-head)
    // just doesn't render for them from that point on. The pre-lock
    // progress view above still shows for every format, since "who's
    // picked so far" is useful regardless of how scoring works.
    if (opts?.h2hFormat) return "";

    // Once at least one game's gone final, backfill any league member who
    // never made a single pick this week — otherwise they'd just silently
    // vanish from the standings instead of showing up with a 0-0 week.
    const list = (window.GP_Data?.gpFillMissingLeagueMembers || ((r) => r))(rawList, opts?.leagueMembers);

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
  function gpBuildH2HSeasonStandingsHTML(seasonStandings, opts) {
    const { rows, weeksCount } = seasonStandings || {};
    const champion = opts?.champion || null;
    const finalStandings = Array.isArray(opts?.finalStandings) ? opts.finalStandings : null;
    const list = finalStandings || (Array.isArray(rows) ? rows : []);
    const isFinal = !!champion && !!finalStandings;

    const championBannerHTML = isFinal ? `
<div class="gpChampionBanner">
  <div class="gpChampionConfetti">🎉 🏆 🎉</div>
  <div class="gpChampionLabel">LEAGUE CHAMPION</div>
  <div class="gpChampionName">${esc(champion)}</div>
  <div class="gpChampionSub">The season is final — crowned after a hard-fought playoff run 📣</div>
</div>` : "";

    if (!list.length) {
      return `${championBannerHTML}
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
<tr class="gpStandingsRow${rowCls}" data-gpaction="openH2HProfile" data-name="${esc(nm)}">
  <td class="gpStRank">${rank}</td>
  <td class="gpStName gpH2HStName"><div class="gpStNameWrap"><span class="gpStNameText">${esc(nm)}</span></div></td>
  <td>${esc(record)}</td>
  <td>${esc(String(u.pointsFor ?? 0))}</td>
  <td>${esc(String(u.pointsAgainst ?? 0))}</td>
  <td>${esc(diffStr)}</td>
  <td>${esc(String(u.tbWins ?? 0))}</td>
</tr>`;
    }).join("");

    const standingsTableHTML = `
<div class="gpStandingsTableWrap">
  <table class="gpStandingsTable">
    <colgroup>
      <col style="width:7%"/>
      <col style="width:34%"/>
      <col style="width:13%"/>
      <col style="width:11%"/>
      <col style="width:11%"/>
      <col style="width:13%"/>
      <col style="width:11%"/>
    </colgroup>
    <thead>
      <tr>
        <th class="gpStRank">#</th>
        <th class="gpStName">Player</th>
        <th>W-L-T</th>
        <th>PF</th>
        <th>PA</th>
        <th>Diff</th>
        <th>🎯</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>
</div>`;

    return `${championBannerHTML}
<div class="gpLeaderCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">⚔️ ${isFinal ? "Final Standings" : "Head-to-Head Standings"}</div>
      <div class="gpLeaderWeekLabel">${isFinal ? "Season complete" : `${weeksCount || 0} week${weeksCount === 1 ? "" : "s"} played`}</div>
    </div>
  </div>
  <div class="gpLeaderPodium">
    ${podiumHTML}
  </div>
  <div class="gpStandingsDivider">
    <div class="gpStandingsDividerLine"></div>
    <div class="gpStandingsDividerLabel">${isFinal ? "Final Order" : "Full Standings"}</div>
    <div class="gpStandingsDividerLine"></div>
  </div>
  ${standingsTableHTML}
  <div class="gpColumnLegend">
    <b>W-L-T</b> matchup record &middot; <b>PF</b> points scored in matchups &middot; <b>PA</b> points allowed &middot; <b>Diff</b> point differential &middot; <b>🎯</b> tiebreakers won
  </div>
  <div class="gpColumnLegend">
    ${isFinal ? "Order reflects how far each player went in the playoff bracket." : "<b>Ties</b> (after record) are broken by points scored, then differential, then tiebreakers won, then name."}
  </div>
</div>`;
  }

  // ─── Weekly High Score callout (Matchup tab) — top scorer(s) across
  // the whole league this week, independent of anyone's matchup. Ties at
  // the top all get named. Nothing to celebrate at 0 points, so this
  // renders nothing until someone's actually scored.
  function gpBuildH2HHighScoreCalloutHTML({ rows, weekLabel }) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return "";
    const top = Number(list[0]?.points || 0);
    if (top <= 0) return "";
    const leaders = list.filter(r => Number(r.points || 0) === top).map(r => String(r?.name || "Someone"));
    return `
<div class="gpH2HHighScoreCallout">
  <div class="gpH2HHighScoreIcon">🔥</div>
  <div class="gpH2HHighScoreBody">
    <div class="gpH2HHighScoreLabel">${esc(weekLabel || "This Week")}&rsquo;s High Score</div>
    <div class="gpH2HHighScoreNames">${leaders.map(esc).join(" &amp; ")}</div>
  </div>
  <div class="gpH2HHighScorePts">${esc(String(top))}</div>
</div>`;
  }

  // ─── Schedule tab — the full season's pairings, week by week. Past/
  // final weeks show the actual score; anything else just shows the
  // upcoming opponent. `resultsByWeekIndex` is keyed by weekIndex (0-based,
  // matching gpGetH2HRoundForWeek) → { rows, finalsCount, gamesCount } or
  // null/undefined when that week has no games yet.
  function gpBuildH2HScheduleTabHTML({ schedule, weeks, totalWeeks, myName, resultsByWeekIndex, filterMine }) {
    const rounds = Array.isArray(schedule) ? schedule : [];
    if (!rounds.length) {
      return `<div class="gpLeaderCard"><div class="gpEmpty" style="padding:28px 20px">No schedule yet — your admin hasn't started the season.</div></div>`;
    }
    const weekList = Array.isArray(weeks) ? weeks : [];
    // Show at least every round once, and at least every real week already
    // created — whichever is longer — so a season that's gone past one
    // full round-robin (the schedule cycles via gpGetH2HRoundForWeek)
    // still lists every week that actually exists.
    const spanCount = Math.max(rounds.length, weekList.length, Number(totalWeeks) || 0);
    const myKey = String(myName || "").trim().toLowerCase();
    const GP_Data = window.GP_Data || {};
    const getRound = typeof GP_Data.gpGetH2HRoundForWeek === "function" ? GP_Data.gpGetH2HRoundForWeek : () => [];
    const getResults = typeof GP_Data.gpComputeH2HWeekResults === "function" ? GP_Data.gpComputeH2HWeekResults : () => [];

    const weekRowsHTML = [];
    for (let wi = 0; wi < spanCount; wi++) {
      const round = getRound(rounds, wi);
      if (!round.length) continue;
      const weekMeta = weekList[wi] || null;
      const label = String(weekMeta?.label || `Week ${wi + 1}`);
      const wr = resultsByWeekIndex ? resultsByWeekIndex[wi] : null;
      const isFinal = !!wr && Number(wr.gamesCount || 0) > 0 && Number(wr.finalsCount || 0) === Number(wr.gamesCount || 0);
      const results = isFinal ? getResults(round, wr.rows) : null;

      const pairsToShow = filterMine
        ? round.filter(m => m.bye
            ? String(m.bye).trim().toLowerCase() === myKey
            : m.players.some(p => String(p).trim().toLowerCase() === myKey))
        : round;
      if (filterMine && !pairsToShow.length) continue;

      const pairRowsHTML = pairsToShow.map((m, pi) => {
        if (m.bye) {
          return `
    <div class="gpH2HScheduleRow gpH2HByeRow">
      <div class="gpH2HName gpH2HNameLeft">${esc(String(m.bye))}</div>
      <div class="gpH2HByeLabel">BYE</div>
    </div>`;
        }
        const [nameA, nameB] = m.players;
        const res = results ? results.find(r => !r.bye && r.players[0] === nameA && r.players[1] === nameB) : null;
        const aWin = res?.winner === "a", bWin = res?.winner === "b", tie = res?.winner === "tie";
        const isMineRow = filterMine || nameA.trim().toLowerCase() === myKey || nameB.trim().toLowerCase() === myKey;
        return `
    <div class="gpH2HScheduleRow${isMineRow ? " gpH2HScheduleRowMine" : ""}">
      <div class="gpH2HName gpH2HNameLeft${aWin ? " gpH2HWinner" : ""}">${esc(nameA)}${aWin ? " 🏆" : ""}</div>
      ${res
        ? `<div class="gpH2HScoreCluster">
        <span class="gpH2HPts${aWin ? " gpH2HPtsWin" : ""}">${esc(String(res.points[0]))}</span>
        <span class="gpH2HVs">${tie ? "TIE" : "vs"}</span>
        <span class="gpH2HPts${bWin ? " gpH2HPtsWin" : ""}">${esc(String(res.points[1]))}</span>
      </div>`
        : `<div class="gpH2HVs">vs</div>`}
      <div class="gpH2HName gpH2HNameRight${bWin ? " gpH2HWinner" : ""}">${bWin ? "🏆 " : ""}${esc(nameB)}</div>
    </div>`;
      }).join("");
      if (!pairRowsHTML) continue;

      weekRowsHTML.push(`
<div class="gpH2HScheduleWeek">
  <div class="gpH2HScheduleWeekLabel">${esc(label)}${isFinal ? "" : weekMeta ? " · In Progress" : " · Upcoming"}</div>
  ${pairRowsHTML}
</div>`);
    }

    return `
<div class="gpLeaderCard gpH2HScheduleCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🗓️ Season Schedule</div>
    </div>
    <button type="button" class="smallBtn${filterMine ? " gpH2HScheduleFilterActive" : ""}" data-gpaction="toggleH2HScheduleMine">
      ${filterMine ? "★ My Schedule" : "☆ My Schedule Only"}
    </button>
  </div>
  <div class="gpH2HScheduleList">${weekRowsHTML.join("") || `<div class="gpEmpty">Nothing to show.</div>`}</div>
</div>`;
  }

  // ─── Playoffs tab ───────────────────────────────────────────────────
  // Two very different states:
  //  - No bracket yet (playoffRounds empty): projected seeding only —
  //    top N by current season standings, a simple bracket skeleton.
  //    Nothing persists here; it just visualizes current standings until
  //    the admin actually generates the bracket (League Settings'
  //    "Generate Playoffs Round").
  //  - A bracket exists: live bracket. Every generated round shows its
  //    REAL matchup(s) with live score/status, reusing the same
  //    gpGetH2HRoundForWeek/gpComputeH2HWeekResults primitives the
  //    Matchup/Schedule tabs already use — this tab adds no new picks
  //    machinery, just a trophy-themed view of the same data. Once the
  //    last round is a single, fully-final game, gpComputeH2HChampion
  //    crowns a champion and this tab leads with a banner for it.
  function gpBuildH2HPlayoffsTabHTML({ standings, playoffTeams, schedule, playoffRounds, resultsByWeekIndex }) {
    const GP_Data = window.GP_Data || {};
    const rounds = Array.isArray(playoffRounds) ? playoffRounds : [];

    if (!rounds.length) {
      const rows = Array.isArray(standings?.rows) ? standings.rows : [];
      const n = [2, 4, 6, 8].includes(Number(playoffTeams)) ? Number(playoffTeams) : 4;
      if (!rows.length) {
        return `<div class="gpLeaderCard"><div class="gpEmpty" style="padding:28px 20px">No standings yet — playoff seeding will show up once some weeks are final.</div></div>`;
      }
      const seeds = rows.slice(0, n);
      const pairs = [];
      for (let i = 0; i < Math.floor(seeds.length / 2); i++) {
        pairs.push([{ seed: i + 1, row: seeds[i] }, { seed: seeds.length - i, row: seeds[seeds.length - 1 - i] }]);
      }
      const seedSlotHTML = (slot) => slot?.row ? `
    <div class="gpH2HBracketSlot">
      <span class="gpH2HBracketSeed">${slot.seed}</span>
      <span class="gpH2HBracketName">${esc(String(slot.row.name || "TBD"))}</span>
    </div>` : `
    <div class="gpH2HBracketSlot gpH2HBracketSlotEmpty"><span class="gpH2HBracketName">TBD</span></div>`;
      const pairsHTML = pairs.map(([a, b]) => `
  <div class="gpH2HBracketMatchup">
    ${seedSlotHTML(a)}
    <div class="gpH2HVs">vs</div>
    ${seedSlotHTML(b)}
  </div>`).join("");

      return `
<div class="gpLeaderCard gpH2HPlayoffsCard">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Playoff Picture</div>
      <div class="gpLeaderWeekLabel">Top ${n}, projected seeding</div>
    </div>
  </div>
  <div class="gpH2HBracket">${pairsHTML}</div>
  <div class="gpColumnLegend">
    Seeding updates live from current standings until the regular season ends — your admin then sets the actual playoff matchups.
  </div>
</div>`;
    }

    // ── Live bracket ──
    const champion = typeof GP_Data.gpComputeH2HChampion === "function"
      ? GP_Data.gpComputeH2HChampion(rounds, schedule, resultsByWeekIndex)
      : null;

    const championBannerHTML = champion ? `
<div class="gpChampionBanner">
  <div class="gpChampionConfetti">🎉 🏆 🎉</div>
  <div class="gpChampionLabel">LEAGUE CHAMPION</div>
  <div class="gpChampionName">${esc(champion)}</div>
  <div class="gpChampionSub">Crowned after a hard-fought playoff run — shout it from the rooftops 📣</div>
</div>` : "";

    function playoffMatchupRowHTML(m, isFinal) {
      if (m.bye) {
        return `
  <div class="gpPlayoffMatchupRow gpPlayoffByeRow">
    <div class="gpH2HName gpH2HNameLeft">${esc(String(m.bye || "Someone"))}</div>
    <div class="gpH2HByeLabel">BYE — advances</div>
  </div>`;
      }
      const [nameA, nameB] = m.players;
      const [ptsA, ptsB] = Array.isArray(m.points) ? m.points : [0, 0];
      const decided = isFinal && (m.winner === "a" || m.winner === "b" || ((m.tbWinner === "a" || m.tbWinner === "b")));
      const aWin = decided && (m.winner === "a" || (m.winner === "tie" && m.tbWinner === "a"));
      const bWin = decided && (m.winner === "b" || (m.winner === "tie" && m.tbWinner === "b"));
      const tbNote = isFinal && m.winner === "tie" && (m.tbWinner === "a" || m.tbWinner === "b")
        ? `<div class="gpPlayoffTbNote">🎯 Decided by tiebreaker</div>` : "";
      return `
  <div class="gpPlayoffMatchupRow gpH2HMatchupRowClickable" data-gpaction="openH2HMatchup"
    data-namea="${esc(nameA)}" data-nameb="${esc(nameB)}" data-ptsa="${esc(String(ptsA))}" data-ptsb="${esc(String(ptsB))}">
    <div class="gpH2HName gpH2HNameLeft${aWin ? " gpH2HWinner" : ""}">${esc(nameA)}${aWin ? " 👑" : ""}</div>
    <div class="gpH2HScoreCluster">
      <span class="gpH2HPts${aWin ? " gpH2HPtsWin" : ""}">${esc(String(ptsA))}</span>
      <span class="gpH2HVs">vs</span>
      <span class="gpH2HPts${bWin ? " gpH2HPtsWin" : ""}">${esc(String(ptsB))}</span>
    </div>
    <div class="gpH2HName gpH2HNameRight${bWin ? " gpH2HWinner" : ""}">${bWin ? "👑 " : ""}${esc(nameB)}</div>
  </div>
  ${tbNote}`;
    }

    const roundsHTML = rounds.map((spec) => {
      const pairs = typeof GP_Data.gpGetH2HRoundForWeek === "function" ? GP_Data.gpGetH2HRoundForWeek(schedule, spec.weekIndex) : [];
      const wr = resultsByWeekIndex?.[spec.weekIndex];
      const hasStarted = !!wr;
      const isFinal = hasStarted && Number(wr.gamesCount) > 0 && Number(wr.finalsCount) === Number(wr.gamesCount);
      const results = hasStarted && typeof GP_Data.gpComputeH2HWeekResults === "function"
        ? GP_Data.gpComputeH2HWeekResults(pairs, wr.rows, wr.tiebreakerActual)
        : pairs.map(p => p.bye ? p : { ...p, points: [0, 0], winner: null, tbWinner: null });
      const isChampionshipRound = pairs.length === 1 && !pairs[0]?.bye;
      const statusLabel = isFinal ? "FINAL" : (hasStarted ? "LIVE" : "UPCOMING");
      const statusClass = isFinal ? "gpPlayoffStatusFinal" : (hasStarted ? "gpPlayoffStatusLive" : "gpPlayoffStatusUpcoming");
      return `
<div class="gpPlayoffRoundBlock${isChampionshipRound ? " gpPlayoffChampionshipBlock" : ""}">
  <div class="gpPlayoffRoundHead">
    <div class="gpPlayoffRoundLabel">${isChampionshipRound ? "🏆 " : ""}${esc(spec.label)}</div>
    <div class="gpPlayoffRoundStatus ${statusClass}">${statusLabel}</div>
  </div>
  ${results.map(r => playoffMatchupRowHTML(r, isFinal)).join("")}
</div>`;
    }).join("");

    return `
${championBannerHTML}
<div class="gpLeaderCard gpH2HPlayoffsCard gpPlayoffsLive">
  <div class="gpLeaderHeader">
    <div class="gpLeaderHeaderLeft">
      <div class="gpLeaderTitle">🏆 Playoffs</div>
      <div class="gpLeaderWeekLabel">${champion ? "Final results" : "Bracket in progress"}</div>
    </div>
  </div>
  ${roundsHTML}
</div>`;
  }

  // ─── Player profile overlay — all-time head-to-head record vs. every
  // opponent, reached by tapping a name in Standings. Bottom sheet, same
  // shell as the Join League overlay.
  function gpBuildH2HProfileOverlayHTML({ name, opponents }) {
    const list = Object.values(opponents && typeof opponents === "object" ? opponents : {})
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    const totals = list.reduce((acc, o) => ({ w: acc.w + Number(o.w || 0), l: acc.l + Number(o.l || 0), t: acc.t + Number(o.t || 0) }), { w: 0, l: 0, t: 0 });
    const rowsHTML = list.map(o => {
      const rec = Number(o.t || 0) > 0 ? `${o.w}-${o.l}-${o.t}` : `${o.w}-${o.l}`;
      return `
<div class="gpH2HProfileRow">
  <div class="gpH2HProfileOpp">${esc(String(o.name || "Someone"))}</div>
  <div class="gpH2HProfileRecord">${esc(rec)}</div>
</div>`;
    }).join("");
    const totalsStr = totals.t > 0 ? `${totals.w}-${totals.l}-${totals.t}` : `${totals.w}-${totals.l}`;

    return `
<div class="gpPicksOverlayBackdrop" id="gpH2HProfileOverlay" role="dialog" aria-modal="true" aria-label="${esc(name)} head-to-head record">
  <div class="gpPicksOverlaySheet" id="gpH2HProfileSheet">
    <div class="gpOverlayHandle"></div>
    <div class="gpOverlayHeader">
      <div class="gpOverlayTitle">
        <div>
          <div class="gpOverlayName">🥊 ${esc(name)}</div>
          <div class="gpOverlaySubtitle">All-Time Head-to-Head &middot; ${esc(totalsStr)}</div>
        </div>
      </div>
      <button class="gpOverlayCloseBtn" id="gpH2HProfileClose" aria-label="Close">✕</button>
    </div>
    <div class="gpOverlayBody">
      ${rowsHTML || `<div class="gpEmpty">No completed matchups yet.</div>`}
    </div>
  </div>
</div>`;
  }

  function gpShowH2HProfileOverlay(opts) {
    const existing = document.getElementById("gpH2HProfileOverlay");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", gpBuildH2HProfileOverlayHTML(opts));
    const backdrop = document.getElementById("gpH2HProfileOverlay");
    const sheet    = document.getElementById("gpH2HProfileSheet");
    const closeBtn = document.getElementById("gpH2HProfileClose");
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

  // ─── Season standings tie-break chain (fine print) ────────────────
  function gpBuildSeasonTiebreakRulesHTML() {
    return `
<div class="gpColumnLegend">
  <b>Season ties</b> (after total points) are broken in order: 1) most 🎯 tiebreakers won, 2) best ATS win percentage, 3) most correct underdog picks.
</div>`;
  }

  // ─── View toggle (This Week / Season) — points-format leagues only.
  // H2H leagues use gpBuildH2HTabBarHTML instead (see below); this
  // function's own behavior/callers are unchanged. ────────────────────
  // Same bar as the H2H tab bar below, width-wise and style-wise — just
  // 2 buttons for now instead of 5. Easy to grow: add entries here the
  // same way GP_H2H_TABS does, and the grid/sizing already adapts.
  const GP_VIEW_TOGGLE_TABS = [
    { id: "week",   label: "This Week", icon: "🗓️", action: "viewWeek"   },
    { id: "season", label: "Season",    icon: "🏆", action: "viewSeason" },
  ];
  function gpBuildViewToggleHTML(mode) {
    const m = mode === "season" ? "season" : "week";
    const btns = GP_VIEW_TOGGLE_TABS.map(t => `
  <button type="button" class="gpH2HTabBtn${t.id === m ? " gpH2HTabBtnActive" : ""}" data-gpaction="${t.action}">
    <span class="gpH2HTabIcon">${t.icon}</span>
    <span class="gpH2HTabLabel">${esc(t.label)}</span>
  </button>`).join("");
    return `<div class="gpH2HTabBar gpViewToggle2Col">${btns}</div>`;
  }

  // ─── H2H tab bar — replaces the This Week/Season toggle above for
  // H2H leagues specifically. Fixed 5-column grid (bottom-nav style)
  // so all five tabs always fit on screen — no horizontal scrolling.
  const GP_H2H_TABS = [
    { id: "matchup",   label: "Matchup",   icon: "⚔️" },
    { id: "picks",     label: "Picks",     icon: "☑️" },
    { id: "standings", label: "Standings", icon: "📊" },
    { id: "schedule",  label: "Schedule",  icon: "🗓️" },
    { id: "playoffs",  label: "Playoffs",  icon: "🏆" },
  ];
  function gpBuildH2HTabBarHTML(activeTab) {
    const active = GP_H2H_TABS.some(t => t.id === activeTab) ? activeTab : "matchup";
    const btns = GP_H2H_TABS.map(t => `
  <button type="button" class="gpH2HTabBtn${t.id === active ? " gpH2HTabBtnActive" : ""}" data-gpaction="viewH2HTab" data-h2htab="${t.id}">
    <span class="gpH2HTabIcon">${t.icon}</span>
    <span class="gpH2HTabLabel">${esc(t.label)}</span>
  </button>`).join("");
    return `<div class="gpH2HTabBar">${btns}</div>`;
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
    // No postedAt on an announcement saved before this field existed —
    // just omit the line rather than fabricate a posted time for it.
    const postedStr = fmtSavedAt(announcement?.postedAt);
    return `
<div class="gpAnnouncementBanner">
  <div class="gpAnnouncementIcon">📣</div>
  <div class="gpAnnouncementBody">
    ${title ? `<div class="gpAnnouncementTitle">${esc(title)}</div>` : ""}
    ${message ? `<div class="gpAnnouncementMessage">${esc(message)}</div>` : ""}
    ${postedStr ? `<div class="gpAnnouncementPostedAt">${esc(postedStr)}</div>` : ""}
  </div>
</div>`;
  }

  // ─── push notification opt-in banner ──────────────────────────────
  // Reads live browser/permission state at render time (window.GP_Notif,
  // from gp-notifications.js) rather than anything stored, so it always
  // reflects reality — e.g. disappears the moment permission is granted
  // without needing a page reload. Dismissing it is remembered in
  // localStorage so it doesn't nag on every visit.
  const GP_NOTIF_DISMISSED_KEY = "theShopNotifBannerDismissed_v1";
  function gpNotifBannerDismissed() {
    try { return localStorage.getItem(GP_NOTIF_DISMISSED_KEY) === "1"; } catch { return false; }
  }
  function gpBuildNotifOptInHTML() {
    const Notif = window.GP_Notif;
    if (!Notif || !Notif.gpNotifSupported || !Notif.gpNotifSupported()) return "";
    if (gpNotifBannerDismissed()) return "";

    const permission = Notif.gpNotifPermission();
    if (permission === "granted" || permission === "denied") return "";

    const needsHomeScreen = Notif.gpNotifNeedsHomeScreenFirst && Notif.gpNotifNeedsHomeScreenFirst();
    const body = needsHomeScreen
      ? "Add this app to your Home Screen (Share → Add to Home Screen) to get notified about picks locking, new weeks, and results."
      : "Get notified when picks are locking soon, a new week opens, or results are in.";
    const cta = needsHomeScreen
      ? ""
      : `<button type="button" class="gpNotifBannerBtn" data-gpaction="enableNotifications">Enable</button>`;

    return `
<div class="gpNotifBanner">
  <div class="gpNotifBannerIcon">🔔</div>
  <div class="gpNotifBannerBody">${esc(body)}</div>
  ${cta}
  <button type="button" class="gpNotifBannerDismiss" data-gpaction="dismissNotifBanner" aria-label="Dismiss">✕</button>
</div>`;
  }

  // An announcement with an expiresAt ("YYYY-MM-DD") past today no longer
  // shows. Compared as calendar dates (not a timestamp) so it stays up
  // through the entire selected day in the viewer's own local time.
  // Missing expiresAt — every announcement saved before this field
  // existed — never expires; it's grandfathered in, not backfilled.
  function gpAnnouncementExpired(a) {
    const exp = String(a?.expiresAt || "").trim();
    if (!exp) return false;
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return exp < todayStr;
  }

  // Up to 3 announcements, stacked in the order the admin entered them.
  // Each one reuses the exact same banner as a single announcement, so
  // one, two, or three all look consistent — an empty/missing list just
  // renders nothing, same as before.
  function gpBuildLeagueAnnouncementsHTML(announcements) {
    const list = Array.isArray(announcements) ? announcements : [];
    return list.filter(a => !gpAnnouncementExpired(a)).map(gpBuildLeagueAnnouncementHTML).filter(Boolean).join("");
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

  // ─── Admin builder — lives inside the Admin Tools overlay (opened from
  // the header's gear button), never inline on the page itself. Always
  // fully expanded — the overlay's own close button replaces the old
  // inline collapse/expand toggle.
  function gpBuildAdminBuilderHTML({
    weekId, weekLabel, availableEvents, leagueKey, dateStart, dateEnd,
    games, atsEventIds, tiebreakerEventId, pickLeagueId, loadStatus
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
<div class="gpAdminBlock">
  <div class="gpAdminBlockLabel">📊 Against the Spread<span class="gpAdminBlockHint">up to ${MAX_ATS_GAMES_UI}</span></div>
  <div class="gpAdminGameList" style="max-height:180px">
    ${atsRows}
  </div>
  <div class="gpAdminControls">
    <button class="gpAdminBtn gpAdminBtnPrimary" type="button" data-gpaction="adminSetAtsGames" data-weekid="${esc(weekId)}">Save ATS Games</button>
  </div>
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
<div class="gpAdminBlock">
  <div class="gpAdminBlockLabel">🎯 Tiebreaker Game</div>
  <div class="gpAdminDateRange">
    <select data-gptiebreakerselect="1" class="gpAdminSelect gpAdminSelectWide">
      ${options}
    </select>
    <button class="gpAdminBtn gpAdminBtnPrimary" type="button" data-gpaction="adminSetTiebreaker" data-weekid="${esc(weekId)}">Set</button>
  </div>
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
<div class="gpAdminPanel">
<div class="gpAdminOverlayTop">
  <div class="gpAdminHeadWeek">${esc(weekLabel || weekId || "No week yet")}</div>
  <div class="gpAdminHeadActions">
    <button class="gpAdminBtn gpAdminBtnGhost" type="button" data-gpaction="openAdminOverlaySettings" data-leagueid="${esc(pickLeagueId || "")}">League Settings</button>
    <button class="gpAdminBtn gpAdminBtnGhost" type="button" data-gpaction="adminCreateWeek" data-leagueid="${esc(pickLeagueId || "")}">+ New Week</button>
  </div>
</div>

<div class="gpAdminBlock">
  <div class="gpAdminBlockLabel">🗓️ Load Games</div>
  <div class="gpAdminControls">
    <select data-league-select class="gpAdminSelect">
      ${leagueOptions}
    </select>
    <button class="gpAdminBtn gpAdminBtnGhost" type="button" data-gpaction="adminQuickWeekRange">This Week (Thu–Mon)</button>
  </div>
  <div class="gpAdminDateRange">
    <span class="gpAdminInlineLabel">From</span>
    <input type="date" data-date-start-input value="${esc(startInputVal)}" class="gpAdminDateInput"/>
    <span class="gpAdminInlineLabel">to</span>
    <input type="date" data-date-end-input value="${esc(endInputVal)}" class="gpAdminDateInput"/>
    <button class="gpAdminBtn gpAdminBtnPrimary" type="button" data-gpaction="adminLoadGames">Load Games</button>
  </div>
</div>

<div class="gpAdminBlock">
  <div class="gpAdminBlockLabel">🏈 Available Games${sorted.length ? `<span class="gpAdminBlockCount">${sorted.length}</span>` : ""}</div>
  <div id="gpAdminGameList" class="gpAdminGameList">
    ${sorted.length ? gameRows : `<div class="gpAdminEmptyHint">No games loaded yet — pick a date range above and tap Load Games.</div>`}
  </div>
  ${sorted.length ? `
  <div class="gpAdminControls">
    <button class="gpAdminBtn gpAdminBtnGhost" type="button" data-gpselect="all">Select All</button>
    <button class="gpAdminBtn gpAdminBtnGhost" type="button" data-gpselect="none">Select None</button>
    <button class="gpAdminBtn gpAdminBtnPrimary" type="button" data-gpaction="adminAddGames" data-weekid="${esc(weekId)}">Add Selected</button>
  </div>` : ""}
</div>

${committedGames.length ? `
<div class="gpAdminBlock">
  <div class="gpAdminBlockLabel">📤 Publish</div>
  <div class="gpAdminControls">
    <button class="gpAdminBtn gpAdminBtnPublish" type="button" data-gpaction="adminPublish" data-weekid="${esc(weekId)}" data-leagueid="${esc(pickLeagueId || "")}">Publish Week</button>
  </div>
</div>` : ""}
${atsHTML}
${tiebreakerHTML}
<div class="gpAdminStatus${loadStatus && /^error/i.test(loadStatus) ? " gpAdminStatusError" : ""}" id="gpAdminStatus">${loadStatus ? esc(loadStatus) : ""}</div>
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
    lockReminder, h2hFormat, h2hSchedule, weekIndex, leagueMembers, myName,
    // Set by the H2H Picks tab only — the matchups card, pre-lock
    // progress, and weekly recap all moved to the Matchup tab, so this
    // skips computing/rendering them here to avoid showing them twice.
    // Points-format leagues never pass this, so their own single "This
    // Week" page (still calling this same function) is unaffected.
    h2hPicksOnly
  }) {
    if (!weekId) {
      // For H2H leagues specifically, a missing week almost always means
      // the admin hasn't hit "Start Season" yet (rather than just needing
      // a new week created) — the generic points-league message below is
      // actively misleading here, so this gets its own explanation plus
      // a look at who's already in.
      if (h2hFormat) return gpBuildH2HPreSeasonHTML(leagueMembers);
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
    const GP_Data = window.GP_Data || {};

    // H2H only: a player with no REAL matchup this round — explicitly
    // byed, or simply absent from a round that's been pared down to just
    // the playoff qualifiers (see the "generateH2HPlayoffRound" admin
    // action) — has nothing to pick toward and shouldn't see the
    // game-picking UI at all. A round with zero pairs (schedule not
    // generated yet) is NOT treated as exclusion — that falls through to
    // normal picks so a data gap here can never accidentally lock
    // everyone out. roundParticipants (names with a real pair this
    // round) is also handed to Pick Progress below so it can stop
    // listing someone who isn't making any picks this week.
    let sittingOut = false;
    let roundParticipants = null;
    if (h2hFormat && typeof GP_Data.gpGetH2HRoundForWeek === "function") {
      const round = GP_Data.gpGetH2HRoundForWeek(h2hSchedule, weekIndex);
      if (Array.isArray(round) && round.length > 0) {
        roundParticipants = typeof GP_Data.gpGetH2HRoundParticipants === "function"
          ? GP_Data.gpGetH2HRoundParticipants(round)
          : [];
        if (myName) {
          const myKey = String(myName).trim().toLowerCase();
          sittingOut = !roundParticipants.some(p => String(p).trim().toLowerCase() === myKey);
        }
      }
    }

    const sorted = [...list].sort((a, b) => startMs(a) - startMs(b));
    const straightGames = sorted.filter(g => !atsIdSet.has(String(g?.eventId || g?.id || "")));
    const atsGames      = sorted.filter(g => atsIdSet.has(String(g?.eventId || g?.id || "")));

    const straightCardsHTML = sittingOut ? "" : straightGames.map(g => buildGameCard(g, weekId, myMap, pendingGet, false, isAdmin)).filter(Boolean).join("");
    const atsCardsHTML      = sittingOut ? "" : atsGames.map(g => buildGameCard(g, weekId, myMap, pendingGet, true, isAdmin)).filter(Boolean).join("");
    const sittingOutHTML    = sittingOut
      ? `<div class="gpEmpty" style="padding:24px 20px;text-align:center;">🏈 No matchup scheduled for you this round — sit back and watch the rest of the league.</div>`
      : "";

    let leaderboardHTML = "";
    let recapHTML = "";
    let matchupsHTML = "";
    if (!isDraft && !h2hPicksOnly) {
      const lb = typeof GP_Data.gpComputeWeeklyLeaderboard === "function"
        ? GP_Data.gpComputeWeeklyLeaderboard(list, allPicks, { atsEventIds: [...atsIdSet], tiebreakers, tiebreakerEventId })
        : { rows: [], finalsCount: 0 };
      leaderboardHTML = buildLeaderboardHTML(weekLabel, lb, { leagueMembers, games: list, allPicks, h2hFormat, h2hParticipants: roundParticipants });

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
    if (tiebreakerEventId && !sittingOut) {
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

    const saveRow = sittingOut ? "" : `
<div class="gpSaveRow">
  <button class="gpHeaderSaveBtn" type="button" data-gpaction="savePicks" disabled>Save</button>
  <span style="font-size:12px;font-weight:700;color:rgba(255,255,255,0.4)">Saves your pending picks</span>
</div>`;

    return `
${isDraft ? `<div style="padding:0 0 10px"><span class="gpDraftBadge">DRAFT — only admins see this</span></div>` : ""}
${lockReminder || ""}
${matchupsHTML}
${recapHTML}
${leaderboardHTML}
${sittingOutHTML}
${straightCardsHTML ? gpBuildSectionHeaderHTML(
  "☑️ Outright Winners", "outright",
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
  // showAdminBtn: only true from the two "actually inside a league"
  // render paths (H2H and classic points-format) — never on the League
  // Picker or the League Settings full-page view, so the gear button
  // only ever shows where there's a real week/league context behind it.
  function renderPicksHeaderHTML({ leagueName, isAdmin, showLeaguesBtn, showSaveBtn = true, showAdminBtn = false, weekId, pickLeagueId, playerName }) {
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
    <div class="gpHeaderActionsLeft">
      <button class="gpHeaderIconBtn" type="button" data-gpaction="openHeaderMenu" data-show-leagues="${showLeaguesBtn ? "1" : "0"}" aria-label="Menu">⋮</button>
      ${showAdminBtn && isAdmin ? `<button class="gpHeaderIconBtn gpHeaderAdminBtn" type="button" data-gpaction="openAdminOverlay" data-weekid="${esc(weekId || "")}" data-leagueid="${esc(pickLeagueId || "")}" aria-label="Admin Tools">⚙️</button>` : ""}
    </div>
    <div class="gpHeaderActionsRight">
      <button class="gpHeaderIconBtn" type="button" data-gpaction="refresh" aria-label="Refresh">↺</button>
      ${showSaveBtn ? `<button class="gpHeaderSaveBtn" type="button" data-gpaction="savePicks" disabled>Save</button>` : ""}
    </div>
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
    const byName  = (a, b) => String(a.name || "").localeCompare(String(b.name || ""));
    const active   = visible.filter(l => !l.archived).sort(byName);
    // Archived leagues are only ever in `visible` for an admin (the
    // filter above drops them for everyone else), so this is naturally
    // empty for a non-admin — no extra guard needed below.
    const archived = visible.filter(l => l.archived).sort(byName);

    const buildCard = (l) => {
      const weeksCount = Array.isArray(l.weeks) ? l.weeks.length : 0;
      const totalWeeks = Number(l.totalWeeks) || 0;
      const weeksLabel = totalWeeks ? `${weeksCount} of ${totalWeeks} weeks` : `${weeksCount} week${weeksCount !== 1 ? "s" : ""}`;
      const meta = `${esc(String(l.seasonYear || ""))} · ${weeksLabel}${l.archived ? " · Archived" : ""}`;
      const activePill = (l.active && !l.archived) ? `<span class="gpLeagueActivePill"><span class="gpLeagueActiveDot"></span>Active</span>` : "";
      const isMember = !!l.isMember;
      // Only a non-member who could plausibly still join sees the Join
      // CTA — once a league's season is underway it's only still in
      // this list at all for an admin (see groupPicks.js's picker
      // filter), and prompting them to "Join" a league already several
      // weeks deep doesn't make sense.
      const canJoin = !isMember && !l.seasonUnderway;
      const cta = isMember
        ? `<div class="gpLeagueCardCtaGroup">
    <div class="gpLeagueCardCta gpLeagueCardCtaVisit">Visit League ›</div>
    <div class="gpLeagueCardCtaInvite" data-gpaction="inviteToLeague" data-leagueid="${esc(l.id)}" data-leaguename="${esc(l.name || "")}" title="Invite someone to this league">📤 Invite</div>
  </div>`
        : (canJoin ? `<div class="gpLeagueCardCta gpLeagueCardCtaJoin">Join</div>` : "");

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

      // Top-3 season standings — independent of the countdown above it,
      // so it keeps showing (and, since groupPicks.js only caches
      // already-final weeks, keeps updating) after the countdown itself
      // drops off once the week is underway.
      const top3 = Array.isArray(l.top3) ? l.top3 : [];
      const top3RowsHTML = top3.map(r => {
        const nm = String(r?.name || "Someone");
        return `
      <div class="gpLeagueCardTop3Row gpRank${r.rank}">
        <div class="gpLeagueCardTop3Rank gpRank${r.rank}">${r.rank}</div>
        <div class="gpLeagueCardTop3Name">${esc(nm)}</div>
        <div class="gpLeagueCardTop3Pts">${esc(String(r.points))} pts</div>
      </div>`;
      }).join("");
      const top3HTML = top3RowsHTML ? `
  <div class="gpLeagueCardTop3">
    <div class="gpLeagueCardTop3Label">🏆 Season Standings</div>
    ${top3RowsHTML}
  </div>` : "";

      return `
<div class="gpLeagueCard${l.archived ? " gpLeagueArchived" : ""}" data-gpaction="${canJoin ? "openJoinOverlay" : "selectLeague"}" data-leagueid="${esc(l.id)}">
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
  ${top3HTML}
</div>`;
    };

    const activeCards = active.map(buildCard).join("");

    // Archived leagues collapse behind a toggle (admin-only — they're
    // never in `archived` otherwise) so a picker full of old test/one-off
    // leagues doesn't bury the ones actually in play. Collapsed by
    // default; state persists like the admin-tools panel's own toggle.
    let archivedSectionHTML = "";
    if (isAdmin && archived.length) {
      const archivedCards = archived.map(buildCard).join("");
      let startCollapsed = true;
      try { startCollapsed = localStorage.getItem("theShopGpArchivedLeaguesCollapsed_v1") !== "0"; } catch {}
      archivedSectionHTML = `
<div class="gpArchivedLeaguesToggle" data-gpaction="toggleArchivedLeagues" role="button" tabindex="0">
  <span class="gpArchivedLeaguesArrow" id="gpArchivedLeaguesArrow">${startCollapsed ? "▸" : "▾"}</span>
  <span>Archived Leagues (${archived.length})</span>
</div>
<div class="gpLeaguePickerGrid gpArchivedLeaguesGrid" id="gpArchivedLeaguesGrid" ${startCollapsed ? "hidden" : ""}>
  ${archivedCards}
</div>`;
    }

    const createTile = isAdmin
      ? `<div class="gpLeagueCreateTile" data-gpaction="createLeague">+ Create League</div>`
      : "";

    const empty = !active.length && !archived.length
      ? `<div class="gpEmpty">${isAdmin ? "No leagues yet — create one to get started." : "No leagues yet. Check back soon."}</div>`
      : "";

    return `
<div class="gpLeaguePickerGrid">
  ${empty}
  ${activeCards}
  ${createTile}
</div>
${archivedSectionHTML}`;
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

  // ─── Manage Player overlay ──────────────────────────────────────────
  // Joined Players rows used to carry three buttons apiece (Reset Code,
  // Fix Name, Merge Into…), which left no room for the player's own name
  // once a league had more than a couple members. This tucks all three
  // behind a single ⚙️ per row.
  //
  // Merge Into used to be a typed-name prompt — broken by construction
  // for the exact case it exists to fix: two rows sharing the identical
  // display name (a duplicate player) can't be told apart by typing that
  // name back in. Tapping a specific row here is unambiguous regardless
  // of name collisions.
  function gpBuildPlayerManageOverlayHTML({ playerId, name, otherMembers }) {
    const nm = String(name || "Someone");
    const { bg, color } = avatarStyle(nm);
    const others = Array.isArray(otherMembers) ? otherMembers : [];
    const mergeRowsHTML = others.length
      ? others.map(m => {
          const { bg: b2, color: c2 } = avatarStyle(String(m.name || "Someone"));
          const joined = fmtSavedAt(m.joinedAt);
          const weeksPicked = Number(m.weeksPicked || 0);
          // The number that actually matters here: a join date alone
          // can't tell two same-named rows apart, but "0 weeks" instantly
          // flags an empty membership record vs. the one holding real
          // picks — pick that one as "into" by mistake and the merge
          // silently moves nothing.
          const weeksLabel = `<div class="muted" style="font-size:11px; font-weight:900; flex:0 0 auto;">${weeksPicked} week${weeksPicked === 1 ? "" : "s"} picked</div>`;
          return `
      <button class="gpJoinMemberRow gpMergeTargetRow" type="button" data-gpaction="adminMergePlayerPick" data-playerid="${esc(playerId)}" data-name="${esc(nm)}" data-intoid="${esc(m.playerId)}" data-intoname="${esc(m.name)}">
        <div class="gpJoinMemberAvatar" style="background:${b2};color:${c2}">${esc(initials(m.name))}</div>
        <div class="gpJoinMemberName">${esc(m.name)}</div>
        ${weeksLabel}
        ${joined ? `<div class="muted" style="font-size:10px; flex:0 0 auto;">joined ${esc(joined)}</div>` : ""}
      </button>`;
        }).join("")
      : `<div class="gpJoinMembersEmpty">No other players to merge into.</div>`;

    return `
<div class="gpPicksOverlayBackdrop" id="gpPlayerManageOverlay" role="dialog" aria-modal="true" aria-label="Manage ${esc(nm)}">
  <div class="gpPicksOverlaySheet" id="gpPlayerManageOverlaySheet">
    <div class="gpOverlayHandle"></div>
    <div class="gpOverlayHeader">
      <div class="gpOverlayTitle">
        <div class="gpJoinMemberAvatar" style="background:${bg};color:${color}">${esc(initials(nm))}</div>
        <div>
          <div class="gpOverlayName">${esc(nm)}</div>
          <div class="gpOverlaySubtitle">Manage player</div>
        </div>
      </div>
      <button class="gpOverlayCloseBtn" id="gpPlayerManageOverlayClose" aria-label="Close">✕</button>
    </div>
    <div class="gpOverlayBody">
      <button class="smallBtn" type="button" style="width:100%; margin-bottom:8px;" data-gpaction="adminResetPlayerCode" data-playerid="${esc(playerId)}" data-name="${esc(nm)}">Reset Password</button>
      <button class="smallBtn" type="button" style="width:100%; margin-bottom:18px;" data-gpaction="adminSyncPlayerName" data-playerid="${esc(playerId)}" data-name="${esc(nm)}">Fix Name</button>

      <div class="gpJoinMembersLabel">Merge &#8220;${esc(nm)}&#8221; into&hellip;</div>
      <div class="gpJoinMembersList">${mergeRowsHTML}</div>
    </div>
  </div>
</div>`;
  }

  function gpShowPlayerManageOverlay(playerId, name, otherMembers) {
    const existing = document.getElementById("gpPlayerManageOverlay");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", gpBuildPlayerManageOverlayHTML({ playerId, name, otherMembers }));

    const backdrop = document.getElementById("gpPlayerManageOverlay");
    const sheet    = document.getElementById("gpPlayerManageOverlaySheet");
    const closeBtn = document.getElementById("gpPlayerManageOverlayClose");
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

  function gpDismissPlayerManageOverlay() {
    const backdrop = document.getElementById("gpPlayerManageOverlay");
    if (backdrop) backdrop.remove();
  }

  // ─── Header ⋮ menu overlay ──────────────────────────────────────────
  // Leagues / Change Code / Logout — every header action besides Save
  // and Refresh (the two things touched on nearly every visit) moved
  // here so the header itself never has more than three buttons on it.
  function gpBuildHeaderMenuOverlayHTML({ showLeaguesBtn }) {
    return `
<div class="gpPicksOverlayBackdrop" id="gpHeaderMenuOverlay" role="dialog" aria-modal="true" aria-label="Menu">
  <div class="gpPicksOverlaySheet" id="gpHeaderMenuOverlaySheet">
    <div class="gpOverlayHandle"></div>
    <div class="gpOverlayHeader">
      <div class="gpOverlayTitle"><div class="gpOverlayName">Menu</div></div>
      <button class="gpOverlayCloseBtn" id="gpHeaderMenuOverlayClose" aria-label="Close">✕</button>
    </div>
    <div class="gpOverlayBody">
      ${showLeaguesBtn ? `
      <button class="gpMenuRow" type="button" data-gpaction="showLeaguePicker">
        <span class="gpMenuRowIcon">🏆</span><span>Leagues</span>
      </button>` : ""}
      <button class="gpMenuRow" type="button" data-gpaction="openChangeCode">
        <span class="gpMenuRowIcon">🔑</span><span>Change Password</span>
      </button>
      <button class="gpMenuRow gpMenuRowLogout" type="button" data-gpaction="name">
        <span class="gpMenuRowIcon">🚪</span><span>Logout</span>
      </button>
    </div>
  </div>
</div>`;
  }

  function gpShowHeaderMenuOverlay(showLeaguesBtn) {
    const existing = document.getElementById("gpHeaderMenuOverlay");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", gpBuildHeaderMenuOverlayHTML({ showLeaguesBtn }));

    const backdrop = document.getElementById("gpHeaderMenuOverlay");
    const sheet    = document.getElementById("gpHeaderMenuOverlaySheet");
    const closeBtn = document.getElementById("gpHeaderMenuOverlayClose");
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
      // Outside the sheet, or a menu row that's about to navigate away —
      // either way the menu shouldn't linger behind whatever comes next.
      if (!sheet.contains(e.target) || e.target.closest(".gpMenuRow")) dismiss();
    });
    function onKey(e) {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onKey); }
    }
    document.addEventListener("keydown", onKey);
  }

  function gpDismissHeaderMenuOverlay() {
    const backdrop = document.getElementById("gpHeaderMenuOverlay");
    if (backdrop) backdrop.remove();
  }

  // ─── Admin Tools overlay ────────────────────────────────────────────
  // Opened from the header's gear button (any H2H tab or the classic
  // points-format page) instead of the old inline collapsible panel.
  // "Nearly full page" per the ask — a taller sheet than the other
  // bottom sheets in the app, since Admin Tools has a lot to show at
  // once — but otherwise the exact same overlay recipe (X button,
  // click-outside, Escape). Its body gets swapped in place (via
  // gpSetAdminToolsOverlayBody) to show either the Admin Tools panel
  // itself or, when "League Settings" is tapped, the settings form —
  // without closing/reopening the overlay, so Save/Cancel inside
  // Settings can land back on Admin Tools within the same sheet.
  function gpBuildAdminToolsOverlayHTML(bodyHTML) {
    return `
<div class="gpPicksOverlayBackdrop" id="gpAdminToolsOverlay" role="dialog" aria-modal="true" aria-label="Admin Tools">
  <div class="gpPicksOverlaySheet gpAdminToolsSheet" id="gpAdminToolsOverlaySheet">
    <div class="gpOverlayHandle"></div>
    <div class="gpOverlayHeader">
      <div class="gpOverlayTitle"><div class="gpOverlayName">⚙️ Admin Tools</div></div>
      <button class="gpOverlayCloseBtn" id="gpAdminToolsOverlayClose" aria-label="Close">✕</button>
    </div>
    <div class="gpOverlayBody" id="gpAdminToolsOverlayBody">
      ${bodyHTML || ""}
    </div>
  </div>
</div>`;
  }

  function gpShowAdminToolsOverlay(bodyHTML) {
    const existing = document.getElementById("gpAdminToolsOverlay");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", gpBuildAdminToolsOverlayHTML(bodyHTML));

    const backdrop = document.getElementById("gpAdminToolsOverlay");
    const sheet    = document.getElementById("gpAdminToolsOverlaySheet");
    const closeBtn = document.getElementById("gpAdminToolsOverlayClose");
    if (!backdrop) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => backdrop.classList.add("gpOverlayVisible"));
    });

    function dismiss() {
      backdrop.classList.remove("gpOverlayVisible");
      backdrop.addEventListener("transitionend", () => backdrop.remove(), { once: true });
    }

    closeBtn?.addEventListener("click", dismiss);
    // Only a click genuinely outside the sheet closes it — unlike the ⋮
    // menu, everything in here (inputs, checkboxes, buttons) needs to
    // stay open while it's used.
    backdrop.addEventListener("click", (e) => {
      if (!sheet.contains(e.target)) dismiss();
    });
    function onKey(e) {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onKey); }
    }
    document.addEventListener("keydown", onKey);
  }

  function gpDismissAdminToolsOverlay() {
    const backdrop = document.getElementById("gpAdminToolsOverlay");
    if (backdrop) backdrop.remove();
  }

  // Swaps the overlay's body content in place (Admin Tools <-> League
  // Settings) without touching the backdrop/sheet's open animation state.
  function gpSetAdminToolsOverlayBody(bodyHTML) {
    const body = document.getElementById("gpAdminToolsOverlayBody");
    if (body) body.innerHTML = bodyHTML || "";
  }

  // ─── League settings form (create or edit) ────────────────────────
  function gpBuildLeagueSettingsHTML({ mode, league, leagueMembers }) {
    const GP_Data = window.GP_Data || {};
    const isEdit = mode === "edit" && league;
    const name    = esc(String(league?.name ?? ""));
    const year    = Number(league?.seasonYear) || new Date().getFullYear();
    const totalWeeks = Number(league?.totalWeeks) || "";
    const archived = !!league?.archived;
    const isH2H = league?.format === "h2h";
    const h2hPlayoffTeams = Number(league?.h2hPlayoffTeams) || 4;
    // Backward-compat: a league saved before multi-announcement support
    // only has the old singular `announcement` field — treat it as slot 1.
    const existingAnnouncements = Array.isArray(league?.announcements)
      ? league.announcements
      : (league?.announcement ? [league.announcement] : []);
    const announcementSlotsHTML = [0, 1, 2].map(i => {
      const a = existingAnnouncements[i] || {};
      const t = esc(String(a?.title ?? ""));
      const m = esc(String(a?.message ?? ""));
      const exp = esc(String(a?.expiresAt ?? ""));
      return `
    <div class="gpAnnouncementSlot">
      <div class="gpAnnouncementSlotLabel">📣 Announcement ${i + 1}</div>
      <input type="text" id="gpLeagueAnnouncementTitle${i}" class="gpLeagueSettingsInput" value="${t}" placeholder="e.g. Playoffs start next week!" maxlength="60"/>
      <textarea id="gpLeagueAnnouncementMessage${i}" class="gpLeagueSettingsInput" rows="2" maxlength="280"
        placeholder="Optional message shown below the title">${m}</textarea>
      <div class="gpAnnouncementExpiryRow">
        <div class="gpAnnouncementExpiryField">
          <span class="gpAdminInlineLabel">Shows until</span>
          <input type="date" id="gpLeagueAnnouncementExpires${i}" class="gpAdminDateInput gpAnnouncementExpiryInput" value="${exp}"/>
        </div>
        <div class="gpAnnouncementExpiryQuick">
          <button type="button" class="smallBtn gpAnnouncementExpiryQuickBtn" data-gpaction="setAnnouncementExpiry" data-slot="${i}" data-days="7">1 week</button>
          <button type="button" class="smallBtn gpAnnouncementExpiryQuickBtn" data-gpaction="setAnnouncementExpiry" data-slot="${i}" data-days="30">1 month</button>
        </div>
      </div>
    </div>`;
    }).join("");

    // Who has actually joined this league — admin-only visibility, using
    // the same avatar/name row styling as the player-facing Join overlay.
    const membersList = Array.isArray(leagueMembers) ? leagueMembers : [];
    // A name shared by more than one row is exactly the ambiguous case
    // (a real duplicate, or a stale empty membership record left behind
    // from one) where "how many weeks does this ID actually have picks
    // for" is the one thing that actually disambiguates them.
    const nameCounts = new Map();
    membersList.forEach(m => {
      const key = String(m.name || "").trim().toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
    });
    const membersRowsHTML = membersList.map(m => {
      const { bg, color } = avatarStyle(String(m.name || "Someone"));
      // Has picks on file in this league but never actually went through
      // gpJoinLeague (see gpGetAllPickedPlayersForWeeks) — most often a
      // stray duplicate id from a bad login. Flagged so it doesn't read
      // as an ordinary member and an admin knows to look at merging it.
      const notJoinedBadge = m.notJoined
        ? `<span class="muted" style="font-size:10.5px; font-weight:800; flex:0 0 auto; margin-right:4px;" title="Has picks on file but never joined this league — likely a stray duplicate">not joined</span>`
        : "";
      const isDuplicateName = nameCounts.get(String(m.name || "").trim().toLowerCase()) > 1;
      const weeksBadge = isDuplicateName
        ? `<span class="muted" style="font-size:10.5px; font-weight:800; flex:0 0 auto; margin-right:4px;" title="How many weeks this specific id has picks on file for">${Number(m.weeksPicked || 0)}wk</span>`
        : "";
      return `
      <div class="gpJoinMemberRow">
        <div class="gpJoinMemberAvatar" style="background:${bg};color:${color}">${esc(initials(m.name))}</div>
        <div class="gpJoinMemberName">${esc(m.name)}</div>
        ${weeksBadge}
        ${notJoinedBadge}
        <button class="gpMemberManageBtn" type="button" data-gpaction="openPlayerManage" data-playerid="${esc(m.playerId)}" data-name="${esc(m.name)}" aria-label="Manage ${esc(m.name)}" title="Manage player">⚙️</button>
      </div>`;
    }).join("");
    const membersSectionHTML = isEdit ? `
  <div class="gpLeagueSettingsRow">
    <div class="gpLeagueSettingsLabel">Joined Players (${membersList.length})</div>
    ${membersList.length
      ? `<div class="gpJoinMembersList">${membersRowsHTML}</div>`
      : `<div class="gpJoinMembersEmpty">Nobody's joined this league yet.</div>`}
  </div>` : "";

    // ── Head-to-Head: "Start Season" (pre-season) or a manual schedule
    //    editor (post-season) — roster comes from whoever has actually
    //    joined (membersList, real Join League flow), not admin-typed
    //    names. See gpAdminStartH2HSeason/gpAdminSetH2HSchedule.
    const seasonStarted = !!league?.seasonStarted;
    const h2hRoster   = Array.isArray(league?.h2hRoster) ? league.h2hRoster : [];
    const h2hSchedule = Array.isArray(league?.h2hSchedule) ? league.h2hSchedule : [];
    let h2hSeasonBodyHTML = "";
    if (!isEdit) {
      h2hSeasonBodyHTML = `<div class="muted" style="font-size:12px">Create the league first — players join it exactly like a points league. Once enough have joined, come back here to start the season.</div>`;
    } else if (!seasonStarted) {
      const joinedCount = membersList.length;
      h2hSeasonBodyHTML = `
    <div class="muted" style="font-size:12px">${joinedCount} player${joinedCount === 1 ? "" : "s"} joined so far. Starting the season snapshots this list and generates a round-robin schedule — one matchup per player per round.</div>
    <button class="smallBtn gpH2HStartSeasonBtn" type="button" data-gpaction="startH2HSeason" data-leagueid="${esc(league?.id || "")}" ${joinedCount < 2 ? "disabled" : ""}>🏁 Start Season</button>
    ${joinedCount < 2 ? `<div class="muted" style="font-size:11px">Need at least 2 joined players first.</div>` : ""}`;
    } else {
      // Option pool for every dropdown: the frozen roster plus anyone
      // who's joined since (in case a late joiner needs manually slotting
      // into a round) — deduped case-insensitively.
      const poolSeen = new Set();
      const pool = [];
      for (const n of [...h2hRoster, ...membersList.map(m => m.name)]) {
        const nm = String(n || "").trim();
        const key = nm.toLowerCase();
        if (!nm || poolSeen.has(key)) continue;
        poolSeen.add(key);
        pool.push(nm);
      }
      const optionsHTML = (selected) => {
        const selKey = String(selected || "").trim().toLowerCase();
        return `<option value="" ${selKey ? "" : "selected"}>— BYE —</option>` +
          pool.map(n => `<option value="${esc(n)}" ${n.toLowerCase() === selKey ? "selected" : ""}>${esc(n)}</option>`).join("");
      };
      const pairRowHTML = (a, b, ri) => `
        <div class="gpH2HEditRow" data-round="${ri}">
          <select class="gpLeagueSettingsInput gpH2HEditSelect" data-gp-h2h-slot="a">${optionsHTML(a)}</select>
          <span class="gpH2HEditVs">vs</span>
          <select class="gpLeagueSettingsInput gpH2HEditSelect" data-gp-h2h-slot="b">${optionsHTML(b)}</select>
          <button type="button" class="gpH2HRemoveRowBtn" data-gpaction="h2hRemovePairRow" aria-label="Remove matchup">✕</button>
        </div>`;
      // Once the league has a fixed season length (Total Weeks, set
      // above), any round at or past that index is automatically the
      // postseason — derived here purely from that setting (see
      // gpGetH2HPlayoffRoundSpecs) rather than separately tracked, so
      // there's nothing that can drift out of sync with the schedule.
      const tw = Number(league?.totalWeeks) || 0;
      const playoffRoundsSoFar = tw && typeof GP_Data.gpGetH2HPlayoffRoundSpecs === "function"
        ? GP_Data.gpGetH2HPlayoffRoundSpecs(h2hSchedule, tw) : [];
      const roundsHTML = h2hSchedule.map((round, ri) => {
        const pairs = Array.isArray(round?.pairs) ? round.pairs : [];
        const pairRowsHTML = pairs.map((p) => {
          const a = p?.players ? p.players[0] : (p?.bye || "");
          const b = p?.players ? p.players[1] : "";
          return pairRowHTML(a, b, ri);
        }).join("");
        const isPlayoffRound = !!tw && ri >= tw;
        // "Round" reads as ambiguous once there's also a Playoffs section —
        // the regular season is weeks, plain and simple; only the
        // postseason gets "round" language (Semifinals, Championship),
        // under its own divider so it's never confused for "just another
        // week" even if someone doesn't notice the gold styling.
        const roundLabel = isPlayoffRound
          ? esc((typeof GP_Data.gpPlayoffRoundLabel === "function" ? GP_Data.gpPlayoffRoundLabel(pairs.length) : "Playoff Round"))
          : `Week ${ri + 1}${tw ? ` of ${tw}` : ""}`;
        const playoffDividerHTML = (isPlayoffRound && ri === tw) ? `<div class="gpH2HPlayoffDivider">🏆 Playoffs</div>` : "";
        return `${playoffDividerHTML}
      <div class="gpH2HEditRound${isPlayoffRound ? " gpH2HEditRoundPlayoff" : ""}">
        <div class="gpH2HEditRoundHead">
          <div class="gpH2HEditRoundLabel">${roundLabel}</div>
          <button type="button" class="gpH2HRemoveRoundBtn" data-gpaction="h2hRemoveRound">✕ Remove ${isPlayoffRound ? "Round" : "Week"}</button>
        </div>
        ${pairRowsHTML}
        <button type="button" class="gpH2HAddPairBtn" data-gpaction="h2hAddPairRow">+ Add Matchup</button>
      </div>`;
      }).join("");
      // Playoff Teams (set above) only feeds the read-only Playoff Picture
      // preview on its own — this button is what actually turns "top N by
      // current standings" into a real, playable round: it appends one new
      // round pairing just those N players, and leaves everyone else out
      // of it entirely (not even a bye entry), which is what makes the
      // sitting-out players correctly lose the picks UI for that round
      // (see the sittingOut check in gpBuildGroupPicksCardHTML) instead of
      // still being able to pick like before this existed.
      const lastPlayoffRound = playoffRoundsSoFar[playoffRoundsSoFar.length - 1];
      const lastRoundPairs = lastPlayoffRound ? (h2hSchedule[lastPlayoffRound.weekIndex]?.pairs || []) : [];
      const bracketIsChampioned = playoffRoundsSoFar.length > 0 && lastRoundPairs.length === 1 && !lastRoundPairs[0]?.bye;
      const playoffActionBtnHTML = !tw
        ? ""
        : !playoffRoundsSoFar.length
          ? `<button class="smallBtn gpH2HStartSeasonBtn" type="button" data-gpaction="generateH2HPlayoffRound" data-leagueid="${esc(league?.id || "")}">🏆 Generate Playoffs Round</button>`
          : !bracketIsChampioned
            ? `<button class="smallBtn gpH2HStartSeasonBtn" type="button" data-gpaction="advanceH2HPlayoffRound" data-leagueid="${esc(league?.id || "")}">➡️ Advance to Next Round</button>`
            : "";
      const playoffActionNoteHTML = !tw
        ? `Set a "Total Weeks" value above to enable playoffs — once the season reaches that many weeks, any round generated here automatically becomes the postseason, so nothing needs separately marking as "the playoffs."`
        : !playoffRoundsSoFar.length
          ? `"Generate Playoffs Round" seeds a round from current standings (top ${h2hPlayoffTeams}) and places it right after week ${tw} (this league's Total Weeks) — everyone outside that cut sits out, correctly, instead of still being able to pick. Weeks 1–${tw} always stay the regular season, in standings, no matter what happens here.`
          : !bracketIsChampioned
            ? `"Advance to Next Round" needs the current round fully final — it pairs up the winners and appends the next round. Once only one matchup remains and it's final, a champion is crowned automatically. To undo a playoff round, just "✕ Remove Round" it below.`
            : `🏆 This is the championship round — nothing more to generate. Once it's final, a champion is crowned automatically on the Standings and Playoffs tabs. To undo, "✕ Remove Round" it below.`;
      h2hSeasonBodyHTML = `
    <div class="muted" style="font-size:12px">Season started with ${h2hRoster.length} player${h2hRoster.length === 1 ? "" : "s"}. Reassign any matchup below (add/remove matchups or whole rounds freely, or set a side to "— BYE —") and save.</div>
    <div class="gpH2HEditSchedule" id="gpH2HEditSchedule" data-leagueid="${esc(league?.id || "")}" data-totalweeks="${tw}" data-playoffteams="${h2hPlayoffTeams}">
      ${roundsHTML || `<div class="muted" style="font-size:12px">No rounds yet.</div>`}
    </div>
    <button type="button" class="gpH2HAddRoundBtn" data-gpaction="h2hAddRound">+ Add Round</button>
    <div class="gpLeagueSettingsActions">
      <button class="smallBtn gpH2HStartSeasonBtn" type="button" data-gpaction="saveH2HSchedule" data-leagueid="${esc(league?.id || "")}">💾 Save Schedule</button>
      <span id="gpH2HPlayoffActionBtn">${playoffActionBtnHTML}</span>
      <button class="smallBtn gpLeagueSettingsCancelBtn" type="button" data-gpaction="startH2HSeason" data-leagueid="${esc(league?.id || "")}">🔄 Regenerate From Joined Players</button>
    </div>
    <div class="muted" style="font-size:11px"><span id="gpH2HPlayoffActionNote">${playoffActionNoteHTML}</span> "Regenerate From Joined Players" replaces the <b>entire</b> schedule above with a fresh round-robin — any manual edits (including any generated playoff rounds) are lost.</div>`;
    }

    return `
<div class="gpLeagueSettingsForm" data-leagueid="${esc(league?.id || "")}">
  <div class="gpAdminHead">
    <div class="gpAdminHeadTitle">
      <div class="gpAdminHeadIcon">⚙️</div>
      <div>
        <div class="gpAdminHeadLabel">${isEdit ? "Editing League" : "New League"}</div>
        <div class="gpAdminHeadWeek">${isEdit ? "League Settings" : "Create League"}</div>
      </div>
    </div>
  </div>

  <div class="gpAdminBlock">
    <div class="gpAdminBlockLabel">🏷️ League Info</div>
    <div class="gpLeagueSettingsRow">
      <div class="gpLeagueSettingsLabel">League Name</div>
      <input type="text" id="gpLeagueName" class="gpLeagueSettingsInput" value="${name}" placeholder="e.g. Work League" maxlength="40"/>
    </div>
    ${membersSectionHTML}
  </div>

  <div class="gpAdminBlock">
    <div class="gpAdminBlockLabel">🗓️ Schedule</div>
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
  </div>

  <div class="gpAdminBlock" id="gpLeagueH2HRosterRow" ${isH2H ? "" : 'style="display:none"'}>
    <div class="gpAdminBlockLabel">🥊 Head-to-Head Season</div>
    <div class="gpLeagueSettingsRow">
      <div class="gpLeagueSettingsLabel">Playoff Teams</div>
      <select id="gpLeagueH2HPlayoffTeams" class="gpLeagueSettingsInput">
        ${[2, 4, 6, 8].map(n => `<option value="${n}" ${n === h2hPlayoffTeams ? "selected" : ""}>${n}</option>`).join("")}
      </select>
    </div>
    ${h2hSeasonBodyHTML}
  </div>

  <div class="gpAdminBlock">
    <div class="gpAdminBlockLabel">📣 League Announcements<span class="gpAdminBlockHint">up to 3</span></div>
    <div class="muted" style="font-size:12px">Shown stacked at the top of the week view for everyone in this league. Leave a slot's fields blank to remove it. Any slot with a title or message needs an expiration date — it disappears automatically after that day.</div>
    ${announcementSlotsHTML}
  </div>

  ${isEdit ? `
  <div class="gpAdminBlock">
    <label class="gpLeagueSettingsCheckRow">
      <input type="checkbox" id="gpLeagueArchived" ${archived ? "checked" : ""}/>
      <span class="muted" style="font-weight:800">Archived (hidden from players)</span>
    </label>
  </div>` : ""}

  <div class="gpLeagueSettingsActions">
    <button class="smallBtn gpLeagueSettingsSaveBtn" type="button" data-gpaction="submitLeagueSettings" data-leagueid="${esc(league?.id || "")}">${isEdit ? "Save Settings" : "Create League"}</button>
    <button class="smallBtn gpLeagueSettingsCancelBtn" type="button" data-gpaction="cancelLeagueSettings">Cancel</button>
  </div>

  ${isEdit ? `
  <div class="gpAdminBlock gpDangerZone">
    <div class="gpAdminBlockLabel">⚠️ Danger Zone</div>
    <div class="muted" style="font-size:12px">Permanently deletes this league — every week, game, and pick in it. Archiving above is reversible; this isn't.</div>
    <button class="smallBtn gpLeagueDeleteBtn" type="button" data-gpaction="deleteLeague" data-leagueid="${esc(league?.id || "")}" data-leaguename="${esc(String(league?.name || "this league"))}">🗑️ Delete League Permanently</button>
  </div>` : ""}
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
    gpBuildH2HMatchupDetailHTML,
    gpShowH2HMatchupOverlay,
    gpDismissH2HMatchupOverlay,
    gpBuildViewToggleHTML,
    gpBuildTiebreakerCardHTML,
    gpBuildLockReminderHTML,
    gpBuildLeagueAnnouncementHTML,
    gpBuildLeagueAnnouncementsHTML,
    gpBuildNotifOptInHTML,
    gpApplyAdminSelection,
    gpShowPlayerPicksOverlay,
    gpBuildJoinLeagueOverlayHTML,
    gpShowJoinLeagueOverlay,
    gpDismissJoinLeagueOverlay,
    gpShowPlayerManageOverlay,
    gpDismissPlayerManageOverlay,
    gpShowHeaderMenuOverlay,
    gpDismissHeaderMenuOverlay,
    gpShowAdminToolsOverlay,
    gpDismissAdminToolsOverlay,
    gpSetAdminToolsOverlayBody,
    gpEarliestKickoffMs,
    gpBuildH2HTabBarHTML,
    gpBuildH2HMatchupTabHTML,
    gpBuildH2HHighScoreCalloutHTML,
    gpBuildH2HScheduleTabHTML,
    gpBuildH2HPlayoffsTabHTML,
    gpBuildH2HProfileOverlayHTML,
    gpShowH2HProfileOverlay,
    gpBuildH2HPreSeasonHTML,
  };

})();
