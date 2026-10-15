# CI, testing, architecture and security audit

Audited October 15, 2026 against the current working tree and GitHub API.
The initial checkout contained substantial pre-existing uncommitted app/backend
work. This audit preserved it. The user subsequently selected a combined app/CI
snapshot, now published as draft PR #1. See the rollout checkpoint for current
remote enforcement and validation; initial findings below record the baseline.

## Assessment

Latest verification at `181af99`: all Linux jobs, both CodeQL analyses and the
findings gate, plus iOS simulator release passed. The history scanner scanned
881 commits and failed on four findings. Publication-summary disclosure tests
passed remotely. Android compiled successfully in 33m 3s after the memory fix;
ZIP alignment passed, but all 28 ELF inspections rejected the tool output.
The verifier resolved the readelf executable alias and relied on its default
format. Running the old flags with the real NDK readobj tool reproduced the
zero-LOAD-row output locally. The correction explicitly selects GNU program
headers and adds a real-NDK contract for both tool names; all six local verifier
tests and actionlint pass. Packaged ELF alignment awaits remote verification.

Rollout update: main protection and repository secret/dependency security
features are now enabled. The PR is blocked as expected while required checks
are pending/failing. This is not yet proof of a deliberately failing non-draft
PR enforcement test. Historical credentials remain unresolved and the app is
not release-ready.

Remote validation at `5af35f5`: Linux unit/coverage, browser gameplay, Firebase
emulator contracts and Go checks passed. Both CodeQL language analyses and the
CodeQL findings gate passed. Frontend: 111 suites / 712 tests, coverage
89.09% statements / 81.21% branches / 88.58% functions / 92.71% lines.
Backend: seven suites / 158 tests, with the baseline coverage reported below.
This supersedes the initial local split-run frontend evidence. The iOS simulator
release build passed. Android reached the 75-minute timeout in
[native run 38746089828](https://github.com/Unrealities-Media/talkie-trivia/actions/runs/38746089828).
The log reports JVM metaspace exhaustion at 512 MiB, then React Native lint and
AsyncStorage Java compilation tasks failed; no compiler error details were
emitted before the eventual cancellation. Packaged alignment was not reached.
The next candidate raises CI heap/metaspace limits, limits Gradle concurrency,
exits on JVM exhaustion, and retains the build log after an earlier shell timeout.
This addresses the observed resource warning; a rerun must establish whether
separate lint/compiler failures remain. No Android pass is claimed.
The remote full-history scan completed across 878 commits
and failed on exactly four credential matches; remediation remains required.

The initial delivery controls allowed updates without passing checks, and the
initial remote unit run never reached tests. Branch protection and the passing
Linux run above supersede those baseline observations. Native verification and
credential remediation remain CI rollout gates; backend abuse prevention remains
an app-release finding.

## Initial findings, ordered by priority

| ID | Priority | Evidence and consequence | Status / acceptance |
| --- | --- | --- | --- |
| CI-01 | High | GitHub branch protection API returns `Branch not protected`; repository rulesets are `[]`. A failing build does not prevent a main update. | Open. Publish these changes, prove the checks run, then require them on main, including administrators. Require PRs, prohibit force pushes/deletion, and require resolved conversations. |
| CI-02 | High | Latest unit run failed at Functions `npm ci`: missing/inconsistent `@emnapi` optional packages. App install succeeded. Both test and emulator jobs were blocked. | Existing working-tree Functions lockfile repair passes a Linux/x64 dry run for all three package scopes. A real clean Linux CI run remains required; a dry run does not run install scripts. |
| CI-03 | High | Latest Android job failed before tests/alignment: SDK CMake 3.30.5 absent, required by `vendor/fbjni/build.gradle:25`. | Workflow now explicitly installs CMake, the plugin's NDK, and build tools. Remote ARM64 build/alignment rerun required. Do not remove the alignment gate to obtain green CI. |
| SEC-01 | High | `functions/src/index.ts:20` has public invocation and bounded instances but no App Check enforcement or per-user rate policy. Authenticated anonymous callers can create traffic and storage costs. | Open before unrestricted public access. Register web/native attestation, test valid/invalid/missing tokens, add per-user abuse controls and operational alerts. Authentication and maxInstances do not establish those controls. |
| SEC-02 | High for competitive play | `startGame` returns `answerId`, full answer title and hints in the saved game. Owner-readable Firestore games expose the same data. Server scoring prevents forged scores but does not conceal the answer. | Open. Return a sanitized active-game DTO and restrict readable saved state; reveal answers only after completion. Do not claim cheat-resistant leaderboards. |
| SEC-03 | High | Current npm audits: app/tooling 52 high + 5 moderate; emulator tooling 3 high; Functions dev tools 20 moderate. Underlying advisories are braces, node-forge and sprintf-js. | Open. Full reports now become CI artifacts; production Functions audit is enforced and currently clean. Full tooling reports are visibility, not a clean-dependency gate or accepted risk exception. |
| TEST-01 | Medium | Coverage was collected without thresholds; Functions implicitly counted only loaded modules. All-source Functions unit coverage is 44.02% lines / 35.80% branches. Deletion/merge workers have especially low unit coverage. | Added explicit all-source collection and baseline floors. Increase focused fault-path coverage; emulator tests exercise lifecycle behavior but their coverage is not merged into this number. Floors prevent regression, not proof of sufficient coverage. |
| TEST-02 | Medium | CI omitted `local-demo.test.cjs`, had no web export gate, and ran only main/master pushes and PRs. | Local changes add all `scripts/*.test.cjs`, a demo-config web build, all branch pushes, merge queue events, manual runs, and bounded timeouts. Native builds remain main/PR/merge-queue checks to contain cost. |
| CI-04 | Medium | Third-party Actions used mutable tags; Codecov v3 made required tests depend on a secret and an external reporting service. | All Actions pinned to API-resolved commit SHAs, checkout credentials disabled, Dependabot configured, coverage enforced by Jest and uploaded as artifacts. Removed external Codecov upload from the test gate. |
| SEC-04 | Medium | No repository CodeQL workflow or scheduled dependency inventory existed. Go vulnerability reachability was not checked in CI. | Added CodeQL JS/TS and manual-build Go analysis, weekly dependency reports, and govulncheck. CodeQL execution still requires GitHub validation. Configure code-scanning merge protection separately: a successful upload alone does not reject all findings. |
| ARCH-01 | Medium | Client and Functions duplicate game/difficulty contracts. UI/state/service direction was conventional rather than checked. | Added AST checks for literal imports/reexports/require/dynamic imports across server/client and UI/service boundaries. Existing integration tests remain the authority for wire contracts. Guard does not resolve arbitrary aliases or computed imports and is not a security sandbox. Consider a small versioned shared contract package without server implementation code. |
| TEST-03 | Medium | Browser scenarios live in ignored `.expo` scripts; no reproducible browser E2E job. Native keyboard, screen reader, provider auth, reminders and release signing are not established by Jest or web builds. | Desktop/mobile emulator browser contracts now pass for start, guess, hint purchase, reload, results/share feedback and history. Isolation regressions pass. Provider recovery and release-device acceptance remain open. |
| CI-05 | Medium | Functions `.eslintrc.js` references dependencies/config absent from its package scripts; there is no active JS/TS lint gate. | Implemented locally: root flat ESLint, TypeScript correctness and React hooks checks; findings fixed without mass suppression. Lint and affected tests pass; remote rollout remains open. |
| ARCH-02 | Low | Root `go.mod`/`go.sum` have no tracked Go source outside the nested pipeline module. Root Go commands encounter the unrelated JS/native `vendor` directory and inconsistent vendoring. | Open cleanup. Keep commands scoped to `utils/pipeline`; remove the obsolete root module after confirming no external consumer. |
| SEC-05 | Medium | No CI secret-history scanner was found. Tracked filename checks found no `.env`, PEM/private-key, service-account or credentials files, but filenames are not a content/history scan. | Full-history scanner implemented; 16 matches classified into 12 checksum false positives and four credential-pattern matches. Credential remediation and repository settings remain open; see details below. |

## Fresh verification

Used the repository's local Node 24 runtime, Go toolchain and Java installation.
Default shell Node is 25 and Go/Java are not on PATH; running default shell
commands would not reproduce the pinned CI environment.

| Check | Result |
| --- | --- |
| App TypeScript | Pass |
| Frontend Jest | Initial full run: 110 suites passed, one stale button outline expectation failed; 710/711 tests passed. Corrected expectation to the current accessible accent color; affected suite then passed 7/7. All 711 tests therefore covered across full run plus targeted rerun, one snapshot. No second full run claimed. |
| App coverage | 88.98% statements, 81.03% branches, 88.55% functions, 92.59% lines; floors 88/80/88/92 respectively |
| Functions build and Jest | Pass, 7 suites / 158 tests; fixed ts-jest config to resolve its own `<rootDir>/tsconfig.json` when invoked from the repository root |
| Functions coverage | 39.90% statements, 35.80% branches, 39.45% functions, 44.02% lines; floors 39/35/39/44 respectively |
| Node script contracts | 41 passed, including three new architecture guard regressions |
| Integration dependency compatibility | 4 passed |
| Auth/Firestore/Functions emulator contracts | 124 tests in 12 suites passed, plus Go emulator publication contracts; rebuilt Functions before testing |
| Go tests, vet, formatting | Pass; no gofmt changes needed |
| Go vulnerability scan | No reachable vulnerabilities; one required-module vulnerability outside imported packages reported, not a fully clean module inventory |
| Production Functions npm audit | Zero vulnerabilities |
| Full npm audits | Findings listed above; JSON evidence in ignored `.expo/ci-audit-{app,functions,integration}.json` |
| All three npm lockfiles | Linux/x64 `npm ci --dry-run --ignore-scripts --no-audit` passed; no installed dependency replacement |
| Expo web export | Pass with demo configuration, no deployment; index bundle about 5.9 MB uncompressed, worth a separate startup-performance budget |
| Architecture check | Pass |
| Workflow validation | actionlint v1.7.12 passed; local shellcheck/pyflakes unavailable and disabled. CI actionlint uses available runner tools. YAML parse passed. |
| Whitespace | `git diff --check` passes |

Sandbox loopback/temporary-file restrictions initially blocked Go/emulator tests;
the same commands passed with authorized local execution outside the sandbox.
The backend contract suite uses emulator project `demo-talkie-trivia-test`.
A subsequent browser suite initially reused cached preview configuration and
created two disposable anonymous accounts in the live beta. Both browser tests
failed. Trace evidence identifies the accounts as newly created by these tests;
cleanup remains pending explicit authorization after automatic approval review
rejected live account deletion. No cleanup is claimed.
The browser runner now clears Metro's cache, validates the embedded artifact's
project/variant/emulator configuration before launch, blocks service workers and
WebSockets, and restricts HTTP requests to the dedicated local app/emulators
(plus TMDB image requests). Both isolation regression tests pass, and the
artifact validator rejected the stale live-beta bundle. Fresh desktop and mobile
browser runs then passed (4 scenarios): confirmation/cancel, keyboard search,
saved-game reload, give-up, win, share feedback, archive and profile. A dedicated
CI browser job now runs the isolation regressions and those scenarios. Hint purchase, remaining-hint count, revealed director and wrong-guess state
also survive reload. Real provider recovery and device share-sheet acceptance
remain outside those scenarios. Scheduler delivery is not exercised merely by loading
scheduled Functions; worker contracts and deployed scheduling remain distinct.
App coverage retains the existing exclusions for styles, models, config and
index modules; its percentages describe that configured scope, not every file.

## Architecture and security strengths

- Game actions, revisions, score calculation, completion and history updates are
  transactional server responsibilities. Client retries retain stable action IDs.
- Firestore defaults deny, authorizes owner reads, forbids authoritative client
  writes, limits archive queries, and blocks accounts under deletion/merge locks.
- Real emulator tests include cross-account denial, forged writes, action replay,
  account deletion, merge authorization, session recovery and publisher safety.
- Environment configuration separates demo, preview and production and rejects
  ambiguous live/emulator settings. Content publication requires explicit project
  selection and reviewed immutable schedule input.
- Publishing uses scoped OIDC, environment names and serialized runs.
  GitHub has no configured environments, so approval protection is not established.

## Rollout and required checks

The audit findings are recorded; the CI rollout is not yet fully verified.
The combined application and CI snapshot is published, and main protection is
enabled. Credential remediation remains outstanding. On October 15 the owner
requested web-beta-only automatic CI: native builds are manual-only, removed
from required checks, and run `38763190055` was cancelled on request. The native
workflow is disabled remotely until its manual-only definition reaches main;
native release verification remains deferred, not declared passed.

Main now requires these observed check names:

- `Run Tests & Coverage`
- `Check Go Pipeline`
- `Firebase rules and transaction contracts`
- `CodeQL (javascript-typescript)` and `CodeQL (go)`
- `CodeQL` (findings gate)
- `Dependency security inventory`
- `Browser gameplay contracts`
- `Secret history scan` (currently has unresolved historical findings)

Require PRs and up-to-date checks, prevent bypass/force pushes, and verify a
deliberately failing PR cannot merge. Confirm fork PRs do not require secrets.
Do not enable an unreachable required context. Restore native release gates
when native development resumes. A security inventory job can pass while known tooling advisories remain;
resolve them before claiming a clean security assessment.

Next stages: finish remote CI verification and credential remediation; extend browser
coverage for account recovery; fix public abuse controls and answer exposure; resolve
dependency/native release findings. These are follow-up implementation stages,
not findings silently declared fixed by this audit.

## Subsequent local hardening and new findings

- SEC-06: the content-publishing workflow uploaded the full schedule plan,
  including future movie IDs and clues, under a supposedly private report name.
  This repository is public; artifact names do not restrict readers. The local
  fix uploads only a validated summary of dates and slot counts, with two
  disclosure-boundary tests and passing actionlint. It is published and its
  regression tests passed remotely at `181af99`; no live publication was run.
  Inspection of all 18 repository artifacts listed during the audit
  artifacts found no schedule report; expired/deleted historical exposure is
  not ruled out. Staging/production environments and repository variables are
  still absent, so no approval policy or configured publisher is established.
  [GitHub documents artifact read access](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts).

- Root flat ESLint is implemented and wired into unit CI, including TypeScript
  and React hook rules. Findings were repaired without mass suppression; lint
  and typecheck passed. Affected frontend suites passed 183 tests, with a further
  clue-replacement regression suite passing 8 tests. Backend build and all 158
  tests passed again. Remote Linux validation at `5af35f5` subsequently passed,
  including lint, closing CI-05's implementation and execution checks.
- Gitleaks v8.30.1 scanned 876 commits (about 277 MB) and returned 16 matches.
  These include Sentry organization-token patterns in historical Android/iOS
  `sentry.properties` and JWT/bearer-token patterns in the historical movie
  fetching script. All 12 generic matches were verified against historical
  source as checksums (nine Go module sums, two CocoaPods sums, one vendored
  file SHA256). `.gitleaksignore` lists only their exact commit/file/rule/line
  fingerprints. Four credential-pattern matches remain, not necessarily four
  distinct credentials. The owner confirms no remediation has been performed;
  validity/revocation remains unverified. Do not print
  values, test credentials against providers, or suppress findings simply to
  make CI green. Revoke/rotate affected credentials and document resolution.
  A pinned, full-history, redacted CI scanner is now configured and will fail
  while unresolved matches remain. SEC-05 is an active finding, not a clean scan.
  A second complete 876-commit scan verified the exceptions: exactly four
  credential matches remain and the scanner exits nonzero. Linux/x64 lockfile
  dry runs passed again after ESLint/Playwright installation; actual Linux CI
  installation and execution subsequently passed at `5af35f5`.
- Initial GitHub API inspection found secret scanning, push protection and Dependabot
  security updates disabled; CodeQL default setup unconfigured; no repository
  environments configured. Workflow environment names alone do not establish
  approval policies. Secret scanning, push protection and dependency security
  updates are now enabled; environments remain unconfigured.

See [the rollout checkpoint](../ci-rollout.md) for the concrete change scope,
publication decision and remote acceptance requirements.

### References

- [Latest unit workflow failure](https://github.com/Unrealities-Media/talkie-trivia/actions/runs/38568816929).
- [Latest native workflow](https://github.com/Unrealities-Media/talkie-trivia/actions/runs/38568817148): Android failed; iOS simulator release job **passed**. This supersedes older notes that no remote iOS build had passed, but does not prove signing/device acceptance.
- [GitHub secure workflow guidance](https://docs.github.com/en/actions/reference/security/secure-use) supports immutable action pinning.
- [Firebase callable guidance](https://firebase.google.com/docs/functions/callable) recommends App Check before launch.
- [CodeQL build modes](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/manage-your-configuration/codeql-for-compiled-languages) require a build for Go; this workflow uses a manual pipeline build.
