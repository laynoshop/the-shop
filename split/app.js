// split/app.js
(function () {

  let __countdownStarted = false;

  // Wrap showTab so we can hook into navigation safely
  if (typeof window.showTab === "function") {
    const _orig = window.showTab;

    window.showTab = function (tab) {
      _orig(tab);

      // Replace Michigan text (existing behavior)
      try {
        window.replaceMichiganText && window.replaceMichiganText();
      } catch {}

      // If entry is visible, start countdown once
      try {
        const entry = document.getElementById("entry");
        if (
          entry &&
          entry.style.display !== "none" &&
          typeof window.startCountdown === "function" &&
          !__countdownStarted
        ) {
          window.startCountdown();
          __countdownStarted = true;
        }
      } catch {}
    };
  }

  // Export globals safely (preserve legacy behavior)
  try { if (typeof checkCode === "function") window.checkCode = checkCode; } catch {}
  try { if (typeof showTab === "function") window.showTab = showTab; } catch {}
  try { if (typeof loadScores === "function") window.loadScores = loadScores; } catch {}
  try { if (typeof renderPicks === "function") window.renderPicks = renderPicks; } catch {}
  try { if (typeof renderBeatTTUN === "function") window.renderBeatTTUN = renderBeatTTUN; } catch {}
  try { if (typeof renderTopNews === "function") window.renderTopNews = renderTopNews; } catch {}
  try { if (typeof renderShop === "function") window.renderShop = renderShop; } catch {}
  try { if (typeof logout === "function") window.logout = logout; } catch {}

  // Fallback: if entry loads before showTab runs
  document.addEventListener("DOMContentLoaded", function () {
    const entry = document.getElementById("entry");
    if (
      entry &&
      entry.style.display !== "none" &&
      typeof window.startCountdown === "function" &&
      !__countdownStarted
    ) {
      window.startCountdown();
      __countdownStarted = true;
    }
  });

  // Stamp that split app loaded
  window.__SPLIT_READY = true;

})();