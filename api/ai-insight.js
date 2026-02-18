export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { home, away, spread, total } = req.body;

    // For now, just return dummy data so we confirm it's working
    return res.status(200).json({
      edge: spread || "No line",
      lean: total ? `Under ${total}` : "",
      confidence: 6.2
    });

  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}