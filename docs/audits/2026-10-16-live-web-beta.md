# Live web beta — October 16, 2026 UTC

This report supersedes the deployment/authentication status in the October 15
candidate audit and the historical preparation sections of `docs/hosted-web-beta.md`.
It does not supersede their outstanding release gates. The application remains an
invited web beta; Android and iOS builds remain disabled.

## Released state

- PRs 18, 19 and 20 are merged. PR 20 passed all nine checks before merge;
  its merge commit is `2dc3ef7f743d4063fe77e54f262a8ef4c4b6d5ec`.
- Hosting release time: `2026-10-16T01:30:12.197Z`.
- Hosting version: `5e65aaafed26ca4b`, site `talkie-trivia-beta.web.app`.
- The web artifact was built from isolated PR head
  `96dcdcd8c429c2b4a98909f96509affaeefd9032`. Reward work in the shared checkout
  was excluded. Firebase's source/project/artifact guard passed before upload.
- Artifact SHA-256:
  `e634f66b94194062c1d70ffa606882f9cf8f8c4059084992ca726e1530f62db5`.
- All 49 live files matched the exported bytes. Seven public routes returned
  HTTP 200 with `nosniff` and `no-cache` headers.
- Hosting-only deployment: no Functions or native build in the PR 20 rollout.
  The earlier PR 17 rollout deployed the five changed gameplay/deletion functions.

## Live behavior verified

Using the existing disposable guest browser, at 320px width:

- Help opens and closes with the keyboard and is optional.
- Selecting Hard starts it directly, without a confirmation dialog.
- Returning to Medium preserves its five remaining guesses; reload restores it.
- No horizontal overflow or page errors occurred during this smoke check.

The help control's `aria-expanded` attribute was absent in the live DOM despite
the source supplying React Native `accessibilityState`. The visible state and
keyboard interaction passed; expanded-state announcement remains an accessibility
follow-up. Do not treat the smoke test as a complete accessibility audit.

The reviewed beta content refill was published at approximately 01:23 UTC.
The independent live schedule check found all 40 slots ready for October 16–23,
with no issues. This is beta editorial review, not human approval or rights clearance.

## Deletion operations verified at 01:33 UTC

Read-only Cloud Scheduler, Cloud Logging and Firestore aggregation requests found:

- `firebase-schedule-retryAccountDeletions-us-central1` enabled, every five
  minutes, UTC. Latest reported attempt: `2026-10-16T01:28:02.716565Z`.
- Six recent completion logs, from 01:03 through 01:28, report HTTP 200.
  This establishes actual scheduler delivery, beyond configured intent.
- Zero pending deletion jobs at the instant queried.
- Zero warning-or-higher logs for `deleteaccount` and `retryaccountdeletions`
  since 01:00 UTC; the bounded query was not truncated.
- No Cloud Monitoring alert policies configured in the project; inventory
  was not paginated. Failure notification and delivery remain unverified.

These observations do not exercise a deliberately failed deletion, prove recovery
under outage, or establish Google reauthentication/deletion acceptance. A successful
scheduled invocation with an empty queue is narrower evidence than those tests.

## Remaining release gates

Keep the wider release gated on real Google linking/account switching and deletion,
cross-browser recovery, App Check/abuse protection, alert notification delivery,
backup/restore and rollback rehearsal, support delivery, and content/rights review.
Schedule replenishment beyond October 23 is still required; the current horizon
does not prove automatic publication is operating.

Local evidence (ignored, not required to exist in another checkout):
`.expo/live-beta/pr20-acceptance.json`, `.expo/live-beta/pr20-320.png`,
`.expo/beta-operations-audit.json`, and the isolated release build receipt at
`.expo/web-release-pr20/.expo/web-beta-build.json`. Operational queries printed
only aggregate counts and service metadata, not account records or credentials.

## Accessibility follow-up prepared locally

The shared Button now emits explicit ARIA state attributes for React Native Web,
while preserving native accessibility state. Caller-supplied expanded state no
longer replaces the component's loading/disabled state. Explicit ARIA expanded,
selected and checked values take precedence over their native equivalents.

Three regression tests use the real React Native Web Pressable and React DOM
renderer to inspect emitted HTML, covering collapsed/expanded states, omitted
state, loading combined with expanded state, and false/mixed values. All passed.
The existing `test:scripts` command discovers these tests automatically. Nine
focused native-renderer tests, TypeScript checking and targeted ESLint also passed.
This fix is local and awaits the next combined review/deployment; the live
accessibility limitation described above remains until that rollout.
