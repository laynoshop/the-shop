/* split/news.js
   =========================
   TOP NEWS (ESPN + Eleven Warriors) — v2
   - Fetches through /api/news (a Vercel serverless proxy) instead of
     calling ESPN/Eleven Warriors directly from the browser — the old
     client-side approach needed a public CORS-proxy fallback chain
     (allorigins.win -> rss2json.com) just to read Eleven Warriors' RSS
     feed, and that chain being flaky/rate-limited is exactly why the one
     actual Buckeye-specific source kept silently dropping out.
   - Sticky header + non-scrolling filter grid, matching the rest of the
     app's current look (no more horizontally-scrolling chip row).
   - Hero card (first story, full-width image background) + thumbnail
     list cards for the rest, staggered fade-in, shimmer skeleton loader.
   - Sport tag badges (Buckeyes/CFB/NFL/MLB/NHL).
   - Caching (localStorage) w/ background refresh.
   - Exposes both renderTopNews() and renderNews() for router compatibility.
   ========================= */

(function () {
  "use strict";

  const NEWS_CACHE_KEY    = "theShopTopNewsCache_v5"; // v5: new /api/news source
  const NEWS_FILTER_KEY   = "theShopTopNewsFilter_v1";
  const NEWS_CACHE_TTL_MS = 7 * 60 * 1000;

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
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function norm(s) {
    if (typeof window.norm === "function") return window.norm(s);
    return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function sanitizeTTUNText(s) {
    return String(s || "").replace(/michigan/gi, "TTUN");
  }

  function replaceMichiganTextSafe(root) {
    try {
      if (typeof window.replaceMichiganText === "function") {
        window.replaceMichiganText(root || document.body);
      }
    } catch {}
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
    return `${Math.floor(hr / 24)}d ago`;
  }

  // -----------------------------
  // Sport tag colors
  // -----------------------------
  const TAG_META = {
    buckeyes: { label: "Buckeyes",   icon: "🌰", bg: "linear-gradient(135deg, rgba(214,45,70,0.95), rgba(150,20,45,0.95))", border: "rgba(209,38,63,0.6)",  text: "#ffe3e3" },
    panthers: { label: "Panthers",   icon: "🐾", bg: "linear-gradient(135deg, rgba(0,133,202,0.9), rgba(16,24,32,0.95))",  border: "rgba(0,133,202,0.55)", text: "#d6f0ff" },
    cfb:      { label: "College FB", icon: "🎓", bg: "linear-gradient(135deg, rgba(197,165,3,0.85), rgba(150,120,0,0.9))", border: "rgba(197,165,3,0.55)", text: "#ffe680" },
    nfl:      { label: "NFL",        icon: "🏈", bg: "linear-gradient(135deg, rgba(50,208,140,0.9), rgba(20,150,95,0.9))", border: "rgba(46,204,135,0.55)",text: "#e7fff3" },
    mlb:      { label: "MLB",        icon: "⚾", bg: "linear-gradient(135deg, rgba(40,90,210,0.9), rgba(20,50,140,0.9))",  border: "rgba(0,100,220,0.5)", text: "#dce9ff" },
    nhl:      { label: "NHL",        icon: "🏒", bg: "linear-gradient(135deg, rgba(40,150,220,0.9), rgba(10,100,180,0.9))",border: "rgba(0,104,200,0.5)", text: "#dff2ff" },
    all:      { label: "News",       icon: "📰", bg: "rgba(255,255,255,0.10)", border: "rgba(255,255,255,0.22)", text: "#ffffff" }
  };

  // Order matters — more specific tags (a dedicated team feed) win over
  // more general ones (the sport-wide tag) for which badge shows.
  function getPrimaryTag(tags) {
    for (const t of ["buckeyes", "panthers", "cfb", "nfl", "mlb", "nhl"]) {
      if ((tags || []).includes(t)) return t;
    }
    return "all";
  }

  function buildTagBadge(tagKey) {
    const m = TAG_META[tagKey] || TAG_META["all"];
    return `<span class="newsTagBadge" style="background:${m.bg};border-color:${m.border};color:${m.text};">${m.icon} ${escapeHtml(m.label)}</span>`;
  }

  // -----------------------------
  // Styles (injected once)
  // -----------------------------
  function injectNewsStyles() {
    if (document.getElementById("newsUpgradedStyles")) return;
    const style = document.createElement("style");
    style.id = "newsUpgradedStyles";
    style.textContent = `
      .newsPageHeader{
        position:sticky; top:0; z-index:100;
        background:rgba(13,10,10,0.92);
        backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
        border-bottom:1px solid rgba(255,255,255,0.07);
        padding:14px 14px 12px;
        box-shadow:0 4px 24px rgba(0,0,0,0.45);
      }
      .newsPageHeader::after{
        content:""; display:block; height:3px; border-radius:999px; margin-top:12px;
        background:rgba(187,0,0,0.8); box-shadow:0 0 10px rgba(187,0,0,0.6); opacity:0.85;
      }
      .newsHeaderTop{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .newsHeaderTitle{font-size:26px;font-weight:1000;color:#fff;margin:0;letter-spacing:-0.01em;}
      .newsHeaderSub{font-size:12.5px;font-weight:700;color:rgba(255,255,255,0.4);margin-top:2px;}
      .newsRefreshBtn{
        flex-shrink:0; width:40px;height:40px;border-radius:12px;
        display:flex;align-items:center;justify-content:center;
        background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.14);
        color:rgba(255,255,255,0.92);font-size:18px;line-height:1;cursor:pointer;
        -webkit-tap-highlight-color:transparent;
        transition:background 0.15s ease, transform 0.1s ease;
      }
      .newsRefreshBtn:active{background:rgba(255,255,255,0.16);transform:scale(0.96);}

      /* Sticky filter bar — same fixed-grid, icon-above-label, gold
         active-state treatment as the H2H tab bar in Group Picks, docked
         right below this page's own sticky header. --newsHeaderH is
         measured from the real header height after each render (its
         height isn't fixed — the subtitle line can wrap). */
      .newsTabBar{
        display:grid; grid-template-columns:repeat(5, 1fr);
        gap:2px; padding:4px;
        background:rgba(13,10,10,0.92);
        backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
        border:1px solid rgba(255,255,255,0.08);
        border-radius:16px;
        position:sticky; top:var(--newsHeaderH, 92px); z-index:90;
        box-shadow:0 8px 20px rgba(0,0,0,0.35);
        margin-bottom:14px;
      }
      .newsTabBtn{
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        gap:6px;padding:8px 2px 7px;
        border-radius:12px;border:none;background:none;
        color:rgba(255,255,255,0.45);
        cursor:pointer;-webkit-tap-highlight-color:transparent;
        min-width:0;
      }
      .newsTabBtn.newsTabBtnActive{background:rgba(255,210,100,0.14);color:#ffd76a;}
      .newsTabIcon{font-size:15px;line-height:1;}
      .newsTabLabel{
        font-size:10.5px;font-weight:800;letter-spacing:0.01em;
        line-height:1.15;text-align:center;
        overflow-wrap:break-word;word-break:break-word;
      }

      @keyframes newsShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
      .newsSkeleton{
        background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.04) 75%);
        background-size:400px 100%;animation:newsShimmer 1.4s ease-in-out infinite;border-radius:12px;
      }

      .newsContainer{padding:14px 14px 24px;}

      .newsHeroCard{
        position:relative;width:100%;min-height:230px;border-radius:20px;overflow:hidden;
        display:block;text-decoration:none;color:inherit;background:rgba(0,0,0,0.4);
        border:1px solid rgba(255,210,100,0.22);
        box-shadow:0 16px 40px rgba(0,0,0,0.5), 0 0 24px rgba(187,0,0,0.12);
        margin-bottom:16px;opacity:0;transform:translateY(18px);
        transition:transform 0.22s ease,box-shadow 0.22s ease;
        -webkit-tap-highlight-color:transparent;
      }
      .newsHeroCard.newsVisible{animation:newsCardIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards;}
      .newsHeroCard:active{transform:scale(0.985);}
      .newsHeroImg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;display:block;}
      .newsHeroScrim{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.10) 0%,rgba(0,0,0,0.22) 35%,rgba(0,0,0,0.82) 75%,rgba(0,0,0,0.94) 100%);}
      .newsHeroBody{position:relative;z-index:2;padding:140px 16px 18px;}
      .newsHeroMeta{display:flex;align-items:center;gap:8px;margin-bottom:9px;flex-wrap:wrap;}
      .newsHeroWhen{font-size:11px;font-weight:800;letter-spacing:0.4px;color:rgba(255,255,255,0.55);}
      .newsHeroHeadline{font-size:21px;font-weight:1000;line-height:1.2;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,0.65);margin-bottom:8px;}
      .newsHeroDesc{font-size:13px;font-weight:700;line-height:1.4;color:rgba(255,255,255,0.78);}
      .newsHeroFeaturedLabel{
        position:absolute;top:14px;left:14px;z-index:3;font-size:10px;font-weight:1000;
        letter-spacing:1.5px;text-transform:uppercase;color:#ffd76a;
        background:rgba(0,0,0,0.5);border:1px solid rgba(255,210,100,0.4);
        padding:4px 10px;border-radius:999px;
      }

      .newsListCard{
        display:block;text-decoration:none;color:inherit;background:rgba(255,255,255,0.03);
        border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;
        box-shadow:0 4px 14px rgba(0,0,0,0.28);margin-bottom:11px;opacity:0;
        transform:translateY(14px);-webkit-tap-highlight-color:transparent;
        transition:transform 0.18s ease,box-shadow 0.18s ease,border-color 0.18s ease;
      }
      .newsListCard.newsVisible{animation:newsCardIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards;}
      .newsListCard:active{transform:scale(0.980);border-color:rgba(255,255,255,0.16);}
      .newsListInner{display:flex;align-items:stretch;}
      .newsListThumb{width:104px;min-width:104px;height:96px;object-fit:cover;object-position:center;display:block;flex-shrink:0;background:rgba(255,255,255,0.06);}
      .newsListThumbFallback{width:104px;min-width:104px;height:96px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.05);font-size:24px;}
      .newsListText{flex:1;padding:11px 13px 11px 12px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;gap:8px;}
      .newsListHeadline{font-size:14.5px;font-weight:900;line-height:1.26;color:rgba(255,255,255,0.96);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
      .newsListMeta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
      .newsListWhen{font-size:11px;font-weight:700;color:rgba(255,255,255,0.42);letter-spacing:0.2px;}
      .newsSourceDot{font-size:10px;font-weight:800;letter-spacing:0.4px;color:rgba(255,255,255,0.3);text-transform:uppercase;}

      .newsTagBadge{
        display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;
        font-size:10px;font-weight:900;letter-spacing:0.3px;text-transform:uppercase;
        border:1px solid; vertical-align:middle; line-height:1.5;
      }

      @keyframes newsCardIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      .newsNotice{text-align:center;padding:44px 20px;color:rgba(255,255,255,0.45);font-size:14px;font-weight:800;letter-spacing:0.3px;}
      .newsCacheLine{font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.3px;margin-top:10px;}
    `;
    document.head.appendChild(style);
  }

  // -----------------------------
  // Filter helpers
  // -----------------------------
  function loadNewsFilter() { return safeGetLS(NEWS_FILTER_KEY).trim() || "all"; }
  function saveNewsFilter(v) { safeSetLS(NEWS_FILTER_KEY, String(v || "all")); }
  let currentNewsFilter = loadNewsFilter();

  function tagNewsItem(it) {
    const t = norm(`${it?.headline || ""} ${it?.description || ""} ${it?.source || ""}`);
    const tags = [];
    if (
      t.includes("ohio state") || t.includes("buckeyes") || t.includes("ryan day") ||
      t.includes("eleven warriors") || (t.includes("columbus") && t.includes("football")) ||
      t.includes("osu ") || it?.source === "Eleven Warriors" || it?.osuFeed === true
    ) tags.push("buckeyes");
    // Bare "panthers" is deliberately excluded — plenty of college teams
    // (Pitt, Georgia State, FIU, ...) share that nickname. Only the full
    // "Carolina Panthers" phrase, a current-roster name, or a dedicated
    // Panthers source (forced via panthersFeed) counts.
    if (
      t.includes("carolina panthers") || t.includes("bryce young") ||
      it?.source === "Cat Scratch Reader" || it?.panthersFeed === true
    ) tags.push("panthers");
    if (t.includes("college football") || t.includes("cfb") || (t.includes("ncaa") && t.includes("football")) || t.includes("transfer portal") || t.includes("heisman") || t.includes("bowl")) tags.push("cfb");
    if (
      t.includes("nfl") || t.includes("super bowl") || (t.includes("draft") && t.includes("nfl")) ||
      tags.includes("panthers") || it?.nflFeed === true
    ) tags.push("nfl");
    if (t.includes("mlb") || t.includes("baseball") || t.includes("spring training")) tags.push("mlb");
    if (t.includes("nhl") || t.includes("hockey") || t.includes("stanley cup")) tags.push("nhl");
    tags.push("all");
    return Array.from(new Set(tags));
  }

  function passesNewsFilter(it, filterKey) {
    if (!filterKey || filterKey === "all") return true;
    return (it?.tags || []).includes(filterKey);
  }

  function sortByNewest(items) {
    return [...(items || [])].sort((a, b) => (Number(b.publishedTs || 0)) - (Number(a.publishedTs || 0)));
  }

  function dedupeNewsItems(items) {
    const seen = new Set(), out = [];
    for (const it of (items || [])) {
      const key = norm(it?.link || "") || norm(it?.headline || "");
      if (!key || seen.has(key)) continue;
      seen.add(key); out.push(it);
    }
    return out;
  }

  // 5 filters, 1 row — same fixed-grid, no-scroll, icon-above-label
  // treatment as the H2H tab bar in Group Picks.
  const NEWS_FILTERS = [
    { key: "all",      label: "All",      icon: "📰" },
    { key: "buckeyes", label: "Buckeyes", icon: "🌰" },
    { key: "cfb",      label: "CFB",      icon: "🎓" },
    { key: "nfl",      label: "NFL",      icon: "🏈" },
    { key: "panthers", label: "Panthers", icon: "🐾" },
  ];
  function buildNewsFiltersRowHTML(activeKey) {
    const chips = NEWS_FILTERS.map(f => {
      const on = f.key === activeKey;
      return `
      <button type="button" class="newsTabBtn${on ? " newsTabBtnActive" : ""}" data-newsfilter="${f.key}">
        <span class="newsTabIcon">${f.icon}</span>
        <span class="newsTabLabel">${escapeHtml(f.label)}</span>
      </button>`;
    }).join("");
    return `<div class="newsTabBar">${chips}</div>`;
  }

  // -----------------------------
  // Cache
  // -----------------------------
  function loadNewsCache() {
    const raw = safeGetLS(NEWS_CACHE_KEY);
    if (!raw) return null;
    try { const o = JSON.parse(raw); return (o && Array.isArray(o.items)) ? o : null; } catch { return null; }
  }
  function saveNewsCache(items, label) {
    safeSetLS(NEWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), updatedLabel: String(label || ""), items: Array.isArray(items) ? items : [] }));
  }

  // -----------------------------
  // Fetch — through /api/news (server-side merge, no browser CORS issues)
  // -----------------------------
  async function fetchJsonWithTimeout(url, ms = 10000) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    try {
      const r = await fetch(url, { cache: "no-store", signal: c.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function fetchTopNewsItems() {
    const data = await fetchJsonWithTimeout("/api/news");
    const raw = Array.isArray(data?.items) ? data.items : [];
    if (!raw.length) throw new Error("All news sources failed");

    const sanitized = raw.map(it => ({
      ...it,
      headline: sanitizeTTUNText(it?.headline || ""),
      description: sanitizeTTUNText(it?.description || ""),
    }));
    const tagged  = sanitized.map(it => ({ ...it, tags: tagNewsItem(it) }));
    const deduped = dedupeNewsItems(tagged);
    const sorted  = sortByNewest(deduped);
    return sorted.slice(0, 30);
  }

  // -----------------------------
  // Sport fallback emoji
  // -----------------------------
  function sportEmoji(tags) {
    if ((tags || []).includes("buckeyes")) return "🌰";
    if ((tags || []).includes("cfb") || (tags || []).includes("nfl")) return "🏈";
    if ((tags || []).includes("mlb")) return "⚾";
    if ((tags || []).includes("nhl")) return "🏒";
    return "📰";
  }

  // -----------------------------
  // Render
  // -----------------------------
  function buildHeaderHTML(headerUpdatedLabel, cacheMetaLabel) {
    const cacheLine = cacheMetaLabel
      ? `<div class="newsCacheLine">Last updated ${escapeHtml(cacheMetaLabel)}</div>` : "";
    return `
      <div class="newsPageHeader">
        <div class="newsHeaderTop">
          <div>
            <h2 class="newsHeaderTitle">Top News</h2>
            <div class="newsHeaderSub">ESPN &middot; Eleven Warriors &middot; ${escapeHtml(headerUpdatedLabel || "")}</div>
          </div>
          <button class="newsRefreshBtn" type="button" data-newsaction="refresh" aria-label="Refresh">&#8635;</button>
        </div>
        ${cacheLine}
      </div>`;
  }

  // Measures the real header height so the sticky tab bar below it docks
  // flush instead of relying on the CSS fallback guess (the header's
  // height isn't fixed — the subtitle line can wrap).
  function measureNewsHeaderHeight(content) {
    requestAnimationFrame(() => {
      const header = content.querySelector(".newsPageHeader");
      if (header) content.style.setProperty("--newsHeaderH", `${header.offsetHeight}px`);
    });
  }

  function renderNewsList(items, headerUpdatedLabel, cacheMetaLabel) {
    const content = document.getElementById("content");
    if (!content) return;
    injectNewsStyles();

    const filtered = sortByNewest((items || []).filter(it => passesNewsFilter(it, currentNewsFilter))).slice(0, 30);

    let heroHTML = "";
    const hero = filtered[0];
    if (hero) {
      const title    = escapeHtml(sanitizeTTUNText(hero?.headline || ""));
      const desc     = escapeHtml(sanitizeTTUNText(hero?.description || ""));
      const when     = hero?.publishedTs ? escapeHtml(timeAgoLabel(hero.publishedTs)) : "";
      const href     = hero?.link || `https://www.espn.com/search/results?q=${encodeURIComponent(hero?.headline || "")}`;
      const tagBadge = buildTagBadge(getPrimaryTag(hero?.tags || []));
      const imgUrl   = hero?.imageUrl || "";
      const srcLabel = hero?.source ? escapeHtml(hero.source) : "";
      const imgTag   = imgUrl ? `<img class="newsHeroImg" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">` : "";

      heroHTML = `
        <a class="newsHeroCard" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
          ${imgTag}
          <div class="newsHeroScrim"></div>
          <span class="newsHeroFeaturedLabel">Featured</span>
          <div class="newsHeroBody">
            <div class="newsHeroMeta">
              ${tagBadge}
              ${when ? `<span class="newsHeroWhen">${when}</span>` : ""}
              ${srcLabel ? `<span class="newsHeroWhen" style="opacity:0.45;">${srcLabel}</span>` : ""}
            </div>
            <div class="newsHeroHeadline">${title}</div>
            ${desc ? `<div class="newsHeroDesc">${desc}</div>` : ""}
          </div>
        </a>`;
    }

    const listHTML = filtered.slice(1).map((it, idx) => {
      const title    = escapeHtml(sanitizeTTUNText(it?.headline || ""));
      const when     = it?.publishedTs ? escapeHtml(timeAgoLabel(it.publishedTs)) : "";
      const href     = it?.link || `https://www.espn.com/search/results?q=${encodeURIComponent(it?.headline || "")}`;
      const tagBadge = buildTagBadge(getPrimaryTag(it?.tags || []));
      const imgUrl   = it?.imageUrl || "";
      const srcLabel = it?.source ? escapeHtml(it.source) : "";
      const delay    = (idx * 55) + 120;
      const thumbEl  = imgUrl
        ? `<img class="newsListThumb" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')">`
        : `<div class="newsListThumbFallback">${sportEmoji(it?.tags || [])}</div>`;

      return `
        <a class="newsListCard" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="animation-delay:${delay}ms;">
          <div class="newsListInner">
            ${thumbEl}
            <div class="newsListText">
              <div class="newsListHeadline">${title}</div>
              <div class="newsListMeta">
                ${tagBadge}
                ${when ? `<span class="newsListWhen">${when}</span>` : ""}
                ${srcLabel ? `<span class="newsSourceDot">${srcLabel}</span>` : ""}
              </div>
            </div>
          </div>
        </a>`;
    }).join("");

    content.innerHTML = `
      ${buildHeaderHTML(headerUpdatedLabel, cacheMetaLabel)}
      <div class="newsContainer">
        ${buildNewsFiltersRowHTML(currentNewsFilter)}
        ${heroHTML}
        ${listHTML || (!heroHTML ? `<div class="newsNotice">No headlines found for this filter.</div>` : "")}
      </div>`;

    measureNewsHeaderHeight(content);

    requestAnimationFrame(() => {
      const heroEl = content.querySelector(".newsHeroCard");
      if (heroEl) setTimeout(() => heroEl.classList.add("newsVisible"), 30);
      content.querySelectorAll(".newsListCard").forEach((card, i) => {
        setTimeout(() => card.classList.add("newsVisible"), (i * 55) + 120);
      });
    });

    setTimeout(() => replaceMichiganTextSafe(content), 0);
    try { if (typeof window.updateRivalryBanner === "function") window.updateRivalryBanner(); } catch {}
  }

  function renderSkeletonLoader(headerUpdated) {
    const content = document.getElementById("content");
    if (!content) return;
    injectNewsStyles();
    const skCards = Array.from({ length: 5 }).map(() => `
      <div style="display:flex;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;margin-bottom:11px;">
        <div class="newsSkeleton" style="width:104px;min-width:104px;height:96px;border-radius:0;"></div>
        <div style="flex:1;padding:13px;display:flex;flex-direction:column;gap:8px;">
          <div class="newsSkeleton" style="height:14px;border-radius:6px;width:90%;"></div>
          <div class="newsSkeleton" style="height:14px;border-radius:6px;width:70%;"></div>
          <div class="newsSkeleton" style="height:11px;border-radius:6px;width:40%;margin-top:4px;"></div>
        </div>
      </div>`).join("");
    content.innerHTML = `
      ${buildHeaderHTML(headerUpdated, "")}
      <div class="newsContainer">
        ${buildNewsFiltersRowHTML(currentNewsFilter)}
        <div class="newsSkeleton" style="width:100%;height:230px;border-radius:20px;margin-bottom:16px;"></div>
        ${skCards}
      </div>`;

    measureNewsHeaderHeight(content);
  }

  async function renderTopNews(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;
    const headerUpdated = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (showLoading) renderSkeletonLoader(headerUpdated);

    const cached = loadNewsCache();
    if (cached && Array.isArray(cached.items) && cached.items.length) {
      renderNewsList(cached.items, headerUpdated, cached.updatedLabel || "");
      if ((Date.now() - cached.ts) > NEWS_CACHE_TTL_MS) refreshTopNewsInBackground();
      return;
    }

    try {
      const items = await fetchTopNewsItems();
      const label = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      saveNewsCache(items, label);
      renderNewsList(items, headerUpdated, label);
    } catch (e) {
      console.error("Top News fetch failed:", e);
      const fb = loadNewsCache();
      if (fb && Array.isArray(fb.items) && fb.items.length) { renderNewsList(fb.items, headerUpdated, fb.updatedLabel || ""); return; }
      injectNewsStyles();
      content.innerHTML = `
        ${buildHeaderHTML(headerUpdated, "")}
        <div class="newsNotice">Headlines are down right now.<br/>Hit &#8635; above and we'll run it back. 🏈</div>`;
    }
  }

  async function refreshTopNewsInBackground() {
    try {
      const fresh = await fetchTopNewsItems();
      const label = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      saveNewsCache(fresh, label);
      const tab = window.__activeTab || window.currentTab || "";
      if (String(tab) === "news") {
        renderNewsList(fresh, new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }), label);
      }
    } catch {}
  }

  // -----------------------------
  // Click delegation
  // -----------------------------
  if (!window.__NEWS_CLICK_BOUND) {
    document.addEventListener("click", e => {
      const btn = e.target?.closest?.("button");
      if (!btn) return;
      const filterKey = btn.getAttribute("data-newsfilter");
      if (filterKey) {
        currentNewsFilter = String(filterKey || "all");
        saveNewsFilter(currentNewsFilter);
        const cached = loadNewsCache();
        const hu = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (cached && Array.isArray(cached.items)) renderNewsList(cached.items, hu, cached.updatedLabel || "");
        else renderTopNews(true);
        return;
      }
      if (btn.getAttribute("data-newsaction") === "refresh") renderTopNews(true);
    });
    window.__NEWS_CLICK_BOUND = true;
  }

  window.renderTopNews = renderTopNews;
  window.renderNews    = renderTopNews;

  try {
    const tab = window.__activeTab || window.currentTab || "";
    if (String(tab) === "news") setTimeout(() => renderTopNews(true), 0);
  } catch {}

})();
