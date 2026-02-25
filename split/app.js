// split/app.js
(function () {
  // If these functions exist in your split files, expose them to window.
  // This keeps your old “global” behavior intact.

  if (typeof window.showTab === "function") {
    const _orig = window.showTab;
    window.showTab = function (tab) {
      _orig(tab);
      try { window.replaceMichiganText && window.replaceMichiganText(); } catch {}
    };
  }

  // Export the key entry points (only if they exist)
  if (typeof checkCode === "function") window.checkCode = checkCode;
  if (typeof showTab === "function") window.showTab = showTab;

  if (typeof loadScores === "function") window.loadScores = loadScores;
  if (typeof renderPicks === "function") window.renderPicks = renderPicks;
  if (typeof renderBeatTTUN === "function") window.renderBeatTTUN = renderBeatTTUN;
  if (typeof renderTopNews === "function") window.renderTopNews = renderTopNews;
  if (typeof renderShop === "function") window.renderShop = renderShop;
  if (typeof logout === "function") window.logout = logout;

  // Optional: stamp that split app loaded
  window.__SPLIT_READY = true;
})();