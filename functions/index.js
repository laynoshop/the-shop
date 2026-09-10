const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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

// Mirrors gpGetEventLiveInfoFromScoreboardEvent in split/gp-espn.js.
function getEventLiveInfo(ev) {
  try {
    const comp = ev?.competitions?.[0] || {};
    const state = String(comp?.status?.type?.state || "").toLowerCase();
    const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
    const homeC = competitors.find((c) => c?.homeAway === "home") || {};
    const awayC = competitors.find((c) => c?.homeAway === "away") || {};
    return {
      state,
      homeScore: Number(homeC?.score),
      awayScore: Number(awayC?.score),
    };
  } catch {
    return null;
  }
}

// Polls ESPN for every game in a published-but-not-fully-final Pick'em
// week and writes scores straight into Firestore. This replaces the old
// client-side path (gpPersistFinalScores in gp-espn.js), which only ever
// ran if an admin happened to have the app open right after a game ended
// — a non-admin viewer's browser couldn't write the game doc at all
// (Firestore rules only allow admins to write pickSlates/*/games/*), and
// nobody's browser wrote anything if the app just wasn't open. The Admin
// SDK used here bypasses those rules entirely, so this runs reliably on
// its own schedule regardless of who is or isn't looking at the page.
exports.syncPickemScores = onSchedule(
  { schedule: "every 3 minutes", timeZone: "America/New_York" },
  async () => {
    const slatesSnap = await db.collection("pickSlates").where("published", "==", true).get();
    if (slatesSnap.empty) {
      logger.info("[syncPickemScores] no published weeks");
      return;
    }

    const now = Date.now();
    const LOOKAHEAD_MS = 15 * 60 * 1000; // start polling a game 15 min before kickoff

    // Group not-yet-final games by leagueKey + date so each ESPN
    // scoreboard call (one per league per day) covers every game that
    // needs it, instead of one call per game.
    const groups = new Map();
    for (const slateDoc of slatesSnap.docs) {
      const gamesSnap = await slateDoc.ref.collection("games").get();
      for (const gameDoc of gamesSnap.docs) {
        const g = gameDoc.data();
        if (g.finalState === "post") continue;
        const startMs = g.startTime?.toMillis ? g.startTime.toMillis() : 0;
        if (!startMs || startMs > now + LOOKAHEAD_MS) continue;
        const leagueKey = String(g.leagueKey || "");
        const date = String(g.dateYYYYMMDD || "");
        if (!leagueKey || !date || !LEAGUE_ENDPOINTS[leagueKey]) continue;
        const key = `${leagueKey}__${date}`;
        if (!groups.has(key)) groups.set(key, { leagueKey, date, games: [] });
        groups.get(key).games.push({ ref: gameDoc.ref, eventId: String(g.eventId || gameDoc.id) });
      }
    }

    if (!groups.size) {
      logger.info("[syncPickemScores] no games due for a score check");
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
        if (!info) continue;

        if (info.state === "post" && Number.isFinite(info.homeScore) && Number.isFinite(info.awayScore)) {
          batch.set(ref, {
            finalHomeScore: info.homeScore,
            finalAwayScore: info.awayScore,
            finalState: "post",
            finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          // Not final yet — persist live state too. Nothing reads these
          // fields client-side today, but they're the foundation for a
          // follow-up that has the app read from Firestore here instead
          // of every visitor's browser separately calling ESPN on load.
          batch.set(ref, {
            liveState: info.state,
            liveHomeScore: Number.isFinite(info.homeScore) ? info.homeScore : null,
            liveAwayScore: Number.isFinite(info.awayScore) ? info.awayScore : null,
            liveUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        writes++;
      }
    }

    if (writes) await batch.commit();
    logger.info(`[syncPickemScores] updated ${writes} game(s) across ${groups.size} league/date group(s)`);
  }
);
