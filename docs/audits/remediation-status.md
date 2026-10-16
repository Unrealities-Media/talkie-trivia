# Release audit remediation

Release objective: resolve **all 40 findings** and demonstrate the release gates in the original audit. This is an active work log, not release approval.

For the next session, start with the [continuation checklist](../CONTINUING.md).
It separates release gates from the six still-open browser UX improvements.

Latest user-directed stage: make the app fully usable for local development
without production writes. The supported `npm run dev` workflow, persistent demo
snapshots, named test identities and fake-day controls are documented in
[local development](../local-development.md). The
[browser playtest](2026-10-14-browser-playtest.md) records reproduced failures,
fixes, actual gameplay evidence and remaining UX improvements. This local stage
does not close the external/native release gates below.

Confirmed launch defaults: movie-only daily game; worldwide UTC reset; three hints per Easy game; no paid features; guest play with optional account sync. The hosted beta's public support email and privacy/deletion pages are published and passed bounded desktop/mobile checks on October 15; see [hosted public pages](2026-10-15-hosted-public-pages.md). Support delivery, privacy/deletion operational acceptance and separate staging configuration remain unverified.

## Current implementation

The game now starts through a callable that chooses the UTC challenge, validates the app catalog, snapshots published content, and fixes difficulty/guess limits. Guess/hint/give-up commands have strict schemas, revision checks, and persistent action IDs. The server owns scoring and saves game, statistics, and one completion history entry atomically. Replays return the recorded state. The former result endpoint is read-only and rejects legacy full-game payloads.

Client actions are serialized per account, persisted to AsyncStorage before sending, and replayed after a lost response or restart. The UI waits for server acknowledgment and offers a retry without awarding speculative points. Definitive command rejections clear the pending command so the client can reload authoritative state. Account-scoped keys and response-generation checks prevent stale responses from replacing a new account's game.

Current challenge difficulty is read-only; profile changes apply to the next challenge. Hints are a per-game allowance. Cast comparison uses normalized names when real person IDs are absent, never shared zero IDs. History uses immutable game snapshots rather than fetching today's challenge. Daily win streaks derive from winning dates, including out-of-order completion requests.

The countdown now uses the server's UTC reset and a monotonic receipt clock, so changing the device's wall clock cannot move the displayed deadline. Foreground/reconnect and deadline expiry refresh the challenge; failed content requests retry at most once per minute. Refresh defers while a move is saving, and an expired game cannot accept a new UI command without refreshing. The obsolete local-date/yesterday fallback and unused game-service factory/video-game placeholder were removed. Release years are calendar metadata rather than local-time conversions.

Navigation now remains mounted through connectivity, account, and daily-content failures. The Game screen owns its local error/Retry state; Retry performs a fresh network probe. Unknown reachability does not falsely prove offline, and stale probes cannot overwrite newer connection events. Profile settings/footer remain available during account failures; saved statistics load independently of today's content, and history/statistics have local retries. Account changes clear selected history and invalidate stale reads. Broad root warning suppression and automatic startup notification permission requests were removed. Explicit reminder opt-in/settings and durable scheduling recovery are now implemented; bounded Android emulator delivery/reboot/cancellation checks pass; physical-device, iOS and accessibility verification remain open.

Account loading now invalidates stale profile requests and clears game/statistics/presentation state immediately when the account changes. Failed optional Google sign-in stays in the account panel rather than blocking the whole app; session recovery retries the actual account lookup. New Google credentials link to the anonymous UID, preserving its owned data. Pending actions must save before sign-out. Provider cancellation, duplicate taps, and late responses are handled explicitly; the production fake-user E2E shortcut is removed.

An established account now has a durable local continuity marker. Loss of its
Firebase session opens recovery in Game/Profile instead of silently creating a
guest. Retry and cancellation preserve the gate across app restart; replacement
requires confirmation and keeps the previous account's data separate. First-use
guest play and successful explicit sign-out remain supported. The marker grants
no account access, and cannot recover an unlinked guest whose credentials are
gone. Valid old sessions enroll on opening; already-lost pre-marker sessions,
provider reauthentication and cross-device recovery remain limitations. See
`docs/account-sessions.md` for the contract and actual Android reproduction.

Optional Firebase Analytics/Performance and Sentry collection (including native initialization and replay) are disabled while privacy disclosures and controls are unfinished. Auth code no longer copies provider names/emails into new player records or analytics. The analytics adapter accepts only a known sign-in method property, drops raw exception messages, and clears identity on account transitions. This is a privacy safeguard, not evidence that a complete consent/deletion system exists; remote client diagnostics are consequently unavailable for now.

The Go pipeline now generates candidate catalogs separately from the released catalog and imports source metadata into `movieImports`, never overwriting published/editorial movie documents. Source, JSON, file and database failures propagate as nonzero exits. Publication requires reviewed clues, valid content digests, catalog membership/version, and an explicit project; cloud writes also require an exact project confirmation. A single create-only Firestore transaction fills a bounded UTC window, preserves existing dates, and avoids repeats across the previous 90 days and the future window. The callable reads immutable reviewed content directly from each scheduled day, so a later source edit cannot change that day's clue for new players.

The publishing workflow points to `utils/pipeline`, uses federated credentials, runs tests before obtaining credentials, serializes per environment, verifies the released catalog hash, and defaults to a staging preview. Scheduled staging writes require explicit repository opt-in; production remains manual. See `docs/content-pipeline.md` and `content/README.md` for the operating/editorial contract. The approval list is empty: no actual content review or live publication is claimed.

## Deployment and migration constraints

- **Nothing has been deployed.** The client and Functions contract must be released together into an isolated staging project first.
- V2 games live at `players/{uid}/games/movies_{date}`, statistics at `players/{uid}/privateStats/summary`, and results at `players/{uid}/gameHistoryV2/{date}`. Existing legacy documents are retained. Existing legacy statistics/history are not yet migrated or shown by the V2 client. A verified migration/compatibility plan is a release blocker; do not silently reset real users.
- Rules deny all client writes to authoritative game/statistics/history fields and deny legacy writes. Current challenges are obtained from `startGame`; clients cannot enumerate the schedule.
- `scripts/prepare-catalog.cjs` packages the app's catalog into Functions and emits its SHA-256 version. Functions builds/tests run it. Mismatched clients receive an explicit update requirement. A backwards-compatible catalog distribution strategy is still needed before catalog-changing releases.
- A pending action can complete within 48 hours of its challenge's UTC start; an already-committed action can be replayed afterwards. Offline cold-start/full offline play is not implemented. Test and explain the online-play/save-retry behavior before release.
- The client still receives the current answer's metadata to render the existing clue/reveal UI. The new protocol rejects fabricated results but does not prevent answer inspection. Do not launch competitive leaderboards on this design; answer-minimizing delivery remains under review.
- Real local Auth/callable/Firestore rules and transaction tests now pass. App Check, per-user abuse controls, production IAM/budgets, native/device verification and staged/deployed verification remain outstanding.
- Existing Google-account collisions preserve the guest session. Emulator builds now offer confirmation and durable merge recovery with a separate destination Auth session. Preserved guest records have a paginated owner-only viewer. Bounded scheduled recovery is implemented and directly tested; live merge creation remains disabled pending operator/staging acceptance, deployed scheduled delivery and provider/device acceptance. Apple sign-in remains a release blocker. Account deletion has an implemented client/server flow, with native, public-web and operational acceptance gates still open. Google uses the native SDK on Android/iOS and a separate browser adapter on web; real provider/device verification and the deprecated Android SDK migration decision remain open. E2E auth coverage must use emulator-backed accounts rather than a fake production auth object. See ../native-google-sign-in.md.
- Published `dailyGames` documents now require schema version 1, UTC date, catalog version, immutable content, matching digest and review metadata. Legacy schedules are rejected; existing saved V2 player games remain readable. A reviewed legacy-schedule migration and a sufficiently large approved content pool are required before deployment. Do not deploy this server over the old schedule or treat an empty editorial file as release-ready data.

## Finding-by-finding status

“Implemented, verification pending” means source and targeted tests exist, but the full audit acceptance criteria have not been proven.

| ID | Area | Status / remaining evidence |
| --- | --- | --- |
| 01 | Fabricated results | Strict server commands and malformed-UID rejection verified through actual emulator HTTP calls; device and answer-exposure review pending. |
| 02 | Cross-user overwrite | Server-derived paths and strict fields pass two-account callable/rules emulator checks; deployed/native verification pending. |
| 03 | Duplicate credit | Actual Firestore transaction contention/replay verifies one game, one completion and one credit; deployed/native fault tests pending. |
| 04 | Rules/schema mismatch | V2 owner reads, deny-write rules and ordered history query pass real emulator tests; legacy raw movie reads removed. Migration/deployed index verification pending. |
| 05 | Native dependency drift | Pinned Expo CNG and guarded React Native/Hermes/FBJNI source builds; NDK r30 compiles both ARM64/x86_64. All 56 LOAD checks/ZIP alignment pass. Rebuilt FBJNI passes both ABIs, reducing remaining RELRO failures to 9 ARM64 and 8 x86_64. Thirteen focused guards, generated configuration and packaged-consumer symbol checks pass. Limited 16 KB Android startup, image/search/preview, completion and restart/resume checks pass; full dependency/ABI, 4 KB/ARM64 device and iOS verification remain open. CI artifact gate stays enforced. See android-native-libraries.md. |
| 06 | Signing/toolchains | Release debug-key fallback removed, EAS profiles/CLI/template/runtime pinned, protected credentials excluded from source/upload. Android toolchain compiles locally; actual signed AAB/iOS archive, store access and upgrade verification remain open. |
| 07 | Privacy/deletion | Durable server deletion and Profile confirmation implemented, with Google reauthentication, stored status receipts, post-Auth recovery, local cleanup and explicit new-guest choice. Unit/component and real emulator tests pass. Native/provider/cross-device verification, expired/lost-receipt recovery route, public web flow, retention inventory and staged scheduler/alerts remain open. |
| 08 | Durable progress | Server saves each acknowledged action; local pending command survives transport failures. Installed Android retains acknowledged progress across restart/update. Continuity marker/recovery now prevents silent guest replacement after invalidation: real Auth-import test verifies retry/cancel/restart create no accounts, and explicit confirmation creates exactly one separate guest. Cached-session discovery now persists continuity first, refreshes once, and enters recovery only on definitive invalidation; app/server and real callable tests pass. Android controlled revocation, Retry and restart retain recovery with seven accounts/22 saved documents unchanged; the specific repeated-discovery branch is covered separately by real callable tests. Pre-marker/credential-loss limits, pending-action process death, offline UX and iOS verification remain open. See account-sessions.md. |
| 09 | Failed result processing | Separate saving/pending/acknowledged UI and durable retry implemented. Easy hints now remain hidden until the same account/game acknowledges usage; pending/retry, unknown/disabled choices and account changes have hook regressions. Device fault-injection pending. |
| 10 | False cast hints | Server and client matching corrected; Basic hint key fixed; data and device presentation checks pending. |
| 11 | Dates/reset | Server UTC timing, monotonic countdown, UTC history, year metadata and foreground/reconnect/deadline refresh implemented and locally tested; background suspension/clock-change/device verification pending. |
| 12 | Yesterday fallback | Obsolete fallback API removed; server unavailable state, manual recovery and bounded automatic retry implemented/tested. Actual staged schedule outage/recovery pending. |
| 13 | Mutable difficulty | Saved difficulty immutable, next-game preference separate, server score retained; device UX verification pending. |
| 14 | Hint economy | Three authoritative Easy-game hints and atomic usage tracking implemented. Installed Android verifies three uses, no extra debit on re-view, disabled fourth choice and allowance persistence after restart. Easy game was seeded locally; preference/new-game, offline and iOS checks remain open. See readability-and-hints.md. |
| 15 | Guest linking | New Google credentials link in place; pending saves precede sign-out. Merge authorization, reservation, paged copying, recovery, retirement and deletion cleanup have unit/emulator evidence. Emulator builds now offer explicit confirmation, memory-only destination Auth, durable recovery, server-confirmed cancellation and post-completion account switching. Callables exist; live creation is rejected. Missing days import; overlapping guest days archive without extra credit. Paginated owner-only archive viewing has service/UI and real rules/lifecycle checks. Bounded scheduled recovery, queue starvation protection and retention review pass direct handler/emulator checks. Administrative preview, guarded retry and pre-copy cancellation pass real emulator/CLI checks, including stale-plan and provider-link race recovery guards. Deployed delivery/IAM/monitoring, operator acceptance, corruption-specific repairs, staged index and production/native provider verification remain open. See ../account-merging.md and ../account-merge-operations.md. |
| 16 | Apple login/OAuth | Google native adapter replaces browser OAuth on Android/iOS; cancellation, provider failure, token validation and same-user reauthentication have focused tests. Apple implementation, real OAuth registrations/iOS callback/device verification and Android SDK migration remain open. |
| 17 | Analytics/privacy | Optional analytics/performance/Sentry/native replay collection disabled; profile PII and raw errors removed from telemetry, identity reset implemented. Disclosures, consent/withdrawal, retention/deletion and device network inspection remain open. |
| 18 | Reminders | Device-local opt-in/time settings, typed daily trigger, Android channel/permission handling, durable serialized scheduling/cancellation, legacy cleanup and deletion integration implemented. Installed Expo parser, service, UI and lifecycle checks pass. No startup permission request. Android emulator permission denial/settings recovery, closed-process delivery, reboot restoration, notification navigation and durable off pass. Guarded source-built Android receiver now repairs closed-process timezone/clock changes; installed checks preserve one local-time alarm and durable off. DST, physical devices, iOS and native accessibility remain open. A separate intermittent native Profile mount failure was captured and remains under findings 05/26. See ../daily-reminders.md. |
| 19 | Win chart | Replaced incompatible Victory imports with native proportional bars, visible counts and accessible labels. First-win updates, zero counts, short legacy arrays and malformed data pass component tests without chart-package mocks. Installed Android first-win chart shows the correct two-guess bucket. iOS, large text and assistive-technology checks remain open. |
| 20 | Content workflow | Actual CLI wired to preview/apply workflow, bounded permissions, federated identity, environment/catalog checks and concurrency. Protected environments, IAM, alerts and staged execution still require evidence. |
| 21 | Safe pipeline publishing | Reviewed immutable snapshots and create-only transactional scheduling implemented. Actual Firestore tests prove concurrent publishers, immutable reruns, previews and insufficient/incompatible pool atomicity. Migration, network fault injection and live operations remain open. |
| 22 | Catalog compatibility | Build-time hash and explicit mismatch handling implemented; version retention/distribution/publication checks still open. |
| 23 | Accessibility | Shared text/surface contrast corrected in both themes; header/hints/results/guess rows wrap, collapsed hints unmount, buttons/hints have minimum 48-point targets, tabs account for font scaling/insets. Bounded Android header/hint/tab and results/history checks pass at 200% text. Keyboard resizing/focus positioning and measured search-row heights now pass bounded Gboard-open normal/200% text checks, including real selections; see search-keyboard.md. TalkBack/VoiceOver, full screen/pressed-state contrast, preview rows, smaller devices and iOS remain open. See readability-and-hints.md, android-device-smoke.md and post-game.md. |
| 24 | Dependencies | Removed unused packages; applied compatible backend updates and scoped grpc/UUID/FTP/OpenTelemetry fixes, plus attributed router-decoder backport. App audit 57 (52 high/5 moderate), Functions development 20 moderate, backend production 0, integration 3 high. Remaining underlying advisories: braces, node-forge, sprintf-js. Android JS map excludes these tooling packages; clean lockfile install and consumer tests pass. Full resolution/native SDK review remains open; see ../dependency-security.md. |
| 25 | Environments/abuse | Strict dev/preview/production config separates identities, schemes, Firebase and OAuth values; partial/shared live config fails closed. Explicit emulator selection replaces __DEV__, including deletion-status routing; setup failures are surfaced. Demo-only defaults and callable instance/concurrency bounds implemented. Actual separate live staging, App Check, rate controls and IAM remain open. |
| 26 | Recovery | Navigation survives offline/account/content errors; network Retry re-probes, stale probes are ignored, stats/history load independently and retry locally. Auth/save retries and font fallback implemented. Fatal-error reload now uses Expo's ordinary reload API, works independently of disabled OTA configuration, blocks duplicate requests and permits retry after rejection. Captured native blank-screen failure traced to the default hidden tab-icon subtree. An initial null-icon mitigation still logged missing views; the final text-only bar removes those wrappers and passes six native restart/navigation checks and 60 tab switches. Broader physical-device/iOS stability acceptance remains open; see android-tab-mount.md. Native fault-injection/reload/font verification pending. |
| 27 | Tests/CI | Unit regressions plus 24 real Auth/Firestore/Functions/Go emulator checks pass locally; isolated no-credential jobs added. Native CI now generates and compiles Android ARM64/iOS Simulator Release. Remote CI execution, required branch checks, iOS execution and staged/device verification remain open. |
| 28 | Search usability | Exact single-character titles, normalized accents/punctuation, title/year filtering, alternate-title support, cached fuzzy index, empty-result help and duplicate-guess prevention implemented. Every bundled title is discoverable by title and title/year in real search tests. The reproduced Gboard obstruction now has keyboard-aware viewport/focus positioning and measured row heights. Native normal/200% text selections save exactly once; preview does not submit. Other devices/keyboards, iOS, released alias/editorial review, low-end latency and native accessibility remain open. See search-keyboard.md. |
| 29 | Daily streak | Date-derived daily win streak implemented, including late/out-of-order results; migration and stale-display policy still open. |
| 30 | History | Independent loading/retry, completion refresh, immutable snapshots and UTC dates implemented. Bounded 20-result pages, account-scoped date/document cursors, Older/Newer/Refresh controls and stale-response rejection now pass focused tests, real Firestore rules checks and native Android normal/200% navigation through 45 synthetic results. Legacy migration, staged/iOS/device/accessibility and transport-failure acceptance remain open. See history-pagination.md. |
| 31 | Editorial quality | Publication requires reviewed text, age/fact checks, answer/catalog validation and content digest. Editorial guide added; real clue review, aliases/short-title spoiler review, difficulty/device presentation and player evidence remain open. |
| 32 | Licensing | Open; commercial intent clarified as no paid features for launch, rights review still required. |
| 33 | Onboarding/copy | Replayable How to play and isolated fictional practice implemented; immediate-submit, hints, difficulty, scoring, UTC reset, online saves and guest continuity explained. Optional tutorial-storage failures no longer block play; guest-link copy corrected. Focused tests and Android normal/200% text practice/restart/return checks pass. Native status-bar overlap fixed. Player comprehension, screen-reader/iOS/physical-device acceptance and prompt timing remain open; see onboarding.md. |
| 34 | Post-game value | Saved day/difficulty/score explanation, complete clue, readable facts/cast and submitted guesses implemented. Bounded Android normal/200% result and history checks pass; large-text clipping and poster sizing corrected after failed native attempts. Player comprehension/return-value research and complete native outcome/accessibility matrix remain open. See post-game.md. |
| 35 | Sharing/secondary features | Current/history sharing uses the same immutable, spoiler-free result; native Medium preview stays unchanged after next-game preference changes. Unverified domain removed; invalid actor/movie actions disabled and unused illustrative streaming component removed. Public destination, real link resolution, iOS and full native outcome verification remain open. Unimplemented modes remain blocked. See post-game.md. |
| 36 | Architecture | Strict server command/state model, client adapter and local catalog-only service introduced; obsolete daily fallback/factory/video-game service removed. Shared contracts, migration and remaining obsolete paths cleanup open. |
| 37 | Performance | Open. |
| 38 | Observability | Guess/hint/give-up events follow acknowledgment. Share event retains tapped/chooser meaning: Android resolves sharedAction when opening its chooser, not on recipient delivery. Optional telemetry remains disabled; privacy-minimized complete funnel/native validation still open. See post-game.md. |
| 39 | Documentation/hygiene | README, publication/editorial/migration, deletion, emulator and native build/environment runbooks added; runtime pinned, fake Functions lint/obsolete eject command removed. Continuation checklist added with prioritized gates and UX acceptance criteria. Generated coverage is untracked and ignored; local copies retained. Remaining operational runbooks still open. |
| 40 | Operations/store materials | Open; external account/infrastructure evidence needed. |

## Verification log

FBJNI source follow-up: pinned 0.7.0 upstream sources, preserved license, exact
file/hash guards and Windows line-ending protection are implemented. Thirteen
focused checks and isolated Expo generation pass; full Android compilation and
actual packaged symbol checks pass. Both FBJNI ABIs now satisfy LOAD/RELRO,
reducing the binary failures from 19 to 17. Native x86_64/16 KB startup, poster
preview, completion, Profile navigation and restart/resume checks preserve all
ten prior accounts/123 records and credit the new guest once (700 points, one
guess). The eleven-account/127-record demo state was exported and services stopped.
Result-screen hierarchy capture failures are recorded rather than counted as
passes; screenshots and backend assertions verify the result. Full device/ABI
and store acceptance remain open. See [native library evidence](android-native-libraries.md).

History pagination follow-up: 35 focused tests, app TypeScript and all 11 real
Firestore rules tests pass. The client reaches beyond 20 results with bounded
pages; rules reject unbounded/over-limit queries. Native Android visits three
pages, opens the oldest of 45 synthetic saved games, navigates back and refreshes;
200% text pagination also passes. All nine prior accounts/30 documents and the
seeded ten-account/123-document state remain unchanged by browsing. Export is
preserved and test services stopped. Native libraries retain the 19 known RELRO
failures. Legacy migration and broader acceptance remain open. See
[history pagination evidence](history-pagination.md).

Search keyboard follow-up: Android resizes the Game viewport and positions focused
search above Gboard; measured result heights allow wrapped titles and previews.
All 43 focused tests and app TypeScript pass. Final native normal/200% text taps
save the intended guesses; preview adds none, and a three-guess Medium win credits
490 points exactly once. Eight prior accounts/26 documents remain unchanged.
The nine-account/30-document demo export is verified and preserved; emulator and
backend are stopped. Original-owner recovery after Auth import creates no new
account on Retry. All 56 native libraries are unchanged, retaining 19 RELRO
failures. Broader device/accessibility acceptance remains open. See
[search keyboard evidence and limitations](search-keyboard.md).

Post-game follow-up: canonical saved summaries/shares, complete clues, readable
facts/cast and natural-height completed guess rows are implemented. The first
60 affected tests and subsequent 33 overlapping layout regressions pass with app
TypeScript. Native Medium win/save/share/history checks preserve all seven prior
accounts/22 records and credit the new guest exactly once (595 points, two guesses).
The final source-built demo APK passes normal/200% poster inspection and native
share-preview assertions. Its 56 native libraries are unchanged, including the
19 unresolved RELRO failures. Eight accounts/26 documents were exported locally.
Testing also exposed keyboard-covered search results; the subsequent fix and bounded native evidence are recorded in search-keyboard.md.
No deployment or complete player-value/accessibility acceptance is claimed. See
[post-game evidence and limitations](post-game.md).

Onboarding follow-up: How to play remains available through loading, content,
connectivity and account errors. Fictional practice never invokes daily game
actions; failed tutorial preference reads/writes are nonblocking. App TypeScript
and 55 focused checks pass across the affected runs. Screenshot review found
status-bar overlap, now corrected with top safe-area space and themed icons.
The final demo Android artifact passes practice/restart/return at normal and
200% text with no backend; font size is restored and the emulator stopped.
Initial automation overscroll failures were investigated and corrected rather
than counted as passes. All 56 native libraries are unchanged, including the
19 known RELRO failures. Player comprehension, assistive technology, iOS and
physical-device acceptance remain open. See [evidence and limits](onboarding.md).


Native tab follow-up: a healthy native hierarchy maps the captured missing views to hidden default tab icons. A null-icon renderer alone still failed; the final text-only tab bar removes the icon wrappers while retaining cancellable navigation events, reselection, long press, route parameters and accessible selected state. Seven focused tests and TypeScript pass. Installed Android passes six restart/Profile/swipe checks, 60 tab transitions and normal/200% text bounds checks. The baseline also passed bounded checks, so this is a targeted mitigation with broader stability acceptance still open. The 19 native RELRO failures remain unchanged; no deployment occurred. See [artifact and evidence](android-tab-mount.md).


Android reminder clock follow-up: five build-guard tests pass. The first patched APK still linked the prebuilt Expo notification module and failed native checks; Android now explicitly compiles that module from source. Corrected installed checks preserve one 18:18 local alarm through Chicago/Los Angeles/Kolkata, repair a backward clock change, and keep off through timezone changes and restart. Eight saved-evidence checks pass; all 56 native libraries are unchanged, including the 19 known RELRO failures. A separate native Fabric view-mount failure left Profile blank after reopening; restart recovered it, but cause/reproduction remain open under 05/26. DST/iOS/physical-device acceptance remains open. See [clock evidence and limitations](../daily-reminders.md#closed-process-clock-repair-follow-up-2026-10-13).


Cached-session recovery follow-up: real Auth/callable tests reproduced a revoked
cached user remaining signed in even after successful token refresh. Continuity
now persists before merge discovery; a read refreshes once, then only an explicit
server `session-invalid` rejection signs out into recovery. Outages and ambiguous
errors retain credentials. Final runs pass 52 app tests, 75 server authorization
tests, three real callable/Auth cases, app TypeScript and the Functions build.
The demo Android build passes controlled revocation, Retry and cold-launch
recovery. One guest was explicitly created for this test; subsequent checks prove
all seven accounts and 22 saved documents unchanged. Native logs do not prove the
repeated-discovery branch, which has separate real callable evidence. The original
six accounts and generated fixtures are preserved. No live deployment occurred;
iOS/real-provider acceptance and the 19 native RELRO failures remain open. See
[the complete evidence and its limits](../account-sessions.md#cached-token-rejection-follow-up-2026-10-13).


Installed Android reminder follow-up: the demo-only API 36 x86_64/16 KB build
verifies explicit permission prompting, denial/settings recovery, one silent
notification after ordinary process death, next-day scheduling, reboot recovery,
Game navigation and durable off through cold launch. Delivery was observed about
74 seconds after the selected minute. A closed-app timezone change retained the
old absolute alarm; reopening corrected the local time. This limitation remains
open. The preserved account also hit a generic loading error, likely during
revoked-session merge discovery; exact cause remains unproven and no replacement
guest was created. Eight saved-evidence assertions pass. The settings-link wording
was corrected after native testing, with eight component tests passing. Existing
19 native RELRO failures remain. Nothing is deployed. See
[artifact identity, evidence and remaining matrix](../daily-reminders.md).


Daily reminder follow-up: the unused invalid hook is replaced with explicit
Profile opt-in, local-time selection, durable off/time preferences and one stable
notification identity. Launch/foreground reconcile without prompting; revoked or
denied permission and blocked Android channels preserve the preference while
cancelling pending reminders. Deletion persists off before native cleanup.
Ambiguous responses, process restart, storage/native failures and rapid actions
have focused coverage. All 55 affected service/component/lifecycle/navigation
checks pass together, including the installed Expo trigger parser; app TypeScript
passes. Real delivery, reboot, timezone/DST, taps and assistive-technology evidence
remain open. See [the native acceptance matrix](../daily-reminders.md).

Administrative reconciliation follow-up: a read-only ten-minute plan now precedes
explicit project/digest-confirmed retry or guarded pre-copy cancellation. The
tool never changes Auth, games or statistics, and rejects stale state, live
leases, deletion/retention barriers and partial-copy cancellation. A disabled
provider-link race requires separately reviewed identity restoration and a fresh
plan. One emulator invocation passes 38 lifecycle/scheduler/reconciliation cases,
including the actual CLI. Four CLI input tests pass; the final shared-project
guard compiles and passes all 12 reconciliation cases again. Operator IAM, native
provider recovery, deployed delivery and evidence-specific corruption repairs
remain unverified. Live creation stays disabled; nothing is deployed. See the
[administrative procedure](../account-merge-operations.md#administrative-reconciliation).

Merge scheduler follow-up: `retryAccountMerges` now runs the accepted-job worker
on a five-minute UTC schedule with one instance/concurrent request, a nine-minute
hard timeout and an eight-minute monotonic soft budget. It processes at most
20 due jobs/eight steps each and bounded retention pages. Pre-claim failures and
invalid expiry metadata no longer fill the oldest page forever; transactional
repairs preserve concurrent claims, live locks and review records. One emulator
invocation passes 26 lifecycle/scheduler contracts; the final retention-review
metadata addition passes all nine affected scheduler cases in a focused rerun.
Fourteen callable unit regressions, Functions TypeScript and whitespace checks
pass. Test fixtures are preserved, with unfinished owned jobs deferred rather
than a database-wide reset. No deployment or real Cloud Scheduler/IAM/index/alert
acceptance is claimed. Live creation remains disabled. See the
[new operations runbook](../account-merge-operations.md).

Guest archive follow-up: Profile now offers a read-only, paginated viewer with
an explicit answer-reveal action, original clues/guesses/feedback, Basic automatic
hints and no extra score or sharing. Date/document-ID cursors handle multiple
guests on one day; retries retain the current cursor. Account changes remove
open details and discard late responses. A rapid navigation race was fixed.
Twenty-four new service/component cases and 16 Profile/modal regressions pass
across targeted runs; app TypeScript and whitespace checks pass. All 27 real
Auth/Firestore lifecycle/rules contracts pass in one invocation, including
45-record pagination, owner/lock/write isolation and an SDK read of the actual
completed merge's archive with the ordinary destination game unchanged.
Emulators exit 0 and test ports close. Native layout, screen readers, production
indexes and real OAuth remain unverified; live merging stays disabled. See
[archive contract and evidence](../account-merging.md#preserved-guest-records).

Merge client/callable follow-up: emulator builds now offer explicit conflict and
guest-retirement consent, memory-only destination Auth, durable intent before
submission, restart/revocation recovery and server-verified cancellation. A
cancelled confirmation cannot be replayed into new work; cancellation can also
transactionally prevent a delayed initial request from being accepted. The
primary session switches only after rechecking completion; failed local cleanup
keeps recovery gated. Current-account discovery gates other-device/reinstall
access to pending work. Ordinary gameplay/auth/deletion cannot bypass recovery.

105 distinct affected app cases and 126 backend unit cases pass across targeted
runs. The full emulator invocation passed 95 Node plus three Go contracts. Two
additional cancellation cases and all affected merge contracts then passed in a
39-case focused run (97 distinct Node cases across runs). App/Functions TypeScript
and whitespace checks pass. These are synthetic-provider and React fixture
checks; no real native OAuth, device rendering, process termination, background
scheduling or production execution is claimed. Live creation remains rejected;
archive access and reconciliation tooling remain unimplemented. See
[client behavior and validation](../account-merging.md).

Merge lifecycle/deletion follow-up: internal orchestration revalidates identities,
disables/revokes the guest before copying, checks final statistics, retires guest
Auth/data and releases the destination only after cleanup. Current saved-account
credentials can recover without the guest; operation IDs prevent stale cancellation
of newly confirmed work. Completed-profile deletion erases archives and paged merge
provenance; retired guest tombstones have no destination linkage and a 24-hour
security window. A provider-link race is detected without deleting the new linked
identity, but requires explicit reconciliation tooling before user rollout.
All 119 affected backend unit tests pass. The initial full emulator run passed
89/90 Node cases; corrections to fixture order and expected revocation errors
yielded 17/17 focused lifecycle passes, plus all three Go contracts. Across these
runs, 92 distinct Node contracts and three Go contracts pass. TypeScript and
whitespace checks pass. No public merge endpoint, player flow, scheduler delivery
or production identity behavior is claimed. See [details](../account-merging.md).

Merge storage-worker follow-up: a durable 20-record worker validates both profiles'
games/history/statistics before copying. Each copy page commits imports, conflict
archives, history, statistics and cursor atomically. Thirty-two new focused real
Firestore contracts pass, including concurrent workers over 45 source games,
inconsistent/legacy records, staged-write rollback, committed-page lost response
and inter-page lock/data failures. The 29 affected policy regressions, Functions
TypeScript and whitespace checks pass separately; emulators exit 0 with test
ports closed. The full existing contract suite was not repeated for this internal
addition. The copied state intentionally retains pending status, both locks and
all source data. Auth lifecycle, scheduling, status/recovery, retirement/deletion
cleanup and user interface still prevent enabling merges. See
[worker behavior and evidence limits](../account-merging.md).

Merge authorization/reservation follow-up: 119 focused backend tests pass across
four suites, with Functions TypeScript and whitespace checks passing. One combined
emulator invocation passes all 42 Node and three Go contracts (45 total), covering
real synthetic Auth records, concurrent duplicate/competing reservations, cursor
preservation, inconsistent locks, deletion barriers/prepared receipts, callable
gameplay guards and both roles' owner-access rules. The emulators shut down with
exit 0. These checks do not prove native OAuth, production token signatures,
Auth/Firestore atomicity or the unfinished merge workflow. No public merge
endpoint or automatic lock release exists. Next: resumable page processing,
identity lifecycle/reconciliation, recovery/status and complete deletion cleanup,
then confirmation/archive UI and provider/device tests. See
[implemented merge safeguards and remaining requirements](../account-merging.md).

Existing-profile merge policy follow-up: a bounded, deterministic planner imports
missing days, preserves attempts/hints/content, archives same-day conflicts without
extra credit, and skips already-imported games after further destination play.
The shared history writer now serves ordinary completion and planned imports.
Twenty-nine policy and 27 existing server unit cases pass across focused runs;
Functions TypeScript/whitespace checks pass. All 22 Node emulator contracts pass,
including continuing a real imported game through the actual callable. The runner
then stops because Go is absent from PATH; the three Go contracts pass separately
with the workspace runtime. Final rejection-only validation was unit/type checked
after that emulator run. No account merge endpoint is enabled: dual-account proof,
durable reservations/resume, deletion coordination and confirmation/archive UI are
still required. See [merge policy and remaining workflow](../account-merging.md).

Native Google adapter follow-up: seven focused suites / 56 tests pass, along
with TypeScript and whitespace checks. Native and browser token acquisition are
separate; pending-save account changes, provider cleanup, cancellation, missing
tokens and deletion reauthentication failure are covered. An initial component
test exposed eager native-module loading; deferred loading now preserves
guest-only development. Provider tests use mocks; real Google/Apple credentials,
native interaction, cross-device recovery and existing-profile merging remain
unverified. See [provider integration](../native-google-sign-in.md).
Both-ABI Android demo Release compilation passes in 56s. Source-map inspection
confirms the native identity adapter and absence of the Expo Google browser
provider; copied hooks match the workspace. All 56 native libraries are unchanged,
including the 19 unresolved RELRO failures. Artifact/hash are recorded in the
provider document; no signed/device/iOS OAuth acceptance is claimed.

Readability/hint follow-up: 31 focused suites pass across targeted runs (160
distinct tests), including measured text/control contrast in both themes and
server-acknowledged hint display. TypeScript passes. Actual 16 KB Android checks
verify separate header rows, wrapping Easy hints, fully visible enlarged tabs,
light/dark text at 200%, three uses, free re-view, disabled fourth choice and
restart persistence. Independent backend checks retain all five previous test
games unchanged. A sixth untouched game was deliberately seeded as Easy for
these UI checks. This does not prove difficulty selection, native transport
failure, screen-reader or comprehensive iOS/a11y acceptance. See
[readability evidence](readability-and-hints.md).

Account-continuity follow-up: seven focused suites pass (49 tests across targeted
runs), TypeScript passes, and both-ABI Release rebuild passes in 59s. On installed
16 KB Android, Auth-emulator import invalidates the enrolled session; retry,
cancel and cold restart retain the recovery screen and exactly four pre-existing
test accounts/games. Explicit confirmation creates exactly one fifth guest with
an empty game and preserves the original four game revisions. Marker corruption,
write failure, duplicate attempts, intentional sign-out and deletion integration
also have targeted test coverage. Native provider/iOS and credential recovery
limits remain; see docs/account-sessions.md.

Search layout follow-up: results and tutorial tips now take space in the page;
the result footer grows independently of the scrolling list. Four focused suites
pass (34 tests), TypeScript passes, and both-ABI Release rebuild passes in 1m.
Installed 16 KB Android checks verify valid normal-result bounds, preview/list
scrolling and selection, and reachable results/footer at 150% text with the
keyboard visible. TalkBack, fresh tutorial, contrast/header and iOS checks remain.
A controlled backend export/import also reproduced silent guest replacement
after token invalidation; the later continuity follow-up above addresses it for
enrolled sessions, with explicit limits retained in 08.
See android-device-smoke.md for hashes, evidence and exact limits.

Latest Android follow-up: NDK r30 compiles ARM64 and x86_64. Its packaged C++
runtime passes alignment; 10 ARM64 and 9 x86_64 prebuilt RELRO failures remain
among 56 libraries (all LOAD/ZIP checks pass). A development/demo Release-mode
APK installed with a local-only test certificate passes guest startup, title
search, a wrong guess, force-stop/relaunch recovery, correct second guess,
poster rendering and first-win chart display. Independent emulator reads verify
one guest, one game, one history record and one score credit. The first fixture
had invalid routes from linked source and shared Metro transforms; copied source
and an isolated cache corrected it. Android reports invalid accessibility bounds
for search results despite working touch selection; finding 23/28 remains open.
See [the device record](android-device-smoke.md) for artifact hashes and limits.
This is not a comprehensive device pass or release approval.

Reproducible native-source follow-up: added Android prebuild source preparation
with upstream-version/patch guards, ownership-safe cache refresh, nested codegen
resolution and cross-platform Gradle/CMake paths. Fresh generation preserves
installed dependencies and supports repeated prebuild without recopying unchanged
sources. Twelve configuration contracts, actual fresh generation/cache/ownership
checks and workflow YAML parsing pass. The generated ARM64 Release build passed
(982 tasks, 950 executed); its APK passes ZIP/all 28 LOAD checks and has the same
11 remaining RELRO failures as the experiment. The locked installed dependencies
and Gradle download cache were reused; remote CI and clean dependency installation
are separate gates. An isolated API 36 x86_64 emulator booted and returned a 16 KB
page size after targeted ADB reconnect, but first boot showed a System UI ANR.
It was stopped without data loss; no app was installed or runtime-tested. The
NDK r30 C++ candidate also passes separate ARM64/x86_64 alignment checks, with
no removed symbol referenced by current ARM64 APK consumers; adoption and ABI/
device verification remain outstanding. No store signing, deployment or release
approval occurred. See the native runbook for hashes and precise limitations.

Theme preference/recovery follow-up: delayed startup reads no longer overwrite
a newer selection, stored values are validated, and rapid changes serialize
their writes. Native appearance now follows restored preferences as well as
new selections. Failed persistence retains the session choice and shows a
retry instruction; older failures cannot replace a newer choice's status.
Theme controls have 48-point minimum targets and wrap instead of requiring
one fixed row. Five affected suites (23 tests), including storage delay/failure
regressions, Profile and style consumers, pass; app TypeScript passes. Native
appearance, large-text layout and screen-reader behavior still need device
verification; this does not close the comprehensive accessibility finding.

Android source-build experiment: isolated React Native/Hermes source compilation
with NDK r28c and both 16 KB linker flags produced an unsigned ARM64 Release APK.
All 28 packaged LOAD checks and ZIP alignment pass; 11 RELRO checks still fail,
down from 14 in the configured prebuilt route. Rebuilding hermestooling, jsi and
hermesvm resolves those three failures. The first attempt exposed a probe copy
filter that omitted the real `common/build/ReactBuildConfig.kt` source directory;
the filter/copy were corrected before the successful build (982 tasks).
The result is an experiment, not a production configuration change or device
compatibility approval. A portable, cleanly reproducible source-build workflow
and the remaining third-party libraries still need work. Exact artifact and
remaining failures are recorded in `android-native-libraries.md`.

Game-over test isolation follow-up: reproduced the post-teardown animation
ReferenceError as an exit-1 failure even though all five assertions passed.
The suite now awaits the testing library's asynchronous unmount and flushes
pending animation timers before restoring real timers. Its five tests pass
with exit 0 and no teardown or overlapping-act warnings. This validates test
isolation; installed-device animation behavior remains unverified.

Fatal-error recovery follow-up: found that the fallback's Reload App button used
`Updates.reloadAsync()` while app config disables OTA updates. Expo documents
that this API rejects when updates are disabled. Switched native reload to
`reloadAppAsync` from `expo`, retaining browser reload on web. Added a pending
state/duplicate guard, retry after rejection and suppression of late error alerts
after unmount. Error-boundary telemetry now runs in `componentDidCatch` instead of
the render-derived lifecycle, and raw diagnostic logging is development-only.
The two affected recovery suites pass (9 tests); app TypeScript passes. Installed
release reload and durable action recovery after restart remain device gates.
API contract: [Expo Updates reload documentation](https://docs.expo.dev/versions/latest/sdk/updates/#updatesreloadasyncoptions).

Native alignment follow-up: the clean generator and ARM64 unsigned Release build
passed with NDK 28.2.13676358 and aligned DataStore 1.2.1 dependencies (874 Gradle
tasks, 842 executed). The packaged check reduced RELRO failures from 23 to 14 of
28 libraries; ZIP/LOAD checks pass. Eight source-built libraries and the DataStore
shared counter now pass. Seven configuration tests, five binary-verifier tests,
actual clean generation/idempotence and workflow YAML parsing passed. Inspected
upstream candidate AARs; several newer versions still fail, so no broad overrides
were applied. Native CI enforces the binary check and remains expected to fail
until the prebuilt dependencies are resolved. The first local DataStore rebuild
used a stale fixture; it was excluded from the evidence and repeated with the
same clean generator used by CI. No device/runtime/iOS/signing result is claimed.
See `../native-builds.md` for the exact artifact hash and reproduction commands.

Dependency/ARM64 follow-up: app TypeScript and 89 suites / 451 tests / 1 snapshot
passed after dependency cleanup. Four app dependency contracts and four integration
dependency contracts pass, including bounded malformed-input checks and actual
query-string, Xcode, gaxios and Pub/Sub consumer behavior. Final Auth/Firestore/
Functions/Go emulator run passed all 24 contracts after scoped integration updates.
Backend production npm audit is zero; full scopes retain the advisories documented
in `../dependency-security.md`. A fresh isolated `npm ci --ignore-scripts` exposed
an invalid local-override lock path; the corrected direct dependency/reference
installs cleanly and passes the four app dependency tests in that fresh tree.
Lifecycle scripts were not tested in that isolated install. Regenerated Android
ARM64 unsigned Release compiled (874 tasks). APK ZIP and all 28 native LOAD
alignments pass, but the additional RELRO check failed for 23 libraries; the
exact binary hash and affected libraries are in `../native-builds.md`. This is an
open native release issue, not a 16 KB compatibility pass. No iOS/device/store
build, deployment, production credential use or audit waiver occurred.

Native/environment follow-up: replaced the obsolete checked-in Android/iOS sources with ignored generated projects driven by Expo template 57.0.30, app config and plugins. Previous native sources are preserved locally in `.expo/legacy-native-before-cng` and in Git history. The SHA-512-verified generator produced a fresh Android project with signing and native-path plugins. Preview generation with test-only provider values verified separate package/scheme and disabled cleartext networking. Preview no longer inherits production settings; emulator selection is explicit and consistent across Firebase SDKs and deletion status. Six environment/signing contracts, all 89 app suites / 451 tests / 1 snapshot, app TypeScript, workflow YAML parsing and diff whitespace checks passed. Online Expo Doctor passed 21/21 checks. Removed unused Victory, chart-kit and Skia dependencies; system UI is installed for automatic appearance.

Android x86_64 debug compilation passed (578 Gradle tasks). The unsigned release build also passed (948 tasks, including native compilation, release lint and bundling 2,464 JS modules/54 assets), producing a 59,987,380-byte APK. `apksigner verify` rejected it with the expected missing-signature error, confirming no debug-key release fallback. The merged release manifest targets API 36/minimum 24, has Sentry auto-init false and no debug/storage/audio/overlay permission flags checked here; cleartext remains enabled for this demo/emulator variant only. Initial native release attempts exposed Windows object/header path limits and stale Ninja dependency paths. CMake object-path hashing, a dedicated short app staging directory and a short Gradle cache resolved them. The local build used `C:\Users\tom\.tt-cxx` and `C:\Users\tom\.tt-gradle`; regeneration/build instructions document the corresponding overrides. Android ARM64 and iOS simulator release CI are configured, but neither remote job has been observed; iOS cannot be compiled on this Windows host. No live config, signed release, native gameplay, complete privacy-manifest audit, store submission or deployment is claimed. See `docs/native-builds.md` for the migration inventory, exact commands and remaining gates.

Search/chart follow-up: search regressions use the installed fuzzy engine rather than mocked results, including discoverability of all 4,987 bundled titles by title and title/year. Component/store tests cover one-character selection, duplicate prevention before the outbox, stale account-search cancellation, release-year labels and unavailable results. Source parsing preserves distinct original titles in candidate aliases; direct alias spoilers are rejected in descriptions and taglines. The released catalog is unchanged and has zero alias-bearing entries; editorial alias review remains required. All 64 tests across the nine affected app suites passed across targeted runs; app TypeScript and diff whitespace checks passed. Go tests and vet passed after removing an unused test import caught by the compiler. The win distribution now renders native View/Text bars and readable counts without relying on obsolete Victory exports; tests cover first-win refresh, correct proportions, zero buckets, old short arrays and malformed saved data. Decorative bars are intentionally hidden from accessibility; tests inspect those bars explicitly while asserting accessible textual labels. Device rendering, screen-reader behavior and performance remain separate acceptance gates. No dependency removal, catalog promotion or deployment is claimed.

- Functions build passed after introducing the authoritative command engine and packaged catalog.
- Functions: 3 suites / 29 tests passed. Coverage includes malformed input, forged fields, cross-user requests, replayed and concurrent commands, hint bounds, missing content, immutable difficulty, cast matching, and date-order streaks. Transaction storage is mocked; this is not emulator evidence.
- App TypeScript passed after adapting service/store types.
- Targeted client persistence/store/feedback regressions: 4 suites / 18 tests passed.
- Broader app run exposed outdated history/gameplay/store tests; those affected suites were adapted to the acknowledged-action contract and passed (3 suites / 17 tests). Subsequent targeted checks passed for history, the locked-difficulty display, and gameplay state; the profile preference test was updated for its new next-challenge label.
- The compiled Functions module loads successfully and exports the three intended callables without contacting a database. Final TypeScript and Functions build checks passed.
- No native build, emulator test, deployed operation, or production migration has been performed in this stage.

Account/privacy follow-up: the five affected suites now pass (36 tests total across targeted runs). Coverage includes in-place guest linking, existing-account collision protection, cancellation, duplicate taps, account changes during the provider prompt and credential linking, stale profile/game responses, failed-outbox sign-out, profile retry, and telemetry PII/error filtering. Two navigation suites (6 tests) also pass with the real `fontsLoaded=false, error` failure combination. A further test verifies that the actual default telemetry configuration initializes no Analytics/Performance collection and sends no events or identity. App TypeScript and diff whitespace checks passed. Tests mock Firebase/provider APIs; they do not prove native OAuth or deployed behavior.

Next: implement secure returning-account merging, finish deletion verification and privacy/support publication, and reconcile native release builds while continuing through the table above.

Account-deletion client/recovery follow-up: Profile now offers explicit permanent-deletion confirmation and linked-Google reauthentication of the same UID. The app persists a secret status receipt before submission, blocks automatic guest creation and game commands while intent is unresolved, and checks completion without needing the deleted Auth account. Lost replies remain unconfirmed until the server status resolves them. Local cleanup failures retain the receipt for retry; creating a replacement guest requires an explicit choice after confirmed completion. Native receipts use SecureStore; web receipts use AsyncStorage. Pending receipts have no expiry; completed receipts expire after 30 days. A receipt authorizes only status retrieval, never deletion. The final local emulator run passed 21 Node contracts and 3 Go contracts. All 43 backend unit tests and all 87 app suites / 432 tests / 1 snapshot passed; app TypeScript and diff whitespace checks passed. The app run still emitted the previously recorded gameOverView post-teardown animation warning despite returning success. Native Google/Apple behavior, cross-device recovery, lost/expired-receipt recovery, the public web route, production scheduler/IAM/alerts and real-user deletion remain unverified or unimplemented as detailed in `docs/account-deletion.md`. No deployment or release-readiness claim is made.

Account-deletion backend follow-up: `deleteAccount` queues an owner-only request before cleanup; game transactions and Firestore owner rules reject deleting accounts. Auth is disabled before recursive current/legacy data cleanup and deleted afterward. Linked accounts require recent authentication, all new requests reject malformed/revoked sessions, and duplicate accepted requests are idempotent. A scheduled worker retries failures using a ten-minute lease and expires completed UID barriers after 24 hours. The final real emulator run passed 20 Node contracts and 3 Go contracts, including simultaneous deletion/gameplay, more than 200 legacy records, incomplete old keys, other-account isolation, partial database failure, Auth deletion failure, stale-token denial, retry/retention behavior and recent-auth checks. The scheduler's worker is invoked directly in tests; Cloud Scheduler delivery/IAM/alerts are not verified. Functions build and 43 backend unit tests passed. No app deletion control, public deletion website, deployed operation or real-user deletion is claimed. See `docs/account-deletion.md` for the exact implemented contract and remaining client/operations gates. Next account work must add durable client intent and post-Auth completion recovery, then provider reauthentication/confirmation/local cleanup rather than treating this backend stage as a finished user feature.

Emulator/CI follow-up: the isolated demo-project runner rebuilds production Functions before starting real Auth, Firestore and Functions emulators. All 13 Node contracts and all 3 Go publication contracts passed on Node 24.21.0/Java 21/Go 1.26.9. Tests cover denied reads/writes, real callable authentication/ownership boundaries, contention/replay, hint limits, guest linking/returning identity, concurrent immutable publication, previews and no partial writes on rejected plans. An initial malformed-token test exposed an undefined UID reaching Firestore; the callable now validates UID before accessing storage. Raw legacy movie reads are denied. The dangerous staging alias pointing at production was removed; the default project is demo-only. No live data was touched.

The Firebase 13 SDK requires Node >=24.12; app tooling, Functions and CI now use Node 24 (24.21.0 pinned for local/CI tooling). The CLI recognizes Node 24 and the emulator actually used it. Functions build and 42 backend tests passed; app TypeScript and all 84 app suites / 413 tests / 1 snapshot passed on this runtime. The first backend test invocation from the repository root selected the wrong tsconfig and failed before running tests; the package-directory invocation used by CI passed. The full app run emitted a post-teardown animation callback ReferenceError in gameOverView despite returning success; timer/animation test isolation remains to fix. Generated tracked coverage was restored after verification. Workflow YAML parses and package/lockfile runtime declarations agree. Remote GitHub CI, clean app/backend installs, staging deployment and native behavior have not been verified in this stage.

Integration dependency audit after compatible grpc-js 1.14.6/re2 1.27.0 overrides: 11 affected packages (7 high, 4 moderate, 0 critical), including transitive parent effects, remain. Underlying advisories concern basic-ftp, braces, OpenTelemetry core and uuid. These are isolated development/CI dependencies, not evidence that app/backend dependency audits are clean. Proposed automatic major downgrades were not applied; review reachability and compatible upstream replacements during finding 24. See `docs/emulator-testing.md` for reproducible commands, safety guards and coverage limitations. The mock-token Auth emulator does not prove production JWT verification, native Google/Apple sign-in or account merging. No deployment, release approval or goal completion is claimed.

Content-pipeline follow-up: official Go 1.26.9 archive was downloaded and checksum-verified into ignored workspace tooling. `go test ./...` passed (10 top-level tests, including table-driven failure cases); `go vet ./...` passed. Loopback HTTP fixtures and temp-file rename require running outside this sandbox. Functions callable tests passed (11 tests), including immutable clues across users and rejection of legacy/tampered content; a further 11 publication-validation cases passed. Functions build passed; workflow YAML parses successfully; diff whitespace check passed. Running the real CLI against the released catalog and empty approval list exited nonzero with the required editorial-approval error before any database operation. Real Firestore transaction/concurrency, protected GitHub environments, actual editorial approvals and staged publication are not yet verified.

UTC/recovery follow-up: 13 affected client suites passed across targeted runs (74 tests), including server timing validation, clock changes, expiry, foreground refresh deferred during saves, offline/reconnect, bounded content retries, stale network probes, independent account-statistics reads, stale account replies, navigation through failures, history, picker and catalog metadata. The initial store test failures came from fixtures using a receipt timestamp unrelated to the test runtime's monotonic clock; tests now control that clock. Profile tests also caught and fixed a nullable history-selection guard. Callable suite passed (11 tests) with explicit server-now/UTC-reset assertions; Functions build and app TypeScript passed. These are mocked unit/component checks, not proof of native background timing, live Firebase authorization or native permission behavior. The obsolete fallback/factory/video-game service has no remaining source/test references. No deployment or data migration occurred.
