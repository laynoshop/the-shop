// stocks/stocks-render.js
// Renders the Stocks tab UI — day grouping, recurrence badges, history overlay, daily watchlist overlay.

(function () {
  "use strict";

  // -----------------------------------------------------------
  // Direction helpers
  // -----------------------------------------------------------
  function normalizeDirection(raw) {
    if (!raw) return "NEUTRAL";
    const v = String(raw).toUpperCase().trim();
    if (v === "BULLISH" || v === "BUY"  || v === "LONG")  return "BULLISH";
    if (v === "BEARISH" || v === "SELL" || v === "SHORT") return "BEARISH";
    return "NEUTRAL";
  }

  function directionBadge(direction) {
    const d = normalizeDirection(direction);
    const map = {
      BULLISH: { color: "#22c55e", icon: "\u25b2", label: "BULLISH" },
      BEARISH: { color: "#ef4444", icon: "\u25bc", label: "BEARISH" },
      NEUTRAL: { color: "#f59e0b", icon: "\u25cf", label: "NEUTRAL" }
    };
    return map[d];
  }

  function renderConfidence(confidence) {
    if (confidence === null || confidence === undefined)
      return { label: "--", bg: "rgba(156,163,175,0.12)", color: "rgba(255,255,255,0.45)" };
    if (!isNaN(Number(confidence))) {
      const n = Number(confidence);
      if (n >= 70) return { label: n + "%", bg: "rgba(34,197,94,0.15)",  color: "#22c55e" };
      if (n >= 45) return { label: n + "%", bg: "rgba(245,158,11,0.15)", color: "#f59e0b" };
      return             { label: n + "%", bg: "rgba(239,68,68,0.15)",  color: "#ef4444" };
    }
    const map = {
      HIGH:   { label: "HIGH",   bg: "rgba(34,197,94,0.15)",  color: "#22c55e" },
      MEDIUM: { label: "MEDIUM", bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
      LOW:    { label: "LOW",    bg: "rgba(239,68,68,0.15)",  color: "#ef4444" }
    };
    return map[String(confidence).toUpperCase()] || map.MEDIUM;
  }

  function newsImpactBadge(impact) {
    const map = {
      POSITIVE: "\uD83D\uDFE2",
      NEGATIVE: "\uD83D\uDD34",
      NEUTRAL:  "\uD83D\uDFE1",
      NONE:     "\u26AA"
    };
    return map[(impact || "").toUpperCase()] || "\u26AA";
  }

  function fmtTimestamp(ts) {
    if (!ts) return "--";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const date = d.toLocaleDateString([], { month: "2-digit", day: "2-digit", year: "numeric" });
      const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return `Generated on ${date} at ${time}`;
    } catch { return "--"; }
  }

  function dayKey(ts) {
    if (!ts) return "unknown";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toISOString().slice(0, 10);
    } catch { return "unknown"; }
  }

  function dayLabel(key) {
    if (key === "unknown") return "Unknown Date";
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);
    if (key === todayKey) return "Today";
    if (key === yKey)     return "Yesterday";
    const d = new Date(key + "T12:00:00");
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  }

  function field(signal, ...keys) {
    for (const k of keys) {
      const v = signal[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return "--";
  }

  function ordinal(n) {
    const s = ["th","st","nd","rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  // -----------------------------------------------------------
  // TRIGGER CHIPS — pretty labels for what caused a ticker to be added
  // -----------------------------------------------------------
  const TRIGGER_META = {
    volume_surge:        { label: "Volume Surge",       color: "#818cf8", icon: "\uD83D\uDCC8" },
    gap_up:              { label: "Gap Up",              color: "#22c55e", icon: "\u2B06" },
    gap_down:            { label: "Gap Down",            color: "#ef4444", icon: "\u2B07" },
    earnings_proximity:  { label: "Earnings Near",       color: "#f59e0b", icon: "\uD83D\uDCC5" },
    sector_momentum:     { label: "Sector Momentum",     color: "#38bdf8", icon: "\uD83C\uDFAF" },
    news_activity:       { label: "News Activity",       color: "#fb923c", icon: "\uD83D\uDCF0" }
  };

  function triggerChip(triggerKey) {
    const meta = TRIGGER_META[triggerKey] || { label: triggerKey, color: "rgba(255,255,255,0.55)", icon: "\u2022" };
    return `<span class="ssc-trigger-chip" style="color:${meta.color};border-color:${meta.color}22;background:${meta.color}14">${meta.icon} ${meta.label}</span>`;
  }

  // -----------------------------------------------------------
  // DAILY WATCHLIST OVERLAY
  // -----------------------------------------------------------
  let __watchlistUnsub = null;

  function openWatchlistOverlay(db) {
    const existing = document.getElementById("ssc-watchlist-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "ssc-watchlist-overlay";
    overlay.className = "ssc-watchlist-overlay";
    overlay.innerHTML = `
      <div class="ssc-watchlist-backdrop"></div>
      <div class="ssc-watchlist-panel">
        <div class="ssc-watchlist-header">
          <div class="ssc-watchlist-title">
            <span class="ssc-watchlist-icon">\uD83D\uDCCB</span>
            <div>
              <div class="ssc-watchlist-heading">Today's Watchlist</div>
              <div class="ssc-watchlist-sub">Built by Tier 0 at 9:00 AM &mdash; ${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>
          </div>
          <button class="ssc-watchlist-close" aria-label="Close watchlist">&#x2715;</button>
        </div>
        <div class="ssc-watchlist-body" id="sscWatchlistBody">
          <div class="ssc-watchlist-loading">\u23F3 Loading watchlist...</div>
        </div>
        <div class="ssc-watchlist-footer">
          <button class="ssc-watchlist-rebuild-btn" id="sscWatchlistRebuildBtn">&#x21BB; Rebuild Now</button>
          <span class="ssc-watchlist-footer-note">Tier 0 auto-runs at 9:00 AM ET weekdays</span>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("ssc-watchlist-visible"));

    overlay.querySelector(".ssc-watchlist-backdrop").addEventListener("click", () => closeWatchlistOverlay());
    overlay.querySelector(".ssc-watchlist-close").addEventListener("click",    () => closeWatchlistOverlay());

    const rebuildBtn = overlay.querySelector("#sscWatchlistRebuildBtn");
    rebuildBtn.addEventListener("click", async () => {
      rebuildBtn.disabled = true;
      rebuildBtn.textContent = "\u23F3 Rebuilding...";
      setStatus("Tier 0 running — rebuilding watchlist...", "active");
      try {
        await window.runTier0Manual();
        setStatus("Watchlist rebuilt.", "idle");
      } catch (e) {
        setStatus("Tier 0 error. Check console.", "error");
      } finally {
        rebuildBtn.disabled = false;
        rebuildBtn.textContent = "&#x21BB; Rebuild Now";
      }
    });

    // Subscribe to live watchlist
    if (__watchlistUnsub) { __watchlistUnsub(); __watchlistUnsub = null; }
    __watchlistUnsub = window.subscribeTodaysWatchlist(db, (tickers) => {
      const body = document.getElementById("sscWatchlistBody");
      if (!body) return;
      if (!tickers || tickers.length === 0) {
        body.innerHTML = `
          <div class="ssc-watchlist-empty">
            <div class="ssc-watchlist-empty-icon">\uD83D\uDD0D</div>
            <div class="ssc-watchlist-empty-msg">No watchlist built yet for today.</div>
            <div class="ssc-watchlist-empty-sub">Tier 0 auto-runs at 9:00 AM ET, or tap Rebuild Now above.</div>
          </div>
        `;
        return;
      }

      body.innerHTML = `
        <div class="ssc-watchlist-count">${tickers.length} stock${tickers.length !== 1 ? "s" : ""} selected from S&amp;P 500 + Nasdaq</div>
        <div class="ssc-watchlist-grid">
          ${tickers.map(t => renderWatchlistRow(t)).join("")}
        </div>
      `;
    });
  }

  function closeWatchlistOverlay() {
    if (__watchlistUnsub) { __watchlistUnsub(); __watchlistUnsub = null; }
    const overlay = document.getElementById("ssc-watchlist-overlay");
    if (!overlay) return;
    overlay.classList.remove("ssc-watchlist-visible");
    setTimeout(() => overlay.remove(), 280);
  }

  function renderWatchlistRow(t) {
    const triggers = (t.triggers || []).map(triggerChip).join("");
    const changeSign = (t.changePct || 0) >= 0 ? "+" : "";
    const changeColor = (t.changePct || 0) >= 0 ? "#22c55e" : "#ef4444";
    return `
      <div class="ssc-watchlist-row">
        <div class="ssc-watchlist-row-left">
          <span class="ssc-watchlist-row-ticker">${t.ticker}</span>
          <span class="ssc-watchlist-row-sector">${t.sector || ""}</span>
        </div>
        <div class="ssc-watchlist-row-triggers">${triggers}</div>
        <div class="ssc-watchlist-row-right">
          ${t.price ? `<span class="ssc-watchlist-row-price">$${t.price}</span>` : ""}
          ${t.changePct !== undefined ? `<span class="ssc-watchlist-row-change" style="color:${changeColor}">${changeSign}${t.changePct}%</span>` : ""}
        </div>
      </div>
    `;
  }

  // -----------------------------------------------------------
  // TICKER HISTORY OVERLAY
  // -----------------------------------------------------------
  function openHistoryOverlay(ticker, allSignals) {
    const existing = document.getElementById("ssc-history-overlay");
    if (existing) existing.remove();

    const tickerSignals = allSignals
      .filter(s => (s.ticker || "").toUpperCase() === ticker.toUpperCase())
      .sort((a, b) => {
        const ta = a.generatedAt ? (a.generatedAt.toDate ? a.generatedAt.toDate() : new Date(a.generatedAt)) : 0;
        const tb = b.generatedAt ? (b.generatedAt.toDate ? b.generatedAt.toDate() : new Date(b.generatedAt)) : 0;
        return tb - ta;
      });

    const overlay = document.createElement("div");
    overlay.id = "ssc-history-overlay";
    overlay.className = "ssc-history-overlay";
    overlay.innerHTML = `
      <div class="ssc-history-backdrop"></div>
      <div class="ssc-history-panel">
        <div class="ssc-history-header">
          <div class="ssc-history-title">
            <span class="ssc-history-ticker">${ticker}</span>
            <span class="ssc-history-subtitle">Signal History &mdash; Last 7 Days</span>
          </div>
          <button class="ssc-history-close" aria-label="Close history">&#x2715;</button>
        </div>
        <div class="ssc-history-count">${tickerSignals.length} signal${tickerSignals.length !== 1 ? "s" : ""} found</div>
        <div class="ssc-history-scroll">
          ${tickerSignals.map(s => renderHistoryCard(s)).join("")}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("ssc-history-visible"));
    overlay.querySelector(".ssc-history-backdrop").addEventListener("click", () => closeHistoryOverlay());
    overlay.querySelector(".ssc-history-close").addEventListener("click",   () => closeHistoryOverlay());
  }

  function closeHistoryOverlay() {
    const overlay = document.getElementById("ssc-history-overlay");
    if (!overlay) return;
    overlay.classList.remove("ssc-history-visible");
    setTimeout(() => overlay.remove(), 280);
  }

  function renderHistoryCard(signal) {
    const rawDir    = signal.direction || signal.signal || "NEUTRAL";
    const normDir   = normalizeDirection(rawDir);
    const dir       = directionBadge(normDir);
    const conf      = renderConfidence(signal.confidence);
    const newsIcon  = newsImpactBadge(signal.news_impact);
    const changeSign = (signal.changePct || 0) >= 0 ? "+" : "";
    const entryZone  = field(signal, "entry_zone", "entry", "entryZone", "entry_price");
    const target     = field(signal, "target", "take_profit", "takeProfit", "target_price");
    const stopLoss   = field(signal, "stop_loss", "stopLoss", "stop", "stop_price");
    const riskReward = field(signal, "risk_reward", "riskReward", "r_r", "rr");
    const headline   = signal.newsHeadline || "No recent news";
    const newsUrl    = signal.newsUrl || signal.news_url || "";
    const newsHtml   = newsUrl
      ? `<a href="${newsUrl}" target="_blank" rel="noopener noreferrer" class="ssc-news-link">${newsIcon} ${headline}</a>`
      : `<span class="ssc-news-plain">${newsIcon} ${headline}</span>`;
    return `
      <div class="stock-signal-card ssc-history-card" data-direction="${normDir}">
        <div class="ssc-header">
          <div class="ssc-ticker">${signal.ticker}</div>
          <div class="ssc-direction" style="color:${dir.color}">${dir.icon} ${dir.label}</div>
          <div class="ssc-confidence" style="background:${conf.bg};color:${conf.color}">${conf.label}</div>
        </div>
        <div class="ssc-price-row">
          <span class="ssc-price">$${signal.price || "--"}</span>
          <span class="ssc-change" style="color:${(signal.changePct || 0) >= 0 ? "#22c55e" : "#ef4444"}">${changeSign}${signal.changePct || 0}%</span>
          <span class="ssc-type">${field(signal, "signal_type", "signalType", "type")}</span>
        </div>
        <div class="ssc-grid">
          <div class="ssc-cell"><div class="ssc-label">Entry Zone</div><div class="ssc-val">${entryZone}</div></div>
          <div class="ssc-cell"><div class="ssc-label">Target</div><div class="ssc-val ssc-green">${target}</div></div>
          <div class="ssc-cell"><div class="ssc-label">Stop Loss</div><div class="ssc-val ssc-red">${stopLoss}</div></div>
          <div class="ssc-cell"><div class="ssc-label">Risk / Reward</div><div class="ssc-val">${riskReward}</div></div>
        </div>
        <div class="ssc-reasoning">${field(signal, "reasoning", "summary", "analysis", "reason")}</div>
        <div class="ssc-footer">
          <div class="ssc-news">${newsHtml}</div>
          <span class="ssc-time">${fmtTimestamp(signal.generatedAt)}</span>
        </div>
      </div>
    `;
  }

  // -----------------------------------------------------------
  // DISMISS CONFIRM
  // -----------------------------------------------------------
  function showDismissConfirm(card, docId) {
    if (card.querySelector(".ssc-confirm-overlay")) return;
    const ticker = (card.querySelector(".ssc-ticker") || {}).textContent || "this signal";
    const overlay = document.createElement("div");
    overlay.className = "ssc-confirm-overlay";
    overlay.innerHTML = `
      <div class="ssc-confirm-box">
        <div class="ssc-confirm-icon">&#x1F5D1;</div>
        <div class="ssc-confirm-msg">Remove <strong>${ticker}</strong> signal?<br><span class="ssc-confirm-sub">It can regenerate next time the screener runs.</span></div>
        <div class="ssc-confirm-actions">
          <button class="ssc-confirm-cancel">Keep it</button>
          <button class="ssc-confirm-yes">Yes, remove</button>
        </div>
      </div>
    `;
    card.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("ssc-confirm-visible"));
    overlay.querySelector(".ssc-confirm-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      overlay.classList.remove("ssc-confirm-visible");
      setTimeout(() => overlay.remove(), 220);
    });
    overlay.querySelector(".ssc-confirm-yes").addEventListener("click", async (e) => {
      e.stopPropagation();
      overlay.classList.remove("ssc-confirm-visible");
      card.style.transition = "opacity 0.25s ease, transform 0.25s ease, max-height 0.35s ease, margin-bottom 0.35s ease";
      card.style.overflow = "hidden";
      card.style.opacity  = "0";
      card.style.transform = "scale(0.97) translateY(-4px)";
      card.style.maxHeight = card.offsetHeight + "px";
      setTimeout(() => { card.style.maxHeight = "0"; card.style.marginBottom = "0"; }, 30);
      try {
        const db  = getDb();
        const cfg = window.STOCKS_CONFIG || {};
        await db.collection(cfg.SIGNALS_COLLECTION || "stockSignals").doc(docId).delete();
        setTimeout(() => card.remove(), 400);
      } catch (err) {
        console.error("[Stocks] Dismiss error:", err);
        card.style.opacity = "1"; card.style.transform = "none";
        card.style.maxHeight = ""; card.style.marginBottom = "";
        setTimeout(() => overlay.remove(), 10);
        alert("Could not remove signal.");
      }
    });
  }

  function bindDismissButtons() {
    document.querySelectorAll(".ssc-dismiss-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const card  = btn.closest(".stock-signal-card");
        const docId = btn.dataset.docid;
        if (!docId || !card) return;
        showDismissConfirm(card, docId);
      });
    });
  }

  // -----------------------------------------------------------
  // SIGNAL CARD
  // -----------------------------------------------------------
  function renderSignalCard(signal, docId, allSignals) {
    const rawDir     = signal.direction || signal.signal || "NEUTRAL";
    const normDir    = normalizeDirection(rawDir);
    const dir        = directionBadge(normDir);
    const conf       = renderConfidence(signal.confidence);
    const newsIcon   = newsImpactBadge(signal.news_impact);
    const changeSign = (signal.changePct || 0) >= 0 ? "+" : "";
    const entryZone  = field(signal, "entry_zone", "entry", "entryZone", "entry_price");
    const target     = field(signal, "target", "take_profit", "takeProfit", "target_price");
    const stopLoss   = field(signal, "stop_loss", "stopLoss", "stop", "stop_price");
    const riskReward = field(signal, "risk_reward", "riskReward", "r_r", "rr");
    const headline   = signal.newsHeadline || "No recent news";
    const newsUrl    = signal.newsUrl || signal.news_url || "";
    const newsHtml   = newsUrl
      ? `<a href="${newsUrl}" target="_blank" rel="noopener noreferrer" class="ssc-news-link">${newsIcon} ${headline}</a>`
      : `<span class="ssc-news-plain">${newsIcon} ${headline}</span>`;
    const ticker = (signal.ticker || "").toUpperCase();
    const recurrenceCount = allSignals.filter(s => (s.ticker || "").toUpperCase() === ticker).length;
    const recurrenceBadge = recurrenceCount > 1
      ? `<button class="ssc-recurrence-btn" data-ticker="${ticker}" title="View full history for ${ticker}">&#x21BA; ${recurrenceCount}${ordinal(recurrenceCount)} signal this week</button>`
      : "";
    return `
      <div class="stock-signal-card" data-direction="${normDir}">
        <div class="ssc-header">
          <div class="ssc-ticker">${signal.ticker}</div>
          <div class="ssc-direction" style="color:${dir.color}">${dir.icon} ${dir.label}</div>
          <div class="ssc-confidence" style="background:${conf.bg};color:${conf.color}">${conf.label}</div>
          <button class="ssc-dismiss-btn" data-docid="${docId}" title="Dismiss signal" aria-label="Dismiss signal">&#x2715;</button>
        </div>
        ${recurrenceBadge}
        <div class="ssc-price-row">
          <span class="ssc-price">$${signal.price || "--"}</span>
          <span class="ssc-change" style="color:${(signal.changePct || 0) >= 0 ? "#22c55e" : "#ef4444"}">${changeSign}${signal.changePct || 0}%</span>
          <span class="ssc-type">${field(signal, "signal_type", "signalType", "type")}</span>
        </div>
        <div class="ssc-grid">
          <div class="ssc-cell"><div class="ssc-label">Entry Zone</div><div class="ssc-val">${entryZone}</div></div>
          <div class="ssc-cell"><div class="ssc-label">Target</div><div class="ssc-val ssc-green">${target}</div></div>
          <div class="ssc-cell"><div class="ssc-label">Stop Loss</div><div class="ssc-val ssc-red">${stopLoss}</div></div>
          <div class="ssc-cell"><div class="ssc-label">Risk / Reward</div><div class="ssc-val">${riskReward}</div></div>
        </div>
        <div class="ssc-reasoning">${field(signal, "reasoning", "summary", "analysis", "reason")}</div>
        <div class="ssc-footer">
          <div class="ssc-news">${newsHtml}</div>
          <span class="ssc-time">${fmtTimestamp(signal.generatedAt)}</span>
        </div>
        ${signal.expires_note ? `<div class="ssc-expires">${signal.expires_note}</div>` : ""}
      </div>
    `;
  }

  // -----------------------------------------------------------
  // DAY GROUPING
  // -----------------------------------------------------------
  function renderGroupedSignals(allDocs, allSignals) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const groups = {};
    allDocs.forEach(({ data, id }) => {
      const k = dayKey(data.generatedAt);
      if (!groups[k]) groups[k] = [];
      groups[k].push({ data, id });
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    let html = "";
    sortedKeys.forEach(key => {
      const isToday   = key === todayKey;
      const groupDocs = groups[key];
      const label     = dayLabel(key);
      const count     = groupDocs.length;
      const cardsHtml = groupDocs.map(({ data, id }) => renderSignalCard(data, id, allSignals)).join("");
      if (isToday) {
        html += `
          <div class="ssc-day-section" data-day="${key}">
            <div class="ssc-today-label">&#x1F4C5; Today &mdash; ${count} signal${count !== 1 ? "s" : ""}</div>
            <div class="ssc-day-cards">${cardsHtml}</div>
          </div>`;
      } else {
        const groupId = "ssc-group-" + key;
        html += `
          <div class="ssc-day-section" data-day="${key}">
            <button class="ssc-day-banner" data-target="${groupId}" aria-expanded="false">
              <span class="ssc-day-banner-left">
                <span class="ssc-day-banner-icon">&#x1F4C5;</span>
                <span class="ssc-day-banner-label">${label}</span>
                <span class="ssc-day-banner-count">${count} signal${count !== 1 ? "s" : ""}</span>
              </span>
              <span class="ssc-day-banner-chevron">&#x25BC;</span>
            </button>
            <div class="ssc-day-cards ssc-day-collapsed" id="${groupId}">${cardsHtml}</div>
          </div>`;
      }
    });
    return html;
  }

  function bindGroupedInteractions(allSignals) {
    document.querySelectorAll(".ssc-day-banner").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.target;
        const panel    = document.getElementById(targetId);
        if (!panel) return;
        const isOpen = btn.getAttribute("aria-expanded") === "true";
        if (isOpen) {
          panel.style.maxHeight = panel.scrollHeight + "px";
          requestAnimationFrame(() => { panel.style.maxHeight = "0"; panel.style.opacity = "0"; });
          btn.setAttribute("aria-expanded", "false");
          btn.querySelector(".ssc-day-banner-chevron").style.transform = "rotate(0deg)";
          setTimeout(() => panel.classList.add("ssc-day-collapsed"), 320);
        } else {
          panel.classList.remove("ssc-day-collapsed");
          panel.style.maxHeight = "0"; panel.style.opacity = "0";
          requestAnimationFrame(() => { panel.style.maxHeight = panel.scrollHeight + "px"; panel.style.opacity = "1"; });
          btn.setAttribute("aria-expanded", "true");
          btn.querySelector(".ssc-day-banner-chevron").style.transform = "rotate(180deg)";
          setTimeout(() => { panel.style.maxHeight = ""; }, 350);
        }
      });
    });
    document.querySelectorAll(".ssc-recurrence-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const ticker = btn.dataset.ticker;
        if (ticker) openHistoryOverlay(ticker, allSignals);
      });
    });
    bindDismissButtons();
  }

  // -----------------------------------------------------------
  // MAIN RENDER
  // -----------------------------------------------------------
  function renderStocks() {
    const content = document.getElementById("content");
    if (!content) return;
    const cfg     = window.STOCKS_CONFIG || {};
    const keysSet = !!(cfg.FINNHUB_KEY && cfg.FMP_KEY);

    content.innerHTML = `
      <div class="stocks-wrap">
        <div class="stocks-header">
          <div class="stocks-title-row">
            <div>
              <div class="stocks-title">\uD83D\uDCC8 Stock Signals</div>
              <div class="stocks-subtitle">AI-powered Tier 0 &rarr; Tier 1 &rarr; Tier 2 engine</div>
            </div>
            <button class="stocks-watchlist-btn" id="stocksWatchlistBtn" title="View today's watchlist">\uD83D\uDCCB Daily Watchlist</button>
          </div>
        </div>

        ${!keysSet ? `
          <div class="stocks-loading">
            <div class="stocks-loading-dot"></div><div class="stocks-loading-dot"></div><div class="stocks-loading-dot"></div>
            <div class="stocks-loading-text">Loading stock engine\u2026</div>
          </div>` : `
          <div class="stocks-controls">
            <div class="stocks-status" id="stocksStatus">
              <span class="stocks-status-dot" id="stocksDot"></span>
              <span id="stocksStatusText">Engine ready</span>
            </div>
            <button class="stocks-run-btn" id="stocksRunBtn" type="button">&#x25B6; Run Screener Now</button>
          </div>
          <div class="stocks-market-badge" id="stocksMarketBadge"></div>
          <div class="stocks-signals-list" id="stocksSignalsList">
            <div class="stocks-empty">No signals yet. Run the screener or wait for the next auto-scan.</div>
          </div>
        `}
      </div>
    `;

    // Watchlist button always binds regardless of keys
    document.getElementById("stocksWatchlistBtn").addEventListener("click", () => {
      const db = getDb();
      if (db) openWatchlistOverlay(db);
    });

    if (!keysSet) {
      waitForKeysAndRerender();
    } else {
      bindControls();
      updateMarketBadge();
      startSignalListener();
    }
  }

  function waitForKeysAndRerender() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const cfg = window.STOCKS_CONFIG || {};
      if (cfg.FINNHUB_KEY && cfg.FMP_KEY) { clearInterval(t); renderStocks(); return; }
      if (tries > 60) {
        clearInterval(t);
        const content = document.getElementById("content");
        if (content) content.innerHTML = `<div class="stocks-wrap"><div class="notice">\u26A0\uFE0F Could not load stock engine keys.</div></div>`;
      }
    }, 500);
  }

  function bindControls() {
    const runBtn = document.getElementById("stocksRunBtn");
    if (!runBtn) return;
    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      runBtn.textContent = "\u23F3 Scanning...";
      setStatus("Running Tier 1 screener...", "active");
      try {
        const db = getDb();
        if (!db) { alert("Firestore not ready."); return; }
        const candidates = await window.runTier1Screener(db);
        setStatus(`Tier 1 complete \u2014 ${candidates.length} candidate(s) flagged. Running AI analysis...`, "active");
        if (candidates.length === 0) setStatus("No signals triggered. Markets may be quiet.", "idle");
      } catch (e) {
        console.error("[Stocks] Screener error:", e);
        setStatus("Error running screener. Check console.", "error");
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "\u25B6 Run Screener Now";
      }
    });
  }

  let __signalListener = null;

  function startSignalListener() {
    if (__signalListener) { __signalListener(); __signalListener = null; }
    const db  = getDb();
    if (!db) return;
    const cfg = window.STOCKS_CONFIG || {};
    if (typeof window.startTier2Listener === "function") window.startTier2Listener(db);
    __signalListener = db
      .collection(cfg.SIGNALS_COLLECTION || "stockSignals")
      .orderBy("generatedAt", "desc")
      .limit(200)
      .onSnapshot((snapshot) => {
        const list = document.getElementById("stocksSignalsList");
        if (!list) return;
        if (snapshot.empty) {
          list.innerHTML = `<div class="stocks-empty">No signals yet. Run the screener or wait for the next auto-scan.</div>`;
          return;
        }
        const allDocs = [], allSignals = [];
        snapshot.forEach(doc => { allDocs.push({ data: doc.data(), id: doc.id }); allSignals.push(doc.data()); });
        const todayCount = allDocs.filter(({ data }) => dayKey(data.generatedAt) === new Date().toISOString().slice(0, 10)).length;
        list.innerHTML = renderGroupedSignals(allDocs, allSignals);
        bindGroupedInteractions(allSignals);
        setStatus(`${todayCount} signal${todayCount !== 1 ? "s" : ""} today`, "idle");
      }, err => console.error("[Stocks] Signal listener error:", err));
  }

  function setStatus(msg, state) {
    const txt = document.getElementById("stocksStatusText");
    const dot = document.getElementById("stocksDot");
    if (txt) txt.textContent = msg;
    if (dot) dot.className = "stocks-status-dot" + (state ? " stocks-dot-" + state : "");
  }

  function updateMarketBadge() {
    const badge = document.getElementById("stocksMarketBadge");
    if (!badge) return;
    const open = typeof window.isMarketOpen === "function" ? window.isMarketOpen() : false;
    badge.innerHTML = open
      ? `<span class="stocks-market-open">\uD83D\uDFE2 Market Open</span>`
      : `<span class="stocks-market-closed">\uD83D\uDD34 Market Closed \u2014 Signals reflect last session</span>`;
  }

  function getDb() {
    try {
      if (window.firebase && window.firebase.firestore) return window.firebase.firestore();
    } catch {}
    return null;
  }

  window.renderStocks = renderStocks;
  console.log("[Stocks] Render module loaded.");
})();
