# Continuing development

Checkpoint: October 16, 2026 UTC. The invited web beta is deployed at
https://talkie-trivia-beta.web.app. Wider public release is not approved.
This is the current handoff; older audits preserve evidence from their dates.

## Shipped state

- PRs 18–42 are merged. PR42 head `a207f39a1865b6ad18c0f082c79e536700668059`
  passed all nine checks. All 47 live files matched its export at 06:32:27 UTC;
  a dedicated beta guest's saved wrong guess preserved search focus at 06:32:29 UTC.
- Recent web improvements include next-challenge navigation, startup recovery,
  gameplay while fonts load, completed-search announcements, live reduced-motion
  preferences and keyboard continuity after guessing. Disabled Sentry runtime
  code was removed from the bundle. Deployment also checks backend endpoint readiness.
- The missing PR30 backend rollout was completed at 05:03 UTC. All 13 functions
  are ACTIVE. A live guest win, Profile statistics, All Stats and reload passed
  at 05:06:49 UTC with statistics version 3 and no browser errors.
- Search pagination, mode continuity, archive recovery, share fallbacks, Settings
  links and offline Settings navigation have shipped. PR34's Chromium suite passed
  eight tests with two intentional duplicate-viewport skips.
- Optional help and direct mode switching replace the intrusive explanations
  and mode confirmation. Keyboard/state accessibility and cinematic rewards
  shipped. Full reward synopsis is stored separately from the difficulty clue.
- Chromium CI passed. The additional local Firefox/WebKit run against PR42 passed
  36 tests with four intentionally skipped duplicate viewport cases. It covers the
  recent startup, font, motion and search-focus changes on desktop/mobile layouts.
  Local evidence is `.expo/post-ux-browser-engines.log` in the shared root.
  These engine checks
  do not establish real Safari, physical-device or Google provider acceptance.
- The explicitly approved anonymous test guest was deleted. Server reads
  confirmed its Auth account and owned game/history/statistics data absent;
  completion survives reload without creating another guest.
- Database delete protection is enabled. A prior Hosting artifact was verified
  on an expiring preview channel. Neither proves database restore or backend rollback.
- At 06:09:52 UTC, `npm run beta:operations` passed all eight checks with zero
  pending deletions and zero completion/receipt records overdue by one hour.
  The reported scheduler attempt was 06:08:02 UTC with successful status, after
  the backend update. This confirms post-update scheduling, not another end-to-end
  deletion or future retention expiry. Local evidence is `.expo/post-update-operations.log`.

Evidence: [live rollout](audits/2026-10-16-live-web-beta.md),
[browser engines](audits/2026-10-16-browser-engines.md), and
[deletion/recovery](audits/2026-10-16-beta-recovery.md).
The [40-finding tracker](audits/remediation-status.md) retains historical and
native findings; use dated evidence when an older row describes pending work.

## Next release gates

| Work | Current evidence and remaining action |
| --- | --- |
| Google identity | Real Google linking, collision/cancel, cross-device recovery and reauthenticated deletion still need disposable provider-account acceptance. Guest deletion does not close this gate. |
| Content | Last verified schedule contains 50 slots for October 16–25 UTC. Replenish before October 26; automatic publication is not established. Beta editorial review is separate from human rights clearance; production approvals remain empty. |
| Abuse protection | Per-account gameplay throttling is deployed. App Check and broader anonymous/API abuse protection remain unfinished. A hidden URL and `noindex` do not enforce invitations. |
| Recovery | Delete protection and Hosting preview recovery pass. No backup schedule/PITR or actual database restore has been verified; backend rollback remains open. Choose retention/cost policy before enabling paid backup storage. |
| Operations | Manual health checks exist, but alert/budget notification delivery and monitored support-mailbox handling remain unverified. Do not infer delivery from configuration or a successful API response. |
| Retention | Approved guest completion record is due for purge October 17 at 02:03:26 UTC; receipt expires November 15 at that time. Future expiry has not been exercised live. |
| Browser/device | Real Safari/mobile-device, assistive-technology and actual share-sheet acceptance remain open. Emulator browser checks cover a narrower contract. |

Start the next coherent stage with one of these gaps and its acceptance evidence,
not another broad audit or repeated unchanged test run. Real provider credentials,
mailbox access, physical devices and human rights decisions cannot be substituted
with automated test results. Keep beta distribution limited while these gates remain open.

## Scope and cost constraints

Web beta is the current priority. Android/iOS builds remain disabled for routine
work; do not dispatch native workflows. Store signing, binary alignment, Apple
sign-in and native device acceptance remain deferred until native work resumes.
The native workflow is manual-only, not a PR/push trigger.

Batch related code and CI changes. Follow [dependency maintenance](dependency-maintenance.md)
for monthly batching and toolchain compatibility holds. Do not launch another CI
run or deployment just to update this handoff. Run focused checks for changed
behavior and required CI before merging code; all-checks-passing merges are
authorized in this session.

Launch scope remains movies, worldwide UTC daily reset, three hints per Easy
game, no paid features, and guest play with optional account sync. Five difficulty
challenges are available daily. Live account merging remains disabled.

## Local development

Follow [local development](local-development.md) for pinned prerequisites and
emulator recovery. Use `npm run dev`; day controls are `npm run dev:day -- next`
and `npm run dev:day -- midnight`. The launcher serves localhost:8081 with the
`demo-talkie-trivia` emulators. Wait for readiness; type `q` to export and stop.
Never run destructive integration fixtures against live or interactive demo data.

Browser profiles, snapshots and release receipts under `.expo/` are ignored and
not portable through Git. Preserve shared worktree changes and existing demo
accounts. The isolated release checkout `.expo/web-release-pr20` is reusable;
confirm its current status before editing. Start a fresh session after a coherent
major stage; this handoff records the evidence needed to continue.
