# Saved-game history pagination

Finding 30 previously exposed only the newest 20 completed games. History now
provides Older games, Newer games and Refresh history controls. Each page renders
at most 20 results, ordered by UTC day and document ID, newest first. One extra
query result determines whether another page exists; exactly 20 results do not
produce an empty trailing page. Only cursors, rather than all prior rows, remain
in memory while navigating.

## Contract and recovery

`gameService.fetchGameHistory(uid, cursor)` returns `{ entries, next }`. The
cursor includes its account, day and document ID. The service validates it and
checks the active account before and after the Firestore request. Profile history
is remounted on account changes and confirmed completion-count changes, so old
rows/cursors disappear and late responses are ignored. Manual refresh returns to
the newest page. Failed older-page requests can retry that page or return to a
newer page. Paging does not depend on today's challenge being available.

Firestore permits only owner reads outside account deletion/merge barriers. V2
history list queries now require a limit of at most 21; individual owner reads
remain allowed. The old client query with `limit(20)` remains compatible. Rules
must be staged and deployed through the existing release process; no live rules
were changed during this work.

The cursor is a position, not a frozen database snapshot. Newly completed or
imported games appear on refresh; a concurrent insertion does not shift the
position of subsequent older-page queries as an offset would. This change does
not migrate legacy history or guarantee a live cross-device view without refresh.

## Evidence

- 35 tests pass across `gameHistory.test.tsx`, `gameService.test.ts` and
  `profile_screen.test.tsx`; app TypeScript passes. Tests cover bounded lookahead,
  exact page boundaries, malformed/foreign cursors, account changes during reads,
  navigation/refresh, retrying the failed older page, and ignoring late page
  responses after an account change or confirmed completion.
- All 11 tests in `integration/tests/rules.test.mjs` pass against the actual
  isolated Firestore emulator. The new test reads 45 entries, including tied
  dates, across three pages without skips or duplicates. A newer completion
  inserted after the first page does not alter the remaining traversal and is
  returned on refresh. Unbounded, over-limit, signed-out and cross-account page
  requests are rejected. Existing deletion/merge barriers and write denials pass.
- Installed source-built Android API 36, x86_64, 16 KB emulator: a new isolated
  Android user 11 and demo guest receive 45 explicitly synthetic history records
  and corresponding immutable games. Pages begin with fixtures 01, 21 and 41;
  page 3 has no Older games control. Fixture 45 opens its saved score (490) and
  synthetic clue. Newer games returns to page 2; Refresh returns to page 1.
- At 200% text, page controls wrap/fit and the actual Older games tap loads page
  2. Screenshot review confirms the control labels and first row are readable.
  This is not a TalkBack or broad large-title/device accessibility pass.
- All nine prior accounts and 30 documents retain their captured metadata and
  document hashes. All ten accounts/123 documents match the seeded baseline
  after browsing. The fixtures do not simulate earning 45 wins: aggregate
  statistics were deliberately not seeded, and no scoring assertion is inferred.
- All 56 native library hashes match the preceding keyboard artifact. The 19
  known RELRO failures remain. The final test-user process log has no
  `MissingViewState`, `addViewAt` or `FATAL EXCEPTION` matches.

The new Android user initially could not open the package because it had not
been enabled for that profile. `install-existing --user 11` resolved that setup
failure before any native acceptance checks. No app data was cleared.

## Reproduction and local artifacts

Focused tests:

```text
node node_modules/jest/bin/jest.js --runInBand --watch=false --coverage=false --runTestsByPath __tests__/components/gameHistory.test.tsx __tests__/services/gameService.test.ts "__tests__/app/(tabs)/profile_screen.test.tsx"
node node_modules/typescript/bin/tsc --noEmit
```

The rules suite runs through the guarded integration emulator workflow described
in [emulator testing](../emulator-testing.md). This run used a local wrapper to execute only the
affected rules suite against `demo-talkie-trivia-test`, port 8180. Production
credentials and live Firebase projects were not used.

- APK: `.expo/device-proof/r30-history-pagination/talkie-demo-emulator-only.apk`.
- Signed SHA-256:
  `a14ca61bd2a287ad43bd095e2b8afd7399218a0bc2ca48376f4f8618e8515aed`.
- Unsigned SHA-256:
  `f2aa4b6079b7cf71c806762ec69410f95396adef564c9627e9a2585138716ae8`.
- Build succeeded in 53 seconds (1,037 tasks, 50 executed); emulator-only v2/v3
  signature and 16 KB ZIP alignment pass.
- `.expo/device-proof/history-pagination/` contains successful native XML dumps,
  screenshots, fixture identity, process log and `verified.json`.
- `.expo/device-proof/r30-session-refresh/history-{seeded,final}.json` and
  `keyboard-final.json` contain the compared account/document hashes.
- `.expo/device-proof/firebase-export-history-final` contains ten exported Auth
  users and nonempty Firestore metadata/data. The local backend launcher imports
  it. User 11 font scale was restored to 1.0 and its data retained; owner user 0
  was restored before emulator/backend shutdown.

These ignored local artifacts support the bounded checks above. They are not
remote CI, signed store builds or production acceptance.

## Remaining acceptance

Legacy history/statistics migration remains a release blocker. Verify staged
indexes/rules, real-device and iOS navigation, screen-reader focus after page
changes, offline/transport failures, and representative long titles. Profile
history remains below account/settings/statistics sections; player testing must
evaluate discovery and browsing effort. Low-end performance budgets remain open.
