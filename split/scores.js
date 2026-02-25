// split/scores.js
// Scores tab only. Self-contained + resilient.

(function () {
  "use strict";

  // ------------------------------------------------------------
  // Safe helpers
  // ------------------------------------------------------------
  const escapeHtml =
    (typeof window.escapeHtml === "function")
      ? window.escapeHtml
      : (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c]));

  const norm = (s) => String(s || "").trim().toLowerCase();

  function safeGet(key, fallback = "") {
    try { return String(localStorage.getItem(key) ?? fallback); }
    catch { return String(fallback); }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }

  // ------------------------------------------------------------
  // Preferences (league/date)
  // ------------------------------------------------------------
  const LEAGUE_KEY = "theShopLeagueKey_v1";
  const DATE_KEY = "theShopDateYYYYMMDD_v1";

  const FAVORITES = [
    "ohio state",
    "buckeyes",
    "duke",
    "blue devils",
    "west virginia",
    "mountaineers",
    "columbus blue jackets",
    "blue jackets",
    "carolina hurricanes",
    "hurricanes",
    "carolina panthers",
    "panthers",
    "dallas cowboys",
    "cowboys",
    "boston red sox",
    "red sox",
    "cleveland guardians",
    "guardians"
  ].map(norm);

  function yyyymmddTodayLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
  }

  function yyyymmddToPretty(v) {
    const s = String(v || "");
    if (s.length !== 8) return s || "—";
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    return `${m}/${d}/${y}`;
  }

  function getSavedLeagueKey() {
    const v = norm(safeGet(LEAGUE_KEY, "ncaaf"));
    return v || "ncaaf";
  }

  function setSavedLeagueKey(v) {
    safeSet(LEAGUE_KEY, String(v || "ncaaf"));
  }

  function getSavedDateYYYYMMDD() {
    const v = safeGet(DATE_KEY, "");
    if (String(v).trim().length === 8) return String(v).trim();
    const t = yyyymmddTodayLocal();
    safeSet(DATE_KEY, t);
    return t;
  }

  function setSavedDateYYYYMMDD(v) {
    const s = String(v || "").replace(/\D/g, "");
    if (s.length === 8) safeSet(DATE_KEY, s);
  }

  // ------------------------------------------------------------
  // League definitions + ESPN endpoints
  // ------------------------------------------------------------
  const LEAGUES = [
    { key: "ncaaf", label: "CFB", sport: "football", league: "college-football" },
    { key: "ncaab", label: "CBB", sport: "basketball", league: "mens-college-basketball" },
    { key: "nfl",   label: "NFL", sport: "football", league: "nfl" },
    { key: "nba",   label: "NBA", sport: "basketball", league: "nba" },
    { key: "nhl",   label: "NHL", sport: "hockey", league: "nhl" },
    { key: "mlb",   label: "MLB", sport: "baseball", league: "mlb" },
  ];

  function leagueByKey(k) {
    return LEAGUES.find(x => x.key === norm(k)) || LEAGUES[0];
  }

  function buildLeagueSelectHTML(selectedKey) {
    const opts = LEAGUES.map(l =>
      `<option value="${escapeHtml(l.key)}"${l.key === selectedKey ? " selected" : ""}>${escapeHtml(l.label)}</option>`
    ).join("");
    return `<select id="leagueSelect" class="leagueSelect" aria-label="League">${opts}</select>`;
  }

  function buildCalendarButtonHTML() {
    // You asked for a calendar emoji button
    return `<button class="iconBtn" id="dateBtn" title="Change date">📅</button>`;
  }

  // ------------------------------------------------------------
  // Scoreboard fetch
  // ------------------------------------------------------------
  function yyyymmddToESPNDate(v) {
    // ESPN uses YYYYMMDD
    return String(v || "").replace(/\D/g, "");
  }

  async function fetchJson(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  }

  async function fetchScoreboard(leagueKey, dateYYYYMMDD) {
    const L = leagueByKey(leagueKey);
    const dates = yyyymmddToESPNDate(dateYYYYMMDD);
    const url = `https://site.api.espn.com/apis/site/v2/sports/${L.sport}/${L.league}/scoreboard?dates=${dates}`;
    return await fetchJson(url);
  }

  // ------------------------------------------------------------
  // Rendering helpers
  // ------------------------------------------------------------
  function statusFromEvent(ev) {
    const st = ev?.status?.type?.state || "";
    const detail = ev?.status?.type?.shortDetail || ev?.status?.type?.detail || "";
    if (st === "pre")  return { pill: "PRE",  cls: "status-pre",  detail };
    if (st === "in")   return { pill: "LIVE", cls: "status-live", detail };
    if (st === "post") return { pill: "FINAL",cls: "status-final",detail };
    return { pill: "—", cls: "status-other", detail: detail || "—" };
  }

  function competitorBySide(comp, side /* home|away */) {
    const arr = Array.isArray(comp?.competitors) ? comp.competitors : [];
    return arr.find(c => c.homeAway === side) || null;
  }

  function teamName(team) {
    return team?.displayName || team?.name || team?.shortDisplayName || team?.abbreviation || "—";
  }

  function teamLogo(team) {
    // ESPN commonly uses team.logo
    return team?.logo || "";
  }

  function teamRecord(competitor) {
    const recs = competitor?.records;
    if (!Array.isArray(recs)) return "";
    // Prefer "overall" or first record summary
    const overall = recs.find(r => norm(r?.type) === "overall");
    const summary = overall?.summary || recs[0]?.summary || "";
    return summary ? `(${summary})` : "";
  }

  function favoredByFavorites(text) {
    const t = norm(text);
    return FAVORITES.some(f => t.includes(f));
  }

  function eventPriority(ev) {
    const comp = ev?.competitions?.[0];
    const home = competitorBySide(comp, "home");
    const away = competitorBySide(comp, "away");
    const hn = norm(teamName(home?.team));
    const an = norm(teamName(away?.team));

    const favHit = favoredByFavorites(hn) || favoredByFavorites(an);
    if (favHit) return 1000;

    // LIVE games next
    const st = ev?.status?.type?.state || "";
    if (st === "in") return 500;

    return 0;
  }

  function renderHeader(rightText) {
    const selectedKey = getSavedLeagueKey();
    const selectedDate = getSavedDateYYYYMMDD();

    return `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Scores</h2>
            <span class="badge">The Shop</span>
          </div>
          <div class="headerActions">
            <button class="smallBtn" id="scoresRefreshBtn">Refresh</button>
            <button class="smallBtn logoutBtn" onclick="logout()">Log Out</button>
          </div>
        </div>
        <div class="subline">
          <div class="sublineLeft">
            ${buildLeagueSelectHTML(selectedKey)}
            ${buildCalendarButtonHTML()}
          </div>
          <div>${escapeHtml(yyyymmddToPretty(selectedDate))}${rightText ? " • " + escapeHtml(rightText) : ""}</div>
        </div>
      </div>
    `;
  }

  function renderScoreCards(events, selectedKey) {
    const out = [];

    (events || []).forEach(ev => {
      const comp = ev?.competitions?.[0];
      if (!comp) return;

      const home = competitorBySide(comp, "home");
      const away = competitorBySide(comp, "away");

      const homeName = teamName(home?.team);
      const awayName = teamName(away?.team);

      const homeLogo = teamLogo(home?.team);
      const awayLogo = teamLogo(away?.team);

      const homeScore = home?.score ?? "";
      const awayScore = away?.score ?? "";

      const stat = statusFromEvent(ev);

      const venue = comp?.venue?.fullName || "";
      const startISO = ev?.date || comp?.date || "";
      const startTime = startISO ? new Date(startISO).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

      const metaTop = venue ? venue : (startTime ? startTime : "—");
      const metaBottom = startTime && venue ? `${startTime}` : (stat.detail || "");

      out.push(`
        <div class="game ${stat.cls}">
          <div class="gameHeader">
            <div class="statusPill ${stat.cls}">${escapeHtml(stat.pill)}</div>
          </div>

          <div class="gameMetaTopLine">${escapeHtml(metaTop)}</div>
          <div class="gameMetaOddsLine">${escapeHtml(metaBottom)}</div>

          <div class="teamRow">
            <div class="teamLeft">
              <div class="teamLine">
                ${
                  awayLogo
                    ? `<img class="teamLogo" src="${awayLogo}" alt="${escapeHtml(awayName)} logo" loading="lazy" decoding="async" />`
                    : `<div class="teamLogoFallback">${escapeHtml(String(away?.team?.abbreviation || "—"))}</div>`
                }
                <div class="teamText">
                  <div class="teamName">${escapeHtml(awayName)}</div>
                  <div class="teamMeta">${escapeHtml(`Away ${teamRecord(away)}`.trim())}</div>
                </div>
              </div>
            </div>
            <div class="score">${escapeHtml(String(awayScore))}</div>
          </div>

          <div class="teamRow">
            <div class="teamLeft">
              <div class="teamLine">
                ${
                  homeLogo
                    ? `<img class="teamLogo" src="${homeLogo}" alt="${escapeHtml(homeName)} logo" loading="lazy" decoding="async" />`
                    : `<div class="teamLogoFallback">${escapeHtml(String(home?.team?.abbreviation || "—"))}</div>`
                }
                <div class="teamText">
                  <div class="teamName">${escapeHtml(homeName)}</div>
                  <div class="teamMeta">${escapeHtml(`Home ${teamRecord(home)}`.trim())}</div>
                </div>
              </div>
            </div>
            <div class="score">${escapeHtml(String(homeScore))}</div>
          </div>
        </div>
      `);
    });

    if (!out.length) {
      return `<div class="notice">No games found for this league/date.</div>`;
    }

    return `<div class="grid">${out.join("")}</div>`;
  }

  // ------------------------------------------------------------
  // Auto refresh
  // ------------------------------------------------------------
  let refreshTimer = null;

  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }
  window.stopAutoRefresh = stopAutoRefresh;

  function shouldAutoRefresh(events) {
    return (events || []).some(ev => (ev?.status?.type?.state || "") === "in");
  }

  // ------------------------------------------------------------
  // Main entry: loadScores
  // ------------------------------------------------------------
  async function loadScores(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;

    const selectedKey = getSavedLeagueKey();
    const selectedDate = getSavedDateYYYYMMDD();

    if (showLoading) {
      content.innerHTML = renderHeader("Loading…") + `<div class="notice">Loading scoreboard…</div>`;
      setTimeout(() => { try { window.replaceMichiganText && window.replaceMichiganText(content); } catch {} }, 0);
    }

    stopAutoRefresh();

    try {
      const data = await fetchScoreboard(selectedKey, selectedDate);
      const events = Array.isArray(data?.events) ? data.events : [];

      // Sort: favorites first, then live, then kickoff
      const sorted = [...events].sort((a, b) => {
        const pa = eventPriority(a);
        const pb = eventPriority(b);
        if (pb !== pa) return pb - pa;

        const ta = Date.parse(a?.date || "") || 0;
        const tb = Date.parse(b?.date || "") || 0;
        return ta - tb;
      });

      const updated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      content.innerHTML =
        renderHeader(`Updated ${updated}`) +
        renderScoreCards(sorted, selectedKey);

      // TTUN enforcement
      setTimeout(() => { try { window.replaceMichiganText && window.replaceMichiganText(content); } catch {} }, 0);

      // Auto refresh if live games exist
      if (shouldAutoRefresh(sorted)) {
        refreshTimer = setInterval(() => {
          loadScores(false).catch(() => {});
        }, 30000);
      }

    } catch (err) {
      console.error("loadScores failed:", err);
      content.innerHTML =
        renderHeader("Error") +
        `<div class="notice">Couldn’t load scores right now. Try Refresh.</div>`;
      setTimeout(() => { try { window.replaceMichiganText && window.replaceMichiganText(content); } catch {} }, 0);
    }
  }

  // Export
  window.loadScores = loadScores;

  // ------------------------------------------------------------
  // UI events (league change, date change, refresh)
  // ------------------------------------------------------------
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (!el) return;

    if (el.id === "leagueSelect") {
      setSavedLeagueKey(el.value);
      loadScores(true);
    }
  });

  document.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!btn) return;

    if (btn.id === "scoresRefreshBtn") {
      loadScores(true);
      return;
    }

    if (btn.id === "dateBtn") {
      const current = getSavedDateYYYYMMDD();
      const picked = prompt("Enter date as YYYYMMDD (example: 20260225):", current);
      if (picked === null) return;
      const s = String(picked).replace(/\D/g, "");
      if (s.length !== 8) {
        alert("Date must be 8 digits (YYYYMMDD).");
        return;
      }
      setSavedDateYYYYMMDD(s);
      loadScores(true);
      return;
    }
  });

})();