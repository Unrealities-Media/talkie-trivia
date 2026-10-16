# Live web beta — October 16, 2026 UTC

This report supersedes the deployment/authentication status in the October 15
candidate audit and the historical preparation sections of `docs/hosted-web-beta.md`.
It does not supersede their outstanding release gates. The application remains an
invited web beta; Android and iOS builds remain disabled.

## Latest release follow-up

PRs 25–34 are now merged. Hosting version `6b4734a0004dc3ef` shipped PR34
at 05:00:12.065 UTC; all 47 exported files matched the live bytes. Recent player
fixes include search pagination, game-mode continuity, archive recovery, sharing
fallbacks, corrected Settings links, and opening Settings after connectivity drops.
PR34 passed all nine required checks. Its local Chromium suite passed eight tests
with two intentional duplicate-viewport skips.

At 05:03 UTC, the merged PR30 statistics backend and Firestore rules/indexes were
deployed after discovering that Hosting had advanced without that backend rollout.
Firebase could not grant `allUsers` invocation on the newly created statistics
service because of the organization's IAM membership restriction. The service was
configured with the same `invokerIamDisabled` setting as existing beta callables;
Firebase authentication remains enforced in the callable. No organization policy
was changed. All 13 functions were subsequently ACTIVE and pending merges were zero.

Live mobile-viewport acceptance at 05:06:49 UTC saved a guest win, loaded Profile
and All Stats through `getPlayerStatistics`, confirmed statistics version 3, and
verified reload preserved the completed-challenge count with no browser errors.
Local evidence: root `.expo/live-beta/statistics-acceptance.json`.
At 05:07:03 UTC, the read-only operations check passed all eight checks with zero
pending deletions or overdue cleanup records. The reported scheduler attempt was
05:02:01 UTC, so it does not establish delivery after this latest backend update.

PR31 extended the independently verified schedule to 50 ready slots for
October 16–25 UTC. This remains beta editorial review, not human rights clearance.
Android/iOS builds remained disabled throughout these changes.

### Earlier PR23–24 follow-up

PR23 subsequently shipped Hosting version `f42547a37b8f537e` at
02:24:54.240 UTC. PR24 passed all nine checks and merged at 02:35:43 UTC;
its rollout updated only `retryAccountDeletions` to concurrency one with no
Scheduler retries. Hosting remains on PR23. The manual read-only
`npm run beta:operations` check at 02:41:56 UTC passed all eight checks and
reported no pending deletions or overdue completion/receipt records.
Its latest reported scheduler attempt predates the worker update, so this is
configuration/queue evidence, not post-update delivery acceptance.

See [the current handoff](../CONTINUING.md) for the remaining release gates and
[browser-engine acceptance](2026-10-16-browser-engines.md) for PR23's local
Firefox/WebKit evidence. Native builds remain disabled for routine work.

## PR22 release

PRs 18 through 22 are merged. PR22's exact reviewed head,
`2092011b02fa65c0728e20a1c1fcb264966ba66a`, passed all nine checks and merged as
`d6a51337de524a971cdd73804c649b5b75a90332` at 01:48:11 UTC.
Hosting version `f54b59e68626fad4` was released at 01:50:08.238 UTC.
The rollout updated `startGame` and Hosting; Android/iOS builds stayed disabled.

The live reward acceptance check at 01:51:18 UTC verified a new Very Hard game's
full synopsis differs from its clue, the completed reward displays that saved
synopsis, reload restores it, and the narrow viewport has no page errors.

See [deletion and recovery checks](2026-10-16-beta-recovery.md) for the subsequently
completed anonymous guest deletion, database delete protection and preview-only
Hosting rollback rehearsal. Backend rollback, database restore and Google account
lifecycle acceptance remain open.

## Earlier PR20 rollout

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

At the PR20 rollout, the help control's `aria-expanded` attribute was absent in the live DOM despite
the source supplying React Native `accessibilityState`. The visible state and
keyboard interaction passed; expanded-state announcement remains an accessibility
follow-up. PR21 subsequently resolved this (see below). Do not treat the smoke test
as a complete accessibility audit.

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
backup/restore and backend rollback, support delivery, and content/rights review.
The Hosting artifact rollback rehearsal is now documented separately; it did not
exercise an actual live rollback or prove compatibility with every backend version.
Schedule replenishment beyond October 25 is still required; the current horizon
does not prove automatic publication is operating.

Local evidence (ignored, not required to exist in another checkout):
`.expo/live-beta/pr20-acceptance.json`, `.expo/live-beta/pr20-320.png`,
`.expo/beta-operations-audit.json`, and the isolated release build receipt at
`.expo/web-release-pr20/.expo/web-beta-build.json`. Operational queries printed
only aggregate counts and service metadata, not account records or credentials.

## Accessibility follow-up shipped in PR21

The shared Button now emits explicit ARIA state attributes for React Native Web,
while preserving native accessibility state. Caller-supplied expanded state no
longer replaces the component's loading/disabled state. Explicit ARIA expanded,
selected and checked values take precedence over their native equivalents.

Three regression tests use the real React Native Web Pressable and React DOM
renderer to inspect emitted HTML, covering collapsed/expanded states, omitted
state, loading combined with expanded state, and false/mixed values. All passed.
The existing `test:scripts` command discovers these tests automatically. Nine
focused native-renderer tests, TypeScript checking and targeted ESLint also passed.
PR21 shipped at 01:42:51.814 UTC as Hosting version `1be6ba63a7257d73` and is
included in PR22. The live acceptance check verified help's expanded state,
selected tab/mode state, progress restoration and the narrow viewport. Its local
evidence is `.expo/live-beta/pr21-acceptance.json`; PR22 reward evidence is
`.expo/live-beta/pr22-acceptance.json`.
