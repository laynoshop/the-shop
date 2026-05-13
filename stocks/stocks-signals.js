// stocks/stocks-signals.js
// TIER 2 — LLM Signal Reasoning
// Listens to Firestore for new Tier 1 candidates (tier2Processed: false)
// and calls OpenAI to generate a structured signal card.
// In production, this Firestore trigger runs as a Cloud Function.
// For testing, this file polls Firestore from the browser.

(function () {
  "use strict";

  let __tier2Listener = null;

  // -----------------------------------------------------------
  // Fetch latest news headline for a ticker from Finnhub
  // -----------------------------------------------------------
  async function fetchNewsHeadline(ticker) {
    try {
      const key = window.__STOCKS_FINNHUB_KEY;
      if (!key) return "No recent news found.";

      const to   = new Date();
      const from = new Date(Date.now() - 48 * 60 * 60 * 1000); // last 48h
      const fmt  = d => d.toISOString().split("T")[0];

      const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`;
      const res = await fetch(url);
      if (!res.ok) return "No recent news found.";
      const articles = await res.json();
      if (!articles || !articles.length) return "No recent news found.";
      // Return the most recent headline
      return articles[0].headline || "No recent news found.";
    } catch {
      return "No recent news found.";
    }
  }

  // -----------------------------------------------------------
  // Build the prompt we send to OpenAI
  // -----------------------------------------------------------
  function buildPrompt(candidate, newsHeadline) {
    const dir = candidate.changePct >= 0 ? "up" : "down";
    const rsiNote = candidate.rsi !== null
      ? `RSI: ${candidate.rsi} (${candidate.rsi > 70 ? "overbought" : candidate.rsi < 30 ? "oversold" : "neutral"})`
      : "RSI: unavailable";
    const macdNote = candidate.macdCrossed
      ? `MACD: ${candidate.macdBullish ? "Bullish" : "Bearish"} crossover detected (histogram: ${candidate.macdHist})`
      : "MACD: No crossover";

    return `You are a professional stock trading analyst focused on short-term day trading opportunities.

Analyze the following real-time market data and generate a structured signal report.

--- MARKET DATA ---
Ticker: ${candidate.ticker}
Current Price: $${candidate.price}
Previous Close: $${candidate.prevClose}
Price Change: ${candidate.changePct > 0 ? "+" : ""}${candidate.changePct}% (${dir})
${rsiNote}
${macdNote}
Latest News: "${newsHeadline}"

--- YOUR TASK ---
Respond ONLY with a valid JSON object (no markdown, no code blocks, just raw JSON) in this exact format:

{
  "direction": "BULLISH" | "BEARISH" | "NEUTRAL",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "signal_type": "Momentum Breakout" | "Oversold Bounce" | "MACD Crossover" | "News Catalyst" | "Overbought Reversal" | "Bearish Breakdown",
  "entry_zone": "string (e.g. $168.20 - $168.80)",
  "target": "string (e.g. $171.50 — +1.9%)",
  "stop_loss": "string (e.g. $166.90 — -0.8%)",
  "risk_reward": "string (e.g. 2.4:1)",
  "time_horizon": "string (e.g. Same session, 2-4 hours)",
  "reasoning": "2-3 sentence plain English analysis of why this signal fired and what to watch for.",
  "news_impact": "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "NONE",
  "expires_note": "string (e.g. Signal valid until market close or reversal)"
}

Only output the JSON. No other text.`;
  }

  // -----------------------------------------------------------
  // Call OpenAI API
  // Returns parsed signal object or null
  // -----------------------------------------------------------
  async function callOpenAI(prompt) {
    try {
      const key = window.__STOCKS_OPENAI_KEY;
      if (!key) { console.warn("[Stocks Tier2] OpenAI key not set."); return null; }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + key,
          "Content-Type":  "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[Stocks Tier2] OpenAI error:", err);
        return null;
      }

      const data = await res.json();
      const raw  = data?.choices?.[0]?.message?.content || "";

      // Parse the JSON response
      const signal = JSON.parse(raw.trim());
      return signal;
    } catch (e) {
      console.error("[Stocks Tier2] callOpenAI failed:", e);
      return null;
    }
  }

  // -----------------------------------------------------------
  // Write the final signal card to Firestore
  // -----------------------------------------------------------
  async function writeSignalCard(db, candidate, signal, newsHeadline) {
    try {
      const cfg = window.STOCKS_CONFIG;

      const card = {
        ticker:      candidate.ticker,
        price:       candidate.price,
        changePct:   candidate.changePct,
        rsi:         candidate.rsi,
        macdCrossed: candidate.macdCrossed,
        newsHeadline,
        generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        // LLM output fields:
        direction:    signal.direction,
        confidence:   signal.confidence,
        signal_type:  signal.signal_type,
        entry_zone:   signal.entry_zone,
        target:       signal.target,
        stop_loss:    signal.stop_loss,
        risk_reward:  signal.risk_reward,
        time_horizon: signal.time_horizon,
        reasoning:    signal.reasoning,
        news_impact:  signal.news_impact,
        expires_note: signal.expires_note
      };

      // Write signal card
      await db.collection(cfg.SIGNALS_COLLECTION).add(card);

      // Mark candidate as processed so we don't re-run it
      await db.collection(cfg.CANDIDATES_COLLECTION).doc(candidate.ticker).update({
        tier2Processed: true
      });

      console.log(`[Stocks Tier2] ✅ Signal card written: ${candidate.ticker} — ${signal.direction} (${signal.confidence})`);
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
    const prompt       = buildPrompt(candidate, newsHeadline);
    const signal       = await callOpenAI(prompt);

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
      __tier2Listener(); // unsubscribe existing
      __tier2Listener = null;
    }

    const cfg = window.STOCKS_CONFIG;

    console.log("[Stocks Tier2] Listener started — watching for new candidates...");

    __tier2Listener = db.collection(cfg.CANDIDATES_COLLECTION)
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
