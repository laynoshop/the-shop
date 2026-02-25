/* split/news.js
   =========================
   TOP NEWS (ESPN) — SINGLE SOURCE for News tab
   - ESPN JSON -> ESPN RSS -> AllOrigins RSS fallback
   - Filter chips (All / Buckeyes / CFB / NFL / MLB / NHL)
   - Caching (localStorage) w/ background refresh
   - TTUN text sanitization
   - Event delegation (no stacked handlers)
   ========================= */

(function () {
  "use strict";

  // -----------------------------
  // Safe helpers / fallbacks
  // -----------------------------
  const NEWS_CACHE_KEY = "theShopTopNewsCache_v1";
  const NEWS_FILTER_KEY = "theShopTopNewsFilter_v1";
  const NEWS_CACHE_TTL_MS = 7 * 60 * 1000; // 7 minutes

  function safeGetLS(key) {
    try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
  }
  function safeSetLS(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }

  function escapeHtml(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function norm(s) {
    if (typeof window.norm === "function") return window.norm(s);
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  // TTUN sanitization (never show the M-word)
  function sanitizeTTUNText(s) {
    const input = String(s || "");
    // Replace case-insensitive "Michigan" with "TTUN"
    return input.replace(/michigan/gi, "TTUN");
  }

  function replaceMichiganTextSafe(root) {
    try {
      if (typeof window.replaceMichiganText === "function") {
        window.replaceMichiganText(root || document.body);
        return;
      }
    } catch {}
    // fallback: do nothing (we already sanitize strings we render)
  }

  function timeAgoLabel(ts) {
    const ms = Number(ts || 0);
    if (!ms) return "";
    const diff = Date.now() - ms;
    if (diff < 0) return "";
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 48) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  }

  function withLangRegion(url) {
    const u = String(url || "");
    if (!u) return u;
    // if already has lang/region, leave it
    if (/[?&]lang=/.test(u) || /[?&]region=/.test(u)) return u;
    return u.includes("?") ? `${u}&lang=en&region=us` : `${u}?lang=en&region=us`;
  }

  // -----------------------------
  // Filters + tagging
  // -----------------------------
  function loadNewsFilter() {
    const v = safeGetLS(NEWS_FILTER_KEY).trim();
    return v || "all";
  }
  function saveNewsFilter(v) {
    safeSetLS(NEWS_FILTER_KEY, String(v || "all"));
  }

  let currentNewsFilter = loadNewsFilter();

  function tagNewsItem(it) {
    const t = norm(`${it?.headline || ""} ${it?.description || ""} ${it?.source || ""}`);

    const tags = [];

    // Buckeyes/OSU terms
    if (
      t.includes("ohio state") ||
      t.includes("buckeyes") ||
      t.includes("osu ") || t.endsWith(" osu") ||
      t.includes("ryan day") ||
      t.includes("columbus") && t.includes("buckeyes")
    ) tags.push("buckeyes");

    // College football terms
    if (
      t.includes("college football") ||
      t.includes("cfb") ||
      t.includes("ncaa") && t.includes("football") ||
      t.includes("transfer portal") ||
      t.includes("bowl") ||
      t.includes("heisman")
    ) tags.push("cfb");

    // NFL
    if (t.includes("nfl") || t.includes("super bowl") || t.includes("draft") && t.includes("nfl")) tags.push("nfl");

    // MLB
    if (t.includes("mlb") || t.includes("baseball") || t.includes("spring training")) tags.push("mlb");

    // NHL
    if (t.includes("nhl") || t.includes("hockey") || t.includes("stanley cup")) tags.push("nhl");

    // Always include "all"
    tags.push("all");

    // de-dupe
    return Array.from(new Set(tags));
  }

  function passesNewsFilter(it, filterKey) {
    if (!filterKey || filterKey === "all") return true;
    const tags = Array.isArray(it?.tags) ? it.tags : [];
    return tags.includes(filterKey);
  }

  // Buckeyes boost in ordering
  function scoreNewsItemForBuckeyeBoost(it) {
    const tags = Array.isArray(it?.tags) ? it.tags : [];
    let score = 0;

    // Base: recency
    const ts = Number(it?.publishedTs || 0);
    if (ts) score += Math.min(100, Math.floor((ts / 1000) % 100)); // tiny tie-breaker

    // Boosts
    if (tags.includes("buckeyes")) score += 10000;
    if (tags.includes("cfb")) score += 2000;
    if (tags.includes("nfl")) score += 800;
    if (tags.includes("mlb")) score += 500;
    if (tags.includes("nhl")) score += 500;

    return score;
  }

  function dedupeNewsItems(items) {
    const seen = new Set();
    const out = [];

    for (const it of (items || [])) {
      const h = norm(it?.headline || "");
      const link = norm(it?.link || "");
      const key = link || h;
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }

  function buildNewsFiltersRowHTML(activeKey) {
    const btn = (key, label) => {
      const isOn = key === activeKey;
      const extra = isOn ? `style="opacity:1;"` : `style="opacity:0.7;"`;
      return `<button class="smallBtn" data-newsfilter="${key}" ${extra}>${label}</button>`;
    };

    return `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        ${btn("all", "All")}
        ${btn("buckeyes", "Buckeyes")}
        ${btn("cfb", "College FB")}
        ${btn("nfl", "NFL")}
        ${btn("mlb", "MLB")}
        ${btn("nhl", "NHL")}
      </div>
    `;
  }

  // -----------------------------
  // Cache
  // -----------------------------
  function loadNewsCache() {
    const raw = safeGetLS(NEWS_CACHE_KEY);
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj || !Array.isArray(obj.items)) return null;
      return obj;
    } catch {
      return null;
    }
  }

  function saveNewsCache(items, updatedLabel) {
    const payload = {
      ts: Date.now(),
      updatedLabel: String(updatedLabel || ""),
      items: Array.isArray(items) ? items : []
    };
    safeSetLS(NEWS_CACHE_KEY, JSON.stringify(payload));
  }

  // -----------------------------
  // ESPN fetch
  // -----------------------------
  async function fetchTopNewsItemsFromESPN() {
    async function fetchJsonWithTimeout(url, ms = 9000) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), ms);
      try {
        const resp = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
      } finally {
        clearTimeout(t);
      }
    }

    async function fetchTextWithTimeout(url, ms = 9000) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), ms);
      try {
        const resp = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
      } finally {
        clearTimeout(t);
      }
    }

    function ensureLinkOrSearch(it) {
      if (it.link) return it.link;
      const q = encodeURIComponent(it.headline || "");
      return q ? `https://www.espn.com/search/results?q=${q}` : "https://www.espn.com/";
    }

    function pickBestImageUrlFromESPNArticle(a) {
      const candidates = [];

      if (Array.isArray(a?.images)) {
        for (const im of a.images) {
          if (im?.url) candidates.push(im.url);
          if (im?.href) candidates.push(im.href);
        }
      }
      if (a?.image?.url) candidates.push(a.image.url);
      if (a?.image?.href) candidates.push(a.image.href);
      if (a?.thumbnail) candidates.push(a.thumbnail);
      if (a?.promoImage) candidates.push(a.promoImage);

      const cleaned = candidates
        .filter(Boolean)
        .map(String)
        .map(s => s.trim())
        .filter(s => s.length > 8);

      return cleaned.find(u => u.startsWith("https://")) || cleaned[0] || "";
    }

    function normalizeItem(a) {
      const publishedIso = a?.published || a?.publishedAt || "";
      const publishedTs = Date.parse(publishedIso);

      const item = {
        headline: sanitizeTTUNText(a?.headline || a?.title || ""),
        description: sanitizeTTUNText(a?.description || a?.summary || ""),
        source: sanitizeTTUNText(a?.source || "ESPN"),
        publishedIso,
        publishedTs: Number.isFinite(publishedTs) ? publishedTs : 0,
        link: a?.links?.web?.href || a?.links?.[0]?.href || a?.url || "",
        imageUrl: pickBestImageUrlFromESPNArticle(a) || ""
      };

      item.link = ensureLinkOrSearch(item);
      return item;
    }

    function parseRssItems(xmlText) {
      const doc = new DOMParser().parseFromString(xmlText, "text/xml");
      const items = Array.from(doc.querySelectorAll("item")).slice(0, 30);

      function text(q, node) {
        return node.querySelector(q)?.textContent || "";
      }

      function rssImageUrl(node) {
        const enc = node.querySelector("enclosure");
        const encUrl = enc?.getAttribute("url") || "";
        if (encUrl) return encUrl;

        const mediaContent =
          node.querySelector("media\\:content") ||
          node.getElementsByTagName("media:content")?.[0];
        const mediaThumb =
          node.querySelector("media\\:thumbnail") ||
          node.getElementsByTagName("media:thumbnail")?.[0];

        const mcUrl = mediaContent?.getAttribute?.("url") || "";
        if (mcUrl) return mcUrl;

        const mtUrl = mediaThumb?.getAttribute?.("url") || "";
        if (mtUrl) return mtUrl;

        return "";
      }

      return items.map((node) => {
        const title = text("title", node);
        const link = text("link", node);
        const desc = text("description", node);
        const pub = text("pubDate", node);

        const publishedTs = Date.parse(pub);

        const it = {
          headline: sanitizeTTUNText(title),
          description: sanitizeTTUNText(String(desc || "").replace(/<[^>]*>/g, "").trim()),
          source: "ESPN",
          publishedIso: pub,
          publishedTs: Number.isFinite(publishedTs) ? publishedTs : 0,
          link: link || "",
          imageUrl: rssImageUrl(node) || ""
        };

        it.link = ensureLinkOrSearch(it);
        return it;
      }).filter(x => x.headline);
    }

    // --- 1) Try ESPN JSON endpoints ---
    const jsonBases = [
      "https://site.api.espn.com/apis/v2/sports/news?limit=50",
      "https://site.api.espn.com/apis/site/v2/sports/news?limit=50",
      "https://site.api.espn.com/apis/v2/sports/news",
      "https://site.api.espn.com/apis/site/v2/sports/news"
    ];

    const jsonUrls = [];
    for (const u of jsonBases) {
      jsonUrls.push(u);
      jsonUrls.push(withLangRegion(u));
    }

    let lastErr = null;

    for (const url of jsonUrls) {
      try {
        const data = await fetchJsonWithTimeout(url, 9000);
        const articles = Array.isArray(data?.articles) ? data.articles : [];
        if (articles.length) {
          const items = articles.slice(0, 30).map(normalizeItem).filter(x => x.headline);
          const tagged = items.map(it => ({ ...it, tags: tagNewsItem(it) }));
          const deduped = dedupeNewsItems(tagged);

          deduped.sort((a, b) => scoreNewsItemForBuckeyeBoost(b) - scoreNewsItemForBuckeyeBoost(a));
          return deduped.slice(0, 12);
        }
      } catch (e) {
        lastErr = e;
      }
    }

    // --- 2) ESPN RSS ---
    const rssUrl = "https://www.espn.com/espn/rss/news";
    try {
      const xml = await fetchTextWithTimeout(rssUrl, 9000);
      const items = parseRssItems(xml);

      const tagged = items.map(it => ({ ...it, tags: tagNewsItem(it) }));
      const deduped = dedupeNewsItems(tagged);

      deduped.sort((a, b) => scoreNewsItemForBuckeyeBoost(b) - scoreNewsItemForBuckeyeBoost(a));
      return deduped.slice(0, 12);
    } catch (e) {
      lastErr = e;
    }

    // --- 3) RSS via AllOrigins ---
    try {
      const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
      const xml = await fetchTextWithTimeout(proxied, 9000);
      const items = parseRssItems(xml);

      const tagged = items.map(it => ({ ...it, tags: tagNewsItem(it) }));
      const deduped = dedupeNewsItems(tagged);

      deduped.sort((a, b) => scoreNewsItemForBuckeyeBoost(b) - scoreNewsItemForBuckeyeBoost(a));
      return deduped.slice(0, 12);
    } catch (e) {
      lastErr = e;
    }

    throw (lastErr || new Error("News fetch failed"));
  }

  // -----------------------------
  // Render
  // -----------------------------
  function renderNewsList(items, headerUpdatedLabel, cacheMetaLabel) {
    const content = document.getElementById("content");
    if (!content) return;

    const filtered = (items || []).filter(it => passesNewsFilter(it, currentNewsFilter));
    const categoryLabel = String(currentNewsFilter || "all").toUpperCase();

    const cards = filtered.map((it) => {
      const safeTitle = sanitizeTTUNText(it?.headline || "");
      const title = escapeHtml(safeTitle);

      const descText = sanitizeTTUNText(it?.description || "");
      const when = it?.publishedTs ? timeAgoLabel(it.publishedTs) : "";
      const sourceLabel = it?.source ? escapeHtml(sanitizeTTUNText(it.source)) : "ESPN";

      const metaLine = [categoryLabel, sourceLabel, when ? escapeHtml(when) : ""].filter(Boolean).join(" • ");

      const href = it?.link
        ? String(it.link)
        : `https://www.espn.com/search/results?q=${encodeURIComponent(safeTitle || "")}`;

      // NOTE: Your screenshot shows no images; keep this off by default.
      // If you want images back later, set SHOW_IMAGES = true.
      const SHOW_IMAGES = false;
      const imgUrl = (it?.imageUrl || "").trim();

      const imageBlock = (SHOW_IMAGES && imgUrl) ? `
        <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;">
          <div class="newsImgWrap" style="
            width:100%;
            height:156px;
            border-radius:16px;
            overflow:hidden;
            margin-bottom:10px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.10);
          ">
            <img src="${escapeHtml(imgUrl)}"
                 alt=""
                 loading="lazy"
                 referrerpolicy="no-referrer"
                 style="width:100%;height:100%;object-fit:cover;display:block;"
                 onerror="this.parentElement.style.display='none';"
            />
          </div>
        </a>
      ` : "";

      const headlinePill = `
        <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:block;color:inherit;text-decoration:none;">
          <div style="
            display:block;
            padding: 12px 12px;
            border-radius: 14px;
            background: rgba(0,0,0,0.20);
            border: 1px solid rgba(255,255,255,0.10);
            box-shadow: 0 10px 26px rgba(0,0,0,0.28);
            font-weight: 1000;
            font-size: 18px;
            line-height: 1.22;
          ">
            ${title}
          </div>
        </a>
      `;

      const desc = descText
        ? `<div style="opacity:0.85;font-size:14px;line-height:1.35;margin:10px 2px 8px;">
             ${escapeHtml(descText)}
           </div>`
        : "";

      const meta = metaLine
        ? `<div style="opacity:0.65;font-size:12px;letter-spacing:0.4px;margin:0 2px;">
             ${metaLine}
           </div>`
        : "";

      return `
        <div class="game">
          ${imageBlock}
          ${headlinePill}
          ${desc}
          ${meta}
        </div>
      `;
    }).join("");

    const cacheLine = cacheMetaLabel
      ? `<div style="opacity:0.7;">Last updated ${escapeHtml(cacheMetaLabel)}</div>`
      : `<div style="opacity:0.7;">—</div>`;

    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Top News</h2>
            <span class="badge">ESPN</span>
          </div>
          <button class="smallBtn" data-newsaction="refresh">Refresh</button>
        </div>
        <div class="subline">
          <div>Headlines</div>
          <div>Updated ${escapeHtml(headerUpdatedLabel || "")}</div>
        </div>
        ${buildNewsFiltersRowHTML(currentNewsFilter)}
        <div style="margin-top:8px;font-size:12px;">
          ${cacheLine}
        </div>
      </div>

      <div class="grid">
        ${cards || `<div class="notice">No headlines found for this filter.</div>`}
      </div>
    `;

    setTimeout(() => replaceMichiganTextSafe(content), 0);
    try { if (typeof window.updateRivalryBanner === "function") window.updateRivalryBanner(); } catch {}
  }

  async function renderTopNews(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;

    const headerUpdated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const cached = loadNewsCache();
    if (cached && Array.isArray(cached.items) && cached.items.length) {
      renderNewsList(cached.items, headerUpdated, cached.updatedLabel || "");
      const isFresh = (Date.now() - cached.ts) <= NEWS_CACHE_TTL_MS;
      if (!isFresh) refreshTopNewsInBackground();
      return;
    }

    if (showLoading) {
      content.innerHTML = `
        <div class="header">
          <div class="headerTop">
            <div class="brand">
              <h2 style="margin:0;">Top News</h2>
              <span class="badge">ESPN</span>
            </div>
            <button class="smallBtn" data-newsaction="refresh">Refresh</button>
          </div>
          <div class="subline">
            <div>Headlines</div>
            <div>Updated ${escapeHtml(headerUpdated)}</div>
          </div>
          ${buildNewsFiltersRowHTML(currentNewsFilter)}
        </div>
        <div class="notice">Loading headlines…</div>
      `;
    }

    try {
      const items = await fetchTopNewsItemsFromESPN();
      const cacheLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      saveNewsCache(items, cacheLabel);
      renderNewsList(items, headerUpdated, cacheLabel);
    } catch (e) {
      console.error("Top News fetch failed:", e);

      const fallback = loadNewsCache();
      if (fallback && Array.isArray(fallback.items) && fallback.items.length) {
        renderNewsList(fallback.items, headerUpdated, fallback.updatedLabel || "");
        return;
      }

      content.innerHTML = `
        <div class="header">
          <div class="headerTop">
            <div class="brand">
              <h2 style="margin:0;">Top News</h2>
              <span class="badge">ESPN</span>
            </div>
            <button class="smallBtn" data-newsaction="refresh">Retry</button>
          </div>
          <div class="subline">
            <div>Headlines</div>
            <div>Error</div>
          </div>
          ${buildNewsFiltersRowHTML(currentNewsFilter)}
        </div>

        <div class="notice" style="text-align:center;">
          Headlines are down right now.<br/>
          Hit Retry and we’ll run it back.
        </div>
      `;
    }

    async function refreshTopNewsInBackground() {
      try {
        const fresh = await fetchTopNewsItemsFromESPN();
        const cacheLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        saveNewsCache(fresh, cacheLabel);

        // Only auto-rerender if you're still on the News tab
        const tab = window.__activeTab || window.currentTab || "";
        if (String(tab) === "news") {
          const headerUpdated2 = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
          renderNewsList(fresh, headerUpdated2, cacheLabel);
        }
      } catch {
        // silent
      }
    }
  }

  // -----------------------------
  // Click handling (delegated)
  // -----------------------------
  if (!window.__NEWS_CLICK_BOUND) {
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;

      const filterKey = btn.getAttribute("data-newsfilter");
      if (filterKey) {
        currentNewsFilter = String(filterKey || "all");
        saveNewsFilter(currentNewsFilter);

        const cached = loadNewsCache();
        const headerUpdated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (cached && Array.isArray(cached.items)) {
          renderNewsList(cached.items, headerUpdated, cached.updatedLabel || "");
        } else {
          renderTopNews(true);
        }
        return;
      }

      const act = btn.getAttribute("data-newsaction");
      if (act === "refresh") {
        renderTopNews(true);
        return;
      }
    });

    window.__NEWS_CLICK_BOUND = true;
  }

  // Expose renderer used by shared tab router
  window.renderTopNews = renderTopNews;

})();