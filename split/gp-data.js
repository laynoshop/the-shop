/* split/gp-data.js
   =========================
   GROUP PICKS — Firebase / Firestore Data Layer
   Firebase ready check, Firestore CRUD for slates/picks,
   leaderboard computation, and the "Everyone's Picks" lazy-load + cache.
   Exposes all functions on window.GP_Data namespace.
*/

(function () {
  "use strict";

  // ─── safe localStorage helpers ──────────────────────────────────
  function safeGetLS(key) {
    try { return String(localStorage.getItem(key) || ""); } catch { return ""; }
  }
  function safeSetLS(key, val) {
    try { localStorage.setItem(key, String(val)); } catch {}
  }

  const PICKS_NAME_KEY   = "theShopPicksName_v1";
  const META_PUBLIC_DOC  = "public";

  // ─── Firebase ready ───────────────────────────────────────────────
  async function ensureFirebaseReadySafe() {
    if (typeof window.ensureFirebaseChatReady === "function") {
      await window.ensureFirebaseChatReady();
      const u = firebase.auth().currentUser;
      if (!u) throw new Error("Auth not ready (no currentUser).");
      return;
    }

    if (window.firebase && window.FIREBASE_CONFIG && (!firebase.apps || !firebase.apps.length)) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    const auth = firebase.auth();
    try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch {}

    const waitForAuthOnce = (timeoutMs = 1500) =>
      new Promise((resolve) => {
        let done = false;
        const t = setTimeout(() => {
          if (done) return;
          done = true;
          try { unsub && unsub(); } catch {}
          resolve();
        }, timeoutMs);
        let unsub = null;
        try {
          unsub = auth.onAuthStateChanged(() => {
            if (done) return;
            done = true;
            clearTimeout(t);
            try { unsub && unsub(); } catch {}
            resolve();
          });
        } catch {
          clearTimeout(t);
          resolve();
        }
      });

    await waitForAuthOnce();
    if (!auth.currentUser) {
      await auth.signInAnonymously();
      await waitForAuthOnce();
    }
    if (!auth.currentUser) throw new Error("Auth not ready (anonymous user missing).");
  }

  // ─── display name helper ─────────────────────────────────────────
  function getPicksDisplayName() {
    const existingChat = (safeGetLS("theShopChatName_v1") || "").trim();
    if (existingChat) return existingChat.slice(0, 20);
    let name = (safeGetLS(PICKS_NAME_KEY) || "").trim();
    if (!name) name = "Anon";
    return String(name).trim().slice(0, 20);
  }

  // ─── Firestore refs ────────────────────────────────────────────────
  function metaRef(db, docId) {
    return db.collection("pickSlatesMeta").doc(String(docId));
  }
  async function gpGetMetaPublic(db) {
    const snap = await metaRef(db, META_PUBLIC_DOC).get();
    return snap.exists ? (snap.data() || {}) : {};
  }

  // ─── slate games ─────────────────────────────────────────────────────
  async function gpGetSlateGames(db, slateId) {
    const snap = await db.collection("pickSlates").doc(slateId).collection("games").get();
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => {
      const at = a?.startTime?.toMillis ? a.startTime.toMillis() : 0;
      const bt = b?.startTime?.toMillis ? b.startTime.toMillis() : 0;
      return at - bt;
    });
    return list;
  }

  // ─── my picks ──────────────────────────────────────────────────────────
  async function gpGetMyPicksMap(db, slateId, playerId) {
    if (!playerId) return {};
    const snap = await db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(playerId)
      .collection("games").get();
    const map = {};
    snap.forEach(d => map[d.id] = d.data());
    return map;
  }

  // ─── all picks for slate ────────────────────────────────────────────
  async function gpGetAllPicksForSlate(db, slateId) {
    const out = {};
    const usersSnap = await db.collection("pickSlates").doc(slateId).collection("picks").get();
    const userDocs  = usersSnap.docs || [];
    for (const u of userDocs) {
      const playerId  = u.id;
      const gamesSnap = await db.collection("pickSlates").doc(slateId)
        .collection("picks").doc(playerId)
        .collection("games").get();
      gamesSnap.forEach(d => {
        const eventId = d.id;
        const data    = d.data() || {};
        const name    = String(data.name || (u.data()?.name || "Someone"));
        const side    = String(data.side || "");
        if (!out[eventId]) out[eventId] = [];
        out[eventId].push({ uid: playerId, name, side });
      });
    }
    Object.keys(out).forEach(eventId => {
      out[eventId].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    });
    return out;
  }

  // ─── save picks (batch write) ────────────────────────────────────────
  async function gpSaveMyPicksBatch(db, slateId, playerId, pendingMap) {
    const keys = Object.keys(pendingMap || {});
    if (!keys.length) return;
    const picksUserRef = db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(playerId);
    const name  = String(getPicksDisplayName() || "Someone").trim().slice(0, 20);
    const batch = db.batch();
    batch.set(picksUserRef, {
      uid: String(playerId || ""),
      name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    for (const eventId of keys) {
      const side    = String(pendingMap[eventId] || "");
      const gameRef = picksUserRef.collection("games").doc(String(eventId));
      batch.set(gameRef, {
        uid:       String(playerId || ""),
        name,
        side,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }

  // ─── everyone's picks cache ─────────────────────────────────────────
  function gpGetAllPicksCacheBucket(weekId) {
    window.__GP_ALLPICKS_CACHE = window.__GP_ALLPICKS_CACHE || {};
    const k = String(weekId || "");
    if (!window.__GP_ALLPICKS_CACHE[k]) window.__GP_ALLPICKS_CACHE[k] = { ts: 0, data: null, promise: null };
    return window.__GP_ALLPICKS_CACHE[k];
  }

  async function gpEnsureAllPicksForWeek(db, weekId) {
    const k = String(weekId || "").trim();
    if (!k) return {};
    const bucket = gpGetAllPicksCacheBucket(k);
    const TTL    = 2 * 60 * 1000;
    const fresh  = bucket.data && bucket.ts && (Date.now() - bucket.ts) < TTL;
    if (fresh)          return bucket.data || {};
    if (bucket.promise) return bucket.promise;
    bucket.promise = (async () => {
      try {
        const data  = await gpGetAllPicksForSlate(db, k);
        bucket.data = data || {};
        bucket.ts   = Date.now();
        return bucket.data;
      } finally {
        bucket.promise = null;
      }
    })();
    return bucket.promise;
  }

  // ──────────────────────────────────────────────────────────────
  // gpComputeWeeklyLeaderboard
  //
  // Computes standings for a slate given:
  //   games     — array of game objects (with __live or live for score state)
  //   allPicks  — { [eventId]: [ { uid, name, side } ] }
  //
  // Scoring:
  //   +2 pts for a correct underdog pick  (pick matched the team NOT favored)
  //   +1 pt  for a correct favored pick   (pick matched the favored team)
  //   Favorite is inferred from the spread stored in g.__odds / g.oddsDetails.
  //   Handles ESPN-style odds strings like "PUR -5.5" by matching team
  //   name and abbreviation tokens, not just "away"/"home" prefixes.
  //   If odds data is unavailable, all correct picks = +1 pt.
  //
  // Bug fixes (v2):
  //   1. uid missing → fall back to name-based key so picks are never dropped.
  //   2. Odds parser now matches team abbreviation/name tokens (e.g. "PUR")
  //      so ESPN spread strings correctly resolve favSide.
  //
  // Each row in `rows` includes:
  //   { name, points, wins, losses, picks, dogWins, favWins }
  //
  // Returns: { rows: [...], finalsCount: N }
  //   rows sorted descending by points, then wins, then name
  // ──────────────────────────────────────────────────────────────
  function gpComputeWeeklyLeaderboard(games, allPicks) {
    const list  = Array.isArray(games)    ? games    : [];
    const picks = (allPicks && typeof allPicks === "object") ? allPicks : {};

    // — identify games that have gone final —
    const finalGames = list.filter(g => {
      const live  = g?.__live || g?.live || null;
      const state = String(live?.state || "").toLowerCase();
      return state === "post";
    });

    const finalsCount = finalGames.length;
    if (!finalsCount) return { rows: [], finalsCount: 0 };

    // — build a lookup: eventId → { winningSide, favSide } —
    const gameResults = {};
    for (const g of finalGames) {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) continue;

      const live    = g?.__live || g?.live || null;
      const awayNum = Number(live?.awayScore ?? NaN);
      const homeNum = Number(live?.homeScore ?? NaN);

      let winningSide = "";
      if (Number.isFinite(awayNum) && Number.isFinite(homeNum)) {
        if      (awayNum > homeNum) winningSide = "away";
        else if (homeNum > awayNum) winningSide = "home";
      }

      // — resolve which side is favored from the odds string —
      let favSide = "";
      const oddsDetails = String(
        g?.__odds?.details || g?.oddsDetails || g?.odds?.details || ""
      ).trim();
      const oddsLower = oddsDetails.toLowerCase();
      const awayName  = String(g?.awayTeam?.name || g?.awayName || "").trim();
      const homeName  = String(g?.homeTeam?.name || g?.homeName || "").trim();
      const awayAbbr  = String(g?.awayTeam?.abbreviation || g?.awayAbbr || "").trim();
      const homeAbbr  = String(g?.homeTeam?.abbreviation || g?.homeAbbr || "").trim();

      if (oddsLower) {
        if      (oddsLower.startsWith("away")) favSide = "away";
        else if (oddsLower.startsWith("home")) favSide = "home";
        else {
          // Match ESPN-style strings like "PUR -5.5" or "Ohio State -3"
          // by testing each team's abbreviation and full name as word tokens.
          const candidates = [
            { side: "away", tokens: [awayAbbr, awayName] },
            { side: "home", tokens: [homeAbbr, homeName] },
          ];
          outer:
          for (const c of candidates) {
            for (const rawToken of c.tokens) {
              const token = String(rawToken || "").trim();
              if (!token) continue;
              const escaped = token.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
              if (re.test(oddsLower)) {
                favSide = c.side;
                break outer;
              }
            }
          }
        }
      }

      gameResults[eventId] = { winningSide, favSide };
    }

    // — tally scores per player —
    // FIX: use uid when present; fall back to name-based key so picks
    // saved before uid was written to the doc are never silently dropped.
    const players = new Map();

    for (const [eventId, result] of Object.entries(gameResults)) {
      const { winningSide, favSide } = result;
      const eventPicks = Array.isArray(picks[eventId]) ? picks[eventId] : [];

      for (const p of eventPicks) {
        const uidRaw = String(p?.uid  || "").trim();
        const name   = String(p?.name || "Someone").trim() || "Someone";
        const side   = String(p?.side || "").trim();
        const key    = uidRaw || `name:${name.toLowerCase()}`;
        if (!side) continue;

        if (!players.has(key)) {
          players.set(key, { name, points: 0, wins: 0, losses: 0, picks: 0, dogWins: 0, favWins: 0 });
        }
        const row = players.get(key);
        row.name = name; // keep name current
        row.picks++;

        if (!winningSide) continue; // tie — no points

        if (side === winningSide) {
          row.wins++;
          const pickedUnderdog = !!favSide && side !== favSide;
          if (pickedUnderdog) {
            row.points  += 2;
            row.dogWins += 1;
          } else {
            row.points  += 1;
            row.favWins += 1;
          }
        } else {
          row.losses++;
        }
      }
    }

    // — sort and return —
    const rows = [...players.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins   !== a.wins)   return b.wins   - a.wins;
      return String(a.name).localeCompare(String(b.name));
    });

    return { rows, finalsCount };
  }

  // ─── everyone's picks lazy-load toggle listener ───────────────────
  function esc(s) {
    if (typeof window.escapeHtml === "function") return window.escapeHtml(s);
    return String(s ?? "")
      .replace(/&/g,  "&amp;").replace(/</g, "&lt;")
      .replace(/>/g,  "&gt;")
      .replace(/"/g,  "&quot;")
      .replace(/'/g,  "&#39;");
  }

  function gpBuildEveryoneLinesForEvent({ everyoneArr, awayName, homeName }) {
    const arr = Array.isArray(everyoneArr) ? everyoneArr : [];
    if (!arr.length) return `<div class="muted">No picks yet.</div>`;
    return arr.map(p => {
      const nm   = String(p?.name || "Someone");
      const side = String(p?.side || "");
      const team = side === "away" ? (awayName || "—") : side === "home" ? (homeName || "—") : "—";
      return `<div class="gpPickLine"><b>${esc(nm)}:</b> ${esc(team)}</div>`;
    }).join("");
  }

  if (!window.__GP_EVERYONE_TOGGLE_BOUND) {
    window.__GP_EVERYONE_TOGGLE_BOUND = true;
    document.addEventListener("toggle", (e) => {
      const details = e.target;
      if (!details || details.tagName !== "DETAILS") return;
      if (details.getAttribute("data-gpeveryone") !== "1") return;
      if (!details.open) return;
      (async () => {
        try {
          const weekId  = String(details.getAttribute("data-weekid") || "").trim();
          const eventId = String(details.getAttribute("data-eid")    || "").trim();
          if (!weekId || !eventId) return;
          const bodyId = `gpEveryone_${weekId}_${eventId}`;
          const bodyEl = document.getElementById(bodyId);
          if (!bodyEl) return;
          if (bodyEl.getAttribute("data-loaded") === "1") return;
          bodyEl.innerHTML = `<div class="muted">Loading&#x2026;</div>`;
          await ensureFirebaseReadySafe();
          const db  = firebase.firestore();
          const all = await gpEnsureAllPicksForWeek(db, weekId);
          const everyoneArr = Array.isArray(all?.[eventId]) ? all[eventId] : [];
          const awayName = String(details.getAttribute("data-away") || "Away");
          const homeName = String(details.getAttribute("data-home") || "Home");
          bodyEl.innerHTML = gpBuildEveryoneLinesForEvent({ everyoneArr, awayName, homeName });
          bodyEl.setAttribute("data-loaded", "1");
        } catch (err) {
          console.error("Everyone's Picks lazy-load error:", err);
          try {
            const det2    = e.target;
            const weekId  = String(det2?.getAttribute("data-weekid") || "").trim();
            const eventId = String(det2?.getAttribute("data-eid")    || "").trim();
            const bodyEl  = document.getElementById(`gpEveryone_${weekId}_${eventId}`);
            if (bodyEl) bodyEl.innerHTML = `<div class="muted">Couldn't load picks.</div>`;
          } catch {}
        }
      })();
    }, true);
  }

  // ─── expose on window ──────────────────────────────────────────────────
  window.GP_Data = {
    ensureFirebaseReadySafe,
    getPicksDisplayName,
    metaRef,
    gpGetMetaPublic,
    gpGetSlateGames,
    gpGetMyPicksMap,
    gpGetAllPicksForSlate,
    gpSaveMyPicksBatch,
    gpGetAllPicksCacheBucket,
    gpEnsureAllPicksForWeek,
    gpComputeWeeklyLeaderboard,
  };

  // Also expose ensureFirebaseReadySafe at top level for back-compat
  window.ensureFirebaseReadySafe = ensureFirebaseReadySafe;

})();
