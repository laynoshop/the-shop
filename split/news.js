/* split/news.js
   =========================
   TOP NEWS (ESPN + OSU) — UPGRADED
   - Hero card (first story, full-width with image background)
   - Thumbnail cards (remaining stories, image left + text right)
   - Sport color tags / badges (Buckeyes=scarlet, CFB=gold, NFL=green, MLB=navy, NHL=blue)
   - Staggered fade+slide-in entrance animation
   - Shimmer skeleton loader
   - Filter chips with filled active state
   - ESPN Ohio State team feed (team ID 194)
   - Eleven Warriors RSS (elevenwarriors.com/rss.xml)
     → direct fetch → AllOrigins /get (base64 decoded) → rss2json.com fallback
   - ESPN JSON -> ESPN RSS -> AllOrigins fallback
   - Caching (localStorage) w/ background refresh
   - TTUN text sanitization
   - Event delegation (no stacked handlers)
   - ✅ Exposes BOTH renderTopNews() and renderNews() for router compatibility
   ========================= */

(function () {
  "use strict";

  const NEWS_CACHE_KEY   = "theShopTopNewsCache_v4"; // v4: bust stale sort-order cache
  const NEWS_FILTER_KEY  = "theShopTopNewsFilter_v1";
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

  function withLangRegion(url) {
    const u = String(url || "");
    if (!u) return u;
    if (/[?&]lang=/.test(u) || /[?&]region=/.test(u)) return u;
    return u.includes("?") ? `${u}&lang=en&region=us` : `${u}?lang=en&region=us`;
  }

  // -----------------------------
  // Sport tag colors
  // -----------------------------
  const TAG_META = {
    buckeyes: { label: "Buckeyes",   bg: "rgba(187,0,0,0.22)",    border: "rgba(187,0,0,0.45)",    text: "#ffb3b3" },
    cfb:      { label: "College FB", bg: "rgba(197,165,3,0.20)",  border: "rgba(197,165,3,0.45)",  text: "#ffe680" },
    nfl:      { label: "NFL",        bg: "rgba(26,122,26,0.22)",  border: "rgba(26,122,26,0.50)",  text: "#90ee90" },
    mlb:      { label: "MLB",        bg: "rgba(0,48,135,0.30)",   border: "rgba(0,100,220,0.45)", text: "#7eb6ff" },
    nhl:      { label: "NHL",        bg: "rgba(0,104,200,0.22)",  border: "rgba(0,104,200,0.45)", text: "#7ec8ff" },
    all:      { label: "All",        bg: "rgba(255,255,255,0.10)",border: "rgba(255,255,255,0.22)",text: "#ffffff"  }
  };

  function getPrimaryTag(tags) {
    for (const t of ["buckeyes","cfb","nfl","mlb","nhl"]) {
      if ((tags||[]).includes(t)) return t;
    }
    return "all";
  }

  function buildTagBadge(tagKey) {
    const m = TAG_META[tagKey] || TAG_META["all"];
    return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:10px;font-weight:1000;letter-spacing:0.8px;text-transform:uppercase;background:${m.bg};border:1px solid ${m.border};color:${m.text};vertical-align:middle;line-height:1.6;">${escapeHtml(m.label)}</span>`;
  }

  // -----------------------------
  // Styles (injected once)
  // -----------------------------
  function injectNewsStyles() {
    if (document.getElementById("newsUpgradedStyles")) return;
    const style = document.createElement("style");
    style.id = "newsUpgradedStyles";
    style.textContent = `
      .newsChip {
        display:inline-flex;align-items:center;gap:5px;padding:5px 14px;
        border-radius:999px;font-size:12px;font-weight:900;letter-spacing:0.5px;
        border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);
        color:rgba(255,255,255,0.65);cursor:pointer;white-space:nowrap;
        transition:background 0.18s ease,color 0.18s ease,border-color 0.18s ease,transform 0.15s ease;
        -webkit-tap-highlight-color:transparent;
      }
      .newsChip:active{transform:scale(0.94);}
      .newsChip.newsChipActive{color:#fff;font-weight:1000;}
      .newsChip[data-newsfilter="all"].newsChipActive      {background:rgba(255,255,255,0.16);border-color:rgba(255,255,255,0.35);}
      .newsChip[data-newsfilter="buckeyes"].newsChipActive {background:rgba(187,0,0,0.30);border-color:rgba(187,0,0,0.65);box-shadow:0 0 10px rgba(187,0,0,0.25);}
      .newsChip[data-newsfilter="cfb"].newsChipActive      {background:rgba(197,165,3,0.25);border-color:rgba(197,165,3,0.55);}
      .newsChip[data-newsfilter="nfl"].newsChipActive      {background:rgba(26,122,26,0.25);border-color:rgba(26,122,26,0.55);}
      .newsChip[data-newsfilter="mlb"].newsChipActive      {background:rgba(0,48,135,0.35);border-color:rgba(0,100,220,0.55);}
      .newsChip[data-newsfilter="nhl"].newsChipActive      {background:rgba(0,104,200,0.25);border-color:rgba(0,104,200,0.55);}

      @keyframes newsShimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
      .newsSkeleton{
        background:linear-gradient(90deg,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.10) 50%,rgba(255,255,255,0.04) 75%);
        background-size:400px 100%;animation:newsShimmer 1.4s ease-in-out infinite;border-radius:12px;
      }

      .newsHeroCard{
        position:relative;width:100%;min-height:220px;border-radius:18px;overflow:hidden;
        display:block;text-decoration:none;color:inherit;background:rgba(0,0,0,0.4);
        border:1px solid rgba(255,255,255,0.10);box-shadow:0 12px 36px rgba(0,0,0,0.45);
        margin-bottom:14px;opacity:0;transform:translateY(18px);
        transition:transform 0.22s ease,box-shadow 0.22s ease;
        -webkit-tap-highlight-color:transparent;
      }
      .newsHeroCard.newsVisible{animation:newsCardIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards;}
      .newsHeroCard:active{transform:scale(0.985);box-shadow:0 6px 18px rgba(0,0,0,0.50);}
      .newsHeroImg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;display:block;}
      .newsHeroScrim{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.08) 0%,rgba(0,0,0,0.20) 35%,rgba(0,0,0,0.80) 75%,rgba(0,0,0,0.92) 100%);}
      .newsHeroBody{position:relative;z-index:2;padding:130px 14px 16px;}
      .newsHeroMeta{display:flex;align-items:center;gap:7px;margin-bottom:8px;flex-wrap:wrap;}
      .newsHeroWhen{font-size:11px;font-weight:800;letter-spacing:0.4px;color:rgba(255,255,255,0.55);}
      .newsHeroHeadline{font-size:20px;font-weight:1000;line-height:1.22;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,0.60);margin-bottom:8px;}
      .newsHeroDesc{font-size:13px;font-weight:700;line-height:1.4;color:rgba(255,255,255,0.78);}
      .newsHeroFeaturedLabel{
        position:absolute;top:12px;left:12px;z-index:3;font-size:10px;font-weight:1000;
        letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.80);
        background:rgba(0,0,0,0.45);border:1px solid rgba(255,255,255,0.18);
        padding:3px 9px;border-radius:999px;
      }

      .newsListCard{
        display:block;text-decoration:none;color:inherit;background:rgba(0,0,0,0.22);
        border:1px solid rgba(255,255,255,0.09);border-radius:14px;overflow:hidden;
        box-shadow:0 4px 14px rgba(0,0,0,0.28);margin-bottom:10px;opacity:0;
        transform:translateY(14px);-webkit-tap-highlight-color:transparent;
        transition:transform 0.18s ease,box-shadow 0.18s ease;
      }
      .newsListCard.newsVisible{animation:newsCardIn 0.38s cubic-bezier(0.22,1,0.36,1) forwards;}
      .newsListCard:active{transform:scale(0.980);box-shadow:0 2px 8px rgba(0,0,0,0.40);}
      .newsListInner{display:flex;align-items:stretch;}
      .newsListThumb{width:100px;min-width:100px;height:90px;object-fit:cover;object-position:center;display:block;flex-shrink:0;background:rgba(255,255,255,0.06);}
      .newsListThumbFallback{width:100px;min-width:100px;height:90px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:rgba(255,255,255,0.05);font-size:22px;}
      .newsListText{flex:1;padding:10px 12px 10px 11px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;}
      .newsListHeadline{font-size:14px;font-weight:900;line-height:1.28;color:rgba(255,255,255,0.95);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px;}
      .newsListMeta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
      .newsListWhen{font-size:11px;font-weight:700;color:rgba(255,255,255,0.42);letter-spacing:0.2px;}
      .newsSourceDot{font-size:10px;font-weight:800;letter-spacing:0.4px;color:rgba(255,255,255,0.30);text-transform:uppercase;}

      @keyframes newsCardIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      .newsNotice{text-align:center;padding:40px 20px;color:rgba(255,255,255,0.45);font-size:14px;font-weight:800;letter-spacing:0.3px;}
      .newsCacheLine{font-size:11px;font-weight:700;color:rgba(255,255,255,0.38);letter-spacing:0.3px;margin-top:6px;}
    `;
    document.head.appendChild(style);
  }

  // -----------------------------
  // Filter helpers
  // -----------------------------
  function loadNewsFilter() { return safeGetLS(NEWS_FILTER_KEY).trim() || "all"; }
  function saveNewsFilter(v) { safeSetLS(NEWS_FILTER_KEY, String(v||"all")); }
  let currentNewsFilter = loadNewsFilter();

  function tagNewsItem(it) {
    const t = norm(`${it?.headline||""} ${it?.description||""} ${it?.source||""}`);
    const tags = [];
    if (
      t.includes("ohio state")||t.includes("buckeyes")||t.includes("ryan day")||
      t.includes("eleven warriors")||(t.includes("columbus")&&t.includes("football"))||
      t.includes("osu ")||it?.source==="Eleven Warriors"||it?._osuFeed===true
    ) tags.push("buckeyes");
    if (t.includes("college football")||t.includes("cfb")||(t.includes("ncaa")&&t.includes("football"))||t.includes("transfer portal")||t.includes("heisman")||t.includes("bowl")) tags.push("cfb");
    if (t.includes("nfl")||t.includes("super bowl")||(t.includes("draft")&&t.includes("nfl"))) tags.push("nfl");
    if (t.includes("mlb")||t.includes("baseball")||t.includes("spring training")) tags.push("mlb");
    if (t.includes("nhl")||t.includes("hockey")||t.includes("stanley cup")) tags.push("nhl");
    tags.push("all");
    return Array.from(new Set(tags));
  }

  function passesNewsFilter(it, filterKey) {
    if (!filterKey||filterKey==="all") return true;
    return (it?.tags||[]).includes(filterKey);
  }

  // Sort purely by publish time — newest first, no sport boosts
  function sortByNewest(items) {
    return [...(items||[])].sort((a, b) => (Number(b.publishedTs||0)) - (Number(a.publishedTs||0)));
  }

  function dedupeNewsItems(items) {
    const seen = new Set(), out = [];
    for (const it of (items||[])) {
      const key = norm(it?.link||"")||norm(it?.headline||"");
      if (!key||seen.has(key)) continue;
      seen.add(key); out.push(it);
    }
    return out;
  }

  function buildNewsFiltersRowHTML(activeKey) {
    const filters = [
      {key:"all",label:"All"},{key:"buckeyes",label:"🏈 Buckeyes"},
      {key:"cfb",label:"CFB"},{key:"nfl",label:"NFL"},
      {key:"mlb",label:"MLB"},{key:"nhl",label:"NHL"}
    ];
    const chips = filters.map(f => {
      const on = f.key===activeKey;
      return `<button class="newsChip${on?" newsChipActive":""}" data-newsfilter="${f.key}">${f.label}</button>`;
    }).join("");
    return `<div style="display:flex;gap:7px;flex-wrap:nowrap;overflow-x:auto;padding:10px 0 4px;-webkit-overflow-scrolling:touch;scrollbar-width:none;">${chips}</div>`;
  }

  // -----------------------------
  // Cache
  // -----------------------------
  function loadNewsCache() {
    const raw = safeGetLS(NEWS_CACHE_KEY);
    if (!raw) return null;
    try { const o=JSON.parse(raw); return (o&&Array.isArray(o.items))?o:null; } catch { return null; }
  }
  function saveNewsCache(items, label) {
    safeSetLS(NEWS_CACHE_KEY, JSON.stringify({ts:Date.now(),updatedLabel:String(label||""),items:Array.isArray(items)?items:[]}));
  }

  // -----------------------------
  // Fetch helpers
  // -----------------------------
  async function fetchJsonWithTimeout(url, ms=9000) {
    const c=new AbortController(), t=setTimeout(()=>c.abort(),ms);
    try {
      const r=await fetch(url,{cache:"no-store",signal:c.signal});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  async function fetchTextWithTimeout(url, ms=9000) {
    const c=new AbortController(), t=setTimeout(()=>c.abort(),ms);
    try {
      const r=await fetch(url,{cache:"no-store",signal:c.signal});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } finally { clearTimeout(t); }
  }

  // Decode AllOrigins /get response — returns base64 data URI for some sites
  function decodeAllOriginsResponse(json) {
    const raw = json?.contents || "";
    if (!raw) return "";
    const b64match = raw.match(/^data:[^;]+;base64,(.+)$/s);
    if (b64match) {
      try { return atob(b64match[1]); } catch { return ""; }
    }
    return raw;
  }

  // -----------------------------
  // RSS parser
  // -----------------------------
  function parseRssItems(xmlText, opts={}) {
    const doc   = new DOMParser().parseFromString(xmlText, "text/xml");
    const items = Array.from(doc.querySelectorAll("item")).slice(0, 30);

    function txt(q, node) { return node.querySelector(q)?.textContent||""; }

    function rssImageUrl(node) {
      const enc = node.querySelector("enclosure");
      if (enc?.getAttribute("url")) return enc.getAttribute("url");
      const mc = node.querySelector("media\\:content")||node.getElementsByTagName("media:content")?.[0];
      const mt = node.querySelector("media\\:thumbnail")||node.getElementsByTagName("media:thumbnail")?.[0];
      return mc?.getAttribute?.("url")||mt?.getAttribute?.("url")||"";
    }

    function ensureLinkOrSearch(it) {
      if (it.link) return it.link;
      const q=encodeURIComponent(it.headline||"");
      return q?`https://www.espn.com/search/results?q=${q}`:"https://www.espn.com/";
    }

    return items.map(node=>{
      const title=txt("title",node), link=txt("link",node),
            desc=txt("description",node), pub=txt("pubDate",node);
      const publishedTs=Date.parse(pub);
      const it={
        headline:    sanitizeTTUNText(title),
        description: sanitizeTTUNText(String(desc||"").replace(/<[^>]*>/g,"").trim()),
        source:      opts.source||"ESPN",
        publishedIso:pub,
        publishedTs: Number.isFinite(publishedTs)?publishedTs:0,
        link:        link||"",
        imageUrl:    rssImageUrl(node)||"",
        _osuFeed:    opts._osuFeed||false
      };
      it.link=ensureLinkOrSearch(it);
      return it;
    }).filter(x=>x.headline);
  }

  // -----------------------------
  // Fetch: ESPN OSU team feed
  // -----------------------------
  async function fetchOSUTeamFeed() {
    function pickImg(a) {
      const c=[];
      if(Array.isArray(a?.images)) a.images.forEach(im=>{if(im?.url)c.push(im.url);if(im?.href)c.push(im.href);});
      [a?.image?.url,a?.image?.href,a?.thumbnail,a?.promoImage].forEach(u=>{if(u)c.push(u);});
      return c.filter(Boolean).find(u=>u.startsWith("https://"))||c[0]||"";
    }
    function norm2(a,opts={}) {
      const ts=Date.parse(a?.published||a?.publishedAt||"");
      const it={
        headline:    sanitizeTTUNText(a?.headline||a?.title||""),
        description: sanitizeTTUNText(a?.description||a?.summary||""),
        source:      opts.source||"ESPN",
        publishedIso:a?.published||"",
        publishedTs: Number.isFinite(ts)?ts:0,
        link:        a?.links?.web?.href||a?.links?.[0]?.href||a?.url||"",
        imageUrl:    pickImg(a),
        _osuFeed:    opts._osuFeed||false
      };
      if(!it.link){const q=encodeURIComponent(it.headline||"");it.link=q?`https://www.espn.com/search/results?q=${q}`:"https://www.espn.com/";}
      return it;
    }
    for(const url of [
      "https://site.api.espn.com/apis/site/v2/sports/football/college-football/news?team=194&limit=20",
      "https://site.api.espn.com/apis/v2/sports/football/college-football/news?team=194&limit=20"
    ]){
      try{
        const data=await fetchJsonWithTimeout(url,8000);
        const articles=Array.isArray(data?.articles)?data.articles:[];
        if(articles.length) return articles.slice(0,20).map(a=>norm2(a,{source:"ESPN · OSU",_osuFeed:true})).filter(x=>x.headline);
      }catch{}
    }
    return [];
  }

  // -----------------------------
  // Fetch: Eleven Warriors RSS
  // -----------------------------
  async function fetchElevenWarriors() {
    const EW_RSS = "https://www.elevenwarriors.com/rss.xml";

    try {
      const xml = await fetchTextWithTimeout(EW_RSS, 7000);
      const items = parseRssItems(xml, {source:"Eleven Warriors",_osuFeed:true});
      if (items.length) return items;
    } catch {}

    try {
      const json = await fetchJsonWithTimeout(
        `https://api.allorigins.win/get?url=${encodeURIComponent(EW_RSS)}`, 9000
      );
      const xml = decodeAllOriginsResponse(json);
      if (xml) {
        const items = parseRssItems(xml, {source:"Eleven Warriors",_osuFeed:true});
        if (items.length) return items;
      }
    } catch {}

    try {
      const data = await fetchJsonWithTimeout(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(EW_RSS)}&count=20`, 9000
      );
      if (data?.status === "ok" && Array.isArray(data?.items) && data.items.length) {
        return data.items.map(it => {
          const ts = Date.parse(it?.pubDate||"");
          return {
            headline:    sanitizeTTUNText(it?.title||""),
            description: sanitizeTTUNText(String(it?.description||"").replace(/<[^>]*>/g,"").trim()),
            source:      "Eleven Warriors",
            publishedIso: it?.pubDate||"",
            publishedTs:  Number.isFinite(ts)?ts:0,
            link:         it?.link||"",
            imageUrl:     it?.thumbnail||it?.enclosure?.link||"",
            _osuFeed:     true
          };
        }).filter(x=>x.headline);
      }
    } catch {}

    return [];
  }

  // -----------------------------
  // Fetch: General ESPN
  // -----------------------------
  async function fetchGeneralESPN() {
    function pickImg(a){
      const c=[];
      if(Array.isArray(a?.images))a.images.forEach(im=>{if(im?.url)c.push(im.url);if(im?.href)c.push(im.href);});
      [a?.image?.url,a?.image?.href,a?.thumbnail,a?.promoImage].forEach(u=>{if(u)c.push(u);});
      return c.filter(Boolean).find(u=>u.startsWith("https://"))||c[0]||"";
    }
    function norm2(a){
      const ts=Date.parse(a?.published||a?.publishedAt||"");
      const it={
        headline:    sanitizeTTUNText(a?.headline||a?.title||""),
        description: sanitizeTTUNText(a?.description||a?.summary||""),
        source:      "ESPN",
        publishedIso:a?.published||"",
        publishedTs: Number.isFinite(ts)?ts:0,
        link:        a?.links?.web?.href||a?.links?.[0]?.href||a?.url||"",
        imageUrl:    pickImg(a),
        _osuFeed:    false
      };
      if(!it.link){const q=encodeURIComponent(it.headline||"");it.link=q?`https://www.espn.com/search/results?q=${q}`:"https://www.espn.com/";}
      return it;
    }

    const bases=[
      "https://site.api.espn.com/apis/v2/sports/news?limit=50",
      "https://site.api.espn.com/apis/site/v2/sports/news?limit=50"
    ];
    for(const u of [...bases,...bases.map(withLangRegion)]){
      try{
        const data=await fetchJsonWithTimeout(u,9000);
        const articles=Array.isArray(data?.articles)?data.articles:[];
        if(articles.length) return articles.slice(0,30).map(norm2).filter(x=>x.headline);
      }catch{}
    }

    const rssUrl="https://www.espn.com/espn/rss/news";
    try { return parseRssItems(await fetchTextWithTimeout(rssUrl,9000)); } catch {}
    try {
      const json=await fetchJsonWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`,9000);
      const xml=decodeAllOriginsResponse(json);
      if(xml) return parseRssItems(xml);
    } catch {}

    return [];
  }

  // -----------------------------
  // Master fetch — runs all 3 in parallel
  // -----------------------------
  async function fetchTopNewsItemsFromESPN() {
    const [osuItems, ewItems, generalItems] = await Promise.allSettled([
      fetchOSUTeamFeed(),
      fetchElevenWarriors(),
      fetchGeneralESPN()
    ]).then(r => r.map(x => x.status==="fulfilled" ? x.value : []));

    const allRaw = [...osuItems, ...ewItems, ...generalItems];
    if (!allRaw.length) throw new Error("All news sources failed");

    const tagged  = allRaw.map(it => ({...it, tags: tagNewsItem(it)}));
    const deduped = dedupeNewsItems(tagged);
    // Sort purely newest → oldest (no sport score boosts)
    const sorted  = sortByNewest(deduped);
    return sorted.slice(0, 30); // 30 articles so filters always have enough
  }

  // -----------------------------
  // Sport fallback emoji
  // -----------------------------
  function sportEmoji(tags) {
    if ((tags||[]).includes("buckeyes")||(tags||[]).includes("cfb")||(tags||[]).includes("nfl")) return "🏈";
    if ((tags||[]).includes("mlb")) return "⚾";
    if ((tags||[]).includes("nhl")) return "🏒";
    return "📰";
  }

  // -----------------------------
  // Render
  // -----------------------------
  function renderNewsList(items, headerUpdatedLabel, cacheMetaLabel) {
    const content = document.getElementById("content");
    if (!content) return;
    injectNewsStyles();

    // Filter first, then sort newest→oldest within the filtered set
    const filtered = sortByNewest((items||[]).filter(it => passesNewsFilter(it, currentNewsFilter)));

    // Hero card — always the single most-recent article
    let heroHTML = "";
    const hero = filtered[0];
    if (hero) {
      const title      = escapeHtml(sanitizeTTUNText(hero?.headline||""));
      const desc       = escapeHtml(sanitizeTTUNText(hero?.description||""));
      const when       = hero?.publishedTs ? escapeHtml(timeAgoLabel(hero.publishedTs)) : "";
      const href       = hero?.link||`https://www.espn.com/search/results?q=${encodeURIComponent(hero?.headline||"")}`;
      const tagBadge   = buildTagBadge(getPrimaryTag(hero?.tags||[]));
      const imgUrl     = hero?.imageUrl||"";
      const srcLabel   = hero?.source ? escapeHtml(hero.source) : "";
      const imgTag     = imgUrl ? `<img class="newsHeroImg" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" onerror="this.style.display='none'">` : "";

      heroHTML = `
        <a class="newsHeroCard" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
          ${imgTag}
          <div class="newsHeroScrim"></div>
          <span class="newsHeroFeaturedLabel">Featured</span>
          <div class="newsHeroBody">
            <div class="newsHeroMeta">
              ${tagBadge}
              ${when?`<span class="newsHeroWhen">${when}</span>`:""}
              ${srcLabel?`<span class="newsHeroWhen" style="opacity:0.45;">${srcLabel}</span>`:""}
            </div>
            <div class="newsHeroHeadline">${title}</div>
            ${desc?`<div class="newsHeroDesc">${desc}</div>`:""}
          </div>
        </a>`;
    }

    // List cards — remaining articles, already sorted newest→oldest
    const listHTML = filtered.slice(1).map((it,idx) => {
      const title    = escapeHtml(sanitizeTTUNText(it?.headline||""));
      const when     = it?.publishedTs ? escapeHtml(timeAgoLabel(it.publishedTs)) : "";
      const href     = it?.link||`https://www.espn.com/search/results?q=${encodeURIComponent(it?.headline||"")}`;
      const tagBadge = buildTagBadge(getPrimaryTag(it?.tags||[]));
      const imgUrl   = it?.imageUrl||"";
      const srcLabel = it?.source ? escapeHtml(it.source) : "";
      const delay    = (idx*55)+120;
      const thumbEl  = imgUrl
        ? `<img class="newsListThumb" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='flex')">`
        : `<div class="newsListThumbFallback">${sportEmoji(it?.tags||[])}</div>`;

      return `
        <a class="newsListCard" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="animation-delay:${delay}ms;">
          <div class="newsListInner">
            ${thumbEl}
            <div class="newsListText">
              <div class="newsListHeadline">${title}</div>
              <div class="newsListMeta">
                ${tagBadge}
                ${when?`<span class="newsListWhen">${when}</span>`:""}
                ${srcLabel?`<span class="newsSourceDot">${srcLabel}</span>`:""}
              </div>
            </div>
          </div>
        </a>`;
    }).join("");

    const cacheLine = cacheMetaLabel
      ? `<div class="newsCacheLine">Last updated ${escapeHtml(cacheMetaLabel)}</div>` : "";

    content.innerHTML = `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Top News</h2>
            <span class="badge">ESPN + OSU</span>
          </div>
          <button class="smallBtn" data-newsaction="refresh">Refresh</button>
        </div>
        <div class="subline">
          <div>Headlines</div>
          <div>Updated ${escapeHtml(headerUpdatedLabel||"")}</div>
        </div>
        ${buildNewsFiltersRowHTML(currentNewsFilter)}
        ${cacheLine}
      </div>
      <div class="grid" style="padding-top:4px;">
        ${heroHTML}
        ${listHTML||(!heroHTML?`<div class="newsNotice">No headlines found for this filter.</div>`:"")}
      </div>`;

    requestAnimationFrame(() => {
      const heroEl = content.querySelector(".newsHeroCard");
      if (heroEl) setTimeout(()=>heroEl.classList.add("newsVisible"),30);
      content.querySelectorAll(".newsListCard").forEach((card,i)=>{
        setTimeout(()=>card.classList.add("newsVisible"),(i*55)+120);
      });
    });

    setTimeout(()=>replaceMichiganTextSafe(content),0);
    try { if(typeof window.updateRivalryBanner==="function") window.updateRivalryBanner(); } catch {}
  }

  // Skeleton loader
  function renderSkeletonLoader(headerUpdated) {
    const content=document.getElementById("content");
    if(!content) return;
    injectNewsStyles();
    const skCards=Array.from({length:5}).map(()=>`
      <div style="display:flex;background:rgba(0,0,0,0.20);border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;margin-bottom:10px;">
        <div class="newsSkeleton" style="width:100px;min-width:100px;height:90px;border-radius:0;"></div>
        <div style="flex:1;padding:12px;display:flex;flex-direction:column;gap:8px;">
          <div class="newsSkeleton" style="height:14px;border-radius:6px;width:90%;"></div>
          <div class="newsSkeleton" style="height:14px;border-radius:6px;width:70%;"></div>
          <div class="newsSkeleton" style="height:11px;border-radius:6px;width:40%;margin-top:4px;"></div>
        </div>
      </div>`).join("");
    content.innerHTML=`
      <div class="header">
        <div class="headerTop">
          <div class="brand"><h2 style="margin:0;">Top News</h2><span class="badge">ESPN + OSU</span></div>
          <button class="smallBtn" data-newsaction="refresh">Refresh</button>
        </div>
        <div class="subline"><div>Headlines</div><div>Updated ${escapeHtml(headerUpdated)}</div></div>
        ${buildNewsFiltersRowHTML(currentNewsFilter)}
      </div>
      <div class="grid" style="padding-top:4px;">
        <div class="newsSkeleton" style="width:100%;height:220px;border-radius:18px;margin-bottom:14px;"></div>
        ${skCards}
      </div>`;
  }

  async function renderTopNews(showLoading) {
    const content=document.getElementById("content");
    if(!content) return;
    const headerUpdated=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    if(showLoading) renderSkeletonLoader(headerUpdated);

    const cached=loadNewsCache();
    if(cached&&Array.isArray(cached.items)&&cached.items.length){
      renderNewsList(cached.items, headerUpdated, cached.updatedLabel||"");
      if((Date.now()-cached.ts)>NEWS_CACHE_TTL_MS) refreshTopNewsInBackground();
      return;
    }

    try {
      const items=await fetchTopNewsItemsFromESPN();
      const label=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
      saveNewsCache(items,label);
      renderNewsList(items,headerUpdated,label);
    } catch(e) {
      console.error("Top News fetch failed:",e);
      const fb=loadNewsCache();
      if(fb&&Array.isArray(fb.items)&&fb.items.length){ renderNewsList(fb.items,headerUpdated,fb.updatedLabel||""); return; }
      injectNewsStyles();
      content.innerHTML=`
        <div class="header">
          <div class="headerTop">
            <div class="brand"><h2 style="margin:0;">Top News</h2><span class="badge">ESPN + OSU</span></div>
            <button class="smallBtn" data-newsaction="refresh">Retry</button>
          </div>
          <div class="subline"><div>Headlines</div><div>Error</div></div>
          ${buildNewsFiltersRowHTML(currentNewsFilter)}
        </div>
        <div class="newsNotice">Headlines are down right now.<br/>Hit Retry and we'll run it back. 🏈</div>`;
    }
  }

  async function refreshTopNewsInBackground() {
    try {
      const fresh=await fetchTopNewsItemsFromESPN();
      const label=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
      saveNewsCache(fresh,label);
      const tab=window.__activeTab||window.currentTab||"";
      if(String(tab)==="news"){
        renderNewsList(fresh,new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}),label);
      }
    } catch {}
  }

  // -----------------------------
  // Click delegation
  // -----------------------------
  if(!window.__NEWS_CLICK_BOUND){
    document.addEventListener("click",e=>{
      const btn=e.target?.closest?.("button");
      if(!btn) return;
      const filterKey=btn.getAttribute("data-newsfilter");
      if(filterKey){
        currentNewsFilter=String(filterKey||"all");
        saveNewsFilter(currentNewsFilter);
        const cached=loadNewsCache();
        const hu=new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
        if(cached&&Array.isArray(cached.items)) renderNewsList(cached.items,hu,cached.updatedLabel||"");
        else renderTopNews(true);
        return;
      }
      if(btn.getAttribute("data-newsaction")==="refresh") renderTopNews(true);
    });
    window.__NEWS_CLICK_BOUND=true;
  }

  window.renderTopNews = renderTopNews;
  window.renderNews    = renderTopNews;

  try {
    const tab=window.__activeTab||window.currentTab||"";
    if(String(tab)==="news") setTimeout(()=>renderTopNews(true),0);
  } catch {}

})();
