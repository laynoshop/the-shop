// split/app.js
(function () {
  "use strict";

  // -----------------------------
  // Countdown (self-contained)
  // -----------------------------
  let __cdTimer = null;

  function getNextGameDateLocal() {
    // "The Game" is typically the last Saturday of November.
    // We'll calculate it dynamically each year.
    function lastSaturdayOfNovember(year) {
      // Start at Nov 30
      const d = new Date(year, 10, 30, 12, 0, 0, 0); // Nov=10, noon local
      // Walk backwards to Saturday (6)
      while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
      return d;
    }

    const now = new Date();
    let target = lastSaturdayOfNovember(now.getFullYear());
    if (target.getTime() <= now.getTime()) {
      target = lastSaturdayOfNovember(now.getFullYear() + 1);
    }
    return target;
  }

  function setCdText(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(val);
  }

  function updateCountdownOnce() {
    const target = getNextGameDateLocal();
    const now = new Date();
    let diff = target.getTime() - now.getTime();

    if (!Number.isFinite(diff)) diff = 0;
    if (diff < 0) diff = 0;

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hrs = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    setCdText("cdDays", days);
    setCdText("cdHours", hrs);
    setCdText("cdMins", mins);
    setCdText("cdSecs", secs);

    // Optional subline if you use it
    const sub = document.getElementById("countdownSub");
    if (sub) {
      sub.textContent = target.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    }
  }

  function startCountdown() {
    // Only start if the entry countdown elements exist
    const has =
      document.getElementById("cdDays") ||
      document.getElementById("cdHours") ||
      document.getElementById("cdMins") ||
      document.getElementById("cdSecs");

    if (!has) return;

    // Prevent duplicate timers
    if (__cdTimer) {
      clearInterval(__cdTimer);
      __cdTimer = null;
    }

    // Run immediately, then every second
    updateCountdownOnce();
    __cdTimer = setInterval(updateCountdownOnce, 1000);
  }

  // Expose it (so other split files can call it if needed)
  window.startCountdown = startCountdown;

  // -----------------------------
  // Start countdown when ENTRY becomes visible
  // -----------------------------
  function isEntryVisible() {
    const entry = document.getElementById("entry");
    if (!entry) return false;
    // visible if not display:none and in DOM
    const style = window.getComputedStyle(entry);
    return style && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function maybeStartCountdown() {
    try {
      if (isEntryVisible()) startCountdown();
    } catch {}
  }

  // Poll for entry visibility (covers any login flow)
  let __entryPollTicks = 0;
  const __entryPoll = setInterval(() => {
    __entryPollTicks++;
    maybeStartCountdown();

    // stop polling once countdown has started and entry is visible
    if (__cdTimer && isEntryVisible()) clearInterval(__entryPoll);

    // hard stop after ~30s just to avoid infinite polling
    if (__entryPollTicks > 120) clearInterval(__entryPoll);
  }, 250);

  // Also try on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    maybeStartCountdown();
  });

  // -----------------------------
  // Wrap showTab (keep your legacy behavior)
  // -----------------------------
  if (typeof window.showTab === "function") {
    const _orig = window.showTab;
    window.showTab = function (tab) {
      _orig(tab);

      try { window.replaceMichiganText && window.replaceMichiganText(); } catch {}
      // If entry shows due to nav, start countdown
      maybeStartCountdown();
    };
  }

  // -----------------------------
  // Export key entry points (safe)
  // -----------------------------
  try { if (typeof checkCode === "function") window.checkCode = checkCode; } catch {}
  try { if (typeof showTab === "function") window.showTab = showTab; } catch {}
  try { if (typeof loadScores === "function") window.loadScores = loadScores; } catch {}
  try { if (typeof renderPicks === "function") window.renderPicks = renderPicks; } catch {}
  try { if (typeof renderBeatTTUN === "function") window.renderBeatTTUN = renderBeatTTUN; } catch {}
  try { if (typeof renderTopNews === "function") window.renderTopNews = renderTopNews; } catch {}
  try { if (typeof renderShop === "function") window.renderShop = renderShop; } catch {}
  try { if (typeof logout === "function") window.logout = logout; } catch {}

  // Stamp that split app loaded
  window.__SPLIT_READY = true;

})();