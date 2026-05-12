// split/fun.js
// The Fun Page — 8 widgets powered by free public APIs
(function () {
  "use strict";

  window.renderFun = function renderFun() {
    const content = document.getElementById("content");
    if (!content) return;

    content.innerHTML = `
      <div class="fun-page">

        <!-- ===== HEADER ===== -->
        <div class="fun-header">
          <div class="fun-header-title">🎉 Fun Zone</div>
          <div class="fun-header-sub">Live widgets powered by free APIs</div>
        </div>

        <!-- ===== ROW 1: Trivia + Pokemon ===== -->
        <div class="fun-row">

          <!-- TRIVIA -->
          <div class="fun-card" id="fun-trivia">
            <div class="fun-card-header">
              <span class="fun-card-icon">🎯</span>
              <span class="fun-card-title">Daily Trivia</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="trivia-loading">Loading question…</div>
              <div id="trivia-content" style="display:none;">
                <div class="trivia-category" id="trivia-cat"></div>
                <div class="trivia-q" id="trivia-q"></div>
                <div class="trivia-choices" id="trivia-choices"></div>
                <div class="trivia-result" id="trivia-result"></div>
              </div>
            </div>
            <button class="fun-btn" id="trivia-next" style="display:none;" onclick="window.__funLoadTrivia()">Next Question</button>
          </div>

          <!-- POKEMON OF THE DAY -->
          <div class="fun-card" id="fun-pokemon">
            <div class="fun-card-header">
              <span class="fun-card-icon">⚡</span>
              <span class="fun-card-title">Pokémon of the Day</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="poke-loading">Catching Pokémon…</div>
              <div id="poke-content" style="display:none;">
                <div class="poke-wrap">
                  <img id="poke-img" class="poke-img" src="" alt="" />
                  <div class="poke-info">
                    <div class="poke-name" id="poke-name"></div>
                    <div class="poke-types" id="poke-types"></div>
                    <div class="poke-stats" id="poke-stats"></div>
                  </div>
                </div>
              </div>
            </div>
            <button class="fun-btn" onclick="window.__funLoadPokemon()">New Pokémon</button>
          </div>

        </div>

        <!-- ===== ROW 2: Joke + Bored ===== -->
        <div class="fun-row">

          <!-- RANDOM JOKE -->
          <div class="fun-card" id="fun-joke">
            <div class="fun-card-header">
              <span class="fun-card-icon">😂</span>
              <span class="fun-card-title">Random Joke</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="joke-loading">Loading joke…</div>
              <div id="joke-content" style="display:none;">
                <div class="joke-setup" id="joke-setup"></div>
                <div class="joke-punchline-wrap" id="joke-punchline-wrap" style="display:none;">
                  <div class="joke-punchline" id="joke-punchline"></div>
                </div>
                <button class="fun-btn-outline" id="joke-reveal-btn" onclick="window.__funRevealPunchline()" style="display:none;">Reveal Punchline 👀</button>
              </div>
            </div>
            <button class="fun-btn" onclick="window.__funLoadJoke()">New Joke</button>
          </div>

          <!-- BORED ACTIVITY -->
          <div class="fun-card" id="fun-bored">
            <div class="fun-card-header">
              <span class="fun-card-icon">🎲</span>
              <span class="fun-card-title">Bored? Try This</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="bored-loading">Finding something fun…</div>
              <div id="bored-content" style="display:none;">
                <div class="bored-activity" id="bored-activity"></div>
                <div class="bored-meta" id="bored-meta"></div>
              </div>
            </div>
            <button class="fun-btn" onclick="window.__funLoadBored()">Another Idea</button>
          </div>

        </div>

        <!-- ===== ROW 3: Movie + Cocktail ===== -->
        <div class="fun-row">

          <!-- MOVIE SPOTLIGHT -->
          <div class="fun-card" id="fun-movie">
            <div class="fun-card-header">
              <span class="fun-card-icon">🎬</span>
              <span class="fun-card-title">Movie Spotlight</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="movie-loading">Finding a film…</div>
              <div id="movie-content" style="display:none;">
                <div class="movie-wrap">
                  <img id="movie-poster" class="movie-poster" src="" alt="" loading="lazy" />
                  <div class="movie-info">
                    <div class="movie-title" id="movie-title"></div>
                    <div class="movie-year" id="movie-year"></div>
                    <div class="movie-rating" id="movie-rating"></div>
                    <div class="movie-plot" id="movie-plot"></div>
                  </div>
                </div>
              </div>
            </div>
            <button class="fun-btn" onclick="window.__funLoadMovie()">New Movie</button>
          </div>

          <!-- COCKTAIL RECIPE -->
          <div class="fun-card" id="fun-cocktail">
            <div class="fun-card-header">
              <span class="fun-card-icon">🍸</span>
              <span class="fun-card-title">Random Cocktail</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="cocktail-loading">Mixing a drink…</div>
              <div id="cocktail-content" style="display:none;">
                <div class="cocktail-wrap">
                  <img id="cocktail-img" class="cocktail-img" src="" alt="" loading="lazy" />
                  <div class="cocktail-info">
                    <div class="cocktail-name" id="cocktail-name"></div>
                    <div class="cocktail-glass" id="cocktail-glass"></div>
                    <div class="cocktail-ingredients" id="cocktail-ingredients"></div>
                  </div>
                </div>
              </div>
            </div>
            <button class="fun-btn" onclick="window.__funLoadCocktail()">New Drink</button>
          </div>

        </div>

        <!-- ===== ROW 4: Country Guesser + Number Fact ===== -->
        <div class="fun-row">

          <!-- COUNTRY GUESSER -->
          <div class="fun-card" id="fun-country">
            <div class="fun-card-header">
              <span class="fun-card-icon">🌍</span>
              <span class="fun-card-title">Guess the Country</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="country-loading">Loading country…</div>
              <div id="country-content" style="display:none;">
                <div class="country-flag" id="country-flag"></div>
                <div class="country-clues" id="country-clues"></div>
                <div class="country-input-wrap" id="country-input-wrap">
                  <input type="text" id="country-guess" class="fun-input" placeholder="Type country name…" autocomplete="off" />
                  <button class="fun-btn-outline" onclick="window.__funGuessCountry()">Guess ✓</button>
                </div>
                <div class="country-result" id="country-result"></div>
                <div class="country-answer" id="country-answer" style="display:none;"></div>
              </div>
            </div>
            <button class="fun-btn" onclick="window.__funLoadCountry()">New Country</button>
          </div>

          <!-- NUMBER FACT -->
          <div class="fun-card" id="fun-number">
            <div class="fun-card-header">
              <span class="fun-card-icon">🔢</span>
              <span class="fun-card-title">Number Fact</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="number-loading">Fetching fact…</div>
              <div id="number-content" style="display:none;">
                <div class="number-big" id="number-big"></div>
                <div class="number-fact" id="number-fact"></div>
              </div>
            </div>
            <div class="fun-number-controls">
              <input type="number" id="number-input" class="fun-input fun-input-sm" placeholder="Enter a number" min="0" max="99999" />
              <button class="fun-btn-outline" onclick="window.__funLoadNumberCustom()">Look up</button>
              <button class="fun-btn" onclick="window.__funLoadNumber()">Random</button>
            </div>
          </div>

        </div>

        <!-- ===== ROW 5: Book Rec (full width) ===== -->
        <div class="fun-row">
          <div class="fun-card fun-card-wide" id="fun-book">
            <div class="fun-card-header">
              <span class="fun-card-icon">📖</span>
              <span class="fun-card-title">Random Book Recommendation</span>
            </div>
            <div class="fun-card-body">
              <div class="fun-loading" id="book-loading">Picking a book…</div>
              <div id="book-content" style="display:none;">
                <div class="book-wrap">
                  <img id="book-cover" class="book-cover" src="" alt="" loading="lazy" />
                  <div class="book-info">
                    <div class="book-title" id="book-title"></div>
                    <div class="book-author" id="book-author"></div>
                    <div class="book-year" id="book-year"></div>
                    <div class="book-subjects" id="book-subjects"></div>
                    <a id="book-link" class="fun-btn-outline book-link-btn" href="#" target="_blank" rel="noopener noreferrer">View on Open Library →</a>
                  </div>
                </div>
              </div>
            </div>
            <button class="fun-btn" onclick="window.__funLoadBook()">New Book</button>
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

    // Country enter key
    const guessInput = document.getElementById("country-guess");
    if (guessInput) {
      guessInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") window.__funGuessCountry();
      });
    }

    // Number input enter key
    const numInput = document.getElementById("number-input");
    if (numInput) {
      numInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") window.__funLoadNumberCustom();
      });
    }
  };

  // ============================================================
  // WIDGET HELPERS
  // ============================================================

  function showContent(loadingId, contentId) {
    const l = document.getElementById(loadingId);
    const c = document.getElementById(contentId);
    if (l) l.style.display = "none";
    if (c) c.style.display = "";
  }

  function showLoading(loadingId, contentId) {
    const l = document.getElementById(loadingId);
    const c = document.getElementById(contentId);
    if (l) l.style.display = "";
    if (c) c.style.display = "none";
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function setHTML(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
  }

  function safeFetch(url, timeout = 8000) {
    return Promise.race([
      fetch(url),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeout))
    ]);
  }

  // ============================================================
  // 1. TRIVIA (Open Trivia DB)
  // ============================================================
  let __triviaAnswers = [];
  let __triviaCorrect = "";

  window.__funLoadTrivia = function () {
    showLoading("trivia-loading", "trivia-content");
    const nextBtn = document.getElementById("trivia-next");
    if (nextBtn) nextBtn.style.display = "none";

    safeFetch("https://opentdb.com/api.php?amount=1&type=multiple")
      .then(r => r.json())
      .then(data => {
        const q = data.results[0];
        __triviaCorrect = decodeHTML(q.correct_answer);
        const wrong = q.incorrect_answers.map(a => decodeHTML(a));
        __triviaAnswers = [...wrong, __triviaCorrect].sort(() => Math.random() - 0.5);

        setText("trivia-cat", decodeHTML(q.category) + " · " + q.difficulty.toUpperCase());
        setText("trivia-q", decodeHTML(q.question));
        setHTML("trivia-result", "");

        const choicesEl = document.getElementById("trivia-choices");
        if (choicesEl) {
          choicesEl.innerHTML = __triviaAnswers.map(a =>
            `<button class="trivia-choice" onclick="window.__funCheckTrivia(this,'${escAttr(a)}')">${a}</button>`
          ).join("");
        }

        showContent("trivia-loading", "trivia-content");
      })
      .catch(() => {
        setText("trivia-loading", "⚠️ Couldn't load question. Tap Next to retry.");
        const nextBtn = document.getElementById("trivia-next");
        if (nextBtn) nextBtn.style.display = "";
      });
  };

  window.__funCheckTrivia = function (btn, answer) {
    const choices = document.querySelectorAll(".trivia-choice");
    choices.forEach(b => {
      b.disabled = true;
      const bAns = b.getAttribute("onclick").match(/'([^']+)'\)$/)?.[1] || b.textContent;
      if (bAns === __triviaCorrect) b.classList.add("trivia-correct");
      else b.classList.add("trivia-wrong");
    });

    const isRight = answer === __triviaCorrect;
    setHTML("trivia-result", isRight
      ? `<span class="trivia-win">✅ Correct!</span>`
      : `<span class="trivia-lose">❌ The answer was: <b>${__triviaCorrect}</b></span>`
    );

    const nextBtn = document.getElementById("trivia-next");
    if (nextBtn) nextBtn.style.display = "";
  };

  function decodeHTML(str) {
    try {
      const txt = document.createElement("textarea");
      txt.innerHTML = str;
      return txt.value;
    } catch { return str; }
  }

  function escAttr(str) {
    return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
  }

  // ============================================================
  // 2. POKEMON OF THE DAY (PokéAPI)
  // ============================================================
  window.__funLoadPokemon = function () {
    showLoading("poke-loading", "poke-content");
    const id = Math.floor(Math.random() * 898) + 1;

    safeFetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
      .then(r => r.json())
      .then(p => {
        const imgEl = document.getElementById("poke-img");
        if (imgEl) {
          const sprite = p.sprites?.other?.["official-artwork"]?.front_default
            || p.sprites?.front_default || "";
          imgEl.src = sprite;
          imgEl.alt = p.name;
        }

        setText("poke-name", p.name.charAt(0).toUpperCase() + p.name.slice(1));

        const typeColors = {
          fire:"#F08030",water:"#6890F0",grass:"#78C850",electric:"#F8D030",
          psychic:"#F85888",ice:"#98D8D8",dragon:"#7038F8",dark:"#705848",
          fairy:"#EE99AC",normal:"#A8A878",fighting:"#C03028",flying:"#A890F0",
          poison:"#A040A0",ground:"#E0C068",rock:"#B8A038",bug:"#A8B820",
          ghost:"#705898",steel:"#B8B8D0"
        };

        const typesEl = document.getElementById("poke-types");
        if (typesEl) {
          typesEl.innerHTML = p.types.map(t => {
            const col = typeColors[t.type.name] || "#888";
            return `<span class="poke-type-badge" style="background:${col}">${t.type.name}</span>`;
          }).join(" ");
        }

        const statsEl = document.getElementById("poke-stats");
        if (statsEl) {
          const key = { hp:"HP", attack:"ATK", defense:"DEF", speed:"SPD" };
          const shown = p.stats.filter(s => key[s.stat.name]);
          statsEl.innerHTML = shown.map(s =>
            `<div class="poke-stat-row">
               <span class="poke-stat-label">${key[s.stat.name]}</span>
               <div class="poke-stat-bar-bg"><div class="poke-stat-bar" style="width:${Math.min(100,(s.base_stat/160)*100)}%"></div></div>
               <span class="poke-stat-val">${s.base_stat}</span>
             </div>`
          ).join("");
        }

        showContent("poke-loading", "poke-content");
      })
      .catch(() => setText("poke-loading", "⚠️ PokéAPI unavailable. Try again."));
  };

  // ============================================================
  // 3. RANDOM JOKE (Official Joke API)
  // ============================================================
  window.__funLoadJoke = function () {
    showLoading("joke-loading", "joke-content");
    const punchWrap = document.getElementById("joke-punchline-wrap");
    const revealBtn = document.getElementById("joke-reveal-btn");
    if (punchWrap) punchWrap.style.display = "none";
    if (revealBtn) revealBtn.style.display = "none";

    safeFetch("https://official-joke-api.appspot.com/random_joke")
      .then(r => r.json())
      .then(j => {
        setText("joke-setup", j.setup);
        setText("joke-punchline", j.punchline);
        showContent("joke-loading", "joke-content");
        if (revealBtn) revealBtn.style.display = "";
      })
      .catch(() => setText("joke-loading", "⚠️ Joke API unavailable. Try again."));
  };

  window.__funRevealPunchline = function () {
    const punchWrap = document.getElementById("joke-punchline-wrap");
    const revealBtn = document.getElementById("joke-reveal-btn");
    if (punchWrap) punchWrap.style.display = "";
    if (revealBtn) revealBtn.style.display = "none";
  };

  // ============================================================
  // 4. BORED ACTIVITY (Bored API)
  // ============================================================
  window.__funLoadBored = function () {
    showLoading("bored-loading", "bored-content");

    safeFetch("https://bored-api.appbrewery.com/random")
      .then(r => r.json())
      .then(b => {
        setText("bored-activity", b.activity || b.activity);
        const participants = b.participants ? `👥 ${b.participants} participant${b.participants !== 1 ? "s" : ""}` : "";
        const price = b.price != null ? (b.price === 0 ? "💸 Free" : `💰 Cost: ${(b.price * 100).toFixed(0)}%`) : "";
        const type = b.type ? `🏷️ ${b.type.charAt(0).toUpperCase() + b.type.slice(1)}` : "";
        setText("bored-meta", [type, participants, price].filter(Boolean).join("  ·  "));
        showContent("bored-loading", "bored-content");
      })
      .catch(() => {
        const fallbacks = [
          "Go for a walk somewhere new",
          "Call someone you haven't talked to in a while",
          "Cook a recipe you've never tried",
          "Read the first chapter of a random book",
          "Take photos of interesting things in your neighborhood"
        ];
        setText("bored-activity", fallbacks[Math.floor(Math.random() * fallbacks.length)]);
        setText("bored-meta", "💡 Offline suggestion");
        showContent("bored-loading", "bored-content");
      });
  };

  // ============================================================
  // 5. MOVIE SPOTLIGHT (OMDB)
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
        if (m.Response === "False") throw new Error("No result");

        const posterEl = document.getElementById("movie-poster");
        if (posterEl) {
          posterEl.src = (m.Poster && m.Poster !== "N/A") ? m.Poster : "";
          posterEl.alt = m.Title || "";
          posterEl.style.display = (m.Poster && m.Poster !== "N/A") ? "" : "none";
        }

        setText("movie-title", m.Title || "");
        setText("movie-year", m.Year || "");
        const rating = m.imdbRating && m.imdbRating !== "N/A" ? `⭐ ${m.imdbRating}/10` : "";
        setText("movie-rating", rating);
        setText("movie-plot", m.Plot && m.Plot !== "N/A" ? m.Plot : "");

        showContent("movie-loading", "movie-content");
      })
      .catch(() => setText("movie-loading", "⚠️ Movie API unavailable. Try again."));
  };

  // ============================================================
  // 6. COCKTAIL RECIPE (TheCocktailDB)
  // ============================================================
  window.__funLoadCocktail = function () {
    showLoading("cocktail-loading", "cocktail-content");

    safeFetch("https://www.thecocktaildb.com/api/json/v1/1/random.php")
      .then(r => r.json())
      .then(data => {
        const d = data.drinks[0];

        const imgEl = document.getElementById("cocktail-img");
        if (imgEl) {
          imgEl.src = d.strDrinkThumb || "";
          imgEl.alt = d.strDrink || "";
          imgEl.style.display = d.strDrinkThumb ? "" : "none";
        }

        setText("cocktail-name", d.strDrink || "");
        setText("cocktail-glass", d.strGlass ? `🥃 Serve in: ${d.strGlass}` : "");

        const ingredients = [];
        for (let i = 1; i <= 15; i++) {
          const ing = d[`strIngredient${i}`];
          const meas = d[`strMeasure${i}`];
          if (ing && ing.trim()) {
            ingredients.push(`${meas ? meas.trim() + " " : ""}${ing.trim()}`);
          }
        }

        const ingEl = document.getElementById("cocktail-ingredients");
        if (ingEl) {
          ingEl.innerHTML = `<div class="cocktail-ing-title">Ingredients:</div>` +
            ingredients.map(i => `<div class="cocktail-ing-item">• ${i}</div>`).join("");
        }

        showContent("cocktail-loading", "cocktail-content");
      })
      .catch(() => setText("cocktail-loading", "⚠️ Cocktail API unavailable. Try again."));
  };

  // ============================================================
  // 7. COUNTRY GUESSER (REST Countries)
  // ============================================================
  let __currentCountry = null;
  let __countryGuessed = false;

  window.__funLoadCountry = function () {
    showLoading("country-loading", "country-content");
    __countryGuessed = false;

    const countryResult = document.getElementById("country-result");
    const countryAnswer = document.getElementById("country-answer");
    const guessInput = document.getElementById("country-guess");
    if (countryResult) countryResult.textContent = "";
    if (countryAnswer) { countryAnswer.style.display = "none"; countryAnswer.textContent = ""; }
    if (guessInput) guessInput.value = "";

    safeFetch("https://restcountries.com/v3.1/all?fields=name,flags,capital,population,region,subregion")
      .then(r => r.json())
      .then(countries => {
        __currentCountry = countries[Math.floor(Math.random() * countries.length)];
        const c = __currentCountry;

        const flagEl = document.getElementById("country-flag");
        if (flagEl) flagEl.textContent = c.flags?.emoji || "🏳️";

        const pop = c.population ? `👥 Population: ${Number(c.population).toLocaleString()}` : "";
        const cap = c.capital?.[0] ? `🏛️ Capital starts with: <b>${c.capital[0][0]}…</b>` : "";
        const region = c.region ? `🌐 Region: ${c.region}` : "";
        const nameLen = `🔤 ${c.name.common.length} letters`;

        const cluesEl = document.getElementById("country-clues");
        if (cluesEl) cluesEl.innerHTML = [region, cap, pop, nameLen].filter(Boolean).join("<br/>");

        showContent("country-loading", "country-content");
      })
      .catch(() => setText("country-loading", "⚠️ Countries API unavailable. Try again."));
  };

  window.__funGuessCountry = function () {
    if (!__currentCountry || __countryGuessed) return;
    const input = document.getElementById("country-guess");
    const guess = (input?.value || "").trim().toLowerCase();
    const correct = (__currentCountry.name.common || "").toLowerCase();
    const altNames = [
      ...(Object.values(__currentCountry.name?.nativeName || {}).map(n => (n.common || "").toLowerCase())),
      (__currentCountry.name?.official || "").toLowerCase()
    ];

    const isRight = guess === correct || altNames.includes(guess);
    __countryGuessed = true;

    const resultEl = document.getElementById("country-result");
    if (resultEl) {
      resultEl.textContent = isRight ? "✅ Correct! Well done!" : `❌ Not quite!`;
    }

    const answerEl = document.getElementById("country-answer");
    if (answerEl) {
      answerEl.style.display = "";
      answerEl.textContent = `The answer was: ${__currentCountry.name.common}`;
    }
  };

  // ============================================================
  // 8. NUMBER FACT (Numbers API)
  // ============================================================
  window.__funLoadNumber = function () {
    showLoading("number-loading", "number-content");
    const n = Math.floor(Math.random() * 1000);
    __fetchNumberFact(n);
  };

  window.__funLoadNumberCustom = function () {
    const input = document.getElementById("number-input");
    const val = parseInt(input?.value || "", 10);
    if (isNaN(val)) return;
    showLoading("number-loading", "number-content");
    __fetchNumberFact(val);
  };

  function __fetchNumberFact(n) {
    safeFetch(`https://numbersapi.com/${n}/trivia?json`)
      .then(r => r.json())
      .then(data => {
        setText("number-big", String(n));
        setText("number-fact", data.text || "No fact found.");
        showContent("number-loading", "number-content");
      })
      .catch(() => {
        safeFetch(`https://numbersapi.com/${n}`)
          .then(r => r.text())
          .then(text => {
            setText("number-big", String(n));
            setText("number-fact", text || "No fact found.");
            showContent("number-loading", "number-content");
          })
          .catch(() => {
            setText("number-big", String(n));
            setText("number-fact", `${n} is a perfectly fine number. The Numbers API seems to be offline right now.`);
            showContent("number-loading", "number-content");
          });
      });
  }

  // ============================================================
  // 9. BOOK RECOMMENDATION (Open Library)
  // ============================================================
  const BOOK_SUBJECTS = [
    "science_fiction","mystery","adventure","fantasy","history",
    "philosophy","biography","thriller","classic_literature","humor"
  ];

  window.__funLoadBook = function () {
    showLoading("book-loading", "book-content");
    const subject = BOOK_SUBJECTS[Math.floor(Math.random() * BOOK_SUBJECTS.length)];

    safeFetch(`https://openlibrary.org/subjects/${subject}.json?limit=20`)
      .then(r => r.json())
      .then(data => {
        const works = data.works || [];
        if (!works.length) throw new Error("No works");
        const work = works[Math.floor(Math.random() * works.length)];

        const coverEl = document.getElementById("book-cover");
        if (coverEl) {
          if (work.cover_id) {
            coverEl.src = `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg`;
            coverEl.alt = work.title || "";
            coverEl.style.display = "";
          } else {
            coverEl.style.display = "none";
          }
        }

        setText("book-title", work.title || "Unknown Title");
        const authors = (work.authors || []).map(a => a.name).join(", ");
        setText("book-author", authors ? `by ${authors}` : "");
        setText("book-year", work.first_publish_year ? `First published: ${work.first_publish_year}` : "");

        const subjects = (work.subject || []).slice(0, 4).join(", ");
        setText("book-subjects", subjects ? `📚 ${subjects}` : `📚 ${subject.replace(/_/g, " ")}`);

        const linkEl = document.getElementById("book-link");
        if (linkEl && work.key) {
          linkEl.href = `https://openlibrary.org${work.key}`;
        }

        showContent("book-loading", "book-content");
      })
      .catch(() => setText("book-loading", "⚠️ Open Library unavailable. Try again."));
  };

})();
