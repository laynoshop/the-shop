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
#disneyPage .dp-hero-kids { display: flex; gap: .5rem; margin-top: .25rem; flex-wrap: wrap; }

/* ── Kid selector badges — interactive ── */
#disneyPage .dp-kid-badge {
  padding: .3rem .85rem; border-radius: var(--dp-r-full);
  font-size: .72rem; font-weight: 700; letter-spacing: .03em;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s, opacity .15s;
  user-select: none;
  position: relative;
}
#disneyPage .dp-kid-badge:hover { transform: scale(1.07); }
#disneyPage .dp-kid-badge:active { transform: scale(.96); }
#disneyPage .dp-kid-badge.dp-kid-active {
  box-shadow: 0 0 0 3px rgba(255,215,0,.5), 0 4px 16px rgba(0,0,0,.4);
  transform: scale(1.08);
}
#disneyPage .dp-kid-badge.dp-kid-active::after {
  content: ' ✓';
}
#disneyPage .dp-kid-badge:not(.dp-kid-active) { opacity: .6; }
#disneyPage .dp-active-kid-label {
  font-size: .78rem; color: var(--dp-gold); font-weight: 700;
  margin-top: .25rem;
  min-height: 1.2em;
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

/* ── Open Disney+ button ── */
#disneyPage .dp-open-btn {
  display: inline-flex; align-items: center; gap: .35rem;
  font-size: .72rem; font-weight: 700;
  background: #113CCF; color: #fff;
  padding: .3rem .75rem; border-radius: var(--dp-r-full);
  border: none; text-decoration: none;
  transition: background .15s, transform .12s;
  cursor: pointer;
}
#disneyPage .dp-open-btn:hover { background: #1a4fe0; transform: scale(1.04); }
#disneyPage .dp-open-btn:active { transform: scale(.97); }

/* ── Random Movie ── */
#disneyPage .dp-movie-wrap {
  padding: 1.1rem;
  display: flex; gap: 1.1rem; align-items: flex-start;
}
#disneyPage .dp-movie-poster {
  width: 110px; flex-shrink: 0;
  border-radius: var(--dp-r-lg);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,.6);
  border: 1px solid rgba(255,255,255,.1);
  aspect-ratio: 2/3;
  background: var(--dp-surface2);
  display: flex; align-items: center; justify-content: center;
}
#disneyPage .dp-movie-poster img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  border-radius: var(--dp-r-lg);
}
#disneyPage .dp-movie-poster-fallback {
  font-size: 3rem; text-align: center; line-height: 1;
}
#disneyPage .dp-movie-info { flex: 1; display: flex; flex-direction: column; gap: .4rem; }
#disneyPage .dp-movie-title {
  font-size: 1.1rem; font-weight: 900; color: var(--dp-gold); line-height: 1.2;
}
#disneyPage .dp-movie-meta { font-size: .72rem; color: var(--dp-muted); display: flex; gap: .5rem; flex-wrap: wrap; }
#disneyPage .dp-movie-desc { font-size: .78rem; color: var(--dp-text); line-height: 1.55; margin-top: .2rem; }
#disneyPage .dp-movie-tags { display: flex; gap: .35rem; flex-wrap: wrap; margin-top: .3rem; }
#disneyPage .dp-movie-tag {
  font-size: .62rem; font-weight: 700; padding: 2px 8px;
  border-radius: var(--dp-r-full);
}
#disneyPage .dp-movie-shuffle {
  margin-top: .75rem;
  display: inline-flex; align-items: center; gap: .4rem;
  padding: .45rem 1rem; border-radius: var(--dp-r-full);
  background: linear-gradient(135deg, var(--dp-purple), var(--dp-blue));
  color: #fff; font-size: .78rem; font-weight: 700;
  transition: opacity .15s, transform .12s;
}
#disneyPage .dp-movie-shuffle:hover { opacity: .85; transform: scale(1.04); }
#disneyPage .dp-movie-shuffle:active { transform: scale(.97); }

/* ── Trivia ── */
#disneyPage .dp-trivia-wrap { padding: .75rem 1.1rem 1rem; }
#disneyPage .dp-trivia-who {
  text-align: center; font-size: .72rem;
  margin-bottom: .5rem; min-height: 1.2em; font-weight: 700;
}
#disneyPage .dp-trivia-inner {
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
#disneyPage .dp-trivia-no-kid {
  text-align: center; padding: 1.5rem;
  color: var(--dp-muted); font-size: .85rem; font-weight: 600;
}
#disneyPage .dp-trivia-no-kid span { font-size: 1.5rem; display: block; margin-bottom: .5rem; }

/* ── Character of Day ── */
#disneyPage .dp-char {
  display: flex; gap: 1rem; align-items: flex-start;
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
#disneyPage .dp-char-date {
  font-size: .62rem; color: var(--dp-faint); text-align: center;
  padding: 0 1.1rem .75rem; font-style: italic;
}

/* ── Points leaderboard ── */
#disneyPage .dp-pts-list { display: flex; flex-direction: column; gap: .5rem; padding: .85rem 1.1rem; }
#disneyPage .dp-pt-row {
  display: flex; align-items: center; gap: .75rem;
  padding: .6rem .85rem;
  background: var(--dp-surface2); border-radius: var(--dp-r-lg);
  border: 1px solid var(--dp-border);
  transition: border-color .2s;
}
#disneyPage .dp-pt-row.dp-pt-active { border-color: var(--dp-gold); }
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

/* ── Responsive ── */
@media (max-width: 1000px) {
  #disneyPage .dp-grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  #disneyPage .dp-countdown { flex-direction: column; gap: 1rem; align-items: flex-start; }
  #disneyPage .dp-countdown::after { display: none; }
  #disneyPage .dp-hero { flex-direction: column; gap: .75rem; }
  #disneyPage .dp-trivia-opts { grid-template-columns: 1fr; }
  #disneyPage .dp-movie-wrap { flex-direction: column; align-items: center; }
  #disneyPage .dp-movie-poster { width: 140px; }
}
    `;
    document.head.appendChild(style);
  }

  // ─── DATA ───────────────────────────────────────────────────

  // Random Disney movies (last 35 years, 1990–2025) with TMDB poster paths
  const MOVIES = [
    { title: "The Little Mermaid",       year: 1989, emoji: "🧜", genre: "Musical · Adventure",   desc: "Ariel dreams of life on land and trades her voice to the sea witch Ursula for a chance to be human and win the heart of Prince Eric.",                         poster: "https://image.tmdb.org/t/p/w500/v3NtDxR0EspFpTMXIUHDKaEuQMn.jpg",   color: "#1a6bff" },
    { title: "Beauty and the Beast",     year: 1991, emoji: "🌹", genre: "Musical · Romance",      desc: "Belle, a bright young woman, is taken prisoner by a Beast in his enchanted castle. To break the spell, the Beast must learn to love — and be loved in return.", poster: "https://image.tmdb.org/t/p/w500/6j1l5gIeTLPdILSaJJjDJFzMpYU.jpg",   color: "#da7101" },
    { title: "Aladdin",                  year: 1992, emoji: "🪔", genre: "Musical · Comedy",       desc: "A street-smart young man named Aladdin finds a magic lamp housing a larger-than-life Genie who will grant three wishes — if they survive the scheming Jafar.", poster: "https://image.tmdb.org/t/p/w500/eLlLpzkjqiMqzfMjTCCXGJKKxE7.jpg",   color: "#d19900" },
    { title: "The Lion King",            year: 1994, emoji: "🦁", genre: "Musical · Drama",        desc: "Young lion Simba flees his kingdom after his uncle Scar murders his father. Years later, Simba must return and take his rightful place as king.",               poster: "https://image.tmdb.org/t/p/w500/sIVaHzUNKNBFJoB2DMc8N7PvbNL.jpg",   color: "#ffd700" },
    { title: "Toy Story",                year: 1995, emoji: "🤠", genre: "Comedy · Adventure",     desc: "Woody the cowboy is the top toy in Andy's room — until flashy new spaceman Buzz Lightyear arrives and steals the spotlight. A rivalry turns into a friendship.", poster: "https://image.tmdb.org/t/p/w500/uXDfjJbdP4ijW5hWSBrPl9zvcer.jpg",   color: "#3dd68c" },
    { title: "A Bug's Life",             year: 1998, emoji: "🐛", genre: "Comedy · Adventure",     desc: "A misfit ant named Flik recruits a troupe of warrior bugs to defend his colony from greedy grasshoppers — only to discover they're actually circus performers.", poster: "https://image.tmdb.org/t/p/w500/qlYxtqVfu6JMfCPFRCHpNbLAMuq.jpg",   color: "#3dd68c" },
    { title: "Mulan",                    year: 1998, emoji: "🌸", genre: "Action · Musical",       desc: "Mulan disguises herself as a man to fight in her elderly father's place in the Imperial Chinese army — and discovers she may be China's greatest warrior.",       poster: "https://image.tmdb.org/t/p/w500/dRQtBiMlJBUCB9mSlAmQVqELBp2.jpg",   color: "#ff5fa0" },
    { title: "Tarzan",                   year: 1999, emoji: "🦍", genre: "Adventure · Musical",    desc: "A man raised by gorillas in the jungle must choose between the world he was born into and the world he came from when explorers arrive in his forest.",           poster: "https://image.tmdb.org/t/p/w500/2xy7VapKSbqsoBGmYUbU4SJXNCA.jpg",   color: "#3dd68c" },
    { title: "Dinosaur",                 year: 2000, emoji: "🦕", genre: "Adventure · Family",     desc: "An Iguanodon raised by lemurs leads a herd of dinosaurs across a perilous landscape to reach a nesting ground after a meteor destroys their home.",              poster: "https://image.tmdb.org/t/p/w500/qJqpI7vxSNjNGN6n7MVuwT5k1O5.jpg",   color: "#da7101" },
    { title: "Monsters, Inc.",           year: 2001, emoji: "👾", genre: "Comedy · Adventure",     desc: "Two monster employees accidentally let a human child into the monster world and must get her home while evading a villainous colleague who wants to exploit her.", poster: "https://image.tmdb.org/t/p/w500/sgheSKxZkttIe8ONxg5HKx6KNdL.jpg",   color: "#9b59ff" },
    { title: "Lilo & Stitch",            year: 2002, emoji: "🐾", genre: "Comedy · Sci-Fi",        desc: "A lonely Hawaiian girl adopts a small blue alien she thinks is a dog. Together, the misfit pair discover the meaning of ohana — family — and that no one is left behind.", poster: "https://image.tmdb.org/t/p/w500/f3y3UDLaZBmXWwBdUBBbMZiJEBD.jpg", color: "#00d4c8" },
    { title: "Finding Nemo",             year: 2003, emoji: "🐠", genre: "Adventure · Comedy",     desc: "An overprotective clownfish crosses the entire ocean to find his son Nemo, helped along the way by an enthusiastically forgetful blue tang named Dory.",          poster: "https://image.tmdb.org/t/p/w500/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",   color: "#1a6bff" },
    { title: "The Incredibles",          year: 2004, emoji: "🦸", genre: "Action · Comedy",        desc: "A family of superheroes living in secret suburbia is called back into action when a super-villain threatens the world — and their family bonds.",                 poster: "https://image.tmdb.org/t/p/w500/2LqaLgk4Z226KkgPJuiOQ58ShKD.jpg",   color: "#ff5fa0" },
    { title: "Cars",                     year: 2006, emoji: "🏎️", genre: "Comedy · Racing",        desc: "A hotshot race car named Lightning McQueen gets stranded in a forgotten small town and learns that life is about more than winning trophies.",                   poster: "https://image.tmdb.org/t/p/w500/vkXmIFP381nTDCKFelGSjREQDKP.jpg",   color: "#da7101" },
    { title: "Ratatouille",              year: 2007, emoji: "🐀", genre: "Comedy · Drama",         desc: "A rat in Paris with extraordinary culinary talent teams up with a young kitchen boy to cook at France's most prestigious restaurant.",                           poster: "https://image.tmdb.org/t/p/w500/npHNjldbeTHdKKw28bJKs7lzqzj.jpg",   color: "#3dd68c" },
    { title: "WALL·E",                   year: 2008, emoji: "🤖", genre: "Sci-Fi · Romance",       desc: "A lonely robot left on abandoned Earth falls in love with a sleek probe named EVE and follows her into space, setting off an adventure that could save humanity.", poster: "https://image.tmdb.org/t/p/w500/hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg",  color: "#00d4c8" },
    { title: "Up",                       year: 2009, emoji: "🎈", genre: "Adventure · Drama",      desc: "A 78-year-old widower ties thousands of balloons to his house and flies to South America — accidentally bringing along an overeager 8-year-old Wilderness Explorer.", poster: "https://image.tmdb.org/t/p/w500/vpJBRzxJMVj2dFe7JI5UkuMnxCr.jpg", color: "#d19900" },
    { title: "The Princess and the Frog", year: 2009, emoji: "🐸", genre: "Musical · Romance",    desc: "Tiana, a hardworking New Orleans waitress with big dreams, kisses a prince who has been turned into a frog — and gets transformed herself.",                      poster: "https://image.tmdb.org/t/p/w500/iX3sQNv3VoyTcqRoWQCmOXaEBRv.jpg",   color: "#3dd68c" },
    { title: "Tangled",                  year: 2010, emoji: "🌺", genre: "Musical · Adventure",   desc: "Rapunzel, a princess with magical 70-foot hair who has never left her tower, teams up with a charming thief to finally see the outside world.",                   poster: "https://image.tmdb.org/t/p/w500/uAgL5RRBSNFGCJAnCBwzPxjHEjQ.jpg",   color: "#9b59ff" },
    { title: "Wreck-It Ralph",           year: 2012, emoji: "🕹️", genre: "Comedy · Adventure",    desc: "A video game villain tired of being the bad guy sneaks into other games on a quest to prove he can be a hero — with chaos-filled results.",                       poster: "https://image.tmdb.org/t/p/w500/uN6bCaK0c7f0XBXNKbCfEHf1eTi.jpg",   color: "#ff5fa0" },
    { title: "Brave",                    year: 2012, emoji: "🏹", genre: "Adventure · Fantasy",   desc: "Scottish princess Merida defies tradition, accidentally turns her mother into a bear, and must break the spell before it becomes permanent.",                     poster: "https://image.tmdb.org/t/p/w500/tPUKOlf1ABHzJ5Vkbc6PLXtFRPv.jpg",   color: "#da7101" },
    { title: "Frozen",                   year: 2013, emoji: "❄️", genre: "Musical · Fantasy",      desc: "Princess Anna embarks on an epic journey with mountaineer Kristoff and snowman Olaf to find her sister Elsa, whose icy powers have trapped their kingdom in eternal winter.", poster: "https://image.tmdb.org/t/p/w500/kgwjIb2JDHRhNk13lmSxiClFjVk.jpg", color: "#1a6bff" },
    { title: "Big Hero 6",               year: 2014, emoji: "🦾", genre: "Action · Comedy",        desc: "Boy genius Hiro Hamada and his inflatable robot companion Baymax team up with a group of nerdy friends to fight a masked villain threatening San Fransokyo.",     poster: "https://image.tmdb.org/t/p/w500/3GrFrJRCqAEYkJ6CgNbpMjkQbLR.jpg",   color: "#00d4c8" },
    { title: "Inside Out",               year: 2015, emoji: "🎭", genre: "Comedy · Drama",         desc: "When 11-year-old Riley moves to a new city, the emotions inside her head — Joy, Sadness, Fear, Anger, and Disgust — go on a wild adventure through her mind.",    poster: "https://image.tmdb.org/t/p/w500/aAmfIX3TT40zUHGcCKrlOZRKC7u.jpg",   color: "#ffd700" },
    { title: "Zootopia",                 year: 2016, emoji: "🦊", genre: "Comedy · Mystery",       desc: "Rabbit police officer Judy Hopps and con-artist fox Nick Wilde team up in a city of evolved animals to uncover a massive conspiracy.",                            poster: "https://image.tmdb.org/t/p/w500/sM33SANp9zneboZr5F29yBHQPCx.jpg",   color: "#9b59ff" },
    { title: "Moana",                    year: 2016, emoji: "🌊", genre: "Musical · Adventure",   desc: "The daughter of a Polynesian chief sets sail across the ocean to return the heart of the goddess Te Fiti and save her island — joined by the demigod Maui.",       poster: "https://image.tmdb.org/t/p/w500/pmiHkqNYfmb51oZQDMQ9XATPNQQ.jpg",   color: "#00d4c8" },
    { title: "Coco",                     year: 2017, emoji: "💀", genre: "Musical · Fantasy",      desc: "Miguel dreams of being a musician but his family bans music. He accidentally crosses into the Land of the Dead and must find his great-great-grandfather before it's too late.", poster: "https://image.tmdb.org/t/p/w500/gGEsBPAijhVUFoiNpgZXqRVWJt2.jpg", color: "#da7101" },
    { title: "Incredibles 2",            year: 2018, emoji: "🦸", genre: "Action · Comedy",        desc: "Helen Parr becomes the hero of a new campaign to make supers legal again, while Bob stays home with their kids — and Jack-Jack's newly emerging powers.",          poster: "https://image.tmdb.org/t/p/w500/bJ8IATBQWLCI9jNWzEYEWjV4EJ0.jpg",   color: "#ff5fa0" },
    { title: "Ralph Breaks the Internet", year: 2018, emoji: "🌐", genre: "Comedy · Adventure",   desc: "Ralph and Vanellope venture into the wild internet to find a replacement part for her game, discovering vast new worlds — and testing the limits of their friendship.", poster: "https://image.tmdb.org/t/p/w500/uZmCEsPL6ycMkTqPmtAFLqcnHeo.jpg", color: "#1a6bff" },
    { title: "Toy Story 4",              year: 2019, emoji: "🤠", genre: "Comedy · Adventure",     desc: "Woody, Buzz, and the gang join Bonnie on a road trip and encounter a new toy named Forky — who doesn't think he's a toy at all.",                                  poster: "https://image.tmdb.org/t/p/w500/w9kR8qbmQ01HwnvK4alvnQ2ca0L.jpg",   color: "#ffd700" },
    { title: "Frozen II",                year: 2019, emoji: "❄️", genre: "Musical · Fantasy",      desc: "Elsa and Anna journey into an enchanted forest and a dark sea to discover the origin of Elsa's magical powers and protect their kingdom.",                         poster: "https://image.tmdb.org/t/p/w500/xolFHRCkBH8cDZjlGGh7ARlJfCW.jpg",   color: "#9b59ff" },
    { title: "Soul",                     year: 2020, emoji: "🎷", genre: "Comedy · Fantasy",       desc: "Jazz musician Joe Gardner gets the chance of a lifetime — and then accidentally gets separated from his soul. A philosophical adventure about what makes life worth living.", poster: "https://image.tmdb.org/t/p/w500/hm58fzdcKFDKGZFTHIiSMB6BQYQ.jpg", color: "#00d4c8" },
    { title: "Raya and the Last Dragon", year: 2021, emoji: "🐉", genre: "Action · Adventure",    desc: "Lone warrior Raya embarks on a quest to find the last dragon in the fantasy world of Kumandra and restore peace to a land torn apart by an evil plague.",           poster: "https://image.tmdb.org/t/p/w500/lPsD10PP4rgUGiGR4CCXA6iY0QQ.jpg",   color: "#da7101" },
    { title: "Luca",                     year: 2021, emoji: "🌊", genre: "Adventure · Coming-of-Age", desc: "Two sea monster boys disguise themselves as humans and spend an unforgettable summer on the Italian Riviera — discovering friendship, courage, and the world above the water.", poster: "https://image.tmdb.org/t/p/w500/jTswp6KyDYKtvC52GbHagrZbGvD.jpg", color: "#1a6bff" },
    { title: "Encanto",                  year: 2021, emoji: "🦋", genre: "Musical · Fantasy",      desc: "The Madrigal family each has a magical gift — except Mirabel. When the magic starts to fade, she alone must discover why and save her extraordinary family.",        poster: "https://image.tmdb.org/t/p/w500/4j0PNHkMr5ax3IA8tjtxcmPU3QT.jpg",   color: "#ffd700" },
    { title: "Turning Red",              year: 2022, emoji: "🐼", genre: "Comedy · Coming-of-Age", desc: "Thirteen-year-old Mei Lee discovers that whenever she gets too excited, she transforms into a giant red panda — which is extremely inconvenient when you're a teenager.", poster: "https://image.tmdb.org/t/p/w500/qSS3nt7s5E3vLFPJBJzPikRtoxC.jpg", color: "#ff5fa0" },
    { title: "Lightyear",                year: 2022, emoji: "🚀", genre: "Sci-Fi · Adventure",     desc: "The origin story of Buzz Lightyear — the actual Space Ranger that inspired the toy. Stranded on a hostile planet, Buzz and a team of recruits work to get home.",   poster: "https://image.tmdb.org/t/p/w500/65lx5sSMkCOBGaHWSOi0SKN4Hm5.jpg",   color: "#00d4c8" },
    { title: "Strange World",            year: 2022, emoji: "🌍", genre: "Adventure · Sci-Fi",     desc: "The legendary Clades family goes on a dangerous expedition into an uncharted, wondrous land — and three generations must set aside their differences to save it.",    poster: "https://image.tmdb.org/t/p/w500/zHGjGoCbNrAdhyQPdRKROjuUAuG.jpg",   color: "#da7101" },
    { title: "Elemental",                year: 2023, emoji: "🔥", genre: "Comedy · Romance",       desc: "In a city where fire, water, land, and air residents live together, a fiery young woman and a go-with-the-flow guy discover something elemental in common.",         poster: "https://image.tmdb.org/t/p/w500/6oH378KUfIjS3iXRHFGzl0Dy9LY.jpg",   color: "#da7101" },
    { title: "Wish",                     year: 2023, emoji: "⭐", genre: "Musical · Fantasy",      desc: "Asha, a sharp-witted young woman, makes a wish so powerful it summons a cosmic force — a little ball of boundless energy called Star — who helps her protect her kingdom.", poster: "https://image.tmdb.org/t/p/w500/AcoVfiv1rrWOmAdpnAMnM56ki19.jpg",  color: "#9b59ff" },
    { title: "Inside Out 2",             year: 2024, emoji: "😰", genre: "Comedy · Drama",         desc: "Riley turns 13 and puberty hits the control panel of her mind hard — including a new emotion, Anxiety, who takes over with very big, very overwhelming plans.",       poster: "https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",   color: "#ff5fa0" },
    { title: "Moana 2",                  year: 2024, emoji: "🌊", genre: "Musical · Adventure",   desc: "Moana sets sail for the far seas of Oceania on a daring new voyage, joined by Maui and an unlikely crew, to face the ocean's greatest mysteries.",                   poster: "https://image.tmdb.org/t/p/w500/yHZ4PuMKZADMZe6VLOQT68sshMy.jpg",   color: "#1a6bff" },
  ];

  // 14 characters — cycles daily using UTC days since epoch
  const CHARACTERS = [
    { emoji: "🌊", name: "Moana",       movie: "Moana (2016)",                    fact: "Moana means 'ocean' in Hawaiian. She was the first Disney princess from the Pacific Islands, and she chose her own path without a love interest — making her one of the most independent Disney heroines ever.", tags: [{l:"Brave",c:"#3dd68c"},{l:"Polynesian",c:"#00d4c8"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "❄️", name: "Elsa",        movie: "Frozen (2013)",                   fact: "Elsa's ice powers were inspired by 'The Snow Queen' by Hans Christian Andersen. Her song 'Let It Go' was released in 41 languages and won the Academy Award for Best Original Song!", tags: [{l:"Magical",c:"#9b59ff"},{l:"Queen",c:"#ffd700"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "🐠", name: "Nemo",        movie: "Finding Nemo (2003)",             fact: "Nemo means 'no one' in Latin — a reference to Captain Nemo. His clownfish home is a real species: they actually can change sex, so in real life, his dad Marlin would have become his mom!", tags: [{l:"Pixar",c:"#ff5fa0"},{l:"Ocean",c:"#00d4c8"},{l:"Classic",c:"#ffd700"}] },
    { emoji: "🍃", name: "Mirabel",     movie: "Encanto (2021)",                  fact: "Mirabel is the only Madrigal without a magical gift — yet she's the one who saves her family. The animators created over 170 distinct looks for her outfit's embroidery, each telling a tiny story.", tags: [{l:"Colombian",c:"#ffd700"},{l:"Family",c:"#ff5fa0"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "🤖", name: "WALL·E",      movie: "WALL·E (2008)",                   fact: "WALL·E's full name is Waste Allocation Load Lifter: Earth-class. He has been alone for 700 years but stayed hopeful, learning about love from a single VHS tape. His favorite film? Hello, Dolly!", tags: [{l:"Pixar",c:"#ff5fa0"},{l:"Robots",c:"#00d4c8"},{l:"Space",c:"#1a6bff"}] },
    { emoji: "🦁", name: "Simba",       movie: "The Lion King (1994)",            fact: "Simba means 'lion' in Swahili. The Lion King was the first Disney animated film with no fantasy or magical elements — it's rooted entirely in nature and family drama (and a little bit of Shakespeare).", tags: [{l:"Classic",c:"#ffd700"},{l:"King",c:"#ff5fa0"},{l:"Africa",c:"#3dd68c"}] },
    { emoji: "🧙", name: "Merlin",      movie: "The Sword in the Stone (1963)",   fact: "Merlin claims to be from the future — the 20th century! He uses that knowledge to help young King Arthur. His owl Archimedes is smarter than most humans in the film.", tags: [{l:"Wizard",c:"#9b59ff"},{l:"Classic",c:"#ffd700"},{l:"Magic",c:"#ff5fa0"}] },
    { emoji: "🌺", name: "Rapunzel",    movie: "Tangled (2010)",                  fact: "Rapunzel's 70 feet of hair took the animation team over 2 years to perfect. She is the only Disney princess whose story starts before she's born and ends after her parents reunite with her.", tags: [{l:"Princess",c:"#ffd700"},{l:"Magic Hair",c:"#9b59ff"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "🏹", name: "Merida",      movie: "Brave (2012)",                    fact: "Merida was Pixar's first female protagonist and the first Disney/Pixar princess not to have a love interest. Her curly hair has over 100,000 individual strands — a record for Pixar at the time.", tags: [{l:"Pixar",c:"#ff5fa0"},{l:"Scottish",c:"#3dd68c"},{l:"Brave",c:"#ffd700"}] },
    { emoji: "🌸", name: "Mulan",       movie: "Mulan (1998)",                    fact: "Mulan is based on the Chinese legend of Hua Mulan. The animators spent months studying Chinese architecture and art to bring her world to life. She's one of the few Disney heroines who earns her happy ending through battle.", tags: [{l:"Warrior",c:"#ff5fa0"},{l:"Chinese",c:"#ffd700"},{l:"Classic",c:"#3dd68c"}] },
    { emoji: "🐾", name: "Stitch",      movie: "Lilo & Stitch (2002)",            fact: "Stitch was originally designed as a space criminal so dangerous no planet would take him. Experiment 626 has four arms, retractable claws, and is one of the strongest creatures in the galaxy — but loves Elvis.", tags: [{l:"Alien",c:"#00d4c8"},{l:"Hawaii",c:"#3dd68c"},{l:"Disney+",c:"#1a6bff"}] },
    { emoji: "🎪", name: "Woody",       movie: "Toy Story (1995)",                fact: "Woody was the first fully computer-animated main character in a feature film. He's a pull-string cowboy whose voice actor Tom Hanks recorded over 950 unique lines for the original Toy Story.", tags: [{l:"Pixar",c:"#ff5fa0"},{l:"Cowboy",c:"#ffd700"},{l:"Classic",c:"#3dd68c"}] },
    { emoji: "🐻", name: "Baloo",       movie: "The Jungle Book (1967)",          fact: "Baloo's carefree 'Bear Necessities' philosophy was so beloved that the song was nominated for an Academy Award. Phil Harris, his voice actor, improvised many of his lines because he forgot the script.", tags: [{l:"Classic",c:"#ffd700"},{l:"Jungle",c:"#3dd68c"},{l:"Fun",c:"#ff5fa0"}] },
    { emoji: "🐟", name: "Dory",        movie: "Finding Dory (2016)",             fact: "Dory speaks over 10 languages in the Finding Nemo franchise. Her short-term memory loss is portrayed with surprising accuracy — she retains emotional memory and procedural skills even when she forgets facts.", tags: [{l:"Pixar",c:"#ff5fa0"},{l:"Ocean",c:"#00d4c8"},{l:"Disney+",c:"#1a6bff"}] },
  ];

  const TRIVIA_BY_KID = {
    Ellis: [
      { q: "What is the name of Moana's island home?", opts: ["Lalotai","Motunui","Te Fiti","Samoa"], ans: 1 },
      { q: "What ocean creature guides Moana throughout her journey?", opts: ["A whale","The Ocean itself","A dolphin","A sea turtle"], ans: 1 },
      { q: "In Encanto, what is Luisa's magical gift?", opts: ["Super speed","Healing","Super strength","Invisibility"], ans: 2 },
      { q: "In Inside Out, what color is Joy?", opts: ["Pink","Blue","Yellow","Green"], ans: 2 },
      { q: "What is the name of the villain in Frozen?", opts: ["Hans","Gaston","Hades","Jafar"], ans: 0 },
      { q: "In Frozen, who sings 'Let It Go'?", opts: ["Anna","Olaf","Elsa","Kristoff"], ans: 2 },
    ],
    Corinne: [
      { q: "What color is Cinderella's iconic ballgown?", opts: ["Pink","Yellow","Blue","White"], ans: 2 },
      { q: "What enchanted object in Beauty & the Beast measures the Beast's time?", opts: ["A clock","A rose","A mirror","A candle"], ans: 1 },
      { q: "Which Disney princess has hair that glows when she sings?", opts: ["Moana","Rapunzel","Cinderella","Ariel"], ans: 1 },
      { q: "In Tangled, what is the name of Rapunzel's chameleon?", opts: ["Pascal","Maximus","Flynn","Bruno"], ans: 0 },
      { q: "What does Ariel collect in The Little Mermaid?", opts: ["Seashells","Human objects","Fish","Coral"], ans: 1 },
      { q: "In Cinderella, what did the fairy godmother turn into a carriage?", opts: ["A watermelon","A pumpkin","A zucchini","A squash"], ans: 1 },
    ],
    Finley: [
      { q: "What is the name of the fish in Finding Nemo who helps find Nemo?", opts: ["Dory","Pearl","Gill","Bloat"], ans: 0 },
      { q: "What does 'Hakuna Matata' mean in The Lion King?", opts: ["Be brave","No worries","Live freely","Stay strong"], ans: 1 },
      { q: "What is Woody's full name in Toy Story?", opts: ["Woody Pride","Woody Rogers","Woody Star","Woody Rex"], ans: 0 },
      { q: "Which Pixar movie features a rat who wants to be a chef?", opts: ["Ratatouille","Remy's Kitchen","Chef Rat","The Gourmet"], ans: 0 },
      { q: "What animal is Dumbo?", opts: ["Rhino","Giraffe","Elephant","Horse"], ans: 2 },
      { q: "What is the name of Woody's owner in Toy Story?", opts: ["Andy","Buzz","Sid","Rex"], ans: 0 },
    ],
  };

  const KIDS = [
    { name: "Ellis",   color: "#9b59ff", favs: ["Moana","Frozen","Encanto","Inside Out 2"] },
    { name: "Corinne", color: "#ff5fa0", favs: ["Beauty & the Beast","Frozen","Cinderella","Tangled"] },
    { name: "Finley",  color: "#ffd700", favs: ["Toy Story","WALL·E","The Lion King","Cars"] },
  ];

  // ─── STATE ──────────────────────────────────────────────────
  let _cdTimer = null;
  let activeKid = null;
  let triviaScores = { Ellis: 0, Corinne: 0, Finley: 0 };
  let triviaState = { idx: 0, answered: false };
  let currentMovieIdx = Math.floor(Math.random() * MOVIES.length);

  // ─── COUNTDOWN ──────────────────────────────────────────────
  function startCountdown(container) {
    const target = new Date("2026-07-26T00:00:00");
    function tick() {
      const now = new Date();
      const diff = target - now;
      if (diff <= 0) {
        container.querySelector("#dpCdDays").textContent = "0";
        container.querySelector("#dpCdHrs").textContent = "00";
        container.querySelector("#dpCdMin").textContent = "00";
        container.querySelector("#dpCdSec").textContent = "00";
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

  // ─── KID SELECTOR ───────────────────────────────────────────
  function selectKid(name) {
    activeKid = name;
    document.querySelectorAll("#disneyPage .dp-kid-badge").forEach(b => {
      b.classList.toggle("dp-kid-active", b.dataset.kid === name);
    });
    const label = document.getElementById("dpActiveKidLabel");
    if (label) {
      const kid = KIDS.find(k => k.name === name);
      label.textContent = "Playing as " + name + " \u2728";
      label.style.color = kid ? kid.color : "var(--dp-gold)";
    }
    triviaState = { idx: 0, answered: false };
    const wrap = document.getElementById("dpTriviaWrap");
    if (wrap) renderTrivia(wrap);
    updateLeaderboard();
  }

  // ─── RANDOM MOVIE ───────────────────────────────────────────
  function renderMovie(idx) {
    var m = MOVIES[idx];
    var wrap = document.getElementById("dpMovieWrap");
    if (!wrap) return;
    wrap.innerHTML =
      '<div class="dp-movie-poster">' +
        '<img src="' + m.poster + '" alt="' + m.title + ' movie poster" width="110" height="165" loading="lazy" ' +
          'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
        '<div class="dp-movie-poster-fallback" style="display:none">' + m.emoji + '</div>' +
      '</div>' +
      '<div class="dp-movie-info">' +
        '<div class="dp-movie-title">' + m.title + '</div>' +
        '<div class="dp-movie-meta">' +
          '<span style="color:' + m.color + ';font-weight:800">' + m.year + '</span>' +
          '<span style="color:var(--dp-faint)">·</span>' +
          '<span>' + m.genre + '</span>' +
        '</div>' +
        '<div class="dp-movie-desc">' + m.desc + '</div>' +
        '<button class="dp-movie-shuffle" id="dpMovieShuffle">🎲 Shuffle Movie</button>' +
      '</div>';
    document.getElementById("dpMovieShuffle").onclick = function() {
      var next;
      do { next = Math.floor(Math.random() * MOVIES.length); } while (next === currentMovieIdx && MOVIES.length > 1);
      currentMovieIdx = next;
      renderMovie(currentMovieIdx);
    };
  }

  // ─── TRIVIA ─────────────────────────────────────────────────
  function renderTrivia(wrap) {
    if (!activeKid) {
      wrap.innerHTML = '<div class="dp-trivia-no-kid"><span>\uD83D\uDC46</span>Tap your name above to start trivia!</div>';
      return;
    }
    const pool = TRIVIA_BY_KID[activeKid] || [];
    const q = pool[triviaState.idx % pool.length];
    const kid = KIDS.find(k => k.name === activeKid);
    const kidColor = kid ? kid.color : "var(--dp-gold)";

    wrap.innerHTML =
      '<div class="dp-trivia-who" style="color:' + kidColor + '">\uD83C\uDFAF ' + activeKid + '\u2019s turn \u2014 ' + triviaScores[activeKid] + ' pts earned</div>' +
      '<div class="dp-trivia-inner">' +
        '<div class="dp-trivia-q">' + q.q + '</div>' +
        '<div class="dp-trivia-opts">' +
          q.opts.map(function(o, i) { return '<button class="dp-trivia-opt" data-idx="' + i + '">' + o + '</button>'; }).join("") +
        '</div>' +
        '<div class="dp-trivia-result"></div>' +
        '<div class="dp-trivia-footer">' +
          '<div class="dp-trivia-score" style="color:' + kidColor + '">\u2B50 ' + triviaScores[activeKid] + ' pts</div>' +
          '<button class="dp-trivia-btn">Skip \u2192</button>' +
        '</div>' +
      '</div>';

    wrap.querySelectorAll(".dp-trivia-opt").forEach(function(opt) {
      opt.addEventListener("click", function() {
        if (triviaState.answered) return;
        triviaState.answered = true;
        var chosen = parseInt(opt.dataset.idx);
        var correct = chosen === q.ans;
        wrap.querySelectorAll(".dp-trivia-opt").forEach(function(o, i) {
          o.classList.add("disabled");
          if (i === q.ans) o.classList.add("correct");
          else if (i === chosen && !correct) o.classList.add("wrong");
        });
        var resultEl = wrap.querySelector(".dp-trivia-result");
        var scoreEl  = wrap.querySelector(".dp-trivia-score");
        var btn      = wrap.querySelector(".dp-trivia-btn");
        if (correct) {
          triviaScores[activeKid] += 10;
          resultEl.innerHTML = '<span style="color:var(--dp-green)">\u2713 Correct! +10 pts for ' + activeKid + '!</span>';
        } else {
          resultEl.innerHTML = '<span style="color:var(--dp-pink)">\u2717 Not quite \u2014 the answer was \u201C' + q.opts[q.ans] + '\u201D</span>';
        }
        if (scoreEl) { scoreEl.textContent = "\u2B50 " + triviaScores[activeKid] + " pts"; scoreEl.style.color = kidColor; }
        var whoEl = wrap.querySelector(".dp-trivia-who");
        if (whoEl) whoEl.textContent = "\uD83C\uDFAF " + activeKid + "\u2019s turn \u2014 " + triviaScores[activeKid] + " pts earned";
        if (btn) btn.textContent = "Next Question \u2192";
        updateLeaderboard();
      });
    });

    var btn = wrap.querySelector(".dp-trivia-btn");
    if (btn) {
      btn.onclick = function() {
        triviaState.idx++;
        triviaState.answered = false;
        renderTrivia(wrap);
      };
    }
  }

  // ─── LEADERBOARD ────────────────────────────────────────────
  function updateLeaderboard() {
    var list = document.getElementById("dpPtsList");
    if (!list) return;
    var sorted = KIDS.slice().sort(function(a, b) { return (triviaScores[b.name] || 0) - (triviaScores[a.name] || 0); });
    var medals = ["\uD83E\uDD47","\uD83E\uDD48","\uD83E\uDD49"];
    var max = Math.max.apply(null, sorted.map(function(k) { return triviaScores[k.name] || 0; }).concat([1]));
    list.innerHTML = sorted.map(function(k, i) {
      return '<div class="dp-pt-row' + (activeKid === k.name ? ' dp-pt-active' : '') + '">' +
        '<div class="dp-pt-rank">' + medals[i] + '</div>' +
        '<div class="dp-pt-ava" style="background:' + k.color + '">' + k.name[0] + '</div>' +
        '<div class="dp-pt-name">' + k.name + '</div>' +
        '<div class="dp-pt-bar-wrap"><div class="dp-pt-bar" style="width:' + Math.round(((triviaScores[k.name]||0)/max)*100) + '%;background:' + k.color + '"></div></div>' +
        '<div class="dp-pt-score">' + (triviaScores[k.name] || 0) + ' \u2B50</div>' +
      '</div>';
    }).join("");
  }

  // ─── OPEN DISNEY+ ───────────────────────────────────────────
  function openDisneyPlus(e) {
    if (e) e.preventDefault();
    var start = Date.now();
    var appLink = document.createElement("a");
    appLink.href = "disneyplus://home";
    appLink.style.display = "none";
    document.body.appendChild(appLink);
    appLink.click();
    document.body.removeChild(appLink);
    setTimeout(function() {
      if (Date.now() - start < 2000) {
        window.open("https://www.disneyplus.com", "_blank", "noopener,noreferrer");
      }
    }, 1500);
  }

  // ─── MAIN RENDER ────────────────────────────────────────────
  function renderDisney() {
    injectStyles();
    if (_cdTimer) { clearInterval(_cdTimer); _cdTimer = null; }

    var content = document.getElementById("content");
    if (!content) return;

    // Character of the Day — deterministic daily rotation using UTC date
    var today = new Date();
    var utcDay = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    var charIdx = utcDay % CHARACTERS.length;
    var char = CHARACTERS[charIdx];
    var dateStr = today.toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });

    // Pick a fresh random movie each page load
    currentMovieIdx = Math.floor(Math.random() * MOVIES.length);

    content.innerHTML =
      '<div id="disneyPage">' +

      // Hero
      '<div class="dp-hero">' +
        '<div class="dp-hero-left">' +
          '<div class="dp-hero-logo">\u2728 Disney Hub</div>' +
          '<div class="dp-hero-sub">Tap your name to play trivia and earn points!</div>' +
          '<div class="dp-hero-kids">' +
            '<button class="dp-kid-badge" data-kid="Ellis" style="background:rgba(155,89,255,.2);color:#9b59ff;border:1px solid rgba(155,89,255,.3)" onclick="window._dpSelectKid(\'Ellis\')">Ellis</button>' +
            '<button class="dp-kid-badge" data-kid="Corinne" style="background:rgba(255,95,160,.2);color:#ff5fa0;border:1px solid rgba(255,95,160,.3)" onclick="window._dpSelectKid(\'Corinne\')">Corinne</button>' +
            '<button class="dp-kid-badge" data-kid="Finley" style="background:rgba(255,215,0,.15);color:#ffd700;border:1px solid rgba(255,215,0,.3)" onclick="window._dpSelectKid(\'Finley\')">Finley</button>' +
          '</div>' +
          '<div class="dp-active-kid-label" id="dpActiveKidLabel">\uD83D\uDC46 Tap your name to start!</div>' +
        '</div>' +
        '<div style="font-size:4rem">\uD83C\uDFF0</div>' +
      '</div>' +

      // Girls Trip Countdown — Mommy + Corinne + Finley
      '<div class="dp-countdown" id="dpCountdown">' +
        '<div class="dp-cd-info">' +
          '<div class="dp-cd-label">\u2728 Girls Trip Countdown</div>' +
          '<div class="dp-cd-title">Mommy + Corinne + Finley \uD83D\uDC95</div>' +
          '<div class="dp-cd-sub">Starting July 26, 2026 \u2014 Let the magic begin! \uD83C\uDF38</div>' +
        '</div>' +
        '<div class="dp-cd-nums">' +
          '<div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdDays">--</div><div class="dp-cd-lbl">Days</div></div>' +
          '<div class="dp-cd-sep">:</div>' +
          '<div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdHrs">--</div><div class="dp-cd-lbl">Hrs</div></div>' +
          '<div class="dp-cd-sep">:</div>' +
          '<div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdMin">--</div><div class="dp-cd-lbl">Min</div></div>' +
          '<div class="dp-cd-sep">:</div>' +
          '<div class="dp-cd-unit"><div class="dp-cd-num" id="dpCdSec">--</div><div class="dp-cd-lbl">Sec</div></div>' +
        '</div>' +
      '</div>' +

      // Main Grid
      '<div class="dp-grid">' +
        '<div class="dp-left">' +

          // Random Disney Movie
          '<div class="dp-card">' +
            '<div class="dp-card-hdr">' +
              '<div class="dp-card-title">\uD83C\uDFAC Random Disney Movie</div>' +
              '<button class="dp-open-btn" id="dpOpenBtn" aria-label="Open Disney+ app">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
                'Open Disney+' +
              '</button>' +
            '</div>' +
            '<div class="dp-movie-wrap" id="dpMovieWrap"></div>' +
          '</div>' +

          // Disney Trivia
          '<div class="dp-card">' +
            '<div class="dp-card-hdr">' +
              '<div class="dp-card-title">\uD83C\uDFAF Disney Trivia \u2014 Earn Family Points!</div>' +
              '<span style="font-size:.72rem;color:var(--dp-muted)">10 pts per correct answer</span>' +
            '</div>' +
            '<div class="dp-trivia-wrap" id="dpTriviaWrap">' +
              '<div class="dp-trivia-no-kid"><span>\uD83D\uDC46</span>Tap your name above to start trivia!</div>' +
            '</div>' +
          '</div>' +

        '</div>' +
        '<div class="dp-right">' +

          // Character of the Day
          '<div class="dp-card">' +
            '<div class="dp-card-hdr"><div class="dp-card-title">\u2B50 Character of the Day</div></div>' +
            '<div class="dp-char">' +
              '<div class="dp-char-emoji">' + char.emoji + '</div>' +
              '<div>' +
                '<div class="dp-char-name">' + char.name + '</div>' +
                '<div class="dp-char-movie">' + char.movie + '</div>' +
                '<div class="dp-char-fact">' + char.fact + '</div>' +
                '<div class="dp-char-tags">' +
                  char.tags.map(function(t) { return '<span class="dp-char-tag" style="background:' + t.c + '22;color:' + t.c + ';border:1px solid ' + t.c + '44">' + t.l + '</span>'; }).join("") +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="dp-char-date">Refreshes every day \u00B7 Today: ' + dateStr + '</div>' +
          '</div>' +

          // Trivia Leaderboard
          '<div class="dp-card">' +
            '<div class="dp-card-hdr"><div class="dp-card-title">\uD83C\uDFC6 Trivia Leaderboard</div></div>' +
            '<div class="dp-pts-list" id="dpPtsList">' +
              KIDS.map(function(k, i) {
                return '<div class="dp-pt-row">' +
                  '<div class="dp-pt-rank">' + ["\uD83E\uDD47","\uD83E\uDD48","\uD83E\uDD49"][i] + '</div>' +
                  '<div class="dp-pt-ava" style="background:' + k.color + '">' + k.name[0] + '</div>' +
                  '<div class="dp-pt-name">' + k.name + '</div>' +
                  '<div class="dp-pt-bar-wrap"><div class="dp-pt-bar" style="width:0%;background:' + k.color + '"></div></div>' +
                  '<div class="dp-pt-score">0 \u2B50</div>' +
                '</div>';
              }).join("") +
            '</div>' +
          '</div>' +

        '</div>' +
      '</div>' +
    '</div>';

    // Wire up global kid selector
    window._dpSelectKid = selectKid;

    // Wire up Open Disney+ button
    var openBtn = document.getElementById("dpOpenBtn");
    if (openBtn) openBtn.addEventListener("click", openDisneyPlus);

    // Boot countdown
    startCountdown(document.getElementById("dpCountdown"));

    // Render initial random movie
    renderMovie(currentMovieIdx);

    // Restore active kid if navigating back
    if (activeKid) selectKid(activeKid);
  }

  window.renderDisney = renderDisney;

})();
