/* =========================
   THE PUTT SHOP — Course Map v2

   GREEN SHAPE (SVG viewBox 0 0 220 460):
     The green matches the hand-drawn sketch:
       - RIGHT SIDE: straight wall top to bottom
       - TOP NECK: narrow section on the RIGHT (~3ft wide), runs ~8ft down
       - DIAGONAL: cuts from the bottom of the neck (lower-right) diagonally
         to the lower-left, widening into the full bottom section
       - BOTTOM SECTION: full width (~8ft), runs ~14ft

   Polygon points (clockwise):
     Top-right of neck:    (215, 10)
     Top-left of neck:     (155, 10)
     Bottom-left of neck:  (155, 150)   ← top of diagonal
     Bottom-left wide:     (5,  210)    ← bottom of diagonal (left side)
     Bottom-left corner:   (5,  450)
     Bottom-right corner:  (215, 450)
     Back to top-right:    (215, 10)

   Each course hole:
     { id, tee:[x,y], hole:[x,y], facingDeg, par, desc, tip }
     facingDeg = degrees the cup opening faces (0=up, 90=right, 180=down, 270=left)
     The arrow on the map shows which direction you must approach FROM
     (i.e., the arrow points INTO the cup face).
   ========================= */

(function GolfMapModule() {
  "use strict";

  // ─── Green polygon ────────────────────────────────────────────────────────
  // RIGHT side is straight. Neck is top-right. Diagonal widens to the left.
  const GREEN_POLY   = "155,10 215,10 215,450 5,450 5,210 155,150";
  const FRINGE_POLY  = "157,13 212,13 212,447 8,447 8,212 157,153";

  // ─── Course Library ───────────────────────────────────────────────────────
  // facingDeg: direction the cup opening faces.
  //   0   = cup opening faces UP    (ball must approach from below)
  //   90  = cup opening faces RIGHT  (ball must approach from the left)
  //   180 = cup opening faces DOWN   (ball must approach from above)
  //   270 = cup opening faces LEFT   (ball must approach from the right)
  const COURSES = [
    {
      id: "front-edge-nine",
      name: "Front-Edge Nine",
      designer: "The Putt Shop AI",
      totalPar: 24,
      holes: [
        {
          id: 1,
          tee:       [185, 30],
          hole:      [185, 120],
          facingDeg: 0,          // cup opens UP — ball must come from below
          par: 2,
          desc: "Neck Straight Down",
          tip:  "Tee is at the top of the neck. Roll it straight down the right rail. Cup faces up — don't blow past it or you'll need to come all the way back."
        },
        {
          id: 2,
          tee:       [185, 130],
          hole:      [163, 80],
          facingDeg: 180,        // cup opens DOWN — ball must approach from above
          par: 3,
          desc: "Neck Comeback",
          tip:  "Tee near the bottom of the neck. The cup faces DOWN — you must intentionally putt PAST the hole toward the top wall, let it return, and roll into the face from above. Classic par 3 leave."
        },
        {
          id: 3,
          tee:       [165, 30],
          hole:      [165, 145],
          facingDeg: 0,          // cup opens UP
          par: 2,
          desc: "Left Rail Neck",
          tip:  "Hug the left wall of the neck. Cup faces up near the diagonal. Short and straight — two clean putts and you're done."
        },
        {
          id: 4,
          tee:       [185, 40],
          hole:      [75, 210],
          facingDeg: 90,         // cup opens RIGHT — ball must approach from the left
          par: 3,
          desc: "Diagonal Crosser",
          tip:  "Long diagonal from the top of the neck all the way to the left edge of the wide section. Cup opens RIGHT — approach from the left wall. Use the left edge as a bumper to set up your angle into the cup face."
        },
        {
          id: 5,
          tee:       [40, 240],
          hole:      [195, 350],
          facingDeg: 270,        // cup opens LEFT — ball must approach from the right
          par: 3,
          desc: "Wide Cross",
          tip:  "Left-side tee, hole is far right. Cup faces LEFT so the ball must come from the right wall. Hit it to the right rail, let it run down, and approach the face from the right side."
        },
        {
          id: 6,
          tee:       [195, 230],
          hole:      [30, 380],
          facingDeg: 90,         // cup opens RIGHT
          par: 3,
          desc: "Right-to-Left Runner",
          tip:  "Tee on the right, long run to the far-left edge near the bottom. Cup opens RIGHT — approach from the left wall. Send it left, let it kiss the wall, then it feeds right into the face."
        },
        {
          id: 7,
          tee:       [110, 230],
          hole:      [110, 430],
          facingDeg: 0,          // cup opens UP
          par: 2,
          desc: "Center Straight",
          tip:  "Dead center of the green, top to near-bottom. Cup faces UP — controlled speed wins. Don't overpower it."
        },
        {
          id: 8,
          tee:       [30, 430],
          hole:      [195, 290],
          facingDeg: 180,        // cup opens DOWN
          par: 3,
          desc: "Bottom-Up Comeback",
          tip:  "Tee from the bottom-left corner, shooting UP the green to mid-right. Cup faces DOWN — you must run it past the hole toward the top, let it come back down, and enter the face from above. Tricky speed control."
        },
        {
          id: 9,
          tee:       [195, 440],
          hole:      [30, 440],
          facingDeg: 90,         // cup opens RIGHT — approach from left wall
          par: 3,
          desc: "Victory Lap",
          tip:  "Bottom-right corner to bottom-left corner. Cup opens RIGHT near the left edge. You must run it past the cup to the left wall, let it bounce back, and roll into the face from the right. Pressure finisher — finishing under par here is the badge of honor."
        },
      ]
    }
    // More courses can be added here as new objects in this array
  ];

  // ─── Colors ───────────────────────────────────────────────────────────────
  const C = {
    green:    "#2d6a2d",
    stroke:   "rgba(255,255,255,0.22)",
    fringe:   "rgba(255,255,255,0.07)",
    tee:      "#f59e0b",
    hole:     "#bb0000",
    arrow:    "#ffffff",
    teeText:  "#000",
    holeText: "#fff",
    line:     "rgba(255,255,255,0.18)",
    lineActive: "#f59e0b",
  };

  // ─── Arrow builder ────────────────────────────────────────────────────────
  // Draws a directional arrow at (cx, cy) pointing in the given direction
  // deg: 0=up, 90=right, 180=down, 270=left
  // The arrow points INTO the cup face (shows the required approach direction)
  function buildArrow(cx, cy, deg, active) {
    const r     = 18;  // offset from center of hole marker
    const rad   = (deg - 90) * Math.PI / 180; // convert to SVG rotation
    const ax    = cx + r * Math.cos(rad);
    const ay    = cy + r * Math.sin(rad);
    // Arrow head points toward the cup face
    const headLen = 7;
    const headW   = 4;
    // Direction unit vector (toward cup)
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    // Perpendicular
    const px = -dy;
    const py =  dx;
    // Arrow tip at (ax, ay), tail behind
    const tx  = ax - dx * headLen;
    const ty  = ay - dy * headLen;
    const lx1 = tx + px * headW;
    const ly1 = ty + py * headW;
    const lx2 = tx - px * headW;
    const ly2 = ty - py * headW;
    const color = active ? "#f59e0b" : "rgba(255,255,255,0.80)";
    return `
      <line x1="${cx}" y1="${cy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"
        stroke="${color}" stroke-width="1.8" opacity="${active ? 1 : 0.7}" />
      <polygon points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx1.toFixed(1)},${ly1.toFixed(1)} ${lx2.toFixed(1)},${ly2.toFixed(1)}"
        fill="${color}" opacity="${active ? 1 : 0.7}" />
    `;
  }

  // ─── Facing label ─────────────────────────────────────────────────────────
  function facingLabel(deg) {
    const labels = { 0: "↑ UP", 90: "→ RIGHT", 180: "↓ DOWN", 270: "← LEFT" };
    return labels[deg] || `${deg}°`;
  }

  // ─── SVG builder ──────────────────────────────────────────────────────────
  function buildSVG(holes, activeHole) {
    const MR   = 11; // marker radius
    const FS   = 8;  // font size

    // Dashed path lines
    const lines = holes.map(h => {
      const isActive = activeHole === h.id;
      return `<line x1="${h.tee[0]}" y1="${h.tee[1]}" x2="${h.hole[0]}" y2="${h.hole[1]}"
        stroke="${isActive ? C.lineActive : C.line}" stroke-width="${isActive ? 2 : 1.2}"
        stroke-dasharray="5 3" opacity="${isActive ? 0.85 : 0.30}" />`;
    }).join("");

    // Mid-line hole number labels
    const lineNums = holes.map(h => {
      const mx = (h.tee[0] + h.hole[0]) / 2;
      const my = (h.tee[1] + h.hole[1]) / 2;
      const isActive = activeHole === h.id;
      return `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle"
        font-size="7" font-weight="900" fill="rgba(255,255,255,${isActive ? 0.95 : 0.30})"
        font-family="-apple-system,system-ui">${h.id}</text>`;
    }).join("");

    // Cup-facing arrows (drawn UNDER hole circles so circle sits on top)
    const arrows = holes.map(h => buildArrow(
      h.hole[0], h.hole[1], h.facingDeg, activeHole === h.id
    )).join("");

    // Tee markers
    const tees = holes.map(h => {
      const active = activeHole === h.id;
      const r = active ? MR + 2 : MR;
      return `
        <circle cx="${h.tee[0]}" cy="${h.tee[1]}" r="${r}"
          fill="${C.tee}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"
          ${active ? 'filter="url(#glow)"' : ''} />
        <text x="${h.tee[0]}" y="${h.tee[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${FS}" font-weight="900" fill="${C.teeText}"
          font-family="-apple-system,system-ui">T${h.id}</text>
      `;
    }).join("");

    // Hole markers (scarlet)
    const holeMarkers = holes.map(h => {
      const active = activeHole === h.id;
      const r = active ? MR + 2 : MR;
      return `
        <circle cx="${h.hole[0]}" cy="${h.hole[1]}" r="${r}"
          fill="${C.hole}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5"
          ${active ? 'filter="url(#glow)"' : ''} />
        <text x="${h.hole[0]}" y="${h.hole[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${FS}" font-weight="900" fill="${C.holeText}"
          font-family="-apple-system,system-ui">H${h.id}</text>
      `;
    }).join("");

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 460"
        style="width:100%;max-width:270px;display:block;margin:0 auto;border-radius:16px;
               background:#121212;box-shadow:0 12px 32px rgba(0,0,0,0.55);overflow:visible;">
        <defs>
          <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        <!-- Green surface -->
        <polygon points="${GREEN_POLY}"
          fill="${C.green}" stroke="${C.stroke}" stroke-width="2.5" />

        <!-- Fringe inner line -->
        <polygon points="${FRINGE_POLY}"
          fill="none" stroke="${C.fringe}" stroke-width="1.5" />

        <!-- Putt path lines -->
        ${lines}
        ${lineNums}

        <!-- Cup-facing arrows (rendered before hole circles) -->
        ${arrows}

        <!-- Tee markers -->
        ${tees}

        <!-- Hole markers -->
        ${holeMarkers}

        <!-- Dimension labels -->
        <text x="185" y="6" text-anchor="middle" font-size="6"
          fill="rgba(255,255,255,0.28)" font-family="-apple-system,system-ui">~3ft</text>
        <text x="110" y="6" text-anchor="middle" font-size="6"
          fill="rgba(255,255,255,0.18)" font-family="-apple-system,system-ui">~8ft wide</text>
      </svg>
    `;
  }

  // ─── Render main view ─────────────────────────────────────────────────────
  function renderGolfMap(initialCourseId) {
    let activeCourseId = initialCourseId || COURSES[0].id;
    let activeHole     = null;

    function getCourse() { return COURSES.find(c => c.id === activeCourseId) || COURSES[0]; }
    function getContent() { return document.getElementById("content"); }

    function draw() {
      const course     = getCourse();
      const holes      = course.holes;
      const activeData = activeHole ? holes.find(h => h.id === activeHole) : null;

      // Course dropdown
      const courseOpts = COURSES.map(c =>
        `<option value="${c.id}" ${c.id === activeCourseId ? 'selected' : ''}>${c.name}</option>`
      ).join("");

      // Hole detail card
      const holeDetailHTML = activeData ? `
        <div class="gmap-detail">
          <div class="gmap-detail-top">
            <span class="gmap-detail-num">Hole ${activeData.id} — ${activeData.desc}</span>
            <span class="gmap-detail-par">Par ${activeData.par}</span>
          </div>
          <div class="gmap-facing">
            <span class="gmap-facing-label">Cup faces</span>
            <span class="gmap-facing-val">${facingLabel(activeData.facingDeg)}</span>
          </div>
          <div class="gmap-detail-desc">${activeData.tip}</div>
          <div class="gmap-detail-markers">
            <span class="gmap-tee-chip">T${activeData.id} Tee</span>
            <span class="gmap-hole-chip">H${activeData.id} Hole</span>
          </div>
        </div>
      ` : `
        <div class="gmap-hint">Tap a hole to highlight it &amp; see the approach tip</div>
      `;

      // Hole selector buttons
      const holeButtons = holes.map(h => {
        const active = activeHole === h.id;
        return `<button class="gmap-hole-btn ${active ? 'gmap-hole-btn-active' : ''}" data-hole="${h.id}">${h.id}</button>`;
      }).join("");

      // Hole reference list
      const holeList = holes.map(h => `
        <div class="gmap-hole-row ${activeHole === h.id ? 'gmap-hole-row-active' : ''}" data-hole="${h.id}">
          <span class="gmap-hole-num">H${h.id}</span>
          <span class="gmap-hole-par">Par ${h.par}</span>
          <div class="gmap-hole-row-right">
            <span class="gmap-hole-desc">${h.desc}</span>
            <span class="gmap-hole-facing">${facingLabel(h.facingDeg)}</span>
          </div>
        </div>
      `).join("");

      const c = getContent();
      if (!c) return;

      c.innerHTML = `
        <div class="golf-wrap">
          <div class="golf-header">
            <button class="golf-back" id="gmapBack">← Back</button>
            <h2>🗺️ Course Map</h2>
          </div>

          <!-- Course selector -->
          <div class="gmap-course-select-wrap">
            <label class="golf-label">Course</label>
            <select class="golf-select gmap-course-select" id="gmapCourseSelect">${courseOpts}</select>
            <div class="gmap-course-meta">
              <span class="gmap-course-par">Par ${getCourse().totalPar}</span>
              <span class="gmap-course-designer">by ${getCourse().designer}</span>
            </div>
          </div>

          <!-- Legend -->
          <div class="gmap-legend">
            <span class="gmap-legend-tee">● T = Tee</span>
            <span class="gmap-legend-hole">● H = Hole</span>
            <span class="gmap-legend-arrow">→ = Cup faces</span>
          </div>

          <!-- SVG green map -->
          <div class="gmap-svg-wrap">
            ${buildSVG(holes, activeHole)}
          </div>

          <!-- Hole detail / hint -->
          ${holeDetailHTML}

          <!-- Hole selector -->
          <div class="gmap-hole-selector">
            <div class="golf-label" style="margin-bottom:8px;">Select Hole</div>
            <div class="gmap-hole-grid">${holeButtons}</div>
          </div>

          <!-- Scorecard-style reference list -->
          <div class="gmap-all-holes">${holeList}</div>
        </div>
      `;

      // Back button
      document.getElementById("gmapBack")?.addEventListener("click", () => {
        if (typeof window.renderGolf === "function") window.renderGolf();
      });

      // Course switcher
      document.getElementById("gmapCourseSelect")?.addEventListener("change", e => {
        activeCourseId = e.target.value;
        activeHole     = null;
        draw();
      });

      // Hole buttons
      document.querySelectorAll(".gmap-hole-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = parseInt(btn.dataset.hole, 10);
          activeHole = activeHole === id ? null : id;
          draw();
        });
      });

      // Hole list rows
      document.querySelectorAll(".gmap-hole-row[data-hole]").forEach(row => {
        row.addEventListener("click", () => {
          const id = parseInt(row.dataset.hole, 10);
          activeHole = activeHole === id ? null : id;
          draw();
        });
      });
    }

    draw();
  }

  // ─── Expose ───────────────────────────────────────────────────────────────
  window.renderGolfMap  = renderGolfMap;
  window.GOLF_MAP_COURSES = COURSES; // expose so future courses can be pushed externally

})();
