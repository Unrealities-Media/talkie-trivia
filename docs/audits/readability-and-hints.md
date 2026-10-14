# Readability and acknowledged hints

Local follow-up to findings 09, 14 and 23, verified on 2026-10-13. This is a
bounded Android check, not comprehensive accessibility or store acceptance.

## Changes

- The Game heading and saved difficulty occupy separate, growing rows. Loading,
  offline, deletion and account-recovery screens do not claim a locked difficulty.
  The label reads the saved game's difficulty rather than a preference/default.
- The hint tray mounts only when expanded, grows with its content and wraps its
  buttons. Collapsed actions no longer remain mounted in a zero-height container.
  Basic hint labels/values stack; revealed text can wrap beside its icon. Medium's
  hint explanation is informational rather than a disabled hint button.
- Shared buttons and hint controls have minimum 48-point targets. The tab bar
  accounts for font scale and the bottom safe-area inset; its labels no longer
  clip at the tested 200% setting. Normal-size tab targets have a minimum height.
- Text uses `accentText`, `onAccent` and `onError` rather than reusing decorative
  yellow or a page background as a text color. Secondary text, status colors,
  statistics and borders have stronger contrast. Yellow fills remain. The
  tutorial no longer forces a white button background in dark mode.
- Selecting an Easy hint records intent locally. Its text appears only when
  the same account/game's authoritative `hintsUsed` acknowledges it. Pending
  requests stay hidden, retry acknowledgment reveals the selected hint, and
  unknown/disabled choices do nothing. Previously used hints reopen without
  another server command. This repairs a real premature reveal in the old hook;
  it does not prevent inspection of answer/hint metadata already sent to clients.

## Evidence

Thirty-one focused suites pass across targeted runs (160 distinct tests),
including existing color consumers, real hint controls, Game branches and seven
hint-hook regressions. App TypeScript passes. The old Game test replaced every lazy child and did not
exercise the difficulty component; the updated test uses the real heading and
difficulty while excluding unrelated lazy gameplay/effects. Jest's dynamic import,
safe-area and Dimensions-subscription test setup failures were corrected explicitly.

The contrast regression calculates relative luminance for text colors on white,
gradient endpoints and card surfaces in both themes, plus actual rendered shared
button foreground/background pairs and revealed hint text. It requires 4.5:1 for
these text pairs and 3:1 for control boundaries. These targets follow
[W3C's contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
The lowest tested ordinary light-theme text/surface pair is approximately 4.95:1.
This is not a pixel audit of every image, animation, pressed state or overlay.

On the existing API 36, x86_64, 16 KB emulator, with actual local demo Firebase:

1. Importing the preserved five-account export opens account recovery without a
   misleading difficulty label. Explicit replacement creates one sixth guest.
2. For Easy layout testing only, a guarded Admin fixture changes that sixth
   guest's untouched revision-zero game from Medium to Easy. It checks that the
   five earlier games are unchanged. This is not evidence for the difficulty
   preference/new-game flow. All subsequent hint actions use the app/callables.
3. At system font scale 2.0, the heading/difficulty and all four hint choices
   have visible, non-overlapping bounds. Director/Genre/Decade occupy the first
   row; Actors wraps to a second row. Tabs remain fully readable. Screenshots
   confirm light and dark appearances, including revealed text and error buttons.
4. Selecting Director displays the acknowledged value and reduces the allowance
   from three to two. Reopening it leaves the backend at revision 1 with only
   `director: true`. Genre and Decade consume the remaining two hints.
5. The fourth hint has `enabled=false` in the native tree. Tapping it leaves the
   backend at revision 3 with exactly Director, Genre and Decade used. All five
   prior games retain their revisions, guesses, outcomes and scores.
6. Cold restart preserves Easy difficulty and zero remaining hints. Font scale
   and appearance are restored to 1.0/light after testing.

Ignored evidence: `.expo/device-proof/r30-readability/` contains the fixture
record, backend assertions (`hints-1.json`, `hints-3.json`), and paired native
XML/screenshots including `recovery`, `final-hints-expanded`, `final-hint-saved`,
`final-hint-dark`, `final-hints-exhausted-dark` and `final-restarted-normal`.
Intermediate signed APKs/reports are retained separately. The tested artifacts
use only the demo project and existing disposable emulator certificate.

The main 200% hint checks use the 59s two-ABI Release rebuild, signed APK SHA-256
`8a7e4f9c4753c4dc39d7690e82d68beefc9baa7fa4f9db3f0c7c48d8e7bd8d37`
in `r30-readability-final/`. Normal-size measurement then found the tab hit area
was about 43 dp tall. The final minimum-target adjustment rebuilds in 55s (50 of
1000 Gradle tasks executed); `checked-normal.xml` measures both tabs at 129 px,
or 49.14 dp at density 420. That APK is retained in `r30-readability-checked/`:

- Unsigned SHA-256: `74da5ba2f25fbb35ca567bdd6e6fa6b268206ae463dfec74b1336f66006e4f9e`.
- Demo-signed SHA-256: `ed7ff6b6efb3621a57bfa5e02a2f00847b2c9d6646e0e3a2fa7328c42751b42f`.
- Signature v2/v3 and ZIP alignment pass. All 56 packaged native libraries are
  byte-identical to the previously tested session-recovery APK, retaining its
  19 unresolved RELRO failures.

`checked-large.xml` confirms the final artifact retains the 200% header/hint/tab
layout. The six-account state is preserved in the separate
`.expo/device-proof/firebase-export-readability-final/` export; previous exports
remain intact. Future imports can invalidate saved Auth credentials as explained
in [account continuity](../account-sessions.md).

## Still required

- TalkBack/VoiceOver focus, announcements, activation, reduced motion and switch
  control; UIAutomator bounds do not prove screen-reader usability.
- iOS, smaller screens, orientation/multitasking, larger display scaling, full
  Profile/history/dialogs, Basic hints and first-run tutorial flows.
- Native transport failure/process death during a pending hint; rejection and
  acknowledgment sequencing currently have hook-level regression evidence.
- Complete image/overlay/pressed-state contrast review and long content checks.
- The separate 19 native-library RELRO failures, signed store artifacts and all
  remaining security/content/provider/operational release gates.
