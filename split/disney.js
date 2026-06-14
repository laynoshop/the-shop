// split/disney.js
// Disney Page — for Ellis, Corinne & Finley
// Renders into #content via showTab("disney")
// All styles scoped to #disneyPage

(function () {
  "use strict";

  // ─── STYLES ─────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("disneyPageStyles")) return;
    const style = document.createElement("style");
    style.id = "disneyPageStyles";
    style.textContent = `
@import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@400,500,700,800,900&display=swap');

#disneyPage {
  --dp-bg: #0d0d1a;
  --dp-surface: #13132a;
  --dp-surface2: #1a1a36;
  --dp-border: rgba(255,255,255,.08);
  --dp-divider: rgba(255,255,255,.06);
  --dp-text: #f0eeff;
  --dp-muted: rgba(240,238,255,.55);
  --dp-faint: rgba(240,238,255,.3);
  --dp-gold: #ffd700;
  --dp-gold-hl: rgba(255,215,0,.12);
  --dp-blue: #1a6bff;
  --dp-blue-hl: rgba(26,107,255,.15);
  --dp-purple: #9b59ff;
  --dp-purple-hl: rgba(155,89,255,.15);
  --dp-pink: #ff5fa0;
  --dp-pink-hl: rgba(255,95,160,.15);
  --dp-teal: #00d4c8;
  --dp-green: #3dd68c;
  --dp-r-sm: 0.375rem;
  --dp-r-md: 0.625rem;
  --dp-r-lg: 0.875rem;
  --dp-r-xl: 1.125rem;
  --dp-r-2xl: 1.5rem;
  --dp-r-full: 9999px;
  --dp-sh: 0 4px 24px rgba(0,0,0,.45);
  --dp-sh-lg: 0 12px 48px rgba(0,0,0,.6);
  --dp-font: 'Cabinet Grotesk', 'Inter', system-ui, sans-serif;
  font-family: var(--dp-font);
  color: var(--dp-text);
  background: var(--dp-bg);
  padding: 1.25rem;
  max-width: 1280px;
  margin: 0 auto;
  box-sizing: border-box;
  min-height: 100vh;
}
#disneyPage *, #disneyPage *::before, #disneyPage *::after { box-sizing: border-box; }
#disneyPage button { cursor: pointer; background: none; border: none; font: inherit; color: inherit; }
#disneyPage ul { list-style: none; padding: 0; margin: 0; }

/* ── Starfield bg ── */
#disneyPage::before {
  content: '';
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at 20% 20%, rgba(155,89,255,.08) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 80%, rgba(26,107,255,.08) 0%, transparent 60%);
  pointer-events: none; z-index: 0;
}
#disneyPage > * { position: relative; z-index: 1; }

/* ── Hero Banner ── */
#disneyPage .dp-hero {
  border-radius: var(--dp-r-2xl);
  background: linear-gradient(135deg, #1a0a4a 0%, #0a2080 50%, #1a0a4a 100%);
  border: 1px solid rgba(155,89,255,.3);
  padding: 1.75rem 2rem;
  margin-bottom: 1.25rem;
  display: flex; align-items: center; justify-content: space-between;
  position: relative; overflow: hidden;
  box-shadow: var(--dp-sh-lg);
}
#disneyPage .dp-hero::before {
  content: '✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦';
  position: absolute; top: .5rem; left: 0; right: 0;
  text-align: center; font-size: .55rem; letter-spacing: .25rem;
  color: rgba(255,215,0,.25); pointer-events: none;
}
#disneyPage .dp-hero-left { display: flex; flex-direction: column; gap: .5rem; }
#disneyPage .dp-hero-logo { font-size: 2.2rem; font-weight: 900; letter-spacing: -.03em; line-height: 1;
  background: linear-gradient(135deg, #ffd700 0%, #fff6a0 50%, #ffd700 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
#disneyPage .dp-hero-sub { font-size: .85rem; color: var(--dp-muted); font-weight: 500; }
#disneyPage .dp-hero-kids { display: flex; gap: .5rem; margin-top: .25rem; }
#disneyPage .dp-kid-badge {
  padding: .25rem .75rem; border-radius: var(--dp-r-full);
  font-size: .72rem; font-weight: 700; letter-spacing: .03em;
}

/* ── Countdown ── */
#disneyPage .dp-countdown {
  background: linear-gradient(135deg, #3a0060, #6a0080);
  border: 1px solid rgba(255,95,160,.35);
  border-radius: var(--dp-r-2xl);
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  display: flex; align-items: center; gap: 1.5rem;
  box-shadow: 0 4px 32px rgba(255,95,160,.2);
  position: relative; overflow: hidden;
}
#disneyPage .dp-countdown::after {
  content: '🏰'; position: absolute; right: 1.5rem; font-size: 3rem;
  opacity: .15; pointer-events: none;
}
#disneyPage .dp-cd-info { flex: 1; }
#disneyPage .dp-cd-label { font-size: .72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .1em; color: var(--dp-pink); margin-bottom: .25rem; }
#disneyPage .dp-cd-title { font-size: 1.05rem; font-weight: 800; color: #fff; margin-bottom: .1rem; }
#disneyPage .dp-cd-sub { font-size: .78rem; color: rgba(255,255,255,.6); }
#disneyPage .dp-cd-nums { display: flex; gap: .75rem; align-items: center; }
#disneyPage .dp-cd-unit { text-align: center; }
#disneyPage .dp-cd-num {
  font-size: 1.8rem; font-weight: 900; line-height: 1;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,.7) 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
}
#disneyPage .dp-cd-lbl { font-size: .58rem; text-transform: uppercase; letter-spacing: .08em;
  color: rgba(255,255,255,.5); font-weight: 600; margin-top: .1rem; }
#disneyPage .dp-cd-sep { font-size: 1.2rem; color: rgba(255,255,255,.3); margin-bottom: .5rem; }

/* ── Grid ── */
#disneyPage .dp-grid { display: grid; grid-template-columns: 1fr 320px; gap: 1.1rem; }
#disneyPage .dp-left, #disneyPage .dp-right { display: flex; flex-direction: column; gap: 1.1rem; }

/* ── Cards ── */
#disneyPage .dp-card {
  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: var(--dp-r-xl);
  box-shadow: var(--dp-sh);
  overflow: hidden;
}
#disneyPage .dp-card-hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: .85rem 1.1rem; border-bottom: 1px solid var(--dp-divider);
}
#disneyPage .dp-card-title {
  font-size: .88rem; font-weight: 800; color: var(--dp-text);
  display: flex; align-items: center; gap: .5rem;
}
#disneyPage .dp-card-action {
  font-size: .72rem; color: var(--dp-gold); font-weight: 700;
  padding: .25rem .6rem; border-radius: var(--dp-r-sm);
  border: 1px solid rgba(255,215,0,.2); transition: background .15s;
}
#disneyPage .dp-card-action:hover { background: var(--dp-gold-hl); }
#disneyPage .dp-card-body { padding: .9rem 1.1rem; }

/* ── Streaming grid ── */
#disneyPage .dp-stream-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem;
}
#disneyPage .dp-stream-item {
  border-radius: var(--dp-r-lg); overflow: hidden;
  border: 1px solid var(--dp-border);
  background: var(--dp-surface2);
  cursor: pointer; transition: transform .18s, box-shadow .18s;
  position: relative;
}
#disneyPage .dp-stream-item:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 8px 32px rgba(0,0,0,.6); }
#disneyPage .dp-stream-thumb {
  aspect-ratio: 16/10; width: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 2.8rem;
}
#disneyPage .dp-stream-info { padding: .5rem .65rem .65rem; }
#disneyPage .dp-stream-title { font-size: .75rem; font-weight: 700; line-height: 1.3; color: var(--dp-text); }
#disneyPage .dp-stream-brand { font-size: .62rem; color: var(--dp-muted); margin-top: 2px; }
#disneyPage .dp-stream-badge {
  position: absolute; top: .4rem; right: .4rem;
  font-size: .58rem; font-weight: 800; padding: 2px 6px;
  border-radius: var(--dp-r-full); letter-spacing: .04em;
}

/* ── Trivia ── */
#disneyPage .dp-trivia-wrap {
  background: linear-gradient(135deg, var(--dp-surface2), #1a1a3a);
  border-radius: var(--dp-r-xl);
  padding: 1.1rem;
  border: 1px solid rgba(155,89,255,.2);
}
#disneyPage .dp-trivia-q {
  font-size: .95rem; font-weight: 800; color: var(--dp-text);
  text-align: center; margin-bottom: 1rem; line-height: 1.4;
  min-height: 2.8rem;
}
#disneyPage .dp-trivia-opts {
  display: grid; grid-template-columns: 1fr 1fr; gap: .5rem;
  margin-bottom: .75rem;
}
#disneyPage .dp-trivia-opt {
  padding: .6rem .75rem; border-radius: var(--dp-r-md);
  border: 1.5px solid var(--dp-border);
  background: var(--dp-surface); color: var(--dp-text);
  font-size: .78rem; font-weight: 600; text-align: center;
  cursor: pointer; transition: all .15s;
}
#disneyPage .dp-trivia-opt:hover { border-color: var(--dp-purple); background: var(--dp-purple-hl); color: #fff; }
#disneyPage .dp-trivia-opt.correct { background: rgba(61,214,140,.2); border-color: var(--dp-green); color: var(--dp-green); }
#disneyPage .dp-trivia-opt.wrong { background: rgba(255,95,160,.15); border-color: var(--dp-pink); color: var(--dp-pink); }
#disneyPage .dp-trivia-opt.disabled { pointer-events: none; opacity: .5; }
#disneyPage .dp-trivia-result {
  text-align: center; font-size: .8rem; font-weight: 700;
  min-height: 1.5rem; margin-bottom: .5rem;
}
#disneyPage .dp-trivia-footer {
  display: flex; align-items: center; justify-content: space-between;
}
#disneyPage .dp-trivia-score { font-size: .75rem; color: var(--dp-gold); font-weight: 700; }
#disneyPage .dp-trivia-btn {
  padding: .45rem 1rem; border-radius: var(--dp-r-full);
  background: linear-gradient(135deg, var(--dp-purple), var(--dp-blue));
  color: #fff; font-size: .78rem; font-weight: 700;
  transition: opacity .15s;
}
#disneyPage .dp-trivia-btn:hover { opacity: .85; }

/* ── Character of Day ── */
#disneyPage .dp-char {
  display: flex; gap: 1rem; align-items: center;
  padding: .85rem 1.1rem;
}
#disneyPage .dp-char-emoji { font-size: 3.5rem; line-height: 1; flex-shrink: 0; }
#disneyPage .dp-char-name { font-size: 1.1rem; font-weight: 900; color: var(--dp-gold); margin-bottom: .2rem; }
#disneyPage .dp-char-movie { font-size: .72rem; color: var(--dp-muted); margin-bottom: .4rem; }
#disneyPage .dp-char-fact { font-size: .78rem; line-height: 1.5; color: var(--dp-text); }
#disneyPage .dp-char-tags { display: flex; gap: .35rem; margin-top: .5rem; flex-wrap: wrap; }
#disneyPage .dp-char-tag {
  font-size: .62rem; font-weight: 700; padding: 2px 8px;
  border-radius: var(--dp-r-full);
}

/* ── Points leaderboard ── */
#disneyPage .dp-pts-list { display: flex; flex-direction: column; gap: .5rem; }
#disneyPage .dp-pt-row {
  display: flex; align-items: center; gap: .75rem;
  padding: .6rem .85rem;
  background: var(--dp-surface2); border-radius: var(--dp-r-lg);
  border: 1px solid var(--dp-border);
}
#disneyPage .dp-pt-rank { font-size: .75rem; font-weight: 900; color: var(--dp-gold); width: 1rem; text-align: center; flex-shrink: 0; }
#disneyPage .dp-pt-ava {
  width: 32px; height: 32px; border-radius: var(--dp-r-full);
  font-size: .8rem; font-weight: 800; display: flex; align-items: center; justify-content: center;
  color: #fff; flex-shrink: 0;
}
#disneyPage .dp-pt-name { flex: 1; font-size: .8rem; font-weight: 700; }
#disneyPage .dp-pt-score { font-size: .85rem; font-weight: 900; color: var(--dp-gold); font-variant-numeric: tabular-nums; }
#disneyPage .dp-pt-bar-wrap { flex: 1; height: 5px; background: rgba(255,255,255,.08); border-radius: var(--dp-r-full); overflow: hidden; }
#disneyPage .dp-pt-bar { height: 100%; border-radius: var(--dp-r-full); transition: width .7s cubic-bezier(.16,1,.3,1); }

/* ── News list ── */
#disneyPage .dp-news-list { display: flex; flex-direction: column; }
#disneyPage .dp-news-item {
  display: flex; gap: .75rem; align-items: flex-start;
  padding: .65rem .2rem; border-bottom: 1px solid var(--dp-divider);
  cursor: pointer;
}
#disneyPage .dp-news-item:last-child { border-bottom: none; }
#disneyPage .dp-news-thumb {
  width: 44px; height: 44px; border-radius: var(--dp-r-md);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-size: 1.6rem; background: var(--dp-surface2);
}
#disneyPage .dp-news-title { font-size: .78rem; font-weight: 700; line-height: 1.35; color: var(--dp-text); }
#disneyPage .dp-news-meta { font-size: .65rem; color: var(--dp-muted); margin-top: 2px; }

/* ── Favorites ── */
#disneyPage .dp-favs { display: flex; flex-direction: column; gap: .75rem; }
#disneyPage .dp-fav-kid { margin-bottom: .25rem; }
#disneyPage .dp-fav-kid-name {
  font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .08em;
  color: var(--dp-muted); margin-bottom: .4rem; padding-left: .2rem;
}
#disneyPage .dp-fav-row { display: flex; gap: .4rem; flex-wrap: wrap; }
#disneyPage .dp-fav-chip {
  padding: .3rem .7rem; border-radius: var(--dp-r-full);
  font-size: .72rem; font-weight: 700;
  border: 1px solid var(--dp-border);
  cursor: pointer; transition: all .15s;
}
#disneyPage .dp-fav-chip:hover { transform: scale(1.05); }

/* ── Responsive ── */
@media (max-width: 1000px) {
  #disneyPage .dp-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  #disneyPage .dp-countdown { flex-direction: column; gap: 1rem; align-items: flex-start; }
  #disneyPage .dp-countdown::after { display: none; }
  #disneyPage .dp-stream-grid { grid-template-columns: repeat(2, 1fr); }
  #disneyPage .dp-hero { flex-direction: column; gap: .75rem; }
  #disneyPage .dp-trivia-opts { grid-template-columns: 1fr; }
}
    `;
    document.head.appendChild(style);
  }

  // ─── DATA ───────────────────────────────────────────────────
  const STREAMING = [
    { emoji: "🦁", title: "Moana 2",             brand: "Disney+",  badge: "NEW",  badgeColor: "#ff5fa0",  bg: "#0a3a6a" },
    { emoji: "⚡",  title: "Inside Out 2",        brand: "Disney+",  badge: "HIT",  badgeColor: "#ffd700",  bg: "#1a3a0a" },
    { emoji: "🕷️", title: "Your Friendly Neighborhood Spider-Man", brand: "Marvel", badge: "NEW", badgeColor: "#ff3333", bg: "#3a0a0a" },
    { emoji: "🧊",  title: "Frozen (Classic)",    brand: "Disney+",  badge: null,   badgeColor: null,       bg: "#0a2a5a" },
    { emoji: "🌹",  title: "Beauty & the Beast",  brand: "Disney+",  badge: null,   badgeColor: null,       bg: "#3a0a2a" },
    { emoji: "🤖",  title: "WALL·E",              brand: "Pixar",    badge: "FAV",  badgeColor: "#9b59ff",  bg: "#0a1a3a" },
  ];

  const CHARACTERS = [
    { emoji: "🌊", name: "Moana",       movie: "Moana (2016)",           fact: "Moana means 'ocean' in Hawaiian. She was the first Disney princess from the Pacific Islands, and she chose her own path without a love interest — making her one of the most independent Disney heroines ever.", tags: [{l:"Brave",c:"#3dd68c"},{l:"Polynesian",c:"#00d4c8"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "❄️", name: "Elsa",        movie: "Frozen (2013)",           fact: "Elsa's ice powers were inspired by 'The Snow Queen' by Hans Christian Andersen. Her song 'Let It Go' was released in 41 languages and won the Academy Award for Best Original Song!", tags: [{l:"Magical",c:"#9b59ff"},{l:"Queen",c:"#ffd700"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "🐠", name: "Nemo",        movie: "Finding Nemo (2003)",      fact: "Nemo means 'no one' in Latin — a reference to Captain Nemo. His clownfish home is a real species: they actually can change sex, so in real life, his dad Marlin would have become his mom!", tags: [{l:"Pixar",c:"#ff5fa0"},{l:"Ocean",c:"#00d4c8"},{l:"Classic",c:"#ffd700"}] },
    { emoji: "🍃", name: "Mirabel",     movie: "Encanto (2021)",           fact: "Mirabel is the only Madrigal without a magical gift — yet she's the one who saves her family. The animators created over 170 distinct looks for her outfit's embroidery, each telling a tiny story.", tags: [{l:"Colombian",c:"#ffd700"},{l:"Family",c:"#ff5fa0"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "🧙", name: "Merlin",      movie: "The Sword in the Stone (1963)", fact: "Merlin is one of Disney's oldest magical characters. He claims to be from the future (the 20th century!) and uses that knowledge to help young King Arthur. His owl Archimedes is smarter than most humans.", tags: [{l:"Wizard",c:"#9b59ff"},{l:"Classic",c:"#ffd700"},{l:"Magic",c:"#ff5fa0"}] },
    { emoji: "🤖", name: "WALL·E",      movie: "WALL·E (2008)",            fact: "WALL·E's full name is Waste Allocation Load Lifter: Earth-class. He has been alone for 700 years but stayed hopeful, learning about love from a single VHS tape. His favorite film? Hello, Dolly!", tags: [{l:"Pixar",c:"#ff5fa0"},{l:"Robots",c:"#00d4c8"},{l:"Space",c:"#1a6bff"}] },
    { emoji: "🦁", name: "Simba",       movie: "The Lion King (1994)",     fact: "Simba means 'lion' in Swahili. The Lion King was the first Disney animated film with no fantasy or magical elements — it's rooted entirely in nature and family drama (and a little bit of Shakespeare).", tags: [{l:"Classic",c:"#ffd700"},{l:"King",c:"#ff5fa0"},{l:"Africa",c:"#3dd68c"}] },
  ];

  const TRIVIA = [
    { q: "What is the name of the fish in Finding Nemo who helps find Nemo?", opts: ["Dory", "Pearl", "Gill", "Bloat"], ans: 0 },
    { q: "What does 'Hakuna Matata' mean in The Lion King?", opts: ["Be brave", "No worries", "Live freely", "Stay strong"], ans: 1 },
    { q: "In Frozen, who sings 'Let It Go'?", opts: ["Anna", "Olaf", "Elsa", "Kristoff"], ans: 2 },
    { q: "What color is Cinderella's iconic ballgown?", opts: ["Pink", "Yellow", "Blue", "White"], ans: 2 },
    { q: "Which Pixar movie features a rat who wants to be a chef?", opts: ["Ratatouille", "Remy's Kitchen", "Chef Rat", "The Gourmet"], ans: 0 },
    { q: "What is the name of Moana's island home?", opts: ["Lalotai", "Motunui", "Te Fiti", "Samoa"], ans: 1 },
    { q: "In Inside Out, what color is Joy?", opts: ["Pink", "Blue", "Yellow", "Green"], ans: 2 },
    { q: "What is the enchanted rose in Beauty & the Beast a symbol of?", opts: ["Love", "Time running out", "Magic", "Hope"], ans: 1 },
    { q: "What animal is Dumbo?", opts: ["Rhino", "Giraffe", "Elephant", "Horse"], ans: 2 },
    { q: "Which Disney princess has hair that grows when it's cut?", opts: ["Rapunzel", "Moana", "Cinderella", "Ariel"], ans: 0 },
    { q: "What is the name of Woody's owner in Toy Story?", opts: ["Andy", "Buzz", "Sid", "Rex"], ans: 0 },
    { q: "In Encanto, what is Luisa's magical gift?", opts: ["Super speed", "Healing", "Super strength", "Invisibility"], ans: 2 },
  ];

  const NEWS = [
    { emoji: "🎬", title: "Zootopia 2 officially in production at Disney Animation", meta: "June 2026 · Disney" },
    { emoji: "🏰", title: "Disney Parks adds new Encanto-themed land coming 2027", meta: "May 2026 · Parks" },
    { emoji: "⚡",  title: "Marvel's Avengers: Doomsday trailer drops — biggest crossover yet", meta: "June 2026 · Marvel" },
    { emoji: "🧊", title: "Frozen 3 confirmed, Idina Menzel and Kristen Bell returning", meta: "April 2026 · Disney" },
    { emoji: "🦁", title: "Mufasa sequel announced with original voice cast", meta: "March 2026 · Disney" },
  ];

  const KIDS = [
    { name: "Ellis",   color: "#9b59ff", favs: ["Moana","Frozen","Encanto","Inside Out 2"] },
    { name: "Corinne", color: "#ff5fa0", favs: ["Beauty & the Beast","Frozen","Cinderella","Tangled"] },
    { name: "Finley",  color: "#ffd700", favs: ["Toy Story","WALL·E","The Lion King","Cars"] },
  ];

  // ─── COUNTDOWN ──────────────────────────────────────────────
  let _cdTimer = null;
  function startCountdown(container) {
    const target = new Date("2026-07-26T00:00:00");
    function tick() {
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        container.querySelector("#dpCdDays").textContent = "0";
        container.querySelector("#dpCdHrs").textContent = "0";
        container.querySelector("#dpCdMin").textContent = "0";
        container.querySelector("#dpCdSec").textContent = "0";
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      container.querySelector("#dpCdDays").textContent = d;
      container.querySelector("#dpCdHrs").textContent = String(h).padStart(2,"0");
      container.querySelector("#dpCdMin").textContent = String(m).padStart(2,"0");
      container.querySelector("#dpCdSec").textContent = String(s).padStart(2,"0");
    }
    tick();
    if (_cdTimer) clearInterval(_cdTimer);
    _cdTimer = setInterval(tick, 1000);
  }

  // ─── TRIVIA ─────────────────────────────────────────────────
  let triviaState = { idx: 0, score: 0, answered: false };

  function renderTrivia(wrap) {
    const q = TRIVIA[triviaState.idx % TRIVIA.length];
    const resultEl = wrap.querySelector(".dp-trivia-result");
    const scoreEl  = wrap.querySelector(".dp-trivia-score");
    const qEl      = wrap.querySelector(".dp-trivia-q");
    const optsEl   = wrap.querySelector(".dp-trivia-opts");
    const btn      = wrap.querySelector(".dp-trivia-btn");

    qEl.textContent = q.q;
    triviaState.answered = false;
    if (resultEl) resultEl.textContent = "";
    if (btn) btn.textContent = "Skip →";
    if (scoreEl) scoreEl.textContent = `⭐ ${triviaState.score} pts earned`;

    optsEl.innerHTML = q.opts.map((o, i) =>
      `<button class="dp-trivia-opt" data-idx="${i}">${o}</button>`
    ).join("");

    optsEl.querySelectorAll(".dp-trivia-opt").forEach(opt => {
      opt.addEventListener("click", () => {
        if (triviaState.answered) return;
        triviaState.answered = true;
        const chosen = parseInt(opt.dataset.idx);
        const correct = chosen === q.ans;
        optsEl.querySelectorAll(".dp-trivia-opt").forEach((o, i) => {
          o.classList.add("disabled");
          if (i === q.ans) o.classList.add("correct");
          else if (i === chosen) o.classList.add("wrong");
        });
        if (correct) {
          triviaState.score += 10;
          if (resultEl) resultEl.innerHTML = `<span style="color:var(--dp-green)">✓ Correct! +10 pts to the family!</span>`;
        } else {
          if (resultEl) resultEl.innerHTML = `<span style="color:var(--dp-pink)">✗ Not quite — the answer was "${q.opts[q.ans]}"</span>`;
        }
        if (scoreEl) scoreEl.textContent = `⭐ ${triviaState.score} pts earned`;
        if (btn) btn.textContent = "Next Question →";
      });
    });

    if (btn) {
      btn.onclick = () => {
        triviaState.idx++;
        renderTrivia(wrap);
      };
    }
  }

  // ─── MAIN RENDER ────────────────────────────────────────────
  function renderDisney() {
    injectStyles();
    if (_cdTimer) { clearInterval(_cdTimer); _cdTimer = null; }

    const content = document.getElementById("content");
    if (!content) return;

    // Pick today's character (rotates daily)
    const today = new Date();
    const charIdx = (today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()) % CHARACTERS.length;
    const char = CHARACTERS[charIdx];

    content.innerHTML = `
<div id="disneyPage">

  <!-- Hero -->
  <div class="dp-hero">
    <div class="dp-hero-left">
      <div class="dp-hero-logo">✨ Disney Hub</div>
      <div class="dp-hero-sub">Your family's magic corner — movies, trivia & more</div>
      <div class="dp-hero-kids">
        <span class="dp-kid-badge" style="background:rgba(155,89,255,.2);color:#9b59ff;border:1px solid rgba(155,89,255,.3)">Ellis</span>
        <span class="dp-kid-badge" style="background:rgba(255,95,160,.2);color:#ff5fa0;border:1px solid rgba(255,95,160,.3)">Corinne</span>
        <span class="dp-kid-badge" style="background:rgba(255,215,0,.15);color:#ffd700;border:1px solid rgba(255,215,0,.3)">Finley</span>
      </div>
    </div>
    <div style="font-size:4rem">🏰</div>
  </div>

  <!-- Girls Trip Countdown -->
  <div class="dp-countdown" id="dpCountdown">
    <div class="dp-cd-info">
      <div class="dp-cd-label">✨ Girls Trip Countdown</div>
      <div class="dp-cd-title">Mommy + Ellis + Corinne</div>
      <div class="dp-cd-sub">Starting July 26, 2026 — Let the magic begin! 🌸</div>
    </div>
    <div class="dp-cd-nums">
      <div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdDays">--</div><div class="dp-cd-lbl">Days</div></div>
      <div class="dp-cd-sep">:</div>
      <div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdHrs">--</div><div class="dp-cd-lbl">Hrs</div></div>
      <div class="dp-cd-sep">:</div>
      <div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdMin">--</div><div class="dp-cd-lbl">Min</div></div>
      <div class="dp-cd-sep">:</div>
      <div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdSec">--</div><div class="dp-cd-lbl">Sec</div></div>
    </div>
  </div>

  <!-- Main Grid -->
  <div class="dp-grid">
    <div class="dp-left">

      <!-- Now Streaming -->
      <div class="dp-card">
        <div class="dp-card-hdr">
          <div class="dp-card-title">🎬 Now on Disney+</div>
          <button class="dp-card-action">Open Disney+</button>
        </div>
        <div class="dp-card-body">
          <div class="dp-stream-grid">
            ${STREAMING.map(s => `
              <div class="dp-stream-item">
                <div class="dp-stream-thumb" style="background:${s.bg}">${s.emoji}</div>
                <div class="dp-stream-info">
                  <div class="dp-stream-title">${s.title}</div>
                  <div class="dp-stream-brand">${s.brand}</div>
                </div>
                ${s.badge ? `<div class="dp-stream-badge" style="background:${s.badgeColor};color:#000">${s.badge}</div>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <!-- Disney Trivia -->
      <div class="dp-card">
        <div class="dp-card-hdr">
          <div class="dp-card-title">🎯 Disney Trivia — Earn Family Points!</div>
          <span style="font-size:.72rem;color:var(--dp-muted)">10 pts per correct answer</span>
        </div>
        <div class="dp-card-body">
          <div class="dp-trivia-wrap" id="dpTriviaWrap">
            <div class="dp-trivia-q"></div>
            <div class="dp-trivia-opts"></div>
            <div class="dp-trivia-result"></div>
            <div class="dp-trivia-footer">
              <div class="dp-trivia-score">⭐ 0 pts earned</div>
              <button class="dp-trivia-btn">Skip →</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Disney News -->
      <div class="dp-card">
        <div class="dp-card-hdr">
          <div class="dp-card-title">📰 Disney News</div>
        </div>
        <div class="dp-card-body" style="padding-top:.25rem;padding-bottom:.25rem">
          <div class="dp-news-list">
            ${NEWS.map(n => `
              <div class="dp-news-item">
                <div class="dp-news-thumb">${n.emoji}</div>
                <div>
                  <div class="dp-news-title">${n.title}</div>
                  <div class="dp-news-meta">${n.meta}</div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

    </div>
    <div class="dp-right">

      <!-- Character of the Day -->
      <div class="dp-card">
        <div class="dp-card-hdr">
          <div class="dp-card-title">⭐ Character of the Day</div>
        </div>
        <div class="dp-char">
          <div class="dp-char-emoji">${char.emoji}</div>
          <div>
            <div class="dp-char-name">${char.name}</div>
            <div class="dp-char-movie">${char.movie}</div>
            <div class="dp-char-fact">${char.fact}</div>
            <div class="dp-char-tags">
              ${char.tags.map(t => `<span class="dp-char-tag" style="background:${t.c}22;color:${t.c};border:1px solid ${t.c}44">${t.l}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>

      <!-- Family Favorites -->
      <div class="dp-card">
        <div class="dp-card-hdr">
          <div class="dp-card-title">💜 Family Favorites</div>
        </div>
        <div class="dp-card-body">
          <div class="dp-favs">
            ${KIDS.map(k => `
              <div class="dp-fav-kid">
                <div class="dp-fav-kid-name" style="color:${k.color}">${k.name}'s picks</div>
                <div class="dp-fav-row">
                  ${k.favs.map(f => `<span class="dp-fav-chip" style="background:${k.color}18;color:${k.color};border-color:${k.color}33">${f}</span>`).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

      <!-- Trivia Leaderboard -->
      <div class="dp-card" id="dpLeaderCard">
        <div class="dp-card-hdr">
          <div class="dp-card-title">🏆 Trivia Leaderboard</div>
        </div>
        <div class="dp-card-body">
          <div class="dp-pts-list" id="dpPtsList">
            ${KIDS.map((k, i) => `
              <div class="dp-pt-row">
                <div class="dp-pt-rank">${["🥇","🥈","🥉"][i]}</div>
                <div class="dp-pt-ava" style="background:${k.color}">${k.name[0]}</div>
                <div class="dp-pt-name">${k.name}</div>
                <div class="dp-pt-score">0 ⭐</div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>

    </div>
  </div>

</div>
    `;

    // Boot countdown
    startCountdown(document.getElementById("dpCountdown"));

    // Boot trivia
    triviaState = { idx: Math.floor(Math.random() * TRIVIA.length), score: 0, answered: false };
    renderTrivia(document.getElementById("dpTriviaWrap"));
  }

  window.renderDisney = renderDisney;

})();
