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
   LEADERBOARD
   ══════════════════════════════════════════════ */
.gpLeaderCard {
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px; padding: 14px;
  display: flex; flex-direction: column; gap: 10px;
}
.gpLeaderTitle { font-size: 16px; font-weight: 950; color: #fff; }
.gpLeaderRow {
  display: flex; align-items: stretch; gap: 12px;
  padding: 12px; border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
}
.gpLeaderRow.top3 {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.14);
}
.gpLeaderRank {
  flex: 0 0 auto; min-width: 54px;
  display: flex; flex-direction: column;
  justify-content: center; align-items: center; text-align: center;
}
.gpLeaderMedal { font-size: 36px; line-height: 1; }
.gpLeaderRankNum {
  font-weight: 1000; font-size: 22px;
  line-height: 1; letter-spacing: 0.2px; color: rgba(255,255,255,0.92);
}
.gpLeaderInfo { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
.gpLeaderName {
  font-size: 20px; font-weight: 1000;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gpLeaderName.top3 { font-size: 22px; }
.gpLeaderRecord { font-size: 14px; font-weight: 800; color: rgba(255,255,255,0.5); margin-top: 4px; }
.gpLeaderPoints {
  display: flex; align-items: baseline; gap: 2px;
  background: rgba(0,200,120,0.18); border: 1px solid rgba(0,200,120,0.35);
  color: rgba(180,255,220,0.95); border-radius: 999px;
  padding: 10px 14px; white-space: nowrap; flex-shrink: 0;
}
.gpLeaderPts    { font-size: 22px; font-weight: 1000; line-height: 1; }
.gpLeaderPtsLbl { font-size: 12px; font-weight: 900; opacity: 0.85; }

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

  /**
   * Reads odds from g.__odds (set by gpHydrateOddsForGames in gp-espn.js)
   * Falls back to legacy g.odds / g.oddsDetails fields for backwards compat.
   */
  function safeOddsLine(g) {
    // Primary: __odds written by gp-espn.js hydration
    const hydratedDetails  = String(g?.__odds?.details  || "").trim();
    const hydratedOverUnder = String(g?.__odds?.overUnder || "").trim();
    // Legacy fallback
    const legacyDetails  = String(g?.oddsDetails || g?.odds?.details || "").trim();
    const legacyOverUnder = String(g?.odds?.overUnder || "").trim();

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
  /**
   * Reads live state from g.__live (set by gpHydrateLiveStateForGames in gp-espn.js).
   * Falls back to g.live for backwards compatibility.
   */
  function buildStatusHTML(g) {
    // Primary: __live written by gp-espn.js hydration
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

    // ── Score data ──
    // gp-espn.js stores hydration results on g.__live
    // Fall back to g.live for any legacy data
    const live     = g?.__live || g?.live || null;
    const state    = String(live?.state || "").toLowerCase();
    const isLive   = state === "in";
    const isFinal  = state === "post";

    // Scores are present when the game is in-progress or final
    // awayScore / homeScore come as strings from the ESPN competitors array
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

    // Card classes
    let cardCls = "gpScoreCard";
    if (isLive)  cardCls += " gpCardLive";
    if (hasPick) cardCls += " gpPickedCard";

    // League color for left border
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

  // ─── Leaderboard ─────────────────────────────────────────────────
  function buildLeaderboardHTML(weekLabel, leaderboard) {
    const { rows, finalsCount } = leaderboard || {};
    const list = Array.isArray(rows) ? rows : [];
    const label = String(weekLabel || "");

    if (!finalsCount) {
      return `
<div class="gpLeaderCard">
  <div class="gpLeaderTitle">Leaderboard <span style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.4)">${esc(label)}</span></div>
  <div class="muted" style="font-size:13px;font-weight:700">No finals yet — leaderboard appears once games go final.</div>
  <div style="margin-top:8px;font-size:12px;font-weight:800;color:rgba(255,255,255,0.35)">2pts = Underdog pick · 1pt = Favored pick</div>
</div>`;
    }

    function medal(rank) {
      if (rank === 1) return "🥇";
      if (rank === 2) return "🥈";
      if (rank === 3) return "🥉";
      return null;
    }

    const rowsHTML = list.length ? list.map((u, i) => {
      const rank = i + 1;
      const top3 = rank <= 3;
      const med  = medal(rank);
      return `
<div class="gpLeaderRow${top3 ? " top3" : ""}">
  <div class="gpLeaderRank">
    ${med ? `<div class="gpLeaderMedal">${med}</div>` : `<div class="gpLeaderRankNum">${esc(String(rank))}</div>`}
  </div>
  <div class="gpLeaderInfo">
    <div class="gpLeaderName${top3 ? " top3" : ""}">${esc(String(u?.name || "Someone"))}</div>
    <div class="gpLeaderRecord">Picks ${u?.picks ?? 0} · W ${u?.wins ?? 0} · L ${u?.losses ?? 0}</div>
  </div>
  <div class="gpLeaderPoints">
    <span class="gpLeaderPts">${esc(String(u?.points ?? 0))}</span>
    <span class="gpLeaderPtsLbl">pts</span>
  </div>
</div>`;
    }).join("") : `<div class="muted" style="font-size:13px;font-weight:700">No picks yet.</div>`;

    return `
<div class="gpLeaderCard">
  <div class="gpLeaderTitle">Leaderboard <span style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.4)">${esc(label)}</span></div>
  ${rowsHTML}
  <div style="margin-top:4px;font-size:12px;font-weight:800;color:rgba(255,255,255,0.35)">2pts = Underdog pick · 1pt = Favored pick</div>
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

  // ─── Expose public API ──────────────────────────────────────────
  window.GP_Render = {
    renderPicksHeaderHTML,
    gpBuildGroupPicksCardHTML,
    gpBuildAdminBuilderHTML,
    buildLeaderboardHTML,
    gpApplyAdminSelection,
  };

})();
