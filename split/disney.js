// split/disney.js
// The Disney Page — parks, live wait times, and a random character.
// Admin-only for now (foundation page; family-pin gating comes later).
(function () {
  "use strict";

  // ============================================================
  // CONSTANTS
  // ============================================================
  const SPEED_KEY = "theShopDisneyCarouselSpeed_v1";
  const SPEED_OPTIONS = [5, 10, 15, 20, 25, 30];

  let __disneyParks = [];
  let __disneySelectedParkId = "";
  let __disneyRides = [];
  let __disneyRideIndex = 0;
  let __disneyCarouselTimer = null;

  // ============================================================
  // RENDER
  // ============================================================
  window.renderDisney = function renderDisney() {
    const content = document.getElementById("content");
    if (!content) return;
    _stopCarouselTimer();

    const stars = Array.from({ length: 16 }, () => {
      const top = Math.floor(Math.random() * 90);
      const left = Math.floor(Math.random() * 96) + 2;
      const delay = (Math.random() * 2.4).toFixed(2);
      const size = Math.random() < 0.25 ? 4 : 2;
      return `<span class="disney-star" style="top:${top}%;left:${left}%;animation-delay:${delay}s;width:${size}px;height:${size}px;"></span>`;
    }).join("");

    content.innerHTML = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap');

.disney-page {
  padding: 12px 12px 8px;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  font-family: 'Fredoka', -apple-system, system-ui, sans-serif;
}
.disney-section-label {
  font-size: 11px; font-weight: 800; text-transform: uppercase;
  letter-spacing: 1.2px; color: #8b7fc0; margin-bottom: -4px; padding-left: 2px;
}

/* HEADER */
.disney-header {
  position: relative; overflow: hidden; border-radius: 18px;
  padding: 30px 16px 24px; text-align: center;
  background: radial-gradient(ellipse at top, #2b1055 0%, #150f30 55%, #060414 100%);
  box-shadow: 0 8px 24px rgba(43,16,85,0.45);
}
.disney-star {
  position: absolute; background: #fff; border-radius: 50%; opacity: 0.85;
  animation: disneyTwinkle 2.6s ease-in-out infinite;
}
@keyframes disneyTwinkle { 0%,100% { opacity:.15; transform: scale(0.6); } 50% { opacity:1; transform: scale(1.2); } }
.disney-castle {
  position: relative; font-size: 46px; line-height: 1;
  filter: drop-shadow(0 0 16px rgba(255,215,130,0.55));
  animation: disneyFloat 4s ease-in-out infinite;
}
@keyframes disneyFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
.disney-title {
  position: relative; font-family: 'Fredoka', sans-serif; font-weight: 700;
  font-size: 27px; letter-spacing: 0.4px; margin: 10px 0 4px;
  background: linear-gradient(90deg, #ffd76a, #fff2c8, #ffd76a);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.disney-subtitle { position: relative; font-size: 12.5px; color: #c9c2e8; font-weight: 600; }

/* CARDS */
.disney-card {
  background: #181229; border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
}
.disney-parks-card { gap: 16px; }
.disney-card-header { display: flex; align-items: center; gap: 7px; }
.disney-card-icon { font-size: 16px; }
.disney-card-title { font-size: 13px; font-weight: 800; color: #fff; flex: 1; font-family: 'Fredoka', sans-serif; }
.disney-divider { height: 1px; background: rgba(255,255,255,0.08); }
.disney-loading { font-size: 12.5px; color: #8a7fc4; font-style: italic; padding: 4px 2px; }
.disney-credit { font-size: 9.5px; color: #4c4570; text-align: center; }

/* PARK PICKER */
.disney-park-picker {
  display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch;
}
.disney-park-chip {
  flex-shrink: 0; background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.12);
  color: #cfc8ea; font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 12.5px;
  padding: 9px 14px; border-radius: 99px; cursor: pointer; white-space: nowrap;
  transition: background .15s, border-color .15s, color .15s; min-height: 38px;
}
.disney-park-chip.active {
  background: linear-gradient(90deg,#7b3fe4,#b45cff); border-color: transparent; color: #fff;
  box-shadow: 0 3px 10px rgba(123,63,228,.45);
}

/* PARK CONTENT WRAPPER (hours + carousel + dots + settings) */
#disney-park-content {
  display: flex; flex-direction: column; gap: 16px;
}

/* HOURS */
.disney-hours-row {
  display: flex; align-items: center; justify-content: space-between;
  background: rgba(180,92,255,0.1); border: 1px solid rgba(180,92,255,0.25);
  border-radius: 12px; padding: 10px 12px;
}
.disney-hours-label { font-size: 10px; font-weight: 800; color: #b45cff; text-transform: uppercase; letter-spacing: .6px; }
.disney-hours-value { font-size: 14px; font-weight: 800; color: #fff; font-family: 'Fredoka', sans-serif; }

/* CAROUSEL */
.disney-rides-carousel-wrap { display: flex; align-items: center; gap: 10px; }
.disney-carousel-arrow {
  flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; border: none;
  background: rgba(255,255,255,0.08); color: #fff; font-size: 21px; cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: background .15s;
}
.disney-carousel-arrow:active { background: rgba(255,255,255,0.18); }
.disney-carousel-viewport { flex: 1; overflow: hidden; border-radius: 14px; touch-action: pan-y; }
.disney-carousel-track { display: flex; transition: transform .35s cubic-bezier(.22,.9,.36,1); }
.disney-ride-card {
  flex: 0 0 100%; box-sizing: border-box; padding: 20px 14px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  background: linear-gradient(160deg, rgba(123,63,228,0.16), rgba(24,18,41,0.4));
  border: 1px solid rgba(180,92,255,0.18); border-radius: 14px; text-align: center;
}
.disney-ride-name {
  font-family: 'Fredoka', sans-serif; font-weight: 700; font-size: 16px; color: #fff;
  line-height: 1.25; min-height: 40px; display: flex; align-items: center; justify-content: center;
}
.disney-wait-bubble {
  width: 76px; height: 76px; border-radius: 50%; display: flex; flex-direction: column;
  align-items: center; justify-content: center; font-family: 'Fredoka', sans-serif;
  font-weight: 800; font-size: 22px; color: #fff; box-shadow: 0 4px 14px rgba(0,0,0,0.35);
}
.disney-wait-unit { font-size: 9px; font-weight: 700; opacity: .85; margin-top: -2px; }
.disney-wait-green  { background: radial-gradient(circle at 35% 30%, #6be48a, #1fa855); }
.disney-wait-yellow { background: radial-gradient(circle at 35% 30%, #ffe066, #e0a800); }
.disney-wait-orange { background: radial-gradient(circle at 35% 30%, #ffb066, #e07800); }
.disney-wait-red    { background: radial-gradient(circle at 35% 30%, #ff7a7a, #d62828); }
.disney-wait-gray    { background: radial-gradient(circle at 35% 30%, #8a8a9a, #55556a); font-size: 11.5px; }
.disney-ride-status { font-size: 11px; font-weight: 700; color: #9d93c9; }

.disney-carousel-dots { display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
.disney-dot {
  width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.18);
  cursor: pointer; transition: background .15s, transform .15s;
}
.disney-dot.active { background: #b45cff; transform: scale(1.3); }

.disney-carousel-footer { display: flex; justify-content: center; }
.disney-settings-btn {
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #cfc8ea;
  font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 12px;
  padding: 8px 14px; border-radius: 99px; cursor: pointer;
}
.disney-settings-panel {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px; padding: 10px;
}
.disney-settings-title {
  font-size: 11px; font-weight: 700; color: #9d93c9; text-transform: uppercase;
  letter-spacing: .5px; margin-bottom: 8px; text-align: center;
}
.disney-speed-options { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.disney-speed-btn {
  background: rgba(255,255,255,0.06); border: 1.5px solid rgba(255,255,255,0.14); color: #cfc8ea;
  font-weight: 700; font-size: 12px; padding: 8px 12px; border-radius: 10px; cursor: pointer; min-width: 44px;
}
.disney-speed-btn.active {
  background: linear-gradient(90deg,#7b3fe4,#b45cff); border-color: transparent; color: #fff;
}

/* CHARACTER */
.disney-char-img { width: 100%; max-height: 220px; object-fit: contain; border-radius: 12px; background: rgba(255,255,255,0.04); display: block; }
.disney-char-name { font-family: 'Fredoka', sans-serif; font-weight: 800; font-size: 18px; color: #fff; text-align: center; margin-top: 4px; }
.disney-char-films { font-size: 12px; color: #b7adde; text-align: center; line-height: 1.5; }
.disney-btn {
  align-self: center; background: linear-gradient(90deg,#7b3fe4,#b45cff); color: #fff; border: none;
  border-radius: 10px; padding: 9px 16px; font-family: 'Fredoka', sans-serif; font-weight: 700;
  font-size: 13px; cursor: pointer; box-shadow: 0 4px 12px rgba(123,63,228,.4);
}
.disney-btn:active { opacity: .8; }
.disney-footer-row { display: flex; justify-content: center; }
</style>

<div class="disney-page">

  <div class="disney-header">
    ${stars}
    <div class="disney-castle">🏰</div>
    <div class="disney-title">Disney Corner</div>
    <div class="disney-subtitle">Parks, wait times &amp; a little pixie dust ✨</div>
  </div>

  <div class="disney-section-label">All About the Parks</div>
  <div class="disney-card disney-parks-card">
    <div class="disney-park-picker" id="disney-park-picker">
      <div class="disney-loading">Finding the parks…</div>
    </div>
    <div id="disney-park-loading" class="disney-loading" style="display:none;">Loading park info…</div>
    <div id="disney-park-content" style="display:none;">
      <div class="disney-hours-row">
        <div class="disney-hours-label">Today's Hours</div>
        <div class="disney-hours-value" id="disney-hours-value">—</div>
      </div>
      <div class="disney-rides-carousel-wrap">
        <button class="disney-carousel-arrow" id="disney-arrow-left" type="button" aria-label="Previous ride">‹</button>
        <div class="disney-carousel-viewport" id="disney-carousel-viewport">
          <div class="disney-carousel-track" id="disney-carousel-track"></div>
        </div>
        <button class="disney-carousel-arrow" id="disney-arrow-right" type="button" aria-label="Next ride">›</button>
      </div>
      <div class="disney-carousel-dots" id="disney-carousel-dots"></div>
      <div class="disney-carousel-footer">
        <button class="disney-settings-btn" id="disney-settings-btn" type="button">⚙️ Auto-advance: <span id="disney-speed-label">10s</span></button>
      </div>
      <div class="disney-settings-panel" id="disney-settings-panel" style="display:none;">
        <div class="disney-settings-title">Change ride every…</div>
        <div class="disney-speed-options" id="disney-speed-options"></div>
      </div>
    </div>
    <div id="disney-park-empty" class="disney-loading" style="display:none;">No rides open right now — check back soon!</div>
    <div class="disney-credit">Wait times &amp; hours via ThemeParks.wiki (unofficial)</div>
  </div>

  <div class="disney-section-label">Random Disney Character</div>
  <div class="disney-card" id="disney-character-card">
    <div class="disney-card-header">
      <span class="disney-card-icon">✨</span>
      <span class="disney-card-title">Meet a Disney Character</span>
    </div>
    <div class="disney-divider"></div>
    <div id="disney-char-loading" class="disney-loading">Sprinkling pixie dust…</div>
    <div id="disney-char-content" style="display:none;">
      <img id="disney-char-img" class="disney-char-img" src="" alt="" loading="lazy" />
      <div class="disney-char-name" id="disney-char-name"></div>
      <div class="disney-char-films" id="disney-char-films"></div>
    </div>
    <div class="disney-footer-row">
      <button class="disney-btn" type="button" onclick="window.__disneyLoadCharacter()">New Character ↻</button>
    </div>
  </div>

</div>
`;

    _bindCarouselControls();
    _loadDisneyParks();
    window.__disneyLoadCharacter();
  };

  // ============================================================
  // HELPERS
  // ============================================================
  function showContent(lid, cid) {
    const l = document.getElementById(lid), c = document.getElementById(cid);
    if (l) l.style.display = "none";
    if (c) c.style.display = "";
  }
  function showLoading(lid, cid) {
    const l = document.getElementById(lid), c = document.getElementById(cid);
    if (l) l.style.display = "";
    if (c) c.style.display = "none";
  }
  function setText(id, val) { const e = document.getElementById(id); if (e) e.textContent = val; }
  function safeFetch(url, ms = 9000) {
    return Promise.race([
      fetch(url),
      new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))
    ]);
  }
  function esc(str) { const d = document.createElement("div"); d.textContent = String(str); return d.innerHTML; }
  function escAttr(str) { return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;"); }

  // ============================================================
  // PARK LIST + SELECTION
  // ============================================================
  // Ordering: Magic Kingdom first, then the rest of Walt Disney World
  // (Florida), then Disneyland Resort (California), then everything
  // international (Paris, Hong Kong, Shanghai, Tokyo). Matched by resort
  // name from the API rather than hardcoded park IDs, so it keeps working
  // if the API adds/renames parks.
  function _parkTier(p) {
    const resort = (p.resort || "").toLowerCase();
    const name = (p.name || "").toLowerCase();
    if (name.includes("magic kingdom")) return 0;
    if (/paris|hong ?kong|shanghai|tokyo/.test(resort)) return 3;
    if (resort.includes("walt disney world")) return 1;
    if (resort.includes("disneyland")) return 2;
    return 3;
  }

  function _loadDisneyParks() {
    safeFetch("https://api.themeparks.wiki/v1/destinations", 10000)
      .then(r => r.json())
      .then(data => {
        const dests = Array.isArray(data?.destinations) ? data.destinations : [];
        const parks = [];
        dests.forEach(d => {
          if (!/disney/i.test(d?.name || "")) return;
          (d.parks || []).forEach(p => {
            if (p?.id && p?.name) parks.push({ id: p.id, name: p.name, resort: d.name || "" });
          });
        });
        parks.sort((a, b) => _parkTier(a) - _parkTier(b));
        __disneyParks = parks;
        const picker = document.getElementById("disney-park-picker");
        if (!picker) return;
        if (!parks.length) {
          picker.innerHTML = `<div class="disney-loading">No parks found right now.</div>`;
          return;
        }
        picker.innerHTML = parks.map(p =>
          `<button type="button" class="disney-park-chip" data-park-id="${escAttr(p.id)}" onclick="window.__disneySelectPark('${escAttr(p.id)}')">${esc(p.name)}</button>`
        ).join("");
        window.__disneySelectPark(parks[0].id);
      })
      .catch(() => {
        const picker = document.getElementById("disney-park-picker");
        if (picker) picker.innerHTML = `<div class="disney-loading">⚠️ Couldn't load the park list.</div>`;
      });
  }

  window.__disneySelectPark = function (parkId) {
    __disneySelectedParkId = parkId;
    document.querySelectorAll(".disney-park-chip").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-park-id") === parkId);
    });
    _stopCarouselTimer();
    showLoading("disney-park-loading", "disney-park-content");
    const emptyEl = document.getElementById("disney-park-empty");
    if (emptyEl) emptyEl.style.display = "none";

    Promise.all([
      safeFetch(`https://api.themeparks.wiki/v1/entity/${parkId}/schedule`, 10000).then(r => r.json()).catch(() => null),
      safeFetch(`https://api.themeparks.wiki/v1/entity/${parkId}/live`, 10000).then(r => r.json()).catch(() => null)
    ]).then(([schedule, live]) => {
      if (__disneySelectedParkId !== parkId) return; // a newer selection won the race
      _renderParkHours(schedule);
      _renderRideCarousel(live);
      showContent("disney-park-loading", "disney-park-content");
    }).catch(() => {
      if (__disneySelectedParkId !== parkId) return;
      const l = document.getElementById("disney-park-loading");
      if (l) l.textContent = "⚠️ Couldn't load this park. Try another!";
    });
  };

  function _renderParkHours(schedule) {
    const el = document.getElementById("disney-hours-value");
    if (!el) return;
    try {
      const tz = schedule?.timezone || null;
      const todayStr = new Date().toISOString().slice(0, 10);
      const entries = Array.isArray(schedule?.schedule) ? schedule.schedule : [];
      const today = entries.find(e => e.date === todayStr && e.type === "OPERATING")
        || entries.find(e => e.date === todayStr);
      if (!today || !today.openingTime || !today.closingTime) {
        el.textContent = "Closed today";
        return;
      }
      const fmt = (iso) => {
        const d = new Date(iso);
        const opts = { hour: "numeric", minute: "2-digit" };
        if (tz) opts.timeZone = tz;
        return d.toLocaleTimeString("en-US", opts);
      };
      el.textContent = `${fmt(today.openingTime)} – ${fmt(today.closingTime)}`;
    } catch {
      el.textContent = "—";
    }
  }

  // ============================================================
  // RIDE WAIT-TIME CAROUSEL
  // ============================================================
  function _statusLabel(status) {
    if (status === "OPERATING") return "Open";
    if (status === "DOWN") return "Temp. Down";
    if (status === "REFURBISHMENT") return "Refurbishing";
    if (status === "CLOSED") return "Closed";
    return "Unknown";
  }

  function _renderRideCarousel(live) {
    const list = Array.isArray(live?.liveData) ? live.liveData : [];
    const rides = list
      .filter(item => item.entityType === "ATTRACTION" && item.queue && item.queue.STANDBY)
      .map(item => ({
        name: item.name || "Ride",
        status: item.status || "UNKNOWN",
        wait: (item.status === "OPERATING" && typeof item.queue.STANDBY.waitTime === "number")
          ? item.queue.STANDBY.waitTime : null
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    __disneyRides = rides;
    __disneyRideIndex = 0;

    const track = document.getElementById("disney-carousel-track");
    const dots = document.getElementById("disney-carousel-dots");
    const empty = document.getElementById("disney-park-empty");
    const carouselWrap = document.querySelector(".disney-rides-carousel-wrap");
    const footer = document.querySelector(".disney-carousel-footer");

    if (!rides.length) {
      if (track) track.innerHTML = "";
      if (dots) dots.innerHTML = "";
      if (carouselWrap) carouselWrap.style.display = "none";
      if (footer) footer.style.display = "none";
      if (empty) empty.style.display = "";
      return;
    }
    if (carouselWrap) carouselWrap.style.display = "";
    if (footer) footer.style.display = "";
    if (empty) empty.style.display = "none";

    if (track) {
      track.innerHTML = rides.map(r => {
        const bubbleClass = r.wait === null ? "disney-wait-gray"
          : r.wait <= 20 ? "disney-wait-green"
          : r.wait <= 45 ? "disney-wait-yellow"
          : r.wait <= 70 ? "disney-wait-orange"
          : "disney-wait-red";
        const bubbleContent = r.wait === null
          ? `<span>${_statusLabel(r.status)}</span>`
          : `${r.wait}<span class="disney-wait-unit">min</span>`;
        return `
          <div class="disney-ride-card">
            <div class="disney-ride-name">${esc(r.name)}</div>
            <div class="disney-wait-bubble ${bubbleClass}">${bubbleContent}</div>
            <div class="disney-ride-status">${_statusLabel(r.status)}</div>
          </div>`;
      }).join("");
    }
    if (dots) {
      dots.innerHTML = rides.map((_, i) =>
        `<span class="disney-dot${i === 0 ? " active" : ""}" data-idx="${i}" onclick="window.__disneyGoToRide(${i})"></span>`
      ).join("");
    }
    _updateCarouselPosition();
    _restartCarouselTimer();
  }

  function _updateCarouselPosition() {
    const track = document.getElementById("disney-carousel-track");
    if (track) track.style.transform = `translateX(-${__disneyRideIndex * 100}%)`;
    document.querySelectorAll(".disney-dot").forEach((d, i) => d.classList.toggle("active", i === __disneyRideIndex));
  }

  window.__disneyGoToRide = function (idx) {
    if (!__disneyRides.length) return;
    __disneyRideIndex = ((idx % __disneyRides.length) + __disneyRides.length) % __disneyRides.length;
    _updateCarouselPosition();
    _restartCarouselTimer();
  };

  function _nextRide() { window.__disneyGoToRide(__disneyRideIndex + 1); }
  function _prevRide() { window.__disneyGoToRide(__disneyRideIndex - 1); }

  // ---- Auto-advance speed (persisted 5s-30s, in 5s steps) ----
  function _getSavedSpeed() {
    let s = 10;
    try {
      const raw = parseInt(localStorage.getItem(SPEED_KEY), 10);
      if (SPEED_OPTIONS.includes(raw)) s = raw;
    } catch {}
    return s;
  }
  function _saveSpeed(s) {
    try { localStorage.setItem(SPEED_KEY, String(s)); } catch {}
  }
  function _stopCarouselTimer() {
    if (__disneyCarouselTimer) { clearInterval(__disneyCarouselTimer); __disneyCarouselTimer = null; }
  }
  function _restartCarouselTimer() {
    _stopCarouselTimer();
    if (__disneyRides.length < 2) return;
    const seconds = _getSavedSpeed();
    __disneyCarouselTimer = setInterval(() => {
      if (!document.getElementById("disney-carousel-track")) { _stopCarouselTimer(); return; }
      _nextRide();
    }, seconds * 1000);
  }

  function _bindCarouselControls() {
    const left = document.getElementById("disney-arrow-left");
    const right = document.getElementById("disney-arrow-right");
    if (left) left.onclick = () => _prevRide();
    if (right) right.onclick = () => _nextRide();

    const settingsBtn = document.getElementById("disney-settings-btn");
    const panel = document.getElementById("disney-settings-panel");
    if (settingsBtn && panel) {
      settingsBtn.onclick = () => {
        panel.style.display = panel.style.display === "none" ? "" : "none";
      };
    }

    const speedWrap = document.getElementById("disney-speed-options");
    if (speedWrap) {
      const current = _getSavedSpeed();
      speedWrap.innerHTML = SPEED_OPTIONS.map(s =>
        `<button type="button" class="disney-speed-btn${s === current ? " active" : ""}" data-speed="${s}">${s}s</button>`
      ).join("");
      speedWrap.querySelectorAll(".disney-speed-btn").forEach(btn => {
        btn.onclick = () => {
          const s = parseInt(btn.getAttribute("data-speed"), 10);
          _saveSpeed(s);
          speedWrap.querySelectorAll(".disney-speed-btn").forEach(b => b.classList.toggle("active", b === btn));
          const label = document.getElementById("disney-speed-label");
          if (label) label.textContent = s + "s";
          _restartCarouselTimer();
          if (panel) panel.style.display = "none";
        };
      });
      const label = document.getElementById("disney-speed-label");
      if (label) label.textContent = current + "s";
    }

    // Swipe left/right on the carousel viewport
    const viewport = document.getElementById("disney-carousel-viewport");
    if (viewport) {
      let startX = null;
      viewport.addEventListener("pointerdown", (e) => { startX = e.clientX; });
      viewport.addEventListener("pointerup", (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (dx > 40) _prevRide();
        else if (dx < -40) _nextRide();
      });
      viewport.addEventListener("pointercancel", () => { startX = null; });
    }
  }

  // ============================================================
  // RANDOM DISNEY CHARACTER
  // ============================================================
  let __disneyCharCache = null; // one page's worth of characters, fetched once and reused

  window.__disneyLoadCharacter = function () {
    if (__disneyCharCache && __disneyCharCache.length) {
      _showRandomCachedCharacter();
      return;
    }
    showLoading("disney-char-loading", "disney-char-content");
    safeFetch("https://api.disneyapi.dev/character", 9000)
      .then(r => { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
      .then(data => {
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!list.length) throw new Error("empty character list");
        __disneyCharCache = list;
        _showRandomCachedCharacter();
      })
      .catch((err) => {
        console.error("[Disney] character load failed:", err);
        setText("disney-char-loading", "⚠️ Character API unavailable. Try again!");
      });
  };

  function _showRandomCachedCharacter() {
    const list = __disneyCharCache;
    const c = list[Math.floor(Math.random() * list.length)];
    if (!c) { setText("disney-char-loading", "⚠️ Character API unavailable. Try again!"); return; }
    const img = document.getElementById("disney-char-img");
    if (img) {
      img.src = c.imageUrl || "";
      img.alt = c.name || "Disney character";
      img.style.display = c.imageUrl ? "" : "none";
      img.onerror = () => { img.style.display = "none"; };
    }
    setText("disney-char-name", c.name || "Mystery Character");
    const credits = [...(c.films || []), ...(c.tvShows || [])].slice(0, 4);
    setText("disney-char-films", credits.length ? `Known from: ${credits.join(", ")}` : "A true Disney classic ✨");
    showContent("disney-char-loading", "disney-char-content");
  }

})();
