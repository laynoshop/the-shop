// stocks/stocks-render.js
// Renders the Stocks tab UI:
//   - API key entry panel (first-time setup)
//   - Live signal cards from Firestore
//   - Screener run button + status

(function () {
  "use strict";

  // -----------------------------------------------------------
  // Direction color/icon helpers
  // -----------------------------------------------------------
  function directionBadge(direction) {
    const map = {
      BULLISH: { color: "#22c55e", icon: "▲", label: "BULLISH" },
      BEARISH: { color: "#ef4444", icon: "▼", label: "BEARISH" },
      NEUTRAL: { color: "#f59e0b", icon: "●", label: "NEUTRAL" }
    };
    return map[direction] || map.NEUTRAL;
  }

  function confidenceBadge(confidence) {
    const map = {
      HIGH:   { bg: "rgba(34,197,94,0.15)",  color: "#22c55e" },
      MEDIUM: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
      LOW:    { bg: "rgba(239,68,68,0.15)",  color: "#ef4444" }
    };
    return map[confidence] || map.MEDIUM;
  }

  function newsImpactBadge(impact) {
    const map = {
      POSITIVE: "🟢",
      NEGATIVE: "🔴",
      NEUTRAL:  "🟡",
      NONE:     "⚪"
    };
    return map[impact] || "⚪";
  }

  function fmtTime(ts) {
    if (!ts) return "--";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return "--"; }
  }

  // -----------------------------------------------------------
  // Render a single signal card
  // -----------------------------------------------------------
  function renderSignalCard(signal) {
    const dir  = directionBadge(signal.direction);
    const conf = confidenceBadge(signal.confidence);
    const newsIcon = newsImpactBadge(signal.news_impact);
    const changeSign = signal.changePct >= 0 ? "+" : "";

    return `
      <div class="stock-signal-card" data-direction="${signal.direction}">
        <div class="ssc-header">
          <div class="ssc-ticker">${signal.ticker}</div>
          <div class="ssc-direction" style="color:${dir.color}">${dir.icon} ${dir.label}</div>
          <div class="ssc-confidence" style="background:${conf.bg};color:${conf.color}">${signal.confidence}</div>
        </div>

        <div class="ssc-price-row">
          <span class="ssc-price">$${signal.price}</span>
          <span class="ssc-change" style="color:${signal.changePct >= 0 ? '#22c55e' : '#ef4444'}">${changeSign}${signal.changePct}%</span>
          <span class="ssc-type">${signal.signal_type}</span>
        </div>

        <div class="ssc-grid">
          <div class="ssc-cell">
            <div class="ssc-label">Entry Zone</div>
            <div class="ssc-val">${signal.entry_zone || "--"}</div>
          </div>
          <div class="ssc-cell">
            <div class="ssc-label">Target</div>
            <div class="ssc-val ssc-green">${signal.target || "--"}</div>
          </div>
          <div class="ssc-cell">
            <div class="ssc-label">Stop Loss</div>
            <div class="ssc-val ssc-red">${signal.stop_loss || "--"}</div>
          </div>
          <div class="ssc-cell">
            <div class="ssc-label">Risk/Reward</div>
            <div class="ssc-val">${signal.risk_reward || "--"}</div>
          </div>
        </div>

        <div class="ssc-reasoning">${signal.reasoning || ""}</div>

        <div class="ssc-footer">
          <span>${newsIcon} News: ${signal.newsHeadline ? signal.newsHeadline.substring(0, 60) + (signal.newsHeadline.length > 60 ? "..." : "") : "No news"}</span>
          <span class="ssc-time">${fmtTime(signal.generatedAt)}</span>
        </div>

        <div class="ssc-expires">${signal.expires_note || ""}</div>
      </div>
    `;
  }

  // -----------------------------------------------------------
  // API Key Setup Panel (shown on first visit)
  // -----------------------------------------------------------
  function renderKeySetupPanel() {
    return `
      <div class="stocks-setup-panel">
        <div class="stocks-setup-title">⚙️ Stocks Setup</div>
        <div class="stocks-setup-sub">Enter your API keys to activate the signal engine. Keys are stored in memory only — never saved to Firestore or GitHub.</div>

        <div class="stocks-key-row">
          <label class="stocks-key-label">Finnhub API Key</label>
          <input type="password" id="sKeyFinnhub" class="stocks-key-input" placeholder="Paste Finnhub key here" autocomplete="off" />
        </div>
        <div class="stocks-key-row">
          <label class="stocks-key-label">Alpha Vantage API Key</label>
          <input type="password" id="sKeyAlpha" class="stocks-key-input" placeholder="Paste Alpha Vantage key here" autocomplete="off" />
        </div>
        <div class="stocks-key-row">
          <label class="stocks-key-label">OpenAI API Key</label>
          <input type="password" id="sKeyOpenAI" class="stocks-key-input" placeholder="Paste OpenAI key here" autocomplete="off" />
        </div>

        <button class="stocks-save-keys-btn" id="stocksSaveKeys" type="button">Save Keys &amp; Start Engine</button>
      </div>
    `;
  }

  // -----------------------------------------------------------
  // Main Stocks Tab render
  // -----------------------------------------------------------
  function renderStocks() {
    const content = document.getElementById("content");
    if (!content) return;

    const keysSet = !!(window.__STOCKS_FINNHUB_KEY && window.__STOCKS_OPENAI_KEY);

    content.innerHTML = `
      <div class="stocks-wrap">

        <div class="stocks-header">
          <div class="stocks-title">📈 Stock Signals</div>
          <div class="stocks-subtitle">AI-powered Tier 1 + Tier 2 signal engine</div>
        </div>

        ${!keysSet ? renderKeySetupPanel() : ""}

        ${keysSet ? `
          <div class="stocks-controls">
            <div class="stocks-status" id="stocksStatus">
              <span class="stocks-status-dot" id="stocksDot"></span>
              <span id="stocksStatusText">Engine ready</span>
            </div>
            <button class="stocks-run-btn" id="stocksRunBtn" type="button">▶ Run Screener Now</button>
          </div>

          <div class="stocks-market-badge" id="stocksMarketBadge"></div>

          <div class="stocks-signals-list" id="stocksSignalsList">
            <div class="stocks-empty">No signals yet. Run the screener or wait for the next auto-scan.</div>
          </div>
        ` : ""}

      </div>
    `;

    if (!keysSet) {
      bindKeySetup();
    } else {
      bindControls();
      updateMarketBadge();
      startSignalListener();
    }
  }

  // -----------------------------------------------------------
  // Bind key setup form
  // -----------------------------------------------------------
  function bindKeySetup() {
    const btn = document.getElementById("stocksSaveKeys");
    if (!btn) return;

    btn.addEventListener("click", () => {
      const fk = (document.getElementById("sKeyFinnhub")?.value || "").trim();
      const ak = (document.getElementById("sKeyAlpha")?.value || "").trim();
      const ok = (document.getElementById("sKeyOpenAI")?.value || "").trim();

      if (!fk || !ok) {
        alert("Please enter at least your Finnhub and OpenAI keys to continue.");
        return;
      }

      // Store in memory only — never written to Firestore or localStorage
      window.__STOCKS_FINNHUB_KEY     = fk;
      window.__STOCKS_ALPHAVANTAGE_KEY = ak || null;
      window.__STOCKS_OPENAI_KEY      = ok;

      console.log("[Stocks] API keys saved to memory.");
      renderStocks(); // re-render with engine panel
    });
  }

  // -----------------------------------------------------------
  // Bind run button + controls
  // -----------------------------------------------------------
  function bindControls() {
    const runBtn = document.getElementById("stocksRunBtn");
    if (!runBtn) return;

    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      runBtn.textContent = "⏳ Scanning...";
      setStatus("Running Tier 1 screener...", "active");

      try {
        const db = getDb();
        if (!db) { alert("Firestore not ready. Try again in a moment."); return; }

        const candidates = await window.runTier1Screener(db);
        setStatus(`Tier 1 complete — ${candidates.length} candidate(s) flagged. Running AI analysis...`, "active");

        if (candidates.length === 0) {
          setStatus("No signals triggered. Markets may be quiet.", "idle");
        }
        // Tier 2 listener fires automatically via Firestore onSnapshot
      } catch (e) {
        console.error("[Stocks] Screener error:", e);
        setStatus("Error running screener. Check console.", "error");
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "▶ Run Screener Now";
      }
    });
  }

  // -----------------------------------------------------------
  // Listen to Firestore for new signal cards and render them
  // -----------------------------------------------------------
  let __signalListener = null;

  function startSignalListener() {
    if (__signalListener) { __signalListener(); __signalListener = null; }

    const db = getDb();
    if (!db) return;

    const cfg = window.STOCKS_CONFIG;

    // Also kick off Tier 2 listener
    if (typeof window.startTier2Listener === "function") {
      window.startTier2Listener(db);
    }

    __signalListener = db.collection(cfg.SIGNALS_COLLECTION)
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
        snapshot.forEach(doc => {
          cards.push(renderSignalCard(doc.data()));
        });

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
    const txt  = document.getElementById("stocksStatusText");
    const dot  = document.getElementById("stocksDot");
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
      ? `<span class="stocks-market-open">🟢 Market Open</span>`
      : `<span class="stocks-market-closed">🔴 Market Closed — Signals reflect last session</span>`;
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

  // Expose
  window.renderStocks = renderStocks;

  console.log("[Stocks] Render module loaded.");
})();
