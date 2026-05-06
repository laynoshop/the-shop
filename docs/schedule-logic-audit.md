# Sports Schedule Logic Audit — `split/pi.js`

_Audited: 2026-05-06_

---

## Overview

The Pi Scoreboard's schedule/display logic lives in `split/pi.js`. There are two rendering paths that control what appears in the "Shop Teams" panel:

1. **Today's games** — fetched for the current date across all leagues simultaneously
2. **Lookahead (upcoming) games** — fetched for future dates when a Shop Team has no game today

---

## LOOKAHEAD_DAYS — Per-League Config

```js
const LOOKAHEAD_DAYS = {
  cfb:   6,  // looks up to 6 days ahead
  nfl:   6,  // looks up to 6 days ahead
  nhl:   3,
  nba:   3,
  mlb:   3,
  mls:   3,  // looks up to 3 days ahead
  ncaam: 3,
  pga:   3,
};
```

This is the primary control for "Tuesday preview" behavior. If today is Tuesday (day 2) and a Shop Team's MLS game is Saturday (day 4), MLS `LOOKAHEAD_DAYS: 3` means it **will not appear** until Wednesday (3 days away). NFL/CFB with `LOOKAHEAD_DAYS: 6` would show it on Tuesday.

---

## Shop Teams Display Logic (step-by-step)

### Step 1: Fetch today across all leagues
- Uses `primaryDate` = today (or yesterday if current time < 9am)
- For each league, fetches ESPN scoreboard for that date
- Any event that matches a Shop Team is added to `matched[]` as `upcoming: false`

### Step 2: Find missing Shop Teams
- Checks which Shop Teams had no game today → `missingTeams`
- For each missing team's leagues, fires parallel fetches for days 1 through `LOOKAHEAD_DAYS[league]`
- First (closest) future game per team wins → stored in `upcomingByTeam` map

### Step 3: Dedup and combine
- Events already shown today are excluded from upcoming
- Remaining upcoming games added to `matched[]` as `upcoming: true`

### Step 4: Sort
- Live games → Scheduled (today) → Upcoming (future)
- Within upcoming: sorted by date ascending
- Within today's games: sorted by Shop Team priority rank

---

## PGA Special Behavior

PGA uses a different date-selection pattern:

```js
const dow     = now.getDay();         // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const isPostWeek = dow >= 0 && dow <= 3;  // Sun–Wed = "post week"
```

- **Sunday–Wednesday**: Looks back to last Sunday (for ongoing/completed tournament)
- **Thursday–Saturday**: Uses today (tournament in progress or starting)

---

## MLS Behavior

MLS games tend to be **weekends** (Sat/Sun). With `LOOKAHEAD_DAYS: 3`:

| Today (Weekday) | Days until Sat | Shows upcoming? |
|---|---|---|
| Wednesday | 3 | ✅ Yes (edge case — exactly 3) |
| Thursday | 2 | ✅ Yes |
| Friday | 1 | ✅ Yes |
| **Tuesday** | 4 | ❌ No — outside 3-day window |
| **Monday** | 5 | ❌ No |

To show MLS previews starting **Tuesday**, change `mls: 3` → `mls: 5` in `LOOKAHEAD_DAYS`.

---

## NFL/CFB Behavior

With `LOOKAHEAD_DAYS: 6`, NFL and CFB upcoming games will show almost the full week ahead.  
NFL games are Sunday-heavy; CFB games are Saturday-heavy.  
Tuesday → Saturday = 4 days, which is within 6 → **will show on Tuesday**.

---

## Known Risks

1. **MLS lookahead gap**: Tuesday/Monday will not show MLS upcoming games with the current `mls: 3` setting. If the Tuesday preview behavior was expected, `mls` needs to be bumped.
2. **Cross-file after revert**: After reverting `pi.js`, the Columbus Crew game still appeared — this suggests the Crew may have had a game that day (within the 3-day window), not that a non-reverted file was responsible.
3. **9am date rollover**: Before 9am, `primaryDate` uses yesterday. Early-morning refreshes on the shop TV will show the previous day's results until 9am.
4. **No explicit Tuesday-rule code**: There is no hardcoded "show on Tuesday" logic. The preview appearance on any given day is purely determined by `LOOKAHEAD_DAYS` and the calendar distance to the next game.

---

## Recommended Changes (if Tuesday preview for MLS/NFL/CFB is desired)

```js
// In split/pi.js, update LOOKAHEAD_DAYS:
const LOOKAHEAD_DAYS = {
  cfb:   6,   // unchanged — already covers Tue→Sat
  nfl:   6,   // unchanged — already covers Tue→Sun
  nhl:   3,
  nba:   3,
  mlb:   3,
  mls:   5,   // CHANGED from 3 → covers Tue→Sat (4 days) + buffer
  ncaam: 3,
  pga:   3,
};
```

This single change makes MLS behave the same as NFL/CFB for weekly preview purposes.

---

## Files Involved

| File | Role |
|---|---|
| `split/pi.js` | All Pi Scoreboard logic — schedule, display, lookahead |
| `split/scores.js` | Shop App scores tab — separate codebase, does NOT share scheduling logic with pi.js |

The two files are **fully independent**. Changes to `scores.js` have zero effect on Pi Scoreboard behavior and vice versa.
