      </div>

      <div class="beatDivider"></div>

      <div id="beatHypeLine" class="beatHypeLine">${hypeLines[0]}</div>
      <div class="beatStreak ${streak.owner === "osu" ? "osu" : "ttun"}">${escapeHtml(streak.label)}</div>
    </div>

    <div class="notice">
      <div style="font-weight:800; letter-spacing:0.5px;">ALL-TIME RECORD</div>
      <div style="margin-top:6px; opacity:0.9;">TTUN are cheating bastards</div>

      <div class="rivalRecordRow">
        <div class="rivalTeam">
          <img class="rivalLogo" src="${OSU_LOGO}" alt="Ohio State logo" loading="lazy" decoding="async" />
          <div class="rivalText"><strong>Ohio State:</strong> ${THE_GAME_ALL_TIME.osuWins}</div>
        </div>

        <div class="rivalTeam">
          <img class="rivalLogo" src="${TTUN_LOGO}" alt="TTUN logo" loading="lazy" decoding="async" />
          <div class="rivalText"><strong>The Team Up North:</strong> ${THE_GAME_ALL_TIME.michWins}</div>
        </div>

        <div class="rivalTie"><strong>Ties:</strong> ${THE_GAME_ALL_TIME.ties}</div>
      </div>
    </div>

    <div class="notice">
      <div style="font-weight:800; letter-spacing:0.5px;">LAST 10 MATCHUPS</div>
      <div class="last10List">
        ${THE_GAME_LAST_10.map(g => {
          const winner = escapeHtml(String(g.winner || ""));
          const score  = escapeHtml(String(g.score || ""));
          return `
            <div class="last10Row">
              <div class="last10Year">${g.year}</div>
              <div class="last10Winner">${winner}</div>
              <div class="last10Score">${score}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  // Countdown tick (updates big days + h/m/s)
  const daysEl = document.getElementById("beatDays");
  const hrsEl  = document.getElementById("beatHrs");
  const minsEl = document.getElementById("beatMins");
  const secsEl = document.getElementById("beatSecs");

  const tick = () => {
    const ms = target.getTime() - Date.now();
    const p = countdownParts(ms);

    if (daysEl) daysEl.textContent = String(p.days);
    if (hrsEl)  hrsEl.textContent  = String(p.hrs).padStart(2, "0");
    if (minsEl) minsEl.textContent = String(p.mins).padStart(2, "0");
    if (secsEl) secsEl.textContent = String(p.secs).padStart(2, "0");
  };

  tick();
  beatCountdownTimer = setInterval(tick, 1000);

  // Rotate hype line every 5s
  const hypeEl = document.getElementById("beatHypeLine");
  let idx = 0;
  beatRotateTimer = setInterval(() => {
    idx = (idx + 1) % hypeLines.length;
    if (hypeEl) hypeEl.textContent = hypeLines[idx];
  }, 5000);
}

/* =========================
   TOP NEWS (ESPN) — Upgrade C
   - Instant render from cache + background refresh
   - Buckeye Boost sort
   - Filters (tiny + uses existing .smallBtn)
   - Dedupe + safer text sanitization (TTUN hard enforcement)
   ========================= */

const NEWS_CACHE_KEY = "theShopNewsCache_v2";
const NEWS_FILTER_KEY = "theShopNewsFilter_v1";
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let currentNewsFilter = (sessionStorage.getItem(NEWS_FILTER_KEY) || "all");

function buildBadWordRegex() {
  // Avoid embedding the banned word directly anywhere in source strings
  const a = ["Mi", "chigan"].join("");
  const b = ["Wol", "verines"].join("");
  return {
    a: new RegExp(a, "gi"),
    b: new RegExp(b, "gi")
  };
}

function sanitizeTTUNText(str) {
  const s = String(str || "");
  const rx = buildBadWordRegex();
  return s.replace(rx.a, "TTUN").replace(rx.b, "TTUN");
}

function loadNewsCache() {
  try {
    const raw = localStorage.getItem(NEWS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const ts = Number(parsed.ts || 0);
    if (!Number.isFinite(ts)) return null;

    const items = Array.isArray(parsed.items) ? parsed.items : null;
    if (!items) return null;

    return {
      ts,
      updatedLabel: String(parsed.updatedLabel || ""),
      items
    };
  } catch {
    return null;
  }
}

function saveNewsCache(items, updatedLabel) {
  try {
    localStorage.setItem(
      NEWS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), updatedLabel: updatedLabel || "", items: items || [] })
    );
  } catch {}
}

function timeAgoLabel(isoOrMs) {
  const t = typeof isoOrMs === "number" ? isoOrMs : Date.parse(String(isoOrMs || ""));
  if (!Number.isFinite(t)) return "";

  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr  = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24)  return `${hr}h ago`;
  if (day === 1) return "yesterday";
  return `${day}d ago`;
}

function scoreNewsItemForBuckeyeBoost(item) {
  const text = norm([item.headline, item.description, item.source].filter(Boolean).join(" "));
  let score = 0;

  // Boost terms (feel free to add later)
  const boosts = [
    { k: "ohio state", w: 80 },
    { k: "buckeyes", w: 80 },
    { k: "ryan day", w: 25 },
    { k: "columbus", w: 18 },
    { k: "big ten", w: 22 },
    { k: "cbb", w: 6 },
    { k: "cfb", w: 6 },
    { k: "college football", w: 14 },
    { k: "college basketball", w: 10 }
  ];

  for (const b of boosts) {
    if (text.includes(b.k)) score += b.w;
  }

  // Slightly favor fresher items
  const ts = Number(item.publishedTs || 0);
  if (Number.isFinite(ts) && ts > 0) {
    const ageMin = Math.max(0, (Date.now() - ts) / 60000);
    score += Math.max(0, 20 - Math.min(20, ageMin / 30)); // up to +20 for newest
  }

  return score;
}

function dedupeNewsItems(items) {
  const seen = new Set();
  const out = [];

  for (const it of items) {
    const key = norm(it.link || it.headline || "");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function tagNewsItem(it) {
  const t = norm([it.headline, it.description].join(" "));
  const tags = new Set();

  // Tiny keyword tagging (no UI redesign)
  if (t.includes("ohio state") || t.includes("buckeyes")) tags.add("buckeyes");
  if (t.includes("college football") || t.includes("cfb") || t.includes("ncaa football")) tags.add("cfb");
  if (t.includes("nfl")) tags.add("nfl");
  if (t.includes("mlb")) tags.add("mlb");
  if (t.includes("nhl")) tags.add("nhl");

  return Array.from(tags);
}

function passesNewsFilter(it, filterKey) {
  if (!filterKey || filterKey === "all") return true;
