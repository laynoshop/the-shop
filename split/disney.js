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

/* ── Streaming grid ── */
#disneyPage .dp-stream-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem;
  padding: .85rem 1.1rem;
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

/* ── News list ── */
#disneyPage .dp-news-list { display: flex; flex-direction: column; padding: 0 .5rem; }
#disneyPage .dp-news-item {
  display: flex; gap: .75rem; align-items: flex-start;
  padding: .65rem .6rem; border-bottom: 1px solid var(--dp-divider);
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
#disneyPage .dp-favs { display: flex; flex-direction: column; gap: .75rem; padding: .85rem 1.1rem; }
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

  // 14 characters — cycles daily using days-since-epoch so it's the same for everyone on the same day
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

  // ─── STATE ──────────────────────────────────────────────────
  let _cdTimer = null;
  let activeKid = null;
  let triviaScores = { Ellis: 0, Corinne: 0, Finley: 0 };
  let triviaState = { idx: 0, answered: false };

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
    // Attempt to open native Disney+ app via deep link
    var start = Date.now();
    var appLink = document.createElement("a");
    appLink.href = "disneyplus://home";
    appLink.style.display = "none";
    document.body.appendChild(appLink);
    appLink.click();
    document.body.removeChild(appLink);
    // Fallback to web after delay — if the app opened, the page will have blurred and this won't matter
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

          // Now Streaming
          '<div class="dp-card">' +
            '<div class="dp-card-hdr">' +
              '<div class="dp-card-title">\uD83C\uDFAC Now on Disney+</div>' +
              '<button class="dp-open-btn" id="dpOpenBtn" aria-label="Open Disney+ app">' +
                '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
                'Open Disney+' +
              '</button>' +
            '</div>' +
            '<div class="dp-stream-grid">' +
              STREAMING.map(function(s) {
                return '<div class="dp-stream-item">' +
                  '<div class="dp-stream-thumb" style="background:' + s.bg + '">' + s.emoji + '</div>' +
                  '<div class="dp-stream-info">' +
                    '<div class="dp-stream-title">' + s.title + '</div>' +
                    '<div class="dp-stream-brand">' + s.brand + '</div>' +
                  '</div>' +
                  (s.badge ? '<div class="dp-stream-badge" style="background:' + s.badgeColor + ';color:#000">' + s.badge + '</div>' : '') +
                '</div>';
              }).join("") +
            '</div>' +
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

          // Disney News
          '<div class="dp-card">' +
            '<div class="dp-card-hdr"><div class="dp-card-title">\uD83D\uDCF0 Disney News</div></div>' +
            '<div class="dp-news-list">' +
              NEWS.map(function(n) {
                return '<div class="dp-news-item">' +
                  '<div class="dp-news-thumb">' + n.emoji + '</div>' +
                  '<div><div class="dp-news-title">' + n.title + '</div><div class="dp-news-meta">' + n.meta + '</div></div>' +
                '</div>';
              }).join("") +
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

          // Family Favorites
          '<div class="dp-card">' +
            '<div class="dp-card-hdr"><div class="dp-card-title">\uD83D\uDC9C Family Favorites</div></div>' +
            '<div class="dp-favs">' +
              KIDS.map(function(k) {
                return '<div class="dp-fav-kid">' +
                  '<div class="dp-fav-kid-name" style="color:' + k.color + '">' + k.name + '\u2019s picks</div>' +
                  '<div class="dp-fav-row">' +
                    k.favs.map(function(f) { return '<span class="dp-fav-chip" style="background:' + k.color + '18;color:' + k.color + ';border-color:' + k.color + '33">' + f + '</span>'; }).join("") +
                  '</div>' +
                '</div>';
              }).join("") +
            '</div>' +
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

    // Wire up kid selector globally
    window._dpSelectKid = selectKid;

    // Wire up Open Disney+ button
    var openBtn = document.getElementById("dpOpenBtn");
    if (openBtn) openBtn.addEventListener("click", openDisneyPlus);

    // Boot countdown
    startCountdown(document.getElementById("dpCountdown"));

    // Restore active kid if navigating back to this tab
    if (activeKid) selectKid(activeKid);
  }

  window.renderDisney = renderDisney;

})();
