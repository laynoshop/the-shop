// split/groupPicks.js
// GROUP PICKS ONLY (no units picks).
// Admin builds/publishes slate. Everyone makes picks. Locks at game start.
// Exports: window.renderPicks(showLoading)

(function () {
  "use strict";

  // -------------------------
  // Tiny shared fallbacks
  // -------------------------
  const escapeHtml =
    typeof window.escapeHtml === "function"
      ? window.escapeHtml
      : (s) =>
          String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

  const norm =
    typeof window.norm === "function"
      ? window.norm
      : (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

  function safeGet(key, fallback = "") {
    try { return String(localStorage.getItem(key) ?? fallback); } catch { return String(fallback); }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }

  // -------------------------
  // Config / constants
  // -------------------------
  const PICKS_NAME_KEY = "theShopPicksName_v1";

  // Firestore layout:
  // pickSlates/{slateId}
  //  - leagueKey, dateYYYYMMDD, published, updatedAt, createdByUid, createdByName
  // pickSlates/{slateId}/games/{eventId}
  //  - eventId, homeName, awayName, startTime (Timestamp), createdAt
  // pickSlates/{slateId}/picks/{uid}
  //  - name, updatedAt
  // pickSlates/{slateId}/picks/{uid}/games/{eventId}
  //  - side ("home"|"away"), ts (Timestamp)

  // -------------------------
  // Firebase readiness
  // -------------------------
  async function ensureFirebaseReady() {
    // If your shop.js already defines ensureFirebaseChatReady, use it.
    if (typeof window.ensureFirebaseChatReady === "function") {
      await window.ensureFirebaseChatReady();
      return;
    }

    // Otherwise do a minimal init here (safe + idempotent).
    if (!window.firebase || !firebase.initializeApp) {
      throw new Error("Firebase SDK missing");
    }

    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) throw new Error("Missing FIREBASE_CONFIG");

    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(cfg);
    } catch {}

    try {
      const auth = firebase.auth();
      const user = auth.currentUser;
      if (!user) {
        // anonymous auth keeps it simple
        await auth.signInAnonymously();
      }
    } catch (e) {
      // If anonymous auth disabled, user must already be signed in elsewhere
      // We'll continue; Firestore calls may fail and we will show the error.
    }
  }

  function getDb() {
    return firebase.firestore();
  }

  function getUid() {
    try { return firebase.auth().currentUser?.uid || ""; } catch { return ""; }
  }

  // -------------------------
  // Role + display name
  // -------------------------
  function getRoleSafe() {
    if (typeof window.getRole === "function") return window.getRole();
    const r = safeGet("theShopRole_v1", "guest").trim();
    return (r === "admin" || r === "guest") ? r : "guest";
  }

  function getPicksDisplayName() {
    // Prefer chat name if it exists (your earlier behavior)
    const existingChat = (safeGet("shopChatName", "") || "").trim();
    if (existingChat) return existingChat.slice(0, 20);

    let name = (safeGet(PICKS_NAME_KEY, "") || "").trim();
    if (!name) {
      name = (prompt("Name for Picks (example: Victor):", "") || "").trim();
      if (!name) name = "Anon";
      safeSet(PICKS_NAME_KEY, name.slice(0, 20));
    }
    return name.slice(0, 20);
  }

  // -------------------------
  // Date/league helpers (from your shared/scores)
  // -------------------------
  function getSavedLeagueKeySafe() {
    if (typeof window.getSavedLeagueKey === "function") return window.getSavedLeagueKey();
    return safeGet("theShopLeagueKey_v1", "ncaaf").trim() || "ncaaf";
  }

  function getSavedDateYYYYMMDDSafe() {
    if (typeof window.getSavedDateYYYYMMDD === "function") return window.getSavedDateYYYYMMDD();
    return safeGet("theShopDateYYYYMMDD_v1", "").trim();
  }

  function yyyymmddToPrettySafe(v) {
    if (typeof window.yyyymmddToPretty === "function") return window.yyyymmddToPretty(v);
    return String(v || "");
  }

  function buildLeagueSelectHTMLSafe(k) {
    if (typeof window.buildLeagueSelectHTML === "function") return window.buildLeagueSelectHTML(k);
    return "";
  }

  function buildCalendarButtonHTMLSafe() {
    if (typeof window.buildCalendarButtonHTML === "function") return window.buildCalendarButtonHTML();
    return "";
  }

  function getLeagueByKeySafe(k) {
    if (typeof window.getLeagueByKey === "function") return window.getLeagueByKey(k);
    return null;
  }

  // -------------------------
  // Slate ID
  // -------------------------
  function slateIdFor(leagueKey, dateYYYYMMDD) {
    return `${String(leagueKey || "").trim()}__${String(dateYYYYMMDD || "").trim()}`;
  }

  function fmtKickoff(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function kickoffMsFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const iso = ev?.date || comp?.date || "";
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  function getMatchupNamesFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");

    const homeName =
      (typeof window.getTeamDisplayNameUI === "function" && home?.team)
        ? window.getTeamDisplayNameUI(home.team)
        : (home?.team?.displayName || "Home");

    const awayName =
      (typeof window.getTeamDisplayNameUI === "function" && away?.team)
        ? window.getTeamDisplayNameUI(away.team)
        : (away?.team?.displayName || "Away");

    const iso = ev?.date || comp?.date || "";
    return { homeName, awayName, iso };
  }

  // -------------------------
  // Firestore reads/writes
  // -------------------------
  async function gpGetPublishedSlate(db, leagueKey, dateYYYYMMDD) {
    const q = db.collection("pickSlates")
      .where("leagueKey", "==", leagueKey)
      .where("dateYYYYMMDD", "==", dateYYYYMMDD)
      .where("published", "==", true)
      .limit(1);

    const snap = await q.get();
    if (snap.empty) return null;
    const doc0 = snap.docs[0];
    return { id: doc0.id, ...doc0.data() };
  }

  async function gpGetSlateById(db, slateId) {
    const ref = db.collection("pickSlates").doc(slateId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  }

  async function gpGetSlateGames(db, slateId) {
    const snap = await db.collection("pickSlates").doc(slateId).collection("games").get();
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));

    list.sort((a, b) => {
      const at = a?.startTime?.toMillis ? a.startTime.toMillis() : 0;
      const bt = b?.startTime?.toMillis ? b.startTime.toMillis() : 0;
      return at - bt;
    });

    return list;
  }

  async function gpGetMyPicksMap(db, slateId, uid) {
    if (!uid) return {};
    const snap = await db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(uid)
      .collection("games")
      .get();

    const map = {};
    snap.forEach((d) => map[d.id] = d.data());
    return map;
  }

  async function gpSaveMyPick(db, slateId, uid, name, eventId, side) {
    const picksRoot = db.collection("pickSlates").doc(slateId).collection("picks").doc(uid);
    await picksRoot.set(
      { name: String(name || "Anon").slice(0, 20), updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    const ref = picksRoot.collection("games").doc(eventId);
    await ref.set(
      { side, ts: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  async function gpCreateOrReplaceSlate(db, leagueKey, dateYYYYMMDD, events, selectedEventIds) {
    const sid = slateIdFor(leagueKey, dateYYYYMMDD);
    const ref = db.collection("pickSlates").doc(sid);

    const uid = getUid();
    const name = getPicksDisplayName();

    // Upsert slate doc (unpublished on rebuild)
    await ref.set({
      leagueKey,
      dateYYYYMMDD,
      published: false,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdByUid: uid || "",
      createdByName: name || "Anon"
    }, { merge: true });

    // Replace games subcollection
    const gamesRef = ref.collection("games");
    const existing = await gamesRef.get();
    const batchDel = db.batch();
    existing.forEach((doc) => batchDel.delete(doc.ref));
    await batchDel.commit();

    // Add selected games
    const selected = new Set(selectedEventIds);
    const batch = db.batch();

    for (const ev of (events || [])) {
      const eventId = String(ev?.id || "");
      if (!eventId || !selected.has(eventId)) continue;

      const { homeName, awayName, iso } = getMatchupNamesFromEvent(ev);
      const startMs = kickoffMsFromEvent(ev);

      batch.set(gamesRef.doc(eventId), {
        eventId,
        homeName: String(homeName || "Home"),
        awayName: String(awayName || "Away"),
        startTime: startMs ? firebase.firestore.Timestamp.fromMillis(startMs) : null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
    return sid;
  }

  async function gpPublishSlate(db, slateId) {
    const ref = db.collection("pickSlates").doc(slateId);
    await ref.set({
      published: true,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // -------------------------
  // HTML builders (matches your style classes)
  // -------------------------
  function gpBuildAdminSlateHTML(events, leagueKey, dateYYYYMMDD) {
    const rows = (events || []).map((ev) => {
      const eventId = String(ev?.id || "");
      if (!eventId) return "";
      const { homeName, awayName, iso } = getMatchupNamesFromEvent(ev);

      return `
        <div class="gpAdminRow">
          <label class="gpAdminLabel">
            <input type="checkbox" checked data-gpcheck="1" data-eid="${escapeHtml(eventId)}" />
            <span class="gpAdminText">${escapeHtml(awayName)} @ ${escapeHtml(homeName)}</span>
            <span class="muted gpAdminTime">${escapeHtml(fmtKickoff(iso))}</span>
          </label>
        </div>
      `;
    }).join("");

    return `
      <div class="game">
        <div class="gameHeader">
          <div class="statusPill status-other">ADMIN: SLATE BUILDER</div>
        </div>
        <div class="gameMetaTopLine">${escapeHtml(String(leagueKey || "").toUpperCase())} • ${escapeHtml(dateYYYYMMDD)}</div>
        <div class="gameMetaOddsLine">Select games, then Create/Replace, then Publish</div>

        <div style="margin-top:8px;">
          ${rows || `<div class="notice">No games to build a slate from.</div>`}
        </div>

        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="smallBtn" data-gpadmin="create" data-league="${escapeHtml(leagueKey)}" data-date="${escapeHtml(dateYYYYMMDD)}">Create/Replace Slate</button>
          <button class="smallBtn" data-gpadmin="publish" data-league="${escapeHtml(leagueKey)}" data-date="${escapeHtml(dateYYYYMMDD)}">Publish Slate</button>
        </div>

        <div class="muted" id="gpAdminStatus" style="margin-top:8px;"></div>
      </div>
    `;
  }

  function gpBuildGroupPicksCardHTML({ slateId, games, myMap, published }) {
    if (!published) {
      return `
        <div class="game">
          <div class="gameHeader">
            <div class="statusPill status-other">GROUP PICKS</div>
          </div>
          <div class="gameMetaTopLine">No slate published yet</div>
          <div class="gameMetaOddsLine">Waiting on admin.</div>
        </div>
      `;
    }

    const rows = (games || []).map((g) => {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) return "";

      const homeName = String(g?.homeName || "Home");
      const awayName = String(g?.awayName || "Away");

      const startMs = g?.startTime?.toMillis ? g.startTime.toMillis() : 0;
      const locked = startMs ? (Date.now() >= startMs) : false;

      const my = myMap?.[eventId]?.side || "";

      return `
        <div class="gpGameRow">
          <div class="gpMatchup">
            <div class="gpTeams">${escapeHtml(awayName)} @ ${escapeHtml(homeName)}</div>
            <div class="muted">
              ${startMs ? new Date(startMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"}
              ${locked ? " • LOCKED" : ""}
            </div>
          </div>

          <div class="gpButtons">
            <button class="gpBtn ${my === "away" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
              data-gppick="away" data-slate="${escapeHtml(slateId)}" data-eid="${escapeHtml(eventId)}">
              ${escapeHtml(awayName)}
            </button>

            <button class="gpBtn ${my === "home" ? "gpBtnActive" : ""}" ${locked ? "disabled" : ""}
              data-gppick="home" data-slate="${escapeHtml(slateId)}" data-eid="${escapeHtml(eventId)}">
              ${escapeHtml(homeName)}
            </button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="game">
        <div class="gameHeader">
          <div class="statusPill status-other">GROUP PICKS</div>
        </div>
        <div class="gameMetaTopLine">Slate is live</div>
        <div class="gameMetaOddsLine">Picks lock at game start</div>
        ${rows || `<div class="notice">No games in slate.</div>`}
      </div>
    `;
  }

  function renderPicksHeaderHTML(rightLabel) {
    const selectedDate = getSavedDateYYYYMMDDSafe();
    const prettyDate = yyyymmddToPrettySafe(selectedDate);
    const selectedKey = getSavedLeagueKeySafe();

    return `
      <div class="header">
        <div class="headerTop">
          <div class="brand">
            <h2 style="margin:0;">Picks</h2>
            <span class="badge">Group</span>
          </div>

          <div class="headerActions">
            <button class="smallBtn" data-gpaction="refresh">Refresh</button>
          </div>
        </div>

        <div class="subline">
          <div class="sublineLeft">
            ${buildLeagueSelectHTMLSafe(selectedKey)}
            ${buildCalendarButtonHTMLSafe()}
          </div>
          <div>${escapeHtml(prettyDate)} • ${escapeHtml(rightLabel || "")}</div>
        </div>
      </div>
    `;
  }

  // -------------------------
  // Main render
  // -------------------------
  async function renderPicks(showLoading) {
    const content = document.getElementById("content");
    if (!content) return;

    const selectedDate = getSavedDateYYYYMMDDSafe();
    const selectedKey = getSavedLeagueKeySafe();
    const league = getLeagueByKeySafe(selectedKey);

    if (showLoading) {
      content.innerHTML = `
        ${renderPicksHeaderHTML("Loading…")}
        <div class="notice">Loading picks…</div>
      `;
    }

    try {
      await ensureFirebaseReady();
      const db = getDb();
      const uid = getUid();
      const role = getRoleSafe();
      const myName = getPicksDisplayName();

      const nowLabel = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

      // 1) Load published slate (if any)
      const publishedSlate = await gpGetPublishedSlate(db, selectedKey, selectedDate);

      // 2) If admin, also load ESPN games for slate-builder UI
      let adminHTML = "";
      let scoreboardEvents = [];

      if (role === "admin") {
        if (league && typeof window.fetchScoreboardWithFallbacks === "function") {
          const result = await window.fetchScoreboardWithFallbacks(league, selectedDate);
          scoreboardEvents = Array.isArray(result?.events) ? result.events : [];
        }
        adminHTML = gpBuildAdminSlateHTML(scoreboardEvents, selectedKey, selectedDate);
      }

      // 3) Build group picks card
      let picksCardHTML = "";
      if (!publishedSlate) {
        picksCardHTML = gpBuildGroupPicksCardHTML({
          slateId: "",
          games: [],
          myMap: {},
          published: false
        });
      } else {
        const slateId = String(publishedSlate.id || "");
        const games = await gpGetSlateGames(db, slateId);
        const myMap = await gpGetMyPicksMap(db, slateId, uid);
        picksCardHTML = gpBuildGroupPicksCardHTML({
          slateId,
          games,
          myMap,
          published: true
        });
      }

      content.innerHTML = `
        ${renderPicksHeaderHTML(`Updated ${nowLabel}`)}
        ${adminHTML}
        ${picksCardHTML}
      `;

      // TTUN enforcement (if you use it globally)
      setTimeout(() => { try { window.replaceMichiganText && window.replaceMichiganText(content); } catch {} }, 0);

      // Store latest scoreboard events for admin actions (so we don’t refetch on button click)
      window.__GP_LAST_EVENTS = scoreboardEvents;
      window.__GP_LAST_LEAGUE = selectedKey;
      window.__GP_LAST_DATE = selectedDate;
      window.__GP_LAST_NAME = myName;

    } catch (err) {
      console.error("renderPicks failed:", err);
      content.innerHTML = `
        ${renderPicksHeaderHTML("Error")}
        <div class="notice">Couldn’t load Picks right now.</div>
      `;
    }
  }

  // Export for shared router
  window.renderPicks = renderPicks;

  // -------------------------
  // Click handlers (ONE-TIME bind)
  // -------------------------
  if (!window.__GP_BOUND) {
    window.__GP_BOUND = true;

    document.addEventListener("click", async (e) => {
      const btn = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;

      // Refresh
      if (btn.dataset.gpaction === "refresh") {
        renderPicks(true);
        return;
      }

      // Admin actions
      if (btn.dataset.gpadmin) {
        const action = btn.dataset.gpadmin;
        const leagueKey = btn.dataset.league || getSavedLeagueKeySafe();
        const dateYYYYMMDD = btn.dataset.date || getSavedDateYYYYMMDDSafe();

        const statusEl = document.getElementById("gpAdminStatus");
        const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

        try {
          if (getRoleSafe() !== "admin") return;

          await ensureFirebaseReady();
          const db = getDb();

          // Collect checked event IDs
          const checks = Array.from(document.querySelectorAll('input[type="checkbox"][data-gpcheck="1"]'));
          const selectedIds = checks.filter(c => c.checked).map(c => String(c.getAttribute("data-eid") || "")).filter(Boolean);

          if (action === "create") {
            if (!selectedIds.length) {
              setStatus("Select at least one game.");
              return;
            }
            setStatus("Creating slate…");

            const events = Array.isArray(window.__GP_LAST_EVENTS) ? window.__GP_LAST_EVENTS : [];
            const sid = await gpCreateOrReplaceSlate(db, leagueKey, dateYYYYMMDD, events, selectedIds);

            setStatus(`Slate created: ${sid}`);
            // re-render to reflect unpublished state still
            renderPicks(false);
            return;
          }

          if (action === "publish") {
            const sid = slateIdFor(leagueKey, dateYYYYMMDD);
            setStatus("Publishing slate…");
            await gpPublishSlate(db, sid);
            setStatus("Slate published ✅");
            renderPicks(false);
            return;
          }
        } catch (err) {
          console.error("gp admin action failed:", err);
          try {
            const statusEl = document.getElementById("gpAdminStatus");
            if (statusEl) statusEl.textContent = "Admin action failed (check console/rules).";
          } catch {}
        }
        return;
      }

      // User pick actions
      const side = btn.dataset.gppick;
      if (side === "home" || side === "away") {
        const slateId = String(btn.dataset.slate || "");
        const eventId = String(btn.dataset.eid || "");
        if (!slateId || !eventId) return;

        try {
          await ensureFirebaseReady();
          const db = getDb();
          const uid = getUid();
          if (!uid) {
            alert("Not signed in.");
            return;
          }

          // lock check: find start time from DOM (if present) OR re-check slate game doc
          // UI already disabled buttons when locked, but we add a safety check:
          const slate = await gpGetSlateById(db, slateId);
          if (!slate || !slate.published) {
            alert("Slate is not published.");
            return;
          }

          const gameDoc = await db.collection("pickSlates").doc(slateId).collection("games").doc(eventId).get();
          if (gameDoc.exists) {
            const startTime = gameDoc.data()?.startTime;
            const startMs = startTime?.toMillis ? startTime.toMillis() : 0;
            if (startMs && Date.now() >= startMs) {
              alert("This game is locked.");
              return;
            }
          }

          const name = (window.__GP_LAST_NAME || getPicksDisplayName());
          await gpSaveMyPick(db, slateId, uid, name, eventId, side);

          // Re-render to highlight selection
          renderPicks(false);
        } catch (err) {
          console.error("save pick failed:", err);
          alert("Could not save pick (check Firebase rules).");
        }
        return;
      }
    });
  }

})();