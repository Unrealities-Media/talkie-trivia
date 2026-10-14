# First-play guidance and practice

Finding 33 is implemented in source; player comprehension and complete native
accessibility acceptance remain open. This is not release approval.

## Player experience

The Game header always offers **How to play**, including during offline, loading,
content-error and account-recovery states. It opens inline in the screen's scroll
view, can be closed at any point, and can be replayed. It does not request login,
notification permission, or a network connection.

The guide explains immediate submission when tapping a search result, title/year
search and long-press preview, incorrect guesses and plot progression, all five
difficulties, automatic Medium matches, three optional Easy hints and the
50-point penalty, win/loss scoring, no speed bonus, the worldwide midnight UTC
reset, difficulty locking, save retry, and guest-account continuity limits.
Difficulty labels, guess limits and maximum scores use the existing configuration.
Rules were checked against the server game engine/scoring and the actual client
clue, picker and hint behavior.

An optional short Medium example uses two invented movie titles. A wrong choice
spends one practice attempt, reveals a shared decade and more plot, and explains
that a matching category is not a correct answer. A correct choice ends practice.
Players can restart, hide practice, or return immediately to the daily game.
The example uses local React state only; it has no game-store, account, catalog,
storage or network dependencies. Closing the guide resets the example.

The first-search tips now warn that a tap submits immediately. Profile explains
that guest progress is already saved and account linking is optional. Tutorial
preference read errors no longer prevent opening the daily game; failed dismissal
writes leave tips dismissed for the session without an unhandled rejection.
Dismissing the search-preview tip no longer falsely reports completed onboarding.
Optional telemetry remains disabled.

## Verification

- App TypeScript passes.
- 52 affected component/screen/state tests pass across the focused runs, plus
  three tab-layout tests after the native safe-area correction. Checks cover
  practice success/failure/restart/skip, unchanged daily state, instructions in
  eight unavailable-game states, all difficulty limits/maxima, and tutorial
  storage failure recovery. These use native bridge mocks, not a native renderer.
- The first installed demo Android build completed practice/restart/close at
  normal text size. At 200% text, practice/restart succeeded, but the automation
  overscrolled the closing button and failed because its search only moved down.
  The helper now searches upward when a target is clipped above the viewport.
- Screenshot inspection exposed scrolling text underneath the status bar.
  The tab layout now reserves the top safe area, uses the app theme for status
  icons/background, and insets screen content for landscape cutouts. Bottom-tab
  insets stay with the existing tab bar. Practice now appears before the detailed
  difficulty reference and offers its own return-to-game button.
- The first revised-artifact automation also overscrolled the practice controls.
  Direct inspection proved the practice button opens correctly; reducing swipe
  distance/speed fixed the helper. These failed runs are retained, not counted
  as acceptance passes.
- Final installed Android API 36 x86_64/16 KB checks pass at normal and 200%
  system font size: open instructions, open practice, submit incorrect/correct
  choices, restart, and return to the daily screen. The backend was stopped and
  the existing account-recovery gate remained intact. No account recovery,
  replacement, sign-in or daily-game command was requested. Screenshots confirm
  wrapping and status-bar separation. The inspected practice button is 48 dp
  tall normally and approximately 56.8 dp at 200% text (420 dpi).
- The final process log contains no `MissingViewState`, `addViewAt`, or
  `FATAL EXCEPTION` entries. This is a bounded interaction check, not proof of
  long-term renderer stability. System font size was restored to 1.0 and the
  emulator stopped.

### Artifact and saved evidence

The final demo-only APK is
`.expo/device-proof/r30-onboarding-safe-final/talkie-demo-emulator-only.apk`.
It uses the development package and demo Firebase project; it is not a store
artifact. The incremental source build succeeded in 46 seconds. Signature v2/v3
verification and 16 KB ZIP alignment pass.

- Signed SHA-256: `a8c7cfffa943621c44da0a658772fe4ac0ca5394944bc0481ca80bc87ce5199b`.
- Unsigned SHA-256: `7f2dec8d4f3926916aeb097dda58e11ff714e4148d90cbebed90b7d35a387f1e`.
- `.expo/device-proof/onboarding-safe-area/` contains the source-copy hashes,
  XML/screenshot evidence, `results.json`, and `final-device-check.json`.
- All 56 native libraries are byte-identical to the previously checked text-tab
  artifact. The existing 19 RELRO failures remain unresolved.
- Initial pre-safe-area evidence is under `.expo/device-proof/onboarding/`;
  its APK is under `r30-onboarding-final`. It is not the final accepted artifact.

Nothing was deployed. These ignored local artifacts supplement the tracked
source/tests and this report; they do not establish iOS or physical-device
acceptance.

## Remaining acceptance

1. Test fresh first play with people unfamiliar with the game. After their first
   round, ask them to explain what consumes a guess, what a Medium match means,
   Easy hint availability/cost, scoring, reset timing, and how to change difficulty.
   Record misunderstandings and revise the guidance; test completion alone does
   not prove comprehension or enjoyment.
2. Verify TalkBack/VoiceOver traversal, expanded state, feedback announcements,
   focus after collapsing/restarting, and returning to the daily game. The guide
   itself introduces no motion; the existing animated search tips still need
   reduced-motion acceptance.
3. Verify iOS, physical Android, small screens, landscape cutouts, dark theme and
   large text through both instructions and the real first daily game. Test
   keyboard/preview interaction and that the guidance matches editorial content.
4. Test account-link/reminder timing with new players. There is no forced prompt
   in this guide; the existing optional controls remain in Profile.

The fictional practice is a teaching example, not an archive or a full practice
mode. Additional content modes still require product evidence under finding 34.
