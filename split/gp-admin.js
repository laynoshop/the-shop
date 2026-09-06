/* split/gp-admin.js
   =========================
   GROUP PICKS — Admin Actions
   Create/set active week, add games to a slate, publish week.
   Exposes all functions on window.GP_Admin namespace.
*/

(function () {
  "use strict";

  function currentYear() { return new Date().getFullYear(); }

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

  // --------------- leagues (pick'em groups: "Work League", "Family League", ...) ---------------
  // Note: unrelated to `leagueKey` elsewhere in this codebase, which means the
  // *sport* (nfl/cfb/nba/...) for the ESPN scoreboard fetch. These are two
  // different concepts that happen to share the English word "league".
  function leaguesRef(db, leagueId) {
    return db.collection("leagues").doc(String(leagueId));
  }

  // totalWeeks is the planned length of the season (e.g. 12 for a fall
  // league, 10 for a winter league) — null/0 means "no fixed length".
  // It's informational only: admins can still create weeks past it
  // (playoffs, etc.); it drives the "Active" badge on the league picker.
  function normalizeTotalWeeks(totalWeeks) {
    const n = Number(totalWeeks);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }

  async function gpCreateLeague(db, uid, { name, seasonYear, totalWeeks }) {
    const ref = db.collection("leagues").doc();
    await ref.set({
      name:         String(name || "New League").trim().slice(0, 40),
      seasonYear:   Number(seasonYear) || currentYear(),
      totalWeeks:   normalizeTotalWeeks(totalWeeks),
      archived:     false,
      currentWeek:  0,
      activeWeekId: "",
      weeks:        [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
    });
    return ref.id;
  }

  async function gpUpdateLeagueSettings(db, uid, leagueId, { name, seasonYear, totalWeeks, archived }) {
    const patch = {
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    };
    if (name !== undefined)       patch.name = String(name || "").trim().slice(0, 40);
    if (seasonYear !== undefined) patch.seasonYear = Number(seasonYear) || currentYear();
    if (totalWeeks !== undefined) patch.totalWeeks = normalizeTotalWeeks(totalWeeks);
    if (archived !== undefined)   patch.archived = !!archived;
    await leaguesRef(db, leagueId).set(patch, { merge: true });
    return true;
  }

  // --------------- create a new week inside a league ---------------
  async function gpAdminCreateNewWeekInLeague(db, uid, leagueId) {
    const leagueRef = leaguesRef(db, leagueId);
    let newId = "";

    await db.runTransaction(async (tx) => {
      const lSnap = await tx.get(leagueRef);
      const l = lSnap.exists ? (lSnap.data() || {}) : {};
      const y = Number(l.seasonYear) || currentYear();

      const nextWeek = Math.max(1, Number(l.currentWeek || 0) + 1);
      newId = `${leagueId}_${y}_W${nextWeek}`;
      const label = `Week ${nextWeek}`;
      const weeks = Array.isArray(l.weeks) ? [...l.weeks] : [];
      if (!weeks.some(w => String(w.id) === newId)) {
        weeks.push({ id: newId, label, published: false });
      }

      tx.set(leagueRef, {
        currentWeek: nextWeek, activeWeekId: newId, weeks,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });

      tx.set(db.collection("pickSlates").doc(newId), {
        type: "week", leagueId: String(leagueId), year: y, weekNum: nextWeek, label,
        active: true, published: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: uid,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid
      }, { merge: true });
    });
    return newId;
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

  // --------------- set the week's against-the-spread games (up to 5) ---------------
  // Every other game in the week is always graded straight-up; this marks
  // the games (if any, up to MAX_ATS_GAMES) that are graded against their
  // spread instead.
  const MAX_ATS_GAMES = 5;
  async function gpAdminSetAtsGames(db, uid, weekId, eventIds) {
    const ids = [...new Set((Array.isArray(eventIds) ? eventIds : []).map(String).filter(Boolean))]
      .slice(0, MAX_ATS_GAMES);
    await db.collection("pickSlates").doc(String(weekId)).set({
      atsEventIds: ids,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: uid
    }, { merge: true });
    return ids;
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
    // If this was the designated tiebreaker or ATS game, clear that too —
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
    const atsEventIds = Array.isArray(slateData.atsEventIds) ? slateData.atsEventIds.map(String) : [];
    if (atsEventIds.includes(String(eventId))) {
      batch.set(slateRef, {
        atsEventIds: atsEventIds.filter(id => id !== String(eventId)),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
    }
    await batch.commit();
    return true;
  }

  // --------------- publish week ---------------
  async function gpAdminPublishWeek(db, uid, leagueId, weekId) {
    const slateRef  = db.collection("pickSlates").doc(String(weekId));
    await slateRef.set({
      published: true,
      publishedAt: firebase.firestore.FieldValue.serverTimestamp(),
      publishedBy: uid,
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy:   uid
    }, { merge: true });

    const leagueRef = leaguesRef(db, leagueId);
    await db.runTransaction(async (tx) => {
      const lSnap = await tx.get(leagueRef);
      const l = lSnap.exists ? (lSnap.data() || {}) : {};
      const weeks = Array.isArray(l.weeks) ? [...l.weeks] : [];
      const next  = weeks.map(w => {
        if (String(w.id) === String(weekId)) return { ...w, published: true };
        return w;
      });
      tx.set(leagueRef, {
        weeks: next,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: uid
      }, { merge: true });
    });
  }

  // --------------- expose on window ---------------
  window.GP_Admin = {
    gpCreateLeague,
    gpUpdateLeagueSettings,
    gpAdminCreateNewWeekInLeague,
    gpAdminAddSelectedGamesToWeek,
    gpAdminRemoveGameFromWeek,
    gpAdminPublishWeek,
    gpAdminSetAtsGames,
    gpAdminSetTiebreaker,
    gpAdminSummarizeEvent
  };

})();
