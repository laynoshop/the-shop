function norm(s) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

// Tries to extract { team: "Ohio State", line: -6.5 } from strings like:
// "Ohio State -6.5", "Favored: Ohio State -6.5", "Ohio State -6", "Ohio State -6.0"
function parseSpreadText(spreadText) {
  const s = String(spreadText || "")
    .replace(/^favored:\s*/i, "")
    .replace(/^line:\s*/i, "")
    .trim();

  // Find last number in string (handles team names with spaces)
  const m = s.match(/(.+?)\s*([+-]?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;

  const team = m[1].trim();
  const num = Number(m[2]);
  if (!team || !Number.isFinite(num)) return null;

  // ESPN-style "Team -6.5" means that team is favored by 6.5
  return { team, line: num };
}

function pickDogTeam(home, away, favoredTeam) {
  const h = norm(home);
  const a = norm(away);
  const f = norm(favoredTeam);

  // Fuzzy match favored name to home/away
  const favIsHome = h && f && (h.includes(f) || f.includes(h));
  const favIsAway = a && f && (a.includes(f) || f.includes(a));

  if (favIsHome && !favIsAway) return away;
  if (favIsAway && !favIsHome) return home;

  // If we can't confidently match, return empty (model will likely Stay Away)
  return "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { home, away, spread, total } = req.body;

    // Build explicit spread choices
    const parsedSpread = parseSpreadText(spread);
    let favoritePick = "";
    let dogPick = "";

    if (parsedSpread) {
      const favTeam = parsedSpread.team;
      const lineAbs = Math.abs(parsedSpread.line);
      const dogTeam = pickDogTeam(home, away, favTeam);

      // If we can’t identify the dog team, we still provide a favorite pick,
      // but dogPick may be blank → model should lean “Stay Away”.
      favoritePick = `${favTeam} -${lineAbs}`;
      dogPick = dogTeam ? `${dogTeam} +${lineAbs}` : "";
    }

    const prompt = `
You are a sharp but disciplined sports betting analyst who prioritizes VALUE, not favorites.

Game:
Home Team: ${home}
Away Team: ${away}

Market (if available):
Spread input: ${spread || "None"}
Total input: ${total || "None"}

If a spread exists, here are the ONLY valid EDGE options you may choose from:
- "${favoritePick || "N/A"}"
- "${dogPick || "N/A"}"
- "Stay Away"

Rules (important):
- Do NOT default to the favorite. Favorites are only the edge when the price/number feels efficient.
- If the spread is large (>= 7), you should strongly consider the underdog or "Stay Away" unless you have a strong reason.
- If the spread is small (<= 3), either side can be the edge, but "Stay Away" is still acceptable.
- If you cannot confidently map the spread to a clear favorite/underdog, choose "Stay Away".
- For totals, you may set "lean" to "Over X" or "Under X" OR blank "" if no clear lean.
- Confidence must be a number between 5.0 and 9.0:
  - Use 5.0–6.2 for "Stay Away" or weak edges
  - Use 6.3–7.5 for moderate edges
  - Use 7.6–9.0 only for rare strong edges

Respond ONLY in valid JSON exactly:
{
  "edge": "...",
  "lean": "...",
  "confidence": number
}
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
          { role: "system", content: "You are a disciplined betting analyst. You do not always pick the favorite. You value the number." },
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
      // Conservative fallback
      parsed = {
        edge: "Stay Away",
        lean: total ? `Under ${total}` : "",
        confidence: 5.8
      };
    }

    // Hard guardrails so the UI never breaks
    const edge = String(parsed.edge || "Stay Away").slice(0, 80);
    const lean = String(parsed.lean || "").slice(0, 80);
    let conf = Number(parsed.confidence);
    if (!Number.isFinite(conf)) conf = 6.0;
    conf = Math.max(5.0, Math.min(9.0, conf));

    return res.status(200).json({ edge, lean, confidence: conf });

  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}