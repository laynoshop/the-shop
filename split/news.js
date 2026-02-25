  const tags = Array.isArray(it.tags) ? it.tags : [];
  return tags.includes(filterKey);
}

function buildNewsFiltersRowHTML(activeKey) {
  // Uses existing .smallBtn styling to avoid redesign
  const btn = (key, label) => {
    const isOn = key === activeKey;
    // "active" class already exists for tabs; don’t reuse it here
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

async function fetchTopNewsItemsFromESPN() {
  // --- helpers (local to this function) ---
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
    // ESPN shapes vary by endpoint — try lots of common paths
    const candidates = [];

    // Most common: images: [{url, href, ...}]
    if (Array.isArray(a?.images)) {
      for (const im of a.images) {
        if (im?.url) candidates.push(im.url);
        if (im?.href) candidates.push(im.href);
      }
    }

    // Sometimes: image: { url }
    if (a?.image?.url) candidates.push(a.image.url);
    if (a?.image?.href) candidates.push(a.image.href);

    // Sometimes embedded in promo/thumbnail fields
    if (a?.thumbnail) candidates.push(a.thumbnail);
    if (a?.promoImage) candidates.push(a.promoImage);

    // Dedup + pick first usable https
    const cleaned = candidates
      .filter(Boolean)
      .map(String)
      .map(s => s.trim())
      .filter(s => s.length > 8);

    // Prefer https
    const httpsFirst = cleaned.find(u => u.startsWith("https://")) || cleaned[0] || "";
    return httpsFirst;
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
      // Try <enclosure url="...">
      const enc = node.querySelector("enclosure");
      const encUrl = enc?.getAttribute("url") || "";
      if (encUrl) return encUrl;

      // Try Media RSS tags (namespace can vary)
      // <media:content url="..."> or <media:thumbnail url="...">
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
        description: sanitizeTTUNText(desc.replace(/<[^>]*>/g, "").trim()),
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

  // --- 1) Try ESPN JSON (multiple endpoints + lang/region) ---
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

  // --- 2) Try ESPN RSS directly ---
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

  // --- 3) Try RSS via AllOrigins (CORS escape hatch) ---
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

function renderNewsList(items, headerUpdatedLabel, cacheMetaLabel) {
  const content = document.getElementById("content");

  const filtered = (items || []).filter(it => passesNewsFilter(it, currentNewsFilter));

  const categoryLabel = (currentNewsFilter || "all").toUpperCase();

  const cards = filtered.map((it) => {
    const safeTitle = sanitizeTTUNText(it.headline);
    const title = escapeHtml(safeTitle);

    const descText = sanitizeTTUNText(it.description || "");

    const when = it.publishedTs ? timeAgoLabel(it.publishedTs) : "";
    const sourceLabel = it.source ? escapeHtml(sanitizeTTUNText(it.source)) : "ESPN";

    const metaLine = [categoryLabel, sourceLabel, when ? escapeHtml(when) : ""].filter(Boolean).join(" • ");

    const href = it.link
      ? it.link
      : `https://www.espn.com/search/results?q=${encodeURIComponent(safeTitle || "")}`;

    const imgUrl = (it.imageUrl || "").trim();

    const imageBlock = imgUrl ? `
      <a href="${href}"
         target="_blank"
         rel="noopener noreferrer"
         style="display:block;text-decoration:none;">
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
      <a href="${href}"
         target="_blank"
         rel="noopener noreferrer"
         style="display:block;color:inherit;text-decoration:none;">
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
        <button class="smallBtn" onclick="renderTopNews(true)">Refresh</button>
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

  setTimeout(() => replaceMichiganText(document.getElementById("content") || document.body), 0);
}

async function renderTopNews(showLoading) {
  const content = document.getElementById("content");
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
          <button class="smallBtn" onclick="renderTopNews(true)">Refresh</button>
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
          <button class="smallBtn" onclick="renderTopNews(true)">Retry</button>
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

      if (currentTab === "news") {
        const headerUpdated2 = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        renderNewsList(fresh, headerUpdated2, cacheLabel);
      }
    } catch {
      // silent
    }
  }
}

/* =========================
   SHOP CHAT (Firebase / Firestore)
   - One shared room: rooms/main/messages
   ========================= */

const CHAT_ROOM_ID = "main";
let chatUnsub = null;
let chatReady = false;

function getChatDisplayName() {
  const key = "theShopChatName_v1";
  let name = (localStorage.getItem(key) || "").trim();
  if (!name) {
    name = prompt("Chat name (shown to the group):", "") || "";
    name = name.trim().slice(0, 30);
    if (name) localStorage.setItem(key, name);
  }
  return name || "Anon";
}

async function ensureFirebaseChatReady() {
  if (chatReady) return;

  if (!window.firebase || !firebase.initializeApp) {
    throw new Error("Firebase SDK not loaded. Check index.html script tags.");
  }

  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const auth = firebase.auth();
  if (!auth.currentUser) {
    await auth.signInAnonymously();
  }

  chatReady = true;
}

function stopShopChatRealtime() {
  if (typeof chatUnsub === "function") chatUnsub();
  chatUnsub = null;
}

async function startShopChatRealtime() {
  ensureChatDisplayName();
  await ensureFirebaseChatReady();
  stopShopChatRealtime();

  // show loading immediately
  const status = document.getElementById("chatStatusLine");
  if (status) status.textContent = "Loading chat…";

  const db = firebase.firestore();

  const q = db
    .collection("rooms")
    .doc(CHAT_ROOM_ID)
    .collection("messages")
    .orderBy("ts", "desc")
    .limit(50);

  let firstLoadDone = false;

  chatUnsub = q.onSnapshot(
    (snap) => {
      const items = [];
      snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
      items.reverse(); // oldest -> newest

      renderShopChatMessages(items);

      // ✅ Connected UI
      setChatConnectionStatus(true);

      // ✅ Stop saying "Loading…" after the first good snapshot
      if (!firstLoadDone) {
        firstLoadDone = true;
        if (status) status.textContent = ""; // or "Ready."
      } else {
        // keep it blank after initial load
        if (status) status.textContent = "";
      }
    },
    (error) => {
      console.error("Chat listener error:", error);

      // 🔴 Disconnected UI
      setChatConnectionStatus(false);

      // show error state
      if (status) status.textContent = "Chat unavailable — try again.";
    }
  );
}

function setChatConnectionStatus(isConnected) {
  const dot = document.getElementById("chatStatusDot");
  const text = document.getElementById("chatStatusText");

  if (!dot || !text) return;

  if (isConnected) {
    dot.classList.remove("offline");
    dot.classList.add("online");
    text.textContent = "Connected";
  } else {
    dot.classList.remove("online");
    dot.classList.add("offline");
    text.textContent = "Disconnected";
  }
}

function renderShopChatMessages(items) {
  const list = document.getElementById("chatList");
  if (!list) return;

  const myName = getChatDisplayName();

  const html = (items || []).map(m => {
    const sender = escapeHtml(sanitizeTTUNText(m?.name || "Anon"));
    const text = escapeHtml(sanitizeTTUNText(m?.text || ""));

    const t = m?.ts?.toDate ? m.ts.toDate() : null;
    const time = t ? t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";

    const isMine = (m?.name || "") === myName;

    return `
      <div class="chatMsgWrap ${isMine ? "mine" : ""}">
        <div class="chatMsgName">${sender}</div>
        <div class="chatMsgBubble ${isMine ? "mine" : ""}">
          <div class="chatMsgText">${text}</div>
          ${time ? `<div class="chatMsgTime">${escapeHtml(time)}</div>` : ``}
        </div>
      </div>
    `;
  }).join("");

  list.innerHTML = html || `<div class="notice">No messages yet. Start it up.</div>`;
