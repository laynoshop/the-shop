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
.fun-card-header {
  display: flex;
  align-items: center;
  gap: 7px;
}
.fun-card-icon { font-size: 16px; line-height: 1; flex-shrink: 0; }
.fun-card-title { font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.1px; }
.fun-divider {
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 0;
}
.fun-body { font-size: 13px; color: #ccc; line-height: 1.5; }
.fun-loading { font-size: 12px; color: #666; font-style: italic; }
/* Row layout for image+info widgets */
.fun-media-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.fun-thumb {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
  background: #111;
}
.fun-thumb-tall {
  width: 52px;
  height: 76px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: #111;
}
.fun-thumb-poke {
  width: 72px;
  height: 72px;
  object-fit: contain;
  flex-shrink: 0;
  image-rendering: pixelated;
}
.fun-media-info { flex: 1; min-width: 0; }
/* Type badges */
.poke-types { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 6px; }
.poke-type-badge {
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 99px;
  text-transform: capitalize;
}
/* Stat bars */
.poke-stat-row { display: flex; align-items: center; gap: 5px; margin-bottom: 2px; }
.poke-stat-label { font-size: 9px; font-weight: 700; color: #666; width: 26px; flex-shrink: 0; }
.poke-stat-bar-bg { flex: 1; background: rgba(255,255,255,0.08); border-radius: 99px; height: 4px; overflow: hidden; }
.poke-stat-bar { height: 100%; background: #bb0000; border-radius: 99px; }
.poke-stat-val { font-size: 9px; color: #888; width: 20px; text-align: right; }
/* Trivia */
.trivia-category { font-size: 10px; font-weight: 700; color: #bb0000; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
.trivia-q { font-size: 13px; font-weight: 600; color: #eee; line-height: 1.4; margin-bottom: 8px; }
.trivia-choices { display: flex; flex-direction: column; gap: 5px; }
.trivia-choice {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #ccc;
  padding: 7px 10px;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.trivia-choice:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.trivia-correct { background: rgba(76,175,80,0.2) !important; border-color: #4caf50 !important; color: #a5d6a7 !important; }
.trivia-wrong   { background: rgba(187,0,0,0.1) !important; border-color: rgba(187,0,0,0.3) !important; color: #777 !important; }
.trivia-result  { font-size: 12px; font-weight: 700; margin-top: 4px; }
.trivia-win { color: #66bb6a; }
.trivia-lose { color: #ef5350; }
/* Joke */
.joke-setup { font-size: 13px; color: #ddd; line-height: 1.5; }
.joke-punchline-wrap {
  background: rgba(187,0,0,0.1);
  border-left: 3px solid #bb0000;
  border-radius: 0 8px 8px 0;
  padding: 8px 10px;
}
.joke-punchline { font-size: 13px; font-weight: 700; color: #fff; }
/* Bored */
.bored-activity { font-size: 14px; font-weight: 700; color: #fff; line-height: 1.4; }
.bored-meta { font-size: 11px; color: #666; margin-top: 2px; }
/* Movie */
.movie-title { font-size: 14px; font-weight: 900; color: #fff; line-height: 1.3; margin-bottom: 1px; }
.movie-meta { font-size: 11px; color: #888; margin-bottom: 3px; }
.movie-rating { font-size: 12px; font-weight: 700; color: #f5a623; margin-bottom: 4px; }
.movie-plot { font-size: 12px; color: #aaa; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
/* Cocktail */
.cocktail-name { font-size: 14px; font-weight: 900; color: #fff; margin-bottom: 2px; }
.cocktail-glass { font-size: 11px; color: #888; margin-bottom: 5px; }
.cocktail-ing-title { font-size: 10px; font-weight: 700; color: #bb0000; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 3px; }
.cocktail-ing-item { font-size: 12px; color: #bbb; line-height: 1.6; }
/* Country */
.country-flag { font-size: 40px; line-height: 1; margin-bottom: 6px; }
.country-clues { font-size: 12px; color: #bbb; line-height: 1.8; margin-bottom: 8px; }
.country-input-wrap { display: flex; gap: 6px; align-items: center; }
.country-result { font-size: 13px; font-weight: 700; margin-top: 6px; min-height: 18px; }
.country-answer { font-size: 11px; color: #777; margin-top: 2px; }
/* Number */
.number-big { font-size: 36px; font-weight: 900; color: #bb0000; line-height: 1; margin-bottom: 5px; }
.number-fact { font-size: 13px; color: #ccc; line-height: 1.5; }
.fun-number-controls { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
/* Book */
.book-title { font-size: 14px; font-weight: 900; color: #fff; line-height: 1.3; margin-bottom: 2px; }
.book-author { font-size: 12px; color: #aaa; margin-bottom: 1px; }
.book-year { font-size: 11px; color: #666; margin-bottom: 4px; }
.book-subjects { font-size: 11px; color: #777; margin-bottom: 6px; }
/* Buttons */
.fun-btn {
  align-self: flex-start;
  background: #bb0000;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 13px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.fun-btn:active { opacity: 0.75; }
.fun-btn-sm {
  background: transparent;
  color: #bb0000;
  border: 1.5px solid rgba(187,0,0,0.5);
  border-radius: 7px;
  padding: 6px 11px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}
.fun-btn-sm:active { background: rgba(187,0,0,0.15); }
.fun-input {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  color: #fff;
  padding: 7px 10px;
  font-size: 13px;
  flex: 1;
  min-width: 0;
  outline: none;
}
.fun-input:focus { border-color: #bb0000; }
.fun-input-sm {
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 8px;
  color: #fff;
  padding: 7px 10px;
  font-size: 13px;
  width: 100px;
  outline: none;
}
.fun-input-sm:focus { border-color: #bb0000; }
.fun-footer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
</style>

<div class="fun-page">

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
          <div class="movie-plot" id="movie-plot"></div>
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

  <!-- NUMBER FACT -->
  <div class="fun-section-label">Number Facts</div>
  <div class="fun-card" id="fun-number">
    <div class="fun-card-header">
      <span class="fun-card-icon">🔢</span>
      <span class="fun-card-title">Number Fact</span>
    </div>
    <div class="fun-divider"></div>
    <div id="number-loading" class="fun-loading">Fetching fact…</div>
    <div id="number-content" style="display:none;">
      <div class="number-big" id="number-big"></div>
      <div class="number-fact" id="number-fact"></div>
    </div>
    <div class="fun-footer-row">
      <input type="number" id="number-input" class="fun-input-sm" placeholder="Any number" min="0" max="99999" />
      <button class="fun-btn-sm" onclick="window.__funLoadNumberCustom()">Look up</button>
      <button class="fun-btn" onclick="window.__funLoadNumber()">Random ↻</button>
    </div>
  </div>

  <!-- BOOK -->
  <div class="fun-section-label">Reading</div>
  <div class="fun-card" id="fun-book">
    <div class="fun-card-header">
      <span class="fun-card-icon">📖</span>
      <span class="fun-card-title">Random Book Pick</span>
    </div>
    <div class="fun-divider"></div>
    <div id="book-loading" class="fun-loading">Picking a book…</div>
    <div id="book-content" style="display:none;">
      <div class="fun-media-row">
        <img id="book-cover" class="fun-thumb-tall" src="" alt="" loading="lazy" />
        <div class="fun-media-info">
          <div class="book-title" id="book-title"></div>
          <div class="book-author" id="book-author"></div>
          <div class="book-year" id="book-year"></div>
          <div class="book-subjects" id="book-subjects"></div>
          <a id="book-link" class="fun-btn-sm" style="display:inline-block;text-decoration:none;" href="#" target="_blank" rel="noopener noreferrer">Open Library →</a>
        </div>
      </div>
    </div>
    <div class="fun-footer-row">
      <button class="fun-btn" onclick="window.__funLoadBook()">New Book ↻</button>
    </div>
  </div>

</div>
`;

    // Boot all widgets
    window.__funLoadTrivia();
    window.__funLoadPokemon();
    window.__funLoadJoke();
    window.__funLoadBored();
    window.__funLoadMovie();
    window.__funLoadCocktail();
    window.__funLoadCountry();
    window.__funLoadNumber();
    window.__funLoadBook();

    // Enter key bindings
    setTimeout(() => {
      const g = document.getElementById("country-guess");
      if (g) g.addEventListener("keydown", e => { if (e.key === "Enter") window.__funGuessCountry(); });
      const n = document.getElementById("number-input");
      if (n) n.addEventListener("keydown", e => { if (e.key === "Enter") window.__funLoadNumberCustom(); });
    }, 50);
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
  // 1. TRIVIA
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
        const nb = document.getElementById("trivia-next");
        if (nb) nb.style.display = "";
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
  // 3. JOKE
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
  // 4. BORED
  // ============================================================
  window.__funLoadBored = function () {
    showLoading("bored-loading", "bored-content");
    safeFetch("https://bored-api.appbrewery.com/random")
      .then(r => r.json())
      .then(b => {
        setText("bored-activity", b.activity || "");
        const parts = [
          b.type ? `🏷️ ${b.type.charAt(0).toUpperCase()+b.type.slice(1)}` : "",
          b.participants ? `👥 ${b.participants}` : "",
          b.price === 0 ? "💸 Free" : ""
        ].filter(Boolean);
        setText("bored-meta", parts.join("  ·  "));
        showContent("bored-loading", "bored-content");
      })
      .catch(() => {
        const f = ["Go for a walk somewhere new","Call someone you haven't talked to in a while","Cook a new recipe","Read the first chapter of a random book"];
        setText("bored-activity", f[Math.floor(Math.random()*f.length)]);
        setText("bored-meta", "💡 Offline suggestion");
        showContent("bored-loading", "bored-content");
      });
  };

  // ============================================================
  // 5. MOVIE
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
    const id = MOVIE_IDS[Math.floor(Math.random()*MOVIE_IDS.length)];
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
        setText("movie-plot", m.Plot && m.Plot !== "N/A" ? m.Plot : "");
        showContent("movie-loading", "movie-content");
      })
      .catch(() => setText("movie-loading", "⚠️ Movie API unavailable."));
  };

  // ============================================================
  // 6. COCKTAIL
  // ============================================================
  window.__funLoadCocktail = function () {
    showLoading("cocktail-loading", "cocktail-content");
    safeFetch("https://www.thecocktaildb.com/api/json/v1/1/random.php")
      .then(r => r.json())
      .then(data => {
        const d = data.drinks[0];
        const ci = document.getElementById("cocktail-img");
        if (ci) { ci.src = d.strDrinkThumb || ""; ci.alt = d.strDrink || ""; ci.style.display = d.strDrinkThumb ? "" : "none"; }
        setText("cocktail-name", d.strDrink || "");
        setText("cocktail-glass", d.strGlass ? `🥃 ${d.strGlass}` : "");
        const ings = [];
        for (let i = 1; i <= 15; i++) {
          const ing = d[`strIngredient${i}`], meas = d[`strMeasure${i}`];
          if (ing?.trim()) ings.push(`${meas ? meas.trim()+" " : ""}${ing.trim()}`);
        }
        setHTML("cocktail-ingredients", ings.map(i => `<div class="cocktail-ing-item">• ${i}</div>`).join(""));
        showContent("cocktail-loading", "cocktail-content");
      })
      .catch(() => setText("cocktail-loading", "⚠️ Cocktail API unavailable."));
  };

  // ============================================================
  // 7. COUNTRY GUESSER
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
        __currentCountry = list[Math.floor(Math.random()*list.length)];
        const c = __currentCountry;
        const fe = document.getElementById("country-flag");
        if (fe) fe.textContent = c.flags?.emoji || "🏳️";
        const clues = [
          c.region ? `🌐 Region: ${c.region}` : "",
          c.capital?.[0] ? `🏛️ Capital starts with: <b>${c.capital[0][0]}…</b>` : "",
          c.population ? `👥 Pop: ~${(c.population/1e6).toFixed(1)}M` : "",
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
      ...Object.values(__currentCountry.name?.nativeName || {}).map(n => (n.common||"¨").toLowerCase()),
      (__currentCountry.name?.official||"¨").toLowerCase()
    ];
    const right = guess === correct || alts.includes(guess);
    __countryGuessed = true;
    const re = document.getElementById("country-result");
    if (re) re.textContent = right ? "✅ Correct! Well done!" : "❌ Not quite!";
    const ae = document.getElementById("country-answer");
    if (ae) { ae.style.display = ""; ae.textContent = `Answer: ${__currentCountry.name.common}`; }
  };

  // ============================================================
  // 8. NUMBER FACT
  // ============================================================
  window.__funLoadNumber = function () {
    showLoading("number-loading", "number-content");
    __fetchNumberFact(Math.floor(Math.random() * 1000));
  };
  window.__funLoadNumberCustom = function () {
    const v = parseInt(document.getElementById("number-input")?.value || "", 10);
    if (isNaN(v)) return;
    showLoading("number-loading", "number-content");
    __fetchNumberFact(v);
  };
  function __fetchNumberFact(n) {
    safeFetch(`https://numbersapi.com/${n}/trivia?json`)
      .then(r => r.json())
      .then(d => { setText("number-big", String(n)); setText("number-fact", d.text || "No fact found."); showContent("number-loading", "number-content"); })
      .catch(() => safeFetch(`https://numbersapi.com/${n}`)
        .then(r => r.text())
        .then(t => { setText("number-big", String(n)); setText("number-fact", t || "No fact found."); showContent("number-loading", "number-content"); })
        .catch(() => { setText("number-big", String(n)); setText("number-fact", `${n} is a number. The Numbers API seems offline right now.`); showContent("number-loading", "number-content"); })
      );
  }

  // ============================================================
  // 9. BOOK
  // ============================================================
  const BOOK_SUBJECTS = [
    "science_fiction","mystery","adventure","fantasy","history",
    "philosophy","biography","thriller","classic_literature","humor"
  ];
  window.__funLoadBook = function () {
    showLoading("book-loading", "book-content");
    const subj = BOOK_SUBJECTS[Math.floor(Math.random()*BOOK_SUBJECTS.length)];
    safeFetch(`https://openlibrary.org/subjects/${subj}.json?limit=20`)
      .then(r => r.json())
      .then(data => {
        const works = data.works || [];
        if (!works.length) throw new Error();
        const w = works[Math.floor(Math.random()*works.length)];
        const ce = document.getElementById("book-cover");
        if (ce) {
          if (w.cover_id) { ce.src = `https://covers.openlibrary.org/b/id/${w.cover_id}-M.jpg`; ce.alt = w.title||"book"; ce.style.display = ""; }
          else ce.style.display = "none";
        }
        setText("book-title", w.title || "Unknown Title");
        setText("book-author", (w.authors||[]).map(a=>a.name).join(", ") ? `by ${(w.authors||[]).map(a=>a.name).join(", ")}` : "");
        setText("book-year", w.first_publish_year ? `First published ${w.first_publish_year}` : "");
        setText("book-subjects", (w.subject||[]).slice(0,3).join(", ") || subj.replace(/_/g," "));
        const le = document.getElementById("book-link");
        if (le && w.key) le.href = `https://openlibrary.org${w.key}`;
        showContent("book-loading", "book-content");
      })
      .catch(() => setText("book-loading", "⚠️ Open Library unavailable."));
  };

})();
