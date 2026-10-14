# Android Release-mode device smoke test

Verified locally on 2026-10-13. This is a development-identity/demo-backend
smoke test, not store approval or full 16 KB compatibility acceptance.

## Artifact and environment

- Expo-generated Android project; React Native 0.86.3/Hermes built from source
  using the checked-in preparation plugin, NDK 30.0.16248370 and both 16 KB
  linker flags. Both ARM64 and x86_64 compiled in 13m40s (1000 Gradle tasks,
  968 executed). Installed locked dependencies and Gradle caches were reused.
- The device fixture copies `src` and assets. Only installed dependencies are
  junction-linked. It uses a distinct Metro cache namespace.
- Initial gameplay-smoke unsigned APK: 84,154,443 bytes, SHA-256
  `865db06c2b90b3cabe4aa6c739d067d909383017e4452322ca067192d046a0ad`.
- A separately signed copy uses a disposable local test certificate and
  `com.unrealities.talkietrivia.dev`, with `firebaseUseEmulators=true` and
  `demo-talkie-trivia`. No store credentials or debug-release signing fallback
  were used. Signed SHA-256:
  `b608f80bdcf53c146f7d375c1e6f5be08430f0ddc4a2736ee97bcb5d1695be3a`.
  `apksigner verify` passes v2/v3; ZIP alignment passes.
- Isolated AVD `talkie-16k-audit`, serial `emulator-5580`, API 36 x86_64,
  fingerprint
  `google/sdk_gphone16k_x86_64/emu64xa16k:16/BE2A.250530.026.F3/13894323:userdebug/dev-keys`.
  `getconf PAGE_SIZE` returns 16384. Its second full boot used 4 GB RAM/four
  cores, showed the home screen and had no `am_anr` event. A targeted ADB
  reconnect was needed; existing user AVDs were untouched.
- `firebase.device.json` starts loopback-only Auth/Firestore/Functions. The
  Functions source was rebuilt. One synthetic reviewed-schema challenge was
  seeded for the current UTC date; this is not editorially approved content.

## Observed pass

1. Cold launch opens the Game screen, signs in anonymously and calls the real
   emulated `startGame`. No Metro development server supplies the JS bundle.
2. Search for `Alive` returns `#Alive (2020)` and `Alive (1993)`. Selecting the
   latter submits a wrong guess through `applyGameAction` and displays it.
3. Force-stop/relaunch restores that guess and the same guest identity.
4. Selecting `#Alive (2020)` completes the game in two guesses. The result and
   poster render. Profile displays one win in the two-guess bucket and 595 points.
5. Independent read-only emulator assertions confirm exactly one anonymous
   account, one game at revision 2, two guesses, one history record,
   `wins=[0,1,0,0,0]`, one game credit and matching game/history/statistics scores.
6. The inspected AndroidRuntime/ReactNativeJS/linker logs show no app exception
   during this flow. This is a bounded observation, not exhaustive crash testing.

Local evidence is under ignored `.expo/device-proof/`: `gameplay-result.json`,
`restarted-window.xml`, `win.png`, `profile-stats.png`, the signing reports and
`firebase-export/`. The export contains only this synthetic test session.

## Failures and limits

- **The binary compatibility gate still fails:** all 56 LOAD checks and ZIP
  alignment pass, but 10 ARM64 and 9 x86_64 libraries fail RELRO end alignment.
  See [library investigation](android-native-libraries.md). A successful launch
  does not exercise every native library or establish compatibility on all
  devices, OS releases or generated AAB splits.
- **Search accessibility is partially repaired:** the original absolutely
  positioned results had inverted bounds (`#Alive`: `[26,1164][1054,1129]`).
  The follow-up below verifies normal result bounds after putting the list in
  page layout. TalkBack focus/activation, clipped preview rows and the full
  device/text-size matrix remain unverified.
- **Fixture failure corrected:** the first APK opened Unmatched Route. Its
  generated Metro context registered keys such as `../../../../src/app/...`
  from a junction and reused another fixture's route transform. Copying source
  and giving the fixture its own cache namespace produced correct `./(tabs)/...`
  keys and restored startup. Expo's CI export explicitly ignores `--reset-cache`.
  There was no missing index route in the app. Earlier compile-only artifacts
  do not count as gameplay evidence.
- Easy hint allowance/re-view/restart and selected 200% light/dark layouts are
  now covered by the [readability follow-up](readability-and-hints.md).
- Still untested here: offline/pending-action recovery, midnight
  reset, provider login/link/merge/deletion, screen readers, comprehensive large text, themes,
  low-end performance, ARM64/4 KB hardware, iOS and signed store artifacts.

## Search layout follow-up

The results and tutorial tips now participate in page layout. The list has a
bounded scrolling viewport with Android nested scrolling enabled; the footer
can grow with text size independently. The Game scroll view enables automatic
iOS keyboard insets, which still need iOS verification.

The same two-ABI Release fixture rebuilt in 1m (50 tasks executed, 950 reused).
Unsigned SHA-256: `8716c564bbd58c00b515e34f6eb800fb41fd19584bae949809350856cf9f4ae9`.
The installed demo copy, signed with the existing disposable certificate, has
SHA-256 `9319107093e9b60210d8a2bf5074d309373e1ccc37698b38bb7eafd860646817`.
Signature verification and ZIP alignment pass. Native library source was not
changed by this layout fix: all 56 packaged native libraries are byte-identical
to the prior tested APK. It does not resolve the 19 RELRO failures.

On the same 16 KB emulator:

- With the keyboard visible, `#Alive` has valid bounds `[26,972][1054,1148]`
  and `Alive` has `[26,1150][1054,1326]`; both are above the keyboard.
- Long-press expands a preview. Scrolling its list exposes the second result,
  and tapping that result saves one wrong guess through the real callable.
- At system font scale 1.5, scrolling the page brings both results and the
  footer above the keyboard. The original 1.0 setting was restored afterwards.
- A controlled force-stop, same-certificate APK reinstall and cold launch
  preserve the current guest and its saved wrong guess.
- The focused picker/UI/item/tutorial suites pass (34 tests); TypeScript passes.

These checks do not prove TalkBack operation. UIAutomator still includes
inverted bounds for offscreen children clipped by the expanded list viewport;
the visible second button becomes valid after scrolling. First-run tutorial
tips were already dismissed in this account and need a fresh-install check.
Large text also exposed a cramped header, and the light theme had visibly weak
hint/footer contrast. The [readability follow-up](readability-and-hints.md)
repairs those paths and verifies selected 200% layouts; comprehensive
accessibility acceptance remains open.

Evidence is under ignored `.expo/device-proof/r30-search-layout/`: signing
report, APK, and paired XML/screenshots for `search-keyboard`,
`preview-scroll-end`, `selected-after-scroll`, and `large-text-scrolled`.
The original single-account gameplay export is preserved separately.

### Account restoration failure found during this check

Restoring the original emulator export and launching the app creates a second
anonymous account instead of reopening the first account's completed game.
A controlled repeat (stop app, export, stop backend, import, wait for all services
to be ready, launch app) creates a third account. This rules out an initial
backend-startup race as the sole explanation. The controlled APK reinstall while
the backend remained running did retain its account and saved guess.

The pinned Auth emulator's `operations.js` sets `validSince` to import time in
the batch-create path used by `AuthEmulator.importData`. Read-only inspection
confirmed the restored second user's `validSince=1791923617`, later than its
`lastLoginAt=1791923333183` milliseconds. Existing ID tokens consequently expire.
The client at that point started a new anonymous session whenever Firebase
reported no user, without a continuity marker or explanation. Its old game
remained in Firestore. This was not evidence that the old records were deleted
or that ordinary APK updates lost progress. The subsequent
[account-continuity fix and installed regression](../account-sessions.md) now
prevent silent replacement for enrolled sessions, including across app restart.
Previously lost, unlinked credentials and pre-marker installs remain limitations.

The intermediate `.expo/device-proof/firebase-export-search/` preserves the
first completed guest and second guest's wrong guess. The original export is
unchanged. `backend-restored.xml`/`.png` show the unexpected fresh game. Do not
assume emulator import preserves a currently signed-in device's credentials.
The final three-account state is preserved in `firebase-export-search-final/`.

## Repeat safely

Generate an isolated project from the current source, copying app source/assets
as real directories. If dependencies are shared across fixtures, isolate Metro's
cache and inspect the generated route context before installing. Compile both
ABIs and run the page-size verifier against the final APK. Do not waive failures.
For local installation only, check the compiled package and embedded Expo config,
then sign a copy with a dedicated test certificate using Android's
[apksigner](https://developer.android.com/tools/apksigner). Keep that certificate
out of source and never use this artifact for distribution.

Start the demo backend described in [emulator testing](../emulator-testing.md),
seed synthetic content or import the saved demo export, and target the isolated
AVD explicitly on every ADB command. Repeat the steps above and check both UI
and authoritative emulator records. Preserve the guest across app updates with
the same local test certificate. Stop the test AVD/backend when finished.
