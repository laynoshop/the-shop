// stocks/stocks-render.js
// Renders the Stocks tab UI — The Roster input, session grouping, history overlay.

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

  function sessionLabel(ts, count) {
    if (!ts) return "Unknown Session";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const datePart = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      const timePart = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const sigPart  = `${count} Signal${count !== 1 ? "s" : ""}`;
      return `${datePart} \u2022 ${timePart}  \u2014  ${sigPart}`;
    } catch { return "Unknown Session"; }
  }

  function sessionKey(ts) {
    if (!ts) return "unknown";
    try {
      const d  = ts.toDate ? ts.toDate() : new Date(ts);
      const mm = Math.floor(d.getMinutes() / 10) * 10;
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
    } catch { return "unknown"; }
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
  // NEWS STORIES — renders individual clickable pills
  // Supports new newsArticles[] array OR legacy newsHeadline/newsUrl string
  // -----------------------------------------------------------
  function renderNewsPills(signal) {
    const newsIcon = newsImpactBadge(signal.news_impact);

    // New format: array of {headline, url, source}
    if (Array.isArray(signal.newsArticles) && signal.newsArticles.length > 0) {
      const pills = signal.newsArticles.map((article, i) => {
        const label = article.headline || `Story ${i + 1}`;
        const source = article.source ? `<span class="ssc-news-source">${article.source}</span>` : "";
        if (article.url) {
          return `<a href="${article.url}" target="_blank" rel="noopener noreferrer" class="ssc-news-pill">
            <span class="ssc-news-pill-num">${i + 1}</span>
            <span class="ssc-news-pill-text">${label}</span>
            ${source}
          </a>`;
        }
        return `<span class="ssc-news-pill ssc-news-pill-nolink">
          <span class="ssc-news-pill-num">${i + 1}</span>
          <span class="ssc-news-pill-text">${label}</span>
          ${source}
        </span>`;
      });
      return `
        <div class="ssc-news-header">${newsIcon} Recent News</div>
        <div class="ssc-news-pills">${pills.join("")}</div>
      `;
    }

    // Legacy format: single headline string + single url
    const headline = signal.newsHeadline || "No recent news";
    const url      = signal.newsUrl || signal.news_url || "";
    if (!headline || headline === "No recent news found." || headline === "No recent news") {
      return `<div class="ssc-news-header">${newsIcon} No recent news</div>`;
    }
    if (url) {
      return `
        <div class="ssc-news-header">${newsIcon} Recent News</div>
        <div class="ssc-news-pills">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="ssc-news-pill">
            <span class="ssc-news-pill-num">1</span>
            <span class="ssc-news-pill-text">${headline}</span>
          </a>
        </div>
      `;
    }
    return `
      <div class="ssc-news-header">${newsIcon} Recent News</div>
      <div class="ssc-news-pills">
        <span class="ssc-news-pill ssc-news-pill-nolink">
          <span class="ssc-news-pill-text">${headline}</span>
        </span>
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
            <span class="ssc-history-subtitle">Signal History</span>
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
    const changeSign = (signal.changePct || 0) >= 0 ? "+" : "";
    const entryZone  = field(signal, "entry_zone", "entry", "entryZone", "entry_price");
    const target     = field(signal, "target", "take_profit", "takeProfit", "target_price");
    const stopLoss   = field(signal, "stop_loss", "stopLoss", "stop", "stop_price");
    const riskReward = field(signal, "risk_reward", "riskReward", "r_r", "rr");
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
          <div class="ssc-news-block">${renderNewsPills(signal)}</div>
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
        <div class="ssc-confirm-msg">Remove <strong>${ticker}</strong> signal?<br><span class="ssc-confirm-sub">It can be regenerated on the next run.</span></div>
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
    const changeSign = (signal.changePct || 0) >= 0 ? "+" : "";
    const entryZone  = field(signal, "entry_zone", "entry", "entryZone", "entry_price");
    const target     = field(signal, "target", "take_profit", "takeProfit", "target_price");
    const stopLoss   = field(signal, "stop_loss", "stopLoss", "stop", "stop_price");
    const riskReward = field(signal, "risk_reward", "riskReward", "r_r", "rr");
    const ticker = (signal.ticker || "").toUpperCase();
    const recurrenceCount = allSignals.filter(s => (s.ticker || "").toUpperCase() === ticker).length;
    const recurrenceBadge = recurrenceCount > 1
      ? `<button class="ssc-recurrence-btn" data-ticker="${ticker}" title="View full history for ${ticker}">&#x21BA; ${recurrenceCount}${ordinal(recurrenceCount)} signal</button>`
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
          <div class="ssc-news-block">${renderNewsPills(signal)}</div>
          <span class="ssc-time">${fmtTimestamp(signal.generatedAt)}</span>
        </div>
        ${signal.expires_note ? `<div class="ssc-expires">${signal.expires_note}</div>` : ""}
      </div>
    `;
  }

  // -----------------------------------------------------------
  // SESSION GROUPING
  // -----------------------------------------------------------
  function renderSessionGroups(allDocs, allSignals) {
    const groups = {};
    allDocs.forEach(({ data, id }) => {
      const k = sessionKey(data.generatedAt);
      if (!groups[k]) groups[k] = { docs: [], firstTs: data.generatedAt };
      groups[k].docs.push({ data, id });
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    let html = "";

    sortedKeys.forEach((key, idx) => {
      const group    = groups[key];
      const count    = group.docs.length;
      const label    = sessionLabel(group.firstTs, count);
      const cardsHtml = group.docs.map(({ data, id }) => renderSignalCard(data, id, allSignals)).join("");
      const isLatest = idx === 0;

      if (isLatest) {
        html += `
          <div class="ssc-session-section" data-session="${key}">
            <div class="ssc-session-latest-header">
              <span class="ssc-session-latest-pill">&#x26A1; Latest Run</span>
              <span class="ssc-session-latest-label">${label}</span>
            </div>
            <div class="ssc-day-cards">${cardsHtml}</div>
          </div>`;
      } else {
        const groupId = "ssc-group-" + key.replace(/[^a-zA-Z0-9]/g, "-");
        html += `
          <div class="ssc-session-section" data-session="${key}">
            <button class="ssc-day-banner" data-target="${groupId}" aria-expanded="false">
              <span class="ssc-day-banner-left">
                <span class="ssc-day-banner-icon">&#x1F4CA;</span>
                <span class="ssc-day-banner-label">${label}</span>
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
  // THE ROSTER UI
  // -----------------------------------------------------------
  let __rosterTickers = [];

  async function initRosterUI() {
    __rosterTickers = (typeof window.loadRoster === "function") ? await window.loadRoster() : [];
    renderRosterPills();
    updateRunBtn();
  }

  function renderRosterPills() {
    const container = document.getElementById("rosterPills");
    const counter   = document.getElementById("rosterCounter");
    if (!container) return;
    const max = window.ROSTER_MAX || 20;
    if (counter) counter.textContent = `${__rosterTickers.length} / ${max}`;
    if (__rosterTickers.length === 0) {
      container.innerHTML = `<span class="roster-empty-hint">Add tickers above to build your Roster \u2191</span>`;
      return;
    }
    container.innerHTML = __rosterTickers.map(t => `
      <span class="roster-pill">
        <span class="roster-pill-ticker">${t}</span>
        <button class="roster-pill-remove" data-ticker="${t}" title="Remove ${t}" aria-label="Remove ${t}">&#x2715;</button>
      </span>
    `).join("");
    container.querySelectorAll(".roster-pill-remove").forEach(btn => {
      btn.addEventListener("click", async () => {
        const ticker = btn.dataset.ticker;
        const result = await window.removeFromRoster(ticker);
        if (result.ok) {
          __rosterTickers = result.tickers;
          renderRosterPills();
          updateRunBtn();
        }
      });
    });
  }

  function updateRunBtn() {
    const btn = document.getElementById("stocksRunBtn");
    if (!btn) return;
    const empty = __rosterTickers.length === 0;
    btn.disabled = empty;
    btn.title = empty ? "Add tickers to The Roster first" : `Run deep analysis on ${__rosterTickers.length} ticker${__rosterTickers.length !== 1 ? "s" : ""}`;
  }

  function bindRosterInput() {
    const input  = document.getElementById("rosterInput");
    const addBtn = document.getElementById("rosterAddBtn");
    if (!input || !addBtn) return;

    async function tryAdd() {
      const raw = input.value.trim();
      if (!raw) return;
      const tickers = raw.split(/[,\s]+/).filter(Boolean);
      let added = 0, lastErr = "";
      for (const t of tickers) {
        const result = await window.addToRoster(t);
        if (result.ok) {
          __rosterTickers = result.tickers;
          added++;
        } else {
          lastErr = result.reason;
        }
      }
      input.value = "";
      renderRosterPills();
      updateRunBtn();
      if (added === 0 && lastErr) showRosterError(lastErr);
    }

    addBtn.addEventListener("click", tryAdd);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); tryAdd(); }
    });
  }

  function showRosterError(msg) {
    let err = document.getElementById("rosterError");
    if (!err) return;
    err.textContent = msg;
    err.style.opacity = "1";
    clearTimeout(err.__t);
    err.__t = setTimeout(() => { err.style.opacity = "0"; }, 3000);
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
              <div class="stocks-title">&#x1F4C8; Stock Signals</div>
              <div class="stocks-subtitle">Deep Analysis Engine &mdash; FMP + AI</div>
            </div>
          </div>
        </div>

        <!-- THE ROSTER -->
        <div class="roster-panel">
          <div class="roster-panel-header">
            <div class="roster-panel-title">
              <span class="roster-icon">&#x1F3AF;</span>
              <div>
                <div class="roster-heading">The Roster</div>
                <div class="roster-sub">Your master ticker list &mdash; add up to 20 stocks for deep FMP analysis</div>
              </div>
            </div>
            <span class="roster-counter" id="rosterCounter">0 / 20</span>
          </div>

          <div class="roster-input-row">
            <input
              id="rosterInput"
              class="roster-input"
              type="text"
              placeholder="Add ticker or paste a list (NVDA, AAPL, TSLA...)"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              maxlength="200"
            />
            <button class="roster-add-btn" id="rosterAddBtn" type="button">+ Add</button>
          </div>
          <div class="roster-error" id="rosterError"></div>

          <div class="roster-pills" id="rosterPills">
            <span class="roster-empty-hint">Add tickers above to build your Roster &#x2191;</span>
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
              <span id="stocksStatusText">Ready</span>
            </div>
            <button class="stocks-run-btn" id="stocksRunBtn" type="button" disabled title="Add tickers to The Roster first">&#x25B6; Run Deep Analysis</button>
          </div>
          <div class="stocks-market-badge" id="stocksMarketBadge"></div>
          <div class="stocks-signals-list" id="stocksSignalsList">
            <div class="stocks-empty">No signals yet. Build your Roster and run analysis.</div>
          </div>
        `}
      </div>
    `;

    if (!keysSet) {
      waitForKeysAndRerender();
    } else {
      initRosterUI().then(() => {
        bindRosterInput();
        bindRunBtn();
        updateMarketBadge();
        startSignalListener();
      });
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

  function bindRunBtn() {
    const runBtn = document.getElementById("stocksRunBtn");
    if (!runBtn) return;
    runBtn.addEventListener("click", async () => {
      if (__rosterTickers.length === 0) return;
      runBtn.disabled = true;
      runBtn.textContent = "\u23F3 Analyzing...";
      setStatus(`Running deep analysis on ${__rosterTickers.length} ticker${__rosterTickers.length !== 1 ? "s" : ""}...`, "active");
      try {
        const db = getDb();
        if (!db) { alert("Firestore not ready."); return; }
        const cfg = window.STOCKS_CONFIG || {};
        const col = cfg.CANDIDATES_COLLECTION || "stockCandidates";
        const batch = db.batch();
        __rosterTickers.forEach(ticker => {
          const ref = db.collection(col).doc(ticker);
          batch.set(ref, {
            ticker,
            source: "roster",
            tier2Processed: false,
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: false });
        });
        await batch.commit();
        setStatus(`Roster sent to analysis engine \u2014 signals incoming...`, "active");
      } catch (e) {
        console.error("[Stocks] Run error:", e);
        setStatus("Error starting analysis. Check console.", "error");
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "\u25B6 Run Deep Analysis";
        updateRunBtn();
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
      .limit(300)
      .onSnapshot((snapshot) => {
        const list = document.getElementById("stocksSignalsList");
        if (!list) return;
        if (snapshot.empty) {
          list.innerHTML = `<div class="stocks-empty">No signals yet. Build your Roster and run analysis.</div>`;
          return;
        }
        const allDocs = [], allSignals = [];
        snapshot.forEach(doc => { allDocs.push({ data: doc.data(), id: doc.id }); allSignals.push(doc.data()); });
        list.innerHTML = renderSessionGroups(allDocs, allSignals);
        bindGroupedInteractions(allSignals);
        const latestCount = allDocs.filter(({ data }) => sessionKey(data.generatedAt) === sessionKey(allDocs[0].data.generatedAt)).length;
        setStatus(`${latestCount} signal${latestCount !== 1 ? "s" : ""} in latest run`, "idle");
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
