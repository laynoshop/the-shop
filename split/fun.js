// split/fun.js
// The Family Page — mobile-first single-column layout
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
/* ── Family page layout ───────────────────────────────────── */
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
.fun-card-title { font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.1px; flex: 1; }
.fun-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 0; }
.fun-loading { font-size: 12px; color: #666; font-style: italic; }
.fun-media-row { display: flex; gap: 12px; align-items: flex-start; }
.fun-thumb { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #111; }
.fun-thumb-tall { width: 52px; height: 76px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: #111; }
.fun-thumb-poke { width: 72px; height: 72px; object-fit: contain; flex-shrink: 0; image-rendering: pixelated; }
.fun-media-info { flex: 1; min-width: 0; }
/* TRIVIA TOGGLE */
.trivia-mode-row {
  display: flex; align-items: center; gap: 8px;
}
.trivia-mode-label { font-size: 11px; color: #666; }
.trivia-toggle-wrap {
  display: flex; align-items: center; gap: 0;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 99px; padding: 2px;
}
.trivia-toggle-btn {
  border: none; border-radius: 99px;
  padding: 4px 10px; font-size: 11px; font-weight: 700;
  cursor: pointer; transition: background 0.18s, color 0.18s;
  background: transparent; color: #666;
}
.trivia-toggle-btn.active {
  background: #bb0000; color: #fff;
}
/* POKEMON */
.poke-types { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.poke-type-badge { color: #fff; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; text-transform: capitalize; }
.poke-stat-row { display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
.poke-stat-label { font-size: 9px; font-weight: 700; color: #666; width: 26px; flex-shrink: 0; }
.poke-stat-bar-bg { flex: 1; background: rgba(255,255,255,0.08); border-radius: 99px; height: 4px; overflow: hidden; }
.poke-stat-bar { height: 100%; background: #bb0000; border-radius: 99px; }
.poke-stat-val { font-size: 9px; color: #888; width: 20px; text-align: right; }
/* TRIVIA */
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
/* JOKE */
.joke-setup { font-size: 13px; color: #ddd; line-height: 1.5; }
.joke-punchline-wrap { background: rgba(187,0,0,0.1); border-left: 3px solid #bb0000; border-radius: 0 8px 8px 0; padding: 8px 10px; }
.joke-punchline { font-size: 13px; font-weight: 700; color: #fff; }
/* BORED */
.bored-activity { font-size: 14px; font-weight: 700; color: #fff; line-height: 1.4; }
.bored-meta { font-size: 11px; color: #666; margin-top: 2px; }
/* WOULD YOU RATHER */
.wyr-q { font-size: 14px; font-weight: 700; color: #fff; line-height: 1.45; margin-bottom: 10px; }
.wyr-options { display: flex; flex-direction: column; gap: 6px; }
.wyr-option {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; color: #ccc;
  padding: 9px 12px; font-size: 12px; font-weight: 600;
  text-align: left; cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.wyr-option:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.wyr-option.wyr-selected {
  background: rgba(187,0,0,0.2) !important;
  border-color: rgba(187,0,0,0.5) !important;
  color: #fff !important;
}
.wyr-result { font-size: 12px; color: #888; margin-top: 4px; font-style: italic; }
/* ANIMAL */
.animal-img { width: 100%; max-height: 180px; border-radius: 10px; object-fit: cover; background: #111; display: block; margin-bottom: 8px; }
.animal-name { font-size: 16px; font-weight: 900; color: #fff; margin-bottom: 3px; }
.animal-fact { font-size: 12px; color: #bbb; line-height: 1.5; }
/* WORD OF THE DAY */
.word-word { font-size: 22px; font-weight: 900; color: #fff; letter-spacing: -0.3px; line-height: 1.1; margin-bottom: 2px; }
.word-phonetic { font-size: 12px; color: #888; margin-bottom: 6px; }
.word-pos { font-size: 10px; font-weight: 800; color: #bb0000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.word-def { font-size: 13px; color: #ddd; line-height: 1.5; margin-bottom: 4px; }
.word-example { font-size: 12px; color: #888; font-style: italic; line-height: 1.4; border-left: 2px solid rgba(187,0,0,0.4); padding-left: 8px; margin-top: 4px; }
/* EXPANDABLE TEXT */
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
/* COUNTRY GUESSER */
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
/* BUTTONS */
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

  <!-- ══════════════════════════════════════════
       SECTION: GAMES & FUN
       ══════════════════════════════════════════ -->
  <div class="fun-section-label">Games &amp; Fun</div>

  <!-- TRIVIA (with Kids/Adult toggle) -->
  <div class="fun-card" id="fun-trivia">
    <div class="fun-card-header">
      <span class="fun-card-icon">🎯</span>
      <span class="fun-card-title">Trivia</span>
      <div class="trivia-toggle-wrap" id="trivia-toggle-wrap">
        <button class="trivia-toggle-btn active" id="trivia-btn-kids" onclick="window.__funSetTriviaMode('kids')">Kids</button>
        <button class="trivia-toggle-btn" id="trivia-btn-adult" onclick="window.__funSetTriviaMode('adult')">Adult</button>
      </div>
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

  <!-- WOULD YOU RATHER -->
  <div class="fun-section-label">Family Game</div>
  <div class="fun-card" id="fun-wyr">
    <div class="fun-card-header">
      <span class="fun-card-icon">🤔</span>
      <span class="fun-card-title">Would You Rather?</span>
    </div>
    <div class="fun-divider"></div>
    <div id="wyr-content">
      <div class="wyr-q" id="wyr-q"></div>
      <div class="wyr-options" id="wyr-options"></div>
      <div class="wyr-result" id="wyr-result"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadWYR()">Next ↻</button>
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

  <!-- ACTIVITY GENERATOR -->
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

  <!-- ══════════════════════════════════════════
       SECTION: DAILY DISCOVERIES
       ══════════════════════════════════════════ -->
  <div class="fun-section-label">Daily Discoveries</div>

  <!-- ANIMAL OF THE DAY -->
  <div class="fun-card" id="fun-animal">
    <div class="fun-card-header">
      <span class="fun-card-icon">🐾</span>
      <span class="fun-card-title">Animal of the Day</span>
    </div>
    <div class="fun-divider"></div>
    <div id="animal-loading" class="fun-loading">Finding an animal…</div>
    <div id="animal-content" style="display:none;">
      <img id="animal-img" class="animal-img" src="" alt="" loading="lazy" />
      <div class="animal-name" id="animal-name"></div>
      <div class="animal-fact" id="animal-fact"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadAnimal()">New Animal ↻</button>
    </div>
  </div>

  <!-- WORD OF THE DAY -->
  <div class="fun-card" id="fun-word">
    <div class="fun-card-header">
      <span class="fun-card-icon">🧩</span>
      <span class="fun-card-title">Word of the Day</span>
    </div>
    <div class="fun-divider"></div>
    <div id="word-loading" class="fun-loading">Looking up a word…</div>
    <div id="word-content" style="display:none;">
      <div class="word-word" id="word-word"></div>
      <div class="word-phonetic" id="word-phonetic"></div>
      <div class="word-pos" id="word-pos"></div>
      <div class="word-def" id="word-def"></div>
      <div class="word-example" id="word-example" style="display:none;"></div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadWord()">New Word ↻</button>
    </div>
  </div>

  <!-- ON THIS DAY IN HISTORY -->
  <div class="fun-card" id="fun-otd">
    <div class="fun-card-header">
      <span class="fun-card-icon">📜</span>
      <span class="fun-card-title">On This Day in History</span>
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

  <!-- ══════════════════════════════════════════
       SECTION: SPACE & SCIENCE
       ══════════════════════════════════════════ -->
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
      <button class="fun-btn-share" id="apod-share-btn" onclick="window.__funShareApod()" style="display:none;">📤 Share with Family</button>
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

</div>
`;

    // Kick off all loaders
    window.__funLoadTrivia();
    window.__funLoadPokemon();
    window.__funLoadCountry();
    window.__funLoadWYR();
    window.__funLoadJoke();
    window.__funLoadBored();
    window.__funLoadAnimal();
    window.__funLoadWord();
    window.__funLoadOTD();
    window.__funLoadQuake();
    window.__funLoadApod();
    window.__funLoadMars();
    window.__funLoadISS();

    setTimeout(() => {
      const g = document.getElementById("country-guess");
      if (g) g.addEventListener("keydown", e => { if (e.key === "Enter") window.__funGuessCountry(); });
    }, 50);

    if (window.__issInterval) clearInterval(window.__issInterval);
    window.__issInterval = setInterval(() => {
      if (document.getElementById("fun-iss")) window.__funRefreshISS();
      else clearInterval(window.__issInterval);
    }, 10000);
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
  // 1. TRIVIA — Kids / Adult toggle
  // ============================================================
  let __triviaCorrect = "";
  let __triviaMode = "kids"; // "kids" | "adult"

  // Kids mode uses curated easy categories from OpenTDB
  const KIDS_CATEGORY_IDS = [17, 18, 19, 20, 21, 22, 23, 24, 25, 27];
  // 17=Science:Nature, 18=Science:Computers, 19=Science:Math,
  // 20=Mythology, 21=Sports, 22=Geography, 23=History,
  // 24=Politics, 25=Art, 27=Animals

  window.__funSetTriviaMode = function (mode) {
    __triviaMode = mode;
    const kb = document.getElementById("trivia-btn-kids");
    const ab = document.getElementById("trivia-btn-adult");
    if (kb) kb.classList.toggle("active", mode === "kids");
    if (ab) ab.classList.toggle("active", mode === "adult");
    window.__funLoadTrivia();
  };

  window.__funLoadTrivia = function () {
    showLoading("trivia-loading", "trivia-content");
    const nb = document.getElementById("trivia-next");
    if (nb) nb.style.display = "none";

    let url = "https://opentdb.com/api.php?amount=1&type=multiple";
    if (__triviaMode === "kids") {
      const catId = KIDS_CATEGORY_IDS[Math.floor(Math.random() * KIDS_CATEGORY_IDS.length)];
      url += `&difficulty=easy&category=${catId}`;
    }

    safeFetch(url)
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
  // 2. POKEMON
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
  // 3. COUNTRY GUESSER
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
  // 4. WOULD YOU RATHER
  // ============================================================
  const WYR_LIST = [
    ["Eat pizza for every meal for a year","Eat tacos for every meal for a year"],
    ["Have a pet dragon","Have a pet unicorn"],
    ["Be able to fly","Be able to become invisible"],
    ["Live in the ocean in a submarine","Live on the moon in a space station"],
    ["Always have to sing instead of talking","Always have to dance instead of walking"],
    ["Have super speed","Have super strength"],
    ["Be able to talk to animals","Be able to speak every human language"],
    ["Never eat candy again","Never eat pizza again"],
    ["Go to school on Saturdays but have Wednesdays off","Keep the normal schedule"],
    ["Have a robot best friend","Have a time-traveling best friend"],
    ["It always snows on your birthday","It always rains on your birthday"],
    ["Be able to pause time","Be able to rewind time"],
    ["Have a pet T-Rex that is friendly","Have a pet shark that can walk on land"],
    ["Always know what time it is","Always know what the weather will be"],
    ["Win an Olympic gold medal","Win an Academy Award"],
    ["Only be able to whisper","Only be able to shout"],
    ["Live without music","Live without movies or TV"],
    ["Explore the deep ocean","Explore outer space"],
    ["Have the ability to shrink to ant size","Have the ability to grow to giant size"],
    ["Have a photographic memory","Have the ability to sleep only 2 hours a night"],
    ["Be fluent in every language","Be amazing at every sport"],
    ["Never have homework","Never have chores"],
    ["Have a magic carpet","Have a time machine"],
    ["Always feel hot","Always feel cold"],
    ["Find $100 on the ground","Get a surprise day off school or work"],
    ["Be the funniest person in any room","Be the smartest person in any room"],
    ["Only eat food that is blue","Only eat food that is red"],
    ["Have to wear a cape everywhere","Have to wear a crown everywhere"],
    ["Be able to read minds","Be able to predict the future"],
    ["Go on a safari in Africa","Go on an expedition to Antarctica"],
    ["Meet your favorite celebrity","Meet any historical figure of your choice"],
    ["Be the world's best chef","Be the world's best athlete"],
    ["Eat a handful of sand","Eat a cup of ice cubes"],
    ["Have springs in your shoes and bounce everywhere","Have wheels instead of feet"],
    ["Never get cold","Never get tired"],
    ["Be a superhero with one lame power","Be a regular person who is incredibly lucky"],
    ["Know every secret about your friends","Have your friends know all your secrets"],
    ["Swim in a pool of pudding","Swim in a pool of jello"],
    ["Have a pause button for your life","Have a fast-forward button for your life"],
    ["Travel 100 years into the past","Travel 100 years into the future"],
    ["Be stuck on a deserted island alone","Be stuck on a deserted island with someone annoying"],
    ["Eat your least favorite food every day","Never eat your favorite food again"],
    ["Have glow-in-the-dark hair","Have hair that changes color with your mood"],
    ["Be the world's greatest musician","Be the world's greatest artist"],
    ["Always be 10 minutes early","Always be 10 minutes late"],
    ["Only eat sweet foods","Only eat salty foods"],
    ["Have a personal chef","Have a personal chauffeur"],
    ["Live in a treehouse","Live in a houseboat"],
    ["Never use social media again","Never watch TV again"],
    ["Go on a road trip across the USA","Go on a cruise around the world"]
  ];

  let __wyrIndex = -1;
  let __wyrAnswered = false;

  window.__funLoadWYR = function () {
    __wyrAnswered = false;
    let next;
    do { next = Math.floor(Math.random() * WYR_LIST.length); } while (next === __wyrIndex && WYR_LIST.length > 1);
    __wyrIndex = next;
    const pair = WYR_LIST[__wyrIndex];
    setHTML("wyr-q", "Would you rather…");
    setHTML("wyr-result", "");
    const opts = document.getElementById("wyr-options");
    if (opts) {
      opts.innerHTML = pair.map((opt, i) =>
        `<button class="wyr-option" onclick="window.__funPickWYR(${i})">${opt}</button>`
      ).join(`<div style="text-align:center;font-size:11px;color:#444;font-weight:700;padding:2px 0;">— OR —</div>`);
    }
  };

  window.__funPickWYR = function (idx) {
    if (__wyrAnswered) return;
    __wyrAnswered = true;
    const pair = WYR_LIST[__wyrIndex];
    document.querySelectorAll(".wyr-option").forEach((b, i) => {
      b.disabled = true;
      if (i === idx) b.classList.add("wyr-selected");
    });
    const quips = ["Bold choice! 🔥", "Ha! Classic.", "Nice one 😄", "Interesting…", "Respect 👊", "Bold move!", "Can't argue with that!", "Good pick!"];
    setHTML("wyr-result", quips[Math.floor(Math.random() * quips.length)]);
  };

  // ============================================================
  // 5. JOKE
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
  // 6. BORED
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
  // 7. ANIMAL OF THE DAY
  // ============================================================
  const ANIMALS = [
    { name: "Snow Leopard", fact: "Snow leopards can't roar — instead they make a unique chuffing sound called a 'prusten'. Their thick, smoky-grey fur acts as natural camouflage in snowy mountain terrain.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Snow_leopard_portrait.jpg/800px-Snow_leopard_portrait.jpg" },
    { name: "Axolotl", fact: "The axolotl is called a 'walking fish' but is actually a salamander. It can regenerate entire limbs, parts of its heart, and even portions of its brain!", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Axolotl_ganz.jpg/800px-Axolotl_ganz.jpg" },
    { name: "Quokka", fact: "Quokkas are often called the 'world's happiest animal' because their mouths naturally curve into a smile. They're native to small islands off Australia's coast.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Quokka_%28Setonix_brachyurus%29_portrait.jpg/800px-Quokka_%28Setonix_brachyurus%29_portrait.jpg" },
    { name: "Mantis Shrimp", fact: "Mantis shrimp have 16 types of color-detecting cells in their eyes — humans only have 3. They can punch with the force of a bullet, fast enough to boil water around their claws!", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Odontodactylus_scyllarus.jpg/800px-Odontodactylus_scyllarus.jpg" },
    { name: "Narwhal", fact: "A narwhal's 'horn' is actually a giant tooth that can grow up to 10 feet long! They use it to detect changes in water temperature and even stun fish.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Narwhal_painting.jpg/800px-Narwhal_painting.jpg" },
    { name: "Capybara", fact: "Capybaras are the world's largest rodents, and nearly every animal gets along with them — birds, monkeys, deer, and even crocodiles have been spotted resting on their backs.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Capybara_in_Brazil.jpg/800px-Capybara_in_Brazil.jpg" },
    { name: "Peacock Mantis Shrimp", fact: "Weighing just a few ounces, it can deliver a punch with 1,500 newtons of force — 50 times its own body weight. Aquariums keep them in special tanks because they can crack the glass.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Odontodactylus_scyllarus2.jpg/800px-Odontodactylus_scyllarus2.jpg" },
    { name: "Mimic Octopus", fact: "The mimic octopus can impersonate over 15 different sea creatures including flatfish, lionfish, and sea snakes — switching disguises to match the biggest local predator.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Thaumoctopus_mimicus2.jpg/800px-Thaumoctopus_mimicus2.jpg" },
    { name: "Hummingbird", fact: "Hummingbirds are the only birds that can fly backwards. Their hearts beat up to 1,260 times per minute and their wings flap 50–80 times per second — so fast they hum!", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Ruby-throated-humming-bird1.jpg/800px-Ruby-throated-humming-bird1.jpg" },
    { name: "Tardigrade", fact: "Tardigrades (water bears) are microscopic creatures that can survive being frozen, boiled, dried out, exposed to radiation, and even the vacuum of outer space. They're basically indestructible.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Hypsibius_dujardini.jpg/800px-Hypsibius_dujardini.jpg" },
    { name: "Leafcutter Ant", fact: "Leafcutter ants are the world's first farmers — they've been cultivating fungus gardens underground for over 50 million years. A single colony can strip a tree bare overnight.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Leafcutter_ants_on_branch.jpg/800px-Leafcutter_ants_on_branch.jpg" },
    { name: "Platypus", fact: "The platypus is one of the few mammals that lays eggs. Males have venomous spurs on their back legs, and they hunt using electroreception — sensing the electric fields of prey underwater.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Platypus.jpg/800px-Platypus.jpg" },
    { name: "Red Fox", fact: "Red foxes have vertically-slit pupils like cats, giving them excellent night vision. They can also use Earth's magnetic field to navigate — making them one of the few mammals with a built-in compass.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Red_Fox_%28Vulpes_vulpes%29_-_British_Wildlife_Centre-3.jpg/800px-Red_Fox_%28Vulpes_vulpes%29_-_British_Wildlife_Centre-3.jpg" },
    { name: "Pistol Shrimp", fact: "Pistol shrimp snap their claws so fast it creates a cavitation bubble reaching temperatures close to the sun — briefly hotter than 8,000°F. The snap stuns or kills prey instantly.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Alpheidae.jpg/800px-Alpheidae.jpg" },
    { name: "Giant Pacific Octopus", fact: "Giant Pacific Octopuses have three hearts, blue blood, and can open jars, solve puzzles, and recognize individual human faces. They're considered the most intelligent invertebrates on Earth.", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/GPO_crop.jpg/800px-GPO_crop.jpg" }
  ];

  let __lastAnimalIdx = -1;

  window.__funLoadAnimal = function () {
    showLoading("animal-loading", "animal-content");
    let idx;
    do { idx = Math.floor(Math.random() * ANIMALS.length); } while (idx === __lastAnimalIdx && ANIMALS.length > 1);
    __lastAnimalIdx = idx;
    const a = ANIMALS[idx];

    // Try The Cat API or Dog API for extra variety on a subset
    const useCatApi = Math.random() < 0.3;
    const useDogApi = !useCatApi && Math.random() < 0.4;

    if (useCatApi) {
      safeFetch("https://api.thecatapi.com/v1/images/search?mime_types=jpg,png", 6000)
        .then(r => r.json())
        .then(data => {
          const cat = data[0];
          _renderAnimal(cat.url, "🐱 Mystery Cat", "Cats sleep 12–16 hours a day and have a unique vocabulary of meows — a sound they developed specifically to communicate with humans, not other cats!");
        })
        .catch(() => _renderAnimal(a.img, a.name, a.fact));
    } else if (useDogApi) {
      safeFetch("https://dog.ceo/api/breeds/image/random", 6000)
        .then(r => r.json())
        .then(data => {
          const breed = data.message?.split("/").slice(-2)[0]?.replace(/-/g," ") || "Dog";
          const bName = breed.charAt(0).toUpperCase() + breed.slice(1);
          _renderAnimal(data.message, `🐶 ${bName}`, "Dogs have been human companions for over 15,000 years — longer than any other animal. They can understand up to 250 words and can even smell your emotions!");
        })
        .catch(() => _renderAnimal(a.img, a.name, a.fact));
    } else {
      _renderAnimal(a.img, a.name, a.fact);
    }
  };

  function _renderAnimal(imgUrl, name, fact) {
    const img = document.getElementById("animal-img");
    if (img) {
      img.src = imgUrl || "";
      img.alt = name || "Animal";
      img.style.display = imgUrl ? "" : "none";
      img.onerror = () => { img.style.display = "none"; };
    }
    setText("animal-name", name || "");
    setText("animal-fact", fact || "");
    showContent("animal-loading", "animal-content");
  }

  // ============================================================
  // 8. WORD OF THE DAY
  // ============================================================
  const WORD_LIST = [
    "serendipity","ephemeral","luminous","resilience","cacophony",
    "melancholy","vivacious","tenacious","labyrinth","euphoria",
    "wanderlust","nostalgia","halcyon","sanguine","eloquent",
    "petrichor","solitude","perseverance","tranquil","iridescent",
    "whimsical","fortitude","jubilant","serene","catalyst",
    "ambiguous","diligent","empathy","flourish","galvanize",
    "humble","illustrious","jubilee","kinetic","lullaby",
    "magnanimous","nimble","opulent","pristine","querulous",
    "radiant","steadfast","tenacity","undulate","vivid",
    "wistful","xenial","yearning","zealous","bountiful"
  ];

  let __lastWordIdx = -1;

  window.__funLoadWord = function () {
    showLoading("word-loading", "word-content");
    let idx;
    do { idx = Math.floor(Math.random() * WORD_LIST.length); } while (idx === __lastWordIdx && WORD_LIST.length > 1);
    __lastWordIdx = idx;
    const word = WORD_LIST[idx];

    safeFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, 8000)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || !data[0]) throw new Error("no data");
        const entry   = data[0];
        const phonetic = entry.phonetic || (entry.phonetics?.find(p => p.text)?.text) || "";
        const meaning  = entry.meanings?.[0];
        const def      = meaning?.definitions?.[0];
        if (!def) throw new Error("no def");

        setText("word-word", entry.word || word);
        setText("word-phonetic", phonetic);
        setText("word-pos", meaning.partOfSpeech || "");
        setText("word-def", def.definition || "");

        const exEl = document.getElementById("word-example");
        if (exEl) {
          if (def.example) {
            exEl.textContent = `"${def.example}"`;
            exEl.style.display = "";
          } else {
            exEl.style.display = "none";
          }
        }
        showContent("word-loading", "word-content");
      })
      .catch(() => {
        // Fallback: show word alone with a fun message
        setText("word-word", word);
        setText("word-phonetic", "");
        setText("word-pos", "");
        setText("word-def", "Dictionary API is unavailable right now. But it's still a great word — look it up! 📖");
        const exEl = document.getElementById("word-example");
        if (exEl) exEl.style.display = "none";
        showContent("word-loading", "word-content");
      });
  };

  // ============================================================
  // 9. ON THIS DAY IN HISTORY
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
  // 10. USGS EARTHQUAKE
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
          setText("quake-meta",
            [time ? `🕐 ${time}` : "", depth != null ? `📏 Depth: ${depth.toFixed(1)} km` : ""].filter(Boolean).join("  ·  "));
          showContent("quake-loading", "quake-content");
        })
        .catch(() => tryUrl(idx + 1));
    }
    tryUrl(0);
  };

  // ============================================================
  // 11. NASA APOD + SHARE
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
      navigator.share({ title: `NASA APOD: ${title}`, text: msg, url: imgUrl || "https://apod.nasa.gov" }).catch(() => {});
    } else {
      window.open(`sms:?body=${encodeURIComponent(msg)}`, "_blank");
    }
  };

  // ============================================================
  // 12. MARS WEATHER
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
            setText("mars-note", "⚠️ Live Mars data temporarily unavailable. Showing typical values. Tap Refresh to try again.");
            showContent("mars-loading", "mars-content");
          });
      });
  };

  // ============================================================
  // 13. ISS LIVE TRACKER + LEAFLET MAP
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
    const c = document.getElementById("iss-content");
    if (!c || c.style.display === "none") showLoading("iss-loading", "iss-content");
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

})();
