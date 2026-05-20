// api/history.js
// Vercel serverless proxy — Yahoo Finance v8 chart (EOD daily, 3 months)
// Called by stocks-enrichment.js to compute RSI / SMA / EMA locally.
//
// Usage: GET /api/history?ticker=AAPL

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { ticker } = req.query;
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });

  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
      `?range=3mo&interval=1d&includePrePost=false`;

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "Yahoo upstream error", status: upstream.status });
    }

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("[history proxy] error:", err.message);
    return res.status(500).json({ error: "Proxy error", message: err.message });
  }
}
