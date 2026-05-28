/* =========================
   SCORES RENDER
   UI rendering, live‑update loop, modal, sorting.
   Depends on window.__SD (scores-data.js)
   ========================= */

(function ScoresRenderModule () {
  if (!window.__SD) {
    console.error("[scores-render] window.__SD not found — load scores-data.js first.");
    return;
  }
  const SD = window.__SD;