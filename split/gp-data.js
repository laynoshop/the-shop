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

  // ─── player registry ─────────────────────────────────────────────
  // A lightweight global record of everyone who has ever completed the
  // name+code identity screen (see gp-identity.js's playerContinue),
  // keyed by their computed playerId. Lets admins build an H2H roster
  // by picking from known players instead of retyping names by hand.
  // Not an accounts system — anyone can still enter any name+code, this
  // just remembers the names that have actually been used before.
  async function gpRegisterPlayer(db, playerId, name) {
    const pid = String(playerId || "").trim();
    const nm  = String(name || "").trim().slice(0, 20);
    if (!pid || !nm) return;
    try {
      await db.collection("players").doc(pid).set({
        name: nm,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("[GP] gpRegisterPlayer failed:", err);
    }
  }
  async function gpListRegisteredPlayers(db) {
    try {
      const snap = await db.collection("players").get();
      const out = [];
      snap.forEach(doc => {
        const nm = String(doc.data()?.name || "").trim();
        if (nm) out.push({ playerId: doc.id, name: nm });
      });
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    } catch (err) {
      console.error("[GP] gpListRegisteredPlayers failed:", err);
      return [];
    }
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

  // ─── slate doc (top-level fields: atsEventIds, tiebreakerEventId, ...) ──
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
        out[eventId].push({ uid: playerId, name, side, updatedAt: data.updatedAt || null });
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
      // Separate from the parent doc's general updatedAt (which bumps on
      // every save regardless of what changed) so "last saved" for the
      // tiebreaker specifically stays accurate even if a later save only
      // touches game picks.
      userDoc.tiebreakerUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
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

  // A stuck in-flight fetch (a Firestore call that never settles rather
  // than rejecting) would otherwise pin bucket.promise forever — the
  // `finally` that clears it never runs, so every future call keeps
  // returning the same dead promise. Anything pending longer than this
  // is abandoned in favor of a fresh attempt (shorter than the Picks
  // page's own render timeout, so a manual refresh always gets a real
  // retry instead of re-hitting the same stuck promise).
  const GP_CACHE_MAX_PENDING_MS = 8000;

  async function gpEnsureAllPicksForWeek(db, weekId) {
    const k = String(weekId || "").trim();
    if (!k) return {};
    const bucket = gpGetAllPicksCacheBucket(k);
    const TTL    = 2 * 60 * 1000;
    const fresh  = bucket.data && bucket.ts && (Date.now() - bucket.ts) < TTL;
    if (fresh) return bucket.data || {};
    const pendingTooLong = bucket.promise && bucket.startedAt && (Date.now() - bucket.startedAt) > GP_CACHE_MAX_PENDING_MS;
    if (bucket.promise && !pendingTooLong) return bucket.promise;
    bucket.startedAt = Date.now();
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
      out[d.id] = { name: String(data.name || "Someone"), guess, updatedAt: data.tiebreakerUpdatedAt || null };
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
    if (fresh) return bucket.data || {};
    const pendingTooLong = bucket.promise && bucket.startedAt && (Date.now() - bucket.startedAt) > GP_CACHE_MAX_PENDING_MS;
    if (bucket.promise && !pendingTooLong) return bucket.promise;
    bucket.startedAt = Date.now();
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
  // gpGetGameWinningSide(g)
  // Straight-up winner from live/final scores: "home" | "away" | "" (tie
  // or not enough data yet). Shared by the leaderboard tally below and by
  // gp-render.js's per-card pick-result coloring, so both agree.
  // ──────────────────────────────────────────────────────────────
  function gpGetGameWinningSide(g) {
    const liveHome = g?.__live?.homeScore;
    const liveAway = g?.__live?.awayScore;
    const homeNum  = Number(liveHome ?? g?.finalHomeScore ?? NaN);
    const awayNum  = Number(liveAway ?? g?.finalAwayScore ?? NaN);
    if (!Number.isFinite(homeNum) || !Number.isFinite(awayNum)) return "";
    if (awayNum > homeNum) return "away";
    if (homeNum > awayNum) return "home";
    return ""; // tie
  }

  // ──────────────────────────────────────────────────────────────
  // gpComputeTiebreakerActual(games, tiebreakerEventId)
  // Combined final score for the designated tiebreaker game, or null if
  // that game hasn't gone final yet (or there is no tiebreaker this week).
  // Shared by the leaderboard tally and the player picks overlay.
  // ──────────────────────────────────────────────────────────────
  function gpComputeTiebreakerActual(games, tiebreakerEventId) {
    const eid = String(tiebreakerEventId || "").trim();
    if (!eid) return null;
    const list = Array.isArray(games) ? games : [];
    const tbGame = list.find(g => String(g?.eventId || g?.id || "") === eid);
    if (!tbGame) return null;
    const liveHome = tbGame?.__live?.homeScore;
    const liveAway = tbGame?.__live?.awayScore;
    const homeNum  = Number(liveHome ?? tbGame?.finalHomeScore ?? NaN);
    const awayNum  = Number(liveAway ?? tbGame?.finalAwayScore ?? NaN);
    const isFinal  = String(tbGame?.__live?.state || tbGame?.finalState || "").toLowerCase() === "post";
    if (isFinal && Number.isFinite(homeNum) && Number.isFinite(awayNum)) return homeNum + awayNum;
    return null;
  }

  // ──────────────────────────────────────────────────────────────
  // gpScoreTiebreakerGuess(guess, actual)
  // Price-is-Right rule: closest to the actual total WITHOUT going over
  // wins. A guess that goes over always ranks behind every guess that
  // doesn't, no matter how close; only when everyone went over does the
  // smallest overage win. Returns one sortable number (ascending =
  // better) so callers can just compare/sort directly; Infinity for a
  // missing/invalid guess. Shared by the weekly leaderboard's tiebreak
  // and the weekly recap's "closest guess" callout, so they always agree.
  // ──────────────────────────────────────────────────────────────
  const GP_TIEBREAKER_OVER_PENALTY = 1e6;
  function gpScoreTiebreakerGuess(guess, actual) {
    const g = Number(guess);
    if (actual == null || !Number.isFinite(g)) return Infinity;
    const diff = g - actual;
    return diff > 0 ? diff + GP_TIEBREAKER_OVER_PENALTY : -diff;
  }

  // ──────────────────────────────────────────────────────────────
  // gpComputeWeeklyRecap(games, leaderboard, tiebreakers, tiebreakerEventId, tiebreakerActual)
  // A short "what happened this week" summary, meant to run once a week
  // is fully final: the weekly champion(s), the biggest upset (pregame
  // underdog winning outright, by largest spread), anyone who went
  // perfect (no losses across outright + ATS), and — regardless of
  // whether the standings needed it — who guessed the tiebreaker
  // closest without going over, for bragging rights.
  // ──────────────────────────────────────────────────────────────
  function gpComputeWeeklyRecap(games, leaderboard, tiebreakers, tiebreakerEventId, tiebreakerActual) {
    const rows = Array.isArray(leaderboard?.rows) ? leaderboard.rows : [];
    if (!rows.length) return null;

    const topPoints = rows[0].points;
    const champions = rows.filter(r => r.points === topPoints).map(r => ({ name: r.name, points: r.points }));

    let biggestUpset = null;
    for (const g of (Array.isArray(games) ? games : [])) {
      const winner = gpGetGameWinningSide(g);
      if (!winner) continue; // not final yet, or a tie
      const favSide = gpComputeStraightFavSide(g);
      const spread  = Number(g?.spreadValue);
      if (!favSide || !Number.isFinite(spread) || spread <= 0 || winner === favSide) continue;
      if (biggestUpset && spread <= biggestUpset.spread) continue;
      const away = g?.awayTeam || { name: g?.awayName || "Away" };
      const home = g?.homeTeam || { name: g?.homeName || "Home" };
      const winnerTeam = winner === "away" ? away : home;
      const loserTeam  = winner === "away" ? home  : away;
      biggestUpset = {
        spread,
        winnerName: String(winnerTeam?.name || "The underdog"),
        loserName:  String(loserTeam?.name  || "the favorite"),
      };
    }

    const perfectWeekPlayers = rows
      .filter(r => Number(r.picks || 0) > 0 && (Number(r.owLosses || 0) + Number(r.atsLosses || 0)) === 0)
      .map(r => r.name);

    let tiebreaker = null;
    if (tiebreakerEventId && tiebreakerActual != null) {
      const entries = Object.values(tiebreakers && typeof tiebreakers === "object" ? tiebreakers : {});
      const scored = entries
        .map(t => ({ t, score: gpScoreTiebreakerGuess(t?.guess, tiebreakerActual) }))
        .filter(x => Number.isFinite(x.score))
        .sort((a, b) => a.score - b.score);
      if (scored.length) {
        tiebreaker = {
          actual: tiebreakerActual,
          winnerName: String(scored[0].t.name || "Someone"),
          guess: Number(scored[0].t.guess),
        };
      }
    }

    return { champions, biggestUpset, perfectWeekPlayers, tiebreaker };
  }

  // ──────────────────────────────────────────────────────────────
  // gpComputeWeeklyLeaderboard(games, allPicks, opts)
  //   opts.atsEventIds        eventIds of the games this week graded
  //                           against their spread (up to 5) — every other
  //                           game is always graded straight-up
  //   opts.tiebreakers        { [playerKey]: { name, guess } } — from gpGetAllTiebreakersForSlate
  //   opts.tiebreakerEventId  eventId of this week's designated tiebreaker game
  // ──────────────────────────────────────────────────────────────
  function gpComputeWeeklyLeaderboard(games, allPicks, opts) {
    const list  = Array.isArray(games)    ? games    : [];
    const picks = (allPicks && typeof allPicks === "object") ? allPicks : {};
    const atsEventIds       = new Set((Array.isArray(opts?.atsEventIds) ? opts.atsEventIds : []).map(String));
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

      if (atsEventIds.has(eventId)) {
        const grade = gpGradeAtsForGame(g);
        if (!grade.ok) continue; // no usable line/score — don't score this game
        gameResults[eventId] = { winningSide: grade.pushed ? "" : grade.coverSide, favSide: "", isAts: true };
        continue;
      }

      gameResults[eventId] = { winningSide: gpGetGameWinningSide(g), favSide: gpComputeStraightFavSide(g), isAts: false };
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
          players.set(key, {
            key, name, points: 0, wins: 0, losses: 0, ties: 0, picks: 0, dogWins: 0, favWins: 0,
            owWins: 0, owLosses: 0, owTies: 0, atsWins: 0, atsLosses: 0, atsPushes: 0,
          });
        }
        const row = players.get(key);
        row.name = name;
        row.picks++;

        if (!winningSide) {
          // Tie / push — award 0.5 points
          row.ties++;
          row.points += 0.5;
          if (isAts) row.atsPushes++; else row.owTies++;
        } else if (side === winningSide) {
          row.wins++;
          if (isAts) {
            row.points += 1;
            row.atsWins++;
          } else {
            row.owWins++;
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
          if (isAts) row.atsLosses++; else row.owLosses++;
        }
      }
    }

    // — tiebreaker: combined-score guess breaks ties in points+wins —
    // (closest without going over — see gpScoreTiebreakerGuess)
    const tiebreakerActual = gpComputeTiebreakerActual(list, tiebreakerEventId);
    function tiebreakerDiff(row) {
      const tb = tiebreakers[row.key];
      return gpScoreTiebreakerGuess(tb?.guess, tiebreakerActual);
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

    // Flag every row in a genuine points+wins tie (more than one player)
    // so the UI can show players exactly when the tiebreaker decided
    // their order — visible proof it's actually being factored in. Also
    // credit a tiebreakerWon to whichever single player in that tied
    // group has the best (strictly better than everyone else's) guess —
    // this is what the season standings count up as "tiebreakers won".
    if (tiebreakerActual != null) {
      const groups = new Map();
      for (const r of rows) {
        const gk = `${r.points}|${r.wins}`;
        if (!groups.has(gk)) groups.set(gk, []);
        groups.get(gk).push(r);
      }
      for (const groupRows of groups.values()) {
        const used = groupRows.length > 1;
        for (const r of groupRows) r.tiebreakerUsed = used;
        if (!used) continue;
        const scored = groupRows
          .map(r => ({ r, d: tiebreakerDiff(r) }))
          .filter(x => Number.isFinite(x.d))
          .sort((a, b) => a.d - b.d);
        if (scored.length && (scored.length === 1 || scored[0].d < scored[1].d)) {
          scored[0].r.tiebreakerWon = true;
        }
      }
    }

    return { rows, finalsCount, tiebreakerActual };
  }

  // ──────────────────────────────────────────────────────────────
  // Head-to-Head format — an optional per-league alternative to the
  // cumulative-points format above. The admin supplies a roster of
  // player names (matched case-insensitively, same as the points
  // leaderboard's unregistered-player fallback); the app auto-generates
  // a round-robin schedule so every week is a 1-on-1 matchup, and
  // season standings become a win-loss-tie matchup record instead of
  // total points. Entirely opt-in — a league with no `format` field
  // (i.e. every league created before this existed) behaves exactly as
  // it always has.
  // ──────────────────────────────────────────────────────────────

  // gpGenerateH2HSchedule(roster) — standard "circle method" round robin.
  // An odd roster gets a bye slot. Returns N-1 rounds (N players, or N
  // rounds if a bye was added) each covering every player exactly once;
  // gpGetH2HRoundForWeek cycles this for seasons longer than one full
  // round-robin. Pure function of the roster — same input always
  // produces the same schedule, so re-saving league settings without
  // touching the roster doesn't reshuffle anyone's matchups.
  function gpGenerateH2HSchedule(roster) {
    const names = (Array.isArray(roster) ? roster : []).map(n => String(n || "").trim()).filter(Boolean);
    if (names.length < 2) return [];
    const work = [...names];
    if (work.length % 2 !== 0) work.push(null); // null = bye slot
    const n = work.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = work[i], b = work[n - 1 - i];
        if (a == null)      pairs.push({ bye: b });
        else if (b == null) pairs.push({ bye: a });
        else                pairs.push({ players: [a, b] });
      }
      // Firestore rejects an array directly containing another array, so
      // each round is wrapped in a { pairs } object rather than stored
      // as a bare array — gpGetH2HRoundForWeek unwraps it back out.
      rounds.push({ pairs });
      const fixed = work[0];
      const rest  = work.slice(1);
      rest.unshift(rest.pop());
      work.splice(0, work.length, fixed, ...rest);
    }
    return rounds;
  }

  // gpGetH2HRoundForWeek(schedule, weekIndex) — weekIndex is the week's
  // 0-based position within league.weeks (creation order, not just
  // published weeks), so Week 1 always gets Round 1 regardless of which
  // weeks happen to be published yet.
  function gpGetH2HRoundForWeek(schedule, weekIndex) {
    if (!Array.isArray(schedule) || !schedule.length) return [];
    const i = Number(weekIndex);
    const idx = (!Number.isFinite(i) || i < 0) ? 0 : (i % schedule.length);
    return schedule[idx]?.pairs || [];
  }

  // gpComputeH2HWeekResults(round, weeklyRows) — matches this week's
  // scheduled pairings to that week's points (from the already-computed
  // gpComputeWeeklyLeaderboard rows), and decides each matchup's winner.
  function gpComputeH2HWeekResults(round, weeklyRows) {
    const byName = new Map();
    for (const r of (Array.isArray(weeklyRows) ? weeklyRows : [])) {
      byName.set(String(r?.name || "").trim().toLowerCase(), r);
    }
    return (Array.isArray(round) ? round : []).map(m => {
      if (m.bye) {
        return { bye: m.bye, row: byName.get(String(m.bye).trim().toLowerCase()) || null };
      }
      const [nameA, nameB] = m.players;
      const rowA = byName.get(String(nameA).trim().toLowerCase()) || null;
      const rowB = byName.get(String(nameB).trim().toLowerCase()) || null;
      const ptsA = Number(rowA?.points ?? 0);
      const ptsB = Number(rowB?.points ?? 0);
      let winner = null;
      if (rowA || rowB) winner = ptsA > ptsB ? "a" : ptsB > ptsA ? "b" : "tie";
      return { players: [nameA, nameB], rows: [rowA, rowB], points: [ptsA, ptsB], winner };
    });
  }

  // gpComputeH2HSeasonStandings(weeklyResults, schedule)
  // weeklyResults: [{ weekIndex, rows, finalsCount, gamesCount }, ...]
  // A week only counts once every game in it has gone final — same
  // "fully final" signal the points format's season cache uses. Byes
  // never affect anyone's record.
  function gpComputeH2HSeasonStandings(weeklyResults, schedule) {
    const players = new Map();
    function ensure(name) {
      const key = String(name).trim().toLowerCase();
      if (!players.has(key)) players.set(key, { name, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 });
      return players.get(key);
    }
    const weeks = Array.isArray(weeklyResults) ? weeklyResults : [];
    let weeksFinal = 0;
    for (const wr of weeks) {
      const gamesCount = Number(wr?.gamesCount ?? 0);
      const isFinal = gamesCount > 0 && Number(wr?.finalsCount ?? 0) === gamesCount;
      if (!isFinal) continue;
      weeksFinal++;
      const round = gpGetH2HRoundForWeek(schedule, wr.weekIndex);
      for (const m of gpComputeH2HWeekResults(round, wr.rows)) {
        if (m.bye) continue;
        const [nameA, nameB] = m.players;
        const a = ensure(nameA), b = ensure(nameB);
        a.pointsFor += m.points[0]; a.pointsAgainst += m.points[1];
        b.pointsFor += m.points[1]; b.pointsAgainst += m.points[0];
        if (m.winner === "a")      { a.wins++;  b.losses++; }
        else if (m.winner === "b") { b.wins++;  a.losses++; }
        else if (m.winner === "tie") { a.ties++; b.ties++; }
      }
    }
    const rows = [...players.values()].sort((x, y) => {
      if (y.wins !== x.wins) return y.wins - x.wins;
      if (y.ties !== x.ties) return y.ties - x.ties;
      const xDiff = x.pointsFor - x.pointsAgainst, yDiff = y.pointsFor - y.pointsAgainst;
      if (yDiff !== xDiff) return yDiff - xDiff;
      return String(x.name).localeCompare(String(y.name));
    });
    return { rows, weeksCount: weeksFinal };
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
          players.set(key, {
            key, name: r.name, points: 0, wins: 0, losses: 0, ties: 0, dogWins: 0, favWins: 0, weeksPlayed: 0,
            owWins: 0, owLosses: 0, owTies: 0, atsWins: 0, atsLosses: 0, atsPushes: 0, tbWins: 0,
          });
        }
        const acc = players.get(key);
        acc.name        = r.name || acc.name;
        acc.points     += Number(r.points    || 0);
        acc.wins       += Number(r.wins      || 0);
        acc.losses     += Number(r.losses    || 0);
        acc.ties       += Number(r.ties      || 0);
        acc.dogWins    += Number(r.dogWins   || 0);
        acc.favWins    += Number(r.favWins   || 0);
        acc.owWins     += Number(r.owWins    || 0);
        acc.owLosses   += Number(r.owLosses  || 0);
        acc.owTies     += Number(r.owTies    || 0);
        acc.atsWins    += Number(r.atsWins   || 0);
        acc.atsLosses  += Number(r.atsLosses || 0);
        acc.atsPushes  += Number(r.atsPushes || 0);
        acc.tbWins     += r.tiebreakerWon ? 1 : 0;
        acc.weeksPlayed += 1;
      }
    }

    // Season tie-break chain (all after points, in order):
    //   1. 🎯 tiebreakers won this season
    //   2. Best ATS win percentage
    //   3. Most correct underdog picks
    const atsWinPct = p => (p.atsWins + p.atsLosses) > 0 ? p.atsWins / (p.atsWins + p.atsLosses) : 0;
    const rows = [...players.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.tbWins !== a.tbWins) return b.tbWins - a.tbWins;
      const pctDiff = atsWinPct(b) - atsWinPct(a);
      if (pctDiff !== 0) return pctDiff;
      if (b.dogWins !== a.dogWins) return b.dogWins - a.dogWins;
      return String(a.name).localeCompare(String(b.name));
    });

    return { rows, weeksCount: weeks.length };
  }

  // ─── expose on window ──────────────────────────────────────────────────
  window.GP_Data = {
    ensureFirebaseReadySafe,
    getPicksDisplayName,
    gpGetLeague,
    gpListLeagues,
    gpIsLeagueActive,
    gpRegisterPlayer,
    gpListRegisteredPlayers,
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
    gpGetGameWinningSide,
    gpComputeTiebreakerActual,
    gpScoreTiebreakerGuess,
    gpComputeWeeklyRecap,
    gpGenerateH2HSchedule,
    gpGetH2HRoundForWeek,
    gpComputeH2HWeekResults,
    gpComputeH2HSeasonStandings,
  };

  window.ensureFirebaseReadySafe = ensureFirebaseReadySafe;

})();
