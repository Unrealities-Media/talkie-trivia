# Continuing development

Checkpoint: October 16, 2026 UTC. The invited web beta is deployed at
https://talkie-trivia-beta.web.app. Wider public release is not approved.
This is the current handoff; older audits preserve evidence from their dates.

## Shipped state

- PR54 is merged and deployed: keyboard retry keeps focus in a stable saved
  result panel when its button is replaced; pointer retry does not request focus.
  Loading now includes a readable status. A 320-by-480 error layout retains Retry
  and Close. Six history/retry checks pass across Chromium, Firefox and WebKit,
  plus nine focused tests and typecheck. Evidence: shared-root
  `.expo/archive-detail-before.log` and `.expo/archive-detail-after.log`.
  Four additional Firefox/WebKit gameplay/share checks passed. All nine CI checks
  passed for head `c6eee514d3f21ab605eb6b6e7df3eb00e99ecb98`. All 47 live files
  matched at 09:29:34 UTC; live archive/copy verification passed at 09:29:36 UTC.

- PR53 is merged and deployed: archived results now use the shared web sharing
  control, including manual copy when sharing and clipboard access fail. The copy
  field scrolls into view on focus above the fixed Close button. Failed archive
  posters fall back to the bundled poster; failed cast portraits retain names and
  links. Thirty-six focused unit tests, typecheck and six guest flows across
  Chromium, Firefox and WebKit pass. The browser flows block poster requests and
  check saved-result copying at 320 by 480. Evidence: shared-root
  `.expo/archive-resilience-final.log`. All nine checks passed for head
  `59ad85575b7fcbf69d5f15f447374989c5880f52`. All 47 deployed files matched at
  09:18:12 UTC; live poster fallback and short-screen archive copying passed at
  09:18:13 UTC without moves, external shares or page errors. Native builds remain disabled.

- PRs 18–52 are merged. PR52 head `f3f369b3c0a9498c03570fa9f232b1895064045d`
  passed all nine checks. All 47 live files matched its export at 09:02:12 UTC;
  live keyboard continuation, search access and returning to a saved result
  passed at 09:02:34 UTC, with no moves submitted or page errors.
- Recent web improvements include next-challenge navigation, startup recovery,
  gameplay while fonts load, completed-search announcements, live reduced-motion
  preferences and keyboard continuity after guessing. Disabled Sentry runtime
  code was removed from the bundle. Deployment also checks backend endpoint readiness.
- History cards now expose date, difficulty, result and score in accessible names.
  The Profile challenge chooser scrolls on short screens. Keyboard history paging,
  refresh and retry hand focus to a stable page-status message; an isolated browser
  fixture traverses 45 results across three pages without seeding live accounts.
- The missing PR30 backend rollout was completed at 05:03 UTC. All 13 functions
  are ACTIVE. A live guest win, Profile statistics, All Stats and reload passed
  at 05:06:49 UTC with statistics version 3 and no browser errors.
- Search pagination, mode continuity, archive recovery, share fallbacks, Settings
  links and offline Settings navigation have shipped. PR34's Chromium suite passed
  eight tests with two intentional duplicate-viewport skips.
- Optional help and direct mode switching replace the intrusive explanations
  and mode confirmation. Keyboard/state accessibility and cinematic rewards
  shipped. Full reward synopsis is stored separately from the difficulty clue.
- Chromium CI passed through PR46. Follow-up Firefox/WebKit verification found
  two Firefox differences: native focus only partly exposed the last challenge
  choice, and keyboard activation could leave `:focus-visible` false. The shipped
  fixes explicitly scroll focused choices and use the click's activation detail
  for history focus. All 42 Firefox/WebKit checks pass with six intentionally
  skipped duplicate viewport cases, including pointer refresh not requesting focus.
  Local evidence is `.expo/browser-focus-after.log` in the shared root; the preceding
  three failures are in `.expo/history-navigation-browser-engines.log`.
  These engine checks
  do not establish real Safari, physical-device or Google provider acceptance.
- PR47 compresses the web clue font from 772,088 to 130,712 bytes
  with WOFF2. All 3,241 glyph outlines, character mappings and advance widths
  match the native TTF, which remains unchanged. Regenerate and verify using
  `assets/fonts/build-web-clue.py`; its docstring pins the optional local tools.
  Chromium, Firefox and WebKit passed 63 checks with nine intentional skips,
  including successful WOFF2 loading after stalled font requests are released.
  Local evidence: `.expo/web-clue-font-browser.log` in the shared root.
  This is an asset-size improvement, not a measured startup-latency claim.
- Save recovery review reproduced keyboard focus falling to the page body after
  a failed retry on Chromium desktop and mobile. PR48 preserves
  focus on a stable save status and resumes search after success only while the
  player still has focus there. Pointer retries and later focus changes are respected.
  Twelve targeted checks passed across Chromium, Firefox and WebKit, covering
  retry failure, success, original move identity, reload and no extra guesses.
  Evidence: `.expo/save-recovery-before.log` and `.expo/save-recovery-after.log`.
- CI cost review found the standalone Firebase suite ran for 2m30s on UI-only
  PR48. Merged PR49 scopes that suite conservatively while retaining
  browser/emulator gameplay on every PR. See [CI rollout](ci-rollout.md) for
  the allowlist, full-verification fallbacks and measurement limits.
  On UI-only PR50, the scope job took 11 seconds and skipped standalone
  dependency installation and emulator testing; browser gameplay still ran
  and passed in 3m52s. This is one observed job-duration comparison.
- Daily-game recovery review reproduced focus falling to the page body when
  Retry failed. Deployed PR50 preserves keyboard position in the game
  across failure and success, announces errors/loading, and respects pointer
  activation and later focus changes. The clue animation skip control is now
  available only during an actual animation, including no control under reduced
  motion. The scrollable clue viewport remains keyboard accessible.
  Local baseline evidence: `.expo/daily-load-recovery-before.log` in the shared
  root. All 12 targeted Chromium/Firefox/WebKit checks passed in
  `.expo/daily-load-recovery-verified.log`; 33 focused component tests and
  TypeScript checks passed.
- Share fallback review found that blocked browser sharing/clipboard left plain
  text with no keyboard-focusable copy field. Deployed PR51 provides a
  labeled read-only field, selects the complete result on focus, and displays
  all result lines. Six guest-flow browser checks passed across Chromium,
  Firefox and WebKit desktop/phone sizes, including no spoilers, keyboard
  selection, no internal scrolling, accidental edits, and share dismissal.
  Ten component tests and TypeScript checks passed. Local evidence:
  `.expo/share-copy-final-browser.log` in the shared root. CI exposed a test
  timing race: React Native Web defers selection one event-loop turn for Safari.
  The assertion now waits for the selection; the corrected Chromium check and
  all nine CI checks passed before deployment.
- Result-transition review reproduced focus on the page body after closing a
  reveal (`.expo/result-navigation-before.log`, Chromium desktop/phone).
  Deployed PR52 recovers abandoned focus at the result heading after
  a reveal, and gives keyboard challenge navigation a stable daily-game target
  while controls disappear or become disabled during loading. Pointer activation
  and subsequent focus changes do not request an asynchronous focus jump.
  The first broader run verified automatic reveals in all six browser variants
  and exposed difficulty-button focus loss, now included in this same batch.
  All six final Chromium/Firefox/WebKit desktop/phone navigation cases passed
  in `.expo/result-navigation-final.log`, covering pointer use and moving
  focus during delayed loading. Forty focused component tests and TypeScript
  checks passed. The live check waits until account initialization enables the
  difficulty control before attempting keyboard activation.
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
| Content | At October 16 09:31 UTC all 50 October 16–25 slots passed validation, with 60 distinct scheduled movies and no unused reviewed reserve. The new content batch adds 20 AI-reviewed beta sets (four days), increasing the local pool to 80. It does not publish them. Rerun inventory and preview before replenishing for October 26 onward. Automatic publication is not established; human rights clearance remains separate and production approvals empty. |
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
