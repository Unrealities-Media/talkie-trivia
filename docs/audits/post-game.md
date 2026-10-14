# Results, history and sharing

Findings 34 and 35 now have implementation and bounded Android evidence.
Player-value research, complete accessibility and iOS acceptance remain open.
This is not release approval.

## Player experience

Completed games show the original UTC challenge day, difficulty, guesses used
and acknowledged server score. The explanation distinguishes a win, exhausted
guesses and Give Up, explains that time does not affect score, and shows Easy
hint usage and its winning-score penalty. The answer, release year, movie facts,
cast names, complete saved clue and submitted guesses follow in one scrolling
page. Completed games no longer display unused guess slots. Titles and feedback
wrap instead of truncating at large text sizes.

The share action appears immediately after the result summary. Current results
and history use the same formatter and saved game snapshot. Sharing requires a
completed, processed game with a nonnegative integer score and valid challenge
day. The text includes day, difficulty, outcome, guess grid, score and Easy hint
usage; it excludes the answer, clue, cast, guessed titles and account identifiers.
Changing the next-game preference cannot change a previous result.

The unverified public domain was removed from share text. An owned, verified
destination remains a launch task. Actor names are readable without placeholder
portraits; actions require a valid IMDb person identifier. Movie actions require
a valid title identifier and fixed HTTPS host. The unused illustrative streaming
provider component was removed. No regional streaming availability is claimed.
Progress copy uses the current account's saved statistics, without treating seven
games as seven days or inventing a perfect score.

## Verification and limits

- App TypeScript and the first ten affected suites (60 tests) passed. They cover
  result validation/formatting, saved summaries, sharing errors/cancellation,
  current/history views, clue, progress copy, actor actions and movie facts.
- Native review then exposed clipped guess rows at 200% text. Replacing the
  five-row virtual list with natural-height rows and hiding unused completed-game
  slots passed 33 tests across five affected suites, plus app TypeScript.
  These overlap the first run; they are not 93 distinct tests. Native bridge
  mocks do not prove screen layout or platform share completion.
- The installed development build used Android API 36, x86_64, a 16 KB page-size
  emulator and isolated `demo-talkie-trivia` Auth/Firestore/Functions. A confirmed
  new guest submitted Dune (2021), then #Alive (2020), through the actual app.
  Server state contains one Medium game for `2026-10-14`, two guesses, revision 2,
  score 595, one credited win and one history entry. The clue was a synthetic
  emulator fixture, not approved production content.
- Normal and 200% text checks show readable results and saved score, reachable
  sharing, wrapped movie/cast/clue text and submitted guess rows. Profile's
  next-game setting was changed to Easy; history and its share preview retained
  Medium, 2/5 guesses and 595 points. History sharing was dismissed and its modal
  closed at 200% text. No share recipient was selected.
- The first layout correction incorrectly constrained poster width while leaving
  it too tall. The final artifact fixes width and aspect ratio. Its normal and
  200% text screenshots show a compact 2:3 poster; the final normal-size native
  share preview matches the saved result exactly. History/guess-row evidence is
  from the preceding artifact, whose only subsequent source change was this
  poster width/max-width correction.
- Final snapshots preserve all seven previous accounts and all 22 previous saved
  documents. The new account brings the total to eight accounts/26 documents.
  Its game, statistics and history hashes remain unchanged after repeated views,
  shares, preference changes, app updates and restarts. This proves this bounded
  flow did not award additional credit; it does not replace fault-injection tests.
- All 56 packaged native library hashes match the onboarding artifact. The
  existing 19 RELRO failures remain; successful installation is not a passing
  store artifact gate. The final app process log has no `MissingViewState`,
  `addViewAt` or `FATAL EXCEPTION` matches during the final checks.
- Early UI-automator dumps sometimes failed to reach idle, and the helper read a
  stale XML file. Those XML files (`won`, `won-later`, `result-details`) are not
  valid assertions. The helper now requires an explicit successful dump before
  reading it. Game-page visual evidence uses fresh screenshots; modal/chooser
  assertions use successful dumps. The app remained interactive; the underlying
  idle failure is not diagnosed.

Android's installed React Native `ShareModule` resolves `sharedAction` immediately
after opening its chooser. It does not establish recipient selection, delivery,
or cancellation. The existing `share_results_tapped` event must retain that
limited meaning; optional telemetry remains disabled. The sharing mutex covers
an outstanding platform promise, not the whole lifetime of Android's chooser.
iOS behavior still needs native acceptance.

### Artifact and preserved evidence

Final demo APK:
`.expo/device-proof/r30-post-game-poster-final/talkie-demo-emulator-only.apk`

- Signed SHA-256:
  `093c00f83934d22f81e7541a2acf73c23d116a371ee6374f893ff41b112b3920`
- Unsigned source SHA-256:
  `d17aa6822242630627d7bfc4856a7099e76ef848cb4854203160d9a27162a233`
- Source build: successful in 46 seconds; 1,037 tasks, 50 executed, 987 up-to-date.
- Emulator-only v2/v3 signature and 16 KB ZIP alignment verification pass.
- Evidence: `.expo/device-proof/post-game/`, including `backend-result.json`,
  `history-check.json`, `final-artifact-check.json`, `final-process-check.json`,
  `poster-final-normal*.png`, `poster-final-font2*.png`, `poster-final-share.xml`
  and `final-large-history*.xml/png`.
- Before/won/final account/document snapshots:
  `.expo/device-proof/r30-session-refresh/post-game-*.json`.
- Full local state export: `.expo/device-proof/firebase-export-post-game-final`;
  its Auth export contains eight users, with Firestore export metadata/data.
  The local backend launcher now imports this snapshot. Font size was restored
  to 1.0 before stopping the emulator. These ignored local artifacts are not CI
  evidence and do not contain real user accounts.

## Remaining acceptance

1. Keyboard/result visibility now has an implemented fix and bounded Android
   normal/200% text verification, including actual submissions with Gboard open.
   See [search keyboard evidence](search-keyboard.md). Other devices, keyboards,
   assistive technology and iOS remain acceptance requirements.
2. Verify native loss, Give Up, Easy hint outcomes, unavailable-score behavior,
   dark theme, small screens, screen readers, reduced motion and iOS. Unit coverage
   of these outcomes is not equivalent to native or human acceptance.
3. Test real external links and the final public destination. Keep streaming
   availability absent until accurate regional data and rights are established.
4. Ask players what they learned, why they won/lost, how hints affected their
   score, and whether they want another daily game. Evaluate history discovery
   (currently below many Profile sections) and avoid adding modes or streak
   pressure without evidence of value.
5. Complete the privacy-minimized native observability funnel, with chooser-open
   distinguished from confirmed sharing where the platform supports it.
