/* =========================
   THE PUTT SHOP — Golf Module
   Phone-side: Setup, Live Scoring, History, Stats
   Admin: Add Course, Manage Regulars
   Pi-side: Real-time Firebase listener + TV Scorecard Overlay
   ========================= */

(function GolfModule() {
  "use strict";

  // ─── Constants ───────────────────────────────────────────────────────────
  const COL   = () => (window.firebase && firebase.apps && firebase.apps.length ? firebase.firestore() : null);
  const COURSES_PATH  = "putt_courses";
  const REGULARS_PATH = "putt_regulars";
  const ROUNDS_PATH   = "putt_rounds";
  const MAX_PLAYERS   = 10;

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s || "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function vsParLabel(strokes, par) {
    const diff = strokes - par;
    if (diff === 0)  return { text: "E",    cls: "vpar-even" };
    if (diff > 0)    return { text: `+${diff}`, cls: "vpar-over" };
    return { text: String(diff), cls: "vpar-under" };
  }

  function totalVsPar(scores, pars) {
    let played = 0, diff = 0;
    const safeScores = Array.isArray(scores) ? scores : Object.values(scores || {});
    safeScores.forEach((s, i) => {
      if (typeof s === "number" && s > 0) {
        diff += s - (pars[i] || 0);
        played++;
      }
    });
    return { diff, played };
  }

  function generateRoundId() {
    return `round_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  }

  function isAdmin() {
    return (typeof window.getRole === "function" ? window.getRole() : "") === "admin";
  }

  // ─── State ───────────────────────────────────────────────────────────────
  let _state = {
    view: "home",
    courses: [],
    regulars: [],
    selectedCourse: null,
    playerNames: [],
    roundId: null,
    roundData: null,
    currentHole: 0,
    draftScores: {},
    rounds: [],
    viewingRound: null,
  };

  // ─── Firebase helpers ─────────────────────────────────────────────────────
  async function loadCourses() {
    const db = COL();
    if (!db) return [];
    const snap = await db.collection(COURSES_PATH).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function loadRegulars() {
    const db = COL();
    if (!db) return [];
    const snap = await db.collection(REGULARS_PATH).get();
    return snap.docs.map(d => d.id);
  }

  async function saveRegular(name) {
    const db = COL();
    if (!db || !name) return;
    await db.collection(REGULARS_PATH).doc(name.trim()).set({ addedAt: Date.now() });
  }

  async function deleteRegular(name) {
    const db = COL();
    if (!db || !name) return;
    await db.collection(REGULARS_PATH).doc(name.trim()).delete();
  }

  async function deleteRound(roundId) {
    const db = COL();
    if (!db || !roundId) return;
    await db.collection(ROUNDS_PATH).doc(roundId).delete();
  }

  async function createRound(courseId, courseName, holePars, playerNames) {
    const db = COL();
    if (!db) return null;
    const roundId = generateRoundId();
    const scores = {};
    playerNames.forEach(n => { scores[n] = { holes: new Array(holePars.length).fill(null) }; });
    await db.collection(ROUNDS_PATH).doc(roundId).set({
      courseId, courseName, holePars,
      players: playerNames,
      scores,
      status: "active",
      currentHole: 0,
      totalHoles: holePars.length,
      startedAt: Date.now(),
      completedAt: null,
    });
    return roundId;
  }

  async function submitHoleScores(roundId, holeIndex, scoresObj, nextHoleIndex, isComplete) {
    const db = COL();
    if (!db) return;
    const update = { currentHole: nextHoleIndex };
    for (const [player, score] of Object.entries(scoresObj)) {
      update[`scores.${player}.holes.${holeIndex}`] = score;
    }
    if (isComplete) {
      update.status = "complete";
      update.completedAt = Date.now();
    }
    await db.collection(ROUNDS_PATH).doc(roundId).update(update);
  }

  async function loadRounds(limit = 20) {
    const db = COL();
    if (!db) return [];
    const snap = await db.collection(ROUNDS_PATH)
      .orderBy("startedAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function adminSaveCourse(name, holePars) {
    const db = COL();
    if (!db) return;
    const id = `course_${Date.now()}`;
    await db.collection(COURSES_PATH).doc(id).set({
      name: name.trim(),
      holes: holePars.length,
      par: holePars,
      createdAt: Date.now(),
    });
  }

  // ─── Render: Main Shell ───────────────────────────────────────────────────
  function getContent() { return document.getElementById("content"); }
  function setContent(html) { const c = getContent(); if (c) c.innerHTML = html; }

  // ─── View: Golf Home ──────────────────────────────────────────────────────
  async function renderGolfHome() {
    _state.view = "home";

    // If admin, also load courses + regulars to show the admin panel
    let adminHTML = "";
    if (isAdmin()) {
      const [courses, regulars] = await Promise.all([loadCourses(), loadRegulars()]);
      _state.courses  = courses;
      _state.regulars = regulars;

      const courseList = courses.length
        ? courses.map(c => `<div class="golf-admin-row">${esc(c.name)} — ${c.holes} holes, par ${(c.par||[]).reduce((a,b)=>a+b,0)}</div>`).join("")
        : `<div class="golf-admin-row golf-muted">No courses yet.</div>`;

      const regularList = regulars.length
        ? regulars.map(r => `
            <div class="golf-admin-row golf-admin-regular">
              <span>${esc(r)}</span>
              <button class="golf-remove-regular golf-btn golf-btn-ghost" data-name="${esc(r)}">Remove</button>
            </div>`).join("")
        : `<div class="golf-admin-row golf-muted">No regulars saved yet.</div>`;

      const holeInputs = Array.from({length: 9}, (_,i) => `
        <div class="golf-hole-input-row">
          <label class="golf-label">Hole ${i+1}</label>
          <input class="golf-input golf-par-input" type="number" min="1" max="9"
            data-hole="${i}" value="2" />
        </div>
      `).join("");

      adminHTML = `
        <div class="golf-admin-section">
          <h3 class="golf-section-title">⛳ Add Course</h3>
          <div class="golf-field">
            <label class="golf-label">Course Name</label>
            <input class="golf-input" id="adminCourseName" type="text" maxlength="40" placeholder="e.g. THE Putt Shop" />
          </div>
          <div class="golf-hole-inputs-grid" id="adminHoleInputs">${holeInputs}</div>
          <button class="golf-btn golf-btn-primary" id="adminSaveCourse">Save Course</button>

          <h3 class="golf-section-title" style="margin-top:20px;">📋 Courses</h3>
          <div id="adminCourseList">${courseList}</div>

          <h3 class="golf-section-title" style="margin-top:20px;">👥 Regulars</h3>
          <div id="adminRegularsList">${regularList}</div>
        </div>
      `;
    }

    setContent(`
      <div class="golf-wrap">
        <div class="golf-header">
          <span class="golf-icon">⛳</span>
          <h2>THE Putt Shop</h2>
        </div>
        <div class="golf-home-btns">
          <button class="golf-btn golf-btn-primary" id="golfStartBtn">🏌️ Start a Round</button>
          <button class="golf-btn golf-btn-secondary" id="golfHistoryBtn">📋 Prior Rounds</button>
          <button class="golf-btn golf-btn-secondary" id="golfStatsBtn">📊 Putt Putt Stats</button>
        </div>
        ${adminHTML}
      </div>
    `);

    document.getElementById("golfStartBtn")?.addEventListener("click", () => renderSetup());
    document.getElementById("golfHistoryBtn")?.addEventListener("click", () => renderHistory());
    document.getElementById("golfStatsBtn")?.addEventListener("click", () => renderStats());

    // Admin bindings
    if (isAdmin()) {
      document.getElementById("adminSaveCourse")?.addEventListener("click", async () => {
        const name = document.getElementById("adminCourseName")?.value.trim();
        if (!name) { alert("Enter a course name."); return; }
        const inputs = [...document.querySelectorAll(".golf-par-input")];
        const pars = inputs.map(i => Math.max(1, parseInt(i.value, 10) || 2));
        const btn = document.getElementById("adminSaveCourse");
        if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
        await adminSaveCourse(name, pars);
        alert(`Course "${name}" saved!`);
        renderGolfHome();
      });

      document.querySelectorAll(".golf-remove-regular").forEach(btn => {
        btn.addEventListener("click", async () => {
          const name = btn.dataset.name;
          if (confirm(`Remove "${name}" from regulars?`)) {
            await deleteRegular(name);
            renderGolfHome();
          }
        });
      });
    }
  }

  // ─── View: Setup ─────────────────────────────────────────────────────────
  async function renderSetup() {
    _state.view = "setup";
    setContent(`<div class="golf-wrap"><div class="golf-notice">Loading courses…</div></div>`);

    const [courses, regulars] = await Promise.all([loadCourses(), loadRegulars()]);
    _state.courses  = courses;
    _state.regulars = regulars;

    const courseOpts = courses.length
      ? courses.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")
      : `<option value="">No courses yet — ask admin to add one</option>`;

    setContent(`
      <div class="golf-wrap">
        <div class="golf-header">
          <button class="golf-back" id="golfBackHome">← Back</button>
          <h2>⛳ New Round</h2>
        </div>

        <div class="golf-field">
          <label class="golf-label">Course</label>
          <select id="golfCourseSelect" class="golf-select">${courseOpts}</select>
        </div>

        <div class="golf-field">
          <label class="golf-label">Players <span class="golf-muted">(max ${MAX_PLAYERS})</span></label>
          <div id="golfPlayerList" class="golf-player-list"></div>
          <button class="golf-btn golf-btn-ghost" id="golfAddPlayer">+ Add Player</button>
        </div>

        ${regulars.length ? `
          <div class="golf-field">
            <label class="golf-label">Regulars — tap to add</label>
            <div class="golf-regulars" id="golfRegulars">
              ${regulars.map(r => `<button class="golf-chip" data-name="${esc(r)}">${esc(r)}</button>`).join("")}
            </div>
          </div>
        ` : ""}

        <button class="golf-btn golf-btn-primary golf-start-round" id="golfConfirmStart">⛳ Start Round</button>
      </div>
    `);

    document.getElementById("golfBackHome")?.addEventListener("click", renderGolfHome);
    document.getElementById("golfAddPlayer")?.addEventListener("click", addPlayerRow);
    document.getElementById("golfConfirmStart")?.addEventListener("click", confirmStartRound);
    document.querySelectorAll(".golf-chip").forEach(btn => {
      btn.addEventListener("click", () => addPlayerByName(btn.dataset.name));
    });

    addPlayerRow();
  }

  function addPlayerRow(prefill = "") {
    const list = document.getElementById("golfPlayerList");
    if (!list) return;
    const count = list.querySelectorAll(".golf-player-row").length;
    if (count >= MAX_PLAYERS) return;
    const row = document.createElement("div");
    row.className = "golf-player-row";
    row.innerHTML = `
      <input class="golf-input golf-player-input" type="text"
        placeholder="Player ${count + 1} name"
        maxlength="20" value="${esc(prefill)}" />
      <button class="golf-remove-player" aria-label="Remove">✕</button>
    `;
    row.querySelector(".golf-remove-player").addEventListener("click", () => row.remove());
    list.appendChild(row);
  }

  function addPlayerByName(name) {
    const list = document.getElementById("golfPlayerList");
    if (!list) return;
    const empties = [...list.querySelectorAll(".golf-player-input")].filter(i => !i.value.trim());
    if (empties.length) { empties[0].value = name; return; }
    addPlayerRow(name);
  }

  async function confirmStartRound() {
    const courseId = document.getElementById("golfCourseSelect")?.value;
    const course = _state.courses.find(c => c.id === courseId);
    if (!course) { alert("Please select a course."); return; }

    const inputs = [...document.querySelectorAll(".golf-player-input")];
    const names = inputs.map(i => i.value.trim()).filter(Boolean);
    if (names.length < 1) { alert("Add at least 1 player."); return; }

    const unique = [...new Set(names)];
    if (unique.length !== names.length) { alert("Player names must be unique."); return; }

    const known = new Set(_state.regulars);
    for (const n of unique) {
      if (!known.has(n)) await saveRegular(n);
    }

    const btn = document.getElementById("golfConfirmStart");
    if (btn) { btn.disabled = true; btn.textContent = "Starting…"; }

    const roundId = await createRound(courseId, course.name, course.par, unique);
    if (!roundId) { alert("Failed to create round. Check Firebase."); return; }

    _state.roundId     = roundId;
    _state.playerNames = unique;
    _state.selectedCourse = course;
    _state.currentHole = 0;
    _state.roundData   = {
      courseId, courseName: course.name,
      holePars: course.par, players: unique,
      scores: Object.fromEntries(unique.map(n => [n, { holes: new Array(course.par.length).fill(null) }])),
      status: "active", currentHole: 0, totalHoles: course.par.length,
    };

    renderScoring();
  }

  // ─── View: Live Scoring ───────────────────────────────────────────────────
  function renderScoring() {
    _state.view = "scoring";
    const { roundData, currentHole } = _state;
    const pars       = roundData.holePars;
    const players    = roundData.players;
    const holeNum    = currentHole + 1;
    const par        = pars[currentHole];
    const totalHoles = pars.length;
    const isLast     = currentHole === totalHoles - 1;

    _state.draftScores = {};
    players.forEach(p => {
      const saved = roundData.scores[p]?.holes?.[currentHole];
      _state.draftScores[p] = (typeof saved === "number" && saved > 0) ? saved : par;
    });

    function playerRows() {
      return players.map(p => {
        const score = _state.draftScores[p];
        const allHoles = [...(roundData.scores[p]?.holes || [])];
        allHoles[currentHole] = score;
        const rt = totalVsPar(allHoles, pars);
        const vpRun = rt.played > 0 ? vsParLabel(rt.diff, 0).text : "—";
        const vpCls = rt.diff < 0 ? "vpar-under" : rt.diff > 0 ? "vpar-over" : "vpar-even";
        return `
          <div class="golf-score-row">
            <div class="golf-score-name">${esc(p)}</div>
            <div class="golf-stepper">
              <button class="golf-step-btn" data-player="${esc(p)}" data-dir="-1">◀</button>
              <span class="golf-step-val" id="stepVal_${esc(p)}">${score}</span>
              <button class="golf-step-btn" data-player="${esc(p)}" data-dir="1">▶</button>
            </div>
            <div class="golf-score-total ${vpCls}" id="total_${esc(p)}">${vpRun}</div>
          </div>
        `;
      }).join("");
    }

    setContent(`
      <div class="golf-wrap">
        <div class="golf-header">
          <h2>⛳ THE Putt Shop</h2>
          <div class="golf-hole-badge">Hole ${holeNum} / ${totalHoles}</div>
        </div>

        <div class="golf-par-line">Par ${par}</div>

        <div class="golf-score-list" id="golfScoreList">
          ${playerRows()}
        </div>

        <div class="golf-scoring-nav">
          ${currentHole > 0
            ? `<button class="golf-btn golf-btn-ghost" id="golfPrevHole">← Prev Hole</button>`
            : `<div></div>`
          }
          ${isLast
            ? `<button class="golf-btn golf-btn-danger" id="golfEndRound">🏁 End Round</button>`
            : `<button class="golf-btn golf-btn-primary" id="golfNextHole">Next Hole →</button>`
          }
        </div>
      </div>
    `);

    document.querySelectorAll(".golf-step-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const p = btn.dataset.player;
        const dir = parseInt(btn.dataset.dir, 10);
        const cur = _state.draftScores[p] || 1;
        const next = Math.max(1, cur + dir);
        _state.draftScores[p] = next;
        const valEl = document.getElementById(`stepVal_${p}`);
        if (valEl) valEl.textContent = next;
        updateRunningTotal(p);
      });
    });

    document.getElementById("golfPrevHole")?.addEventListener("click", saveAndGoHole(currentHole - 1));
    document.getElementById("golfNextHole")?.addEventListener("click", saveAndGoHole(currentHole + 1));
    document.getElementById("golfEndRound")?.addEventListener("click", handleEndRound);
  }

  function updateRunningTotal(playerName) {
    const { roundData, currentHole, draftScores } = _state;
    const pars  = roundData.holePars;
    const allHoles = [...(roundData.scores[playerName]?.holes || [])];
    allHoles[currentHole] = draftScores[playerName];
    const rt = totalVsPar(allHoles, pars);
    const el = document.getElementById(`total_${playerName}`);
    if (!el) return;
    if (rt.played > 0) {
      el.textContent = vsParLabel(rt.diff, 0).text;
      el.className = `golf-score-total ${rt.diff < 0 ? "vpar-under" : rt.diff > 0 ? "vpar-over" : "vpar-even"}`;
    } else {
      el.textContent = "—";
    }
  }

  function saveAndGoHole(targetHole) {
    return async () => {
      const { roundId, currentHole, draftScores, roundData } = _state;
      const totalHoles = roundData.holePars.length;
      const isComplete = targetHole >= totalHoles;

      roundData.players.forEach(p => {
        if (!roundData.scores[p]) roundData.scores[p] = { holes: [] };
        roundData.scores[p].holes[currentHole] = draftScores[p];
      });

      await submitHoleScores(roundId, currentHole, draftScores, Math.min(targetHole, totalHoles - 1), isComplete);

      if (isComplete) {
        _state.roundData.status = "complete";
        renderRoundComplete();
      } else {
        _state.currentHole = targetHole;
        renderScoring();
      }
    };
  }

  async function handleEndRound() {
    const { roundId, currentHole, draftScores, roundData } = _state;
    roundData.players.forEach(p => {
      roundData.scores[p].holes[currentHole] = draftScores[p];
    });
    await submitHoleScores(roundId, currentHole, draftScores, currentHole, true);
    _state.roundData.status = "complete";
    renderRoundComplete();
  }

  function renderRoundComplete() {
    const { roundData } = _state;
    const pars    = roundData.holePars;
    const players = roundData.players;

    let winner = null, bestDiff = Infinity;
    players.forEach(p => {
      const { diff } = totalVsPar(roundData.scores[p]?.holes || [], pars);
      if (diff < bestDiff) { bestDiff = diff; winner = p; }
    });

    const winnerVp = vsParLabel(bestDiff, 0);

    setContent(`
      <div class="golf-wrap">
        <div class="golf-winner-banner">
          <div class="golf-trophy">🏆</div>
          <div class="golf-winner-name">${esc(winner)} WINS!</div>
          <div class="golf-winner-score ${winnerVp.cls}">${winnerVp.text}</div>
        </div>
        ${buildScorecardHTML(roundData)}
        <button class="golf-btn golf-btn-secondary" id="golfDoneBtn" style="margin-top:24px;">← Back to Golf Home</button>
      </div>
    `);
    document.getElementById("golfDoneBtn")?.addEventListener("click", renderGolfHome);
  }

  // ─── View: History ────────────────────────────────────────────────────────
  async function renderHistory() {
    _state.view = "history";
    setContent(`<div class="golf-wrap"><div class="golf-notice">Loading rounds…</div></div>`);
    const rounds = await loadRounds(30);
    _state.rounds = rounds;

    if (!rounds.length) {
      setContent(`<div class="golf-wrap">
        <div class="golf-header"><button class="golf-back" id="golfBackH">← Back</button><h2>Prior Rounds</h2></div>
        <div class="golf-notice">No rounds played yet. Start one!</div>
      </div>`);
      document.getElementById("golfBackH")?.addEventListener("click", renderGolfHome);
      return;
    }

    const rows = rounds.map((r, i) => {
      const date = new Date(r.startedAt).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" });
      const statusBadge = r.status === "complete"
        ? `<span class="golf-badge-complete">Complete</span>`
        : `<span class="golf-badge-active">Active</span>`;
      const players = (r.players || []).join(", ");
      return `
        <div class="golf-history-row" data-idx="${i}">
          <div class="golf-history-left">
            <div class="golf-history-course">${esc(r.courseName)}</div>
            <div class="golf-history-meta">${esc(date)} · ${esc(players)}</div>
          </div>
          <div class="golf-history-right">${statusBadge}</div>
        </div>
      `;
    }).join("");

    setContent(`
      <div class="golf-wrap">
        <div class="golf-header"><button class="golf-back" id="golfBackH2">← Back</button><h2>📋 Prior Rounds</h2></div>
        <div class="golf-history-list">${rows}</div>
      </div>
    `);
    document.getElementById("golfBackH2")?.addEventListener("click", renderGolfHome);
    document.querySelectorAll(".golf-history-row").forEach(row => {
      row.addEventListener("click", () => {
        const idx = parseInt(row.dataset.idx, 10);
        renderRoundDetail(rounds[idx]);
      });
    });
  }

  function renderRoundDetail(round) {
    _state.view = "roundDetail";
    _state.viewingRound = round;

    const isActive = round.status === "active";

    const resumeBtn = isActive
      ? `<button class="golf-btn golf-btn-primary" id="golfResumeBtn" style="margin-top:16px;">▶ Resume Round</button>`
      : "";

    const deleteBtn = isAdmin()
      ? `<button class="golf-btn golf-btn-danger" id="golfDeleteRoundBtn" style="margin-top:12px;">🗑 Delete Round</button>`
      : "";

    setContent(`
      <div class="golf-wrap">
        <div class="golf-header"><button class="golf-back" id="golfBackRD">← Back</button><h2>${esc(round.courseName)}</h2></div>
        ${buildScorecardHTML(round)}
        ${resumeBtn}
        ${deleteBtn}
      </div>
    `);

    document.getElementById("golfBackRD")?.addEventListener("click", renderHistory);

    if (isActive) {
      document.getElementById("golfResumeBtn")?.addEventListener("click", () => {
        const holePars = round.holePars || [];
        _state.roundId       = round.id;
        _state.playerNames   = round.players || [];
        _state.currentHole   = typeof round.currentHole === "number" ? round.currentHole : 0;
        _state.roundData     = {
          courseId:    round.courseId,
          courseName:  round.courseName,
          holePars,
          players:     round.players || [],
          scores:      round.scores  || {},
          status:      "active",
          currentHole: _state.currentHole,
          totalHoles:  holePars.length,
        };
        renderScoring();
      });
    }

    if (isAdmin()) {
      document.getElementById("golfDeleteRoundBtn")?.addEventListener("click", async () => {
        const label = `${round.courseName} (${new Date(round.startedAt).toLocaleDateString([], { month:"short", day:"numeric", year:"numeric" })})`;
        if (!confirm(`Delete round: ${label}?\n\nThis cannot be undone.`)) return;
        const btn = document.getElementById("golfDeleteRoundBtn");
        if (btn) { btn.disabled = true; btn.textContent = "Deleting…"; }
        await deleteRound(round.id);
        renderHistory();
      });
    }
  }

  // ─── View: Stats ──────────────────────────────────────────────────────────
  async function renderStats() {
    _state.view = "stats";
    setContent(`<div class="golf-wrap"><div class="golf-notice">Crunching stats…</div></div>`);
    const rounds = await loadRounds(100);
    const completed = rounds.filter(r => r.status === "complete");

    if (!completed.length) {
      setContent(`<div class="golf-wrap">
        <div class="golf-header"><button class="golf-back" id="golfBackSt">← Back</button><h2>📊 Stats</h2></div>
        <div class="golf-notice">No completed rounds yet.</div>
      </div>`);
      document.getElementById("golfBackSt")?.addEventListener("click", renderGolfHome);
      return;
    }

    const totalRounds = completed.length;
    let holeInOnes = [];
    const holeStats = {};
    const playerStats = {};
    let bestRound = null, bestDiff = Infinity;

    for (const r of completed) {
      const pars = r.holePars || [];
      let roundBest = Infinity;

      for (const p of (r.players || [])) {
        const holes = r.scores?.[p]?.holes || [];
        if (!playerStats[p]) playerStats[p] = { rounds: 0, totalDiff: 0, wins: 0, holeInOnes: 0 };
        playerStats[p].rounds++;
        const { diff } = totalVsPar(holes, pars);
        playerStats[p].totalDiff += diff;
        if (diff < roundBest) roundBest = diff;

        holes.forEach((s, hi) => {
          if (typeof s !== "number" || s <= 0) return;
          const par = pars[hi] || 0;
          if (!holeStats[hi]) holeStats[hi] = { totalDiff: 0, count: 0 };
          holeStats[hi].totalDiff += s - par;
          holeStats[hi].count++;
          if (s === 1) {
            holeInOnes.push({ player: p, hole: hi + 1, course: r.courseName, date: r.startedAt });
            playerStats[p].holeInOnes++;
          }
        });
      }

      for (const p of (r.players || [])) {
        const holes = r.scores?.[p]?.holes || [];
        const { diff } = totalVsPar(holes, pars);
        if (diff === roundBest) {
          playerStats[p].wins++;
          if (diff < bestDiff) { bestDiff = diff; bestRound = { player: p, diff, course: r.courseName, date: r.startedAt }; }
        }
      }
    }

    const holeEntries = Object.entries(holeStats).map(([hi, s]) => ({ hole: parseInt(hi)+1, avg: s.totalDiff / s.count }));
    holeEntries.sort((a,b) => b.avg - a.avg);
    const hardest = holeEntries[0];
    const easiest = holeEntries[holeEntries.length - 1];

    const playerRows = Object.entries(playerStats)
      .sort((a,b) => (a[1].totalDiff/a[1].rounds) - (b[1].totalDiff/b[1].rounds))
      .map(([name, s]) => {
        const avgStr = (s.totalDiff / s.rounds).toFixed(1);
        const avgNum = parseFloat(avgStr);
        const cls = avgNum < 0 ? "vpar-under" : avgNum > 0 ? "vpar-over" : "vpar-even";
        return `<tr>
          <td>${esc(name)}</td>
          <td>${s.rounds}</td>
          <td class="${cls}">${avgNum > 0 ? '+' : ''}${avgStr}</td>
          <td>${s.wins}</td>
          <td>${s.holeInOnes}</td>
        </tr>`;
      }).join("");

    const brDate = bestRound ? new Date(bestRound.date).toLocaleDateString([], {month:"short",day:"numeric"}) : "";
    const brVp   = bestRound ? vsParLabel(bestRound.diff, 0) : null;

    setContent(`
      <div class="golf-wrap">
        <div class="golf-header"><button class="golf-back" id="golfBackSt2">← Back</button><h2>📊 Putt Putt Stats</h2></div>

        <div class="golf-stat-cards">
          <div class="golf-stat-card"><div class="golf-stat-num">${totalRounds}</div><div class="golf-stat-label">Rounds Played</div></div>
          <div class="golf-stat-card"><div class="golf-stat-num">${holeInOnes.length}</div><div class="golf-stat-label">Hole-in-Ones</div></div>
          ${hardest ? `<div class="golf-stat-card"><div class="golf-stat-num">Hole ${hardest.hole}</div><div class="golf-stat-label">Hardest Hole (avg ${hardest.avg > 0 ? '+' : ''}${hardest.avg.toFixed(2)})</div></div>` : ""}
          ${easiest ? `<div class="golf-stat-card"><div class="golf-stat-num">Hole ${easiest.hole}</div><div class="golf-stat-label">Easiest Hole (avg ${easiest.avg > 0 ? '+' : ''}${easiest.avg.toFixed(2)})</div></div>` : ""}
          ${bestRound ? `<div class="golf-stat-card"><div class="golf-stat-num ${brVp?.cls}">${brVp?.text}</div><div class="golf-stat-label">Best Round — ${esc(bestRound.player)} on ${brDate}</div></div>` : ""}
        </div>

        ${holeInOnes.length ? `
          <h3 class="golf-section-title">🎯 Hole-in-Ones</h3>
          <div class="golf-hio-list">
            ${holeInOnes.map(h => `
              <div class="golf-hio-row">
                <span class="golf-hio-player">${esc(h.player)}</span>
                <span class="golf-hio-hole">Hole ${h.hole}</span>
                <span class="golf-hio-date">${new Date(h.date).toLocaleDateString([],{month:"short",day:"numeric",year:"numeric"})}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}

        <h3 class="golf-section-title">🏌️ Player Leaderboard</h3>
        <div class="golf-table-wrap">
          <table class="golf-table">
            <thead><tr><th>Player</th><th>Rounds</th><th>Avg</th><th>Wins</th><th>HIOs</th></tr></thead>
            <tbody>${playerRows}</tbody>
          </table>
        </div>
      </div>
    `);
    document.getElementById("golfBackSt2")?.addEventListener("click", renderGolfHome);
  }

  // ─── Shared: Scorecard HTML ───────────────────────────────────────────────
  function buildScorecardHTML(round) {
    const pars    = round.holePars || [];
    const players = round.players  || [];
    const totalPar = pars.reduce((a,b) => a+b, 0);

    const holeCells  = pars.map((_,i) => `<th>${i+1}</th>`).join("");
    const parCells   = pars.map(p => `<td class="golf-sc-par">${p}</td>`).join("");

    const playerRows = players.map(p => {
      const holes = round.scores?.[p]?.holes || [];
      const { diff } = totalVsPar(holes, pars);
      const vp = vsParLabel(diff, 0);
      const cells = pars.map((_,i) => {
        const s = holes[i];
        if (s == null) return `<td class="golf-sc-empty">—</td>`;
        const d = s - pars[i];
        const cls = d < 0 ? "golf-sc-under" : d > 0 ? "golf-sc-over" : "golf-sc-even";
        return `<td class="${cls}">${s}</td>`;
      }).join("");
      return `<tr><td class="golf-sc-name">${esc(p)}</td>${cells}<td class="golf-sc-total ${vp.cls}">${vp.text}</td></tr>`;
    }).join("");

    return `
      <div class="golf-scorecard-wrap">
        <div class="golf-sc-course">${esc(round.courseName)}</div>
        <div class="golf-sc-scroll">
          <table class="golf-scorecard" style="font-size:12px;">
            <thead>
              <tr><th style="padding:4px 5px;">Player</th>${holeCells}<th style="padding:4px 5px;">Total</th></tr>
              <tr class="golf-sc-par-row"><td style="padding:3px 5px;">Par</td>${parCells}<td class="golf-sc-par" style="padding:3px 5px;">${totalPar}</td></tr>
            </thead>
            <tbody>${playerRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ─── Admin: Course Manager (legacy entry point from shop tab) ─────────────
  async function renderAdminGolf() {
    // Now just re-renders the golf home, which includes the admin panel for admin users
    renderGolfHome();
  }

  // ─── Pi Scoreboard: Firebase Listener + TV Overlay ───────────────────────
  let _piUnsubscribe = null;

  function initPiGolfListener() {
    const db = COL();
    if (!db) return;
    if (_piUnsubscribe) _piUnsubscribe();

    _piUnsubscribe = db.collection(ROUNDS_PATH)
      .where("status", "in", ["active", "complete"])
      .orderBy("startedAt", "desc")
      .limit(1)
      .onSnapshot(snap => {
        if (snap.empty) { hidePiGolfOverlay(); return; }
        const round = { id: snap.docs[0].id, ...snap.docs[0].data() };
        handlePiRoundUpdate(round);
      }, () => {});
  }

  let _lastRoundId = null;
  let _alertShown  = false;

  function handlePiRoundUpdate(round) {
    const overlay = document.getElementById("piGolfOverlay");
    if (!overlay) { buildPiGolfOverlay(); return handlePiRoundUpdate(round); }

    const isNew = round.id !== _lastRoundId;
    if (isNew) { _lastRoundId = round.id; _alertShown = false; }

    if (!_alertShown && round.status === "active") {
      _alertShown = true;
      showPiAlert(round);
      setTimeout(() => showPiScorecard(round), 4500);
      return;
    }

    if (round.status === "complete") { showPiWinner(round); return; }
    showPiScorecard(round);
  }

  function buildPiGolfOverlay() {
    let el = document.getElementById("piGolfOverlay");
    if (el) return;
    el = document.createElement("div");
    el.id = "piGolfOverlay";
    el.className = "pi-golf-overlay";
    el.style.display = "none";
    document.body.appendChild(el);
  }

  function hidePiGolfOverlay() {
    const el = document.getElementById("piGolfOverlay");
    if (el) el.style.display = "none";
  }

  function showPiAlert(round) {
    const el = document.getElementById("piGolfOverlay");
    if (!el) return;
    el.style.display = "flex";
    el.innerHTML = `
      <div class="pi-golf-alert">
        <div class="pi-golf-alert-icon">⛳</div>
        <div class="pi-golf-alert-title">ROUND STARTED!</div>
        <div class="pi-golf-alert-sub">${esc(round.courseName)} &nbsp;·&nbsp; ${(round.players||[]).length} Players</div>
        <div class="pi-golf-alert-names">${(round.players||[]).map(esc).join(" &nbsp;vs&nbsp; ")}</div>
      </div>
    `;
  }

  function showPiScorecard(round) {
    const el = document.getElementById("piGolfOverlay");
    if (!el) return;
    el.style.display = "flex";
    el.innerHTML = buildPiScorecardHTML(round);
    document.getElementById("piGolfClose")?.addEventListener("click", hidePiGolfOverlay);
  }

  function showPiWinner(round) {
    const el = document.getElementById("piGolfOverlay");
    if (!el) return;

    const pars    = round.holePars || [];
    const players = round.players  || [];
    let winner = null, bestDiff = Infinity;
    players.forEach(p => {
      const { diff } = totalVsPar(round.scores?.[p]?.holes || [], pars);
      if (diff < bestDiff) { bestDiff = diff; winner = p; }
    });
    const vp = vsParLabel(bestDiff, 0);

    el.style.display = "flex";
    el.innerHTML = `
      <div class="pi-golf-winner-wrap">
        <button class="pi-golf-close" id="piGolfClose">✕</button>
        <div class="pi-golf-trophy">🏆</div>
        <div class="pi-golf-winner-name">${esc(winner)} WINS!</div>
        <div class="pi-golf-winner-score ${vp.cls}">${vp.text}</div>
        <div class="pi-golf-winner-sub">Final Score</div>
        ${buildPiScorecardHTML(round, true)}
      </div>
    `;
    document.getElementById("piGolfClose")?.addEventListener("click", hidePiGolfOverlay);
  }

  function buildPiScorecardHTML(round, embedded = false) {
    const pars    = round.holePars || [];
    const players = round.players  || [];
    const totalPar = pars.reduce((a,b) => a+b, 0);

    const holeCells = pars.map((_,i) => `<th>${i+1}</th>`).join("");
    const parCells  = pars.map(p => `<td class="pi-sc-par">${p}</td>`).join("");

    const playerRows = players.map(p => {
      const holes = round.scores?.[p]?.holes || [];
      const { diff, played } = totalVsPar(holes, pars);
      const vp = played > 0 ? vsParLabel(diff, 0) : { text: "—", cls: "" };
      const cells = pars.map((_,i) => {
        const s = holes[i];
        if (s == null) return `<td class="pi-sc-empty"></td>`;
        const d = s - pars[i];
        const cls = d < 0 ? "pi-sc-under" : d > 0 ? "pi-sc-over" : "pi-sc-even";
        return `<td class="${cls}">${s}</td>`;
      }).join("");
      return `<tr><td class="pi-sc-name">${esc(p)}</td>${cells}<td class="pi-sc-total ${vp.cls}">${vp.text}</td></tr>`;
    }).join("");

    const closeBtn = !embedded ? `<button class="pi-golf-close" id="piGolfClose">✕</button>` : "";

    return `
      <div class="pi-golf-scorecard-wrap">
        ${closeBtn}
        <div class="pi-sc-header">
          <span class="pi-sc-icon">⛳</span>
          <span class="pi-sc-title">${esc(round.courseName)}</span>
          <span class="pi-sc-status ${round.status === 'complete' ? 'pi-sc-complete' : 'pi-sc-live'}"
            >${round.status === 'complete' ? 'FINAL' : 'LIVE'}</span>
        </div>
        <div class="pi-sc-table-wrap">
          <table class="pi-scorecard">
            <thead>
              <tr><th class="pi-sc-namecol">Player</th>${holeCells}<th>Total</th></tr>
              <tr class="pi-sc-par-row"><td>Par</td>${parCells}<td class="pi-sc-par">${totalPar}</td></tr>
            </thead>
            <tbody>${playerRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ─── Entry Points ─────────────────────────────────────────────────────────
  window.renderGolf         = renderGolfHome;
  window.renderAdminGolf    = renderAdminGolf;
  window.initPiGolfListener = initPiGolfListener;

})();
