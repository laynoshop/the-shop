/* =========================
   THE PUTT SHOP — Course Map v4

   GREEN SHAPE (SVG viewBox 0 0 220 460):
     - RIGHT SIDE: straight wall top to bottom
     - TOP NECK: narrow section on the RIGHT (~3ft wide), runs ~8ft down
     - DIAGONAL: cuts from bottom-left of neck diagonally to lower-left
     - BOTTOM SECTION: full width (~8ft), runs ~14ft

   Polygon (clockwise):
     Top-left of neck:     (155, 10)
     Top-right of neck:    (215, 10)
     Bottom-right corner:  (215, 450)
     Bottom-left corner:   (5,   450)
     Base of diagonal:     (5,   210)
     Top of diagonal:      (155, 150)

   DISTANCE MATH (verified):
     SVG height 460 units = 22ft  →  1 SVG unit = 0.04783 ft (vertical)
     SVG width  220 units = 8ft   →  1 SVG unit = 0.03636 ft (horizontal)
     True distance = sqrt((dx*0.03636)² + (dy*0.04783)²)

   KEY BEHAVIOR:
     - activeHole set → ONLY that hole's T, H, line, arrow rendered.
       All others hidden completely (isolate mode).
     - activeHole null → all holes shown at reduced opacity (overview).

   facingDeg = direction the cup OPENING faces:
     0=UP, 90=RIGHT, 180=DOWN, 270=LEFT
   Arrow points FROM hole center TOWARD the opening.
   ========================= */

(function GolfMapModule() {
  "use strict";

  // ─── Green polygon ────────────────────────────────────────────────────────
  const GREEN_POLY  = "155,10 215,10 215,450 5,450 5,210 155,150";
  const FRINGE_POLY = "157,13 212,13 212,447 8,447 8,212 157,153";

  // ─── Scale factors ────────────────────────────────────────────────────────
  // These are the ONLY values used to compute dist labels.
  // SVG 460 units tall = 22ft, SVG 220 units wide = 8ft
  const SX = 8  / 220;   // ft per SVG unit (horizontal)
  const SY = 22 / 460;   // ft per SVG unit (vertical)

  function realFt(tee, hole) {
    const dx = (hole[0] - tee[0]) * SX;
    const dy = (hole[1] - tee[1]) * SY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function distLabel(tee, hole) {
    const d = realFt(tee, hole);
    return "~" + Math.round(d) + "ft";
  }

  // ─── Course Library ───────────────────────────────────────────────────────
  // All tee/hole coordinates verified >= 12ft real distance.
  // dist field is AUTO-COMPUTED below so it always matches the coordinates.
  const COURSES = [
    {
      id: "front-edge-nine",
      name: "Front-Edge Nine",
      designer: "The Putt Shop",
      holes: [
        {
          id: 1,
          tee:       [160, 20],
          hole:      [210, 445],
          facingDeg: 0,
          par:       3,
          desc:      "Full-Length Diagonal",
          tip:       "Tee at the top-left of the neck. Full diagonal to the bottom-right corner. Cup opens UP — if you blast past the corner you must reposition below the cup and putt back up into the face."
        },
        {
          id: 2,
          tee:       [210, 20],
          hole:      [10,  445],
          facingDeg: 270,
          par:       3,
          desc:      "Cross-Diagonal Full",
          tip:       "Top-right neck to bottom-left corner. Cup opens LEFT — approach from the right. Use the left wall as a backstop and let the ball kick back right into the face."
        },
        {
          id: 3,
          tee:       [160, 20],
          hole:      [10,  310],
          facingDeg: 90,
          par:       3,
          desc:      "Down the Diagonal Wall",
          tip:       "Top-left neck to mid-left wall. The ball travels down and left along the diagonal. Cup opens RIGHT — run it past the left wall then approach from the left side."
        },
        {
          id: 4,
          tee:       [210, 20],
          hole:      [10,  310],
          facingDeg: 90,
          par:       2,
          desc:      "Neck to Left Wall",
          tip:       "Top-right neck, long shot to the left wall mid-section. Cup opens RIGHT — the left wall is your backstop. Clean approach back into the face from the left."
        },
        {
          id: 5,
          tee:       [210, 445],
          hole:      [160, 20],
          facingDeg: 180,
          par:       3,
          desc:      "Uphill Full Diagonal",
          tip:       "Bottom-right corner to top-left neck. Cup opens DOWN — you MUST send it past the cup toward the top wall, let it return, and roll back down into the face from above."
        },
        {
          id: 6,
          tee:       [10,  445],
          hole:      [210, 20],
          facingDeg: 0,
          par:       3,
          desc:      "Uphill Cross-Diagonal",
          tip:       "Bottom-left corner all the way up to the top-right neck. Cup opens UP — approach from below. Don't overshoot past the top wall or you'll need to come back down."
        },
        {
          id: 7,
          tee:       [10,  440],
          hole:      [210, 100],
          facingDeg: 270,
          par:       3,
          desc:      "Bottom-Left to Right Rail",
          tip:       "Long upward diagonal from bottom-left to right wall upper section. Cup opens LEFT — let the ball hit the right wall and feed back left into the cup face."
        },
        {
          id: 8,
          tee:       [210, 80],
          hole:      [10,  440],
          facingDeg: 90,
          par:       3,
          desc:      "Right Rail to Bottom-Left",
          tip:       "From high on the right rail, long diagonal down to the bottom-left corner. Cup opens RIGHT — run it into the left wall and let it kick back right into the face."
        },
        {
          id: 9,
          tee:       [10,  210],
          hole:      [210, 445],
          facingDeg: 0,
          par:       2,
          desc:      "Victory Lap",
          tip:       "From the base of the diagonal wall, shoot diagonally to the bottom-right corner. Cup opens UP — controlled speed wins the hole. The finisher."
        }
      ]
    }
    // Additional courses can be appended here
  ];

  // Auto-compute totalPar and dist labels from actual coordinates
  COURSES.forEach(c => {
    c.totalPar = 0;
    c.holes.forEach(h => {
      h.dist = distLabel(h.tee, h.hole);
      c.totalPar += h.par;
    });
  });

  // ─── Colors ───────────────────────────────────────────────────────────────
  const C = {
    green:      "#2d6a2d",
    stroke:     "rgba(255,255,255,0.22)",
    fringe:     "rgba(255,255,255,0.07)",
    tee:        "#f59e0b",
    hole:       "#bb0000",
    teeText:    "#000",
    holeText:   "#fff",
    line:       "rgba(255,255,255,0.18)",
    lineActive: "#f59e0b",
  };

  // ─── Facing label ─────────────────────────────────────────────────────────
  function facingLabel(deg) {
    const m = { 0: "↑ UP", 90: "→ RIGHT", 180: "↓ DOWN", 270: "← LEFT" };
    return m[deg] || deg + "°";
  }

  // ─── Arrow builder ────────────────────────────────────────────────────────
  function buildArrow(cx, cy, deg, active) {
    const r   = 20;
    const rad = (deg - 90) * Math.PI / 180;
    const ax  = cx + r * Math.cos(rad);
    const ay  = cy + r * Math.sin(rad);
    const headLen = 7, headW = 4.5;
    const dx  = Math.cos(rad), dy = Math.sin(rad);
    const px  = -dy,           py =  dx;
    const tx  = ax - dx * headLen, ty = ay - dy * headLen;
    const lx1 = tx + px * headW,   ly1 = ty + py * headW;
    const lx2 = tx - px * headW,   ly2 = ty - py * headW;
    const col = active ? "#f59e0b" : "rgba(255,255,255,0.80)";
    return `
      <line x1="${cx}" y1="${cy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"
        stroke="${col}" stroke-width="2" opacity="1" />
      <polygon points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx1.toFixed(1)},${ly1.toFixed(1)} ${lx2.toFixed(1)},${ly2.toFixed(1)}"
        fill="${col}" opacity="1" />
    `;
  }

  // ─── SVG builder ──────────────────────────────────────────────────────────
  function buildSVG(holes, activeHole) {
    const MR = 11, FS = 8;
    const isolate = activeHole !== null;
    let lines = "", lineNums = "", arrows = "", tees = "", holeMarkers = "";

    holes.forEach(h => {
      const isActive = activeHole === h.id;
      if (isolate && !isActive) return;

      const lineCol = isolate ? C.lineActive : C.line;
      const lineW   = isolate ? 2 : 1.2;
      const opacity = isolate ? 1 : 0.30;

      lines += `<line x1="${h.tee[0]}" y1="${h.tee[1]}" x2="${h.hole[0]}" y2="${h.hole[1]}"
        stroke="${lineCol}" stroke-width="${lineW}" stroke-dasharray="5 3" opacity="${opacity}" />`;

      if (!isolate) {
        const mx = (h.tee[0] + h.hole[0]) / 2;
        const my = (h.tee[1] + h.hole[1]) / 2;
        lineNums += `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle"
          font-size="7" font-weight="900" fill="rgba(255,255,255,0.30)"
          font-family="-apple-system,system-ui">${h.id}</text>`;
      }

      arrows += buildArrow(h.hole[0], h.hole[1], h.facingDeg, true);

      const r = MR + (isActive ? 2 : 0);
      tees += `
        <circle cx="${h.tee[0]}" cy="${h.tee[1]}" r="${r}"
          fill="${C.tee}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" />
        <text x="${h.tee[0]}" y="${h.tee[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${FS}" font-weight="900" fill="${C.teeText}"
          font-family="-apple-system,system-ui">T${h.id}</text>
      `;

      holeMarkers += `
        <circle cx="${h.hole[0]}" cy="${h.hole[1]}" r="${r}"
          fill="${C.hole}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" />
        <text x="${h.hole[0]}" y="${h.hole[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${FS}" font-weight="900" fill="${C.holeText}"
          font-family="-apple-system,system-ui">H${h.id}</text>
      `;
    });

    let approachLabel = "";
    if (isolate) {
      const h = holes.find(x => x.id === activeHole);
      if (h) {
        approachLabel = `
          <text x="110" y="462" text-anchor="middle" dominant-baseline="auto"
            font-size="9" font-weight="900" fill="#f59e0b"
            font-family="-apple-system,system-ui">Cup opens ${facingLabel(h.facingDeg)} — approach from that direction</text>
        `;
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 470"
        style="width:100%;max-width:270px;display:block;margin:0 auto;border-radius:16px;
               background:#121212;box-shadow:0 12px 32px rgba(0,0,0,0.55);overflow:visible;">
        <polygon points="${GREEN_POLY}"
          fill="${C.green}" stroke="${C.stroke}" stroke-width="2.5" />
        <polygon points="${FRINGE_POLY}"
          fill="none" stroke="${C.fringe}" stroke-width="1.5" />
        ${lines}${lineNums}${arrows}${tees}${holeMarkers}${approachLabel}
        <text x="185" y="6" text-anchor="middle" font-size="6"
          fill="rgba(255,255,255,0.25)" font-family="-apple-system,system-ui">~3ft</text>
        <text x="110" y="6" text-anchor="middle" font-size="6"
          fill="rgba(255,255,255,0.16)" font-family="-apple-system,system-ui">~8ft →</text>
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

      const courseOpts = COURSES.map(c =>
        `<option value="${c.id}" ${c.id === activeCourseId ? "selected" : ""}>${c.name}</option>`
      ).join("");

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
            <span class="gmap-dist-chip">📍 ${activeData.dist}</span>
          </div>
        </div>
      ` : `<div class="gmap-hint">Tap a hole number to isolate it and see the approach direction</div>`;

      const holeButtons = holes.map(h => {
        const active = activeHole === h.id;
        return `<button class="gmap-hole-btn ${active ? "gmap-hole-btn-active" : ""}" data-hole="${h.id}">${h.id}</button>`;
      }).join("");

      const holeList = holes.map(h => `
        <div class="gmap-hole-row ${activeHole === h.id ? "gmap-hole-row-active" : ""}" data-hole="${h.id}">
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
          <div class="gmap-course-select-wrap">
            <label class="golf-label">Course</label>
            <select class="golf-select gmap-course-select" id="gmapCourseSelect">${courseOpts}</select>
            <div class="gmap-course-meta">
              <span class="gmap-course-par">Par ${course.totalPar}</span>
              <span class="gmap-course-designer">by ${course.designer}</span>
            </div>
          </div>
          <div class="gmap-legend">
            <span class="gmap-legend-tee">● T = Tee</span>
            <span class="gmap-legend-hole">● H = Hole</span>
            <span class="gmap-legend-arrow">→ = Cup opens</span>
          </div>
          <div class="gmap-svg-wrap">${buildSVG(holes, activeHole)}</div>
          ${holeDetailHTML}
          <div class="gmap-hole-selector">
            <div class="golf-label" style="margin-bottom:8px;">Select Hole</div>
            <div class="gmap-hole-grid">${holeButtons}</div>
          </div>
          <div class="gmap-all-holes">${holeList}</div>
        </div>
      `;

      document.getElementById("gmapBack")?.addEventListener("click", () => {
        if (typeof window.renderGolf === "function") window.renderGolf();
      });

      document.getElementById("gmapCourseSelect")?.addEventListener("change", e => {
        activeCourseId = e.target.value;
        activeHole = null;
        draw();
      });

      document.querySelectorAll(".gmap-hole-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = parseInt(btn.dataset.hole, 10);
          activeHole = activeHole === id ? null : id;
          draw();
          document.querySelector(".gmap-svg-wrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });

      document.querySelectorAll(".gmap-hole-row[data-hole]").forEach(row => {
        row.addEventListener("click", () => {
          const id = parseInt(row.dataset.hole, 10);
          activeHole = activeHole === id ? null : id;
          draw();
          document.querySelector(".gmap-svg-wrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });
    }

    draw();
  }

  // ─── Expose ───────────────────────────────────────────────────────────────
  window.renderGolfMap    = renderGolfMap;
  window.GOLF_MAP_COURSES = COURSES;

})();
