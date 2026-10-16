# Browser engine acceptance — October 16, 2026

The local Firebase-emulator acceptance run passed **16 tests** across Firefox
157 and WebKit 27.2, using Playwright 1.64.1. Four duplicate viewport cases were
intentionally skipped: keyboard testing uses an explicit 320px viewport once per
engine, and reward testing covers its viewport variants once per engine.

Verified behavior includes guest startup, keyboard movie preview, direct mode
switching, optional help, guessing, hint purchases, saved progress after reload,
completed rewards, sharing, history, and retrying a throttled move with the same
command identity. The tests used demo Firebase emulators, not live beta accounts.

The first run found that Firebase's default web auth initializer proactively
loaded its Google popup helper on WebKit. This app uses Expo OAuth and Firebase
credentials instead of Firebase popup/redirect auth. Explicit initialization now
preserves the existing IndexedDB/local/session persistence order without that
unused resolver. Unexpected initialization errors are surfaced; only the known
already-initialized case reuses auth during hot reload.

The remaining WebKit failures coincided with explicit reloads and matched
[an upstream cancellation misclassification](https://github.com/microsoft/playwright/issues/43120).
The test helper separately records only the exact local Firestore Listen/Write
channel error during a wrapped reload. Every other page error still fails.
Browser-safety regression tests cover the scope of this exception. A speculative
emulator long-polling change did not help and was removed.

Firefox's keyboard check originally attempted to wrap through browser chrome to
reach Help. It now uses Shift+Tab from the mode controls to reach the earlier Help
button. No application focus behavior was changed to accommodate the test.

Validation: 16 browser tests, seven Firebase initialization tests, four browser
safety tests, TypeScript, targeted lint and whitespace checks passed. Ordinary PR
CI remains Chromium-only; additional engines are selected explicitly with
`TALKIE_BROWSER_ENGINES`. No native build was run. Real Safari/iOS device testing,
Google account lifecycle acceptance and live multi-device recovery remain open.

Local ignored evidence: `.expo/cross-browser-final.log` in the primary checkout
and `.expo/browser-report` in the isolated checkout. The changes were locally
verified at this audit stage; this document alone does not establish deployment.
