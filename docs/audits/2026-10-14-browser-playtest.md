# Browser playtest and local development readiness

Session dated October 13 in the user's timezone / October 14 UTC. Tested in
isolated Chromium against the real local Auth, Firestore and compiled Functions
emulators, at 1280×900 and 390×844. No production database writes or deployment.

## Confirmed local blockers fixed

| Finding | Evidence and change |
| --- | --- |
| Account loading failed when only the frontend was running | Reproduced the exact reported message and `accounts:signUp` failing at `localhost:9099` with `ERR_CONNECTION_REFUSED`. Starting Auth and using Retry opened the account. `npm run dev` now owns backend/frontend startup and waits for readiness. |
| No useful daily content for local play | Replaced reliance on one generic synthetic clue with eight original, catalog-backed demo clues and create-only scheduling. Existing saved challenge snapshots remain intact. |
| One daily attempt prevented meaningful iteration | Added a strictly emulator-only server game clock and `dev:day` commands for next day, explicit date, near-midnight and real time. |
| Emulator restart stranded saved guests | Reproduced token invalidation after import. Added explicit local guest-to-demo-account recovery and named fake provider sign-in. Restored the same UID and its saved game. Live sign-in guards remain enforced. |
| Windows shutdown export failed under Metro file watching | Captured completed temporary export followed by rename `EPERM`. Recovered all 12 exported accounts. Launcher now stops Metro before export, uses unique snapshots and only updates its latest pointer after success. A failed save retains the backend and previous snapshots. Subsequent graceful export succeeded with exit code 0. |
| Medium hint copy incorrectly described “successful guesses” | Changed it to explain matching actor, director, genre or decade. A winning guess ends the game, so the old wording was misleading. |
| Browser search input had a landmark role | Changed the web role to `searchbox`, retaining the native search role. |

## Actual playthrough evidence

- Recovered the saved guest and continued its existing Medium game.
- Searched for Finding Nemo by title, submitted it as an incorrect guess, saw
  “Not quite! Try again,” and the clue increased from 7/33 to 14/33 words.
- Searched Toy Story by title/year and won in two guesses. Result: **595 points**.
  Profile showed the two-guess win bucket and matching history entry.
- Selected Easy in Profile, advanced the simulated day, and opened an Easy game.
  Spent director, genre and decade hints. The balance decreased 3 → 2 → 1 → 0;
  the fourth choice had `aria-disabled=true`, while spent hints could be re-viewed.
- Won The Matrix in one guess with three hints. Result: **400 points**, with
  **150 points deducted** explained in the result.
- Moved the server clock to 30 seconds before UTC midnight. The browser showed
  an 18-second countdown after reload, then automatically opened the next day
  with a fresh three-hint allowance.
- Cancelled Give Up with no result recorded; then confirmed it. Ratatouille
  result showed zero guesses, **0 points**, and “Answer revealed.”
- Profile then showed **995 total points, 3 games, current streak 0, max streak 2**.
- After graceful export/import, signing in with the remembered demo name reopened
  the same saved result and retained the three completed games.

Ignored screenshots/text captures are under `.expo/web-playtest/`. Useful captures:
`1791943807734-open` (reported account error), `1791944758162-dump` (desktop game),
`1791944828020-dump` (Medium win), `1791944979247-inspect` (exhausted hints),
`1791944988932-viewport` (mobile-width Easy result), `1791945019946-reload`
(near-midnight countdown), `1791945100105-dump` (automatic new day), and
`1791945125463-dump` (confirmed give-up result).

## Remaining UX improvements

These are improvement candidates, not evidence that the working game must be
blocked from all further local testing.

1. **Choose difficulty before first play.** The first game starts and locks Medium
   before a new player discovers Profile preferences. A first-game choice would
   let inexperienced players begin with Easy.
2. **Reduce Give Up's visual prominence.** It is a full-width red button directly
   beneath the search field. Keep confirmation, but make it a secondary action.
3. **Tighten the layout.** A short initial clue occupies a large reserved area;
   mobile result scoring prose fills much of the first screen before the movie
   details. Test a compact summary with optional explanation.
4. **Make preview discoverable on desktop.** Long-press is explained, but a visible
   Preview affordance and keyboard path would be clearer than holding a result
   that otherwise submits immediately.
5. **Bring progress closer to the top of Profile.** Statistics/history sit below
   settings and deletion. The preserved-guest archive explanation appears even
   when empty. Prioritize the ordinary player's progress.
6. **Clarify the Profile hint counter.** “Hints Available: 3” appears as an account
   statistic, though hints are per Easy game; the label can suggest a global wallet.

## Scope and release gates

This playtest establishes a usable local browser workflow and the specific core
paths above. Browser width is not native-device acceptance. Real Google/Apple
OAuth, native reminders, real share-sheet completion, assistive technologies,
physical-device performance, store signing and deployed infrastructure are not
proven by fake identities or this Chromium session. A browser share action was
invoked, but platform completion could not be established in headless Chromium.

The existing [release remediation tracker](remediation-status.md) still applies.
True release gates include the remaining native library/ABI failures and signed
Android/iOS acceptance, live identity/account/deletion paths, public privacy and
support/deletion material, a reviewed production clue schedule and rights review,
staging rules/indexes/migration/abuse controls, and store/infrastructure evidence.
The layout and onboarding refinements above are generally polish; an observed
accessibility failure that prevents play would be a blocker for affected users.

Validation for this stage: app and Functions TypeScript compilation; 55 focused
app tests across identity/recovery/search/hints; six backend clock guard tests;
three local fixture/date tests; targeted diff whitespace check; actual emulator
startup, browser gameplay, failed-export recovery, graceful export and import.
See [local development](../local-development.md) for reproducible commands.
