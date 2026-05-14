// stocks/stocks-signals.js
// TIER 2 — LLM Signal Reasoning
// Listens to Firestore for new Tier 1 candidates (tier2Processed: false)
// and calls the stocksAISignal Cloud Function to generate a structured signal card.
// The Cloud Function holds the OpenAI key in Secret Manager — key never touches the browser.

(function () {
  "use strict";

  // ============================================================
  // Cloud Function URL — key lives in Google Secret Manager
  // ============================================================
  const AI_SIGNAL_URL = "https://us-central1-the-shop-chat.cloudfunctions.net/stocksAISignal";

  let __tier2Listener = null;

  // -----------------------------------------------------------
  // Fetch latest news headline for a ticker from Finnhub
  // -----------------------------------------------------------
  async function fetchNewsHeadline(ticker) {
    try {
      const key = (window.STOCKS_CONFIG || {}).FINNHUB_KEY || "";
      if (!key) return "No recent news found.";

      const to   = new Date();
      const from = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48h
      const fmt  = d => d.toISOString().split("T")[0];

      const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`;
      const res = await fetch(url);
      if (!res.ok) return "No recent news found.";
      const articles = await res.json();
      if (!articles || !articles.length) return "No recent news found.";
      return articles[0].headline || "No recent news found.";
    } catch {
      return "No recent news found.";
    }
  }

  // -----------------------------------------------------------
  // Call the stocksAISignal Cloud Function (OpenAI key is server-side)
  // Returns parsed signal object or null
  // -----------------------------------------------------------
  async function callAISignal(candidate, newsHeadline) {
    try {
      const res = await fetch(AI_SIGNAL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker:      candidate.ticker,
          price:       candidate.price,
          rsi:         candidate.rsi,
          macd:        candidate.macdHist,
          macdSignal:  candidate.macdBullish !== undefined ? (candidate.macdBullish ? "bullish" : "bearish") : null,
          ema20:       candidate.ema20 || null,
          ema50:       candidate.ema50 || null,
          sentiment:   candidate.changePct || null,
          pe:          candidate.pe || null,
          earningsDate: candidate.earningsDate || "",
          newsHeadline
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[Stocks Tier2] Cloud Function error:", err);
        return null;
      }

      const data = await res.json();
      return data?.analysis || null;
    } catch (e) {
      console.error("[Stocks Tier2] callAISignal failed:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // Write the final signal card to Firestore
  // -----------------------------------------------------------
  async function writeSignalCard(db, candidate, signal, newsHeadline) {
    try {
      const cfg = window.STOCKS_CONFIG || {};

      const card = {
        ticker:      candidate.ticker,
        price:       candidate.price,
        changePct:   candidate.changePct,
        rsi:         candidate.rsi,
        macdCrossed: candidate.macdCrossed,
        newsHeadline,
        generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // LLM output fields:
        direction:    signal.signal   || signal.direction   || "NEUTRAL",
        confidence:   signal.confidence,
        signal_type:  signal.signal_type  || "",
        entry_zone:   signal.entry_zone   || "",
        target:       signal.target       || "",
        stop_loss:    signal.stop_loss    || "",
        risk_reward:  signal.risk_reward  || "",
        time_horizon: signal.time_horizon || "",
        reasoning:    signal.summary      || signal.reasoning || "",
        news_impact:  signal.news_impact  || "NONE",
        expires_note: signal.expires_note || ""
      };

      await db.collection(cfg.SIGNALS_COLLECTION || "stockSignals").add(card);

      await db.collection(cfg.CANDIDATES_COLLECTION || "stockCandidates").doc(candidate.ticker).update({
        tier2Processed: true
      });

      console.log(`[Stocks Tier2] \u2705 Signal card written: ${candidate.ticker} \u2014 ${card.direction} (${card.confidence})`);
    } catch (e) {
      console.error("[Stocks Tier2] writeSignalCard error:", e);
    }
  }

  // -----------------------------------------------------------
  // Process a single candidate through Tier 2
  // -----------------------------------------------------------
  async function processCandidateTier2(db, candidate) {
    console.log(`[Stocks Tier2] Processing: ${candidate.ticker}`);

    const newsHeadline = await fetchNewsHeadline(candidate.ticker);
    const signal       = await callAISignal(candidate, newsHeadline);

    if (!signal) {
      console.warn(`[Stocks Tier2] No signal returned for ${candidate.ticker}`);
      return;
    }

    await writeSignalCard(db, candidate, signal, newsHeadline);
  }

  // -----------------------------------------------------------
  // Start Tier 2 listener — watches Firestore for new candidates
  // Fires automatically when Tier 1 writes a candidate doc
  // -----------------------------------------------------------
  function startTier2Listener(db) {
    if (__tier2Listener) {
      __tier2Listener();
      __tier2Listener = null;
    }

    const cfg = window.STOCKS_CONFIG || {};
    console.log("[Stocks Tier2] Listener started \u2014 watching for new candidates...");

    __tier2Listener = db
      .collection(cfg.CANDIDATES_COLLECTION || "stockCandidates")
      .where("tier2Processed", "==", false)
      .onSnapshot(async (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            if (!data.tier2Processed) {
              await processCandidateTier2(db, data);
            }
          }
        }
      }, (err) => {
        console.error("[Stocks Tier2] Listener error:", err);
      });
  }

  function stopTier2Listener() {
    if (__tier2Listener) {
      __tier2Listener();
      __tier2Listener = null;
      console.log("[Stocks Tier2] Listener stopped.");
    }
  }

  // Expose
  window.startTier2Listener    = startTier2Listener;
  window.stopTier2Listener     = stopTier2Listener;
  window.processCandidateTier2 = processCandidateTier2;

  console.log("[Stocks] Signals (Tier2) module loaded.");
})();
