export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { home, away, spread, total } = req.body;

    const prompt = `
You are a sharp but disciplined sports betting analyst.

Game:
Home Team: ${home}
Away Team: ${away}
Spread: ${spread || "No spread"}
Total: ${total || "No total"}

Respond ONLY in valid JSON with:
{
  "edge": "...",
  "lean": "...",
  "confidence": number_between_5_and_9
}

Rules:
- If spread exists, choose either the favorite or underdog.
- If total exists, choose Over or Under.
- Confidence must be between 5.0 and 9.0.
- Be realistic, not extreme.
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional sports betting analyst." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", errText);
      return res.status(500).json({ error: "OpenAI request failed" });
    }

    const data = await openaiRes.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        edge: spread || "No line",
        lean: total ? `Under ${total}` : "",
        confidence: 6.5
      };
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}