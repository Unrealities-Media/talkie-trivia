# Continuing development

Checkpoint: October 14, 2026 in America/Chicago. **The invited web beta is
playable, but wider public beta and both app stores remain blocked.** This
document is the starting point for the next work session.

The live schedule covers October 14–21 UTC and needs more reviewed content
before October 22 UTC. Production approvals and rights review remain open.
The reported zero-height search results blocker is fixed locally, pending web
export, deployment and live cold-load/restored-tab verification. Public backend
App Check and rate limits remain unfinished; retain invited-group access policy.
See the [latest beta audit](audits/live-beta-2026-10-14.md) for evidence and the
remaining UX findings. Local changes have not been deployed in this stage.

The subsequent cohesion pass improves challenge confirmation, keyboard search,
sharing, result themes and Profile hierarchy. See the
[cohesion checkpoint](audits/2026-10-14-cohesion.md) for local browser evidence,
Android bundle validation and remaining device/release limits.

Launch decisions: movies only, one daily challenge with a worldwide UTC reset,
three hints per Easy game, no paid features, and guest play with optional account
sync. Keep these decisions unless the product scope explicitly changes.

## What is implemented and verified

The server now owns game actions, scoring and saved results. Account recovery,
deletion and merge safeguards, persistent retry, history pagination, onboarding,
search and result presentation have substantial implementation and focused test
coverage. Implementation does not establish production or platform acceptance.
The [40-finding remediation tracker](audits/remediation-status.md) records the
individual status and evidence; the [original audit](audits/2026-10-13-release-readiness.md)
is a historical snapshot, not a description of all current behavior.

The latest local stage fixed the reported account-loading failure caused by a
stopped Auth emulator, recovery after emulator imports, missing playable demo
content, Windows snapshot export, Medium hint copy and the web search role.
Actual Chromium play covered wrong guesses, wins, all Easy hints, give-up
confirmation, UTC rollover, profile/history and saved-account restoration.
App and Functions compilation and 64 focused tests passed in that stage. This
checkpoint only adds documentation and repository hygiene; those earlier checks
are not a claim of a newly rerun full suite.

## Release gates still open

Treat these as required evidence before submission, not optional visual polish.

| Priority / work | Current gap | Evidence needed to close |
| --- | --- | --- |
| P1 Native binaries | Latest Android source build retains 17 RELRO alignment failures: 9 ARM64 and 8 x86_64. Signed store artifacts and iOS acceptance are unproven. | Resolve remaining binary failures; verify packaged libraries and signed Android AAB/iOS archive; install and exercise release builds on the supported device matrix. See [native libraries](audits/android-native-libraries.md) and [native builds](native-builds.md). |
| P1 Identity and account lifecycle | Fake local identities do not validate Google/Apple. Apple work, real-provider recovery/deletion/merge and cross-device evidence remain incomplete; live merge creation remains gated. | Test real providers, guest linking, cancellation, revoked credentials, deletion and recovery on both platforms; complete operational merge gates before enabling. See [Google sign-in](native-google-sign-in.md), [sessions](account-sessions.md), [deletion](account-deletion.md), [merge operations](account-merge-operations.md). |
| P1 Published content and rights | `content/reviewed-movies.json` is empty. Local demo clues are not approved production content. | Complete editorial and rights review, populate an adequate release schedule, exercise publication and missing-content alerts. See [content pipeline](content-pipeline.md) and [editorial guide](../content/README.md). |
| P1 Staging and data safety | Local emulator evidence does not prove deployed rules, indexes, migrations, abuse controls, IAM, scheduled jobs or recovery. | Configure separate staging, rehearse migration/rollback, verify deployed authorization and abuse controls, monitoring, backups and operational ownership. Use the tracker and account/content runbooks. |
| P1 Privacy and store requirements | Public support contact, policy/deletion website, retention inventory, store declarations and submission materials remain incomplete. | Publish working public routes, verify deletion and retention behavior, reconcile actual data use with both store disclosures and complete submission checklists. See the tracker and deletion runbook. |
| P1 Release validation | Remaining dependency findings, remote CI and iOS/physical-device evidence are incomplete. Accessibility, performance, real sharing and reminder matrices are only partially tested. | Triage dependency risks with evidence; pass required CI and actual release-device checks, including assistive technology, large text, failure recovery and lower-end devices. Any defect that prevents core play for affected users blocks release. See [dependency security](dependency-security.md) and the tracker. |

## Open browser playtest improvements

Several improvements have shipped to the invited beta; remaining acceptance
gaps are listed below. Demonstrated inability to play or access a control raises
the affected item to a release blocker.

| Work | Current status / remaining acceptance |
| --- | --- |
| Choose difficulty before first play | New challenges now require confirmation locally; started/completed challenges open directly. Browser confirmation/cancel and saved-result navigation checked. |
| Reduce Give Up prominence | Quiet link and confirmation shipped; cancel preserves state. Shared dialog now contains web keyboard focus, verified locally. |
| Compact clue and results layout | Compact projection/search and score explanation shipped. Local fixes remove inactive Hard seats, hidden future clue text and web nested results scrolling. Live deployment verification pending. |
| Explicit preview action | Preview works by long press; discoverable keyboard/pointer action and Enter behavior still need acceptance. |
| Prioritize progress in Profile | Statistics/history now precede account/settings/deletion locally; local browser checked. |
| Explain per-game hints | Easy plaques show cost and wait for server confirmation. Profile now explains three hints per Easy challenge rather than displaying a wallet. |

Full observations and local capture references are in the
[browser playtest](audits/2026-10-14-browser-playtest.md). Real share-sheet
completion was **not established** in headless Chromium.

## Run and test the app locally

Follow [local development](local-development.md) for prerequisites, recovery and
native limitations. With Node 24.21.0, Java 21 and dependencies installed:

```sh
npm run dev
npm run dev:day -- next
npm run dev:day -- midnight
```

The launcher serves http://localhost:8081 and local Firebase emulators for
`demo-talkie-trivia`. Wait for its ready message. Run day commands in another
terminal, then reload the browser. Type `q` and Enter in the launcher to export
state and stop. Use a named local demo account for continuity across imports;
the explicit local guest recovery control can restore an existing saved guest.
Do not substitute a production project or run the destructive integration suite
against the interactive development state.

Local-only snapshots, browser profiles, screenshots and built artifacts remain
under ignored `.expo/`; they are not portable through a Git clone. The latest
snapshot pointer is `.expo/local-dev/latest.json`. Keep older snapshots until a
new export/import is verified. The last verified local state preserved twelve
accounts. Root `android/` and `ios/` are intentionally generated by Expo CNG;
regenerate through the documented native workflow. Generated coverage reports
are ignored and removed from version control, while local copies are retained.

## Suggested next session

Start a fresh session with live verification of the search fix and the content
runway, then address the remaining browser UX items as a coherent stage.
Play the app again at desktop and mobile widths and with keyboard/large text;
test account recovery, locked difficulty, guess submission and saved results
where the changes touch them. Then resume the release gates above, beginning
with native binaries and real identity flows. Infrastructure and editorial work
can progress independently when the necessary accounts and content are available.

For each completed item, update this checklist and the corresponding tracker
row with the change, tests, actual platform evidence and remaining limits. Record
new findings rather than assuming a passing unit test means the feature works.
Use focused checks for the changed behavior; rerun broad checks when warranted
by changes or failures. No production deployment has been performed in this work.
