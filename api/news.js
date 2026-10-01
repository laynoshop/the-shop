// api/news.js
// Vercel serverless proxy for the Top News tab — merges ESPN's Ohio State
// team feed, general ESPN news, ESPN's league-wide NFL feed, ESPN's
// Carolina Panthers team feed, Eleven Warriors' RSS, and (best-effort)
// Cat Scratch Reader's Panthers RSS, all server-side. Fetching each of
// these happens machine-to-machine here, so none of it is subject to
// browser CORS the way the old client-side implementation was — that's
// what made the Eleven Warriors feed (an actual Buckeye-specific source)
// silently drop out whenever the public CORS-proxy fallbacks it depended
// on (allorigins.win / rss2json.com) were slow, rate-limited, or down.
//
// Usage: GET /api/news

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=900");

  try {
    const [osu, panthersTeam, ew, panthersBlog, nfl, general] = await Promise.allSettled([
      fetchOSU(),
      fetchPanthersFeed(),
      fetchElevenWarriors(),
      fetchPanthersBlog(),
      fetchNFLFeed(),
      fetchGeneralESPN(),
    ]);
    // Order matters: the client dedupes by link/headline and keeps the
    // FIRST occurrence of each story. Team-specific, correctly-flagged
    // sources go first so a story that's also picked up by a broader feed
    // (league-wide NFL, general cross-sport ESPN) keeps its specific
    // source/tags instead of losing them to a generic duplicate.
    const items = [
      ...(osu.status === "fulfilled" ? osu.value : []),
      ...(panthersTeam.status === "fulfilled" ? panthersTeam.value : []),
      ...(ew.status === "fulfilled" ? ew.value : []),
      ...(panthersBlog.status === "fulfilled" ? panthersBlog.value : []),
      ...(nfl.status === "fulfilled" ? nfl.value : []),
      ...(general.status === "fulfilled" ? general.value : []),
    ];
    if (!items.length) {
      return res.status(502).json({ error: "All news sources failed" });
    }
    return res.status(200).json({ items });
  } catch (err) {
    console.error("[news proxy] error:", err.message);
    return res.status(500).json({ error: "News proxy error", message: err.message });
  }
}

async function fetchJson(url, ms = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url, ms = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

function pickImg(a) {
  const c = [];
  if (Array.isArray(a?.images)) a.images.forEach((im) => { if (im?.url) c.push(im.url); if (im?.href) c.push(im.href); });
  [a?.image?.url, a?.image?.href, a?.thumbnail, a?.promoImage].forEach((u) => { if (u) c.push(u); });
  return c.filter(Boolean).find((u) => u.startsWith("https://")) || c[0] || "";
}

function normEspnArticle(a, source) {
  const ts = Date.parse(a?.published || a?.publishedAt || "");
  return {
    headline: String(a?.headline || a?.title || ""),
    description: String(a?.description || a?.summary || ""),
    source,
    publishedIso: a?.published || "",
    publishedTs: Number.isFinite(ts) ? ts : 0,
    link: a?.links?.web?.href || a?.links?.[0]?.href || a?.url || "",
    imageUrl: pickImg(a),
  };
}

async function fetchOSU() {
  for (const url of [
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?team=194&limit=20",
    "https://site.api.espn.com/apis/v2/sports/football/college-football/news?team=194&limit=20&lang=en&region=us",
  ]) {
    try {
      const data = await fetchJson(url);
      const articles = Array.isArray(data?.articles) ? data.articles : [];
      if (articles.length) {
        return articles
          .map((a) => ({ ...normEspnArticle(a, "ESPN · OSU"), osuFeed: true }))
          .filter((x) => x.headline);
      }
    } catch {}
  }
  return [];
}

// League-wide NFL headlines — not team-scoped, so the "NFL" filter
// always has something reliable instead of depending on whatever
// happens to be in the broad cross-sport general feed that day.
async function fetchNFLFeed() {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=20");
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles
      .map((a) => ({ ...normEspnArticle(a, "ESPN · NFL"), nflFeed: true }))
      .filter((x) => x.headline);
  } catch {}
  return [];
}

// ESPN's Carolina Panthers team feed — team id 29, same pattern as the
// Ohio State team feed above.
async function fetchPanthersFeed() {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?team=29&limit=20");
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles
      .map((a) => ({ ...normEspnArticle(a, "ESPN · Panthers"), nflFeed: true, panthersFeed: true }))
      .filter((x) => x.headline);
  } catch {}
  return [];
}

// Best-effort second Panthers source — Cat Scratch Reader (SB Nation's
// Carolina Panthers site) publishes RSS at the standard Vox Media/SB
// Nation path. Unverified live from this dev environment (outbound
// fetches to arbitrary domains are proxy-blocked here — see PR notes);
// if SB Nation ever moves this path, it just silently contributes zero
// items via the same Promise.allSettled every other source already
// degrades through, so a wrong URL here can't break anything else.
async function fetchPanthersBlog() {
  try {
    const xml = await fetchText("https://www.catscratchreader.com/rss/current.xml");
    const items = parseRss(xml, "Cat Scratch Reader").map((it) => ({ ...it, panthersFeed: true }));
    if (items.length) return items;
  } catch {}
  return [];
}

async function fetchGeneralESPN() {
  for (const url of [
    "https://site.api.espn.com/apis/v2/sports/news?limit=50",
    "https://site.api.espn.com/apis/site/v2/sports/news?limit=50",
    "https://site.api.espn.com/apis/v2/sports/news?limit=50&lang=en&region=us",
  ]) {
    try {
      const data = await fetchJson(url);
      const articles = Array.isArray(data?.articles) ? data.articles : [];
      if (articles.length) {
        return articles.map((a) => normEspnArticle(a, "ESPN")).filter((x) => x.headline);
      }
    } catch {}
  }
  return [];
}

// ---- Minimal RSS <item> extractor — no DOMParser in the Node runtime,
// and this feed's shape is simple enough not to need a full XML parser. ----
function matchTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}
function matchSelfClosingAttr(block, tag, attr) {
  const m = block.match(new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*/?>`, "i"));
  return m ? m[1] : "";
}
function stripHtml(s) {
  return String(s || "").replace(/<[^>]*>/g, "").trim();
}

function parseRss(xml, source) {
  const items = [];
  const blocks = String(xml || "").split(/<item[\s>]/i).slice(1);
  for (const raw of blocks) {
    const block = `<item ${raw.split(/<\/item>/i)[0]}</item>`;
    const title = matchTag(block, "title");
    if (!title) continue;
    const link = matchTag(block, "link");
    const desc = stripHtml(matchTag(block, "description"));
    const pub = matchTag(block, "pubDate");
    const ts = Date.parse(pub);
    const img =
      matchSelfClosingAttr(block, "enclosure", "url") ||
      matchSelfClosingAttr(block, "media:content", "url") ||
      matchSelfClosingAttr(block, "media:thumbnail", "url");
    items.push({
      headline: title,
      description: desc,
      source,
      publishedIso: pub,
      publishedTs: Number.isFinite(ts) ? ts : 0,
      link: link || "",
      imageUrl: img || "",
    });
  }
  return items.slice(0, 20);
}

async function fetchElevenWarriors() {
  try {
    const xml = await fetchText("https://www.elevenwarriors.com/rss.xml");
    const items = parseRss(xml, "Eleven Warriors").map((it) => ({ ...it, osuFeed: true }));
    if (items.length) return items;
  } catch {}
  return [];
}
