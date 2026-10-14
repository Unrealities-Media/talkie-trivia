# Android search keyboard verification

This follow-up addresses the keyboard obstruction reproduced during the
[post-game audit](post-game.md). It is bounded Android emulator evidence, not
complete accessibility or store acceptance.

## Change

The Android Game scroll area now resizes for the keyboard and positions its
focused search field near the top, leaving space for results. Measurement is
relative to this screen's native scroll ancestor; an input in another mounted
tab must not scroll Game. Keyboard subscriptions and queued animation frames are
cleaned up. iOS retains its automatic keyboard insets and still needs testing.

Search rows and expanded previews grow with their text. The bounded result list
uses measured content height, with an initial font-scaled estimate; it no longer
assumes every row stays one fixed height. The explanatory footer remains outside
the scrolling list. Normal taps submit; long presses preview without submitting.

## Verification

- All 43 focused tests across Game screen, Picker, PickerUI and PickerItem pass;
  app TypeScript passes. The viewport regression covers measured growth,
  shrinkage, the maximum height and rejection of zero measurements. Safe-area
  test context and the Dimensions subscription cleanup mock were corrected.
- Installed source-built Android API 36, x86_64, 16 KB emulator with actual
  Gboard, in a separate Android user profile. Checks use both fresh screenshots
  and the visible IME inset; accessibility coordinates alone previously gave a
  false impression that results were tappable.
- At 200% text, focusing search positions the field at y=180–346, with the
  keyboard starting at y=1517. Both collapsed Dune results and the wrapped
  “Already guessed” label fit above the keyboard. The expanded 1984 preview
  occupies y=372–989; title, year and selection instruction remain visible.
  Longer content stays in a bounded, scrollable list.
- Long-press preview leaves the game at revision 1. Tapping Dune (1984) while
  Gboard is open saves exactly one additional wrong guess, revision 2, with no
  completion credit. Restarting at normal text size retains both guesses.
- At normal text size, `Alive 2020` returns one result at y=392–568, above the
  keyboard. Tapping it wins with exactly three guesses, revision 3, one history
  entry and one credited game. Saved score is 490: Medium maximum 700, base 280,
  plus half the 420 performance pool. The rendered result matches the server.
- Empty-result help, a single `1917` match, expanded single-result preview and
  scrolling the lower duplicate result were also checked at 200% on the preceding
  measured-height artifact. The final artifact adds the viewport test ID; these
  cases were not all repeated on that final artifact.
- All eight prior accounts and 26 prior documents retain identical captured
  metadata/document hashes. The new guest adds four documents, giving nine
  accounts and 30 documents total. This verifies the recorded collections and
  metadata, not every possible Auth field or unrelated collection.
- All 56 packaged native library hashes match the previous post-game artifact.
  The 19 known RELRO failures therefore remain. The final test-user process log
  contains no `MissingViewState`, `addViewAt` or `FATAL EXCEPTION` matches.

The first keyboard-resize attempt still required manual scrolling, and the next
focus adjustment still clipped large-text rows. Neither is counted as acceptance.
The final win's UI-automator dump failed to reach idle; no stale XML was used.
Its submission is proven by backend state and a fresh result screenshot.

Returning to Android owner user 0 showed the session-recovery gate, not its saved
result. The Auth emulator import invalidates prior sessions, as documented in
[account sessions](../account-sessions.md). Retry left all nine accounts and 30
documents unchanged. No replacement guest was requested. This does not prove
original-session continuity across a production update.

## Artifact and evidence

- Final APK: `.expo/device-proof/r30-keyboard-final/talkie-demo-emulator-only.apk`.
- Signed SHA-256:
  `b4341a818bbdb562ec029b186771ce5218aba48e5e13d5572279667ffc230aae`.
- Unsigned SHA-256:
  `b6a4647278f283afac3c211863c3cbeb9b11afc0e1de294914af414c504889fa`.
- Local build succeeded in 47 seconds; emulator-only v2/v3 signing and 16 KB ZIP
  alignment pass. This is a demo development identity, not a store artifact.
- `.expo/device-proof/keyboard/accepted-*` contains final XML, screenshots, IME
  bounds, backend checks, process log and `accepted-check.json`. `measured-*`
  contains the preceding measured-height checks described above. Earlier
  `large-*`/`final-large-*` labels refer to superseded artifacts.
- `.expo/device-proof/r30-session-refresh/keyboard-{before,final,owner-retry}.json`
  records the account/document comparisons.
- `.expo/device-proof/firebase-export-keyboard-final` contains nine exported
  Auth users plus nonempty Firestore metadata/data. The local launcher imports
  this export. Test-user font size was restored to 1.0, owner user 0 restored,
  and test user 10 stopped with its data retained before emulator shutdown.

These ignored local files are supporting evidence, not remotely executed CI.
No real accounts, deployment or store submission were involved.

## Remaining acceptance

Test physical Android devices, other keyboard/layout sizes, landscape, dark
theme, TalkBack, VoiceOver and iOS. Verify focus/scroll behavior with keyboard
switching and hardware keyboards, very long localized titles, and low-end
performance. Findings 23 and 28 remain open for this broader evidence and the
editorial/search requirements in the main tracker.
