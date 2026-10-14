# Midnight Premiere verification

Goal remains active. The implementation is not yet proven pixel-perfect across all scenes and scenarios. The expanded objective also requests UX review, sizing/spacing experiments, and poster filtering/scaling.

## Native and saved-flow verification of label handoff (October 14)

- Previous pass made progress by changing reveal label timing and verifying the browser blend. This pass recorded the current Android presentation replay in `premiere-label-handoff.mp4`; inspected `native-label-reveal-review.png` and `native-label-handoff-review.png`. Curtains open onto the graded, slowly scaling poster; labels clear before the result appears. No empty stage is visible in the sampled frames. Frame sampling does not establish frame-perfect smoothness on every device.
- Native process 5286 reported zero JavaScript errors and zero Reanimated mount warnings. Inspector confirmed gameOver, loaded game, and no store error after replay. Returned to original user 0. This replay did not modify a saved outcome.
- Separately, the current real browser flow completed a wrong Matrix guess, correct Nemo guess, reveal, saved two-guess result, Archive/Profile navigation and return. Zero browser errors; reduced-motion gameplay at 320px had no horizontal overflow.
- The emulator process had exited with code 1 before recording, with no diagnostic cause in its output. Restarted the same AVD as a hidden independent process with retained logs; existing QA data remained available. Native recording succeeded after recovery. Full visual parity for all scenes remains unproven.

## Reveal label handoff refinement (October 14)

- Current browser frame review exposed overlapping reveal title/button and result copy during the poster crossfade. Reveal labels and their rule now fade out from 2550–2800ms, before the existing 2850–3200ms full-overlay dissolve. The poster stays visible throughout; reduced-motion timing and skip/completion semantics are preserved.
- Six focused reveal tests and TypeScript pass. The current presentation replay reports zero browser console/page errors. Inspected 2950ms and 3150ms captures: the outgoing label stack is absent during the blend, followed by the complete result. This pass does not establish native timing or saved-game behavior; those need separate evidence.

## Native typography and descender correction (October 14)

- Previous turn made progress by rebuilding the regular display font and validating browser captures. This pass inspected the updated font on Android in the saved result and a temporary gameplay presentation fixture.
- Found visible clipping of the `y` descender in `beyond` at Android's 1.08 clue line-height. Increased Android-only line-height to 1.22; the new `premiere-optical-play-fixed.png` visibly retains the complete descender and keeps search, help and navigation on screen. Browser line-height remains unchanged. Six focused clue tests pass.
- The emulator stopped during initial startup. Restarted the same AVD without wiping data, restored local port forwarding, and waited for the existing QA game to load. Final native checks reported a loaded gameOver state, no store error, and zero JavaScript errors or Reanimated mount warnings. Returned to original Android user 0 after the fixture restored. No new reveal recording was made in this pass.

## Small-size display font refinement (October 14)

- Compared the regular display face against Bodoni Moda optical-size 12 variants at weights 500 and 550. Selected weight 500: stronger fine strokes at app heading sizes while retaining the existing weight and 78% condensed proportions. Added `assets/fonts/build-premiere-display.py` to reproduce the bundled font. The bold result face and clue face are unchanged by this refinement.
- `font-optical-comparison.png` preserves the original/selected/heavier comparison. Fresh reference, 390px/320px gameplay, saved-history dialog and result captures completed without console or page errors. Inspected narrow gameplay, history and result captures for fitting headings; the slightly wider regular letterforms fit.
- This is browser visual verification. The revised optical font and preceding pixel-grid changes have not yet been rechecked on Android; exact reference antialiasing is not established.

## Text rendering refinement (October 14)

- In response to reported soft text, removed scaling from the projection layer containing the clue. Its lighting fade remains, and the theater light and sweep still animate. Text no longer changes raster size during that effect.
- Snapped responsive masthead, clue, result heading and movie title sizes/line heights to the device pixel grid using PixelRatio. Font families and the existing condensed outlines are unchanged. Font-file audit found no glyph hint programs in the five bundled Premiere faces; this alone does not prove the cause of perceived blur.
- Fifteen focused clue/masthead/result tests and TypeScript pass. Final reference/390/320 captures report zero console/page errors. Inspected reference and 320px captures for preserved line breaks. The static reference-size change is subtle; these checks do not prove identical antialiasing across displays or native platforms. Kept `text-before.png` for comparison.

## Gameplay variants and reconnect verification (October 14)

- Rechecked Basic, Easy and Hard, hint choices and revealed genre, empty search, give-up confirmation/outcome and a three-wrong-guess Extreme loss at 320px. The current scenario helper completed with zero browser errors and no horizontal overflow.
- Corrected the Actors hint's icon mapping from generic information to people. Added a bounded, finely bordered error panel consistent with the other surfaces. Ten focused hint/error tests pass.
- Verified light-theme Play/Archive/Profile navigation and offline-to-online recovery. Two expected browser resource errors occurred only during deliberate offline mode; there were no other console errors or page exceptions. Search returned on reconnect. Inspected the current light and offline captures.

## Supporting dialog consistency (October 14)

- Replaced the detail modal's large rounded surface with the same fine border, dark background and 3px corners used by the refined supporting panels. Standardized confirmation corners and reduced wasted horizontal space between the detail actions.
- Compact movie facts now use the regular display face at 24/30 for their heading, with restrained poster corners. The complete-clue panel uses a matching display heading and fine border. These are extensions of the established visual language; the original board does not provide separate reference images for these dialogs.
- Eleven detail/confirmation tests and TypeScript pass. A fresh browser guest completed the real give-up, saved archive, history detail and close flow. Final captures at 390px and 320px report zero console/page errors and no horizontal overflow; Close remains within the viewport. Inspected `dialog-history-320.png` and `dialog-confirm-390.png`. This check does not invoke system sharing.

## Android verification of latest refinements (October 14)

- Reloaded only the existing QA profile (Android user 10). The first capture was the startup splash; subsequent inspector state confirmed a loaded saved game with `gameStatus: gameOver`, no store error, and no loading flag. Inspected the final native result in `premiere-qa-current-result.png`: updated quarter-height crop, shared color treatment, masthead, title and complete share control are visible.
- Recorded a presentation replay of that saved result in `premiere-direct-dissolve.mp4`. Inspected the reveal and handoff contact sheets (`native-direct-reveal-review.png`, `native-direct-handoff-review.png`). The sequence proceeds from the full poster to the result without the prior empty-background stage in the inspected frames.
- Inspected `premiere-qa-current-search.png` from a temporary, automatically restored in-memory playing fixture. The SVG magnifier and arrow render, and the input text stays clear of the arrow. This capture is presentation evidence only, not a new native gameplay result.
- Active app process 21165 reported zero JavaScript errors and zero Reanimated mount warnings after these checks. Verified the fixture restored `gameStatus: gameOver` before switching back to Android user 0. Original account data was not replaced or reset.

## Poster crop, grade and direct dissolve (October 14)

- Compared poster crops at 0%, 25% and 50% vertical alignment. Selected 25% for the result hero: on the current Finding Nemo artwork it retains the light source and moves the character out of the dark bottom edge. Other movie compositions still require inspection; this is a general crop, not per-movie focal metadata.
- Increased the shared poster treatment's cool-shadow and warm-center opacity. Both reveal and result use the same grade; retained the reveal's 1.1-to-1 slow zoom and soft-focus transition.
- The recorded live flow exposed an empty-background beat caused by fading the content before dissolving the overlay. Removed that independent content fade. The entire reveal now crossfades directly to the prepared result over 350ms. Inspected frames around 2700, 2950 and 3150ms in `handoff-direct-*.png`: poster, blended transition, then result, with no blank stage in those samples.
- Six reveal tests pass after the dissolve change; all 16 facts/reveal tests passed for the crop/grade change. TypeScript passes for the crop/grade changes. Live wrong/correct/reveal/result/navigation flow passed with zero page errors; the final isolated handoff check also captures console errors and reports none. Final handoff fixture is presentation-only and is not evidence of a saved outcome. Updated result comparison captures at 462px and 320px.

## Ticket and search proportions (October 14)

- Matched the reference ticket's inset and height more closely: 5px side margins, 86px minimum height, and 4px additional space above the guesses. The reference-size ticket now runs from y510 to y596, with the search field starting at y620.
- Replaced search icon-font glyphs with a 30px drawn magnifier and a fine-stroked arrow. Reserved 62px on each side of the input so text does not occupy the controls. The search button retains its existing focus action and accessible label.
- The rendered check caught a React DOM warning from `accessible={false}` on the SVG. Replaced it with `aria-hidden`, and expanded the isolated capture helper to fail on console errors as well as page exceptions. Final 320/390/reference captures report no errors; inspected the final reference capture. Nineteen focused picker/guess tests and TypeScript pass. These checks do not establish parity for every other screen.

## Exact reference clue typography experiment (October 14)

- Final refinement: rebuilt the licensed clue face at weight 650 and 84% horizontal scale, with a 320px maximum text measure. The reference sentence retains its break after `dreams`, and the real initial clue fits two lines at 320px. The final software-rendered browser capture includes the masthead and tabs; explicit visibility assertions pass after waiting for fonts and layout frames. This supersedes the incomplete captures described below, but does not establish the cause of their intermittent missing text.
- Re-ran the real wrong/correct guess flow, curtain reveal, result, Archive/Profile navigation and reduced-motion 320px layout after the final font and measure change: zero JavaScript errors and no horizontal overflow. TypeScript passed in this refinement pass. No broad suite was repeated for the final font/measure adjustment.
- Replaced the comparison helper's different clue wording with the board's seven-word sentence. The helper reveals all text via an explicitly invalid presentation-only outcome override while keeping the playing screen, and submits no actions afterward. This isolates typography; it must not be represented as a valid game state. Updated comparison-page disclosure accordingly.
- Short clues now use up to 42px type and a centered 340px maximum measure. The reference sentence breaks after `dreams`, matching the board, with closer letter height. Long-clue sizing is unchanged. Six clue tests and TypeScript passed after the initial change; a live wrong/correct flow, reveal, result and navigation completed with zero browser errors.
- Initial 90% measure caused a one-word final line on 390px phones. Replaced it with full available width capped at 340px; inspected `short-clue-live-390.png`, whose clue is now two lines. A 320px capture still had the last word alone, so short clues below 360px now use a slightly smaller factor and 28px floor. That final narrow-size adjustment still needs visual verification. Main reference-size grouping remains unchanged by the sub-360px rule.
- Final sub-360px capture confirms the real clue now fits two lines at 320px, with the search control visible. Browser reports zero page errors. The resize capture omits the masthead/tab text during that frame, so it supports clue measure only; it is not a complete-screen fidelity pass. Final narrow typography verification supersedes the pending note immediately above.

## Profile consistency and narrow settings layout (October 14)

- Secondary-screen review found Profile still had a small generic heading and large rounded panels. Added a prominent PremiereDisplay `Your profile` heading with the existing welcome beneath it, compacted the guest-link panel, and gave sections fine borders, restrained corners and larger cream serif headings. Account actions and authentication branches are unchanged.
- Inspected `profile-refined-390-dark.png`, `profile-refined-320-dark.png` and `profile-refined-320-light.png`. At 320px the difficulty label originally crowded its badge; the row now wraps with an explicit gap and shrinkable label. Final browser run reports zero page errors and no document horizontal overflow across those captures.
- Five profile-screen tests, two section tests and two difficulty-selector tests pass. TypeScript passed after the profile changes, before the final style-only wrapping adjustment. The complete 683-test run below predates this profile refinement; it was not rerun without a new functional concern.

## Consolidated current audit (October 14)

- Full Jest run after accumulated implementation/test changes: **110 suites, 683 tests, and 1 snapshot pass**. TypeScript passed after the celebration change. This supersedes the old partial-suite results below. The runner emitted a Node `--localstorage-file` warning, not a test failure.
- Revised celebration verified in browser full/reduced motion fixtures (`celebration-full.png`, `celebration-reduced.png`): animation starts and completes; reduced motion clears the request without particles; zero page errors. Native `premiere-qa-celebration.png` shows only coral, cream and gold; process 18176 reports zero JavaScript errors and zero animation mount warnings after completion. Returned emulator to user 0; isolated user 10 remains available with its completed QA game.
- Added `comparison.html`: same-size gameplay/result reference, app capture and adjustable overlay. It explicitly labels presentation fixtures and content differences. It is a visual review aid, not a numerical pixel-match certificate.
- Proven areas: original theater crop on browser/Android, main result layout on browser/Android, live saved-game reveal/handoff, reduced-motion celebration, narrow-layout and long-title handling, purchase/give-up/loss/retry scenarios described below.
- Completion remains unproven: fonts are reconstructed from licensed typefaces rather than source typography supplied with the raster board; the gameplay paper texture is recreated, not the original source layer; the result uses a real catalog poster rather than the board's illustrative artwork. Exact glyph/texture parity therefore cannot be claimed. Current captures of secondary and alternate states still need a consolidated final visual review after the last changes. The board supplies no exact reference layouts for Archive, Profile, recovery, or failure states, so those can only be checked for consistent extension of its style.

## Native result and celebration review (October 14)

- The isolated QA guest completed Finding Nemo after the prior WebView-update interruption. Inspected `premiere-qa-result-complete.png`: result masthead, title ornaments, graded poster, marginal captions and Share button fit above the tabs. Recorded `premiere-qa-reveal.mp4` and inspected `native-qa-reveal-review.png` / `native-qa-handoff-review.png`; curtains, poster scaling and the result handoff render on Android. Process 15755 reports zero JavaScript errors and zero Reanimated mount warnings. UIAutomator could not reach idle for the final capture, so its XML is stale; screenshot and process logs are the evidence.
- Recording exposed multicolor confetti outside the approved palette and no reduced-motion guard. Changed it to 80 coral/cream/gold particles, disabled automatic duplicate startup, and suppress/clear the celebration when reduced motion is enabled (including mid-animation changes). Six targeted celebration tests and TypeScript pass. The new particle treatment still needs runtime visual review; the native recording above predates this change.

## Native artwork verified in isolated QA profile (October 14)

- Resolved user 10's bundle loading by persisting React Native's `debug_http_host=localhost:8082` preference in `/data/user/10/com.unrealities.talkietrivia.dev`. The UI bundle-location dialog had not created a preferences file. User 0's data remains untouched.
- `premiere-qa-theater-verified.png` confirms the original theater strip scales cleanly on Android, with no phone-frame edge or caption overlap. Inspector reported a loaded game in `playing`, with no store error. Process 10124 had zero JavaScript errors and zero Reanimated mount warnings before submitting a guess. Native keyboard search exposed the matching movie row correctly.
- Corrected the first-run tip's stale instruction `How to play above`; the control now sits below gameplay, so the tip simply names it.
- Result verification was interrupted by Android updating WebView: exit-info records process 10124, user 10, reason `PACKAGE UPDATED`, description `stop com.google.android.webview due to installPackageLI`, at 06:58:55. This was not a verified result screen or a zero-error result pass. Updated the local log-count helper to fail when the process is absent. Relaunched user 10; native result inspection remains pending.

## Current motion review and isolated Android setup (October 14)

- Recorded the real wrong-guess → correct-guess → reveal → saved-result flow with current artwork and result captions. `motion/page@f8ebff936d5cf1377100af54303d22ce.webm` is 16.6 seconds; reviewed the late and handoff contact sheets. Curtains expose the graded, scaling poster; the overlay dissolves into the result with the new captions. Browser reports zero page/console errors. Reduced-motion 320px gameplay has no horizontal overflow; Archive/Profile navigation returns to the completed game.
- Created Android emulator user 10 (`Premiere Visual QA`) and enabled the existing development package there, preserving user 0 and its saved guest. Configured this separate profile's bundle address to `localhost:8082`. Initial reload had native surface initialization warnings; restarted only user 10's app. Native gameplay inspection remains pending after this setup. Do not clear user 0 or use the default-user relaunch helper while working in user 10.
- Fresh user-10 launch still reports `loadJSBundleFromAssets` / unable to load script. This is an unresolved isolated-profile development setup issue. Switched the foreground back to user 0; retained user 10 for diagnosis. No original guest account was replaced.

## Result editorial details (October 14)

- Direct comparison found missing poster marginal captions and the result-specific masthead. Added the original board's decorative copy as pointer-transparent overlays excluded from the accessibility reading order, plus `GREAT / MOVIES / LIVE ON` during reveal and all completed outcomes.
- Inspected `result-notes-462.png` and `result-notes-320.png`. Captions stay within the poster and do not overlap the title or share control. These are local presentation fixtures, with no game actions submitted after replacing state; the unprocessed fixture score leaves Share disabled, so they are not sharing verification. Browser reports zero page errors; TypeScript passes.
- Native gameplay artwork verification remains gated by the existing saved-session recovery state. Whole-app pixel-perfect completion is still unproven.

## Original theater artwork integration (October 14, latest)

### Android recovery verification

- Restarted the existing emulator without wiping data. Its saved guest is not recognized by the restored local backend snapshot, so gameplay remains behind session recovery. No replacement guest was created and no account or game data was cleared.
- Fixed the masthead showing the placeholder game's device date before a challenge loads. It now displays `A NEW MYSTERY` until a game with an ID exists; loaded games retain the challenge date.
- Two focused masthead regression tests pass, TypeScript passes, and diff whitespace checks pass. Inspected `premiere-recovery-refined.png` on Android; current process 4424 logs show zero JavaScript errors and zero Reanimated mount warnings. This is recovery-screen evidence only; native verification of the new theater crop remains outstanding.

- Replaced the recreated gameplay theater with a clipped rendering of the approved board's original text-free theater strip. `assets/premiere/reference-board.png` is an unchanged source copy. The crop (442,354,458,69) excludes the phone frame and baked text; it scales to measured layout width. Caption remains native, with 6px separation. Generated theater art remains only as the poster fallback.
- Inspected reference-size and 320px pending-state captures, then corrected a visible frame edge and caption overlap. Final `reference-equivalent-play.png` has the original seats/beams and a separate native caption. Browser fixture reports no page errors. This closes the recreated-gameplay-art difference noted in older entries, but native rendering of this new crop still requires inspection.
- Save error presentation strips a trailing HTTP 4xx/5xx code while retaining the original error in state. Guarded new-guest failure/retry check passes and the updated pending capture has actionable text without `[503]`.
- Eleven clue/gameplay tests pass; TypeScript passed after introducing the crop and error presentation. Final crop coordinate/spacing adjustments are numeric only. Whole-app pixel-perfect completion is not claimed.

## Save/retry state review (October 14, latest)

- Shared typography audit confirmed the global tokens already use Premiere fonts. Found the save status was unframed text above gameplay; styled saving/pending status with a theme surface, fine border, consistent spacing and PremiereDisplay heading. The existing retry operation and disabled-action rules are unchanged.
- Added a guarded browser recovery check with an explicit empty-storage context. It must observe a successful new guest signup from the local Auth emulator before submitting a test guess. Initial approval rejection asked for proof of isolation; the explicit signup guard resolved that concern and the revised run was approved.
- Intercepted the new guest's action with a delayed HTTP 503, captured saving and pending states at 320×740, confirmed Give Up disabled, removed the interception and successfully retried into CLUE 02. Zero page errors; the intentionally injected HTTP failure is expected and is not a zero-network-error claim.
- Inspected `scenario-pending-save-320.png`: complete status panel and retry button are visible above the tabs. Five gameplay-view tests and TypeScript pass. This adds real failure/recovery evidence beyond presentation fixtures.

## Reference-length clue comparison (October 14, latest)

- Added an isolated browser presentation fixture with a short dream-themed clue at 462×801. It modifies only in-memory store values after loading; it submits no guess or action after fixture setup. It uses one valid genre hint rather than fabricating a second genre supported by neither the current game rules nor catalog hints.
- Approval review rejected the initial helper because it clicked a guess before applying the fixture. Removed that submission; the corrected helper was approved and completed with no page errors. Saved game actions were not used to create the reference-length clue.
- Direct comparison found short clue lettering undersized. Clue font now responds to viewport width with a 30px minimum, 38px short-clue maximum, and 34px maximum after more than twelve visible words. Line height follows the selected size. Inspected `reference-equivalent-play.png`; the reference-length text remains two lines with a taller presence.
- Six clue tests and TypeScript pass. Real local-demo wrong/correct gameplay, reveal/result, Archive/Profile return and 320px reduced motion completed with zero collected browser errors and no horizontal overflow in the narrow check.
- This is a comparable-length fixture, not exact reference text or artwork. Remaining differences must not be represented as a pixel-perfect match.

## Alternate outcomes and confirmation review (October 14, latest)

- Exercised current Easy hint options/purchase, empty search, give-up confirmation/result, Extreme loss at 320px, Basic and Hard layouts. Updated the capture helper to wait for the reveal overlay to close before photographing outcomes. All flows completed with zero collected browser console/page errors and no document horizontal overflow.
- Inspected hint choices, no-results feedback, give-up modal, give-up result and narrow loss screenshots. Found that the give-up heading wrapped into two large lines and the confirmation title retained its small slab-serif appearance.
- Give-up outcome now uses a proportionate title size (width × 0.125, capped at 57px); success/loss wording and sizes remain as before. Confirmation title uses PremiereDisplay at 32/38px with a fine theme border and heading accessibility role.
- Final focused browser run verified Cancel returns to gameplay and Confirm reaches Answer revealed. Inspected the updated `scenario-give-up-confirm.png` and `scenario-gave-up.png`; the heading fits one line at 390px and sharing is fully visible. Ten confirmation/outcome tests and TypeScript pass.
- This confirms these tested browser states, not pixel-perfect equivalence for every viewport, accessibility setting or native device.

## Result composition and poster continuity (October 14, latest)

- Added the reference's coral rules on either side of the result movie title. The framing works for linked and unlinked titles; long titles wrap without truncation.
- Shared `PremierePosterGrade` between the reveal and result hero so the cool-shadow/warm-light treatment does not disappear at the handoff. Reveal retains its 1.1-to-1 scale and soft-focus animation.
- Result title size now responds from 30 to 40px. Result hero height is capped at 340px and 80% of viewport width. The first 320px long-title trial used four lines and crowded sharing; the final title uses three lines, and the full share button fits above the tabs at 320×740. Inspected `result-long-title-320.png` directly. This is an isolated presentation fixture using a long title over the existing demo poster, not a real saved movie change.
- Reference-size result inspected with full share button visible; native `premiere-result-refined.png` confirms title ornaments and grade (captured before the final 0.85-to-0.8 width multiplier adjustment).
- Sixteen Facts/reveal tests pass. Final TypeScript and whitespace checks pass. Final browser long-title fixture reports no page errors or horizontal overflow. Live wrong/correct-guess flow, reveal, 320px reduced-motion check, and Archive/Profile return pass with zero collected browser errors.
- Latest live motion recording: `motion/page@06da2b5266f9b4c182afa4e7ea3c89f7.webm` (15.6 seconds). Inspected reveal and late contact sheets; poster and results retain the grade and resolve to a readable result screen.
- Preview/backend had stopped between sessions. Confirmed unused ports before restart; restored backend using the existing export `1791956567571`. Startup reported Oct 18, zero new challenges, and imported accounts. No clock reset or account clearing was performed.

## Reference typography and native handoff (October 14, latest)

- Compared the 462×801 browser capture directly with the board. Aligned masthead and paper at 25px horizontal insets and moved the paper down 12px. Reduced masthead size to 34px. Rejected an oversized Bodoni clue trial because it pushed the search field below the fold.
- Added bundled PremiereClue: Cormorant Garamond weight 600, condensed to 90%, used for clue and ticket lettering. Source, license and reproducible fontTools build script are included. Final real-demo clue occupies three lines with the search control visible.
- Corrected the theater image's cover position to bottom: the centered crop was cutting off the large foreground seats. This restores their scale and prominence without regenerating the artwork.
- Final reference-size browser flow completed with zero collected page/console errors; 19 targeted layout/clue/guess tests and TypeScript pass. Initial font-generation and stale Metro asset-index failures were resolved before this successful run.
- Native inspector connected using the supported localhost Origin. Replayed only `gameStatus: revealing` on an already-completed game; no account, saved game, date or score reset. Recorded `motion/native-handoff.mp4`, inspected `native-reveal-review.png` and `native-handoff-review.png`: curtains open onto the poster and the handoff reaches results without a clue-screen flash or overlapping titles in sampled frames.
- Android process 8019: zero Reanimated mounting warnings and zero JavaScript errors/fatal exceptions in the available process log after replay. This closes the native handoff verification pending in the earlier entry below; it is not comprehensive device/performance coverage.
- Remaining fidelity differences include recreated theater artwork and live movie poster/content differing from the illustrative Inception board. Do not describe the implementation as pixel-perfect yet.

## Current native warning resolution (October 14)

- Replaced only the loading ring's Reanimated rotation with React Native Animated using the native driver. Its two-ring artwork, timing and reduced-motion behavior remain; projector/reveal effects retain Reanimated.
- Fresh Android process 7307: zero `synchronouslyUpdateUIProps failed` / `SurfaceMountingManager` warnings, zero ReactNativeJS errors, zero fatal exceptions across the available process log. Earlier warning reports below describe prior builds and are superseded for this verified launch.
- Nine loading-indicator tests pass, including a new lifecycle test proving it waits for native layout and stops the animation on unmount. Final TypeScript check passes.
- Still not a blanket zero-error claim: development startup logged a React Native loading-message WindowManager warning, and one clean completed-game launch does not cover every game state.

## Reveal handoff refinement (October 14)

- Results and their poster now mount underneath the reveal; the page resets its scroll position at reveal entry. This preloads the destination instead of returning to the clue screen as the modal closes.
- Inspected a first dissolve recording and found overlapping titles. Replaced it with a fade through the theater background: content fades from 2600-2850ms, then the overlay clears from 2850-3200ms. Reduced motion remains still, and skip remains immediate and idempotent.
- Final 16.68-second browser recording inspected via `motion-handoff.png` at 12.3/12.6/12.9 seconds: no overlapping title or clue flash. Full play, wrong/correct guesses, Archive/Profile navigation and 320px reduced-motion check report zero page/console errors.
- Reveal, gameplay-container and game-screen tests: 21 passed. After the final fade-through adjustment, all six reveal tests and TypeScript passed again. Native reveal verification after this adjustment remains outstanding.

## Unavailable artwork (October 14)

- Removed the legacy checkerboard/clapperboard fallback from search, reveal and results. They now use the bundled theater artwork, preserving the navy, cream and coral visual treatment.
- Search thumbnails and expanded previews now recover from failed poster downloads; selecting the movie still works. Search preview expansion respects reduced motion.
- Simulated invalid remote image responses in the browser. The result displayed the theater fallback, no legacy fallback, and zero unhandled JavaScript errors; inspected `scenario-unavailable-poster.png` directly.
- Facts, picker-item and reveal tests passed (25), then the added failed-download/selectability regression test passed with all 10 picker-item tests. TypeScript passes.
- Android 150% text-size capture inspected: result title, movie name, summary and share button remain legible and unclipped; lower metadata scrolls. Original emulator font scale restored to 1.0. Its warning banner was traced to development-server WebSocket reconnects during Metro restarts, not new animation errors. Process 7307 still reports zero Reanimated mounting warnings and zero ReactNativeJS errors/fatal exceptions.

Reference: `01-midnight-premiere.png`. The board depicts a play screen, successful result, and focus/project/premiere transition thumbnails. Other functional screens must follow its typography, palette, and materials without inventing hints or changing game rules.

## Evidence collected

- Browser at 390×844: real local-demo wrong guess, correct guess, timed reveal, completed result, Archive/Profile navigation; zero page or console errors.
- Reduced-motion browser at 320px: clue appears, no horizontal document overflow.
- Isolated local-demo players: Basic, Easy, Medium, Hard, Extreme; paid genre hint; empty search; give-up confirmation and result; Extreme loss at 320px. Zero console/page errors. Screenshots `scenario-*.png`.
- Motion recording: `motion/page@1f0889b8bac55651d118292a15aa7831.webm`. Contact sheets are sampled frames, not proof of smoothness on a native device.
- Full Jest run: 98 suites passed initially, 10 failed. Inspected failures: old theme/font assertions, stale skeleton snapshot, mocked children omitted, missing safe-area mock, missing idle sync state, and obsolete notification-hook expectations. Corrected these against current source. Nine suites passed on rerun, then the final notification suite passed after correcting its test harness. No failing suite remains from that run. Notification production behavior was not changed.
- TypeScript and git diff whitespace check pass.

## Still required before completion

- Final visual comparison at the reference phone proportions with equivalent clue length and legitimately revealed hints; current demo content differs from the illustrative board.
- Inspect all transition phases; improve any abrupt handoff, text highlighting, or poster loading flash. Verify reduced-motion handling in shared modal/loading components.
- Loading, offline/retry, pending-save, long movie title, poster failure, large text, light theme, archive details, and profile/settings visual review.
- Native device/emulator layout, keyboard, touch targets, navigation icons, and animation verification. Browser checks do not prove native correctness.
- Retain actual date, difficulty rules, hint availability, guess counts and server-authoritative score. Never fabricate board values such as daily #147 or Inception for a live game.

## Current differences to resolve

- Theater artwork is regenerated from the reference, not extracted identical pixels.
- Screen text needs comparison at matching content and dimensions.
- Earned genre/decade chips now sit inside the projection area. Five new tests verify that unearned hints and Hard/Extreme categories never appear. The duplicate selected category below the hint button has been removed; director/cast hints retain their display.
- Results use the actual movie poster with a gradient mask. The reference uses custom cinematic artwork; the layout needs a deliberate policy for arbitrary posters and unavailable art.
- Additional functionality (remaining guesses, Give Up, help, difficulty) must stay usable while respecting the board's spacing.

## Latest UX and motion pass

- Fresh 462x801 browser captures now verify the final 360px result poster cap: heading stays on one line and the complete share button fits above navigation. Play, result, archive and archived details completed with zero page/console errors.
- Further reference matching: compact `Hint · N left` pill retains its descriptive accessible label; ticket material is darker, with a coral circular feedback icon and inset typography. Removed the dashed rectangular ticket border.
- Native app renders the bundled fonts, screen texture and theater graphics. Startup still logs Reanimated `SurfaceMountingManager` warnings for tags 20 and 140. Waiting for loader/projector layout did not eliminate these; do not report native as error-free. Removed three obsolete Android layout-animation initialization calls that produced separate no-op warnings.
- Skeleton pulses now cancel on unmount and respect reduced motion. Clue opacity applies to its containing view rather than a nested native text span. Current focused clue, ticket, hint, skeleton, loader, picker, picker-item and hint-logic tests pass; TypeScript passes. A missing Platform import found by the checks was restored before the final passing run.
- Preview Metro runs in CI mode and must restart after edits; screenshots captured without restarting can show stale code. Latest task preview uses port 8082.
- Android keyboard verification exposed clipped results after an existing guess. Repositioning on content-size changes fixes it: the full Finding Nemo result is now at y328-504, above the keyboard. Native wrong and correct guesses both complete. The result initially retained the search scroll offset; added a game-over scroll reset. The settled native result capture now shows the masthead, complete heading, poster and share button. Game screen's 11 tests and TypeScript pass after the reset. Final browser walkthrough also reports zero page/console errors.
- Native screenshot captures succeed, but uiautomator can time out waiting for idle during the result animation; do not use its stale XML as current evidence. The latest `premiere-native-result.png` was inspected directly. Native startup warnings remain unresolved.

- Captured live play/results at the reference phone size, 462x801 (`reference-size-*.png`). The capture exposed a two-line result heading and a partially hidden share button. Reduced the responsive heading cap to 69px and the hero poster cap to 360px; enlarged artwork now reaches the content edges. The final 360px cap still needs a fresh capture.
- Opened a real archived game after completing a local-demo challenge; details and close/share controls rendered without browser errors. Replaced the tiny display serif in compact movie metadata with the sans face for readability. DetailModal now respects reduced motion; all six modal tests pass.
- Native debug build succeeded (13m26s) and installed on emulator-5554. The native app initially targeted unresponsive Metro 8081; switched its bundle setting to 8082. Emulator UI hierarchy exists but screenshots were completely black, so restarted the same AVD with software graphics. Native rendering verification remains pending.

- Compared fresh captures directly against the original board. Corrected clue typography to Cormorant, reduced masthead scale, replaced the monitor icon with a film reel, enlarged navigation glyphs, added repeated ticket scallops and horizontal feedback, strengthened the coral search gradient, enlarged the result movie title, and added the share glyph.
- Replaced character-by-character clue animation with a complete-layout projection fade. Text now keeps its final line breaks throughout the transition; skip and reduced motion remain supported.
- Added a failed-poster fallback in Facts; its test also verifies that a different movie still loads its own poster after a failure.
- Browser checks on port 8082: all five difficulties, earned hint (no duplicated category chip), wrong/correct guesses, loss/give-up, empty search, Archive/Profile navigation, and 320px reduced motion completed without page/console errors. Typecheck, focused component tests, and diff whitespace checks pass.
- Reviewed Profile, Archive, light theme, offline and reconnect captures. Offline deliberately causes two ERR_INTERNET_DISCONNECTED resource messages; reconnection returns to the playable game. Light-theme caption contrast corrected after inspection. These resource messages are not a zero-error offline run.
- Latest motion capture: `motion/page@852e2142825868a2fa0a0bcc0566f888.webm` (15.6 seconds). Sampled 7/8/9 and 10/11/12 seconds in the contact sheets to inspect the sweep, settled poster, and results handoff.
- Original Metro 8081 was listening but timed out. Separate preview 8082 reuses the existing backend and demo date. Native build first failed because nmake was absent from PATH; initialized the installed Visual Studio developer environment and retried. Hermes compilation is in progress, so native verification is still outstanding.

- Tried wider poster sizing (82% of viewport, capped at 360 and constrained by height), a 10% scale settle over 2.2 seconds, a blurred opening that fades to sharp, cool/warm grading, and deeper edge shadows. Enlarged the reveal movie title and tightened kicker/title spacing. Current browser captures show the wider composition without overflow.
- Reveal timer/skip/reduced-motion tests pass, with both sharp and blurred image layers checked against the correct source/fallback. Typecheck passes.
- Confirmation dialogs now skip fades with reduced motion; loading artwork stays still. Loading tests no longer emit fake-timer React warnings.
- Android emulator `emulator-5554` is available. No Talkie app was installed. Generated the development Android project successfully and started a debug source build using `.expo/premiere-native-build.ps1`. Native verification still pending; poll the actual build process before deciding next steps.
