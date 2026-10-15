# Combined web-beta candidate — October 15, 2026

Local branch: `codex/web-beta-candidate`. Integration commit:
`5ce65888dfc9a19d92459f552e4fb177972575c2` for app/backend/content changes;
`ecfdd859716c5ee67c83bd1d337e0b95077b226f` also integrates the CI cost reduction.
The merge was local only; main and the hosted beta were not changed.

## Included changes

| Review | Included head | Resulting behavior |
| --- | --- | --- |
| [PR 13](https://github.com/Unrealities-Media/talkie-trivia/pull/13) | `dd1fc1cd90c121b45f8c402d2bfc904a3a243043` | Explicit keyboard/pointer movie preview without submitting a guess. |
| [PR 14](https://github.com/Unrealities-Media/talkie-trivia/pull/14) | `135d53faffa16444c203f2ad703cf98f9096b224` | Shared per-account gameplay budget and durable retry after throttling. |
| [PR 15](https://github.com/Unrealities-Media/talkie-trivia/pull/15) | `3d6de2b6ac8b6bb24e324d59666fbb804a505320` | Read-only, answer-free upcoming schedule readiness report. |
| [PR 16](https://github.com/Unrealities-Media/talkie-trivia/pull/16) | `9930582a5a874762b685f7fc39b59b1dd3456002` | Scan new commits on ordinary PRs, retaining full history for policy changes and non-PR events. |
| Hosted audit | `19d3167` | Records verified public pages and corrects the stale publication blocker. |

All branches combined without conflicts. The combined browser test file retains
both the keyboard-preview assertions and the throttled-action recovery scenario.

## Combined verification

One fresh emulator-configured web export and all six Chromium contracts passed
on the integrated source: desktop and mobile guest play, keyboard previews,
give-up/win/history/share fallback, hint persistence, duplicate prevention,
throttled manual retry and reload recovery. TypeScript checking also passed.
These are combined-candidate results, not an assumption based on separate PRs.

The normal beta build also completed for `talkie-trivia-beta`, preview variant,
with emulators disabled. Its `web-build` directory passed the existing
`verifyBuild('talkie-trivia-beta')` receipt/digest check. Artifact tree SHA-256:
`7a8a81194ebbb5cd5ca33d9b081068e1d026be7e50eff097fa270285547824e3`.
This local artifact has not been deployed; the hosted audit identifies the
currently observed hosted bytes separately. Build output and receipt are ignored
local artifacts and must be rebuilt if absent or changed.

The backend, rules and Go changes are unchanged from their individually tested
PR heads; their full suites were not redundantly rerun locally in this pass.
PRs 13–16 have all remote checks green. PR 16's full-history secret scan passed
in 7m57s. Recheck final heads before merging; no failing check may be waived based
on this document. These PR checks do not cover the subsequent local focus fix below.

After integrating PR 16, the existing beta artifact passed receipt verification
again. The diff from the tested app integration contains only documentation,
the security workflow and scanner scripts/tests. No application or backend source
changed, so no redundant web rebuild or broad local test run was performed.

## Subsequent narrow-screen keyboard fix

A new 320×640 Chromium contract reproduced a confirmation-dialog focus race:
after cancelling and reopening, deferred initialization could return focus to
the cancel button after Tab had moved it to Start challenge. Initialization now
preserves focus already inside the dialog. The regression checks Tab/Shift+Tab
containment, cancel-and-reopen focus restoration, keyboard challenge start,
search-result focus and Space-activated movie preview. The checked controls fit
the viewport and the page has no horizontal document overflow in this scenario.

After the fix, a fresh emulator-configured web export passed seven browser
contracts in 38.9s; one duplicate narrow-viewport test is intentionally skipped
under the mobile project. TypeScript checking and diff whitespace validation
passed. This is Chromium keyboard/reflow evidence, not screen-reader, text-size
scaling, Safari or physical-device acceptance.

The earlier normal beta artifact predated this app-source fix and was unsuitable
for deploying this candidate. The subsequent build below replaces it. Do not
deploy the emulator-configured test export. The fix remains local on the combined
candidate; no additional PR, CI run or deployment was created in this pass.

## Source-aware beta deployment receipt

The next pass added a source digest to the build receipt and deployment guard.
The old on-disk receipt was rejected as expected. Focused tests cover matching
source, new/modified/deleted source files, documentation-only edits, old receipts,
project mismatch, emulator configuration and changed output (three tests passed).
A source change during export also prevents receipt creation; this guard is
implemented but was not exercised by interrupting an actual export.

One normal web beta build then completed with the focus fix and source guard,
for `talkie-trivia-beta` with emulators disabled. Verification passed:

- Artifact SHA-256: `8ea8e35dc8c0b7494bdf46b7de2d278b28ac51b7be45b438a8b44ae32a548195`.
- Source SHA-256: `adab0e4acf915019bcb9d6a0a7701d9dbaf735f2defc8818b375ed3f3ee2bf0b`.

See [the build-input scope and limitations](../hosted-web-beta.md#build-and-publish-the-website).
This verifies the local artifact; it is not deployed acceptance. No native build,
remote CI run or deployment was initiated. The normal receipt and generated site
remain ignored local files and must be regenerated if absent or rejected.

## Subsequent deletion completion fix

Review found that a deletion worker could lose its lease before finalization but
still return `complete: true`: the transaction skipped its writes, while the
caller returned success unconditionally. Completion now comes from the transaction
result. A lost lease reports incomplete unless another worker has already committed
the complete state.

The regression injects a replacement worker's lease after real emulator Auth
deletion, checks both the response and receipt remain pending, then expires the
lease and verifies recovery completes despite Auth already being absent. All 127
Auth/Firestore/Functions contracts and the Go emulator contracts passed. Functions
source was compiled freshly by the runner; no frontend or native build was needed.
This change is local to the candidate and requires a Functions rollout, independently
of Hosting, before it protects the live deletion flow.

## Subsequent web download-size pass

Four FontAwesome imports now use the specific family entry point rather than
the package barrel. Startup no longer loads the unused `PremiereSerif` font;
the source font asset is retained. The fresh normal beta export contains only
FontAwesome and Ionicons icon-font families, instead of all families.

Across all ten emitted JavaScript chunks, raw size fell from 6,699,876 to
6,286,236 bytes; Node's default gzip estimate fell from 1,802,448 to 1,675,260
bytes (127,188 bytes, about 7.1%). The unused startup font was another 774,220
uncompressed bytes. These are artifact measurements, not measured Firebase
transfer sizes or load-time claims; unused bundled icon fonts were not necessarily
requested at runtime. Large decorative PNGs remain a performance concern.

TypeScript checking, all 18 tests across the four affected component suites,
the web export and source/artifact receipt verification passed. The test mock
now follows the direct FontAwesome import. No native build or remote CI run was
triggered. This replaces the previous local web artifact:

- Artifact SHA-256: `1292b4691ada89849ef6da2934972a310554e8c20f2362a9bb736795f2e41fd5`.
- Source SHA-256: `aaf0cd507f3dc4e1d6fceff26f178c67b8b6fb6d36f5ee88aa6d7dcd02fa01f1`.

No deployment or new browser timing/visual acceptance is claimed by this pass.

## Publication automation evidence

The October 15 follow-up found no repository Actions variables, so the explicit
`ENABLE_STAGING_SCHEDULE=true` opt-in is absent. The current publication workflow
therefore skips scheduled publication; manual dispatch remains available with its
environment and project guards. No setting was changed or workflow dispatched.
The five latest recorded publication runs are old failures (March 15 through
April 12, 2026). They do not prove the current workflow fails, but they provide no
evidence of a working replenishment process. Do not rely on automatic renewal of
the beta content horizon. Live schedule verification and an approved refill plan
remain release tasks after Firebase authentication is restored.

GitHub reports `Native build verification` as `disabled_manually`. This pass did
not run or enable Android/iOS builds.

## Before rollout

- Confirm the reviewed heads are still current and required checks have passed.
- Use the candidate's normal beta build and project-verification receipt; never
  deploy the emulator-configured browser-test export.
- Confirm the deployed catalog when running the read-only content check. The
  previously reported October 21 horizon has not been revalidated against live
  Firestore in this pass. More approved content is still needed before expiry.
- A Functions rollout is required for the gameplay budget. Publishing only the
  web artifact does not enable backend abuse controls. Follow existing project
  guards and deployment authorization; this document does not authorize writes.
- After deployment, verify cold-load/restored-tab search, keyboard preview,
  normal game progress and safe retry against the deployed build. Local emulator
  evidence does not establish production IAM, App Check or real-provider login.

Keep invited-group access. App Check, global abuse monitoring, content/rights,
staging/rollback and operational support/deletion acceptance remain open.
Android/iOS builds remain disabled throughout this web-beta stage.

## Live schedule check blocked by expired authentication

The subsequent read-only check targeted `talkie-trivia-beta`, today plus seven
days ahead, using the existing Firebase CLI account. A saved account/refresh
credential exists, but obtaining an access token fails with the CLI's
reauthentication-required error. No Firestore reads or writes were completed;
there is no live health result. The prior October 21 horizon remains unverified.

Restore the local session interactively using the installed CLI:

```powershell
rtk proxy node .expo/dependency-upgrade.cjs node integration node_modules/firebase-tools/lib/bin/firebase.js login --reauth
```

The wrapper uses the project's local Node 24 runtime. Do not paste credentials
or login codes into a chat or commit them. After local login is restored, run the
read-only `-check-schedule` command with the explicit beta project and released
catalog. The local `.expo/check-live-schedule.cjs` helper passes the short-lived
access token only in the child environment and emits no token or answer data.
This authentication blocker applies to live verification, not local development.
