/* split/gp-admin.js
   =========================
   GROUP PICKS — Admin Actions
   Create/set active week, add games to a slate, publish week.
   Exposes all functions on window.GP_Admin namespace.
*/

(function () {
  "use strict";

  const META_PUBLIC_DOC = "public";
  const META_ADMIN_DOC  = "admin";

  function currentYear() { return new Date().getFullYear(); }
  function weekIdFor(year, weekNum) { return `${year}_W${weekNum}`; }

  function metaRef(db, docId) {
    // Prefer GP_Data version if available
    if (window.GP_Data?.metaRef) return window.GP_Data.metaRef(db, docId);
    return db.collection("pickSlatesMeta").doc(String(docId));
  }

  // --------------- team / venue / odds builders (used when adding games) ---------------
  function pickLogo(teamObj) {
    const l1 = teamObj?.logo;
    const l2 = Array.isArray(teamObj?.logos) ? teamObj.logos[0]?.href : "";
    return String(l1 || l2 || "");
  }
  function pickRecord(competitor) {
    const recs = Array.isArray(competitor?.records) ? competitor.records : [];
    const total = recs.find(r => r?.type === "total") || recs[0];
    return String(total?.summary || "");
  }
  function pickRank(competitor, teamObj) {
    const r = competitor?.curatedRank?.current ?? competitor?.rank ?? teamObj?.rank ?? "";
    const n = Number(r);
    // ESPN uses 99 (and sometimes 0) as an "unranked" sentinel rather than
    // omitting the field, so only 1-25 (the actual AP/Coaches Top 25) counts.
    return Number.isFinite(n) && n >= 1 && n <= 25 ? n : null;
  }
  function buildTeam(competitor) {
    const team = competitor?.team || {};
    return {
      id:      String(team?.id || ""),
      name:    String(team?.displayName || team?.name || ""),
      abbr:    String(team?.abbreviation || ""),
      logo:    pickLogo(team),
      record:  pickRecord(competitor),
      rank:    pickRank(competitor, team),
      homeAway: String(competitor?.homeAway || "")
    };
  }
  function buildVenueLine(comp) {
    const v    = comp?.venue || {};
    const full = String(v?.fullName || "");
    const city = String(v?.address?.city || "");
    const state = String(v?.address?.state || "");
    const loc  = [city, state].filter(Boolean).join(", ");
    if (full && loc) return `${full} - ${loc}`;
    return full || loc || "";
  }
  function buildOdds(comp, homeTeam, awayTeam) {
    const o = Array.isArray(comp?.odds) ? comp.odds[0] : null;
    if (!o) return { details: "", overUnder: "", favoredTeam: "", spreadValue: null, spreadFavoredSide: "" };
    const details   = String(o?.details || "");
    const overUnder = (o?.overUnder != null) ? String(o.overUnder) : "";
    const homeFav   = !!o?.homeTeamOdds?.favorite;
    const awayFav   = !!o?.awayTeamOdds?.favorite;
    const favoredTeam =
      homeFav ? (homeTeam?.abbr || homeTeam?.name || "") :
      awayFav ? (awayTeam?.abbr || awayTeam?.name || "") : "";

    // spread is signed relative to the home team (negative = home favored)
    const spreadRaw = Number(o?.spread);
    let spreadValue = null;
    let spreadFavoredSide = "";
    if (Number.isFinite(spreadRaw) && spreadRaw !== 0) {
      spreadValue = Math.abs(spreadRaw);
      spreadFavoredSide = spreadRaw < 0 ? "home" : "away";
    } else if (homeFav || awayFav) {
      // fall back to parsing the magnitude out of the details string
      const m = details.match(/-\s*(\d+(\.\d+)?)/);
      if (m) {
        spreadValue = Number(m[1]);
        spreadFavoredSide = homeFav ? "home" : "away";
      }
    }

    return { details, overUnder, favoredTeam, spreadValue, spreadFavoredSide };
  }
  function kickoffMsFromEvent(ev) {
    const comp = ev?.competitions?.[0];
    const iso  = ev?.date || comp?.date || "";
    const t    = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }

  // --------------- summarize a raw ESPN scoreboard event ---------------
  // Single source of truth for "what does this event look like" — used both
  // by the admin picker (before a game is added) and by gpAdminAddSelectedGamesToWeek
  // (when it's actually committed), so the rank/spread shown while picking
  // always matches what gets stored.
  function gpAdminSummarizeEvent(ev) {
    const comp        = ev?.competitions?.[0] || {};
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const homeC       = competitors.find(c => c?.homeAway === "home") || competitors[1] || {};
    const awayC       = competitors.find(c => c?.homeAway === "away") || competitors[0] || {};
    const homeTeam    = buildTeam(homeC);
    const awayTeam    = buildTeam(awayC);
    const odds        = buildOdds(comp, homeTeam, awayTeam);
    return {
      id:                String(ev?.id || ""),
      homeTeam, awayTeam,
      kickoffMs:         kickoffMsFromEvent(ev),
      spreadValue:       odds.spreadValue,
      spreadFavoredSide: odds.spreadFavoredSide,
      oddsDetails:       odds.details
    };
  }

  // --------------- create new week ---------------
  async function gpAdminCreateNewWeek(db, uid) {
    const y         = currentYear();
    const adminRef  = metaRef(db, META_ADMIN_DOC);
    const publicRef = metaRef(db, META_PUBLIC_DOC);

    await db.runTransaction(async (tx) => {
      const aSnap = await tx.get(adminRef);
      const pSnap = await tx.get(publicRef);
      const a = aSnap.exists ? (aSnap.data() || {}) : {};
      const p = pSnap.exists ? (pSnap.data() || {}) : {};

      const nextWeek = Math.max(1, Number(a.currentWeek || 0) + 1);
      const newId    = weekIdFor(y, nextWeek);
      const label    = `Week ${nextWeek}`;
      const weeks    = Array.isArray(p.weeks) ? [...p.weeks] : [];
      if (!weeks.some(w => String(w.id) === newId)) {
        weeks.push({ id: newId, label, published: false });
      }

      tx.set(adminRef, {
        year: y, currentWeek: nextWeek, activeWeekId: newId,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });

      tx.set(publicRef, {
        year: y, activeWeekId: newId, weeks,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });

      tx.set(db.collection("pickSlates").doc(newId), {
        type: "week", year: y, weekNum: nextWeek, label,
        active: true, published: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });
    });
    return true;
  }

  // --------------- set active week ---------------
  async function gpAdminSetActiveWeek(db, uid, weekId) {
    const publicRef = metaRef(db, META_PUBLIC_DOC);
    const adminRef  = metaRef(db, META_ADMIN_DOC);
    const y = currentYear();

    await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(publicRef);
      const p = pSnap.exists ? (pSnap.data() || {}) : {};
      const weeks = Array.isArray(p.weeks) ? [...p.weeks] : [];
      if (!weeks.some(w => String(w.id) === String(weekId))) {
        weeks.push({ id: String(weekId), label: String(weekId), published: false });
      }
      tx.set(publicRef, {
        year: y, activeWeekId: String(weekId), weeks,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });
      tx.set(adminRef, {
        year: y, activeWeekId: String(weekId),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });
      tx.set(db.collection("pickSlates").doc(String(weekId)), {
        active: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });
    });
    return true;
  }

  // --------------- add selected games to week ---------------
  async function gpAdminAddSelectedGamesToWeek(db, uid, weekId, leagueKey, dateYYYYMMDD, selectedEventIds, events) {
    const slateRef = db.collection("pickSlates").doc(String(weekId));
    await slateRef.set({
      type: "week",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });

    for (const ev of (events || [])) {
      const eventId = String(ev?.id || "");
      if (!eventId || !selectedEventIds.has(eventId)) continue;

      const comp       = ev?.competitions?.[0] || {};
      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const homeC      = competitors.find(c => c?.homeAway === "home") || {};
      const awayC      = competitors.find(c => c?.homeAway === "away") || {};
      const homeTeam   = buildTeam(homeC);
      const awayTeam   = buildTeam(awayC);
      const startMs    = kickoffMsFromEvent(ev);
      const startTime  = startMs ? firebase.firestore.Timestamp.fromMillis(startMs) : null;

      const actualYYYYMMDD = (() => {
        if (!startMs) return String(dateYYYYMMDD || "");
        const d  = new Date(startMs);
        const y  = d.getFullYear();
        const m  = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        return `${y}${m}${da}`;
      })();

      const venueLine = buildVenueLine(comp);
      const odds      = buildOdds(comp, homeTeam, awayTeam);

      await slateRef.collection("games").doc(eventId).set({
        eventId,
        weekId:       String(weekId),
        leagueKey:    String(leagueKey || ""),
        dateYYYYMMDD: String(actualYYYYMMDD || ""),
        homeName:     homeTeam.name || "Home",
        awayName:     awayTeam.name || "Away",
        startTime,
        venueLine:    String(venueLine || ""),
        oddsDetails:  String(odds.details || ""),
        oddsOU:       String(odds.overUnder || ""),
        oddsFavored:  String(odds.favoredTeam || ""),
        homeTeam,
        awayTeam,
        spreadValue:        odds.spreadValue,
        spreadFavoredSide:  String(odds.spreadFavoredSide || ""),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  // --------------- set scoring mode for a week ---------------
  async function gpAdminSetScoringMode(db, uid, weekId, mode) {
    const m = (mode === "ats") ? "ats" : "straight";
    await db.collection("pickSlates").doc(String(weekId)).set({
      scoringMode: m,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });
    return m;
  }

  // --------------- set / clear the weekly tiebreaker game ---------------
  async function gpAdminSetTiebreaker(db, uid, weekId, eventId, startTimeMs) {
    const slateRef = db.collection("pickSlates").doc(String(weekId));
    if (!eventId) {
      await slateRef.set({
        tiebreakerEventId: firebase.firestore.FieldValue.delete(),
        tiebreakerLockAt:  firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
      return true;
    }
    const ms = Number(startTimeMs);
    const lockAt = Number.isFinite(ms) && ms > 0
      ? firebase.firestore.Timestamp.fromMillis(ms)
      : null;
    await slateRef.set({
      tiebreakerEventId: String(eventId),
      tiebreakerLockAt:  lockAt,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });
    return true;
  }

  // --------------- remove a committed game from a week ---------------
  async function gpAdminRemoveGameFromWeek(db, uid, weekId, eventId) {
    const slateRef = db.collection("pickSlates").doc(String(weekId));
    const gameRef  = slateRef.collection("games").doc(String(eventId));

    const slateSnap = await slateRef.get();
    const slateData = slateSnap.exists ? (slateSnap.data() || {}) : {};

    const batch = db.batch();
    batch.delete(gameRef);
    // If this was the designated tiebreaker game, clear that too —
    // otherwise the leaderboard would keep pointing at a game that no
    // longer exists.
    if (String(slateData.tiebreakerEventId || "") === String(eventId)) {
      batch.set(slateRef, {
        tiebreakerEventId: firebase.firestore.FieldValue.delete(),
        tiebreakerLockAt:  firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
    }
    await batch.commit();
    return true;
  }

  // --------------- publish week ---------------
  async function gpAdminPublishWeek(db, uid, weekId) {
    const slateRef  = db.collection("pickSlates").doc(String(weekId));
    await slateRef.set({
      published: true,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: uid,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy:   uid
    }, { merge: true });

    const publicRef = metaRef(db, META_PUBLIC_DOC);
    await db.runTransaction(async (tx) => {
      const pSnap = await tx.get(publicRef);
      const p = pSnap.exists ? (pSnap.data() || {}) : {};
      const weeks = Array.isArray(p.weeks) ? [...p.weeks] : [];
      const next  = weeks.map(w => {
        if (String(w.id) === String(weekId)) return { ...w, published: true };
        return w;
      });
      tx.set(publicRef, {
        weeks: next,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
    });
  }

  // --------------- expose on window ---------------
  window.GP_Admin = {
    gpAdminCreateNewWeek,
    gpAdminSetActiveWeek,
    gpAdminAddSelectedGamesToWeek,
    gpAdminRemoveGameFromWeek,
    gpAdminPublishWeek,
    gpAdminSetScoringMode,
    gpAdminSetTiebreaker,
    gpAdminSummarizeEvent
  };

})();
