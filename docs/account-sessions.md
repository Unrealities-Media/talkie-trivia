# Account continuity and recovery

The app must not silently replace an established account when Firebase reports
that its saved session is gone. First-install guest play remains automatic.

## Current behavior

After observing an authenticated user, `AuthProvider` persists `{ uid,
isAnonymous }` to the AsyncStorage key `account-session-v1` before loading the
player or exposing gameplay. This is a local continuity marker, not a credential:
it never authorizes Firestore access, token creation, game merging or deletion.
It contains no provider email, name, token or secret. Include this local UID in
the final data inventory/privacy review.

When Firebase reports no user and a marker exists, Game and Profile display
account recovery. Retry does not authorize a new guest. Users can sign in with
a linked Google account or explicitly confirm starting a separate guest. The
confirmation explains that prior guesses, statistics and unsaved moves do not
carry over. Replacement does not delete the old server account or its local
pending action. Pending actions remain scoped to their original authenticated UID.

Failed replacement requests retain the old marker. Duplicate requests share or
guard the in-flight operation. Storage read/write failures stop automatic guest
creation or gameplay, rather than pretending storage was empty. Generation guards
prevent stale profile requests from restoring another account's visible state.

A successful user-initiated sign-out permits a new guest only after pending
progress has saved and Firebase sign-out succeeds. Token invalidation does not
use that path. Deletion receipts take precedence over ordinary recovery; accepted
deletion removes only the deleted UID's marker, and starting again still requires
the explicit post-deletion choice. Local cleanup failure retains its receipt.

Continuity is saved before optional merge discovery, because that request can
invalidate cached credentials. Discovery retries an unauthenticated read once
after forcing a token refresh. Firebase may invalidate the session during refresh;
otherwise a second server rejection with the explicit `session-invalid` reason
signs out locally and opens recovery. This never uses the intentional-sign-out
path that permits a new guest. Pending moves and continuity metadata are retained.
Generic authentication failures, network errors and operational Auth failures do
not authorize sign-out. A changed user object aborts the old discovery response,
even if the replacement session has the same UID. Deletion/merge receipts retain
precedence over ordinary continuity enrollment and discovery.

## Android verification, 2026-10-13

The demo Release build uses the same isolated API 36 x86_64 / 16 KB AVD and
loopback Firebase backend described in [the device smoke report](audits/android-device-smoke.md).
Both ABIs rebuilt in 59 seconds (50 Gradle tasks executed, 950 reused).
Unsigned APK SHA-256:
`1739c1a94b077f5f446a562cd0c7f8dec552646bab9cc8792817b0c4e8ae3960`.
The separately signed demo copy uses the existing disposable emulator-only
certificate; its SHA-256 is
`6ad0e6b121715e70c4d1b7a6b3badea81dde4ea3c7c013d43fbf6adb0115b4c8`.
Signature v2/v3 verification and ZIP alignment pass. This is not a store artifact.

The pinned Auth emulator resets token validity during account import. That
reproduced the previous silent replacement bug and now exercises this flow:

1. Enroll a valid anonymous session and save a wrong guess through the real
   callable. Record a baseline of four synthetic accounts, including prior tests.
2. Stop the app, export/stop/import the backend, wait for all services to be
   ready, and launch the app with its now-invalid stored credentials.
3. Game shows **Reopen your account**. Retry, open/cancel replacement, and
   force-stop/cold-launch the app. Recovery remains visible. Independent backend
   assertions find exactly the same four UIDs and game revisions/guess counts.
4. Profile also exposes recovery. Confirm **Start new guest** in its dialog.
   The app opens a fresh game. Backend assertions find exactly one additional
   anonymous account/game at revision zero; all four prior games are unchanged.

Local evidence is under ignored `.expo/device-proof/r30-session-recovery/`:
`baseline.json`, `blocked.json`, `replacement.json`, signing report/APK, and paired
XML/screenshots including `invalidated`, `replacement-confirmation`,
`recovery-after-restart`, `profile-recovery` and `confirmed-new-guest`.
The baseline export is `.expo/device-proof/firebase-export-recovery-baseline/`.
The verified five-account final state is preserved separately in
`.expo/device-proof/firebase-export-recovery-final/`.

Seven focused app suites pass across targeted runs (49 tests), including marker
corruption/I/O failure, restart, duplicate attempts, provider arrival, intentional
sign-out, deletion cleanup and the confirmation UI. TypeScript passes. These
tests mock provider APIs; the Android flow above uses real emulated Firebase.

## Cached-token rejection follow-up, 2026-10-13

Reminder testing exposed a generic account-loading error with a preserved imported
session. Real Auth/Functions emulator tests reproduced the underlying failure
class: a callable rejected a revoked session while Firebase still exposed the
cached user; forcing refresh could succeed with the old `auth_time`, and the next
callable still rejected it. Refresh alone did not recover. The recovery endpoint
now distinguishes definitive caller-session invalidation from operational
failures, allowing the client to enter continuity recovery after one refresh.
Server ownership/revocation checks remain enforced.

The final focused runs pass 52 app context/service tests, 75 server authorization
tests and three real Auth/callable cases. App TypeScript and the Functions build
pass. The real cases cover a valid session without unnecessary refresh, revoked
credentials requiring the explicit invalid-session response, and disabled
credentials rejected by the Auth SDK itself. They verify no replacement account
or identity/revocation changes; a normal refresh can update Auth's refresh-time
metadata. Earlier test failures exposed the refresh behavior and then an overly
strict timestamp assertion; both are recorded here rather than counted as passes.

The updated demo APK rebuilt in 52 seconds (50 tasks executed, 950 reused).
Unsigned SHA-256:
`562cf7ed3dfeab0d01a739ec755db2df4798e57ca6c69ead7f8af748fc4e61c1`.
Disposable demo-signed SHA-256:
`f891f393ac36b36064103e5c04f108dcdbe11590e34c84cc0148953f04c35a83`.
Signature v2/v3 and 16 KB ZIP alignment pass. All 56 native libraries match the
previous reminder artifact byte-for-byte; the 19 RELRO failures remain.

On the API 36 x86_64 / 16 KB Android emulator, the previously failing session had
already expired and showed recovery before the update. That is not before/after
proof of this fix. The controlled follow-up explicitly confirmed one new
disposable guest, preserving the six existing accounts, and recorded its game.
Only the new guest's refresh credentials were then revoked on the loopback Auth
emulator. The updated app showed **Reopen your account** after launch, Retry and
cold restart. Independent assertions confirmed all seven accounts and all 22
player/game/statistics/history documents were unchanged from the established
guest baseline. No eighth account was created. Native logs did not establish
execution of the repeated-discovery-rejection branch; the real callable tests
above cover that branch separately.

Evidence is under ignored `.expo/device-proof/r30-session-refresh/`, including
`source-copy.json`, `baseline.json`, `established.json`, `revocation.json`,
`recovered.json`, `verification.json` and paired UI captures. The APK/signing
report are in `.expo/device-proof/r30-session-refresh-artifact/`. The seven-account
state is preserved in `.expo/device-proof/firebase-export-session-refresh-final/`.
No live backend or store credentials were used.

## Remaining limits

- This prevents silent replacement; it cannot recover an unlinked anonymous
  account after its authenticating credentials are gone. A stored UID alone
  must never grant access. The [native Google provider adapter](native-google-sign-in.md)
  is implemented with focused tests; real OAuth/device acceptance, Apple and
  existing-account merge remain open.
- A previously installed version that never recorded a continuity marker cannot
  identify an already-lost session on its first upgraded launch. Existing valid
  sessions enroll when opened. Clearing app data/reinstalling may also remove the
  marker. Legacy migration and cross-device recovery remain release gates.
- The device test verifies UI/backend state, not TalkBack, iOS or production
  provider reauthentication. Deletion-marker cleanup and intentional sign-out
  are covered by targeted tests but need native provider/deletion acceptance.
- The 19 native RELRO alignment failures are unaffected. No production deployment,
  real-account operation or store submission occurred.
