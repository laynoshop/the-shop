// api/stocks-signal.js
// Vercel serverless function — GPT-4o with web_search_preview
// Replaces the Firebase stocksAISignal function.
// Called by stocks-signals.js with ticker + local technicals.
//
// POST /api/stocks-signal
// Body: { ticker, price, rsi14, sma20, sma50, ema20, rsiSignal }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    ticker   = "",
    price    = null,
    rsi14    = null,
    sma20    = null,
    sma50    = null,
    ema20    = null,
    rsiSignal = null
  } = req.body || {};

  if (!ticker) return res.status(400).json({ error: "Missing ticker" });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: "OpenAI key not configured" });

  const prompt = `
You are a professional stock analyst. Use your web search tool to look up CURRENT data for ${ticker} right now, then return a signal.

Search for:
1. Current analyst price targets and consensus (Buy/Hold/Sell)
2. Recent news in the last 7 days
3. Current P/E ratio and sector
4. Any earnings coming up in the next 30 days

Local technicals already computed (trust these numbers):
- Current Price: $${price ?? "unknown"}
- RSI(14): ${rsi14 ?? "N/A"} → ${rsiSignal ?? "N/A"}
- SMA20: $${sma20 ?? "N/A"} | SMA50: $${sma50 ?? "N/A"} | EMA20: $${ema20 ?? "N/A"}
- Price vs SMA20: ${price && sma20 ? (price > sma20 ? "ABOVE (bullish)" : "BELOW (bearish)") : "N/A"}

After searching, respond with ONLY valid JSON in this exact shape:
{
  "signal": "BUY" | "SELL" | "WATCH",
  "confidence": <0-100>,
  "summary": "2-3 sentences max, practical and specific",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "analystConsensus": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | null,
  "analystTargetMean": <number or null>,
  "analystUpsidePct": <number or null>,
  "sector": "<sector string or null>",
  "pe": <number or null>,
  "earningsDate": "<YYYY-MM-DD or null>",
  "newsHeadline": "<most impactful recent headline or null>"
}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        tools: [{ type: "web_search_preview" }],
        input: prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[stocks-signal] OpenAI error:", data);
      return res.status(500).json({ error: "OpenAI request failed", details: data });
    }

    // Extract text output from Responses API shape
    const outputText = data?.output
      ?.filter(o => o.type === "message")
      ?.flatMap(o => o.content)
      ?.filter(c => c.type === "output_text")
      ?.map(c => c.text)
      ?.join("") || "{}";

    // Strip markdown code fences if present
    const cleaned = outputText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[stocks-signal] JSON parse failed:", cleaned);
      return res.status(500).json({ error: "Invalid JSON from OpenAI", raw: cleaned });
    }

    return res.status(200).json({ ok: true, ticker, analysis: parsed });

  } catch (err) {
    console.error("[stocks-signal] Server error:", err.message);
    return res.status(500).json({ error: "Server error", message: err.message });
  }
}
