const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── push notifications ──────────────────────────────────────────────
// Shared by every notification trigger below (test-send, league
// announcements, week-published, lock reminders, final scores): looks
// up each player's stored FCM tokens (players/{playerId}.fcmTokens,
// written by gpNotifEnable in split/gp-notifications.js) and sends one
// multicast push. Tokens FCM reports as no-longer-registered
// (uninstalled app, revoked permission, etc.) are cleaned up from the
// player doc so they stop being retried.
//
// IMPORTANT: this is sent as a data-only message (no top-level
// `notification` field) on purpose. firebase-messaging-sw.js defines its
// own onBackgroundMessage handler that calls showNotification() — if the
// FCM payload also carries a `notification` field, the browser's FCM
// service-worker library auto-displays it AND onBackgroundMessage fires
// and displays it again, producing two identical notifications for
// every single push. Keeping title/body in `data` (FCM requires string
// values there) means only our own showNotification() call ever runs.
async function sendPushToPlayerIds(playerIds, notification, data) {
  const uniqueIds = [...new Set((playerIds || []).map(String).filter(Boolean))];
  if (!uniqueIds.length) return { sent: 0, players: 0 };

  const tokenOwner = new Map(); // token -> playerId
  await Promise.all(uniqueIds.map(async (playerId) => {
    const snap = await db.collection("players").doc(playerId).get();
    const tokens = snap.exists ? snap.data()?.fcmTokens : null;
    if (Array.isArray(tokens)) {
      for (const t of tokens) if (t) tokenOwner.set(String(t), playerId);
    }
  }));

  const tokens = [...tokenOwner.keys()];
  if (!tokens.length) return { sent: 0, players: uniqueIds.length };

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    data: {
      title: String(notification?.title || "The Shop"),
      body: String(notification?.body || ""),
      ...Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
    },
  });

  const staleByPlayer = new Map(); // playerId -> tokens to drop
  response.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error?.code || "";
    if (code !== "messaging/registration-token-not-registered" && code !== "messaging/invalid-registration-token") return;
    const token = tokens[i];
    const playerId = tokenOwner.get(token);
    if (!playerId) return;
    if (!staleByPlayer.has(playerId)) staleByPlayer.set(playerId, []);
    staleByPlayer.get(playerId).push(token);
  });
  await Promise.all([...staleByPlayer.entries()].map(([playerId, staleTokens]) =>
    db.collection("players").doc(playerId).update({
      fcmTokens: FieldValue.arrayRemove(...staleTokens),
    }).catch(() => {})
  ));

  return { sent: response.successCount, failed: response.failureCount, players: uniqueIds.length };
}

// Shared by every league-wide trigger below (announcements, week
// published, week final): resolves a league's members subcollection
// into playerIds and sends one push to all of them.
async function notifyLeagueMembers(leagueId, notification) {
  if (!leagueId) return { sent: 0, players: 0 };
  const membersSnap = await db.collection("leagues").doc(leagueId).collection("members").get();
  const playerIds = membersSnap.docs.map((d) => d.id);
  if (!playerIds.length) return { sent: 0, players: 0 };
  return sendPushToPlayerIds(playerIds, notification);
}

// Callable from the client (GP_Notif or a future "send yourself a test"
// button) to verify the whole pipeline — token storage, this function,
// and actual delivery to the device — before building the real triggers
// on top of it.
exports.sendTestPush = onCall(async (request) => {
  const playerId = String(request.data?.playerId || "").trim();
  if (!playerId) throw new HttpsError("invalid-argument", "playerId is required");
  const result = await sendPushToPlayerIds(
    [playerId],
    { title: "🔔 Test notification", body: "If you see this, push notifications are working!" }
  );
  if (!result.sent) {
    throw new HttpsError("failed-precondition", "No notification could be delivered — check that notifications were enabled on this device.");
  }
  return result;
});

// ─── Trigger: a League Announcement was added or edited ───────────────
// Announcements have no id/timestamp of their own (they're a plain array
// of up to 3 { title, message } objects on the league doc, all resaved
// together whenever League Settings is submitted), so there's no clean
// "this one is new" signal beyond diffing the array by value: whichever
// entry in the new list wasn't present in the old list — verbatim — is
// treated as the one to announce. Reordering the same three entries with
// no other change looks like no diff (every entry still matches one from
// before) and correctly stays silent; clearing announcements entirely
// also stays silent (nothing new to tell anyone about).
exports.onLeagueAnnouncementChanged = onDocumentUpdated("leagues/{leagueId}", async (event) => {
  const before = event.data?.before?.data() || {};
  const after  = event.data?.after?.data()  || {};
  const afterList = Array.isArray(after.announcements) ? after.announcements : [];
  if (!afterList.length) return;

  const beforeSet = new Set(
    (Array.isArray(before.announcements) ? before.announcements : []).map((a) => JSON.stringify(a))
  );
  const changed = afterList.find((a) => !beforeSet.has(JSON.stringify(a)));
  if (!changed) return;

  const body = [changed.title, changed.message].filter(Boolean).join(" — ").slice(0, 180);
  if (!body) return;

  await notifyLeagueMembers(event.params.leagueId, {
    title: `📣 ${String(after.name || "Your league")}`,
    body,
  });
});

// ─── Trigger: a week got published ─────────────────────────────────────
exports.onWeekPublished = onDocumentUpdated("pickSlates/{slateId}", async (event) => {
  const before = event.data?.before?.data() || {};
  const after  = event.data?.after?.data()  || {};
  if (before.published === true || after.published !== true) return;

  const leagueId = String(after.leagueId || "");
  if (!leagueId) return;
  const leagueSnap = await db.collection("leagues").doc(leagueId).get();
  const leagueName = String(leagueSnap.data()?.name || "Your league");
  const label = String(after.label || event.params.slateId);

  await notifyLeagueMembers(leagueId, {
    title: `🏈 ${label} is up!`,
    body: `Picks are open for ${leagueName}.`,
  });
});

// Full per-player fan-out, done ONCE server-side — mirrors the original
// client-side gpGetAllPicksForSlate (split/gp-data.js) exactly, just run
// from a Cloud Function instead of a player's phone. Only ever called
// the first time a slate's picksByEvent summary gets built (see below);
// after that, incremental single-leaf writes keep it current.
async function buildFullPicksByEvent(slateId) {
  const picksByEvent = {};
  const usersSnap = await db.collection("pickSlates").doc(slateId).collection("picks").get();
  await Promise.all(usersSnap.docs.map(async (u) => {
    const playerId = u.id;
    const gamesSnap = await db.collection("pickSlates").doc(slateId)
      .collection("picks").doc(playerId).collection("games").get();
    gamesSnap.forEach((d) => {
      const data = d.data() || {};
      const eventId = d.id;
      if (!picksByEvent[eventId]) picksByEvent[eventId] = {};
      picksByEvent[eventId][playerId] = {
        uid: String(data.uid || playerId),
        name: String(data.name || u.data()?.name || "Someone"),
        side: String(data.side || ""),
        updatedAt: data.updatedAt || null,
      };
    });
  }));
  return picksByEvent;
}

// ─── Trigger: a player's pick for one game was saved, changed, or
// removed ────────────────────────────────────────────────────────────
// Maintains a denormalized picksByEvent summary directly on the week's
// own pickSlates/{slateId} doc — the same doc every client render
// already fetches (gpGetSlateDoc) — so reading "everyone's picks for
// this week" becomes a read the client is already making instead of a
// separate 1-read-per-player fan-out (gpGetAllPicksForSlate in
// split/gp-data.js, which reads every player's own games subcollection
// individually). That fan-out is what was timing page loads out for
// leagues with more than a handful of members; this removes it entirely
// for any week this function has touched.
//
// Shape: picksByEvent.{eventId}.{playerId} = { uid, name, side, updatedAt }.
//
// A slate that already had picks on it BEFORE this function existed
// would otherwise start with an empty/partial summary — the first
// player to save after deploy would make picksByEvent non-null but
// containing only THEIR pick, silently hiding everyone else's
// already-saved picks from any reader that trusts the summary. So the
// first write this function ever sees for a given slate does a full,
// one-time fan-out (buildFullPicksByEvent, above) instead of a
// single-leaf update, guaranteeing the summary starts complete. Every
// write after that just updates its own leaf — a plain {merge:true} on
// a nested object only touches the paths provided, so concurrent saves
// from different players never clobber each other's entries. (Two
// players saving for the very first time on the same slate within
// moments of each other can both see "not migrated yet" and both run
// the full backfill — redundant but harmless, since both backfills
// read the same up-to-date data and merge to the same result.)
//
// The client falls back to the old per-player fan-out whenever
// picksByEvent is missing entirely (same gpGetAllPicksForSlate) — pure
// belt-and-suspenders once a slate has any pick doc at all, every write
// to it runs through here and gets backfilled on first touch. The
// per-game subcollection docs remain the source of truth throughout —
// this is a derived cache sitting next to them, never the only copy.
exports.onPickGameWritten = onDocumentWritten(
  "pickSlates/{slateId}/picks/{playerId}/games/{eventId}",
  async (event) => {
    const { slateId, playerId, eventId } = event.params;
    const slateRef = db.collection("pickSlates").doc(slateId);
    const slateSnap = await slateRef.get();
    const alreadyMigrated = slateSnap.exists && slateSnap.data()?.picksByEvent != null;

    if (!alreadyMigrated) {
      const picksByEvent = await buildFullPicksByEvent(slateId);
      await slateRef.set({ picksByEvent }, { merge: true });
      return;
    }

    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!after) {
      // Deleted (e.g. the "merge duplicate player" admin tool moving a
      // duplicate's picks onto the surviving player) — drop just this
      // one leaf, not the whole event's map.
      await slateRef.update({
        [`picksByEvent.${eventId}.${playerId}`]: FieldValue.delete(),
      }).catch((err) => {
        logger.warn(`[onPickGameWritten] delete cleanup failed for ${slateId}/${eventId}/${playerId}: ${err.message}`);
      });
      return;
    }

    await slateRef.set({
      picksByEvent: {
        [eventId]: {
          [playerId]: {
            uid: String(after.uid || playerId),
            name: String(after.name || "Someone"),
            side: String(after.side || ""),
            updatedAt: after.updatedAt || FieldValue.serverTimestamp(),
          },
        },
      },
    }, { merge: true });
  }
);

// Same scoreboard endpoints gp-espn.js uses client-side — kept in sync
// by hand since this runs in a separate Node runtime, not the browser.
const LEAGUE_ENDPOINTS = {
  ncaam: (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=50&limit=200`,
  nba:   (date) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}`,
  nhl:   (date) => `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${date}`,
  mls:   (date) => `https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard?dates=${date}`,
  nfl:   (date) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${date}`,
  cfb:   (date) => `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=${date}`,
  mlb:   (date) => `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${date}`,
  pga:   (date) => `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${date}`,
};

// Mirrors buildTeam() in gp-admin.js (a browser-only module, not
// requirable from a Cloud Function, hence the separate copy). A playoff
// game can get added to a week while one or both slots are still a
// placeholder — e.g. "White Sox/Astros" — because the prior round
// hasn't finished; buildTeam() only ever runs once, at add-time, so
// without this the placeholder is what's stuck on the game doc forever,
// even after ESPN resolves the real matchup. Picks are stored purely as
// side: "home"/"away" (never a team name or id), so refreshing this on
// every sync tick — the same way scores and odds already are — is safe:
// it only ever corrects what's displayed for a side, never touches an
// existing pick.
function pickTeamLogo(teamObj) {
  const l1 = teamObj?.logo;
  const l2 = Array.isArray(teamObj?.logos) ? teamObj.logos[0]?.href : "";
  return String(l1 || l2 || "");
}
function pickTeamRecord(competitor) {
  const recs = Array.isArray(competitor?.records) ? competitor.records : [];
  const total = recs.find((r) => r?.type === "total") || recs[0];
  return String(total?.summary || "");
}
function pickTeamRank(competitor, teamObj) {
  const r = competitor?.curatedRank?.current ?? competitor?.rank ?? teamObj?.rank ?? "";
  const n = Number(r);
  return Number.isFinite(n) && n >= 1 && n <= 25 ? n : null;
}
function buildTeamFromCompetitor(competitor) {
  const team = competitor?.team || {};
  return {
    id:       String(team?.id || ""),
    name:     String(team?.displayName || team?.name || ""),
    nickname: String(team?.name || team?.shortDisplayName || ""),
    abbr:     String(team?.abbreviation || ""),
    logo:     pickTeamLogo(team),
    record:   pickTeamRecord(competitor),
    rank:     pickTeamRank(competitor, team),
    homeAway: String(competitor?.homeAway || ""),
  };
}
function getEventTeams(ev) {
  try {
    const comp = ev?.competitions?.[0] || null;
    if (!comp) return null;
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const homeC = competitors.find((c) => c?.homeAway === "home");
    const awayC = competitors.find((c) => c?.homeAway === "away");
    if (!homeC || !awayC) return null;
    const homeTeam = buildTeamFromCompetitor(homeC);
    const awayTeam = buildTeamFromCompetitor(awayC);
    // No usable id on either side yet (still a bare TBD slot with
    // nothing real to show) — nothing worth writing this tick.
    if (!homeTeam.id || !awayTeam.id) return null;
    return { homeTeam, awayTeam };
  } catch {
    return null;
  }
}

// Mirrors what gp-espn.js used to parse client-side from the same
// ESPN scoreboard event shape.
function getEventLiveInfo(ev) {
  try {
    const comp = ev?.competitions?.[0] || {};
    const statusType = comp?.status?.type || {};
    const state = String(statusType?.state || "").toLowerCase();
    const detail = String(statusType?.shortDetail || statusType?.detail || "").trim();
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const homeC = competitors.find((c) => c?.homeAway === "home") || {};
    const awayC = competitors.find((c) => c?.homeAway === "away") || {};
    return {
      state,
      detail,
      homeScore: Number(homeC?.score),
      awayScore: Number(awayC?.score),
    };
  } catch {
    return null;
  }
}

// Mirrors gpGetEventOddsFromScoreboardEvent (and its gpParseOddsFromPickcenter
// fallback) from gp-espn.js — same scoreboard event, so no extra fetch needed.
// Doesn't port the client's summary-endpoint fallback for events with no
// odds/pickcenter block at all; that was a rare-case safety net, not the
// common path, and would mean one extra HTTP call per such game per run.
function cleanFavoredText(s) {
  return String(s || "").trim()
    .replace(/^Line:\s*/i, "").replace(/^Spread:\s*/i, "").replace(/^Odds:\s*/i, "").trim();
}
function normalizeNumberString(n) {
  return (n === null || n === undefined || n === "") ? "" : String(n).trim();
}
// Same signed-spread-relative-to-home logic as buildOdds() in gp-admin.js
// (a browser-only module, not requirable from a Cloud Function, hence the
// separate copy) — spread is negative when the home team is favored.
// Falls back to pulling the magnitude out of the details text when the
// favorite is only indicated by a boolean flag, not a signed number.
function deriveSpread(oddsObj, detailsText) {
  const spreadRaw = Number(oddsObj?.spread ?? oddsObj?.line ?? oddsObj?.handicap);
  const homeFav = !!oddsObj?.homeTeamOdds?.favorite;
  const awayFav = !!oddsObj?.awayTeamOdds?.favorite;
  if (Number.isFinite(spreadRaw) && spreadRaw !== 0) {
    return { spreadValue: Math.abs(spreadRaw), spreadFavoredSide: spreadRaw < 0 ? "home" : "away" };
  }
  if (homeFav || awayFav) {
    const m = String(detailsText || "").match(/-\s*(\d+(\.\d+)?)/);
    if (m) return { spreadValue: Number(m[1]), spreadFavoredSide: homeFav ? "home" : "away" };
  }
  return { spreadValue: null, spreadFavoredSide: "" };
}
function parseOddsFromPickcenter(pc) {
  if (!pc) return null;
  const overUnder = normalizeNumberString(pc.overUnder ?? pc.total ?? pc.overunder ?? "");
  const detailsRaw = cleanFavoredText(pc.details || pc.displayValue || pc.awayTeamOdds?.details || pc.homeTeamOdds?.details || "");
  if (detailsRaw || overUnder) {
    const { spreadValue, spreadFavoredSide } = deriveSpread(pc, detailsRaw);
    return { details: detailsRaw, overUnder, spreadValue, spreadFavoredSide };
  }
  const spreadNum = Number(pc.spread ?? pc.line ?? pc.handicap);
  if (!Number.isFinite(spreadNum)) return null;
  const homeFav = !!pc.homeTeamOdds?.favorite;
  const awayFav = !!pc.awayTeamOdds?.favorite;
  const favoredTeam = homeFav ? "Home" : awayFav ? "Away" : (spreadNum < 0 ? "Home" : "Away");
  const abs = Math.abs(spreadNum);
  const spreadVal = abs % 1 === 0 ? String(abs.toFixed(0)) : String(abs);
  return {
    details: `${favoredTeam} -${spreadVal}`,
    overUnder,
    spreadValue: abs,
    spreadFavoredSide: spreadNum < 0 ? "home" : "away",
  };
}
function getEventOdds(ev) {
  try {
    const comp = ev?.competitions?.[0] || null;
    if (!comp) return null;
    const o = Array.isArray(comp?.odds) && comp.odds.length ? comp.odds[0] : null;
    if (o) {
      const details = cleanFavoredText(o?.details || o?.displayValue || "");
      const overUnder = normalizeNumberString(o?.overUnder ?? o?.total ?? "");
      if (details || overUnder) {
        const { spreadValue, spreadFavoredSide } = deriveSpread(o, details);
        return { details, overUnder, spreadValue, spreadFavoredSide };
      }
    }
    const pc = Array.isArray(comp?.pickcenter) && comp.pickcenter.length ? comp.pickcenter[0] : null;
    const fromPc = parseOddsFromPickcenter(pc);
    if (fromPc && (fromPc.details || fromPc.overUnder)) return fromPc;
    return null;
  } catch {
    return null;
  }
}

// Polls ESPN for every not-yet-final game in a published Pick'em week
// and writes scores + odds straight into Firestore. This replaces the
// old client-side path, which only ever persisted a final score if an
// admin happened to have the app open right after a game ended — a
// non-admin viewer's browser couldn't write the game doc at all
// (Firestore rules only allow admins to write pickSlates/*/games/*), and
// nobody's browser wrote anything if the app just wasn't open. The Admin
// SDK used here bypasses those rules entirely, so this runs reliably on
// its own schedule regardless of who is or isn't looking at the page.
//
// Unlike scores, odds are meaningful well before kickoff (a line can be
// set days out), so every not-final game in a published week is synced
// every run — not just ones close to starting.
exports.syncPickemScores = onSchedule(
  { schedule: "every 1 minutes", timeZone: "America/New_York" },
  async () => {
    const slatesSnap = await db.collection("pickSlates").where("published", "==", true).get();
    if (slatesSnap.empty) {
      logger.info("[syncPickemScores] no published weeks");
      return;
    }

    // Group not-yet-final games by leagueKey + date so each ESPN
    // scoreboard call (one per league per day) covers every game that
    // needs it, instead of one call per game. Also tracks, per slate,
    // everything needed to notice "every game in this week is now
    // final" once the writes below land — checked after the batch
    // commits, not here, since a game can only join finalGameIds once
    // we know the actual result.
    const groups = new Map();
    const slateMeta = new Map();
    for (const slateDoc of slatesSnap.docs) {
      const slateData = slateDoc.data();
      const meta = {
        ref: slateDoc.ref,
        leagueId: String(slateData.leagueId || ""),
        label: String(slateData.label || slateDoc.id),
        alreadyNotified: !!slateData.finalNotifiedAt,
        totalGames: 0,
        finalGameIds: new Set(),
      };
      slateMeta.set(slateDoc.id, meta);

      const gamesSnap = await slateDoc.ref.collection("games").get();
      meta.totalGames = gamesSnap.size;
      for (const gameDoc of gamesSnap.docs) {
        const g = gameDoc.data();
        const eventId = String(g.eventId || gameDoc.id);
        if (g.finalState === "post") { meta.finalGameIds.add(eventId); continue; }
        const leagueKey = String(g.leagueKey || "");
        const date = String(g.dateYYYYMMDD || "");
        if (!leagueKey || !date || !LEAGUE_ENDPOINTS[leagueKey]) continue;
        const key = `${leagueKey}__${date}`;
        if (!groups.has(key)) groups.set(key, { leagueKey, date, games: [] });
        groups.get(key).games.push({
          ref: gameDoc.ref,
          eventId,
          slateId: slateDoc.id,
          closingLocked: g.closingSpreadValue != null,
        });
      }
    }

    if (!groups.size) {
      logger.info("[syncPickemScores] no games due for a sync");
    } else {
      const batch = db.batch();
      let writes = 0;

      for (const { leagueKey, date, games } of groups.values()) {
        let events = [];
        try {
          const res = await fetch(LEAGUE_ENDPOINTS[leagueKey](date));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          events = Array.isArray(json?.events) ? json.events : [];
        } catch (err) {
          logger.warn(`[syncPickemScores] fetch failed for ${leagueKey} ${date}: ${err.message}`);
          continue;
        }

        const byId = new Map(events.map((ev) => [String(ev?.id || ""), ev]));
        for (const { ref, eventId, slateId, closingLocked } of games) {
          const ev = byId.get(eventId);
          if (!ev) continue;
          const info = getEventLiveInfo(ev);
          const odds = getEventOdds(ev);
          const teams = getEventTeams(ev);
          if (!info && !odds && !teams) continue;

          const update = {};
          if (teams) {
            update.homeTeam = teams.homeTeam;
            update.awayTeam = teams.awayTeam;
            update.homeName = teams.homeTeam.name || "Home";
            update.awayName = teams.awayTeam.name || "Away";
          }
          if (odds) {
            update.liveOddsDetails = odds.details || "";
            update.liveOddsOverUnder = odds.overUnder || "";
            update.liveOddsUpdatedAt = FieldValue.serverTimestamp();
            if (odds.spreadValue != null) {
              update.liveSpreadValue = odds.spreadValue;
              update.liveSpreadFavoredSide = odds.spreadFavoredSide;
            }
          }
          // Lock the "closing line" the first time this game is seen as no
          // longer pre-game — everything above keeps refreshing right up
          // until kickoff (a line can move for days before that), but once
          // the game actually starts the spread used for grading AND for
          // display needs to stop moving, or picks saved against one line
          // end up graded against a different one than what was pinned to
          // the scorecard when they were made. Guarded by closingLocked (set
          // from the already-stored closingSpreadValue at the top of this
          // run) so it only ever gets written once per game.
          if (!closingLocked && odds && odds.spreadValue != null && info && info.state !== "pre") {
            update.closingSpreadValue = odds.spreadValue;
            update.closingSpreadFavoredSide = odds.spreadFavoredSide;
            update.closingOddsDetails = odds.details || "";
            update.closingOddsOverUnder = odds.overUnder || "";
            update.closingLockedAt = FieldValue.serverTimestamp();
          }
          if (info) {
            if (info.state === "post" && Number.isFinite(info.homeScore) && Number.isFinite(info.awayScore)) {
              update.finalHomeScore = info.homeScore;
              update.finalAwayScore = info.awayScore;
              update.finalState = "post";
              update.finalizedAt = FieldValue.serverTimestamp();
              slateMeta.get(slateId)?.finalGameIds.add(eventId);
            } else {
              // Not final yet — persist live state too. The app reads this
              // (gpApplyStoredLiveState in gp-espn.js) instead of calling
              // ESPN itself on every render.
              update.liveState = info.state;
              update.liveDetail = info.detail || "";
              update.liveHomeScore = Number.isFinite(info.homeScore) ? info.homeScore : null;
              update.liveAwayScore = Number.isFinite(info.awayScore) ? info.awayScore : null;
              update.liveUpdatedAt = FieldValue.serverTimestamp();
            }
          }
          batch.set(ref, update, { merge: true });
          writes++;
        }
      }

      if (writes) await batch.commit();
      logger.info(`[syncPickemScores] updated ${writes} game(s) across ${groups.size} league/date group(s)`);
    }

    // Notify league members once a week's games are all final. Checked
    // every run — not only runs that had score writes — so a
    // notification that fails to send on the run that finalizes the
    // last game gets retried on the next run instead of being silently
    // dropped forever (a slate is only marked finalNotifiedAt after a
    // successful send).
    for (const [slateId, meta] of slateMeta.entries()) {
      if (meta.alreadyNotified || !meta.leagueId || !meta.totalGames) continue;
      if (meta.finalGameIds.size < meta.totalGames) continue;
      try {
        await notifyLeagueMembers(meta.leagueId, {
          title: `🏁 ${meta.label} is final!`,
          body: "Check the leaderboard to see how you did.",
        });
        await meta.ref.set({ finalNotifiedAt: FieldValue.serverTimestamp() }, { merge: true });
      } catch (err) {
        logger.warn(`[syncPickemScores] final-week notification failed for ${slateId}: ${err.message}`);
      }
    }
  }
);

// ─── Trigger: picks locking soon ──────────────────────────────────────
// Reminds a league member if they have an open (not-yet-locked) game
// pick or the tiebreaker guess missing, once its deadline is within the
// next hour. Runs every 15 minutes rather than every 1 — a reminder
// doesn't need minute-level precision the way a live score does, so this
// only checks members at all when something is actually closing soon,
// keeping the common (nothing closing soon right now) case a single
// cheap games-collection read per published week.
//
// Reminds once per player per week (pickSlates/{slateId}/reminders/
// {playerId}), not once per game — a player with an open Thursday game
// and a separate open Monday game only gets the one reminder, for
// whichever closes soon first. Simpler than per-game dedup and good
// enough for a "don't forget" nudge; can be split out later if that
// turns out to actually miss people.
const LOCK_REMINDER_WINDOW_MS = 60 * 60 * 1000;

exports.sendLockReminders = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/New_York" },
  async () => {
    const slatesSnap = await db.collection("pickSlates").where("published", "==", true).get();
    if (slatesSnap.empty) return;

    const now = Date.now();
    let remindersSent = 0;

    for (const slateDoc of slatesSnap.docs) {
      const slateData = slateDoc.data();
      const leagueId = String(slateData.leagueId || "");
      if (!leagueId) continue;

      const gamesSnap = await slateDoc.ref.collection("games").get();
      const closingSoon = gamesSnap.docs
        .map((d) => {
          const g = d.data();
          const startMs = g.startTime?.toMillis ? g.startTime.toMillis() : 0;
          return { eventId: String(g.eventId || d.id), startMs, isFinal: g.finalState === "post" };
        })
        .filter((g) => g.startMs && !g.isFinal && g.startMs > now && g.startMs <= now + LOCK_REMINDER_WINDOW_MS);

      const tiebreakerEventId = String(slateData.tiebreakerEventId || "");
      const tiebreakerLockMs = slateData.tiebreakerLockAt?.toMillis ? slateData.tiebreakerLockAt.toMillis() : 0;
      const tiebreakerClosingSoon = !!(tiebreakerEventId && tiebreakerLockMs
        && tiebreakerLockMs > now && tiebreakerLockMs <= now + LOCK_REMINDER_WINDOW_MS);

      if (!closingSoon.length && !tiebreakerClosingSoon) continue;

      const membersSnap = await db.collection("leagues").doc(leagueId).collection("members").get();
      if (membersSnap.empty) continue;

      for (const memberDoc of membersSnap.docs) {
        const playerId = memberDoc.id;
        const reminderRef = slateDoc.ref.collection("reminders").doc(playerId);
        const reminderSnap = await reminderRef.get();
        if (reminderSnap.exists) continue; // already reminded for this week

        const picksGamesSnap = await slateDoc.ref.collection("picks").doc(playerId).collection("games").get();
        const pickedEventIds = new Set(picksGamesSnap.docs.map((d) => d.id));
        const missingGames = closingSoon.filter((g) => !pickedEventIds.has(g.eventId));

        let missingTiebreaker = false;
        if (tiebreakerClosingSoon) {
          const picksDoc = await slateDoc.ref.collection("picks").doc(playerId).get();
          missingTiebreaker = !Number.isFinite(Number(picksDoc.data()?.tiebreakerGuess));
        }

        if (!missingGames.length && !missingTiebreaker) continue;

        const parts = [];
        if (missingGames.length) parts.push(`${missingGames.length} pick${missingGames.length !== 1 ? "s" : ""}`);
        if (missingTiebreaker) parts.push("the tiebreaker");

        try {
          const result = await sendPushToPlayerIds([playerId], {
            title: "⏰ Picks locking soon",
            body: `${parts.join(" and ")} locking soon in ${String(slateData.label || "")} — don't miss out!`,
          });
          if (result.sent) remindersSent++;
        } catch (err) {
          logger.warn(`[sendLockReminders] send failed for ${playerId}: ${err.message}`);
        }
        // Marked whether or not the send actually succeeded — a player
        // with no tokens registered (never enabled notifications) would
        // otherwise get re-evaluated every 15 minutes for the rest of
        // the window for no reason.
        await reminderRef.set({ remindedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    }

    logger.info(`[sendLockReminders] sent ${remindersSent} reminder(s)`);
  }
);
