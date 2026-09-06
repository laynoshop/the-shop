/* split/gp-data.js
   =========================
   GROUP PICKS — Firebase / Firestore Data Layer
   Firebase ready check, Firestore CRUD for slates/picks,
   leaderboard computation, and the "Everyone's Picks" lazy-load + cache.
   Exposes all functions on window.GP_Data namespace.

   v2 fixes in gpComputeWeeklyLeaderboard:
   1. uid missing → fall back to name-based key so picks are never dropped.
   2. Odds parser now matches team abbreviation/name tokens (e.g. "PUR")
      so ESPN spread strings correctly resolve favSide.
   3. Score resolution: prefer __live (in-memory from ESPN), then fall back
      to finalHomeScore / finalAwayScore stored in Firestore by gp-espn.js
      after a game goes final. This fixes leaderboards for completed weeks.

   v3 fix: expose gpBustAllPicksCache so groupPicks.js can invalidate
      the allPicks cache immediately after a save, making everyone's picks
      appear as soon as the page re-renders after saving.
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

  // ─── leagues (pick'em groups) ────────────────────────────────────────
  // Unrelated to the *sport* leagueKey (nfl/cfb/nba) used elsewhere for the
  // ESPN scoreboard fetch — this is the "Work League" / "Family League" kind.
  async function gpGetLeague(db, leagueId) {
    if (!leagueId) return null;
    const snap = await db.collection("leagues").doc(String(leagueId)).get();
    return snap.exists ? { id: snap.id, ...(snap.data() || {}) } : null;
  }
  async function gpListLeagues(db) {
    const snap = await db.collection("leagues").get();
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...(d.data() || {}) }));
    list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    return list;
  }

  // ─── is a league "active" right now? ──────────────────────────────
  // Active = at least one published week, AND the season hasn't wrapped
  // up its configured final week yet.
  //   - No totalWeeks set, or still short of it → active (no extra reads).
  //   - At/past totalWeeks → only then check whether the most recently
  //     created week's games are all done, using scores already
  //     persisted to Firestore (no live ESPN calls from the picker).
  async function gpIsLeagueActive(db, league) {
    const weeks = Array.isArray(league?.weeks) ? league.weeks : [];
    const hasPublished = weeks.some(w => w?.published);
    if (!hasPublished) return false;

    const totalWeeks = Number(league?.totalWeeks) || 0;
    if (!totalWeeks) return true;

    const currentWeek = Number(league?.currentWeek) || 0;
    if (currentWeek < totalWeeks) return true;

    const finalWeekMeta = weeks[weeks.length - 1];
    if (!finalWeekMeta?.id) return true;

    let games = [];
    try { games = await gpGetSlateGames(db, finalWeekMeta.id); } catch { return true; }
    if (!games.length) return true;

    const allFinal = games.every(g => String(g?.finalState || "").toLowerCase() === "post");
    return !allFinal;
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

  // ─── slate doc (top-level fields: atsEventId, tiebreakerEventId, ...) ──
  async function gpGetSlateDoc(db, slateId) {
    if (!slateId) return {};
    const snap = await db.collection("pickSlates").doc(String(slateId)).get();
    return snap.exists ? (snap.data() || {}) : {};
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

  // ─── my picks parent doc (name, tiebreakerGuess, ...) ───────────────────
  async function gpGetMyPicksUserDoc(db, slateId, playerId) {
    if (!playerId) return {};
    const snap = await db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(playerId).get();
    return snap.exists ? (snap.data() || {}) : {};
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
  // tiebreakerGuess (optional): finite number → written onto the parent
  // picks/{playerId} doc alongside uid/name. Omit/undefined to leave as-is.
  async function gpSaveMyPicksBatch(db, slateId, playerId, pendingMap, tiebreakerGuess) {
    const keys = Object.keys(pendingMap || {});
    const hasTiebreaker = Number.isFinite(tiebreakerGuess);
    if (!keys.length && !hasTiebreaker) return;
    const picksUserRef = db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(playerId);
    const name  = String(getPicksDisplayName() || "Someone").trim().slice(0, 20);
    const batch = db.batch();
    const userDoc = {
      uid: String(playerId || ""),
      name,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (hasTiebreaker) {
      userDoc.tiebreakerGuess = Math.max(0, Math.min(200, Math.round(tiebreakerGuess)));
    }
    batch.set(picksUserRef, userDoc, { merge: true });
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

  // ─── bust the allPicks cache for a given week ───────────────────────
  // Call this immediately after a save so the next render fetches fresh data.
  function gpBustAllPicksCache(weekId) {
    const k = String(weekId || "").trim();
    if (!k) return;
    window.__GP_ALLPICKS_CACHE = window.__GP_ALLPICKS_CACHE || {};
    window.__GP_ALLPICKS_CACHE[k] = { ts: 0, data: null, promise: null };
    gpBustTiebreakersCache(k);
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

  // ─── everyone's tiebreaker guesses for a slate ──────────────────────
  // Reads only the (cheap) parent picks/{playerId} docs — no games subcollection fan-out.
  // Returns { [playerId]: { name, guess } } for players who submitted a guess.
  async function gpGetAllTiebreakersForSlate(db, slateId) {
    const out = {};
    const snap = await db.collection("pickSlates").doc(String(slateId)).collection("picks").get();
    snap.forEach(d => {
      const data  = d.data() || {};
      const guess = Number(data.tiebreakerGuess);
      if (!Number.isFinite(guess)) return;
      out[d.id] = { name: String(data.name || "Someone"), guess };
    });
    return out;
  }

  function gpGetTiebreakersCacheBucket(weekId) {
    window.__GP_TIEBREAKERS_CACHE = window.__GP_TIEBREAKERS_CACHE || {};
    const k = String(weekId || "");
    if (!window.__GP_TIEBREAKERS_CACHE[k]) window.__GP_TIEBREAKERS_CACHE[k] = { ts: 0, data: null, promise: null };
    return window.__GP_TIEBREAKERS_CACHE[k];
  }

  function gpBustTiebreakersCache(weekId) {
    const k = String(weekId || "").trim();
    if (!k) return;
    window.__GP_TIEBREAKERS_CACHE = window.__GP_TIEBREAKERS_CACHE || {};
    window.__GP_TIEBREAKERS_CACHE[k] = { ts: 0, data: null, promise: null };
  }

  async function gpEnsureTiebreakersForWeek(db, weekId) {
    const k = String(weekId || "").trim();
    if (!k) return {};
    const bucket = gpGetTiebreakersCacheBucket(k);
    const TTL    = 2 * 60 * 1000;
    const fresh  = bucket.data && bucket.ts && (Date.now() - bucket.ts) < TTL;
    if (fresh)          return bucket.data || {};
    if (bucket.promise) return bucket.promise;
    bucket.promise = (async () => {
      try {
        const data  = await gpGetAllTiebreakersForSlate(db, k);
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
  // gpGradeAtsForGame
  // Grades one game against its stored spread (spreadValue / spreadFavoredSide,
  // captured once by the admin at add-time — the line never moves after that,
  // so grading stays fair regardless of when the leaderboard is computed).
  // Returns { coverSide: "home"|"away"|"", pushed: bool, ok: bool }
  //   ok=false means there isn't enough data (no line, or no final score) to
  //   grade this game at all — callers should skip it rather than score it.
  // ──────────────────────────────────────────────────────────────
  function gpGradeAtsForGame(g) {
    const spreadValue = Number(g?.spreadValue);
    const favSide      = String(g?.spreadFavoredSide || "").toLowerCase();
    const liveHome     = g?.__live?.homeScore;
    const liveAway     = g?.__live?.awayScore;
    const homeNum      = Number(liveHome ?? g?.finalHomeScore ?? NaN);
    const awayNum      = Number(liveAway ?? g?.finalAwayScore ?? NaN);

    const ok = Number.isFinite(homeNum) && Number.isFinite(awayNum)
      && Number.isFinite(spreadValue) && spreadValue >= 0
      && (favSide === "home" || favSide === "away");
    if (!ok) return { coverSide: "", pushed: false, ok: false };

    let adjHome = homeNum, adjAway = awayNum;
    if (favSide === "home") adjHome -= spreadValue; else adjAway -= spreadValue;

    if (adjHome === adjAway) return { coverSide: "", pushed: true, ok: true };
    return { coverSide: adjHome > adjAway ? "home" : "away", pushed: false, ok: true };
  }

  // ──────────────────────────────────────────────────────────────
  // gpComputeStraightFavSide
  // Legacy straight-up "who's favored" detection, parsed from the odds text.
  // Only used in straight-up scoring mode for the underdog bonus.
  // ──────────────────────────────────────────────────────────────
  function gpComputeStraightFavSide(g) {
    // Prefer the clean structured field captured at add-time, when present.
    const structured = String(g?.spreadFavoredSide || "").toLowerCase();
    if (structured === "home" || structured === "away") return structured;

    let favSide = "";
    const oddsDetails = String(
      g?.__odds?.details || g?.oddsDetails || g?.odds?.details || ""
    ).trim();
    const oddsLower = oddsDetails.toLowerCase();
    const awayName  = String(g?.awayTeam?.name || g?.awayName || "").trim();
    const homeName  = String(g?.homeTeam?.name || g?.homeName || "").trim();
    const awayAbbr  = String(g?.awayTeam?.abbr || g?.awayTeam?.abbreviation || g?.awayAbbr || "").trim();
    const homeAbbr  = String(g?.homeTeam?.abbr || g?.homeTeam?.abbreviation || g?.homeAbbr || "").trim();

    if (oddsLower) {
      if      (oddsLower.startsWith("away")) favSide = "away";
      else if (oddsLower.startsWith("home")) favSide = "home";
      else {
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
    return favSide;
  }

  // ──────────────────────────────────────────────────────────────
  // gpComputeWeeklyLeaderboard(games, allPicks, opts)
  //   opts.atsEventId         eventId of the *one* game this week graded
  //                           against its spread — every other game is
  //                           always graded straight-up (a week can mix both)
  //   opts.tiebreakers        { [playerKey]: { name, guess } } — from gpGetAllTiebreakersForSlate
  //   opts.tiebreakerEventId  eventId of this week's designated tiebreaker game
  // ──────────────────────────────────────────────────────────────
  function gpComputeWeeklyLeaderboard(games, allPicks, opts) {
    const list  = Array.isArray(games)    ? games    : [];
    const picks = (allPicks && typeof allPicks === "object") ? allPicks : {};
    const atsEventId        = String(opts?.atsEventId || "").trim();
    const tiebreakers       = (opts && opts.tiebreakers && typeof opts.tiebreakers === "object") ? opts.tiebreakers : {};
    const tiebreakerEventId = String(opts?.tiebreakerEventId || "").trim();

    const finalGames = list.filter(g => {
      const liveState   = String(g?.__live?.state    || "").toLowerCase();
      const storedState = String(g?.finalState       || "").toLowerCase();
      return liveState === "post" || storedState === "post";
    });

    const finalsCount = finalGames.length;
    if (!finalsCount) return { rows: [], finalsCount: 0 };

    const gameResults = {};
    for (const g of finalGames) {
      const eventId = String(g?.eventId || g?.id || "");
      if (!eventId) continue;

      if (eventId === atsEventId) {
        const grade = gpGradeAtsForGame(g);
        if (!grade.ok) continue; // no usable line/score — don't score this game
        gameResults[eventId] = { winningSide: grade.pushed ? "" : grade.coverSide, favSide: "", isAts: true };
        continue;
      }

      const liveHome   = g?.__live?.homeScore;
      const liveAway   = g?.__live?.awayScore;
      const homeNum    = Number(liveHome ?? g?.finalHomeScore ?? NaN);
      const awayNum    = Number(liveAway ?? g?.finalAwayScore ?? NaN);

      let winningSide = "";
      if (Number.isFinite(homeNum) && Number.isFinite(awayNum)) {
        if      (awayNum > homeNum) winningSide = "away";
        else if (homeNum > awayNum) winningSide = "home";
        // equal scores → winningSide stays "" (tie)
      }

      gameResults[eventId] = { winningSide, favSide: gpComputeStraightFavSide(g), isAts: false };
    }

    // — tally scores per player —
    const players = new Map();

    for (const [eventId, result] of Object.entries(gameResults)) {
      const { winningSide, favSide, isAts } = result;
      const eventPicks = Array.isArray(picks[eventId]) ? picks[eventId] : [];

      for (const p of eventPicks) {
        const uidRaw = String(p?.uid  || "").trim();
        const name   = String(p?.name || "Someone").trim() || "Someone";
        const side   = String(p?.side || "").trim();
        const key    = uidRaw || `name:${name.toLowerCase()}`;
        if (!side) continue;

        if (!players.has(key)) {
          players.set(key, { key, name, points: 0, wins: 0, losses: 0, ties: 0, picks: 0, dogWins: 0, favWins: 0 });
        }
        const row = players.get(key);
        row.name = name;
        row.picks++;

        if (!winningSide) {
          // Tie / push — award 0.5 points
          row.ties++;
          row.points += 0.5;
        } else if (side === winningSide) {
          row.wins++;
          if (isAts) {
            row.points += 1;
          } else {
            const pickedUnderdog = !!favSide && side !== favSide;
            if (pickedUnderdog) {
              row.points  += 2;
              row.dogWins += 1;
            } else {
              row.points  += 1;
              row.favWins += 1;
            }
          }
        } else {
          row.losses++;
        }
      }
    }

    // — tiebreaker: combined-score guess closeness breaks ties in points+wins —
    let tiebreakerActual = null;
    if (tiebreakerEventId) {
      const tbGame = list.find(g => String(g?.eventId || g?.id || "") === tiebreakerEventId);
      if (tbGame) {
        const liveHome = tbGame?.__live?.homeScore;
        const liveAway = tbGame?.__live?.awayScore;
        const homeNum  = Number(liveHome ?? tbGame?.finalHomeScore ?? NaN);
        const awayNum  = Number(liveAway ?? tbGame?.finalAwayScore ?? NaN);
        const isFinal  = String(tbGame?.__live?.state || tbGame?.finalState || "").toLowerCase() === "post";
        if (isFinal && Number.isFinite(homeNum) && Number.isFinite(awayNum)) {
          tiebreakerActual = homeNum + awayNum;
        }
      }
    }
    function tiebreakerDiff(row) {
      const tb = tiebreakers[row.key];
      if (tiebreakerActual == null || !tb || !Number.isFinite(tb.guess)) return Infinity;
      return Math.abs(tb.guess - tiebreakerActual);
    }

    const rows = [...players.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins   !== a.wins)   return b.wins   - a.wins;
      if (tiebreakerActual != null) {
        const da = tiebreakerDiff(a), db_ = tiebreakerDiff(b);
        if (da !== db_) return da - db_;
      }
      return String(a.name).localeCompare(String(b.name));
    });

    return { rows, finalsCount, tiebreakerActual };
  }

  // ──────────────────────────────────────────────────────────────
  // gpComputeSeasonLeaderboard
  // Sums per-player points/record across an array of already-computed
  // weekly results: [{ weekId, weekLabel, rows, finalsCount }, ...]
  // ──────────────────────────────────────────────────────────────
  function gpComputeSeasonLeaderboard(weeklyResults) {
    const weeks = Array.isArray(weeklyResults) ? weeklyResults : [];
    const players = new Map();

    for (const wr of weeks) {
      const rows = Array.isArray(wr?.rows) ? wr.rows : [];
      for (const r of rows) {
        const key = r?.key || `name:${String(r?.name || "").toLowerCase()}`;
        if (!players.has(key)) {
          players.set(key, { key, name: r.name, points: 0, wins: 0, losses: 0, ties: 0, dogWins: 0, favWins: 0, weeksPlayed: 0 });
        }
        const acc = players.get(key);
        acc.name        = r.name || acc.name;
        acc.points     += Number(r.points  || 0);
        acc.wins       += Number(r.wins    || 0);
        acc.losses     += Number(r.losses  || 0);
        acc.ties       += Number(r.ties    || 0);
        acc.dogWins    += Number(r.dogWins || 0);
        acc.favWins    += Number(r.favWins || 0);
        acc.weeksPlayed += 1;
      }
    }

    const rows = [...players.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins   !== a.wins)   return b.wins   - a.wins;
      return String(a.name).localeCompare(String(b.name));
    });

    return { rows, weeksCount: weeks.length };
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
    gpGetLeague,
    gpListLeagues,
    gpIsLeagueActive,
    gpGetSlateDoc,
    gpGetSlateGames,
    gpGetMyPicksMap,
    gpGetMyPicksUserDoc,
    gpGetAllPicksForSlate,
    gpSaveMyPicksBatch,
    gpGetAllPicksCacheBucket,
    gpBustAllPicksCache,
    gpEnsureAllPicksForWeek,
    gpGetAllTiebreakersForSlate,
    gpEnsureTiebreakersForWeek,
    gpBustTiebreakersCache,
    gpComputeWeeklyLeaderboard,
    gpComputeSeasonLeaderboard,
    gpGradeAtsForGame,
  };

  window.ensureFirebaseReadySafe = ensureFirebaseReadySafe;

})();
