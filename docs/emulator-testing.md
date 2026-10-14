# Firebase contract verification

For an interactive browser app with persistent demo accounts, playable fixtures
and simulated days, use `npm run dev` and the [local development guide](local-development.md).
The suite below is separate, disposable contract verification.

This suite runs the **compiled production Functions entry point**, checked-in
Firestore rules, Firebase Auth emulator and Go publisher against real local
emulators. No Jest mocks replace Firebase in these tests. It is separate from the
fast unit/component suites.

## Run

Install Node 24.21.0 (pinned in `.nvmrc` and CI), Java 21 and the Go version declared in `utils/pipeline/go.mod`.
Ensure `node`, `java` and `go` are on PATH. From the repository root:

```sh
npm --prefix functions ci
npm --prefix integration ci
npm --prefix integration test
```

The runner rebuilds Functions and its packaged catalog before testing and rejects
other Node major versions. Firebase CLI, rules-test SDK and
Firebase client SDK are pinned in `integration/package-lock.json`. The CLI
downloads the official Firestore emulator on first use and caches it under the
ignored `.expo/firebase-emulators` directory. On Windows, setting `JAVA_HOME`
alone is insufficient: add its `bin` directory to PATH too.

The test configuration is `firebase.integration.json`, with loopback-only Auth
9199, Firestore 8180, Functions 5101, hub 4501 and logging 4601. The project is
always `demo-talkie-trivia-test`, independent of `.firebaserc`. Stop another
process using these ports before running; do not redirect tests to shared data.
The runner shuts the emulators down when tests finish. It does not import/export
emulator state, deploy, or require Firebase credentials.

Before any SDK initialization/reset, tests assert the exact demo project and
loopback emulator environment. They clear the disposable Firestore database
between Node tests. The Go tests require the same guard and use synthetic future
dates. All review metadata and accounts are test fixtures, not real editorial
approvals or user accounts. Failed setup is a test failure, not a skip.

## What is exercised

For installed development-app checks, `firebase.device.json` uses the app's
standard Auth 9099, Firestore 8080 and Functions 5001 ports. It binds each
service to loopback, disables the emulator UI and uses separate hub/logging
ports 4502/4602. Build Functions first, then run the pinned integration CLI:

```sh
npm --prefix functions run build
node integration/node_modules/firebase-tools/lib/bin/firebase.js emulators:start --project demo-talkie-trivia --config firebase.device.json --only auth,firestore,functions
```

Use only the development app identity and synthetic content. The Android
emulator reaches the host through `10.0.2.2`; a physical phone cannot reach these
loopback listeners directly. Do not run the destructive contract-test runner
against this session. Stop the device backend when testing ends; there is no
automatic import/export or production access. This configuration is a testing
aid, not evidence that native gameplay has passed.

The automated contract suite above exercises:

- Owner and guest reads, linked-provider rule context, bounded profile writes,
  cross-account/unauthenticated denial, blocked direct state writes, denied
  schedule/legacy/admin access, and the actual ordered history query.
- Missing/malformed auth, spoofed ownership, incompatible catalogs and forged
  legacy results through callable HTTP requests.
- Actual Firestore transaction contention: six simultaneous starts, eight
  identical winning commands, conflicting commands at one revision, replay,
  exactly one statistics credit and completion history entry.
- Missing-content atomicity, the three-hint allowance, terminal give-up, and
  isolated account paths.
- Guest credential linking and returning sign-in through the Auth emulator,
  preserving the owned game's UID and saved progress. This uses email credentials
  to verify the identity/storage contract; it does not implement or validate a
  production email login UI, native Google/Apple OAuth, or account merging.
- Go publication contention, immutable reruns after upstream edits, no writes
  during preview, no partial writes when the pool is insufficient, and deliberate
  rejection of incompatible existing schedule documents.
- Owner-only account deletion, recent/revoked-session validation, concurrent
  requests and gameplay, multi-page current/legacy cleanup, retained unrelated
  accounts, stale-token/read/write barriers, partial Firestore/Auth failures,
  retry leases and expiry of completed records. Status receipts survive Auth
  deletion; tests verify secret isolation, preparation without deletion, rejection
  of unauthenticated deletion, and receipt expiration. Fault tests call the production
  worker with a deliberately failing operation. The retry worker is invoked
  directly; Cloud Scheduler delivery and production IAM are not emulated.

## Limits and CI

The `Firebase rules and transaction contracts` CI job runs the same command on
Node 24/Java 21 with Go. It receives no deployment credentials. GitHub must run
the workflow before its remote result can be claimed; local success alone does
not establish that branch protection requires it. Failure logs are retained for
three days. These contain disposable fixture requests; never seed real users or
copy production exports into this suite.

The Auth emulator accepts unsigned/mock tokens, and its malformed-token behavior
differs from production. The suite verifies the callable's UID guard and ownership
contract, not production signature verification. Emulator success does not prove
production IAM, deployed rules, App Check, quotas, composite index readiness,
network fault recovery on devices, native OAuth, or installed release behavior.
Those remain separate release gates.

Functions also targets Node 24. The Firebase 13 test SDK requires Node 24.12 or
later; running these tests successfully on Node 22 does not establish supported
compatibility. The runner checks this requirement before building or starting
emulators. Node 24 is supported by the pinned CLI for second-generation Functions;
the runtime change still needs staged deployment verification.

Integration tooling overrides grpc-js to 1.14.6 and re2 to 1.27.0, plus scoped
basic-ftp 6.2.3 (get-uri), uuid 11.1.1 (gaxios), and OpenTelemetry core 2.8.0
(Pub/Sub). These are local/CI development dependencies. Run
`npm --prefix integration run test:dependencies` for their consumer contracts;
CI runs them before the emulator suite. The latest audit reports three high
parent-package findings, all tracing to braces. See the
[dependency review](dependency-security.md) for compatibility evidence and
remaining work. Do not run `npm audit fix --force` to accept incompatible SDK
downgrades. App and Functions lockfiles require their own audits.

The root `.firebaserc` now defaults to `demo-talkie-trivia`. A separate live staging
project must be configured explicitly; do not recreate the former staging alias
that pointed at production. All cloud deployment/publication instructions must
name the intended project and pass their environment/review gates.

Official references: [Firestore emulator connection and demo projects](https://firebase.google.com/docs/emulator-suite/connect_firestore),
[rules testing](https://firebase.google.com/docs/rules/unit-tests), and
[Functions emulator setup and limitations](https://firebase.google.com/docs/emulator-suite/connect_functions).
