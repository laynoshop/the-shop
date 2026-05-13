// split/fun.js
// The Fun Page — mobile-first single-column layout
(function () {
  "use strict";

  // ============================================================
  // RENDER
  // ============================================================
  window.renderFun = function renderFun() {
    const content = document.getElementById("content");
    if (!content) return;

    content.innerHTML = `
<style>
/* ── TICKER STRIP ─────────────────────────────────────────── */
.ticker-strip-wrap {
  background: #111;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 2px;
}
.ticker-strip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px 5px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.ticker-strip-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #555;
}
.ticker-strip-refresh {
  font-size: 10px;
  color: #444;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.07);
  background: transparent;
  transition: color 0.15s, border-color 0.15s;
}
.ticker-strip-refresh:active { color: #bb0000; border-color: rgba(187,0,0,0.4); }
.ticker-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255,255,255,0.05);
  /* Reserve space so height never collapses on refresh */
  min-height: 78px;
}
.ticker-card {
  background: #111;
  padding: 9px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  /* Skeleton shimmer while refreshing */
  transition: opacity 0.2s;
}
.ticker-card.refreshing { opacity: 0.4; pointer-events: none; }
.ticker-sym {
  font-size: 11px;
  font-weight: 900;
  color: #ccc;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ticker-price {
  font-size: 14px;
  font-weight: 800;
  color: #fff;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.ticker-change {
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ticker-up   { color: #4caf50; }
.ticker-down { color: #ef5350; }
.ticker-flat { color: #888; }
.ticker-updated {
  font-size: 9px;
  color: #3a3a3a;
  text-align: right;
  padding: 4px 10px 5px;
}
/* ── STOCK SPOTLIGHT ──────────────────────────────────────── */
.spot-logo-wrap {
  width: 40px; height: 40px;
  border-radius: 10px;
  background: #222;
  border: 1px solid rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; flex-shrink: 0;
}
.spot-logo { width: 34px; height: 34px; object-fit: contain; }
.spot-logo-fallback {
  font-size: 17px; font-weight: 900; color: #ccc;
  line-height: 1; letter-spacing: -0.5px;
}
.spot-name { font-size: 15px; font-weight: 900; color: #fff; line-height: 1.2; }
.spot-ticker-badge {
  display: inline-block;
  font-size: 10px; font-weight: 800;
  background: rgba(187,0,0,0.15);
  color: #bb0000; border: 1px solid rgba(187,0,0,0.3);
  border-radius: 5px; padding: 1px 6px;
  letter-spacing: 0.3px;
}
.spot-exchange { font-size: 10px; color: #555; }
.spot-price-row {
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;
}
.spot-price {
  font-size: 26px; font-weight: 900; color: #fff;
  font-variant-numeric: tabular-nums; line-height: 1;
}
.spot-change {
  font-size: 13px; font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.spot-meta-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 6px; margin-top: 2px;
}
.spot-meta-item {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px; padding: 7px 9px;
}
.spot-meta-label {
  font-size: 9px; font-weight: 700;
  color: #555; text-transform: uppercase;
  letter-spacing: 0.5px; margin-bottom: 2px;
}
.spot-meta-val { font-size: 13px; font-weight: 800; color: #ddd; }
.spot-sector {
  font-size: 11px; color: #888;
  margin-top: 2px; line-height: 1.4;
}
.spot-desc {
  font-size: 12px; color: #aaa; line-height: 1.5;
}
/* News list */
.spot-news-item {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 9px; margin-top: 9px;
}
.spot-news-source {
  font-size: 9px; font-weight: 800; color: #bb0000;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 2px;
}
.spot-news-headline {
  font-size: 12px; font-weight: 700; color: #e0e0e0;
  line-height: 1.4; margin-bottom: 2px;
  cursor: pointer;
}
.spot-news-headline:hover { color: #fff; text-decoration: underline; }
.spot-news-time { font-size: 10px; color: #555; }
.spot-news-label {
  font-size: 10px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.8px;
  color: #444; margin-bottom: 4px;
}
/* ── rest of page ─────────────────────────────────────────── */
.fun-page {
  padding: 12px 12px 8px;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fun-section-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #555;
  margin-bottom: 2px;
  padding-left: 2px;
}
.fun-card {
  background: #1a1a1a;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fun-card-header { display: flex; align-items: center; gap: 7px; }
.fun-card-icon { font-size: 16px; line-height: 1; flex-shrink: 0; }
.fun-card-title { font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.1px; }
.fun-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 0; }
.fun-loading { font-size: 12px; color: #666; font-style: italic; }
.fun-media-row { display: flex; gap: 12px; align-items: flex-start; }
.fun-thumb { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #111; }
.fun-thumb-tall { width: 52px; height: 76px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: #111; }
.fun-thumb-poke { width: 72px; height: 72px; object-fit: contain; flex-shrink: 0; image-rendering: pixelated; }
.fun-media-info { flex: 1; min-width: 0; }
.poke-types { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.poke-type-badge { color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; text-transform: capitalize; }
.poke-stat-row { display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
.poke-stat-label { font-size: 9px; font-weight: 700; color: #666; width: 26px; flex-shrink: 0; }
.poke-stat-bar-bg { flex: 1; background: rgba(255,255,255,0.08); border-radius: 99px; height: 4px; overflow: hidden; }
.poke-stat-bar { height: 100%; background: #bb0000; border-radius: 99px; }
.poke-stat-val { font-size: 9px; color: #888; width: 20px; text-align: right; }
.trivia-category { font-size: 10px; font-weight: 700; color: #bb0000; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
.trivia-q { font-size: 13px; font-weight: 600; color: #eee; line-height: 1.4; margin-bottom: 8px; }
.trivia-choices { display: flex; flex-direction: column; gap: 5px; }
.trivia-choice {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #ccc;
  padding: 7px 10px; font-size: 12px;
  text-align: left; cursor: pointer;
  transition: background 0.15s;
}
.trivia-choice:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.trivia-correct { background: rgba(76,175,80,0.2) !important; border-color: #4caf50 !important; color: #a5d6a7 !important; }
.trivia-wrong   { background: rgba(187,0,0,0.1) !important; border-color: rgba(187,0,0,0.3) !important; color: #777 !important; }
.trivia-result  { font-size: 12px; font-weight: 700; margin-top: 4px; }
.trivia-win { color: #66bb6a; }
.trivia-lose { color: #ef5350; }
.joke-setup { font-size: 13px; color: #ddd; line-height: 1.5; }
.joke-punchline-wrap { background: rgba(187,0,0,0.1); border-left: 3px solid #bb0000; border-radius: 0 8px 8px 0; padding: 8px 10px; }
.joke-punchline { font-size: 13px; font-weight: 700; color: #fff; }
.bored-activity { font-size: 14px; font-weight: 700; color: #fff; line-height: 1.4; }
.bored-meta { font-size: 11px; color: #666; margin-top: 2px; }
.movie-title { font-size: 14px; font-weight: 900; color: #fff; line-height: 1.3; margin-bottom: 1px; }
.movie-meta { font-size: 11px; color: #888; margin-bottom: 3px; }
.movie-rating { font-size: 12px; font-weight: 700; color: #f5a623; margin-bottom: 4px; }
/* Expandable text */
.expandable-text {
  font-size: 12px; color: #aaa; line-height: 1.45;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  cursor: pointer;
  transition: all 0.2s;
}
.expandable-text.expanded {
  display: block;
  -webkit-line-clamp: unset;
  overflow: visible;
}
.expand-hint {
  font-size: 11px; color: #bb0000; font-weight: 700;
  cursor: pointer; margin-top: 2px; display: inline-block;
}
.cocktail-name { font-size: 14px; font-weight: 900; color: #fff; margin-bottom: 2px; }
.cocktail-glass { font-size: 11px; color: #888; margin-bottom: 5px; }
.cocktail-ing-title { font-size: 10px; font-weight: 700; color: #bb0000; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px; }
.cocktail-ing-item { font-size: 12px; color: #bbb; line-height: 1.6; }
.country-flag { font-size: 40px; line-height: 1; margin-bottom: 6px; }
.country-clues { font-size: 12px; color: #bbb; line-height: 1.8; margin-bottom: 8px; }
.country-input-wrap { display: flex; gap: 6px; align-items: center; }
.country-result { font-size: 13px; font-weight: 700; margin-top: 6px; min-height: 18px; }
.country-answer { font-size: 11px; color: #777; margin-top: 2px; }
/* ON THIS DAY */
.otd-year { font-size: 28px; font-weight: 900; color: #bb0000; line-height: 1; margin-bottom: 4px; }
.otd-text { font-size: 13px; color: #ddd; line-height: 1.5; }
.otd-date-label { font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
/* NASA APOD */
.apod-img { width: 100%; border-radius: 10px; object-fit: cover; max-height: 220px; background: #111; display: block; }
.apod-title { font-size: 14px; font-weight: 900; color: #fff; margin-bottom: 3px; }
.apod-date { font-size: 10px; color: #666; margin-bottom: 5px; }
/* MARS WEATHER */
.mars-sol { font-size: 28px; font-weight: 900; color: #c1440e; line-height: 1; margin-bottom: 2px; }
.mars-sol-label { font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 6px; }
.mars-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
.mars-stat-card {
  background: rgba(193,68,14,0.1);
  border: 1px solid rgba(193,68,14,0.2);
  border-radius: 10px;
  padding: 9px 11px;
}
.mars-stat-label { font-size: 9px; font-weight: 800; color: #c1440e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
.mars-stat-val { font-size: 18px; font-weight: 900; color: #fff; line-height: 1; }
.mars-stat-unit { font-size: 10px; color: #888; margin-top: 1px; }
.mars-season { font-size: 11px; color: #888; margin-top: 4px; }
.mars-note { font-size: 10px; color: #555; font-style: italic; line-height: 1.4; margin-top: 6px; }
/* ISS */
.iss-coords { font-size: 22px; font-weight: 900; color: #fff; letter-spacing: -0.5px; line-height: 1.2; margin-bottom: 4px; }
.iss-label { font-size: 10px; font-weight: 700; color: #bb0000; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; }
.iss-location { font-size: 12px; color: #aaa; line-height: 1.5; white-space: pre-line; }
.iss-pulse { display: inline-block; width: 8px; height: 8px; background: #4caf50; border-radius: 50%; margin-right: 5px; animation: issPulse 1.4s ease-in-out infinite; }
@keyframes issPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
/* ISS MAP */
#iss-map {
  width: 100%;
  height: 200px;
  border-radius: 10px;
  overflow: hidden;
  background: #0d1117;
  margin-top: 4px;
  position: relative;
  z-index: 0;
}
.iss-map-credit { font-size: 9px; color: #444; text-align: right; margin-top: 2px; }
/* EARTHQUAKE */
.quake-mag { font-size: 36px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
.quake-place { font-size: 13px; font-weight: 700; color: #fff; line-height: 1.4; margin-bottom: 3px; }
.quake-meta { font-size: 11px; color: #888; line-height: 1.6; }
.quake-badge { display: inline-block; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 6px; }
.fun-btn {
  align-self: flex-start;
  background: #bb0000; color: #fff;
  border: none; border-radius: 8px;
  padding: 7px 13px; font-size: 12px;
  font-weight: 800; cursor: pointer;
  transition: opacity 0.15s; flex-shrink: 0;
}
.fun-btn:active { opacity: 0.75; }
.fun-btn-sm {
  background: transparent; color: #bb0000;
  border: 1.5px solid rgba(187,0,0,0.5);
  border-radius: 7px; padding: 6px 11px;
  font-size: 12px; font-weight: 700;
  cursor: pointer; flex-shrink: 0;
}
.fun-btn-sm:active { background: rgba(187,0,0,0.15); }
.fun-btn-share {
  background: #1a6e3c; color: #fff;
  border: none; border-radius: 8px;
  padding: 7px 13px; font-size: 12px;
  font-weight: 800; cursor: pointer;
  transition: opacity 0.15s; flex-shrink: 0;
}
.fun-btn-share:active { opacity: 0.75; }
.fun-input {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px; color: #fff;
  padding: 7px 10px; font-size: 13px;
  flex: 1; min-width: 0; outline: none;
}
.fun-input:focus { border-color: #bb0000; }
.fun-footer-row {
  display: flex; align-items: center;
  gap: 8px; flex-wrap: wrap;
}
</style>

<div class="fun-page">

  <!-- STOCK TICKER STRIP -->
  <div class="fun-section-label">📈 Markets</div>
  <div class="ticker-strip-wrap">
    <div class="ticker-strip-header">
      <span class="ticker-strip-label">Live Quotes · Finnhub</span>
      <button class="ticker-strip-refresh" onclick="window.__funLoadTicker()">↻ Refresh</button>
    </div>
    <div id="ticker-cards" class="ticker-cards"></div>
    <div class="ticker-updated" id="ticker-updated"></div>
  </div>

  <!-- STOCK SPOTLIGHT -->
  <div class="fun-card" id="fun-spotlight">
    <div class="fun-card-header">
      <span class="fun-card-icon">🔍</span>
      <span class="fun-card-title">Stock Spotlight</span>
    </div>
    <div class="fun-divider"></div>
    <div id="spot-loading" class="fun-loading">Loading company profile…</div>
    <div id="spot-content" style="display:none;">
      <!-- header row -->
      <div class="fun-media-row" style="align-items:center;margin-bottom:6px;">
        <div class="spot-logo-wrap">
          <img id="spot-logo-img" class="spot-logo" src="" alt="" style="display:none;" />
          <span id="spot-logo-fb" class="spot-logo-fallback"></span>
        </div>
        <div class="fun-media-info">
          <div class="spot-name" id="spot-name"></div>
          <div style="display:flex;align-items:center;gap:5px;margin-top:2px;flex-wrap:wrap;">
            <span class="spot-ticker-badge" id="spot-ticker-badge"></span>
            <span class="spot-exchange" id="spot-exchange"></span>
          </div>
        </div>
      </div>
      <!-- price -->
      <div class="spot-price-row">
        <span class="spot-price" id="spot-price"></span>
        <span class="spot-change" id="spot-change"></span>
      </div>
      <!-- sector / industry -->
      <div class="spot-sector" id="spot-sector"></div>
      <!-- stats grid -->
      <div class="spot-meta-grid" id="spot-meta-grid"></div>
      <!-- description -->
      <div class="expandable-text" id="spot-desc" onclick="window.__funToggleExpand('spot-desc','spot-desc-hint')"></div>
      <span class="expand-hint" id="spot-desc-hint" onclick="window.__funToggleExpand('spot-desc','spot-desc-hint')" style="display:none;"></span>
      <!-- news -->
      <div id="spot-news-wrap" style="display:none;">
        <div class="fun-divider" style="margin-top:8px;"></div>
        <div class="spot-news-label" style="margin-top:10px;">📰 Recent News</div>
        <div id="spot-news-list"></div>
      </div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadSpotlight()">New Stock ↻</button>
    </div>
  </div>

  <!-- JOKE -->
  <div class="fun-section-label">Humor</div>
  <div class="fun-card" id="fun-joke">
    <div class="fun-card-header">
      <span class="fun-card-icon">😂</span>
      <span class="fun-card-title">Random Joke</span>
    </div>
    <div class="fun-divider"></div>
    <div id="joke-loading" class="fun-loading">Loading joke…</div>
    <div id="joke-content" style="display:none;">
      <div class="joke-setup" id="joke-setup"></div>
      <div class="joke-punchline-wrap" id="joke-punchline-wrap" style="display:none;margin-top:8px;">
        <div class="joke-punchline" id="joke-punchline"></div>
      </div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn-sm" id="joke-reveal-btn" onclick="window.__funRevealPunchline()" style="display:none;">Reveal 👀</button>
      <button class="fun-btn" onclick="window.__funLoadJoke()">New Joke ↻</button>
    </div>
  </div>

  <!-- ON THIS DAY IN HISTORY -->
  <div class="fun-section-label">On This Day in History</div>
  <div class="fun-card" id="fun-otd">
    <div class="fun-card-header">
      <span class="fun-card-icon">📜</span>
      <span class="fun-card-title">On This Day</span>
    </div>
    <div class="fun-divider"></div>
    <div id="otd-loading" class="fun-loading">Digging through history…</div>
    <div id="otd-content" style="display:none;">
      <div class="otd-date-label" id="otd-date-label"></div>
      <div class="otd-year" id="otd-year"></div>
      <div class="otd-text" id="otd-text"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadOTD()">Another Event ↻</button>
    </div>
  </div>

  <!-- TRIVIA -->
  <div class="fun-section-label">Trivia</div>
  <div class="fun-card" id="fun-trivia">
    <div class="fun-card-header">
      <span class="fun-card-icon">🎯</span>
      <span class="fun-card-title">Daily Trivia</span>
    </div>
    <div class="fun-divider"></div>
    <div id="trivia-loading" class="fun-loading">Loading question…</div>
    <div id="trivia-content" style="display:none;">
      <div class="trivia-category" id="trivia-cat"></div>
      <div class="trivia-q" id="trivia-q"></div>
      <div class="trivia-choices" id="trivia-choices"></div>
      <div class="trivia-result" id="trivia-result"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" id="trivia-next" style="display:none;" onclick="window.__funLoadTrivia()">Next ↻</button>
    </div>
  </div>

  <!-- POKEMON -->
  <div class="fun-section-label">Pokémon of the Day</div>
  <div class="fun-card" id="fun-pokemon">
    <div class="fun-card-header">
      <span class="fun-card-icon">⚡</span>
      <span class="fun-card-title">Pokémon of the Day</span>
    </div>
    <div class="fun-divider"></div>
    <div id="poke-loading" class="fun-loading">Catching Pokémon…</div>
    <div id="poke-content" style="display:none;">
      <div class="fun-media-row">
        <img id="poke-img" class="fun-thumb-poke" src="" alt="" />
        <div class="fun-media-info">
          <div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:5px;" id="poke-name"></div>
          <div class="poke-types" id="poke-types"></div>
          <div id="poke-stats"></div>
        </div>
      </div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadPokemon()">New Pokémon ↻</button>
    </div>
  </div>

  <!-- BORED -->
  <div class="fun-section-label">Activity Generator</div>
  <div class="fun-card" id="fun-bored">
    <div class="fun-card-header">
      <span class="fun-card-icon">🎲</span>
      <span class="fun-card-title">Bored? Try This</span>
    </div>
    <div class="fun-divider"></div>
    <div id="bored-loading" class="fun-loading">Finding something fun…</div>
    <div id="bored-content" style="display:none;">
      <div class="bored-activity" id="bored-activity"></div>
      <div class="bored-meta" id="bored-meta"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadBored()">Another Idea ↻</button>
    </div>
  </div>

  <!-- MOVIE -->
  <div class="fun-section-label">Movie Spotlight</div>
  <div class="fun-card" id="fun-movie">
    <div class="fun-card-header">
      <span class="fun-card-icon">🎬</span>
      <span class="fun-card-title">Movie Spotlight</span>
    </div>
    <div class="fun-divider"></div>
    <div id="movie-loading" class="fun-loading">Finding a film…</div>
    <div id="movie-content" style="display:none;">
      <div class="fun-media-row">
        <img id="movie-poster" class="fun-thumb-tall" src="" alt="" loading="lazy" />
        <div class="fun-media-info">
          <div class="movie-title" id="movie-title"></div>
          <div class="movie-meta" id="movie-year"></div>
          <div class="movie-rating" id="movie-rating"></div>
          <div class="expandable-text" id="movie-plot" onclick="window.__funToggleExpand('movie-plot','movie-plot-hint')"></div>
          <span class="expand-hint" id="movie-plot-hint" onclick="window.__funToggleExpand('movie-plot','movie-plot-hint')" style="display:none;">Read more ▾</span>
        </div>
      </div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadMovie()">New Movie ↻</button>
    </div>
  </div>

  <!-- COCKTAIL -->
  <div class="fun-section-label">Cocktail Recipe</div>
  <div class="fun-card" id="fun-cocktail">
    <div class="fun-card-header">
      <span class="fun-card-icon">🍸</span>
      <span class="fun-card-title">Random Cocktail</span>
    </div>
    <div class="fun-divider"></div>
    <div id="cocktail-loading" class="fun-loading">Mixing a drink…</div>
    <div id="cocktail-content" style="display:none;">
      <div class="fun-media-row">
        <img id="cocktail-img" class="fun-thumb" src="" alt="" loading="lazy" />
        <div class="fun-media-info">
          <div class="cocktail-name" id="cocktail-name"></div>
          <div class="cocktail-glass" id="cocktail-glass"></div>
          <div class="cocktail-ing-title">Ingredients</div>
          <div id="cocktail-ingredients"></div>
        </div>
      </div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn-share" id="cocktail-share-btn" onclick="window.__funShareCocktail()" style="display:none;">📤 Share with Friends</button>
      <button class="fun-btn" onclick="window.__funLoadCocktail()">New Drink ↻</button>
    </div>
  </div>

  <!-- COUNTRY GUESSER -->
  <div class="fun-section-label">Mini Game</div>
  <div class="fun-card" id="fun-country">
    <div class="fun-card-header">
      <span class="fun-card-icon">🌍</span>
      <span class="fun-card-title">Guess the Country</span>
    </div>
    <div class="fun-divider"></div>
    <div id="country-loading" class="fun-loading">Loading country…</div>
    <div id="country-content" style="display:none;">
      <div class="country-flag" id="country-flag"></div>
      <div class="country-clues" id="country-clues"></div>
      <div class="country-input-wrap">
        <input type="text" id="country-guess" class="fun-input" placeholder="Country name…" autocomplete="off" />
        <button class="fun-btn-sm" onclick="window.__funGuessCountry()">Guess ✓</button>
      </div>
      <div class="country-result" id="country-result"></div>
      <div class="country-answer" id="country-answer" style="display:none;"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadCountry()">New Country ↻</button>
    </div>
  </div>

  <!-- NASA APOD -->
  <div class="fun-section-label">NASA · Astronomy Picture of the Day</div>
  <div class="fun-card" id="fun-apod">
    <div class="fun-card-header">
      <span class="fun-card-icon">🔭</span>
      <span class="fun-card-title">NASA Picture of the Day</span>
    </div>
    <div class="fun-divider"></div>
    <div id="apod-loading" class="fun-loading">Fetching from NASA…</div>
    <div id="apod-content" style="display:none;">
      <img id="apod-img" class="apod-img" src="" alt="" loading="lazy" />
      <div style="margin-top:9px;">
        <div class="apod-title" id="apod-title"></div>
        <div class="apod-date" id="apod-date"></div>
        <div class="expandable-text" id="apod-expl" onclick="window.__funToggleExpand('apod-expl','apod-expl-hint')"></div>
        <span class="expand-hint" id="apod-expl-hint" onclick="window.__funToggleExpand('apod-expl','apod-expl-hint')" style="display:none;">Read more ▾</span>
      </div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn-share" id="apod-share-btn" onclick="window.__funShareApod()" style="display:none;">📤 Share with Daughters</button>
      <button class="fun-btn" onclick="window.__funLoadApod()">Random Day ↻</button>
    </div>
  </div>

  <!-- MARS WEATHER -->
  <div class="fun-section-label">NASA · Mars Weather</div>
  <div class="fun-card" id="fun-mars">
    <div class="fun-card-header">
      <span class="fun-card-icon">🔴</span>
      <span class="fun-card-title">Mars Weather</span>
    </div>
    <div class="fun-divider"></div>
    <div id="mars-loading" class="fun-loading">Contacting the Red Planet…</div>
    <div id="mars-content" style="display:none;">
      <div class="mars-sol-label" id="mars-sol-label"></div>
      <div class="mars-sol" id="mars-sol"></div>
      <div class="mars-grid">
        <div class="mars-stat-card">
          <div class="mars-stat-label">🌡️ High Temp</div>
          <div class="mars-stat-val" id="mars-high">—</div>
          <div class="mars-stat-unit">°F</div>
        </div>
        <div class="mars-stat-card">
          <div class="mars-stat-label">🥶 Low Temp</div>
          <div class="mars-stat-val" id="mars-low">—</div>
          <div class="mars-stat-unit">°F</div>
        </div>
        <div class="mars-stat-card">
          <div class="mars-stat-label">💨 Avg Wind</div>
          <div class="mars-stat-val" id="mars-wind">—</div>
          <div class="mars-stat-unit">mph</div>
        </div>
        <div class="mars-stat-card">
          <div class="mars-stat-label">📍 Location</div>
          <div class="mars-stat-val" style="font-size:12px;line-height:1.3;" id="mars-location">Jezero Crater</div>
          <div class="mars-stat-unit">Perseverance Rover</div>
        </div>
      </div>
      <div class="mars-season" id="mars-season"></div>
      <div class="mars-note" id="mars-note"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadMars()">Refresh ↻</button>
    </div>
  </div>

  <!-- ISS TRACKER -->
  <div class="fun-section-label">Live · International Space Station</div>
  <div class="fun-card" id="fun-iss">
    <div class="fun-card-header">
      <span class="fun-card-icon">🛸</span>
      <span class="fun-card-title">ISS Live Tracker</span>
    </div>
    <div class="fun-divider"></div>
    <div id="iss-loading" class="fun-loading">Locating the ISS…</div>
    <div id="iss-content" style="display:none;">
      <div class="iss-label"><span class="iss-pulse"></span>Live Position</div>
      <div class="iss-coords" id="iss-coords"></div>
      <div class="iss-location" id="iss-location"></div>
      <div id="iss-map"></div>
      <div class="iss-map-credit">© OpenStreetMap contributors</div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funRefreshISS()">Refresh ↻</button>
    </div>
  </div>

  <!-- USGS EARTHQUAKE -->
  <div class="fun-section-label">Live · USGS Earthquake Feed</div>
  <div class="fun-card" id="fun-quake">
    <div class="fun-card-header">
      <span class="fun-card-icon">🌎</span>
      <span class="fun-card-title">Latest Earthquake</span>
    </div>
    <div class="fun-divider"></div>
    <div id="quake-loading" class="fun-loading">Checking seismic activity…</div>
    <div id="quake-content" style="display:none;">
      <div id="quake-badge-wrap"></div>
      <div class="quake-mag" id="quake-mag"></div>
      <div class="quake-place" id="quake-place"></div>
      <div class="quake-meta" id="quake-meta"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadQuake()">Refresh ↻</button>
    </div>
  </div>

</div>
`;

    // Seed ticker cards immediately so there's no blank flash on first load
    _initTickerSkeleton();
    window.__funLoadTicker();
    window.__funLoadSpotlight();
    window.__funLoadJoke();
    window.__funLoadOTD();
    window.__funLoadTrivia();
    window.__funLoadPokemon();
    window.__funLoadBored();
    window.__funLoadMovie();
    window.__funLoadCocktail();
    window.__funLoadCountry();
    window.__funLoadApod();
    window.__funLoadMars();
    window.__funLoadISS();
    window.__funLoadQuake();

    setTimeout(() => {
      const g = document.getElementById("country-guess");
      if (g) g.addEventListener("keydown", e => { if (e.key === "Enter") window.__funGuessCountry(); });
    }, 50);

    if (window.__issInterval) clearInterval(window.__issInterval);
    window.__issInterval = setInterval(() => {
      if (document.getElementById("fun-iss")) window.__funRefreshISS();
      else clearInterval(window.__issInterval);
    }, 10000);

    // Auto-refresh ticker every 60 seconds — update in-place (no flash)
    if (window.__tickerInterval) clearInterval(window.__tickerInterval);
    window.__tickerInterval = setInterval(() => {
      if (document.getElementById("ticker-cards")) window.__funLoadTicker();
      else clearInterval(window.__tickerInterval);
    }, 60000);
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
  function setHTML(id, val) { const e = document.getElementById(id); if (e) e.innerHTML = val; }
  function safeFetch(url, ms = 8000) {
    return Promise.race([
      fetch(url),
      new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))
    ]);
  }
  function decodeHTML(str) {
    try { const t = document.createElement("textarea"); t.innerHTML = str; return t.value; } catch { return str; }
  }
  function escAttr(str) { return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;"); }
  function fmtLargeNum(n) {
    if (!n) return "—";
    if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
    if (n >= 1e9)  return "$" + (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6)  return "$" + (n / 1e6).toFixed(2) + "M";
    return "$" + n.toLocaleString();
  }

  // ============================================================
  // EXPANDABLE TEXT TOGGLE
  // ============================================================
  window.__funToggleExpand = function (textId, hintId) {
    const el = document.getElementById(textId);
    const hint = document.getElementById(hintId);
    if (!el) return;
    const expanded = el.classList.toggle("expanded");
    if (hint) hint.textContent = expanded ? "Show less ▴" : "Read more ▾";
  };

  function _initExpandable(textId, hintId, text) {
    const el = document.getElementById(textId);
    const hint = document.getElementById(hintId);
    if (!el) return;
    el.classList.remove("expanded");
    el.textContent = text;
    if (hint) {
      hint.textContent = "Read more ▾";
      hint.style.display = text && text.length > 120 ? "" : "none";
    }
  }

  // ============================================================
  // LEAFLET LOADER
  // ============================================================
  let __leafletReady = null;
  function _loadLeaflet() {
    if (__leafletReady) return __leafletReady;
    __leafletReady = new Promise((resolve) => {
      if (window.L) { resolve(window.L); return; }
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve(window.L);
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });
    return __leafletReady;
  }

  // ============================================================
  // 0. STOCK / CRYPTO TICKER  (Finnhub) — NO LAYOUT SHIFT
  // ============================================================
  const FINNHUB_KEY = "d81t7p9r01qrojfd4es0d81t7p9r01qrojfd4esg";

  const TICKER_SYMBOLS = [
    { sym: "WMT",             label: "WMT",  crypto: false },
    { sym: "BINANCE:XRPUSDT", label: "XRP",  crypto: true  },
    { sym: "XLE",             label: "XLE",  crypto: false },
    { sym: "DIS",             label: "DIS",  crypto: false },
    { sym: "QQQ",             label: "QQQ",  crypto: false },
    { sym: "MSFT",            label: "MSFT", crypto: false }
  ];

  // Pre-render skeleton cards immediately so the grid always has content
  function _initTickerSkeleton() {
    const cardsEl = document.getElementById("ticker-cards");
    if (!cardsEl || cardsEl.children.length) return;
    cardsEl.innerHTML = TICKER_SYMBOLS.map(t => `
      <div class="ticker-card refreshing" id="tc-${t.label}">
        <span class="ticker-sym">${t.label}</span>
        <span class="ticker-price" style="color:#333;">——</span>
        <span class="ticker-change ticker-flat">·</span>
      </div>`).join("");
  }

  window.__funLoadTicker = function () {
    const cardsEl = document.getElementById("ticker-cards");
    if (!cardsEl) return;

    // Dim existing cards instead of hiding them — zero layout shift
    cardsEl.querySelectorAll(".ticker-card").forEach(c => c.classList.add("refreshing"));

    const promises = TICKER_SYMBOLS.map(t =>
      safeFetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t.sym)}&token=${FINNHUB_KEY}`,
        8000
      )
        .then(r => r.json())
        .then(q => ({ ...t, c: q.c, pc: q.pc, d: q.d, dp: q.dp }))
        .catch(() => ({ ...t, c: null, pc: null, d: null, dp: null }))
    );

    Promise.all(promises).then(results => {
      if (!document.getElementById("ticker-cards")) return;

      results.forEach(r => {
        const price     = r.c  != null && r.c  !== 0 ? r.c  : null;
        const change    = r.d  != null              ? r.d  : null;
        const changePct = r.dp != null              ? r.dp : null;

        let priceStr  = price    != null ? (r.crypto ? "$" + price.toFixed(4) : "$" + price.toFixed(2)) : "—";
        let changeStr = "—";
        let cls       = "ticker-flat";

        if (change != null && changePct != null) {
          const sign = change >= 0 ? "+" : "";
          changeStr  = `${sign}${change.toFixed(2)} (${sign}${changePct.toFixed(2)}%)`;
          cls        = change > 0 ? "ticker-up" : change < 0 ? "ticker-down" : "ticker-flat";
        }
        const arrow = cls === "ticker-up" ? "▲" : cls === "ticker-down" ? "▼" : "";

        // Update existing card in-place — NO reflow / layout shift
        const card = document.getElementById(`tc-${r.label}`);
        if (card) {
          card.querySelector(".ticker-price").textContent = priceStr;
          const chEl = card.querySelector(".ticker-change");
          chEl.textContent = `${arrow} ${changeStr}`;
          chEl.className = `ticker-change ${cls}`;
          card.classList.remove("refreshing");
        }
      });

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setText("ticker-updated", `Updated ${timeStr} · 15-min delay`);
    });
  };

  // ============================================================
  // 0b. STOCK SPOTLIGHT — random pick from spotlight pool
  // ============================================================
  // Uses Finnhub profile2 + quote + stock/metric (for real 52W data) + company-news
  const SPOTLIGHT_POOL = [
    "AAPL","MSFT","GOOGL","AMZN","TSLA","META","NVDA","JPM","V","WMT",
    "DIS","NFLX","BA","XOM","KO","PEP","NKE","MCD","INTC","AMD",
    "CRM","PYPL","UBER","LYFT","SPOT","SNAP","SHOP","SQ","ROKU",
    "XLE","QQQ","SPY","GLD","BABA","TSM","SONY","TM","F","GM"
  ];

  window.__funLoadSpotlight = function () {
    showLoading("spot-loading", "spot-content");
    const sym = SPOTLIGHT_POOL[Math.floor(Math.random() * SPOTLIGHT_POOL.length)];

    Promise.all([
      safeFetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${FINNHUB_KEY}`, 8000).then(r => r.json()).catch(() => ({})),
      safeFetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`, 8000).then(r => r.json()).catch(() => ({})),
      // /stock/metric returns metric.52WeekHigh and metric.52WeekLow — the real annual range
      safeFetch(`https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${FINNHUB_KEY}`, 8000).then(r => r.json()).catch(() => ({})),
      safeFetch(`https://finnhub.io/api/v1/company-news?symbol=${sym}&from=${_daysAgo(7)}&to=${_today()}&token=${FINNHUB_KEY}`, 8000).then(r => r.json()).catch(() => ([]))
    ]).then(([profile, quote, metrics, news]) => {
      if (!document.getElementById("spot-content")) return;

      // Logo
      const logoImg = document.getElementById("spot-logo-img");
      const logoFb  = document.getElementById("spot-logo-fb");
      if (profile.logo && logoImg) {
        logoImg.src = profile.logo;
        logoImg.alt = profile.name || sym;
        logoImg.style.display = "";
        if (logoFb) logoFb.style.display = "none";
        logoImg.onerror = () => {
          logoImg.style.display = "none";
          if (logoFb) { logoFb.textContent = sym.slice(0, 2); logoFb.style.display = ""; }
        };
      } else {
        if (logoImg) logoImg.style.display = "none";
        if (logoFb) { logoFb.textContent = sym.slice(0, 2); logoFb.style.display = ""; }
      }

      setText("spot-name", profile.name || sym);
      setText("spot-ticker-badge", sym);
      setText("spot-exchange", profile.exchange ? profile.exchange : "");

      // Price
      const price = quote.c && quote.c !== 0 ? quote.c : null;
      const chg   = quote.d != null ? quote.d : null;
      const chgPct = quote.dp != null ? quote.dp : null;
      const spotPriceEl = document.getElementById("spot-price");
      if (spotPriceEl) spotPriceEl.textContent = price != null ? "$" + price.toFixed(2) : "—";
      const spotChgEl = document.getElementById("spot-change");
      if (spotChgEl) {
        if (chg != null && chgPct != null) {
          const sign = chg >= 0 ? "+" : "";
          spotChgEl.textContent = `${sign}${chg.toFixed(2)} (${sign}${chgPct.toFixed(2)}%)`;
          spotChgEl.className = "spot-change " + (chg > 0 ? "ticker-up" : chg < 0 ? "ticker-down" : "ticker-flat");
        } else {
          spotChgEl.textContent = "";
        }
      }

      // Sector + industry
      const parts = [profile.finnhubIndustry, profile.country ? "🌐 " + profile.country : ""].filter(Boolean);
      setText("spot-sector", parts.join("  ·  "));

      // 52W High/Low — from /stock/metric which has the real annual range
      const m = metrics.metric || {};
      const w52High = m["52WeekHigh"] != null ? "$" + parseFloat(m["52WeekHigh"]).toFixed(2) : "—";
      const w52Low  = m["52WeekLow"]  != null ? "$" + parseFloat(m["52WeekLow"]).toFixed(2)  : "—";

      // Stat grid
      const stats = [
        { label: "Mkt Cap",  val: fmtLargeNum(profile.marketCapitalization ? profile.marketCapitalization * 1e6 : null) },
        { label: "52W High", val: w52High },
        { label: "52W Low",  val: w52Low  },
        { label: "IPO",      val: profile.ipo || "—" }
      ];
      setHTML("spot-meta-grid", stats.map(s => `
        <div class="spot-meta-item">
          <div class="spot-meta-label">${s.label}</div>
          <div class="spot-meta-val">${s.val}</div>
        </div>`).join(""));

      // Description
      _initExpandable("spot-desc", "spot-desc-hint", profile.description || "No description available.");

      // News
      const newsWrap = document.getElementById("spot-news-wrap");
      const newsList = document.getElementById("spot-news-list");
      const topNews  = Array.isArray(news) ? news.slice(0, 4) : [];
      if (topNews.length && newsWrap && newsList) {
        newsList.innerHTML = topNews.map(n => {
          const t = n.datetime ? new Date(n.datetime * 1000).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
          const url = n.url ? ` onclick="window.open('${escAttr(n.url)}','_blank')"` : "";
          return `<div class="spot-news-item">
            <div class="spot-news-source">${n.source || ""}</div>
            <div class="spot-news-headline"${url}>${n.headline || ""}</div>
            <div class="spot-news-time">${t}</div>
          </div>`;
        }).join("");
        newsWrap.style.display = "";
      } else {
        if (newsWrap) newsWrap.style.display = "none";
      }

      showContent("spot-loading", "spot-content");
    }).catch(() => setText("spot-loading", "⚠️ Could not load company data. Tap New Stock."));
  };

  function _today() {
    return new Date().toISOString().slice(0, 10);
  }
  function _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  // ============================================================
  // 1. JOKE
  // ============================================================
  window.__funLoadJoke = function () {
    showLoading("joke-loading", "joke-content");
    const pw = document.getElementById("joke-punchline-wrap");
    const rb = document.getElementById("joke-reveal-btn");
    if (pw) pw.style.display = "none";
    if (rb) rb.style.display = "none";
    safeFetch("https://official-joke-api.appspot.com/random_joke")
      .then(r => r.json())
      .then(j => {
        setText("joke-setup", j.setup);
        setText("joke-punchline", j.punchline);
        showContent("joke-loading", "joke-content");
        if (rb) rb.style.display = "";
      })
      .catch(() => setText("joke-loading", "⚠️ Joke API unavailable."));
  };

  window.__funRevealPunchline = function () {
    const pw = document.getElementById("joke-punchline-wrap");
    const rb = document.getElementById("joke-reveal-btn");
    if (pw) pw.style.display = "";
    if (rb) rb.style.display = "none";
  };

  // ============================================================
  // 2. ON THIS DAY IN HISTORY
  // ============================================================
  let __otdEvents = [];
  let __otdIndex  = 0;

  window.__funLoadOTD = function () {
    showLoading("otd-loading", "otd-content");
    const now   = new Date();
    const month = now.getMonth() + 1;
    const day   = now.getDate();
    const monthNames = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];
    const dateLabel = `${monthNames[now.getMonth()]} ${day}`;

    if (__otdEvents.length > 0) {
      __otdIndex = (__otdIndex + 1) % __otdEvents.length;
      _showOTDEvent(__otdEvents[__otdIndex], dateLabel);
      return;
    }

    safeFetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${month}/${day}`, 8000)
      .then(r => r.json())
      .then(data => {
        const events = data.selected || data.events || [];
        if (!events.length) throw new Error("empty");
        __otdEvents = events.sort(() => Math.random() - 0.5);
        __otdIndex  = 0;
        _showOTDEvent(__otdEvents[0], dateLabel);
      })
      .catch(() => {
        safeFetch(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${month}/${day}`, 8000)
          .then(r => r.json())
          .then(data => {
            const events = data.selected || [];
            if (!events.length) throw new Error("empty");
            __otdEvents = events.sort(() => Math.random() - 0.5);
            __otdIndex  = 0;
            _showOTDEvent(__otdEvents[0], dateLabel);
          })
          .catch(() => setText("otd-loading", "⚠️ Couldn't load history. Try again."));
      });
  };

  function _showOTDEvent(evt, dateLabel) {
    setText("otd-date-label", dateLabel);
    setText("otd-year", evt.year ? String(evt.year) : "");
    setText("otd-text", evt.text || evt.description || "");
    showContent("otd-loading", "otd-content");
  }

  // ============================================================
  // 3. TRIVIA
  // ============================================================
  let __triviaCorrect = "";

  window.__funLoadTrivia = function () {
    showLoading("trivia-loading", "trivia-content");
    const nb = document.getElementById("trivia-next");
    if (nb) nb.style.display = "none";
    safeFetch("https://opentdb.com/api.php?amount=1&type=multiple")
      .then(r => r.json())
      .then(data => {
        const q = data.results[0];
        __triviaCorrect = decodeHTML(q.correct_answer);
        const answers = [...q.incorrect_answers.map(a => decodeHTML(a)), __triviaCorrect]
          .sort(() => Math.random() - 0.5);
        setText("trivia-cat", decodeHTML(q.category) + " · " + q.difficulty.toUpperCase());
        setText("trivia-q", decodeHTML(q.question));
        setHTML("trivia-result", "");
        const ch = document.getElementById("trivia-choices");
        if (ch) ch.innerHTML = answers.map(a =>
          `<button class="trivia-choice" onclick="window.__funCheckTrivia(this,'${escAttr(a)}')">${a}</button>`
        ).join("");
        showContent("trivia-loading", "trivia-content");
      })
      .catch(() => {
        setText("trivia-loading", "⚠️ Couldn't load. Tap Next.");
        const nb2 = document.getElementById("trivia-next");
        if (nb2) nb2.style.display = "";
      });
  };

  window.__funCheckTrivia = function (btn, answer) {
    document.querySelectorAll(".trivia-choice").forEach(b => {
      b.disabled = true;
      const bAns = b.getAttribute("onclick").match(/'([^']+)'\)$/)?.[1] || b.textContent;
      b.classList.add(bAns === __triviaCorrect ? "trivia-correct" : "trivia-wrong");
    });
    const right = answer === __triviaCorrect;
    setHTML("trivia-result", right
      ? `<span class="trivia-win">✅ Correct!</span>`
      : `<span class="trivia-lose">❌ Answer: <b>${__triviaCorrect}</b></span>`);
    const nb = document.getElementById("trivia-next");
    if (nb) nb.style.display = "";
  };

  // ============================================================
  // 4. POKEMON
  // ============================================================
  window.__funLoadPokemon = function () {
    showLoading("poke-loading", "poke-content");
    const id = Math.floor(Math.random() * 898) + 1;
    const typeColors = {
      fire:"#F08030",water:"#6890F0",grass:"#78C850",electric:"#F8D030",
      psychic:"#F85888",ice:"#98D8D8",dragon:"#7038F8",dark:"#705848",
      fairy:"#EE99AC",normal:"#A8A878",fighting:"#C03028",flying:"#A890F0",
      poison:"#A040A0",ground:"#E0C068",rock:"#B8A038",bug:"#A8B820",
      ghost:"#705898",steel:"#B8B8D0"
    };
    safeFetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
      .then(r => r.json())
      .then(p => {
        const img = document.getElementById("poke-img");
        if (img) {
          img.src = p.sprites?.other?.["official-artwork"]?.front_default || p.sprites?.front_default || "";
          img.alt = p.name;
        }
        setText("poke-name", p.name.charAt(0).toUpperCase() + p.name.slice(1));
        setHTML("poke-types", p.types.map(t =>
          `<span class="poke-type-badge" style="background:${typeColors[t.type.name]||'#888'}">${t.type.name}</span>`
        ).join(""));
        const key = { hp:"HP", attack:"ATK", defense:"DEF", speed:"SPD" };
        setHTML("poke-stats", p.stats.filter(s => key[s.stat.name]).map(s =>
          `<div class="poke-stat-row">
            <span class="poke-stat-label">${key[s.stat.name]}</span>
            <div class="poke-stat-bar-bg"><div class="poke-stat-bar" style="width:${Math.min(100,(s.base_stat/160)*100)}%"></div></div>
            <span class="poke-stat-val">${s.base_stat}</span>
          </div>`
        ).join(""));
        showContent("poke-loading", "poke-content");
      })
      .catch(() => setText("poke-loading", "⚠️ PokéAPI unavailable."));
  };

  // ============================================================
  // 5. BORED
  // ============================================================
  const BORED_POOL = [
    "Take a walk somewhere you've never been",
    "Learn 5 words in a new language",
    "Do 20 push-ups right now",
    "Text someone you haven't talked to in a while",
    "Cook something from scratch with what's in your fridge",
    "Draw something without lifting your pen",
    "Write down 3 things you're grateful for today",
    "Watch a documentary on a topic you know nothing about",
    "Find a new podcast and listen to one episode",
    "Do a 10-minute meditation or breathing exercise",
    "Read the first chapter of a book you've been putting off",
    "Rearrange one room or corner of your space",
    "Search 'random Wikipedia article' and read the whole thing",
    "Plan your perfect dream vacation in detail",
    "Try a new genre of music for 30 minutes",
    "Write a short story in exactly 6 sentences",
    "Learn a magic trick from YouTube",
    "Take 10 photos of interesting things around you",
    "Make a playlist for a specific mood",
    "Do a digital detox for the next hour"
  ];

  window.__funLoadBored = function () {
    showLoading("bored-loading", "bored-content");
    safeFetch("https://bored.api.lewagon.com/api/activity", 6000)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(b => { _showBoredResult(b.activity, b.type, b.participants, b.price); })
      .catch(() => {
        safeFetch("https://bored-api.appbrewery.com/random", 5000)
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(b => { _showBoredResult(b.activity, b.type, b.participants, b.price); })
          .catch(() => {
            const act = BORED_POOL[Math.floor(Math.random() * BORED_POOL.length)];
            _showBoredResult(act, "recreational", null, 0);
          });
      });
  };

  function _showBoredResult(activity, type, participants, price) {
    setText("bored-activity", activity || "");
    const parts = [
      type ? `🏷️ ${type.charAt(0).toUpperCase() + type.slice(1)}` : "",
      participants ? `👥 ${participants} participant${participants !== 1 ? "s" : ""}` : "",
      price === 0 ? "💸 Free" : ""
    ].filter(Boolean);
    setText("bored-meta", parts.join("  ·  "));
    showContent("bored-loading", "bored-content");
  }

  // ============================================================
  // 6. MOVIE
  // ============================================================
  const MOVIE_IDS = [
    "tt0111161","tt0068646","tt0071562","tt0468569","tt0050083",
    "tt0108052","tt0167260","tt0110912","tt0060196","tt0120737",
    "tt0137523","tt0109830","tt0080684","tt1375666","tt0816692",
    "tt0133093","tt0099685","tt0245429","tt0114369","tt0102926",
    "tt0317248","tt0118799","tt0120689","tt0114814","tt0047478",
    "tt0253474","tt0407887","tt0172495","tt0482571","tt0910970"
  ];

  window.__funLoadMovie = function () {
    showLoading("movie-loading", "movie-content");
    const id = MOVIE_IDS[Math.floor(Math.random() * MOVIE_IDS.length)];
    safeFetch(`https://www.omdbapi.com/?i=${id}&apikey=trilogy`)
      .then(r => r.json())
      .then(m => {
        if (m.Response === "False") throw new Error();
        const pe = document.getElementById("movie-poster");
        if (pe) {
          const hasPoster = m.Poster && m.Poster !== "N/A";
          pe.src = hasPoster ? m.Poster : "";
          pe.alt = m.Title || "";
          pe.style.display = hasPoster ? "" : "none";
        }
        setText("movie-title", m.Title || "");
        setText("movie-year", [m.Year, m.Genre].filter(v => v && v !== "N/A").join(" · "));
        setText("movie-rating", m.imdbRating && m.imdbRating !== "N/A" ? `⭐ ${m.imdbRating}/10` : "");
        _initExpandable("movie-plot", "movie-plot-hint", m.Plot && m.Plot !== "N/A" ? m.Plot : "");
        showContent("movie-loading", "movie-content");
      })
      .catch(() => setText("movie-loading", "⚠️ Movie API unavailable."));
  };

  // ============================================================
  // 7. COCKTAIL + SHARE
  // ============================================================
  let __currentCocktail = null;

  window.__funLoadCocktail = function () {
    showLoading("cocktail-loading", "cocktail-content");
    const shareBtn = document.getElementById("cocktail-share-btn");
    if (shareBtn) shareBtn.style.display = "none";
    safeFetch("https://www.thecocktaildb.com/api/json/v1/1/random.php")
      .then(r => r.json())
      .then(data => {
        const d = data.drinks[0];
        __currentCocktail = d;
        const ci = document.getElementById("cocktail-img");
        if (ci) { ci.src = d.strDrinkThumb || ""; ci.alt = d.strDrink || ""; ci.style.display = d.strDrinkThumb ? "" : "none"; }
        setText("cocktail-name", d.strDrink || "");
        setText("cocktail-glass", d.strGlass ? `🥃 ${d.strGlass}` : "");
        const ings = [];
        for (let i = 1; i <= 15; i++) {
          const ing = d[`strIngredient${i}`], meas = d[`strMeasure${i}`];
          if (ing?.trim()) ings.push(`${meas ? meas.trim() + " " : ""}${ing.trim()}`);
        }
        setHTML("cocktail-ingredients", ings.map(x => `<div class="cocktail-ing-item">• ${x}</div>`).join(""));
        showContent("cocktail-loading", "cocktail-content");
        if (shareBtn) shareBtn.style.display = "";
      })
      .catch(() => setText("cocktail-loading", "⚠️ Cocktail API unavailable."));
  };

  window.__funShareCocktail = function () {
    if (!__currentCocktail) return;
    const d = __currentCocktail;
    const ings = [];
    for (let i = 1; i <= 15; i++) {
      const ing = d[`strIngredient${i}`], meas = d[`strMeasure${i}`];
      if (ing?.trim()) ings.push(`${meas ? meas.trim() + " " : ""}${ing.trim()}`);
    }
    const msg =
      `🍸 ${d.strDrink}\n` +
      `🥃 Serve in: ${d.strGlass || "any glass"}\n\n` +
      `Ingredients:\n${ings.map(x => `• ${x}`).join("\n")}\n\n` +
      (d.strInstructions ? `How to make it:\n${d.strInstructions.slice(0, 280)}${d.strInstructions.length > 280 ? "..." : ""}` : "");
    if (navigator.share) {
      navigator.share({ title: `Cocktail: ${d.strDrink}`, text: msg }).catch(() => {});
    } else {
      window.open(`sms:?body=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  // ============================================================
  // 8. COUNTRY GUESSER
  // ============================================================
  let __currentCountry = null, __countryGuessed = false;

  window.__funLoadCountry = function () {
    showLoading("country-loading", "country-content");
    __countryGuessed = false;
    setText("country-result", "");
    const ca = document.getElementById("country-answer");
    if (ca) { ca.style.display = "none"; ca.textContent = ""; }
    const gi = document.getElementById("country-guess");
    if (gi) gi.value = "";
    safeFetch("https://restcountries.com/v3.1/all?fields=name,flags,capital,population,region")
      .then(r => r.json())
      .then(list => {
        __currentCountry = list[Math.floor(Math.random() * list.length)];
        const c = __currentCountry;
        const fe = document.getElementById("country-flag");
        if (fe) fe.textContent = c.flags?.emoji || "🏳️";
        const clues = [
          c.region ? `🌐 Region: ${c.region}` : "",
          c.capital?.[0] ? `🏛️ Capital starts with: <b>${c.capital[0][0]}…</b>` : "",
          c.population ? `👥 Pop: ~${(c.population / 1e6).toFixed(1)}M` : "",
          `🔤 ${c.name.common.length} letters`
        ].filter(Boolean);
        setHTML("country-clues", clues.join("<br/>"));
        showContent("country-loading", "country-content");
      })
      .catch(() => setText("country-loading", "⚠️ Countries API unavailable."));
  };

  window.__funGuessCountry = function () {
    if (!__currentCountry || __countryGuessed) return;
    const gi = document.getElementById("country-guess");
    const guess = (gi?.value || "").trim().toLowerCase();
    const correct = (__currentCountry.name.common || "").toLowerCase();
    const alts = [
      ...Object.values(__currentCountry.name?.nativeName || {}).map(n => (n.common || "").toLowerCase()),
      (__currentCountry.name?.official || "").toLowerCase()
    ];
    const right = guess === correct || alts.includes(guess);
    __countryGuessed = true;
    const re = document.getElementById("country-result");
    if (re) re.textContent = right ? "✅ Correct! Well done!" : "❌ Not quite!";
    const ae = document.getElementById("country-answer");
    if (ae) { ae.style.display = ""; ae.textContent = `Answer: ${__currentCountry.name.common}`; }
  };

  // ============================================================
  // 9. NASA APOD + SHARE
  // ============================================================
  let __currentApod = null;

  window.__funLoadApod = function () {
    showLoading("apod-loading", "apod-content");
    const shareBtn = document.getElementById("apod-share-btn");
    if (shareBtn) shareBtn.style.display = "none";

    const start = new Date("1995-06-16").getTime();
    const rnd   = new Date(start + Math.random() * (Date.now() - start));
    const dateStr = rnd.toISOString().slice(0, 10);

    function _renderApod(d) {
      __currentApod = d;
      const img = document.getElementById("apod-img");
      if (img) {
        const isImg = d.media_type === "image";
        img.src = isImg ? d.url : (d.thumbnail_url || "");
        img.alt = d.title || "NASA APOD";
        img.style.display = img.src ? "" : "none";
      }
      setText("apod-title", d.title || "");
      setText("apod-date", d.date || "");
      _initExpandable("apod-expl", "apod-expl-hint", d.explanation || "");
      showContent("apod-loading", "apod-content");
      if (shareBtn) shareBtn.style.display = "";
    }

    safeFetch(`https://api.nasa.gov/planetary/apod?date=${dateStr}&api_key=DEMO_KEY`, 10000)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(); _renderApod(d); })
      .catch(() => {
        safeFetch("https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY", 8000)
          .then(r => r.json())
          .then(d => _renderApod(d))
          .catch(() => setText("apod-loading", "⚠️ NASA API unavailable. Try again shortly."));
      });
  };

  window.__funShareApod = function () {
    if (!__currentApod) return;
    const d = __currentApod;
    const title  = d.title  || "NASA Astronomy Picture of the Day";
    const date   = d.date   || "";
    const expl   = d.explanation ? d.explanation.slice(0, 300) + (d.explanation.length > 300 ? "..." : "") : "";
    const imgUrl = d.media_type === "image" ? (d.hdurl || d.url || "") : (d.thumbnail_url || "");

    const msg =
      `🔭 NASA Picture of the Day — ${date}\n\n` +
      `"🌌 ${title}"\n\n` +
      (expl ? `${expl}\n\n` : "") +
      (imgUrl ? `🖼️ View image: ${imgUrl}\n\n` : "") +
      `⭐ From NASA's Astronomy Picture of the Day archive`;

    if (navigator.share) {
      navigator.share({
        title: `NASA APOD: ${title}`,
        text: msg,
        url: imgUrl || "https://apod.nasa.gov"
      }).catch(() => {});
    } else {
      window.open(`sms:?body=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  // ============================================================
  // 10. MARS WEATHER
  // ============================================================
  window.__funLoadMars = function () {
    showLoading("mars-loading", "mars-content");

    safeFetch("https://api.nasa.gov/insight_weather/?api_key=DEMO_KEY&feedtype=json&ver=1.0", 10000)
      .then(r => r.json())
      .then(data => {
        const sols = data.sol_keys || [];
        if (!sols.length) throw new Error("no sols");
        const latestSol = sols[sols.length - 1];
        const w = data[latestSol];

        const highF = w.AT?.mx != null ? Math.round((w.AT.mx * 9/5) + 32) : null;
        const lowF  = w.AT?.mn != null ? Math.round((w.AT.mn * 9/5) + 32) : null;
        const windMph = w.HWS?.av != null ? Math.round(w.HWS.av * 2.237) : null;
        const season = w.Season ? w.Season.charAt(0).toUpperCase() + w.Season.slice(1) : null;

        setText("mars-sol-label", "Martian Sol (Day)");
        setText("mars-sol", `Sol ${latestSol}`);
        setText("mars-high", highF != null ? String(highF) : "—");
        setText("mars-low",  lowF  != null ? String(lowF)  : "—");
        setText("mars-wind", windMph != null ? String(windMph) : "—");
        setText("mars-location", "Elysium Planitia");
        const loc = document.getElementById("mars-location");
        if (loc) loc.nextElementSibling.textContent = "InSight Lander";
        if (season) setText("mars-season", `🌱 Northern Hemisphere Season: ${season}`);
        setText("mars-note", "Data from NASA's InSight Mars Lander. 1 Martian sol ≈ 24h 37min.");
        showContent("mars-loading", "mars-content");
      })
      .catch(() => {
        safeFetch("https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json", 8000)
          .then(r => r.json())
          .then(data => {
            const reports = data.soles || [];
            if (!reports.length) throw new Error("no data");
            const latest = reports[0];
            setText("mars-sol-label", "Martian Sol (Day)");
            setText("mars-sol", `Sol ${latest.sol || "—"}`);
            const hi = latest.max_temp_fahrenheit != null ? Math.round(parseFloat(latest.max_temp_fahrenheit)) : null;
            const lo = latest.min_temp_fahrenheit != null ? Math.round(parseFloat(latest.min_temp_fahrenheit)) : null;
            setText("mars-high", hi != null ? String(hi) : "—");
            setText("mars-low",  lo  != null ? String(lo)  : "—");
            setText("mars-wind", "—");
            setText("mars-location", "Gale Crater");
            const locEl = document.getElementById("mars-location");
            if (locEl && locEl.nextElementSibling) locEl.nextElementSibling.textContent = "Curiosity Rover";
            if (latest.season) setText("mars-season", `🌱 Season: ${latest.season}`);
            setText("mars-note", "Data from NASA's Curiosity rover at Gale Crater. 1 Martian sol ≈ 24h 37min.");
            showContent("mars-loading", "mars-content");
          })
          .catch(() => {
            setText("mars-sol-label", "Martian Sol (Day) — Typical Values");
            setText("mars-sol", "Sol ????");
            setText("mars-high", "-10");
            setText("mars-low",  "-100");
            setText("mars-wind", "~11");
            setText("mars-location", "Jezero Crater");
            const locEl = document.getElementById("mars-location");
            if (locEl && locEl.nextElementSibling) locEl.nextElementSibling.textContent = "Perseverance Rover";
            setText("mars-season", "");
            setText("mars-note", "⚠️ Live Mars data temporarily unavailable. Showing typical Martian surface values for reference. Tap Refresh to try again.");
            showContent("mars-loading", "mars-content");
          });
      });
  };

  // ============================================================
  // 11. ISS LIVE TRACKER + LEAFLET MAP
  // ============================================================
  let __issMap    = null;
  let __issMarker = null;
  let __issPath   = null;
  let __issTrail  = [];

  function _issIcon(L) {
    return L.divIcon({
      className: "",
      html: `<div style="
        width:28px;height:28px;
        background:#bb0000;
        border:2px solid #fff;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:15px;line-height:1;
        box-shadow:0 0 8px rgba(187,0,0,0.7),0 0 20px rgba(187,0,0,0.3);
      ">🛸</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
  }

  function _initISSMap(L, lat, lon) {
    const mapEl = document.getElementById("iss-map");
    if (!mapEl) return;
    if (!__issMap) {
      __issMap = L.map("iss-map", {
        center: [lat, lon],
        zoom: 3,
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false
      });
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 6 }
      ).addTo(__issMap);
      __issTrail  = [[lat, lon]];
      __issPath   = L.polyline(__issTrail, {
        color: "#bb0000",
        weight: 1.5,
        opacity: 0.5,
        dashArray: "4 6"
      }).addTo(__issMap);
      __issMarker = L.marker([lat, lon], { icon: _issIcon(L) }).addTo(__issMap);
    } else {
      __issMarker.setLatLng([lat, lon]);
      __issMap.panTo([lat, lon], { animate: true, duration: 1.2 });
      __issTrail.push([lat, lon]);
      if (__issTrail.length > 30) __issTrail.shift();
      __issPath.setLatLngs(__issTrail);
    }
  }

  window.__funLoadISS = window.__funRefreshISS = function () {
    const content = document.getElementById("iss-content");
    if (!content || content.style.display === "none") showLoading("iss-loading", "iss-content");
    safeFetch("https://api.wheretheiss.at/v1/satellites/25544", 6000)
      .then(r => r.json())
      .then(d => {
        const lat    = parseFloat(d.latitude);
        const lon    = parseFloat(d.longitude);
        const latDir = lat >= 0 ? "N" : "S";
        const lonDir = lon >= 0 ? "E" : "W";
        setText("iss-coords",
          `${Math.abs(lat).toFixed(4)}° ${latDir},  ${Math.abs(lon).toFixed(4)}° ${lonDir}`);
        const mph   = Math.round(d.velocity * 0.621371).toLocaleString();
        const altMi = Math.round(d.altitude * 0.621371);
        showContent("iss-loading", "iss-content");
        safeFetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
          5000
        )
          .then(r => r.json())
          .then(geo => {
            const parts = [geo.locality, geo.countryName].filter(Boolean);
            const loc = parts.length ? parts.join(", ") : "Over the ocean 🌊";
            setText("iss-location",
              `📍 Currently flying over: ${loc}\n🏎️ Speed: ${mph} mph  ·  🛰️ Altitude: ${altMi} mi`);
          })
          .catch(() => {
            setText("iss-location",
              `🏎️ Speed: ${mph} mph  ·  🛰️ Altitude: ${altMi} mi`);
          });
        _loadLeaflet().then(L => {
          if (!L) return;
          setTimeout(() => {
            _initISSMap(L, lat, lon);
            if (__issMap) __issMap.invalidateSize();
          }, 80);
        });
      })
      .catch(() => setText("iss-loading", "⚠️ ISS tracker unavailable."));
  };

  // ============================================================
  // 12. USGS EARTHQUAKE FEED
  // ============================================================
  function _magColor(mag) {
    if (mag >= 7) return "#e53935";
    if (mag >= 5) return "#fb8c00";
    if (mag >= 3) return "#fdd835";
    return "#66bb6a";
  }
  function _magLabel(mag) {
    if (mag >= 7) return "Major";
    if (mag >= 5) return "Strong";
    if (mag >= 3) return "Moderate";
    return "Minor";
  }

  window.__funLoadQuake = function () {
    showLoading("quake-loading", "quake-content");
    const urls = [
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/1.0_month.geojson"
    ];
    function tryUrl(idx) {
      if (idx >= urls.length) { setText("quake-loading", "⚠️ USGS feed unavailable."); return; }
      safeFetch(urls[idx], 10000)
        .then(r => r.json())
        .then(data => {
          const features = data.features || [];
          if (!features.length) { tryUrl(idx + 1); return; }
          features.sort((a, b) => b.properties.time - a.properties.time);
          const q     = features[0].properties;
          const mag   = parseFloat(q.mag) || 0;
          const color = _magColor(mag);
          setHTML("quake-badge-wrap",
            `<span class="quake-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${_magLabel(mag)}</span>`);
          const magEl = document.getElementById("quake-mag");
          if (magEl) { magEl.textContent = `M ${mag.toFixed(1)}`; magEl.style.color = color; }
          setText("quake-place", q.place || "Unknown location");
          const time  = q.time ? new Date(q.time).toLocaleString() : "";
          const depth = features[0].geometry?.coordinates?.[2];
          setText("quake-meta", [
            time  ? `🕐 ${time}` : "",
            depth != null ? `🔽 Depth: ${Math.round(depth)} km` : ""
          ].filter(Boolean).join("  ·  "));
          showContent("quake-loading", "quake-content");
        })
        .catch(() => tryUrl(idx + 1));
    }
    tryUrl(0);
  };

})();