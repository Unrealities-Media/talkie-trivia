# Talkie Trivia release readiness audit

Audit date: October 13, 2026. Source revision: `5c16804608dc797dfb909964da3eefd7d0975c2a`.

This is the original audit snapshot. Implementation progress and remaining verification are tracked in [remediation-status.md](remediation-status.md). The diagnostic entrypoint now runs regression tests for the replacement contract rather than asserting the original vulnerabilities.

**Recommendation: do not submit this version to either app store.** The app has a useful daily-game foundation, but results can be forged, another player's game can be overwritten through the result function, progress can disappear, and several advertised or visible features are broken. Passing unit tests and exporting JavaScript do not establish that the native apps work.

This report contains 40 prioritized findings, a proposed release sequence, and acceptance criteria. It covers the client, Firebase rules/functions, content pipeline, native configuration, dependencies, tests, documentation, accessibility, and product experience. It is a repository audit with local execution, not a certification of deployed infrastructure or a completed device usability study.

## Evidence and limits

| Check | Result | What it establishes |
| --- | --- | --- |
| App TypeScript check | Passed | Current source typechecks against installed packages. |
| Functions TypeScript build | Passed | Functions compile. |
| App Jest suite | 82 suites, 406 tests, 1 snapshot passed | Existing mocked/unit expectations hold. Several expectations miss production failures below. |
| Functions Jest suite | 2 suites, 10 tests passed | Existing function/score tests hold; not an authorization or rules integration test. |
| Expo export, iOS/Android/web | Passed | JavaScript bundles and assets export. Native bytecode bundles are about 10 MB each. Missing native Firebase config files generated warnings. |
| Expo dependency compatibility check | Reported up to date | Used the local compatibility map with networking disabled; not a complete dependency health check. |
| Production dependency audit | App: 79 affected package nodes; Functions: 1 | App: 58 high, 17 moderate, 4 low; Functions: 1 high. Counts include propagated/transitive build packages, not 80 demonstrated application exploits. |
| Targeted source-execution probes | Five failures reproduced | See the diagnostic script and findings 01–03, 08–10, 13. All storage was mocked; no real account or database was attacked. |
| Movie index inspection | 4,987 records, 995,485 bytes | No duplicate IDs; 127 duplicate titles; two records lack cast; no missing year/director/genre in the inspected index. |
| Native archives / physical devices | Not run | No assertion that either release binary builds, installs, authenticates, or behaves correctly. |
| Firestore emulator / deployed rules | Not run | Rule/client conflicts are established from source; the rules currently deployed to Firebase are unknown. |
| Go tests / vet | Could not run | Go was unavailable. Java, adb, and Firebase CLI were also unavailable on PATH. |

Checks used the existing installation on Node 25.2.1; the project/CI targets Node 22. A clean locked install and CI-equivalent execution remain required. No cloud resources were changed. Generated coverage changes were restored. Only this report and the diagnostic script were added to tracked source locations.

Run the diagnostic reproduction from the repository root:

```powershell
rtk proxy node docs/audits/release-audit-probes.cjs
```

The script intentionally asserts the presence of current bugs. It is **not** a passing regression suite or an exploit against a deployed service. Replace its assertions with desired-behavior tests as fixes land. Source references below are repository-relative and line numbers refer to the audited revision.

Priority definitions: **P0** = security/data-integrity blocker; **P1** = release blocker affecting core play, store compliance, or dependable operation; **P2** = quality/maintainability work to complete before a broad launch or explicitly scope out. “Reproduced” means local source execution; “source-confirmed” means the implementation shows the defect; “verification gap” means additional external/device evidence is required.

## P0: establish a trustworthy game and database

### 01. A player can submit a fabricated win and score

**Reproduced.** `functions/src/index.ts:14–30` accepts the client's `correctAnswer`, difficulty, guesses, guess limit, trivia data, and start date. Authentication only proves which Firebase user called the function. It does not prove that the user won the scheduled game. There is no authoritative game/schedule read before scoring.

The probe submitted a guess with ID 111 against answer ID 222 while setting `correctAnswer: true`; the function awarded a win. Unbounded combinations of guesses and guess limits also undermine score limits. Arbitrary dates can contaminate history.

**Improve:** accept a small, versioned command, validate its schema and bounds, and derive identity, challenge, answer, difficulty, terminal state, and score from trusted records. Persist immutable result facts and a scoring version. If competitive fairness matters, avoid distributing future answers to clients and require server-validated guess progression. App Check is useful defense in depth, not a replacement for validation.

**Acceptance:** wrong answers, fabricated challenges, invalid difficulty, impossible guess counts, future dates, extra fields, and manipulated scores are rejected. Legitimate wins/losses receive the same server result on both platforms.

### 02. The result endpoint can overwrite another player's game

**Reproduced.** `functions/src/index.ts:55` uses caller-controlled `playerGame.id` as an Admin SDK document destination. Checking `playerGame.playerID === auth.uid` does not establish ownership of that document. At `:99`, the function also spreads the supplied object into storage.

The probe authenticated as `attacker`, supplied its own `playerID` and a victim's game document ID, and overwrote that game with attacker data. Firestore client rules cannot protect writes performed through this Admin SDK path.

**Improve:** derive all document paths from the authenticated UID and canonical challenge ID; read and verify ownership/state in the transaction; use explicit allowed fields. Prefer a clear path such as `players/{uid}/games/{challengeId}` over parsing a composite ID.

**Acceptance:** cross-account document IDs and field injection cannot affect another user. Add negative integration tests with two users, not only function mocks.

### 03. Replaying a result repeatedly increases statistics

**Reproduced.** `functions/src/index.ts:80–84` increments games, points, and streak on every invocation. Its transaction reads player statistics, not a completion record. The submitted `statsProcessed` field provides no server-side idempotency.

Submitting the same result twice produced two games and 2,000 points in the probe. Normal mobile retries can trigger the same corruption without malicious intent.

**Improve:** atomically create one completion per UID/challenge, update aggregate statistics only on the first transition, and return the existing immutable result on retries. Define reconciliation and migration for already-corrupted aggregates.

**Acceptance:** sequential retries, concurrent duplicate requests, lost responses, and replay after reinstall all leave one game, one history entry, and one statistics increment.

### 04. Client writes and checked-in Firestore rules disagree

**Source-confirmed; deployment unknown.** `src/services/gameService.ts:70` uses a client `Date`, while `firestore.rules:28` requires `startDate == request.time`. `gameService.ts:140` creates player statistics client-side while rules deny client statistics writes. Rules around `:38–43` expect `movie.id` and numeric guesses; the current model uses `triviaItem` and guess objects. Other rule paths still use old history field names.

Additionally, `firebase.json` does not wire in the Firestore rules configuration. The rules are neither a reliable deploy artifact nor a tested contract for the current client. Existing update validation does not sufficiently preserve earlier guesses or protect difficulty, limits, hints, and processing fields.

**Improve:** choose one authoritative schema and ownership model; use server timestamps where required; initialize statistics on the trusted side; restrict fields and transitions; configure rules/indexes explicitly. Test anonymous and linked users against the emulator and inspect deployed rules separately.

**Acceptance:** a brand-new guest can start, save, finish, and retrieve a game under exactly the rules that will be deployed; unauthenticated, cross-user, and invalid-transition operations fail.

## P1: release blockers

### 05. Native projects are inconsistent with the JavaScript stack

**Source-confirmed; native build unverified.** The package stack uses Expo 57 / React Native 0.86, while `ios/Podfile.lock` retains Expo 52 / RN 0.76 / Reanimated 3. Native new-architecture settings are false while `app.config.ts` enables it. Android retains older Kotlin/NDK/SDK defaults. These are meaningful native integration mismatches even though Metro export succeeds.

**Improve:** decide whether generated native projects or maintained native projects are the source of truth. Reconcile native dependencies/configuration through the supported upgrade path, preserving required customizations. Build a clean iOS archive and Android App Bundle in controlled CI and inspect the resulting binaries.

**Acceptance:** reproducible signed builds from a clean checkout; authentication, storage, notifications, animations, crash reporting, and updates work in installed release builds. Verify Android native-library [16 KB page-size compatibility](https://developer.android.com/guide/practices/page-sizes).

### 06. Release signing and submission toolchains are not ready

**Source-confirmed plus verification gap.** `android/app/build.gradle` assigns debug signing to the release build; the standard debug keystore is tracked. `android/build.gradle` defaults to target API 34. There is no tracked `eas.json`, and expected environment/native Firebase files are unavailable in this checkout.

As of this audit, new Google Play submissions/updates require Android 16/API 36, subject to Google's extension provisions. The checked-in default is below that requirement. [Google Play target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).

Apple requires uploads to use the iOS/iPadOS 26 SDK or later from April 28, 2026. This is a build SDK requirement, not a requirement to drop all older supported devices. [Apple SDK requirements](https://developer.apple.com/news/?id=ueeok6yw).

**Improve:** configure protected upload signing and Play App Signing, provisioning, monotonically increasing build numbers, release profiles, environment validation, and a documented CI toolchain. Inspect final target SDK and signing certificates rather than assuming config values reached the binary. Do not treat the standard debug key as a production signing credential.

**Acceptance:** TestFlight and Play internal testing accept the exact intended release artifacts; no debug signing/configuration; secrets stay outside source control while nonsecret build profiles and setup examples remain reproducible.

### 07. Privacy policy and account deletion are missing

**Source-confirmed.** `src/app/(tabs)/profile.tsx:52` opens `https://your-privacy-policy-url.com`. There is no user-facing account deletion flow or corresponding complete backend erasure operation.

**Improve:** publish a real policy describing guest identifiers, account data, gameplay, vendors, retention, contact information, and deletion. Implement deletion for linked accounts and a clear erase/reset path for guests, including Firestore subcollections, authentication, cached identity, and applicable vendor data. Reauthentication and partial failures must have recoverable UX. Supply the public deletion-request page required by Google Play.

**Acceptance:** policy/support/deletion links work outside the app; deletion is exercised end to end and disclosed retention exceptions are accurate. Apple requires in-app deletion for account-creating apps; Google requires both in-app and web request paths for covered apps. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

### 08. In-progress guesses and hints are only held in memory

**Reproduced for guesses; source-confirmed for hints.** `src/state/slices/gameSlice.ts:115,189` changes local state. Nonterminal `processGameOver` does not persist it; the store has no durable game persistence. The root also reinitializes around connectivity changes.

**Impact:** closing or restarting the app can erase progress; reconnect can load an older game. A daily game cannot depend on keeping one process alive.

**Improve:** persist each accepted transition locally, queue acknowledged server synchronization, and reconcile by UID/challenge/version. Define offline play explicitly. Do not clear a recoverable draft simply because network state changed.

**Acceptance:** after every guess/hint, force-close, background, reboot, lose connectivity, and reopen. The same game resumes exactly, without restoring spent hints or granting extra guesses.

### 09. Failed result submission leaves the game marked processed

**Reproduced.** `gameSlice.ts:278–284` marks `statsProcessed` before the request succeeds. If submission fails, that flag remains true and a second processing attempt skips submission. Local statistics can disagree with the server; the global error also interrupts other app areas.

**Improve:** separate game completion from synchronization status: `pending`, `syncing`, `confirmed`, `retryable failure`. Use a durable outbox, server idempotency, and the canonical returned score. Retain the result screen with a clear pending state and retry behavior.

**Acceptance:** kill the app before request, after server commit, and before response. All paths eventually converge to one saved result without duplicate statistics or lost wins.

### 10. Cast matching produces false hints

**Reproduced.** `src/services/movieDataService.ts:73` converts cast names into actors with ID `0`. `src/utils/guessFeedbackUtils.ts` compares actor IDs. Two completely unrelated nonempty casts therefore match. Separately, `src/components/hint.tsx:28` uses `actor` where the content model uses `actors`, producing an unavailable hint.

**Improve:** keep stable person IDs in the catalog, use the same hint keys throughout, and define behavior for missing data. If names must be used temporarily, normalize carefully and treat missing IDs as unknown, never as equal people.

**Acceptance:** disjoint casts never match; a shared real actor does; empty casts and duplicate names are handled. Every difficulty's visible hint renders meaningful content.

### 11. Daily identity disagrees across time zones

**Source-confirmed with date probes.** `movieDataService.ts:164` chooses a local calendar day, while the default date-ID utility uses UTC. Server history derives dates from client input and countdowns use local midnight. In Chicago at `2026-10-14T01:00:00Z`, the content date is October 13 but the UTC ID is October 14. Parsing date-only history strings as instants displays the preceding date in some zones. Parsing a year with `new Date('1999').getFullYear()` can similarly produce 1998.

**Improve:** select and document one daily challenge boundary, preferably an explicit server-issued challenge ID/reset instant. Keep calendar dates and years as calendar values. Refresh on foreground/reset and account for DST and device-clock changes.

**Acceptance:** boundary tests cover UTC, Chicago DST transitions, India, UTC+14, UTC−12, travel, and a session spanning midnight. Content, result, countdown, history, and share agree.

### 12. Missing content silently becomes yesterday's game

**Source-confirmed.** `movieDataService.ts:173` falls back to yesterday's content while other state can still identify the game as today. There is no robust midnight/foreground challenge refresh.

**Improve:** distinguish a current published challenge, cached current challenge, and unavailable challenge. Never relabel yesterday's ranked result as today. Permit useful history/settings access during an outage; offer explicitly separate practice if desired.

**Acceptance:** missing/malformed schedule, offline cold launch, and rollover produce honest states, no double credit, and automatic recovery when valid content arrives.

### 13. Difficulty settings can change active and completed results

**Reproduced for completed games; source-confirmed for reload paths.** `src/state/slices/settingsSlice.ts:44` mutates the active game when a profile preference changes. `gameSlice.ts:90` overwrites loaded difficulty with the current device setting, and `gameService.ts:62` changes the loaded guess limit. The probe changed a completed LEVEL_5 game to LEVEL_1. Scores/shares based on current state can then change after completion.

**Improve:** separate next-game preference from the immutable difficulty of an existing ranked game. Lock difficulty at the first meaningful action, preserve it across devices, and derive scores on the server. Define a separate flexible practice mode if wanted. Align “slower clues” copy with actual reveal behavior.

**Acceptance:** hints, guess limits, score, history, and share cannot be improved by toggling settings or restarting; reducing a limit cannot strand an active game in a terminal-but-unprocessed state.

### 14. Hint currency is not an authoritative economy

**Source-confirmed.** Hint spending is local; the result function does not consistently update `hintsAvailable`/`hintsUsedCount`. Initial balances and copy about earned hint points are not backed by a complete earning/spending lifecycle.

**Improve:** simplify to a clear per-game allowance for launch, or implement an atomic server ledger with earned/spent events and explicit UI. Never sell this currency until spending, restore, fraud protection, and purchase policies are correctly implemented.

**Acceptance:** reconnect, restart, concurrent devices, repeat taps, and submission failures cannot duplicate or lose currency. Players can understand exactly how to obtain and spend hints.

### 15. Google sign-in does not preserve guest progress

**Source-confirmed.** `src/utils/hooks/useGoogleAuth.ts:39` uses `signInWithCredential` rather than linking the current anonymous identity. A user following “Save Your Progress” can switch away from the UID that owns that progress. Sign-out creates a fresh anonymous user without a complete explicit reset/cancellation boundary for existing game state.

**Improve:** link guest credentials where possible; define a deterministic merge for credentials already attached to another account. Reset account-scoped state and cancel stale async work whenever UID changes. Handle canceled login and reauthentication without losing the guest game.

**Acceptance:** new account, existing account, conflict, cancellation, logout, reinstall, and two-device cases preserve the promised progress and never display another account's cached state.

### 16. iOS login compliance and native OAuth need validation

**Source-confirmed gap.** Google is the offered linked-account login, with no equivalent privacy-preserving option. Native iOS URL schemes differ from the app-config scheme; required Firebase native files are missing here. Installed release OAuth has not been tested.

**Improve:** add Sign in with Apple or establish and document an applicable exemption/equivalent compliant login; verify guest linking for every provider. Validate redirect schemes, client IDs, bundle/package IDs, and Android signing fingerprints in the actual release build.

**Acceptance:** login returns from browser/provider to the installed release app on each platform. Apple's guideline 4.8 makes the current login design a likely review blocker unless an exemption applies. [Apple login-service guidelines](https://developer.apple.com/app-store/review/guidelines/#login-services).

### 17. Analytics and crash reporting need a data-minimization pass

**Source-confirmed configuration; actual traffic unverified.** `src/contexts/authContext.tsx:73` passes name/email into analytics identification, which `src/utils/analyticsService.ts` forwards to Google Analytics user properties when Analytics initializes. This is a prohibited PII path on supported runtimes; it is not proof that native traffic currently sends it. The Firebase JS analytics setup itself needs native compatibility validation.

`src/app/_layout.tsx:17` enables Sentry default PII, debug logging, session replay sampling, and error-triggered replay without clear environment/privacy controls. `ios/talkietrivia/PrivacyInfo.xcprivacy` has an empty collected-data list; the aggregate SDK declarations and store disclosures require review.

**Improve:** remove name/email from Analytics, use pseudonymous identifiers only where needed, minimize crash/replay collection, scrub events, gate development data, clear identity on logout, and set retention. Build a vendor/data inventory and verify real network payloads. Determine consent/ATT requirements from actual tracking behavior, not merely the presence of an analytics SDK.

**Acceptance:** privacy policy, Apple privacy answers, Google Data Safety answers, merged privacy manifests, and captured traffic agree. No personal names/email in GA. [Google Analytics PII guidance](https://support.google.com/analytics/answer/6366371?hl=en).

### 18. Daily reminders use an invalid trigger

**Source-confirmed against the installed library.** `src/utils/hooks/useNotifications.ts:58` passes `{ hour, minute, repeats } as any` without the trigger `type` required by the installed Expo Notifications parser. The library throws; the hook logs a warning. Canceling existing notifications first can leave no reminder at all.

**Improve:** use the typed supported trigger, configure Android channels/native integration, and request permission after explaining the benefit. Add an on/off control and time selection; explain denied permission. Avoid reminding someone who has already played when feasible.

**Acceptance:** reminders schedule and arrive in release builds with the app closed, survive appropriate lifecycle changes, respect user settings/time zones, and handle denied permissions. Unit tests must exercise the installed API contract.

### 19. The win chart calls APIs the installed package does not export

**Source-confirmed against installed exports.** `src/components/winChart.tsx` requires `VictoryBar`, `VictoryChart`, and `VictoryAxis`; installed `victory-native` exports the newer `CartesianChart`/`Bar` API. The component returns null when those exports are absent. The warning is suppressed and tests mock the legacy API.

**Improve:** migrate the chart to supported APIs or use a small accessible native chart. Include a textual summary. Stop hiding integration warnings as a substitute for resolving them.

**Acceptance:** real-package rendering after the first win shows an accurate, accessible distribution on iOS and Android; empty and migrated statistics work.

### 20. Content automation references directories that do not exist

**Source-confirmed.** `.github/workflows/data-pipeline.yml` references `utils/data-pipeline`, `utils/populate-firestore`, and `utils/schedule-games`; the implemented pipeline is `utils/pipeline`.

**Improve:** wire the workflow to the actual executable with an explicit project/environment, locked tooling, safe credential injection, bounded permissions, validation, and failure notifications. Prefer short-lived identity where supported. Run against staging before enabling scheduled production writes.

**Acceptance:** a manually triggered dry run and staged publish succeed from a clean runner, produce inspectable outputs, and fail loudly on missing credentials, API failures, or invalid data.

### 21. Pipeline failures can silently publish partial or destructive data

**Source-confirmed.** `utils/pipeline/main.go` ignores or logs-and-continues through several HTTP/JSON/write/batch failures. Around `:371`, full-document writes can erase editorial overrides. Around `:417`, a schedule-read failure defaults to today, risking published challenge replacement. Around `:437`, each run appends 365 days rather than maintaining a bounded horizon; weekly runs can accumulate years. No concurrency lease protects scheduling.

**Improve:** stage and validate imports before publish; use timeouts/retries with bounded backoff; propagate failures; preserve editorial fields; separate ingestion from publication. Make scheduling idempotent, immutable for published days, concurrency-safe, and gap-aware. Log counts, rejected records, revision, and intended date range.

**Acceptance:** injected API/Firestore/filesystem failures leave the previous valid publication intact; reruns and concurrent runs neither overwrite published games nor duplicate the horizon. Editorial corrections survive refreshes.

### 22. Cloud answers and installed answer catalogs can diverge

**Source-confirmed architectural risk; no particular live missing answer was established.** The client searches a bundled catalog, while the pipeline can publish a newer schedule independently. A scheduled movie absent from an older installed catalog cannot be selected by that player.

**Improve:** publish a versioned catalog/manifest with compatibility rules and integrity checks, or restrict schedules to a stable pool supported by every active client version. Provide cached updates, rollback, and a minimum-supported catalog policy. Validate all scheduled answer IDs before publication.

**Acceptance:** every challenge in the release horizon is answerable on the oldest supported app/catalog version; failed catalog updates never make today's challenge unwinnable.

### 23. Accessibility needs correction and real assistive-technology testing

**Source-confirmed concerns; device behavior unverified.** Theme colors include yellow `#FFC107` against white at approximately 1.63:1, yellow against `#E0E0E0` at 1.23:1, and gray `#757575` against that surface at 3.49:1. These combinations cannot support ordinary text where used. Green `#4CAF50` against white is about 2.78:1. Not every palette pair is necessarily a text pairing; audit actual rendered states too.

Dynamic game feedback lacks a comprehensive screen-reader announcement/focus strategy; motion/typewriter effects lack a clear reduced-motion path. Catalog labels need year/disambiguation spoken aloud. Static dimension calculations risk clipping after rotation/split-screen, and tablet support is enabled.

**Improve:** accessible color tokens, redundant text/icons for correctness, scalable layouts, meaningful labels/roles/states, announced feedback, predictable modal focus, reduced motion, and immediate text reveal. Target at least 4.5:1 regular text and 3:1 large text, and practical 44-point iOS/48-dp Android controls.

**Acceptance:** a player can independently complete onboarding, a win, a loss, history, and deletion using VoiceOver/TalkBack and largest supported text. Test small phones, tablets, landscape/split-screen, dark/light themes, and reduced motion. Accessibility is a launch requirement, not an optional polish pass.

### 24. Dependency security findings need triage and updates

**Tool-confirmed advisories; exploitability not established.** The app production audit reports 79 affected package nodes, many inherited through tooling/compatibility packages. Direct advisory origins include `@grpc/grpc-js`, `bl`, `braces`, `decode-uri-component`, `elliptic`, `node-forge`, old `semver`, `sprintf-js`, and `uuid` under `xcode`. Functions has a high-severity `@fastify/busboy` finding involving multipart handling.

**Improve:** trace each advisory to installed version, parent dependency, runtime/build reachability, and a supported patched version. Prioritize deployed function/runtime paths, then CI/build paths. Remove unused compatibility packages. Do not blindly apply `npm audit fix --force`: the proposed resolutions can move core packages to unsuitable versions.

**Acceptance:** no unassessed high/critical advisories in release artifacts or build infrastructure; remaining accepted findings have explicit reachability evidence, owner, and expiry. Re-run locked installs, compile, targeted tests, and native smoke tests after updates. Local raw snapshots are in ignored `.expo/audit-app-dependencies.json` and `.expo/audit-functions-dependencies.json`; generate fresh reports in CI.

### 25. Preview/staging can target production resources

**Source-confirmed.** `.firebaserc` maps default/staging to the same project, preview configuration uses production identifiers/configuration, and the Go pipeline hardcodes a project. A name such as “staging” does not establish isolation.

**Improve:** distinct development, staging, and production Firebase projects and app identities; explicit configuration validation; least-privilege deployment identities; production approvals in CI; budgets/alerts and bounded callable capacity. Add App Check rollout, abuse/rate controls, and structured server logs with safe public errors. Avoid exposing raw internal exception messages to players.

**Acceptance:** development/testing cannot read or write production player data by default. A pre-deploy check proves target project, package identity, rules version, and credentials. Repeated authenticated abuse is bounded and observable.

### 26. Error recovery can leave players trapped

**Source-confirmed.** Root retry increments a local retry key but does not re-run failed authentication while the auth-error guard remains set. Network retry does not itself establish recovery. Root-level game/network errors gate unrelated profile/history/settings screens. Some errors expose Firebase-console instructions intended for developers.

The tab layout checks `!fontsLoaded` before handling `fontError`, risking an indefinite loader. The error boundary uses `Updates.reloadAsync` while native update enablement is false, so that recovery path needs release-build verification.

**Improve:** model authentication, content, synchronization, fonts, and connectivity failures independently; supply real retries and fallback fonts; keep usable screens available. Use plain player-facing recovery messages and diagnostic IDs. Ensure animation/timer completion cannot trap essential controls and cancel stale callbacks on game/account changes.

**Acceptance:** each injected failure has a bounded loading state and a recovery path without clearing valid progress or reinstalling the app.

### 27. Existing CI does not exercise the most important contracts

**Source-confirmed.** Jest mocks permit incompatible chart/notification APIs and skip the rules/backend/client contract. Existing Maestro flows use E2E substitutes for authentication/history/submission. There is no demonstrated native release smoke suite or Firestore authorization suite. Functions lint is effectively a placeholder.

**Improve:** keep fast unit tests, add real Firebase emulator integration tests, and add a small real-service staging suite on both installed release apps. Put runtime input validation, idempotency, identity migration, date boundaries, and crash/retry recovery under tests. Assert E2E bypass flags are off in production builds; isolate fake adapters from normal release setup.

**Acceptance:** CI fails on findings 01–04 and 08–19; signed-device smoke tests use actual persistence and SDKs. Enforce meaningful lint/type checks and Go tests/vet. Test behavior and failure recovery rather than coverage percentage alone.

## P2: quality and operational improvements

### 28. Some legitimate movie titles are difficult to enter

**Source-confirmed.** Search requires at least two input characters, but the index contains `9`, `X`, and `Z`. Exact one-character title entry cannot find these answers. There are 127 duplicate titles; accessible disambiguation needs release year. Alternate/localized names and duplicate guesses need deliberate handling.

**Improve/acceptance:** support single-character exact matches, title/year labels, aliases and normalized punctuation/diacritics, useful empty results, and an explicit duplicate-guess policy. Benchmark input responsiveness on a low-end phone. Verify every scheduled title is discoverable with reasonable input.

### 29. “Day streak” is actually consecutive wins

**Source-confirmed.** The server increments on wins without an authoritative previous-play date. Missing a day does not implement a daily streak reset.

**Improve/acceptance:** choose daily participation versus consecutive wins, define losses/missed days/time-zone changes, and implement the stated rule using challenge IDs. Explain it in the UI; migrate existing statistics honestly.

### 30. History can be stale and depends on unrelated current content

**Source-confirmed.** History loads on player change rather than reliably refreshing after a completed game or tab focus; results are capped at 20 without pagination. `src/components/historyDetailModal.tsx:61` fetches today's game just to obtain the catalog, so old history can fail when today's schedule is unavailable.

**Improve/acceptance:** invalidate/refetch on confirmed completion, paginate if presenting full history, resolve metadata independently of the current schedule, and preserve enough immutable result data to render past games. Cancel stale detail requests. Today's outage must not prevent opening yesterday's saved result.

### 31. Clue quality needs an editorial process

**Source-confirmed design gap.** Pipeline validation focuses on required metadata and minimum plot length. Exact-title replacement with `[The Protagonist]` can be awkward or misleading and misses aliases/spoilers. Arbitrary word chunks are not calibrated clue difficulty. Age suitability, objectionable content, recognizable-title balance, repeat spacing, and factual correction lack a defined publishing gate.

**Improve/acceptance:** review upcoming challenges before publishing; structure clues as useful escalating information; check title/alias leakage, answer ambiguity, metadata correctness, age suitability, and difficulty distribution. Add a report-problem route, content revision history, and a way to retire/correct a challenge without corrupting completed results. Pilot with casual and expert players separately.

### 32. Licensing and content provenance need a release record

**Verification gap.** Existing TMDB attribution is a positive start. The repository does not establish the full rights/terms basis for the intended commercial use, distribution, imagery, and retained metadata.

**Improve/acceptance:** document sources, attribution placement, allowed use/caching, commercial plans, rights contacts, and provider failure contingencies. Verify the approved logo/notice requirements and whether a commercial agreement is needed. TMDB describes free noncommercial use with attribution and a separate commercial licensing route; it provides no SLA. [TMDB FAQ](https://developer.themoviedb.org/docs/faq).

### 33. Onboarding and copy should explain the actual game

**Source-confirmed inconsistencies plus product recommendation.** “Save Your Progress,” earned hint points, slower clues, and leaderboard promises currently outpace implementation. A simple daily game still needs a clear explanation of guesses, feedback, hints, difficulty, reset time, and scoring.

**Improve/acceptance:** remove unsupported promises, provide an optional short practice/tutorial, and explain rules at the point of use. Ask testers to describe how scoring/hints work after their first game; investigate misunderstandings before adding more systems. Prompt login/reminders after players experience value, while retaining easy guest play.

### 34. The post-game experience can offer more lasting value

**Product recommendation, not a proven failure.** A daily game provides limited content once finished. The most useful additions are likely a satisfying answer explanation, accurate movie facts, stable personal progress, and an optional clearly separated practice/archive mode. Do not assume more features increase retention.

**Improve/acceptance:** test whether players learn something, understand why they won/lost, and want tomorrow's challenge. Explore spoiler-safe friend challenges or curated themed practice only after reliable core play. Competitive leaderboards require the P0 integrity work first. Avoid punitive streak pressure or inaccessible timed mechanics.

### 35. Sharing and secondary features need honest boundaries

**Source-confirmed plus verification gap.** Sharing uses a hardcoded `talkie-trivia.com` link whose deployment/deep-link behavior was not verified and computes from mutable game settings. Actor detail UI expects IDs/metadata not supplied by the current name-only catalog. The unused `WhereToWatch` component contains illustrative providers; it is not evidence that false providers currently reach players. TV/video modes are scaffolding, not currently complete public features.

**Improve/acceptance:** share an immutable result with challenge ID, difficulty, spoiler-safe output, and a verified destination. Disable dead actor actions. Keep illustrative streaming data and incomplete modes out of release flows; implement real regional availability before exposing that feature. Include mode in future game keys before adding modes.

### 36. Architecture needs fewer conflicting sources of truth

**Source-confirmed.** Client/store/service/rules/function/pipeline models have drifted; scoring/difficulty concepts are duplicated and some SDK calls bypass type safety with `any`.

**Improve/acceptance:** retain Expo/Firebase unless a measured requirement warrants replacement. Introduce versioned runtime schemas, shared pure domain rules where practical, explicit client/server DTOs, a game transition model, and adapters for storage/auth/content. Keep secrets/authoritative answers server-side. Separate profile preferences from game facts and local synchronization metadata. Document schema migrations and backwards compatibility. This is a focused consolidation, not a justification for a full rewrite.

### 37. Performance and bundle size need device budgets

**Measured bundle/catalog sizes; runtime performance unmeasured.** Native exported bytecode is roughly 10 MB, and the catalog is about 1 MB. Search repeatedly processes thousands of records. The dependency graph includes browser compatibility packages and multiple chart-related packages that deserve import/reachability inspection.

**Improve/acceptance:** profile cold launch, first playable time, search latency, memory, scrolling, animation, network bytes, and battery on representative low-end devices. Cache normalized search data and avoid redundant work if measurements justify it. Remove unused packages/assets after tracing imports, not solely because their names look unnecessary. Set p95 budgets and compare release builds, not debug-mode timings.

### 38. Observability should measure real player outcomes

**Source-confirmed gap.** Game-start/win/loss analytics helpers lack an established end-to-end call path; Firebase JS Analytics must be validated for native support. High-volume replay alone does not provide a useful operating picture.

**Improve/acceptance:** privacy-minimized events for challenge load, first guess, completion, saved result, retry, login/link outcome, and content error. Track server idempotency/rejection rates, pipeline freshness, catalog compatibility, crash-free sessions, and cost. Verify events from physical devices, separate environments, and assign an alert owner. Measure tutorial completion, first-game completion, fairness complaints, and return behavior without claiming current retention is good or bad.

### 39. Documentation and repository hygiene hinder safe releases

**Source-confirmed.** Setup lacks a complete environment example and reproducible native/Firebase release instructions. Pipeline cadence/location descriptions drift from implementation. 237 of 566 tracked files are generated coverage outputs. Legacy data/utility structure and duplicate Go module boundaries add confusion.

**Improve/acceptance:** document architecture/data ownership, supported tool versions, local/emulator setup, nonsecret environment schema, authentication setup, content publication, native builds, signing, deployment order, rollback, support, and incident response. Remove generated coverage from version control and retain CI artifacts instead. Consolidate obsolete utilities after checking callers. Have a second developer build and run staging from the documentation alone.

### 40. Backup, release operations, and store materials remain unproven

**Verification gap.** Repository configuration does not demonstrate production IAM, billing alerts, backups/restoration, incident ownership, store privacy answers, screenshots, review access, or a tested rollback. A limited tracked-text credential-pattern scan found no obvious private keys/service-account payloads; this is not a full history, cloud-permission, or credential audit.

**Improve/acceptance:** inspect production settings with an authorized operator; test restoration into a separate project; document content rollback and client/backend compatibility; establish support contact and crash triage. Review final merged permissions: checked-in Android includes external-storage/overlay permissions and iOS includes Face ID text without a clear current feature need. Remove unnecessary permissions/descriptions and verify the artifact.

Complete accurate store descriptions, age/content ratings, screenshots for supported devices, accessibility statements, privacy declarations, support/deletion URLs, export-compliance answers, and reviewer instructions. If the Play developer account is a personal account created after November 13, 2023, plan for the applicable closed test with at least 12 continuously opted-in testers for 14 days before applying for production access. Account type/status was not inspected. [Google personal-account testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

## Recommended implementation order

| Stage | Deliverable | Exit gate |
| --- | --- | --- |
| 1. Trust and data contracts | Findings 01–04, plus environment separation from 25 | Server validates ownership/results, completion is idempotent, emulator tests cover valid/hostile clients, clean guest lifecycle works. |
| 2. Reliable daily play | Findings 08–15, 22, 26; correct hints, dates, search, streaks, history | Force-close/offline/retry/account changes preserve one coherent game and score; every scheduled answer is selectable. |
| 3. Native and policy readiness | Findings 05–07, 16–19, 23–24 | Signed builds install; OAuth/reminders/charts work; privacy/deletion/accessibility requirements pass. |
| 4. Content and operations | Findings 20–21, 25, 27, 31–32, 38–40 | Staged publication, failure alerts, backup restore, clean-build CI, release/rollback runbooks, and store materials are demonstrated. |
| 5. Product beta | Findings 28–35, 37 and real-player validation | A representative beta supports the quality gates below; fix observed confusion/failures before widening rollout. |

Some work can proceed concurrently, but the server/schema decisions should precede persistence, identity migration, and statistics fixes. Do not estimate calendar duration before reconciling the native builds and data contract; those are the largest uncertainty drivers.

## Release acceptance matrix

These are proposed gates, not results achieved during this audit.

| Area | Minimum scenarios |
| --- | --- |
| Devices | Small iPhone, current iPhone, supported iPad, low-memory Android, current Android; oldest supported and current OS; release builds. |
| First use | Clean install, permission denial, slow network, no network, guest creation failure, first win, first loss, tutorial dismissal. |
| Persistence | Kill after each guess/hint; kill during save; restart after server commit but lost response; reboot; reinstall; second device. |
| Identity | Link guest to new/existing provider account, cancel login, expired token, sign out/in, account deletion, anonymous-data reset. |
| Game rules | All difficulties, last guess, duplicate guess, short/duplicate/alternate titles, zero/shared/missing actor metadata, depleted hints. |
| Daily boundary | UTC and local rollover, DST, foreground after midnight, travel, changed device clock, absent schedule, old catalog. |
| Security | Cross-user IDs, malformed/oversized payloads, impossible wins, unauthorized rules writes, concurrent/replayed completion, bounded abuse. |
| Accessibility | VoiceOver/TalkBack, largest text, reduced motion, keyboard/switch navigation where supported, light/dark contrast, rotation/split-screen. |
| Platform services | Signed OAuth redirects, reminder delivery with app closed, share cancellation/deep links, real chart rendering, crash/recovery. |
| Content/operations | Failed API/import, partial batch, concurrent scheduler, invalid answer ID, preserved editorial override, rollback, restore, expiring credentials. |

Suggested measurable gates:

- No unresolved P0/P1 findings; no known data-loss, cross-account, or duplicate-credit paths.
- All critical scenarios above pass on both installed release builds, including a clean-install-to-completed-game flow against staging services.
- All challenges in the committed publishing horizon pass schema, catalog compatibility, spoiler, and editorial checks; alerts fire before that horizon expires.
- Zero personal names/email in Analytics captures; deletion works; policy and store data declarations match observed behavior.
- No unassessed high/critical dependency issues; artifact signing, target SDK, privacy manifests, and permissions reviewed.
- A beta observes at least 99.5% crash-free sessions and 99% successful result saves, with enough sessions and clear denominators to make the figures meaningful. Treat these as initial targets, not evidence already obtained.
- Establish measured launch/search budgets on a named lower-end reference device; monitor p95 rather than averages alone.
- Representative testers can finish a first game and explain hints/difficulty without developer help. Record confusion and fairness complaints. Include casual players, film enthusiasts, and assistive-technology users.
- Rollback and backup restore have been rehearsed; a named person receives operational/support alerts.

## Decisions still required

The repository cannot resolve these product/operational choices: launch countries and audience/age range; monetization and content-license needs; daily reset policy; definition of streaks; ranked versus practice difficulty behavior; offline guarantees; supported devices/languages; retention/deletion periods; developer-account status; and the intended launch scale/support owner.

Make these explicit before finalizing scope. A strong first release can remain a focused movie game: reliable daily play, fair hints/scoring, durable progress, useful accessible feedback, and a satisfying result. Extra modes, competitive rankings, streaming discovery, and monetization should follow evidence that this core experience is dependable and worth returning to.
