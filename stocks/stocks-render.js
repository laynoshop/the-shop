// stocks/stocks-render.js
// Renders the Stocks tab UI.
// Keys come from window.STOCKS_CONFIG (loaded by stocks-init.js via Remote Config).
// No manual key entry panel — keys are managed in Firebase Remote Config.

(function () {
  "use strict";

  // -----------------------------------------------------------
  // Direction color/icon helpers
  // Handles both LLM output styles:
  //   BULLISH / BEARISH / NEUTRAL  (preferred)
  //   BUY     / SELL    / HOLD     (alternate LLM phrasing)
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

  // Confidence: handle both string (HIGH/MEDIUM/LOW) and numeric (0-100)
  function renderConfidence(confidence) {
    if (confidence === null || confidence === undefined) return { label: "--", bg: "rgba(156,163,175,0.12)", color: "rgba(255,255,255,0.45)" };

    // Numeric confidence (e.g. 75)
    if (!isNaN(Number(confidence))) {
      const n = Number(confidence);
      if (n >= 70) return { label: n + "%", bg: "rgba(34,197,94,0.15)",  color: "#22c55e" };
      if (n >= 45) return { label: n + "%", bg: "rgba(245,158,11,0.15)", color: "#f59e0b" };
      return             { label: n + "%", bg: "rgba(239,68,68,0.15)",  color: "#ef4444" };
    }

    // String confidence
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

  function fmtTime(ts) {
    if (!ts) return "--";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return "--"; }
  }

  // -----------------------------------------------------------
  // Field alias resolver
  // The LLM may return slightly different key names — try them all.
  // -----------------------------------------------------------
  function field(signal, ...keys) {
    for (const k of keys) {
      const v = signal[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return "--";
  }

  // -----------------------------------------------------------
  // Render a single signal card
  // -----------------------------------------------------------
  function renderSignalCard(signal) {
    const rawDir   = signal.direction || signal.signal || "NEUTRAL";
    const normDir  = normalizeDirection(rawDir);
    const dir      = directionBadge(normDir);
    const conf     = renderConfidence(signal.confidence);
    const newsIcon = newsImpactBadge(signal.news_impact);
    const changeSign = (signal.changePct || 0) >= 0 ? "+" : "";

    // Grid values — try every alias the LLM might return
    const entryZone  = field(signal, "entry_zone",  "entry",      "entryZone",  "entry_price");
    const target     = field(signal, "target",      "take_profit", "takeProfit", "target_price");
    const stopLoss   = field(signal, "stop_loss",   "stopLoss",   "stop",       "stop_price");
    const riskReward = field(signal, "risk_reward", "riskReward", "r_r",        "rr");

    // News: full headline, clickable if URL is available
    const headline   = signal.newsHeadline || "No recent news";
    const newsUrl    = signal.newsUrl || signal.news_url || "";
    const newsHtml   = newsUrl
      ? `<a href="${newsUrl}" target="_blank" rel="noopener noreferrer" class="ssc-news-link">${newsIcon} ${headline}</a>`
      : `<span class="ssc-news-plain">${newsIcon} ${headline}</span>`;

    return `
      <div class="stock-signal-card" data-direction="${normDir}">
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
          <div class="ssc-cell">
            <div class="ssc-label">Entry Zone</div>
            <div class="ssc-val">${entryZone}</div>
          </div>
          <div class="ssc-cell">
            <div class="ssc-label">Target</div>
            <div class="ssc-val ssc-green">${target}</div>
          </div>
          <div class="ssc-cell">
            <div class="ssc-label">Stop Loss</div>
            <div class="ssc-val ssc-red">${stopLoss}</div>
          </div>
          <div class="ssc-cell">
            <div class="ssc-label">Risk / Reward</div>
            <div class="ssc-val">${riskReward}</div>
          </div>
        </div>

        <div class="ssc-reasoning">${field(signal, "reasoning", "summary", "analysis", "reason")}</div>

        <div class="ssc-footer">
          <div class="ssc-news">${newsHtml}</div>
          <span class="ssc-time">${fmtTime(signal.generatedAt)}</span>
        </div>

        ${signal.expires_note ? `<div class="ssc-expires">${signal.expires_note}</div>` : ""}
      </div>
    `;
  }

  // -----------------------------------------------------------
  // Loading skeleton shown while keys are fetching
  // -----------------------------------------------------------
  function renderLoadingSkeleton() {
    return `
      <div class="stocks-loading">
        <div class="stocks-loading-dot"></div>
        <div class="stocks-loading-dot"></div>
        <div class="stocks-loading-dot"></div>
        <div class="stocks-loading-text">Loading stock engine\u2026</div>
      </div>
    `;
  }

  // -----------------------------------------------------------
  // Main Stocks Tab render
  // -----------------------------------------------------------
  function renderStocks() {
    const content = document.getElementById("content");
    if (!content) return;

    const cfg     = window.STOCKS_CONFIG || {};
    const keysSet = !!(cfg.FINNHUB_KEY && cfg.FMP_KEY);

    content.innerHTML = `
      <div class="stocks-wrap">

        <div class="stocks-header">
          <div class="stocks-title">\uD83D\uDCC8 Stock Signals</div>
          <div class="stocks-subtitle">AI-powered Tier 1 + Tier 2 signal engine</div>
        </div>

        ${!keysSet ? renderLoadingSkeleton() : `
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

    if (!keysSet) {
      waitForKeysAndRerender();
    } else {
      bindControls();
      updateMarketBadge();
      startSignalListener();
    }
  }

  // -----------------------------------------------------------
  // Poll until Remote Config keys are loaded, then re-render
  // -----------------------------------------------------------
  function waitForKeysAndRerender() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const cfg = window.STOCKS_CONFIG || {};
      if (cfg.FINNHUB_KEY && cfg.FMP_KEY) {
        clearInterval(t);
        renderStocks();
        return;
      }
      if (tries > 60) {
        clearInterval(t);
        const content = document.getElementById("content");
        if (content) content.innerHTML = `<div class="stocks-wrap"><div class="notice">\u26A0\uFE0F Could not load stock engine keys. Check Firebase Remote Config.</div></div>`;
      }
    }, 500);
  }

  // -----------------------------------------------------------
  // Bind run button + controls
  // -----------------------------------------------------------
  function bindControls() {
    const runBtn = document.getElementById("stocksRunBtn");
    if (!runBtn) return;

    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      runBtn.textContent = "\u23F3 Scanning...";
      setStatus("Running Tier 1 screener...", "active");

      try {
        const db = getDb();
        if (!db) { alert("Firestore not ready. Try again in a moment."); return; }

        const candidates = await window.runTier1Screener(db);
        setStatus(`Tier 1 complete \u2014 ${candidates.length} candidate(s) flagged. Running AI analysis...`, "active");

        if (candidates.length === 0) {
          setStatus("No signals triggered. Markets may be quiet.", "idle");
        }
      } catch (e) {
        console.error("[Stocks] Screener error:", e);
        setStatus("Error running screener. Check console.", "error");
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "\u25B6 Run Screener Now";
      }
    });
  }

  // -----------------------------------------------------------
  // Listen to Firestore for new signal cards
  // -----------------------------------------------------------
  let __signalListener = null;

  function startSignalListener() {
    if (__signalListener) { __signalListener(); __signalListener = null; }

    const db = getDb();
    if (!db) return;

    const cfg = window.STOCKS_CONFIG || {};

    if (typeof window.startTier2Listener === "function") {
      window.startTier2Listener(db);
    }

    __signalListener = db
      .collection(cfg.SIGNALS_COLLECTION || "stockSignals")
      .orderBy("generatedAt", "desc")
      .limit(50)
      .onSnapshot((snapshot) => {
        const list = document.getElementById("stocksSignalsList");
        if (!list) return;

        if (snapshot.empty) {
          list.innerHTML = `<div class="stocks-empty">No signals yet. Run the screener or wait for the next auto-scan.</div>`;
          return;
        }

        const cards = [];
        snapshot.forEach(doc => cards.push(renderSignalCard(doc.data())));
        list.innerHTML = cards.join("");
        setStatus(`${cards.length} active signal(s)`, "idle");
      }, (err) => {
        console.error("[Stocks] Signal listener error:", err);
      });
  }

  // -----------------------------------------------------------
  // Status bar helper
  // -----------------------------------------------------------
  function setStatus(msg, state) {
    const txt = document.getElementById("stocksStatusText");
    const dot = document.getElementById("stocksDot");
    if (txt) txt.textContent = msg;
    if (dot) dot.className = "stocks-status-dot" + (state ? " stocks-dot-" + state : "");
  }

  // -----------------------------------------------------------
  // Market open/closed badge
  // -----------------------------------------------------------
  function updateMarketBadge() {
    const badge = document.getElementById("stocksMarketBadge");
    if (!badge) return;
    const open = typeof window.isMarketOpen === "function" ? window.isMarketOpen() : false;
    badge.innerHTML = open
      ? `<span class="stocks-market-open">\uD83D\uDFE2 Market Open</span>`
      : `<span class="stocks-market-closed">\uD83D\uDD34 Market Closed \u2014 Signals reflect last session</span>`;
  }

  // -----------------------------------------------------------
  // Get Firestore db instance
  // -----------------------------------------------------------
  function getDb() {
    try {
      if (window.firebase && window.firebase.firestore) {
        return window.firebase.firestore();
      }
    } catch {}
    return null;
  }

  window.renderStocks = renderStocks;

  console.log("[Stocks] Render module loaded.");
})();
