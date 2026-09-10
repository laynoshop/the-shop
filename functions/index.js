const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ─── push notifications ──────────────────────────────────────────────
// Shared by every notification trigger (test-send now, the real
// League-announcement/lock-reminder/week-published/final-score triggers
// later): looks up each player's stored FCM tokens (players/{playerId}
// .fcmTokens, written by gpNotifEnable in split/gp-notifications.js) and
// sends one multicast push. Tokens FCM reports as no-longer-registered
// (uninstalled app, revoked permission, etc.) are cleaned up from the
// player doc so they stop being retried.
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
    notification,
    data: data || {},
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
function parseOddsFromPickcenter(pc) {
  if (!pc) return null;
  const overUnder = normalizeNumberString(pc.overUnder ?? pc.total ?? pc.overunder ?? "");
  const detailsRaw = cleanFavoredText(pc.details || pc.displayValue || pc.awayTeamOdds?.details || pc.homeTeamOdds?.details || "");
  if (detailsRaw || overUnder) return { details: detailsRaw, overUnder };
  const spreadNum = Number(pc.spread ?? pc.line ?? pc.handicap);
  if (!Number.isFinite(spreadNum)) return null;
  const homeFav = !!pc.homeTeamOdds?.favorite;
  const awayFav = !!pc.awayTeamOdds?.favorite;
  const favoredTeam = homeFav ? "Home" : awayFav ? "Away" : (spreadNum < 0 ? "Home" : "Away");
  const abs = Math.abs(spreadNum);
  const spreadVal = abs % 1 === 0 ? String(abs.toFixed(0)) : String(abs);
  return { details: `${favoredTeam} -${spreadVal}`, overUnder };
}
function getEventOdds(ev) {
  try {
    const comp = ev?.competitions?.[0] || null;
    if (!comp) return null;
    const o = Array.isArray(comp?.odds) && comp.odds.length ? comp.odds[0] : null;
    if (o) {
      const details = cleanFavoredText(o?.details || o?.displayValue || "");
      const overUnder = normalizeNumberString(o?.overUnder ?? o?.total ?? "");
      if (details || overUnder) return { details, overUnder };
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
    // needs it, instead of one call per game.
    const groups = new Map();
    for (const slateDoc of slatesSnap.docs) {
      const gamesSnap = await slateDoc.ref.collection("games").get();
      for (const gameDoc of gamesSnap.docs) {
        const g = gameDoc.data();
        if (g.finalState === "post") continue;
        const leagueKey = String(g.leagueKey || "");
        const date = String(g.dateYYYYMMDD || "");
        if (!leagueKey || !date || !LEAGUE_ENDPOINTS[leagueKey]) continue;
        const key = `${leagueKey}__${date}`;
        if (!groups.has(key)) groups.set(key, { leagueKey, date, games: [] });
        groups.get(key).games.push({ ref: gameDoc.ref, eventId: String(g.eventId || gameDoc.id) });
      }
    }

    if (!groups.size) {
      logger.info("[syncPickemScores] no games due for a sync");
      return;
    }

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
      for (const { ref, eventId } of games) {
        const ev = byId.get(eventId);
        if (!ev) continue;
        const info = getEventLiveInfo(ev);
        const odds = getEventOdds(ev);
        if (!info && !odds) continue;

        const update = {};
        if (odds) {
          update.liveOddsDetails = odds.details || "";
          update.liveOddsOverUnder = odds.overUnder || "";
          update.liveOddsUpdatedAt = FieldValue.serverTimestamp();
        }
        if (info) {
          if (info.state === "post" && Number.isFinite(info.homeScore) && Number.isFinite(info.awayScore)) {
            update.finalHomeScore = info.homeScore;
            update.finalAwayScore = info.awayScore;
            update.finalState = "post";
            update.finalizedAt = FieldValue.serverTimestamp();
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
);
