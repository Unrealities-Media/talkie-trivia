# Talkie Trivia

A daily movie guessing game built with React Native, Expo, Firebase and Go.
Players identify a movie from progressively revealed clues. The intended launch
is movie-only, with a worldwide UTC reset, three hints per Easy game, no paid
features, and guest play with optional account sync.

**Release preparation is in progress.** The [40-finding audit](docs/audits/2026-10-13-release-readiness.md)
and [remediation tracker](docs/audits/remediation-status.md) distinguish implemented
changes from missing device, infrastructure, migration and store evidence. No
production migration or deployment has been performed as part of this work.

Start the next work session with the [continuation checklist](docs/CONTINUING.md):
current status, prioritized release gates, open playtest improvements and acceptance criteria.

## Architecture

- `src/app`, `src/components`: Expo Router screens and React Native UI.
- `src/state`: Zustand presentation state; the server owns game outcomes and scores.
- `src/services/gameService.ts`: authenticated commands and durable, account-scoped retry outbox.
- `src/data/searchIndex.json`: released on-device movie search catalog.
- `functions/src`: authenticated, versioned game commands with transactional game,
  statistics and history updates. New games use immutable reviewed schedule content.
- `firestore.rules`: owner reads and restricted profile writes; game/statistics/history
  writes require the backend. Authorization contracts pass local emulator tests;
  deployed rules and indexes still require staging verification.
- `utils/pipeline`: Go source importer, candidate catalog generator and reviewed
  daily publisher. See [the content runbook](docs/content-pipeline.md).
- `content`: editorial publication input and review instructions.
- `integration`: real Auth/Firestore/Functions emulator contract tests and Go
  publication tests. See [the emulator runbook](docs/emulator-testing.md).

Difficulty is fixed when a daily game starts. Profile preferences apply to the
next challenge. A failed network save retains the exact action for retry; confirmed
actions are saved on the server. Cold-start/full offline play is not implemented.
Do not describe the app as supporting offline gameplay just because search is local.
The server supplies the daily UTC reset; the app refreshes on foreground, reconnect,
and expiry. Content failures remain on the Game screen, with retry, while profile
settings and independently loaded statistics/history remain reachable. Automatic
startup notification permission requests are disabled. Reminders use explicit
Profile opt-in; broader native acceptance remains open.

## Local development

Use Node.js 24.21.0 (`.nvmrc`), the Go version in `utils/pipeline/go.mod`, and Java 21.
The emulator CLI is pinned in `integration/package-lock.json`. Android and iOS development also require the corresponding
native SDKs. Native projects are generated from the pinned Expo template and app
config; see [native builds and environments](docs/native-builds.md). Clean iOS,
signed release and device validation remain release gates.
The [dependency security review](docs/dependency-security.md) records remaining
advisories, scoped overrides, the decoder backport, and clean-install evidence.
The native runbook also records unresolved ARM64 RELRO alignment failures.
Local Firebase commands default to a demo project. No live staging alias is
configured; cloud operations must name a separately configured project explicitly.

```sh
npm ci
npm --prefix functions ci
npm --prefix integration ci
npm run dev
```

Open **http://localhost:8081** after the terminal reports that the demo is ready.
This command builds Functions, starts the pinned local backend, seeds eight
playable demo days, restores saved local data, and starts Expo web. It uses only
`demo-talkie-trivia`; no Firebase account or Google credentials are needed.
Type `q` then Enter (or Ctrl+C) to save an emulator snapshot and stop.

Use `.env.example` for the Firebase and OAuth values consumed by `app.config.js`;
never commit API secrets or service-account credentials. Preview and production
must use distinct explicitly configured Firebase projects and OAuth registrations.
The existing development Firebase client connects to local Auth, Firestore and
Functions emulators (Android emulator host `10.0.2.2`, otherwise `localhost`).
For the default local demo project, use `APP_VARIANT=development` and
`FIREBASE_PROJECTID_DEV=demo-talkie-trivia` with emulator-only Firebase config;
do not point development at a live project. The separate integration suite
supplies its own demo configuration automatically.
For physical devices, configure `FIREBASE_EMULATOR_HOST` and trusted LAN routing as
described in the native runbook. Separate live staging still requires setup.

```sh
npm run dev:day -- next       # Another UTC challenge; reload the browser
npm run dev:day -- midnight   # 30 seconds before reset; reload, then watch it roll over
npm run dev:day -- 2026-11-01 # A specific fake day at noon UTC
npm run dev:day -- reset      # Return to real time; existing games are retained
```

Use **Sign in to local demo** in the browser's Profile to link a fake named
account. Reuse that name after an emulator restart. A lost local guest can use
**Link and restore local guest** to preserve its UID and games in a fake account.
See [local development and playtesting](docs/local-development.md) for the full
workflow, native limitations, persistence, and account-error troubleshooting.
`npm run web` alone starts only the frontend; it still needs a running backend.

For real publication, seed a reviewed schedule using the [content pipeline instructions](docs/content-pipeline.md).
The production approval list remains empty. Demo clues are separate and are never
published by the production pipeline.
Legacy games/statistics/history and daily schedules need a verified migration
before deploying the new contract to any existing user population.

Guest-to-new-Google-account linking preserves the guest UID. Returning-account
merging and Apple sign-in remain unfinished release blockers. In-app account
deletion includes confirmation, reauthentication and durable completion receipts;
native verification, the public deletion route and production operations remain
open. See the [account-deletion runbook](docs/account-deletion.md).
Optional remote analytics, performance monitoring and crash/replay collection are
disabled pending privacy disclosures and controls.

## Validation

```sh
npm run typecheck
npm run test:config
npm test -- --ci --runInBand --coverage=false
npm --prefix functions run build
npm --prefix functions test -- --ci --runInBand --coverage=false
cd utils/pipeline
go test ./...
go vet ./...
```

Use `npm run test:watch` during development. Go tests exercise failed HTTP/JSON
responses, editorial gates, UTC planning, catalog checks, gap filling and idempotent
bounded scheduling. App and Functions tests currently mock significant Firebase
behavior. Run `npm --prefix integration ci` then `npm --prefix integration test`
for real Auth/Firestore/Functions and publisher transaction tests; see the
[emulator runbook](docs/emulator-testing.md). Native-device and staging verification
remain separate release requirements.

When updating native dependencies, follow the [Expo SDK upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
and run `npx expo install --check`. Use the SDK-compatible versions together rather
than independently upgrading every package to its latest release.

## Content operations

Run `go run . -fetch -process` from `utils/pipeline` with `TMDB_API_KEY` in the
environment to generate drafts. Source refreshes do not change the released
catalog or published clues. Review content, preview a fixed UTC publication window,
then explicitly apply it to the intended project. All flags, environment setup,
GitHub identity configuration, migration constraints and incident handling are in
the [publishing runbook](docs/content-pipeline.md).
