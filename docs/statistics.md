# Player statistics

Statistics version 3 counts completed **challenges**, separately from UTC
**participation days**. Winning, running out of guesses and revealing the answer
all complete a challenge. Merely opening or abandoning one does not.

- `games`: completed challenges, including retained legacy games.
- `wins`: winning guesses histogram across all difficulties, not a difficulty-adjusted skill measure.
- `byDifficulty`: completed challenges, wins, points, reveal count and winning
  guesses histogram. Expert has three buckets; the other modes have five.
- `daysCompleted`: unique challenge UTC dates with a completion.
- `currentStreak` / `maxStreak`: consecutive participation dates. Late saves
  credit their challenge date, not their arrival date. The stored current run is
  historical; both gameplay and Profile project an expired run to zero using
  the server clock. Profile refreshes at server midnight and on app foreground.
- `allFiveCompleted` / `allFiveSolved`: dates when all five published difficulty
  slots were completed / won. Legacy date-only games never substitute for one
  of these slots, but still count toward participation and difficulty totals.
- `allTimeScore`: accumulated saved points, not an average or skill rating.
- `hintsUsedCount`: optional Easy hints spent, including unfinished games.
  Earned Medium clues are not hint spending. The old `hintsAvailable` field is
  retained for compatibility; actual availability comes from the current game.

## Storage and consistency

`players/{uid}/games/movies_{challengeId}` remains authoritative. Completion,
history, summary and calendar changes commit in the same transaction; replaying
an action does not award a second result. History retains its date + document ID
cursor, so five results on one date paginate correctly.

`players/{uid}/privateStats/summary` is a bounded aggregate. Calendar arrays are
not stored in it or sent with gameplay responses. Calendar detail lives in
`players/{uid}/statisticsCalendar/{YYYY}`, with at most 366 dates per document.
Each date records completed and solved published difficulties. A completion
reads the account's yearly partitions to rebuild calendar metrics; only changed
partitions are written. Ordinary guesses, hints and Profile reads do not read
calendar history after migration. This trades one calendar read per active year
on completion for simple, deterministic handling of late results and imports.
If very long account histories make that cost material, measure it before
introducing incremental streak range bookkeeping.

Summary and calendar fields have indexing exemptions because they are never
queried by value. Large game snapshots/action arrays are also exempt; game and
calendar lookup/order use document IDs. Calendar documents are server-only.
Account deletion already recursively deletes the player subtree, including the
new partitions.

Merge verification streams games in document order with a checkpoint containing
at most one day's membership. It compares bounded lifetime summaries and checks
history in both directions before modifying destination player data. Copy pages
hydrate the destination calendar, import nonconflicting games, and atomically
save aggregates, changed partitions and the cursor. Final retirement and
administrative reconciliation compare the same bounded summary shape.

## Existing accounts and rollout

Accounts without `statisticsVersion: 3` are upgraded lazily, inside a transaction,
on a statistics/gameplay read or action. The migration scans retained server-owned
games in 100-record query pages, validates them, and rebuilds all difficulty and
calendar metrics using the new rules. Legacy wins, losses and reveals all earn
participation credit, so historical streaks may increase. Earned score, completed
challenge count, winning guesses and spent hints must match the old totals;
otherwise migration stops for review rather than resetting progress. Transaction
failure leaves the old summary intact; retry is safe. No production records are
changed merely by merging this code.

Deploy functions and index configuration before releasing the updated client:
Profile now calls `getPlayerStatistics`. Release the client together with this
schema change; older clients that depend on `allFiveDays` must update to the new
counter. Drain pending account merges before switching worker versions (live
merge creation is currently disabled). Monitor migration errors and latency;
very large historical accounts may need an operator-assisted rebuild if their
one-time migration exceeds transaction/runtime limits. Old top-level
`playerGames`/`playerStats` collections remain outside automatic migration:
ambiguous ownership or missing authoritative games still require explicit review.

## Product analytics

`challenge_started` and `challenge_completed` carry challenge ID and difficulty;
completion also includes outcome, guesses and score. Logging happens after a
confirmed callable response, including pending-action replay. A bounded local
three-day receipt suppresses duplicate delivery on that device. Opening a saved
result does not emit a completion. Storage/telemetry failures never block play.
These are best-effort client events, not exactly-once cross-device accounting;
use authoritative game records for exact counts or balancing analysis.
