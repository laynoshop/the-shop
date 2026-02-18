export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Accept multiple possible field names (so your frontend doesn't have to be perfect yet)
    const body = req.body || {};

    const home = String(body.home || body.homeName || "").trim();
    const away = String(body.away || body.awayName || "").trim();

    // "favored" might look like "WVU -10.5" or "Favored: WVU -10.5"
    const favoredRaw = String(
      body.favored ?? body.favoredText ?? body.spread ?? body.line ?? ""
    ).trim();

    const totalRaw = String(
      body.total ?? body.ou ?? body.ouText ?? body.overUnder ?? ""
    ).trim();

    // Parse favored team + number from strings like:
    // "WVU -10.5", "Favored: WVU -10.5", "Ohio State -3"
    function parseFavored(str) {
      const s = str.replace(/^Favored:\s*/i, "").trim();
      if (!s) return { team: "", num: null };

      // Try: "<team> -10.5"
      const m = s.match(/^(.*?)[\s]*([+-]\d+(\.\d+)?)$/);
      if (m) {
        const team = String(m[1] || "").trim();
        const num = Number(m[2]);
        return { team, num: Number.isFinite(num) ? num : null };
      }

      return { team: s, num: null };
    }

    function parseTotal(str) {
      const s = str.replace(/^(O\/U:|Total:|O-U:)\s*/i, "").trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }

    // Simple deterministic "hash" so confidence varies by matchup/line
    function hashString(input) {
      let h = 2166136261;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      // 0..1
      return (h >>> 0) / 4294967295;
    }

    const fav = parseFavored(favoredRaw);
    const totalNum = parseTotal(totalRaw);

    // If no line, return a real "no data" response (not identical across games)
    if (!favoredRaw && !totalRaw) {
      const r = hashString(`${home}|${away}`);
      const confidence = Number((4.6 + r * 1.4).toFixed(1)); // 4.6..6.0
      return res.status(200).json({
        edge: "No line",
        lean: "",
        confidence,
        meta: { received: { home, away, favoredRaw, totalRaw } }
      });
    }

    // Decide a side edge: sometimes fade small favorites, sometimes ride big favorites
    // (Pure heuristic to avoid "favorite every time")
    let edge = "No line";
    if (fav.team) {
      const abs = fav.num === null ? null : Math.abs(fav.num);
      const r = hashString(`${home}|${away}|${favoredRaw}|${totalRaw}`);

      if (abs === null) {
        edge = fav.team; // if we only have the team name
      } else {
        // If it's a small spread, ~55% chance we take the underdog (flip)
        // If big spread, more likely take favorite
        const flipChance = abs <= 3 ? 0.55 : abs <= 7 ? 0.40 : 0.25;
        const takeUnderdog = r < flipChance;

        if (takeUnderdog) {
          // If favored is "Team -x", underdog is the other team
          const underdog = fav.team.toLowerCase().includes(home.toLowerCase())
            ? away
            : fav.team.toLowerCase().includes(away.toLowerCase())
              ? home
              : ""; // unknown

          edge = underdog ? `${underdog} +${abs}` : "No line";
        } else {
          edge = `${fav.team} -${abs}`;
        }
      }
    }

    // Lean: if total exists, pick Over/Under based on a stable but varying rule
    let lean = "";
    if (Number.isFinite(totalNum)) {
      const r2 = hashString(`${home}|${away}|total:${totalNum}`);
      const pickUnder = r2 < 0.5;
      lean = `${pickUnder ? "Under" : "Over"} ${totalNum}`;
    }

    // Confidence: vary by how "strong" the line is + stable randomness
    const base = hashString(`${home}|${away}|${favoredRaw}|${totalRaw}`);
    const spreadStrength =
      fav.num === null ? 0 : Math.min(1, Math.abs(fav.num) / 14); // 0..1
    const totalStrength =
      totalNum === null ? 0 : Math.min(1, Math.abs(totalNum - 140) / 40); // 0..1-ish

    // 5.0..8.8-ish
    const conf =
      5.0 +
      (spreadStrength * 2.0) +
      (totalStrength * 0.8) +
      (base * 1.0);

    const confidence = Number(Math.max(4.8, Math.min(9.2, conf)).toFixed(1));

    return res.status(200).json({
      edge,
      lean,
      confidence,
      meta: {
        received: { home, away, favoredRaw, totalRaw },
        parsed: { favoredTeam: fav.team, favoredNum: fav.num, totalNum }
      }
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}