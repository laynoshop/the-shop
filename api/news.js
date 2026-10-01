// api/news.js
// Vercel serverless proxy for the Top News tab — merges ESPN's Ohio State
// team feed, ESPN's Carolina Panthers team feed, ESPN's general
// college-football feed, ESPN's league-wide NFL feed, general ESPN news,
// and RSS from Eleven Warriors / Buckeyes Wire (Buckeyes) and Cat Scratch
// Reader / Panthers Wire (Panthers), all server-side. Fetching each of
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
    const [osu, buckeyesWire, panthersTeam, panthersWire, ew, panthersBlog, cfb, nfl, general] =
      await Promise.allSettled([
        fetchOSU(),
        fetchBuckeyesWire(),
        fetchPanthersFeed(),
        fetchPanthersWire(),
        fetchElevenWarriors(),
        fetchPanthersBlog(),
        fetchCFBFeed(),
        fetchNFLFeed(),
        fetchGeneralESPN(),
      ]);
    // Order matters: the client dedupes by link/headline and keeps the
    // FIRST occurrence of each story. Team-specific, correctly-flagged
    // sources go first so a story that's also picked up by a broader feed
    // (league-wide CFB/NFL, general cross-sport ESPN) keeps its specific
    // source/tags instead of losing them to a generic duplicate.
    const items = [
      ...(osu.status === "fulfilled" ? osu.value : []),
      ...(buckeyesWire.status === "fulfilled" ? buckeyesWire.value : []),
      ...(panthersTeam.status === "fulfilled" ? panthersTeam.value : []),
      ...(panthersWire.status === "fulfilled" ? panthersWire.value : []),
      ...(ew.status === "fulfilled" ? ew.value : []),
      ...(panthersBlog.status === "fulfilled" ? panthersBlog.value : []),
      ...(cfb.status === "fulfilled" ? cfb.value : []),
      ...(nfl.status === "fulfilled" ? nfl.value : []),
      ...(general.status === "fulfilled" ? general.value : []),
    ];
    if (!items.length) {
      // A transient all-sources failure (e.g. ESPN rate-limiting a burst of
      // simultaneous requests) must never get cached — the s-maxage/SWR
      // header above would otherwise lock every visitor into seeing this
      // same failure for up to 15 minutes, long after a retry would have
      // succeeded.
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({ error: "All news sources failed" });
    }

    // Nothing older than 3 days, for any source/filter. Items with no
    // parseable date are kept rather than hidden — we can't confirm
    // they're stale, and dropping them would just be guessing.
    const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - RECENT_WINDOW_MS;
    const recent = items.filter((it) => !it.publishedTs || it.publishedTs >= cutoff);

    if (!recent.length) {
      // Same reasoning: don't let a "nothing in the last 3 days" moment —
      // which should be rare but isn't impossible — get cached and replayed
      // to every subsequent request for the next 15 minutes.
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({ error: "No news within the recency window" });
    }

    return res.status(200).json({ items: recent });
  } catch (err) {
    console.error("[news proxy] error:", err.message);
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: "News proxy error", message: err.message });
  }
}

// IMPORTANT: fetchJson (ESPN's API) deliberately keeps the plain
// "Mozilla/5.0" UA it always used — that combination was proven working
// in production (NFL/Panthers ESPN content was loading fine). A prior
// change switched it to a full desktop Chrome UA to try to help the RSS
// sources below, and that appears to have backfired for ESPN specifically:
// a full browser UA arriving from a cloud/datacenter IP (Vercel's) is a
// well-known bot-detection heuristic for WAFs like Akamai (which fronts
// ESPN) — real browsers don't browse from AWS/GCP ranges, so pairing a
// convincing browser UA with a datacenter IP can read as MORE suspicious
// than a generic one, not less. That change broke every ESPN source
// (OSU, CFB, NFL, Panthers, general) at once, which is worse than the RSS
// problem it was meant to fix. Only fetchText (the actual RSS hosts) gets
// the fuller UA now — those sources were already failing either way, so
// there's no working baseline there to regress.
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

async function fetchText(url, ms = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

// Tries each candidate RSS URL in order, returns the first one that
// yields items. Used for sources where the exact feed path couldn't be
// verified live from this environment, so a wrong guess just falls
// through to the next candidate instead of silently returning nothing.
async function fetchRssFromAny(urls, source, forcedFlags) {
  for (const url of urls) {
    try {
      const xml = await fetchText(url);
      const items = parseRss(xml, source).map((it) => ({ ...it, ...forcedFlags }));
      if (items.length) return items;
    } catch {}
  }
  return [];
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
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?team=194&limit=40",
    "https://site.api.espn.com/apis/v2/sports/football/college-football/news?team=194&limit=40&lang=en&region=us",
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

// General (non-team-scoped) college-football headlines, so the "CFB"
// filter has a real pool of its own instead of relying on CFB stories
// coincidentally turning up in the generic cross-sport feed.
async function fetchCFBFeed() {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?limit=40");
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles
      .map((a) => ({ ...normEspnArticle(a, "ESPN · CFB"), cfbFeed: true }))
      .filter((x) => x.headline);
  } catch {}
  return [];
}

// League-wide NFL headlines — not team-scoped, so the "NFL" filter
// always has something reliable instead of depending on whatever
// happens to be in the broad cross-sport general feed that day.
async function fetchNFLFeed() {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=40");
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
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?team=29&limit=40");
    const articles = Array.isArray(data?.articles) ? data.articles : [];
    return articles
      .map((a) => ({ ...normEspnArticle(a, "ESPN · Panthers"), nflFeed: true, panthersFeed: true }))
      .filter((x) => x.headline);
  } catch {}
  return [];
}

// Second Buckeyes-specific source — Buckeyes Wire (USA Today Sports
// Media Group's Ohio State site) is a standard WordPress site on the
// same "Wire" network as every other USA Today team site, so it exposes
// RSS at the default WordPress /feed/ path.
async function fetchBuckeyesWire() {
  return fetchRssFromAny(
    ["https://buckeyeswire.usatoday.com/feed/", "https://buckeyeswire.usatoday.com/feed"],
    "Buckeyes Wire",
    { osuFeed: true }
  );
}

// Second Panthers source — Cat Scratch Reader (SB Nation's Carolina
// Panthers site). The exact feed filename under /rss/ couldn't be
// confirmed live from this environment, so both common Vox Media/Chorus
// paths are tried in order.
async function fetchPanthersBlog() {
  return fetchRssFromAny(
    [
      "https://www.catscratchreader.com/rss/index.xml",
      "https://www.catscratchreader.com/rss/current.xml",
    ],
    "Cat Scratch Reader",
    { panthersFeed: true }
  );
}

// Third Panthers source — Panthers Wire, same USA Today "Wire" network
// and standard WordPress /feed/ path as Buckeyes Wire above. NOTE: the
// real domain is "pantherswire.usatoday.com" (no dot before "wire") —
// unlike Buckeyes Wire, this one does NOT follow the "{team}.wire."
// subdomain pattern. Three independent Panthers sources (this, Cat
// Scratch Reader, and the ESPN team feed) means one bad/moved URL
// doesn't leave Panthers fans starved.
async function fetchPanthersWire() {
  return fetchRssFromAny(
    ["https://pantherswire.usatoday.com/feed/", "https://pantherswire.usatoday.com/feed"],
    "Panthers Wire",
    { panthersFeed: true, nflFeed: true }
  );
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
  return items.slice(0, 40);
}

async function fetchElevenWarriors() {
  return fetchRssFromAny(["https://www.elevenwarriors.com/rss.xml"], "Eleven Warriors", { osuFeed: true });
}
