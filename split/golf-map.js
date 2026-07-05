/* =========================
   THE PUTT SHOP — Course Map
   SVG rendering of the actual backyard putting green
   Shape: narrow top (~3ft wide, ~8ft tall) angling into wide bottom (~8ft wide, ~14ft tall)
   9 holes with Tee (T) and Hole (H) markers
   ========================= */

(function GolfMapModule() {
  "use strict";

  // ─── The 9-hole layout ────────────────────────────────────────────────────
  // SVG viewBox: 0 0 200 440
  //   Top section:    x=70..130  (60px wide = ~3ft)   y=10..150  (~8ft)
  //   Transition:     diagonal from top-right (130,150) to bottom-right (200,210)
  //                   and top-left (70,150) to bottom-left (0,210) [left side straight]
  //   Bottom section: x=0..200   (200px wide = ~8ft)  y=210..430 (~14ft)
  //
  // Each hole: { id, label, tee:[x,y], hole:[x,y], par, desc }
  const HOLES = [
    {
      id: 1,
      tee:  [80, 25],
      hole: [118, 70],
      par: 2,
      desc: "Straight shot across the narrow strip"
    },
    {
      id: 2,
      tee:  [120, 25],
      hole: [78, 115],
      par: 2,
      desc: "Back across — aim for the left rail"
    },
    {
      id: 3,
      tee:  [80, 120],
      hole: [118, 148],
      par: 2,
      desc: "Short putt at the top of the angle"
    },
    {
      id: 4,
      tee:  [115, 165],
      hole: [55, 195],
      par: 3,
      desc: "Navigate the diagonal — tricky angle"
    },
    {
      id: 5,
      tee:  [30, 225],
      hole: [155, 280],
      par: 3,
      desc: "Long diagonal across the wide section"
    },
    {
      id: 6,
      tee:  [170, 225],
      hole: [30, 310],
      par: 3,
      desc: "Cross-green power shot"
    },
    {
      id: 7,
      tee:  [100, 295],
      hole: [165, 365],
      par: 2,
      desc: "Mid-green to lower-right"
    },
    {
      id: 8,
      tee:  [155, 345],
      hole: [38, 390],
      par: 3,
      desc: "Long run across the bottom"
    },
    {
      id: 9,
      tee:  [60, 415],
      hole: [140, 415],
      par: 2,
      desc: "Victory lap — bottom straight-away"
    },
  ];

  // Color palette (matches The Shop dark theme)
  const C = {
    green:     "#2d6a2d",
    greenDark: "#1e4a1e",
    stroke:    "rgba(255,255,255,0.18)",
    tee:       "#f59e0b",   // gold
    hole:      "#bb0000",   // scarlet
    teeText:   "#000",
    holeText:  "#fff",
    fringe:    "rgba(255,255,255,0.07)",
    label:     "rgba(255,255,255,0.55)",
    line:      "rgba(255,255,255,0.15)",
  };

  // ─── Build the green polygon (the actual shape) ───────────────────────────
  // Points: top-narrow section + angled transition + wide bottom
  // Going clockwise:
  //   top-left of narrow:    (70, 10)
  //   top-right of narrow:   (130, 10)
  //   bottom-right of narrow (start of angle): (130, 150)
  //   bottom-right (end of angle, wide):       (198, 210)
  //   bottom-right corner:                     (198, 430)
  //   bottom-left corner:                      (2, 430)
  //   bottom-left (start of wide):             (2, 210)
  //   bottom-left of narrow (end of angle):    (70, 150)
  //   back to top-left:                        (70, 10)
  const GREEN_POLY = "70,10 130,10 130,150 198,210 198,430 2,430 2,210 70,150";

  // ─── SVG builder ─────────────────────────────────────────────────────────
  function buildSVG(activeHole) {
    const markerRadius = 11;
    const fontSize     = 9;

    // Dashed guide lines between T and H for each hole
    const lines = HOLES.map(h => {
      const isActive = activeHole === h.id;
      const opacity  = isActive ? 0.7 : 0.22;
      const color    = isActive ? "#f59e0b" : "rgba(255,255,255,0.4)";
      return `<line x1="${h.tee[0]}" y1="${h.tee[1]}" x2="${h.hole[0]}" y2="${h.hole[1]}"
        stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3" opacity="${opacity}" />`;
    }).join("");

    // Hole number label in center of each line
    const lineLabels = HOLES.map(h => {
      const mx = (h.tee[0] + h.hole[0]) / 2;
      const my = (h.tee[1] + h.hole[1]) / 2;
      const isActive = activeHole === h.id;
      return `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle"
        font-size="8" font-weight="900" fill="rgba(255,255,255,${isActive ? '0.9' : '0.35'})"
        font-family="-apple-system,system-ui">${h.id}</text>`;
    }).join("");

    // Tee markers (gold circles with T)
    const teeMarkers = HOLES.map(h => {
      const isActive = activeHole === h.id;
      const r        = isActive ? markerRadius + 2 : markerRadius;
      const glow     = isActive ? `filter="url(#teeGlow)"` : "";
      return `
        <circle cx="${h.tee[0]}" cy="${h.tee[1]}" r="${r}"
          fill="${C.tee}" stroke="rgba(0,0,0,0.55)" stroke-width="1.5" ${glow} />
        <text x="${h.tee[0]}" y="${h.tee[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${fontSize}" font-weight="1000" fill="${C.teeText}"
          font-family="-apple-system,system-ui">T${h.id}</text>
      `;
    }).join("");

    // Hole markers (scarlet circles with H)
    const holeMarkers = HOLES.map(h => {
      const isActive = activeHole === h.id;
      const r        = isActive ? markerRadius + 2 : markerRadius;
      const glow     = isActive ? `filter="url(#holeGlow)"` : "";
      return `
        <circle cx="${h.hole[0]}" cy="${h.hole[1]}" r="${r}"
          fill="${C.hole}" stroke="rgba(0,0,0,0.55)" stroke-width="1.5" ${glow} />
        <text x="${h.hole[0]}" y="${h.hole[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${fontSize}" font-weight="1000" fill="${C.holeText}"
          font-family="-apple-system,system-ui">H${h.id}</text>
      `;
    }).join("");

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 440"
        style="width:100%;max-width:260px;display:block;margin:0 auto;border-radius:16px;
               background:#121212;box-shadow:0 12px 32px rgba(0,0,0,0.55);overflow:visible;">

        <defs>
          <filter id="teeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
          <filter id="holeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        <!-- Green surface -->
        <polygon points="${GREEN_POLY}"
          fill="${C.green}" stroke="rgba(255,255,255,0.25)" stroke-width="2" />

        <!-- Fringe / inner texture hint -->
        <polygon points="73,13 127,13 127,148 195,207 195,427 5,427 5,207 73,148"
          fill="none" stroke="${C.fringe}" stroke-width="1.5" />

        <!-- Directional lines -->
        ${lines}
        ${lineLabels}

        <!-- Tee markers (render last so they sit on top) -->
        ${teeMarkers}

        <!-- Hole markers -->
        ${holeMarkers}

        <!-- Dimension hints -->
        <text x="100" y="5" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.30)"
          font-family="-apple-system,system-ui" font-weight="700">← 3ft →</text>
        <text x="195" y="320" text-anchor="start" font-size="6" fill="rgba(255,255,255,0.25)"
          font-family="-apple-system,system-ui" font-weight="700" writing-mode="tb">← 14ft →</text>
      </svg>
    `;
  }

  // ─── Render the full map view ─────────────────────────────────────────────
  function renderGolfMap() {
    let activeHole = null;

    function getContent() { return document.getElementById("content"); }

    function draw() {
      const activeData = activeHole ? HOLES.find(h => h.id === activeHole) : null;

      const holeDetailHTML = activeData ? `
        <div class="gmap-detail">
          <div class="gmap-detail-top">
            <span class="gmap-detail-num">Hole ${activeData.id}</span>
            <span class="gmap-detail-par">Par ${activeData.par}</span>
          </div>
          <div class="gmap-detail-desc">${activeData.desc}</div>
          <div class="gmap-detail-markers">
            <span class="gmap-tee-chip">T${activeData.id} = Tee</span>
            <span class="gmap-hole-chip">H${activeData.id} = Hole</span>
          </div>
        </div>
      ` : `
        <div class="gmap-hint">Tap a hole number below to highlight it on the map</div>
      `;

      const holeButtons = HOLES.map(h => {
        const isActive = activeHole === h.id;
        return `<button class="gmap-hole-btn ${isActive ? 'gmap-hole-btn-active' : ''}" data-hole="${h.id}">
          ${h.id}
        </button>`;
      }).join("");

      const c = getContent();
      if (!c) return;

      c.innerHTML = `
        <div class="golf-wrap">
          <div class="golf-header">
            <button class="golf-back" id="gmapBack">← Back</button>
            <h2>⛳ Course Map</h2>
          </div>

          <div class="gmap-legend">
            <span class="gmap-legend-tee">● T = Tee</span>
            <span class="gmap-legend-hole">● H = Hole</span>
          </div>

          <div class="gmap-svg-wrap">
            ${buildSVG(activeHole)}
          </div>

          ${holeDetailHTML}

          <div class="gmap-hole-selector">
            <div class="golf-label" style="margin-bottom:8px;">Select Hole</div>
            <div class="gmap-hole-grid">${holeButtons}</div>
          </div>

          <div class="gmap-all-holes">
            ${HOLES.map(h => `
              <div class="gmap-hole-row">
                <span class="gmap-hole-num">Hole ${h.id}</span>
                <span class="gmap-hole-par">Par ${h.par}</span>
                <span class="gmap-hole-desc">${h.desc}</span>
              </div>
            `).join("")}
          </div>
        </div>
      `;

      document.getElementById("gmapBack")?.addEventListener("click", () => {
        if (typeof window.renderGolf === "function") window.renderGolf();
      });

      document.querySelectorAll(".gmap-hole-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = parseInt(btn.dataset.hole, 10);
          activeHole = activeHole === id ? null : id;
          draw();
        });
      });
    }

    draw();
  }

  // ─── Expose ───────────────────────────────────────────────────────────────
  window.renderGolfMap = renderGolfMap;

})();
