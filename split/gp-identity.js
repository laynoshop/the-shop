/* split/gp-identity.js
   =========================
   GROUP PICKS — Player Identity
   Manages name+code identity, localStorage persistence,
   SHA-256 player ID computation, and identity gate UI.
   Exposes all functions on window.GP_Identity namespace.
*/

(function () {
  "use strict";

  // Storage keys (must match groupPicks.js orchestrator)
  const PICKS_NAME_KEY          = "theShopPicksName_v1";
  const PICKS_PLAYER_CODE_KEY   = "theShopPicksPlayerCode_v1";
  const PICKS_PLAYER_REMEMBER_KEY = "theShopPicksRemember_v1";
  const PICKS_PLAYER_ID_KEY     = "theShopPicksPlayerId_v1";

  // --------------- safe localStorage helpers ---------------
  function safeGetLS(key) {
    try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
  }
  function safeSetLS(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }
  function safeDelLS(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function esc(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // --------------- memory bucket ---------------
  function gpMem() {
    window.__GP_MEM = window.__GP_MEM || {};
    return window.__GP_MEM;
  }

  // --------------- normalizers ---------------
  function gpNormalizeName(s) {
    return String(s || "").trim().replace(/\s+/g, " ").slice(0, 20);
  }
  function gpNormalizeCode(s) {
    return String(s || "").trim().slice(0, 64);
  }

  // --------------- remember default ---------------
  function gpRememberDefault() {
    const v = safeGetLS(PICKS_PLAYER_REMEMBER_KEY).trim();
    if (v === "0") return false;
    if (v === "1") return true;
    return true; // default ON
  }

  // --------------- read identity ---------------
  function gpGetIdentityFromStorageOrMem() {
    const m = gpMem();
    const name = gpNormalizeName(safeGetLS(PICKS_NAME_KEY) || m.picksName || "");
    const remember = gpRememberDefault();

    let code = "";
    if (remember) code = gpNormalizeCode(safeGetLS(PICKS_PLAYER_CODE_KEY));
    else code = gpNormalizeCode(m.picksCode || "");

    let playerId = safeGetLS(PICKS_PLAYER_ID_KEY).trim() || String(m.picksPlayerId || "").trim();
    return { name, code, remember, playerId };
  }

  // --------------- write identity ---------------
  function gpSetIdentity({ name, code, remember, playerId }) {
    const m = gpMem();
    const nm = gpNormalizeName(name);
    const cd = gpNormalizeCode(code);
    const rem = !!remember;

    if (nm) safeSetLS(PICKS_NAME_KEY, nm);
    safeSetLS(PICKS_PLAYER_REMEMBER_KEY, rem ? "1" : "0");

    if (rem) {
      if (cd) safeSetLS(PICKS_PLAYER_CODE_KEY, cd);
      else safeDelLS(PICKS_PLAYER_CODE_KEY);
      m.picksCode = "";
    } else {
      safeDelLS(PICKS_PLAYER_CODE_KEY);
      m.picksCode = cd;
    }

    if (playerId) {
      safeSetLS(PICKS_PLAYER_ID_KEY, String(playerId));
      m.picksPlayerId = String(playerId);
    }
    m.picksName = nm;
  }

  // --------------- clear identity ---------------
  function gpClearIdentity() {
    const m = gpMem();
    safeDelLS(PICKS_NAME_KEY);
    safeDelLS(PICKS_PLAYER_CODE_KEY);
    safeDelLS(PICKS_PLAYER_ID_KEY);
    safeSetLS(PICKS_PLAYER_REMEMBER_KEY, "1");
    m.picksName = "";
    m.picksCode = "";
    m.picksPlayerId = "";
  }

  // --------------- shared SHA-256 (with a non-crypto fallback) ---------------
  async function gpHashString(raw) {
    try {
      if (window.crypto && crypto.subtle && typeof TextEncoder !== "undefined") {
        const bytes = new TextEncoder().encode(raw);
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        const arr = Array.from(new Uint8Array(hash));
        return arr.slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
      }
    } catch {}

    // Fallback: djb2 — only reached on very old browsers without SubtleCrypto.
    let h = 5381;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) + h) ^ raw.charCodeAt(i);
    return `${(h >>> 0).toString(16).padStart(8, "0")}_${raw.length}`;
  }

  // --------------- compute player ID (SHA-256 of name+code) ---------------
  async function gpComputePlayerId(name, code) {
    const nm = gpNormalizeName(name);
    const cd = gpNormalizeCode(code);
    const hex = await gpHashString(`picks:v1:${nm.toLowerCase()}|${cd}`);
    return `p_${hex}`;
  }

  // --------------- compute a code hash (SHA-256 of the code alone) ---------------
  // Stored on the player's registry doc (players/{playerId}.codeHash) so a
  // returning player can be *found* by name+code instead of the playerId
  // always having to be re-derived from them — which is what makes a real
  // password reset possible: an admin can overwrite this hash on an
  // existing player's doc without touching their playerId, so the
  // player's picks/history stay exactly where they are. Salted with the
  // name so two different people who happen to type the identical code
  // don't hash to the same value.
  async function gpComputeCodeHash(name, code) {
    const nm = gpNormalizeName(name);
    const cd = gpNormalizeCode(code);
    const hex = await gpHashString(`picks:code:v1:${nm.toLowerCase()}|${cd}`);
    return `c_${hex}`;
  }

  // --------------- validation ---------------
  function gpIsIdentityValid(idObj) {
    const nm = gpNormalizeName(idObj?.name || "");
    const cd = gpNormalizeCode(idObj?.code || "");
    return (nm.length >= 2 && cd.length >= 3);
  }

  // --------------- identity gate HTML ---------------
  function gpBuildIdentityGateHTML({ prefillName, rememberChecked }) {
    const nm = gpNormalizeName(prefillName || "");
    const rem = (rememberChecked !== false);

    return `
      <div class="gpAuthWrap">
        <div class="gpAuthCard">
          <div class="gpAuthIconBadge">🏈</div>
          <div class="gpAuthEyebrow">Pick&#8217;em Login</div>
          <div class="gpAuthTitle">Enter your name and password</div>
          <div class="gpAuthBlurb">Use the same name and password on any phone to be the same player.</div>

          <form autocomplete="on" onsubmit="return false;">
            <div class="gpAuthFields">
              <div class="gpAuthField">
                <div class="gpAuthLabel">Display Name</div>
                <input
                  id="gpIdName"
                  name="username"
                  class="gpAuthInput"
                  type="text"
                  inputmode="text"
                  autocomplete="username"
                  autocapitalize="words"
                  spellcheck="false"
                  value="${esc(nm)}"
                  placeholder="Example: Victor"
                />
              </div>

              <div class="gpAuthField">
                <div class="gpAuthLabel">Password</div>
                <input
                  id="gpIdCode"
                  name="password"
                  class="gpAuthInput"
                  type="password"
                  inputmode="text"
                  autocomplete="current-password"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="Make something you'll remember"
                />
                <div class="gpAuthHelp">Tip: &ldquo;buckeyes27&rdquo; / &ldquo;1-more-sec&rdquo; / etc.</div>
              </div>
            </div>

            <label class="gpAuthRememberRow">
              <input id="gpIdRemember" type="checkbox" ${rem ? "checked" : ""} />
              <span>Remember on this device</span>
            </label>

            <div class="gpAuthActions">
              <button class="gpAuthPrimaryBtn" type="button" data-gpaction="playerContinue">Continue</button>
              <button class="gpAuthGhostBtn" type="button" data-gpaction="playerClear">Clear</button>
            </div>

            <div id="gpIdErr" class="gpAuthError"></div>
          </form>
        </div>
      </div>
    `;
  }

  function gpSetIdentityError(msg) {
    const el = document.getElementById("gpIdErr");
    if (el) el.textContent = String(msg || "");
  }

  // --------------- change-code gate HTML ---------------
  // Two entry points share this screen: forced (the player just logged in
  // with an admin-issued temp code and must set their own before they can
  // do anything else) and voluntary (a "Change Code" button while already
  // logged in, no admin involved). Only the copy differs.
  function gpBuildChangeCodeGateHTML({ forced, name } = {}) {
    const nm = gpNormalizeName(name || "");
    const title = forced ? "Set a new password" : "Change your password";
    const blurb = forced
      ? "You logged in with a temporary password — set a permanent one only you know."
      : "Pick a new password. You'll use it (with your name) to log in from any device.";
    return `
      <div class="gpAuthWrap">
        <div class="gpAuthCard">
          <div class="gpAuthIconBadge">🔒</div>
          <div class="gpAuthEyebrow">${forced ? "Temporary Password" : "Account Security"}</div>
          <div class="gpAuthTitle">${esc(title)}</div>
          <div class="gpAuthBlurb">${esc(blurb)}</div>

          <form autocomplete="on" onsubmit="return false;">
            <input type="text" name="username" autocomplete="username" value="${esc(nm)}" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;" tabindex="-1" aria-hidden="true" />
            <div class="gpAuthFields">
              <div class="gpAuthField">
                <div class="gpAuthLabel">New Password</div>
                <input
                  id="gpNewCode"
                  name="new-password"
                  class="gpAuthInput"
                  type="password"
                  inputmode="text"
                  autocomplete="new-password"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="Make something you'll remember"
                />
              </div>

              <div class="gpAuthField">
                <div class="gpAuthLabel">Confirm New Password</div>
                <input
                  id="gpNewCodeConfirm"
                  name="new-password-confirm"
                  class="gpAuthInput"
                  type="password"
                  inputmode="text"
                  autocomplete="new-password"
                  autocapitalize="none"
                  spellcheck="false"
                  placeholder="Type it again"
                />
                <div id="gpNewCodeMatchHint" class="gpAuthMatchHint"></div>
              </div>
            </div>

            <div class="gpAuthActions">
              <button class="gpAuthPrimaryBtn" type="button" data-gpaction="changeCodeSubmit" data-forced="${forced ? "1" : "0"}" data-name="${esc(nm)}">Save Password</button>
              ${forced ? "" : `<button class="gpAuthGhostBtn" type="button" data-gpaction="changeCodeCancel">Cancel</button>`}
            </div>

            <div id="gpNewCodeErr" class="gpAuthError"></div>
          </form>
        </div>
      </div>
    `;
  }

  function gpSetNewCodeError(msg) {
    const el = document.getElementById("gpNewCodeErr");
    if (el) el.textContent = String(msg || "");
  }

  // --------------- expose on window ---------------
  window.GP_Identity = {
    gpMem,
    gpNormalizeName,
    gpNormalizeCode,
    gpRememberDefault,
    gpGetIdentityFromStorageOrMem,
    gpSetIdentity,
    gpClearIdentity,
    gpComputePlayerId,
    gpComputeCodeHash,
    gpIsIdentityValid,
    gpBuildIdentityGateHTML,
    gpSetIdentityError,
    gpBuildChangeCodeGateHTML,
    gpSetNewCodeError
  };

})();
