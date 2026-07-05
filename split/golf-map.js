/* =========================
   THE PUTT SHOP — Course Map v3

   GREEN SHAPE (SVG viewBox 0 0 220 460):
     - RIGHT SIDE: straight wall top to bottom
     - TOP NECK: narrow section on the RIGHT (~3ft wide), runs ~8ft down
     - DIAGONAL: cuts from bottom-left of neck diagonally down to lower-left,
       widening into the full bottom section
     - BOTTOM SECTION: full width (~8ft), runs ~14ft

   Polygon (clockwise):
     Top-left of neck:     (155, 10)
     Top-right of neck:    (215, 10)
     Bottom-right corner:  (215, 450)
     Bottom-left corner:   (5,  450)
     Base of diagonal:     (5,  210)
     Top of diagonal:      (155, 150)

   KEY RULES:
     - When a hole is selected (activeHole !== null), ONLY that hole's
       T marker, H marker, dashed line, and cup arrow are shown.
       All other holes are completely hidden.
     - All holes are >= 12ft (represented in SVG units where the full
       22ft green = ~440 SVG units, so 12ft ≈ 240 SVG units of diagonal)
     - facingDeg: direction the cup OPENING faces
         0   = opens UP    (approach from below)
         90  = opens RIGHT  (approach from the left)
         180 = opens DOWN   (approach from above)
         270 = opens LEFT   (approach from the right)
     - Arrow points FROM the hole center TOWARD the cup opening,
       showing the player which direction to approach from.
   ========================= */

(function GolfMapModule() {
  "use strict";

  // ─── Green polygon ────────────────────────────────────────────────────────
  const GREEN_POLY  = "155,10 215,10 215,450 5,450 5,210 155,150";
  const FRINGE_POLY = "157,13 212,13 212,447 8,447 8,212 157,153";

  // ─── Distance helper ──────────────────────────────────────────────────────
  // Straight-line SVG distance between tee and hole.
  // Full green is ~440 SVG units tall = ~22ft, so 1 SVG unit ≈ 0.05ft.
  // 12ft minimum = 240 SVG units minimum.
  function svgDist(tee, hole) {
    const dx = hole[0] - tee[0];
    const dy = hole[1] - tee[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── Course Library ───────────────────────────────────────────────────────
  const COURSES = [
    {
      id: "front-edge-nine",
      name: "Front-Edge Nine",
      designer: "The Putt Shop",
      holes: [
        {
          id: 1,
          // Tee: top-left corner of the narrow neck
          // Hole: bottom-right corner of the wide section, facing UP
          // Full-length diagonal (~22ft). Cup opens UP — ball must approach
          // from below. If you blast past the bottom-right corner you
          // must reposition below the cup and putt back up into the face.
          // Par 3: the natural overshoot on a long diagonal + directional cup
          tee:       [160, 25],
          hole:      [205, 435],
          facingDeg: 0,
          par:       3,
          dist:      "~22ft",
          desc:      "Full-Length Diagonal",
          tip:       "Tee at the top-left of the neck. Roll the full length of the green to the bottom-right corner. Cup opens UP — if you blow past it you must come back and approach from below. Par 3."
        },
        {
          id: 2,
          // Tee: top-right of neck
          // Hole: far-left of wide section (mid-height), facing RIGHT
          // Long diagonal from neck to left wall. Cup opens RIGHT so
          // ball must approach from the LEFT — use the left wall as a
          // backstop and approach the cup face from that side. Par 3.
          tee:       [210, 25],
          hole:      [18, 310],
          facingDeg: 90,
          par:       3,
          dist:      "~20ft",
          desc:      "Neck to Left Wall",
          tip:       "Long cross-green shot from top-right neck to far-left of the wide section. Cup opens RIGHT — use the left wall as a backstop and let the ball feed back right into the cup face."
        },
        {
          id: 3,
          // Tee: bottom-left of neck (top of diagonal area)
          // Hole: bottom-right corner, facing LEFT
          // Long run from the diagonal area diagonally to the right bottom.
          // Cup opens LEFT — approach from the right wall. Par 2 (natural
          // path hugs the right wall and feeds into the face cleanly).
          tee:       [160, 148],
          hole:      [205, 438],
          facingDeg: 270,
          par:       2,
          dist:      "~15ft",
          desc:      "Diagonal to Right Corner",
          tip:       "From the top of the diagonal, send it down and right to the bottom-right corner. Cup opens LEFT — the right wall naturally feeds the ball into the cup face. Clean par 2 if you control speed."
        },
        {
          id: 4,
          // Tee: left edge of wide section (just below diagonal)
          // Hole: right wall mid-section, facing UP
          // Cross-green shot. Cup faces UP — straight approach if you
          // land it right, but easy to overshoot and need to come back. Par 2.
          tee:       [18, 240],
          hole:      [205, 360],
          facingDeg: 0,
          par:       2,
          dist:      "~16ft",
          desc:      "Wide Section Cross",
          tip:       "Left-side tee to right wall mid-section. Cup opens UP — don't overshoot past the right wall or you'll be repositioning below the cup."
        },
        {
          id: 5,
          // Tee: right wall mid-section
          // Hole: bottom-left corner, facing RIGHT
          // Ball travels from mid-right to bottom-left. Cup opens RIGHT
          // so approach from the left wall — let it hit the corner and
          // feed back right into the face. Par 3.
          tee:       [205, 240],
          hole:      [18, 438],
          facingDeg: 90,
          par:       3,
          dist:      "~22ft",
          desc:      "Right Wall to Bottom-Left",
          tip:       "Mid-right tee, long diagonal to the bottom-left corner. Cup opens RIGHT — run it into the left corner wall and let the ball kick back right into the cup face."
        },
        {
          id: 6,
          // Tee: bottom-right corner
          // Hole: center of the wide section (mid-height), facing DOWN
          // Shooting UP the green. Cup faces DOWN — ball must overshoot
          // past the cup toward the top, then roll back down into the face
          // from above. Par 3.
          tee:       [205, 445],
          hole:      [110, 290],
          facingDeg: 180,
          par:       3,
          dist:      "~17ft",
          desc:      "Bottom-Up Comeback",
          tip:       "Tee at bottom-right, shoot up to center-wide. Cup opens DOWN — you MUST send it past the cup toward the top of the green, then let it roll back down into the face from above."
        },
        {
          id: 7,
          // Tee: center-wide section
          // Hole: bottom-left corner, facing UP
          // Medium diagonal. Cup opens UP — clean approach if you don't
          // overshoot the corner. Par 2.
          tee:       [110, 240],
          hole:      [18, 440],
          facingDeg: 0,
          par:       2,
          dist:      "~14ft",
          desc:      "Center to Bottom-Left",
          tip:       "Center tee to bottom-left corner. Cup opens UP — control your speed. Don't blast past the corner or you'll need to reposition below the cup."
        },
        {
          id: 8,
          // Tee: bottom-left corner
          // Hole: right wall upper-wide section, facing LEFT
          // Long upward diagonal. Cup opens LEFT — approach from the
          // right wall, let it bounce and feed left into the face. Par 3.
          tee:       [18, 440],
          hole:      [205, 250],
          facingDeg: 270,
          par:       3,
          dist:      "~22ft",
          desc:      "Bottom-Left Up to Right Wall",
          tip:       "Long uphill diagonal from bottom-left to the right wall upper-wide. Cup opens LEFT — let the ball hit the right wall and feed back left into the cup face."
        },
        {
          id: 9,
          // Tee: left wall mid-wide section
          // Hole: right wall bottom-wide section, facing UP
          // Cross-bottom shot. Cup opens UP — long straight run with a
          // slight downward angle. Pressure finisher. Par 2.
          tee:       [18, 345],
          hole:      [205, 430],
          facingDeg: 0,
          par:       2,
          dist:      "~20ft",
          desc:      "Victory Lap",
          tip:       "Left-side tee, cross the bottom of the wide section to the right wall. Cup opens UP near the bottom-right — controlled speed wins the hole and the round."
        }
      ]
    }
    // Additional courses can be added here
  ];

  // Auto-compute totalPar
  COURSES.forEach(c => {
    c.totalPar = c.holes.reduce((s, h) => s + h.par, 0);
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
  // Arrow points FROM hole center TOWARD the cup opening direction.
  // deg: 0=up, 90=right, 180=down, 270=left
  function buildArrow(cx, cy, deg, active) {
    const r   = 20;
    const rad = (deg - 90) * Math.PI / 180;
    const ax  = cx + r * Math.cos(rad);
    const ay  = cy + r * Math.sin(rad);
    const headLen = 7;
    const headW   = 4.5;
    const dx  = Math.cos(rad);
    const dy  = Math.sin(rad);
    const px  = -dy;
    const py  =  dx;
    const tx  = ax - dx * headLen;
    const ty  = ay - dy * headLen;
    const lx1 = tx + px * headW;
    const ly1 = ty + py * headW;
    const lx2 = tx - px * headW;
    const ly2 = ty - py * headW;
    const col = active ? "#f59e0b" : "rgba(255,255,255,0.80)";
    return `
      <line x1="${cx}" y1="${cy}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"
        stroke="${col}" stroke-width="2" opacity="1" />
      <polygon points="${ax.toFixed(1)},${ay.toFixed(1)} ${lx1.toFixed(1)},${ly1.toFixed(1)} ${lx2.toFixed(1)},${ly2.toFixed(1)}"
        fill="${col}" opacity="1" />
    `;
  }

  // ─── SVG builder ──────────────────────────────────────────────────────────
  // KEY BEHAVIOR:
  //   - If activeHole is set: ONLY render that hole's line, T marker, H marker, arrow.
  //     All other holes are completely invisible.
  //   - If activeHole is null: render ALL holes at reduced opacity (overview mode).
  function buildSVG(holes, activeHole) {
    const MR = 11;
    const FS = 8;
    const isolate = activeHole !== null;

    let lines = "", lineNums = "", arrows = "", tees = "", holeMarkers = "";

    holes.forEach(h => {
      const isActive = activeHole === h.id;

      // In isolate mode, skip all holes except the active one
      if (isolate && !isActive) return;

      const opacity = isolate ? 1 : 0.30;
      const lineCol = isolate ? C.lineActive : C.line;
      const lineW   = isolate ? 2 : 1.2;

      // Dashed path line
      lines += `<line x1="${h.tee[0]}" y1="${h.tee[1]}" x2="${h.hole[0]}" y2="${h.hole[1]}"
        stroke="${lineCol}" stroke-width="${lineW}" stroke-dasharray="5 3" opacity="${opacity}" />`;

      // Mid-line number label (only in overview mode — in isolate mode it's redundant)
      if (!isolate) {
        const mx = (h.tee[0] + h.hole[0]) / 2;
        const my = (h.tee[1] + h.hole[1]) / 2;
        lineNums += `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle"
          font-size="7" font-weight="900" fill="rgba(255,255,255,0.30)"
          font-family="-apple-system,system-ui">${h.id}</text>`;
      }

      // Cup-facing arrow
      arrows += buildArrow(h.hole[0], h.hole[1], h.facingDeg, true);

      // Tee marker
      const r = MR + (isActive ? 2 : 0);
      tees += `
        <circle cx="${h.tee[0]}" cy="${h.tee[1]}" r="${r}"
          fill="${C.tee}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" />
        <text x="${h.tee[0]}" y="${h.tee[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${FS}" font-weight="900" fill="${C.teeText}"
          font-family="-apple-system,system-ui">T${h.id}</text>
      `;

      // Hole marker
      holeMarkers += `
        <circle cx="${h.hole[0]}" cy="${h.hole[1]}" r="${r}"
          fill="${C.hole}" stroke="rgba(0,0,0,0.5)" stroke-width="1.5" />
        <text x="${h.hole[0]}" y="${h.hole[1]}" text-anchor="middle" dominant-baseline="middle"
          font-size="${FS}" font-weight="900" fill="${C.holeText}"
          font-family="-apple-system,system-ui">H${h.id}</text>
      `;
    });

    // In isolate mode, add a large "cup face" label showing approach direction
    let approachLabel = "";
    if (isolate) {
      const h = holes.find(x => x.id === activeHole);
      if (h) {
        approachLabel = `
          <text x="110" y="460" text-anchor="middle" dominant-baseline="auto"
            font-size="9" font-weight="900" fill="#f59e0b"
            font-family="-apple-system,system-ui">
            Cup opens ${facingLabel(h.facingDeg)} — approach from that direction
          </text>
        `;
      }
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 470"
        style="width:100%;max-width:270px;display:block;margin:0 auto;border-radius:16px;
               background:#121212;box-shadow:0 12px 32px rgba(0,0,0,0.55);overflow:visible;">

        <!-- Green surface -->
        <polygon points="${GREEN_POLY}"
          fill="${C.green}" stroke="${C.stroke}" stroke-width="2.5" />

        <!-- Fringe inner line -->
        <polygon points="${FRINGE_POLY}"
          fill="none" stroke="${C.fringe}" stroke-width="1.5" />

        <!-- Putt path lines -->
        ${lines}
        ${lineNums}

        <!-- Cup arrows (under hole circles) -->
        ${arrows}

        <!-- Tee markers -->
        ${tees}

        <!-- Hole markers -->
        ${holeMarkers}

        <!-- Approach label (isolate mode only) -->
        ${approachLabel}

        <!-- Dimension hints -->
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

      // Course dropdown
      const courseOpts = COURSES.map(c =>
        `<option value="${c.id}" ${c.id === activeCourseId ? "selected" : ""}>${c.name}</option>`
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
            <span class="gmap-dist-chip">📍 ${activeData.dist}</span>
          </div>
        </div>
      ` : `
        <div class="gmap-hint">Tap a hole number to isolate it and see the approach direction</div>
      `;

      // Hole selector buttons
      const holeButtons = holes.map(h => {
        const active = activeHole === h.id;
        return `<button class="gmap-hole-btn ${active ? "gmap-hole-btn-active" : ""}" data-hole="${h.id}">${h.id}</button>`;
      }).join("");

      // Reference list
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

          <div class="gmap-svg-wrap">
            ${buildSVG(holes, activeHole)}
          </div>

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
          // Scroll map into view
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
