/* split/gp-render.js
   =========================
   GROUP PICKS — Rendering / HTML Builders
   All HTML string builders: game cards, team row buttons,
   admin builder UI, leaderboard, and header.
   Exposes all functions on window.GP_Render namespace.
*/

(function () {
  "use strict";

  function esc(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function getRole() {
    if (typeof window.getRole === "function") return window.getRole();
    try { const r = localStorage.getItem("theShopRole_v1") || ""; return (r === "admin" || r === "guest") ? r : "guest"; } catch { return "guest"; }
  }

  // --------------- formatting helpers ---------------
  function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function rankPrefix(rankVal) { const r = toNum(rankVal); if (!r) return ""; if (r >= 1 && r <= 25) return `#${r} `; return ""; }
  function safeTeamLabel(t) { const nm = String(t?.name || "").trim(); const rk = rankPrefix(t?.rank); return (rk + nm).trim() || "Team"; }
  function safeRecord(t)     { return String(t?.record || "").trim(); }
  function safeLogo(t)       { return String(t?.logo || "").trim(); }

  function fmtKickoffFromMs(ms) {
    if (!ms) return "\u2014";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "\u2014";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function gpPrettyDateFromStartMs(ms) {
    if (!ms) return "";
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    const weekday  = d.toLocaleDateString([], { weekday: "long" });
    const monthDay = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${weekday} ${monthDay}`;
  }
  function fmtOddsLine(g) {
    const storedDetails = String(g?.oddsDetails || "").trim();
    const storedOU      = String(g?.oddsOU || "").trim();
    const hyd           = g?.__odds || null;
    const details       = storedDetails || String(hyd?.details || "").trim();
    const ou            = storedOU      || String(hyd?.overUnder || "").trim();
    const parts = [];
    if (details) parts.push(`Favored: ${details}`);
    if (ou)      parts.push(`O/U: ${ou}`);
    return parts.join(" \u2022 ");
  }

  // --------------- leaderboard logic ---------------
  function gpIsFinalGame(g) {
    return !!g?.__live && String(g.__live.state || "").toLowerCase() === "post";
  }
  function gpWinnerSideFromLive(g) {
    const live = g?.__live || null;
    if (!live) return "";
    const a = Number(live.awayScore), h = Number(live.homeScore);
    if (!Number.isFinite(a) || !Number.isFinite(h)) return "";
    if (a === h) return "";
    return (a > h) ? "away" : "home";
  }
  function gpFavoredSideFromGame(g) {
    try {
      const away = g?.awayTeam || {}, home = g?.homeTeam || {};
      const hydFav    = String(g?.__odds?.favoredTeam || "").trim();
      const storedFav = String(g?.oddsFavored || "").trim();
      const fav       = (storedFav || hydFav || "").trim();
      const homeAbbr  = String(home?.abbr || "").trim();
      const awayAbbr  = String(away?.abbr || "").trim();
      if (fav && homeAbbr && fav.toLowerCase() === homeAbbr.toLowerCase()) return "home";
      if (fav && awayAbbr && fav.toLowerCase() === awayAbbr.toLowerCase()) return "away";
      return "";
    } catch { return ""; }
  }

  function gpComputeWeeklyLeaderboard(games, allPicks) {
    const list         = Array.isArray(games) ? games : [];
    const picksByEvent = allPicks && typeof allPicks === "object" ? allPicks : {};
    let finalsCount    = 0;
    const users        = new Map();

    for (const g of list) {
      const eventId = String(g?.eventId || g?.id || "").trim();
      if (!eventId || !gpIsFinalGame(g)) continue;
      finalsCount++;
      const winner = gpWinnerSideFromLive(g);
      if (!winner) continue;
      const favoredSide = gpFavoredSideFromGame(g);
      const isUpset     = !!favoredSide && winner !== favoredSide;
      const arr = Array.isArray(picksByEvent[eventId]) ? picksByEvent[eventId] : [];
      for (const p of arr) {
        const uid  = String(p?.uid || "").trim();
        const name = String(p?.name || "Someone").trim();
        const side = String(p?.side || "").trim();
        if (!uid) continue;
        if (!users.has(uid)) users.set(uid, { uid, name, picks: 0, wins: 0, losses: 0, points: 0 });
        const u = users.get(uid);
        if (name) u.name = name;
        if (side === "home" || side === "away") {
          u.picks += 1;
          if (side === winner) { u.wins += 1; u.points += (isUpset ? 2 : 1); }
          else u.losses += 1;
        }
      }
    }
    const rows = Array.from(users.values());
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins   !== a.wins)   return b.wins   - a.wins;
      if (b.picks  !== a.picks)  return b.picks  - a.picks;
      return String(a.name).localeCompare(String(b.name));
    });
    return { rows, finalsCount };
  }

  function gpBuildLeaderboardHTML({ weekLabel, finalsCount, rows }) {
    const list = Array.isArray(rows) ? rows : [];
    const pointsRulesHTML = `
      <div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08);">
        <div class="muted" style="font-weight:950;">How Points Are Awarded:</div>
        <div class="muted" style="margin-top:6px; font-weight:850;">2pts \u2022 Picking the Underdog Winner</div>
        <div class="muted" style="margin-top:4px; font-weight:850;">1pt \u2022 Picking the Favored Winner</div>
      </div>
    `;

    if (!finalsCount) {
      return `
        <div class="gpLeaderCard" style="margin-top:12px; padding:14px; border-radius:22px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="font-weight:950;">Leaderboard</div>
            <div class="muted" style="font-weight:900;">${esc(String(weekLabel || ""))}</div>
          </div>
          <div class="muted" style="margin-top:8px; font-weight:800;">No finals yet \u2014 leaderboard will appear once games go final.</div>
          ${pointsRulesHTML}
        </div>`;
    }

    function medalForRank(rank) {
      if (rank === 1) return "\uD83E\uDD47";
      if (rank === 2) return "\uD83E\uDD48";
      if (rank === 3) return "\uD83E\uDD49";
      return "";
    }
    function rowHTML(u, rank) {
      const top3  = rank <= 3;
      const medal = medalForRank(rank);
      return `
        <div style="display:flex; align-items:stretch; gap:12px; padding:12px; border-radius:18px;
          background:${top3 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)"};
          border:1px solid ${top3 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)"};">
          <div style="flex:0 0 auto; min-width:54px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
            ${top3
              ? `<div style="font-weight:1000; font-size:36px; line-height:1;">${esc(medal)}</div>`
              : `<div style="font-weight:1000; font-size:22px; line-height:1; letter-spacing:0.2px; color:rgba(255,255,255,0.92);">${esc(String(rank))}</div>`
            }
          </div>
          <div style="flex:1; min-width:0; display:flex; flex-direction:column; justify-content:center;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div style="min-width:0;">
                <div style="font-weight:${top3 ? "1000" : "950"}; font-size:${top3 ? "22px" : "20px"}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(String(u?.name || "Someone"))}</div>
                <div class="muted" style="margin-top:4px; font-weight:800; font-size:14px; opacity:0.85;">Picks: ${esc(String(u?.picks ?? 0))} \u2022 W: ${esc(String(u?.wins ?? 0))} \u2022 L: ${esc(String(u?.losses ?? 0))}</div>
              </div>
              <div class="statusPill" style="background:rgba(0,200,120,0.18); border:1px solid rgba(0,200,120,0.35); color:rgba(180,255,220,0.95); white-space:nowrap; display:flex; align-items:baseline; gap:2px; padding:10px 14px;">
                <span style="font-weight:1000; font-size:22px; line-height:1;">${esc(String(u?.points ?? 0))}</span>
                <span style="font-weight:900; font-size:12px; opacity:0.85;">pts</span>
              </div>
            </div>
          </div>
        </div>`;
    }

    const body = list.length
      ? list.map((u, idx) => rowHTML(u, idx + 1)).join("")
      : `<div class="muted" style="margin-top:10px; font-weight:800;">No picks yet.</div>`;

    return `
      <div class="gpLeaderCard" style="margin-top:12px; padding:14px; border-radius:22px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div style="font-weight:950;">Leaderboard</div>
          <div class="muted" style="font-weight:900;">${esc(String(weekLabel || ""))}</div>
        </div>
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">${body}</div>
        ${pointsRulesHTML}
      </div>`;
  }

  function gpApplyLeaderboardFromAllPicks({ weekId, weekLabel, games, allPicks }) {
    const host = document.getElementById("gpLeaderboard");
    if (!host) return;
    const lb = gpComputeWeeklyLeaderboard(games, allPicks || {});
    host.innerHTML = gpBuildLeaderboardHTML({
      weekLabel: weekLabel || weekId,
      finalsCount: lb.finalsCount,
      rows: lb.rows
    });
  }

  // --------------- team row button ---------------
  function teamRowBtn({ side, t, logoUrl, extraSub, isActive, isFaded, lockedGame, eventId, scoreText, weekId }) {
    return `
      <button
        class="gpPickRowBtn ${isActive ? "gpPickRowActive" : ""} ${isFaded ? "gpFaded" : ""}"
        type="button"
        ${lockedGame ? "disabled" : ""}
        data-gppick="${esc(side)}"
        data-slate="${esc(weekId)}"
        data-eid="${esc(eventId)}"
        style="width:100%; display:flex; align-items:center; gap:12px; padding:12px; border-radius:16px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10); text-align:left;"
      >
        <div style="width:44px; height:44px; border-radius:12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; overflow:hidden; flex:0 0 44px;">
          ${logoUrl ? `<img src="${esc(logoUrl)}" alt="" style="width:34px;height:34px;object-fit:contain;" onerror="this.style.display='none'">` : ""}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:900; font-size:18px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(safeTeamLabel(t))}</div>
          <div class="muted" style="margin-top:4px;">${esc(extraSub || "")}${extraSub && safeRecord(t) ? " \u2022 " : ""}${esc(safeRecord(t))}</div>
        </div>
        ${scoreText !== "" ? `<div style="flex:0 0 auto; min-width:44px; text-align:right; font-weight:950; font-size:34px; line-height:1; letter-spacing:0.2px; color:rgba(255,255,255,0.92);">${esc(scoreText)}</div>` : ""}
      </button>`;
  }

  // --------------- main game cards builder ---------------
  function gpBuildGroupPicksCardHTML({ weekId, weekLabel, games, myMap, published, allPicks, isAdmin }) {
    if (!weekId) {
      return `<div class="game"><div class="gameHeader"><div class="statusPill status-other">GROUP PICKS</div></div><div class="gameMetaTopLine">No active week yet</div><div class="gameMetaOddsLine">Waiting on admin to create Week 1.</div></div>`;
    }
    if (!published && !isAdmin) {
      return `<div class="game"><div class="gameHeader"><div class="statusPill status-other">GROUP PICKS</div></div><div class="gameMetaTopLine" style="margin-top:8px; font-weight:900;">${esc(weekLabel || weekId)} not published yet</div><div class="muted" style="margin-top:8px; font-weight:800;">Waiting on admin.</div></div>`;
    }

    const isDraft = (!published && !!isAdmin);
    const now = Date.now();

    const cachedAll = (window.__GP_ALLPICKS_CACHE?.[weekId]?.data) || null;
    const effectiveAllPicks =
      (allPicks && typeof allPicks === "object" && Object.keys(allPicks).length)
        ? allPicks
        : (cachedAll && typeof cachedAll === "object" ? cachedAll : {});
    const hasAllPicks = !!Object.keys(effectiveAllPicks).length;

    let leaderboardHTML = "";
    if (!isDraft) {
      if (!hasAllPicks) {
        leaderboardHTML = `
          <div id="gpLeaderboard">
            <div class="gpLeaderCard" style="margin-top:12px; padding:14px; border-radius:22px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                <div style="font-weight:950;">Leaderboard</div>
                <div class="muted" style="font-weight:900;">${esc(String(weekLabel || weekId || ""))}</div>
              </div>
              <div class="muted" style="margin-top:8px; font-weight:800;">Loading leaderboard\u2026</div>
            </div>
          </div>`;
      } else {
        const lb = gpComputeWeeklyLeaderboard(games, effectiveAllPicks);
        leaderboardHTML = `<div id="gpLeaderboard">${gpBuildLeaderboardHTML({ weekLabel: weekLabel || weekId, finalsCount: lb.finalsCount, rows: lb.rows })}</div>`;
      }
    }

    const gameCards = (games || []).map(g => {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";

      const away = g?.awayTeam || { name: g?.awayName || "Away", rank: g?.awayRank, record: g?.awayRecord, logo: g?.awayLogo };
      const home = g?.homeTeam || { name: g?.homeName || "Home", rank: g?.homeRank, record: g?.homeRecord, logo: g?.homeLogo };

      const startMs         = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
      const kickoffLabel    = fmtKickoffFromMs(startMs);
      const kickoffDateLabel = gpPrettyDateFromStartMs(startMs);
      const lockedGame      = startMs ? now >= startMs : false;

      const live    = g.__live || null;
      const state   = String(live?.state || "").toLowerCase();
      const isLive  = state === "in";
      const isFinal = state === "post";

      const awayScore = (live && live.awayScore != null) ? String(live.awayScore) : "";
      const homeScore = (live && live.homeScore != null) ? String(live.homeScore) : "";

      let pillHTML = "";
      if (isLive || isFinal) {
        const pillText = isLive ? `LIVE \u2022 ${String(live?.detail || "").trim()}` : "FINAL";
        pillHTML = `
          <div class="statusPill" style="display:inline-flex; align-items:center; gap:8px; padding:10px 14px; border-radius:999px; width:100%; max-width:100%; box-sizing:border-box;
            background:${isLive ? "rgba(0,200,120,0.18)" : "rgba(255,255,255,0.08)"};
            border:1px solid ${isLive ? "rgba(0,200,120,0.35)" : "rgba(255,255,255,0.18)"};
            color:${isLive ? "rgba(180,255,220,0.95)" : "rgba(255,255,255,0.80)"};
          ">
            ${isLive ? `<span style="width:8px;height:8px;border-radius:50%;background:rgba(0,220,120,0.9);display:inline-block;flex-shrink:0;"></span>` : ""}
            <span style="font-weight:950; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(pillText)}</span>
          </div>`;
      }

      const myPickRaw  = String(myMap?.[eventId]?.side || "");
      const pendingPick = (typeof window.gpPendingGet === "function") ? window.gpPendingGet(eventId) : "";
      const myPick     = pendingPick || myPickRaw;

      const awayActive = !lockedGame && myPick === "away";
      const homeActive = !lockedGame && myPick === "home";
      const awayFaded  = !lockedGame && !!myPick && myPick !== "away";
      const homeFaded  = !lockedGame && !!myPick && myPick !== "home";

      const savedAwayActive = lockedGame && myPickRaw === "away";
      const savedHomeActive = lockedGame && myPickRaw === "home";

      const oddsLine = fmtOddsLine(g);

      const everyonePicksArr = Array.isArray(effectiveAllPicks?.[eventId]) ? effectiveAllPicks[eventId] : [];
      const everyoneCount    = everyonePicksArr.length;

      const everyoneSection = `
        <details
          data-gpeveryone="1"
          data-weekid="${esc(weekId)}"
          data-eid="${esc(eventId)}"
          data-away="${esc(String(away?.name || "Away"))}"
          data-home="${esc(String(home?.name || "Home"))}"
          style="margin-top:10px;"
        >
          <summary style="cursor:pointer; font-weight:900; font-size:14px; color:rgba(255,255,255,0.7); list-style:none; display:flex; align-items:center; gap:6px;">
            &#x25B6; Everyone's Picks ${everyoneCount ? `(${everyoneCount})` : ""}
          </summary>
          <div id="gpEveryone_${esc(weekId)}_${esc(eventId)}" style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">
            <div class="muted">Click to load\u2026</div>
          </div>
        </details>`;

      const saveBtnHTML = (!lockedGame && !isDraft) ? `
        <div style="margin-top:10px;">
          <button
            class="smallBtn"
            type="button"
            data-gpaction="savePicks"
            data-slate="${esc(weekId)}"
            disabled
          >Save</button>
        </div>` : "";

      const lockBadge = lockedGame ? `
        <div class="muted" style="margin-top:8px; font-size:13px; font-weight:800;">\uD83D\uDD12 Locked \u2014 game started</div>` : "";

      return `
        <div class="game" style="margin-top:12px;">
          <div class="gameHeader">
            <div class="gameMetaTopLine" style="font-weight:950; font-size:15px;">
              ${esc(kickoffDateLabel)}${kickoffDateLabel && kickoffLabel ? " \u2022 " : ""}${esc(kickoffLabel)}
            </div>
          </div>

          ${pillHTML ? `<div style="margin-top:8px;">${pillHTML}</div>` : ""}

          <div style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
            ${teamRowBtn({ side:"away", t:away, logoUrl:safeLogo(away), extraSub:"",
              isActive: awayActive || savedAwayActive,
              isFaded:  awayFaded,
              lockedGame, eventId, scoreText: awayScore, weekId })}
            ${teamRowBtn({ side:"home", t:home, logoUrl:safeLogo(home), extraSub:"HOME",
              isActive: homeActive || savedHomeActive,
              isFaded:  homeFaded,
              lockedGame, eventId, scoreText: homeScore, weekId })}
          </div>

          ${oddsLine ? `<div class="gameMetaOddsLine" style="margin-top:8px; font-weight:850; font-size:13px;">${esc(oddsLine)}</div>` : ""}
          ${saveBtnHTML}
          ${lockBadge}
          ${everyoneSection}
        </div>`;
    }).join("");

    return `
      <div>
        ${isDraft ? `<div class="statusPill status-other" style="margin-bottom:10px;">DRAFT \u2014 Not Published</div>` : ""}
        ${gameCards || `<div class="muted" style="margin-top:12px; font-weight:800;">No games added to this week yet.</div>`}
        ${leaderboardHTML}
      </div>`;
  }

  // --------------- admin builder UI ---------------
  function gpBuildAdminBuilderHTML({ weekId, weekLabel, availableEvents, leagueKey, dateLabel, isAdmin }) {
    if (!isAdmin) return "";

    const leagueSelectHTML   = (window.GP_ESPN?.buildLeagueSelectHTMLSafe   || (() => ""))(leagueKey);
    const calendarButtonHTML = (window.GP_ESPN?.buildCalendarButtonHTMLSafe || (() => ""))();

    const eventRows = (availableEvents || []).map(ev => {
      const eid     = String(ev?.id || "");
      const comp    = ev?.competitions?.[0] || {};
      const comps   = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const homeC   = comps.find(c => c?.homeAway === "home") || {};
      const awayC   = comps.find(c => c?.homeAway === "away") || {};
      const homeName = String(homeC?.team?.displayName || homeC?.team?.name || "Home");
      const awayName = String(awayC?.team?.displayName || awayC?.team?.name || "Away");
      const iso     = ev?.date || comp?.date || "";
      const ms      = Date.parse(iso);
      const timeStr = (ms && Number.isFinite(ms)) ? new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
      return `
        <label style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
          <input type="checkbox" data-gpgamesel="1" value="${esc(eid)}" style="flex:0 0 auto; width:18px; height:18px;" />
          <span style="flex:1; min-width:0;">
            <span style="font-weight:900; font-size:15px;">${esc(awayName)} @ ${esc(homeName)}</span>
            ${timeStr ? `<span class="muted" style="margin-left:8px; font-size:13px; font-weight:800;">${esc(timeStr)}</span>` : ""}
          </span>
        </label>`;
    }).join("");

    return `
      <div class="game" style="margin-top:12px; padding:14px; border-radius:22px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);">
        <div class="gameHeader">
          <div class="statusPill status-other">ADMIN \u2014 Build Week</div>
        </div>

        <div style="margin-top:12px; display:flex; flex-wrap:wrap; align-items:center; gap:10px;">
          ${leagueSelectHTML}
          ${calendarButtonHTML}
          <button class="smallBtn" type="button" data-gpaction="adminLoadGames">Load Games</button>
        </div>

        <div id="gpAdminGameList" style="margin-top:12px;">
          ${availableEvents?.length
            ? `<div style="max-height:320px; overflow-y:auto; display:flex; flex-direction:column;">${eventRows}</div>`
            : `<div class="muted" style="font-weight:800;">Choose a league &amp; date, then hit Load Games.</div>`
          }
        </div>

        ${availableEvents?.length ? `
          <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="smallBtn" type="button" data-gpaction="adminAddGames" data-weekid="${esc(weekId)}">Add Selected to ${esc(weekLabel || weekId)}</button>
          </div>` : ""}

        <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          <button class="smallBtn" type="button" data-gpaction="adminCreateWeek">+ New Week</button>
          <button class="smallBtn" type="button" data-gpaction="adminPublish" data-weekid="${esc(weekId)}">Publish ${esc(weekLabel || weekId)}</button>
        </div>
      </div>`;
  }

  // --------------- picks header ---------------
  function renderPicksHeaderHTML({ weekSelectHTML, weekId, weekLabel, isAdmin }) {
    const adminBadge = isAdmin ? `<div class="statusPill status-other" style="flex:0 0 auto;">ADMIN</div>` : "";
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:4px;">
        <div style="font-weight:950; font-size:20px;">Group Picks</div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          ${adminBadge}
          ${weekSelectHTML || ""}
        </div>
      </div>`;
  }

  // --------------- expose on window ---------------
  window.GP_Render = {
    gpBuildGroupPicksCardHTML,
    gpBuildAdminBuilderHTML,
    gpBuildLeaderboardHTML,
    gpComputeWeeklyLeaderboard,
    gpApplyLeaderboardFromAllPicks,
    renderPicksHeaderHTML,
    teamRowBtn,
    fmtOddsLine,
    fmtKickoffFromMs,
    gpPrettyDateFromStartMs
  };

})();
