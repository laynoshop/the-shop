// split/dashboard.js
// Family Dashboard — renders into #content via showTab("dashboard")
// All styles are scoped to #fhDash to avoid conflicts with existing app styles.

(function () {
  "use strict";

  // ─── STYLES ────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById("fhDashStyles")) return;
    const style = document.createElement("style");
    style.id = "fhDashStyles";
    style.textContent = `
/* ── FamilyHub Dashboard Scoped Styles ── */
#fhDash {
  --fh-bg: #f7f6f2;
  --fh-surface: #faf9f6;
  --fh-surface2: #ffffff;
  --fh-offset: #f0ede8;
  --fh-divider: #e3dfd9;
  --fh-border: #d4d1ca;
  --fh-text: #28251d;
  --fh-muted: #7a7974;
  --fh-faint: #bab9b4;
  --fh-primary: #01696f;
  --fh-primary-h: #0c4e54;
  --fh-primary-hl: #cedcd8;
  --fh-success: #437a22;
  --fh-success-hl: #d4dfcc;
  --fh-gold: #d19900;
  --fh-gold-hl: #f0e6c0;
  --fh-orange: #da7101;
  --fh-orange-hl: #f5e0c6;
  --fh-blue: #006494;
  --fh-blue-hl: #c6d8e4;
  --fh-purple: #7a39bb;
  --fh-purple-hl: #e0d4f0;
  --fh-red: #a12c7b;
  --fh-red-hl: #f0d8ea;
  --fh-r-sm: 0.375rem;
  --fh-r-md: 0.5rem;
  --fh-r-lg: 0.75rem;
  --fh-r-xl: 1rem;
  --fh-r-2xl: 1.5rem;
  --fh-r-full: 9999px;
  --fh-sh-sm: 0 1px 3px rgba(40,37,29,.07);
  --fh-sh-md: 0 4px 16px rgba(40,37,29,.09);
  --fh-sh-lg: 0 12px 40px rgba(40,37,29,.13);
  --fh-font: 'Satoshi', 'Inter', system-ui, sans-serif;
  --fh-serif: 'Instrument Serif', Georgia, serif;
  font-family: var(--fh-font);
  color: var(--fh-text);
  background: var(--fh-bg);
  padding: 1.25rem;
  max-width: 1280px;
  margin: 0 auto;
  box-sizing: border-box;
}
#fhDash *, #fhDash *::before, #fhDash *::after { box-sizing: border-box; }
#fhDash button { cursor: pointer; background: none; border: none; font: inherit; color: inherit; }
#fhDash ul { list-style: none; padding: 0; margin: 0; }

/* Weather Banner */
#fhDash .fh-weather {
  background: linear-gradient(135deg, var(--fh-primary) 0%, #0c4e54 100%);
  border-radius: var(--fh-r-2xl);
  padding: 1.25rem 1.5rem;
  color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.25rem;
  position: relative; overflow: hidden;
}
#fhDash .fh-weather::before {
  content:''; position:absolute; top:-30px; right:-30px;
  width:160px; height:160px; border-radius:50%;
  background:rgba(255,255,255,.06);
  pointer-events:none;
}
#fhDash .fh-wtemp { font-family: var(--fh-serif); font-size: 2.6rem; line-height:1; position:relative; }
#fhDash .fh-winfo { display:flex; align-items:center; gap:1.25rem; position:relative; }
#fhDash .fh-wcity { font-size:1rem; font-weight:600; opacity:.95; }
#fhDash .fh-wcond { font-size:.8rem; opacity:.72; margin-top:2px; }
#fhDash .fh-wgreet { text-align:right; position:relative; }
#fhDash .fh-wgreet-main { font-family:var(--fh-serif); font-size:1.3rem; line-height:1.2; }
#fhDash .fh-wgreet-sub { font-size:.78rem; opacity:.72; margin-top:.25rem; }

/* KPI Row */
#fhDash .fh-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-bottom:1.25rem; }
#fhDash .fh-kpi {
  background:var(--fh-surface); border:1px solid var(--fh-divider);
  border-radius:var(--fh-r-xl); padding:1rem 1.1rem;
  box-shadow:var(--fh-sh-sm); display:flex; flex-direction:column; gap:.5rem;
  transition: box-shadow .18s, transform .18s;
}
#fhDash .fh-kpi:hover { box-shadow:var(--fh-sh-md); transform:translateY(-1px); }
#fhDash .fh-kpi-hdr { display:flex; align-items:center; justify-content:space-between; }
#fhDash .fh-kpi-icon {
  width:30px; height:30px; border-radius:var(--fh-r-md);
  display:flex; align-items:center; justify-content:center; font-size:1rem;
}
#fhDash .fh-kpi-trend { font-size:.7rem; font-weight:600; padding:2px 7px; border-radius:var(--fh-r-full); }
#fhDash .fh-kpi-val { font-size:1.6rem; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; }
#fhDash .fh-kpi-lbl { font-size:.75rem; color:var(--fh-muted); font-weight:500; }

/* Grid */
#fhDash .fh-grid { display:grid; grid-template-columns:1fr 330px; gap:1.1rem; }
#fhDash .fh-left, #fhDash .fh-right { display:flex; flex-direction:column; gap:1.1rem; }

/* Cards */
#fhDash .fh-card {
  background:var(--fh-surface); border:1px solid var(--fh-divider);
  border-radius:var(--fh-r-xl); box-shadow:var(--fh-sh-sm); overflow:hidden;
}
#fhDash .fh-card-hdr {
  display:flex; align-items:center; justify-content:space-between;
  padding:.85rem 1.1rem; border-bottom:1px solid var(--fh-divider);
}
#fhDash .fh-card-title { font-weight:600; font-size:.875rem; color:var(--fh-text); display:flex; align-items:center; gap:.5rem; }
#fhDash .fh-card-title .icon { font-size:1rem; }
#fhDash .fh-card-action { font-size:.75rem; color:var(--fh-primary); font-weight:500; padding:.25rem .5rem; border-radius:var(--fh-r-sm); }
#fhDash .fh-card-action:hover { background:var(--fh-primary-hl); }
#fhDash .fh-card-body { padding:.85rem 1.1rem; }

/* Calendar */
#fhDash .fh-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:3px; margin-bottom:.75rem; }
#fhDash .fh-cal-dn { text-align:center; font-size:.65rem; font-weight:700; color:var(--fh-faint); padding:.2rem 0; text-transform:uppercase; letter-spacing:.05em; }
#fhDash .fh-cal-day {
  aspect-ratio:1; border-radius:var(--fh-r-md);
  display:flex; align-items:center; justify-content:center;
  font-size:.75rem; font-weight:500; color:var(--fh-muted);
  cursor:pointer; transition:background .15s, color .15s; position:relative;
}
#fhDash .fh-cal-day:hover { background:var(--fh-offset); color:var(--fh-text); }
#fhDash .fh-cal-day.today { background:var(--fh-primary); color:#fff; font-weight:700; }
#fhDash .fh-cal-day.evt::after {
  content:''; position:absolute; bottom:3px;
  width:4px; height:4px; border-radius:50%; background:var(--fh-orange);
}
#fhDash .fh-cal-day.today.evt::after { background:rgba(255,255,255,.7); }
#fhDash .fh-cal-day.other { color:var(--fh-faint); }
#fhDash .fh-events { display:flex; flex-direction:column; gap:.5rem; margin-top:.75rem; }
#fhDash .fh-event {
  display:flex; align-items:center; gap:.75rem;
  padding:.5rem .75rem; border-radius:var(--fh-r-md); background:var(--fh-offset);
}
#fhDash .fh-evt-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
#fhDash .fh-evt-name { font-size:.75rem; font-weight:600; color:var(--fh-text); }
#fhDash .fh-evt-meta { font-size:.68rem; color:var(--fh-muted); }
#fhDash .fh-evt-who { display:flex; gap:3px; margin-left:auto; }
#fhDash .fh-ava { width:18px; height:18px; border-radius:50%; font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; color:#fff; }

/* Chores */
#fhDash .fh-chore-list { display:flex; flex-direction:column; gap:.4rem; }
#fhDash .fh-chore {
  display:flex; align-items:center; gap:.75rem;
  padding:.6rem .85rem; border-radius:var(--fh-r-lg);
  border:1px solid var(--fh-divider); background:var(--fh-surface2);
  transition:background .15s;
}
#fhDash .fh-chore:hover { background:var(--fh-offset); }
#fhDash .fh-chk {
  width:20px; height:20px; border-radius:var(--fh-r-sm);
  border:2px solid var(--fh-border); flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all .15s; font-size:.65rem; color:#fff;
}
#fhDash .fh-chk.done { background:var(--fh-success); border-color:var(--fh-success); }
#fhDash .fh-chore-name { flex:1; font-size:.75rem; font-weight:600; }
#fhDash .fh-chore-name.done { text-decoration:line-through; color:var(--fh-muted); }
#fhDash .fh-chore-who { font-size:.68rem; color:var(--fh-muted); }
#fhDash .fh-chore-pts { font-size:.75rem; font-weight:700; color:var(--fh-gold); }

/* Meals */
#fhDash .fh-meal-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.75rem; }
#fhDash .fh-meal {
  border-radius:var(--fh-r-lg); border:1px solid var(--fh-divider);
  overflow:hidden; background:var(--fh-surface2);
  transition:box-shadow .15s, transform .15s; cursor:pointer;
}
#fhDash .fh-meal:hover { box-shadow:var(--fh-sh-md); transform:translateY(-1px); }
#fhDash .fh-meal-day { padding:.35rem .65rem; background:var(--fh-offset); font-size:.65rem; font-weight:700; color:var(--fh-muted); text-transform:uppercase; letter-spacing:.06em; }
#fhDash .fh-meal-body { padding:.6rem .7rem; }
#fhDash .fh-meal-name { font-size:.75rem; font-weight:600; line-height:1.3; }
#fhDash .fh-meal-type { font-size:.65rem; color:var(--fh-muted); margin-top:2px; }
#fhDash .fh-meal-tags { display:flex; gap:.25rem; margin-top:.4rem; flex-wrap:wrap; }
#fhDash .fh-tag { font-size:.6rem; font-weight:600; padding:1px 6px; border-radius:var(--fh-r-full); }

/* Shopping */
#fhDash .fh-shop-list { display:flex; flex-direction:column; gap:2px; }
#fhDash .fh-shop {
  display:flex; align-items:center; gap:.65rem;
  padding:.4rem .65rem; border-radius:var(--fh-r-md);
  transition:background .15s; cursor:pointer;
}
#fhDash .fh-shop:hover { background:var(--fh-offset); }
#fhDash .fh-shop-cat { width:8px; height:8px; border-radius:2px; flex-shrink:0; }
#fhDash .fh-shop-chk { width:16px; height:16px; border-radius:var(--fh-r-sm); border:2px solid var(--fh-border); flex-shrink:0; transition:all .15s; display:flex; align-items:center; justify-content:center; font-size:.55rem; color:#fff; }
#fhDash .fh-shop-chk.checked { background:var(--fh-primary); border-color:var(--fh-primary); }
#fhDash .fh-shop-name { flex:1; font-size:.75rem; }
#fhDash .fh-shop-name.checked { text-decoration:line-through; color:var(--fh-muted); }
#fhDash .fh-shop-qty { font-size:.68rem; color:var(--fh-muted); font-weight:500; }

/* Budget */
#fhDash .fh-budget-list { display:flex; flex-direction:column; gap:.75rem; }
#fhDash .fh-budget-hdr { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:.25rem; }
#fhDash .fh-budget-cat { font-size:.75rem; font-weight:600; }
#fhDash .fh-budget-amt { font-size:.75rem; color:var(--fh-muted); font-variant-numeric:tabular-nums; }
#fhDash .fh-budget-amt strong { color:var(--fh-text); }
#fhDash .fh-bar { height:6px; background:var(--fh-offset); border-radius:var(--fh-r-full); overflow:hidden; }
#fhDash .fh-bar-fill { height:100%; border-radius:var(--fh-r-full); transition:width .6s cubic-bezier(.16,1,.3,1); }

/* AI Panel */
#fhDash .fh-ai {
  padding:1rem; background:linear-gradient(135deg,var(--fh-primary-hl),var(--fh-offset));
  border-radius:var(--fh-r-xl); border:1px solid rgba(1,105,111,.18);
}
#fhDash .fh-ai-hdr { display:flex; align-items:center; gap:.5rem; margin-bottom:.75rem; }
#fhDash .fh-ai-orb { width:26px; height:26px; background:var(--fh-primary); border-radius:var(--fh-r-full); display:flex; align-items:center; justify-content:center; color:#fff; font-size:.85rem; }
#fhDash .fh-ai-title { font-size:.75rem; font-weight:700; color:var(--fh-primary); }
#fhDash .fh-ai-chips { display:flex; flex-direction:column; gap:.4rem; }
#fhDash .fh-ai-chip {
  background:var(--fh-surface); border:1px solid rgba(1,105,111,.15);
  border-radius:var(--fh-r-md); padding:.4rem .65rem;
  font-size:.75rem; color:var(--fh-text); cursor:pointer; text-align:left;
  transition:all .15s;
}
#fhDash .fh-ai-chip:hover { background:var(--fh-primary-hl); border-color:var(--fh-primary); color:var(--fh-primary); }
#fhDash .fh-ai-row { display:flex; gap:.5rem; margin-top:.75rem; }
#fhDash .fh-ai-input {
  flex:1; background:var(--fh-surface); border:1px solid var(--fh-border);
  border-radius:var(--fh-r-full); padding:.4rem .85rem;
  font-size:.75rem; font-family:var(--fh-font); color:var(--fh-text); outline:none;
  transition:border-color .15s, box-shadow .15s;
}
#fhDash .fh-ai-input:focus { border-color:var(--fh-primary); box-shadow:0 0 0 3px rgba(1,105,111,.12); }
#fhDash .fh-ai-send { width:30px; height:30px; background:var(--fh-primary); border-radius:var(--fh-r-full); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; font-size:.9rem; }
#fhDash .fh-ai-send:hover { background:var(--fh-primary-h); }

/* Points */
#fhDash .fh-pts-row { display:grid; grid-template-columns:1fr 1fr; gap:.75rem; }
#fhDash .fh-pt-card { background:var(--fh-surface2); border:1px solid var(--fh-divider); border-radius:var(--fh-r-lg); padding:.65rem .85rem; display:flex; align-items:center; gap:.65rem; }
#fhDash .fh-pt-ava { width:34px; height:34px; border-radius:var(--fh-r-full); font-weight:700; font-size:13px; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
#fhDash .fh-pt-name { font-size:.75rem; font-weight:700; }
#fhDash .fh-pt-score { font-size:1rem; font-weight:700; color:var(--fh-gold); line-height:1.2; font-variant-numeric:tabular-nums; }
#fhDash .fh-pt-lbl { font-size:.65rem; color:var(--fh-muted); }

/* Notifications */
#fhDash .fh-notif-list { display:flex; flex-direction:column; }
#fhDash .fh-notif { display:flex; align-items:flex-start; gap:.65rem; padding:.6rem .2rem; border-bottom:1px solid var(--fh-divider); }
#fhDash .fh-notif:last-child { border-bottom:none; }
#fhDash .fh-notif-icon { width:28px; height:28px; border-radius:var(--fh-r-md); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:.9rem; }
#fhDash .fh-notif-text { font-size:.75rem; line-height:1.4; }
#fhDash .fh-notif-text.unread { font-weight:600; }
#fhDash .fh-notif-time { font-size:.65rem; color:var(--fh-muted); margin-top:2px; }

/* Responsive */
@media (max-width: 1060px) {
  #fhDash .fh-grid { grid-template-columns:1fr; }
  #fhDash .fh-kpis { grid-template-columns:repeat(2,1fr); }
}
@media (max-width: 640px) {
  #fhDash .fh-weather { flex-direction:column; gap:.75rem; text-align:center; }
  #fhDash .fh-wgreet { text-align:center; }
  #fhDash .fh-meal-grid { grid-template-columns:1fr 1fr; }
  #fhDash .fh-kpis { grid-template-columns:repeat(2,1fr); gap:.65rem; }
}
    `;
    document.head.appendChild(style);
  }

  // ─── CALENDAR ───────────────────────────────────────────────
  function buildCalendar(el) {
    const days = ["Su","Mo","Tu","We","Th","Fr","Sa"];
    const evtDays = [13,15,17,20,22,24];
    let html = days.map(d => `<div class="fh-cal-dn">${d}</div>`).join("");
    // June 2026 starts Monday = offset 1
    for (let i = 0; i < 1; i++) html += `<div class="fh-cal-day other">${30 + i}</div>`;
    for (let d = 1; d <= 30; d++) {
      const cls = ["fh-cal-day", d===13?"today":"", evtDays.includes(d)?"evt":""].filter(Boolean).join(" ");
      html += `<div class="${cls}">${d}</div>`;
    }
    let after = 1;
    while ((1 + 30 + after) % 7 !== 0) {
      html += `<div class="fh-cal-day other">${after++}</div>`;
    }
    el.innerHTML = html;
  }

  // ─── CHORES ─────────────────────────────────────────────────
  function buildChores(el) {
    const chores = [
      { name:"Vacuum living room",   who:"Emma",  pts:15, done:true },
      { name:"Unload dishwasher",    who:"Liam",  pts:10, done:true },
      { name:"Take out trash",       who:"Liam",  pts:10, done:true },
      { name:"Clean bathroom sink",  who:"Emma",  pts:20, done:false },
      { name:"Water the plants",     who:"Emma",  pts:5,  done:false },
      { name:"Feed the dog",         who:"Liam",  pts:10, done:false },
      { name:"Fold laundry",         who:"Emma",  pts:15, done:false },
      { name:"Mow the lawn",         who:"Victor",pts:0,  done:false },
    ];
    el.innerHTML = chores.map((c,i) => `
      <div class="fh-chore">
        <div class="fh-chk${c.done?" done":""}" data-chore="${i}">${c.done?"✓":""}</div>
        <div style="flex:1">
          <div class="fh-chore-name${c.done?" done":""}" id="fhcn${i}">${c.name}</div>
          <div class="fh-chore-who">${c.who}${c.pts?" · "+c.pts+" pts":""}</div>
        </div>
        ${c.pts?`<span class="fh-chore-pts">${c.done?"✓":"+"+c.pts}</span>`:""}
      </div>
    `).join("");
    el.querySelectorAll(".fh-chk").forEach(chk => {
      chk.addEventListener("click", () => {
        const done = !chk.classList.contains("done");
        chk.classList.toggle("done", done);
        chk.textContent = done ? "✓" : "";
        const nm = el.querySelector(`#fhcn${chk.dataset.chore}`);
        if (nm) nm.classList.toggle("done", done);
      });
    });
  }

  // ─── SHOPPING ───────────────────────────────────────────────
  function buildShopping(el) {
    const items = [
      { name:"Chicken breast",    qty:"2 lbs",  cat:"#01696f", checked:false },
      { name:"Ground beef",       qty:"1.5 lbs",cat:"#01696f", checked:false },
      { name:"Taco shells",       qty:"1 box",  cat:"#d19900", checked:false },
      { name:"Spaghetti & sauce", qty:"x2",     cat:"#d19900", checked:true  },
      { name:"Salmon fillets",    qty:"4 pcs",  cat:"#006494", checked:false },
      { name:"Broccoli & carrots",qty:"bag",    cat:"#437a22", checked:false },
      { name:"Pizza dough",       qty:"2 bags", cat:"#d19900", checked:true  },
      { name:"Mozzarella",        qty:"2 bags", cat:"#01696f", checked:false },
      { name:"Orange juice",      qty:"1 gal",  cat:"#da7101", checked:true  },
    ];
    el.innerHTML = items.map((it,i) => `
      <div class="fh-shop" data-shop="${i}">
        <div class="fh-shop-cat" style="background:${it.cat}"></div>
        <div class="fh-shop-chk${it.checked?" checked":""}" data-si="${i}">${it.checked?"✓":""}</div>
        <span class="fh-shop-name${it.checked?" checked":""}" id="fhsn${i}">${it.name}</span>
        <span class="fh-shop-qty">${it.qty}</span>
      </div>
    `).join("");
    el.querySelectorAll(".fh-shop").forEach(row => {
      row.addEventListener("click", () => {
        const i = row.dataset.shop;
        const chk = row.querySelector(".fh-shop-chk");
        const nm = row.querySelector(".fh-shop-name");
        const done = !chk.classList.contains("checked");
        chk.classList.toggle("checked", done);
        chk.textContent = done ? "✓" : "";
        if (nm) nm.classList.toggle("checked", done);
      });
    });
  }

  // ─── MAIN RENDER ────────────────────────────────────────────
  function renderDashboard() {
    injectStyles();

    const content = document.getElementById("content");
    if (!content) return;

    content.innerHTML = `
<div id="fhDash">

  <!-- Weather Banner -->
  <div class="fh-weather">
    <div class="fh-winfo">
      <div class="fh-wtemp">78°</div>
      <div>
        <div class="fh-wcity">Marysville, Ohio</div>
        <div class="fh-wcond">Partly cloudy · Low 62° tonight</div>
      </div>
    </div>
    <div class="fh-wgreet">
      <div class="fh-wgreet-main">Great day for golf ⛳</div>
      <div class="fh-wgreet-sub">Emma · Soccer 3pm &nbsp;|&nbsp; Liam · Baseball 5pm</div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="fh-kpis">
    <div class="fh-kpi">
      <div class="fh-kpi-hdr">
        <div class="fh-kpi-icon" style="background:var(--fh-primary-hl)">📅</div>
        <span class="fh-kpi-trend" style="background:var(--fh-offset);color:var(--fh-muted)">This week</span>
      </div>
      <div class="fh-kpi-val">4</div>
      <div class="fh-kpi-lbl">Upcoming events</div>
    </div>
    <div class="fh-kpi">
      <div class="fh-kpi-hdr">
        <div class="fh-kpi-icon" style="background:var(--fh-success-hl)">✅</div>
        <span class="fh-kpi-trend" style="background:var(--fh-success-hl);color:var(--fh-success)">↑ 2 done</span>
      </div>
      <div class="fh-kpi-val">7/12</div>
      <div class="fh-kpi-lbl">Chores complete</div>
    </div>
    <div class="fh-kpi">
      <div class="fh-kpi-hdr">
        <div class="fh-kpi-icon" style="background:var(--fh-orange-hl)">💰</div>
        <span class="fh-kpi-trend" style="background:var(--fh-offset);color:var(--fh-muted)">of $3,200</span>
      </div>
      <div class="fh-kpi-val">$1,840</div>
      <div class="fh-kpi-lbl">Monthly spend</div>
    </div>
    <div class="fh-kpi">
      <div class="fh-kpi-hdr">
        <div class="fh-kpi-icon" style="background:var(--fh-gold-hl)">⭐</div>
        <span class="fh-kpi-trend" style="background:var(--fh-gold-hl);color:var(--fh-gold)">↑ 45 this wk</span>
      </div>
      <div class="fh-kpi-val">310</div>
      <div class="fh-kpi-lbl">Family points</div>
    </div>
  </div>

  <!-- Main Grid -->
  <div class="fh-grid">
    <div class="fh-left">

      <!-- Calendar -->
      <div class="fh-card">
        <div class="fh-card-hdr">
          <div class="fh-card-title"><span class="icon">📅</span> June 2026</div>
          <button class="fh-card-action">View all</button>
        </div>
        <div class="fh-card-body">
          <div class="fh-cal-grid" id="fhCalGrid"></div>
          <div class="fh-events">
            <div class="fh-event">
              <div class="fh-evt-dot" style="background:var(--fh-primary)"></div>
              <div style="flex:1"><div class="fh-evt-name">Emma — Soccer Practice</div><div class="fh-evt-meta">Today · 3:00 PM · Fields Park</div></div>
              <div class="fh-evt-who"><div class="fh-ava" style="background:#d19900">E</div></div>
            </div>
            <div class="fh-event">
              <div class="fh-evt-dot" style="background:var(--fh-blue)"></div>
              <div style="flex:1"><div class="fh-evt-name">Liam — Baseball Game</div><div class="fh-evt-meta">Today · 5:00 PM · Riverside Field</div></div>
              <div class="fh-evt-who"><div class="fh-ava" style="background:#006494">L</div></div>
            </div>
            <div class="fh-event">
              <div class="fh-evt-dot" style="background:var(--fh-gold)"></div>
              <div style="flex:1"><div class="fh-evt-name">Family Golf Scramble</div><div class="fh-evt-meta">Sun Jun 15 · 9:00 AM · Marysville Golf</div></div>
              <div class="fh-evt-who">
                <div class="fh-ava" style="background:#01696f">V</div>
                <div class="fh-ava" style="background:#a12c7b">M</div>
                <div class="fh-ava" style="background:#d19900">E</div>
                <div class="fh-ava" style="background:#006494">L</div>
              </div>
            </div>
            <div class="fh-event">
              <div class="fh-evt-dot" style="background:var(--fh-red)"></div>
              <div style="flex:1"><div class="fh-evt-name">Doctor Appt — Liam</div><div class="fh-evt-meta">Tue Jun 17 · 10:30 AM · Pediatrics</div></div>
              <div class="fh-evt-who"><div class="fh-ava" style="background:#006494">L</div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Chores -->
      <div class="fh-card">
        <div class="fh-card-hdr">
          <div class="fh-card-title"><span class="icon">✅</span> Chore Tracker</div>
          <button class="fh-card-action">Assign new</button>
        </div>
        <div class="fh-card-body">
          <div class="fh-chore-list" id="fhChores"></div>
        </div>
      </div>

      <!-- Meals -->
      <div class="fh-card">
        <div class="fh-card-hdr">
          <div class="fh-card-title"><span class="icon">🍽️</span> This Week's Meals</div>
          <button class="fh-card-action">AI plan week</button>
        </div>
        <div class="fh-card-body">
          <div class="fh-meal-grid">
            <div class="fh-meal"><div class="fh-meal-day">Today</div><div class="fh-meal-body"><div class="fh-meal-name">Grilled Chicken Tacos</div><div class="fh-meal-type">Dinner · ~30 min</div><div class="fh-meal-tags"><span class="fh-tag" style="background:var(--fh-success-hl);color:var(--fh-success)">Healthy</span><span class="fh-tag" style="background:var(--fh-gold-hl);color:var(--fh-gold)">Kids ✓</span></div></div></div>
            <div class="fh-meal"><div class="fh-meal-day">Sun</div><div class="fh-meal-body"><div class="fh-meal-name">BBQ Burgers on the Grill</div><div class="fh-meal-type">Dinner · ~45 min</div><div class="fh-meal-tags"><span class="fh-tag" style="background:var(--fh-orange-hl);color:var(--fh-orange)">Family Fav</span></div></div></div>
            <div class="fh-meal"><div class="fh-meal-day">Mon</div><div class="fh-meal-body"><div class="fh-meal-name">Spaghetti Bolognese</div><div class="fh-meal-type">Dinner · ~40 min</div><div class="fh-meal-tags"><span class="fh-tag" style="background:var(--fh-gold-hl);color:var(--fh-gold)">Kids ✓</span></div></div></div>
            <div class="fh-meal"><div class="fh-meal-day">Tue</div><div class="fh-meal-body"><div class="fh-meal-name">Sheet Pan Salmon</div><div class="fh-meal-type">Dinner · ~25 min</div><div class="fh-meal-tags"><span class="fh-tag" style="background:var(--fh-success-hl);color:var(--fh-success)">Healthy</span></div></div></div>
            <div class="fh-meal"><div class="fh-meal-day">Wed</div><div class="fh-meal-body"><div class="fh-meal-name">Homemade Pizza Night</div><div class="fh-meal-type">Dinner · ~60 min</div><div class="fh-meal-tags"><span class="fh-tag" style="background:var(--fh-purple-hl);color:var(--fh-purple)">Fun ⭐</span><span class="fh-tag" style="background:var(--fh-gold-hl);color:var(--fh-gold)">Kids ✓</span></div></div></div>
            <div class="fh-meal"><div class="fh-meal-day">Thu</div><div class="fh-meal-body"><div class="fh-meal-name">Chicken Stir-Fry & Rice</div><div class="fh-meal-type">Dinner · ~30 min</div><div class="fh-meal-tags"><span class="fh-tag" style="background:var(--fh-success-hl);color:var(--fh-success)">Healthy</span></div></div></div>
          </div>
        </div>
      </div>

    </div>
    <div class="fh-right">

      <!-- AI Assistant -->
      <div class="fh-ai">
        <div class="fh-ai-hdr">
          <div class="fh-ai-orb">✨</div>
          <div class="fh-ai-title">AI Family Assistant</div>
        </div>
        <div class="fh-ai-chips">
          <button class="fh-ai-chip">📅 What's happening this weekend?</button>
          <button class="fh-ai-chip">🛒 Restock grocery list for meals</button>
          <button class="fh-ai-chip">⭐ Who needs chore reminders today?</button>
          <button class="fh-ai-chip">🍕 Plan Friday pizza night</button>
        </div>
        <div class="fh-ai-row">
          <input class="fh-ai-input" placeholder="Ask anything about your family…" type="text">
          <button class="fh-ai-send">➤</button>
        </div>
      </div>

      <!-- Shopping -->
      <div class="fh-card">
        <div class="fh-card-hdr">
          <div class="fh-card-title"><span class="icon">🛒</span> Shopping List</div>
          <button class="fh-card-action">+ Add item</button>
        </div>
        <div class="fh-card-body">
          <div class="fh-shop-list" id="fhShop"></div>
        </div>
      </div>

      <!-- Budget -->
      <div class="fh-card">
        <div class="fh-card-hdr">
          <div class="fh-card-title"><span class="icon">💰</span> June Budget</div>
          <button class="fh-card-action">Details</button>
        </div>
        <div class="fh-card-body">
          <div class="fh-budget-list">
            <div><div class="fh-budget-hdr"><span class="fh-budget-cat">Groceries</span><span class="fh-budget-amt"><strong>$420</strong> / $600</span></div><div class="fh-bar"><div class="fh-bar-fill" style="width:70%;background:var(--fh-primary)"></div></div></div>
            <div><div class="fh-budget-hdr"><span class="fh-budget-cat">Kids Activities</span><span class="fh-budget-amt"><strong>$310</strong> / $400</span></div><div class="fh-bar"><div class="fh-bar-fill" style="width:77%;background:var(--fh-gold)"></div></div></div>
            <div><div class="fh-budget-hdr"><span class="fh-budget-cat">Dining Out</span><span class="fh-budget-amt"><strong>$190</strong> / $250</span></div><div class="fh-bar"><div class="fh-bar-fill" style="width:76%;background:var(--fh-orange)"></div></div></div>
            <div><div class="fh-budget-hdr"><span class="fh-budget-cat">Entertainment</span><span class="fh-budget-amt"><strong>$95</strong> / $150</span></div><div class="fh-bar"><div class="fh-bar-fill" style="width:63%;background:var(--fh-blue)"></div></div></div>
            <div><div class="fh-budget-hdr"><span class="fh-budget-cat">Golf &amp; Sports 🚨</span><span class="fh-budget-amt"><strong>$220</strong> / $200</span></div><div class="fh-bar"><div class="fh-bar-fill" style="width:100%;background:var(--fh-red)"></div></div></div>
          </div>
        </div>
      </div>

      <!-- Kid Points -->
      <div class="fh-card">
        <div class="fh-card-hdr">
          <div class="fh-card-title"><span class="icon">🏆</span> Kid Points</div>
          <button class="fh-card-action">Rewards</button>
        </div>
        <div class="fh-card-body">
          <div class="fh-pts-row">
            <div class="fh-pt-card">
              <div class="fh-pt-ava" style="background:#d19900">E</div>
              <div><div class="fh-pt-name">Emma</div><div class="fh-pt-score">185 ⭐</div><div class="fh-pt-lbl">+20 this week</div></div>
            </div>
            <div class="fh-pt-card">
              <div class="fh-pt-ava" style="background:#006494">L</div>
              <div><div class="fh-pt-name">Liam</div><div class="fh-pt-score">125 ⭐</div><div class="fh-pt-lbl">+25 this week</div></div>
            </div>
          </div>
          <div style="margin-top:.75rem;padding:.65rem;background:var(--fh-gold-hl);border-radius:var(--fh-r-md);display:flex;align-items:center;gap:.65rem;">
            <span style="font-size:1.2rem">🎯</span>
            <div>
              <div style="font-size:.75rem;font-weight:700;color:var(--fh-gold)">Emma is 15 pts from Movie Night reward!</div>
              <div style="font-size:.68rem;color:var(--fh-muted)">Complete 2 more chores to unlock</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div class="fh-card">
        <div class="fh-card-hdr">
          <div class="fh-card-title"><span class="icon">🔔</span> Alerts</div>
          <button class="fh-card-action">Mark all read</button>
        </div>
        <div class="fh-card-body" style="padding:.25rem 1.1rem">
          <div class="fh-notif-list">
            <div class="fh-notif">
              <div class="fh-notif-icon" style="background:var(--fh-gold-hl)">⭐</div>
              <div><div class="fh-notif-text unread">Liam completed "Take out trash" — earned 10 pts</div><div class="fh-notif-time">23 min ago</div></div>
            </div>
            <div class="fh-notif">
              <div class="fh-notif-icon" style="background:var(--fh-red-hl)">🚨</div>
              <div><div class="fh-notif-text unread">Golf & Sports budget exceeded by $20</div><div class="fh-notif-time">2 hours ago</div></div>
            </div>
            <div class="fh-notif">
              <div class="fh-notif-icon" style="background:var(--fh-blue-hl)">📅</div>
              <div><div class="fh-notif-text">Liam's doctor appt confirmed for Tue Jun 17</div><div class="fh-notif-time">Yesterday</div></div>
            </div>
            <div class="fh-notif">
              <div class="fh-notif-icon" style="background:var(--fh-primary-hl)">✨</div>
              <div><div class="fh-notif-text">AI suggested 3 dinners based on items expiring soon</div><div class="fh-notif-time">Yesterday</div></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</div>
    `;

    buildCalendar(document.getElementById("fhCalGrid"));
    buildChores(document.getElementById("fhChores"));
    buildShopping(document.getElementById("fhShop"));

    setTimeout(() => {
      document.querySelectorAll("#fhDash .fh-bar-fill").forEach(b => {
        const w = b.style.width;
        b.style.width = "0";
        requestAnimationFrame(() => { b.style.width = w; });
      });
    }, 50);
  }

  window.renderDashboard = renderDashboard;

})();
