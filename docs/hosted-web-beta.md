# Hosted web beta

The beta uses Firebase Hosting and a separate live staging Firebase project.
Google linking is included. Native client IDs, Apple sign-in, and Android binary
changes are not prerequisites for this web build. Nothing has been deployed by
the preparation work. Local emulator builds remain the default.

## Inputs needed from the operator

- A separate staging Firebase project ID and its registered Web app configuration:
  API key, app ID and messaging sender ID. These are public client values.
- A Google OAuth **Web application** client ID for that staging project.
- Public operator name for the privacy notice. Support is `tom@unrealities.media`.
- Site origin; the default `https://PROJECT_ID.web.app` needs no custom domain.
- Reviewed movie clues and confirmation of content/image rights. The production
  approval list is still empty. The build does not approve or publish demo clues.
  [Forty movie sets (200 clue drafts)](../content/beta-clue-drafts.md) are ready for review.
- Review the generated privacy notice, particularly provider logs/backups and
  retention, against the actual Firebase configuration. Confirm someone monitors
  the support mailbox and handles ownership-verified deletion requests.

Use `beta.env.example` as the template for ignored `.env.beta`. Do not paste
service-account keys, OAuth client secrets or passwords into chat or the repo.
Use interactive Firebase CLI login and Google Application Default Credentials
on the deployment machine. An existing production project ID can also be set;
the build rejects using it as staging. A production project need not be created
just to test the web beta.

## Configure the staging services

1. Enable billing for Functions and scheduled jobs. Set budget alerts, choose an
   owner for billing/operational alerts, and keep beta distribution small initially.
   Budget alerts are not hard spending caps.
2. Create Firestore in Native mode; use `us-central1` for this backend's existing
   region assumptions. Enable Firebase Authentication's Anonymous and Google
   providers, configure the Google provider support email and authorized domain.
3. Configure the OAuth consent screen. If its publishing status is Testing, add
   every invited tester there. In the Web OAuth client, register the exact origin
   `https://PROJECT_ID.web.app` and redirect URI `https://PROJECT_ID.web.app/`.
   A custom domain must replace both values and be listed in Firebase Auth.
   The app deliberately uses this stable root callback, including from Profile.
4. Install root, Functions and integration dependencies with `npm ci` in each
   directory. The integration package pins the Firebase CLI.
5. Authenticate without embedding credentials:

   ```sh
   node integration/node_modules/firebase-tools/lib/bin/firebase.js login
   ```

6. Deploy backend resources explicitly to staging:

   ```sh
   node integration/node_modules/firebase-tools/lib/bin/firebase.js deploy --project YOUR_STAGING_PROJECT --only firestore,functions
   ```

   This publishes rules/indexes, callables and scheduled cleanup jobs. Wait for
   indexes to finish building. Verify IAM, scheduler execution and deletion retry
   logs. App Check and per-user rate controls are still unfinished: this is an
   invited beta, not approval for an unrestricted public launch. A hidden URL and
   `noindex` do not enforce invitation-only access or prevent API abuse.

## Publish playable content

Follow [content review](../content/README.md) and the
[publication runbook](content-pipeline.md). For a one-week beta, prepare at least
40 distinct approved movie sets (five per day, today plus seven future days), matching the
released catalog. From `utils/pipeline`, with Application Default Credentials and
no emulator environment variables, preview before applying:

```sh
go run . -schedule -live -project YOUR_STAGING_PROJECT -include-today -horizon-days 7
go run . -schedule -live -project YOUR_STAGING_PROJECT -include-today -horizon-days 7 -apply -confirm-project YOUR_STAGING_PROJECT
```

Keep schedule plans private; they contain answers. Assign an operator to refresh
the schedule before it runs out. Do not use local demo seeding on a live project.

## Build and publish the website

```sh
npm run beta:build
npm run beta:deploy -- YOUR_STAGING_PROJECT
```

The build loads `.env.beta`, forces preview/live configuration, exports into
ignored `web-build/`, and generates `/privacy`, `/support`, `/delete-account` and
`robots.txt`. Public information pages are plain HTML and work without login,
JavaScript or the game backend. Profile links to these pages.

The deploy command publishes **Hosting only**. Its predeploy hook compares the
target project and all output files with `.expo/web-beta-build.json`. Missing,
modified or emulator artifacts fail closed. Rebuild after any config, content
catalog, policy or frontend changes. Do not edit generated output by hand.

Hosting rewrites app routes to `index.html`, serves real policy pages first and
disables stale HTML caching. Beta pages request search-engine exclusion. This is
not access control. No production project alias is changed by these scripts.

## Required live acceptance before inviting testers

- Load `/`, `/game`, `/profile`, `/privacy`, `/support` and `/delete-account`
  directly and reload them. Inspect the network for unintended emulator calls.
- Verify all five difficulties offer different answers. Switch away from a partial
  game and back; its guesses and hints must resume. Complete all five and verify
  five history entries, one streak day and one All Five day.
- As a guest, save a guess, close/reopen the browser and resume. Complete a game,
  verify statistics, and test a failed save/reconnect without duplicate credit.
- Link a new Google account and verify UID/progress continuity. Cancel the Google
  popup and verify no account switch. Test Chrome and Safari, including mobile.
- On another browser, sign in to that existing Google account. The collision
  confirmation must appear before switching. Cancel preserves the guest; confirm
  opens the saved account. Guest games are not merged and the unlinked guest can
  become inaccessible. Never claim account merging is available in the beta.
- Delete disposable guest and Google test accounts, including Google
  reauthentication, pending cleanup, reload and confirmed completion. Verify
  cleanup and scheduler execution server-side, not just the UI.
- Verify two-account access isolation against deployed rules, daily rollover,
  missing-content recovery, and the support email/deletion request process.

The current unit tests and export do not establish any of these live results.
Store release gates remain in [the release tracker](audits/remediation-status.md).

## Preparation evidence (October 14, 2026)

- TypeScript checking passed. Ten environment/deployment guard tests and 66
  focused Google identity, account transition, context and Profile tests passed.
- Full web export succeeded with dummy public staging configuration. Its deploy
  receipt was removed so this fixture cannot accidentally be published.
- Firebase Hosting emulator HTTP checks passed for all seven routes above,
  including cache/security headers. Regex matching avoids a reproduced Windows
  glob normalization problem in the installed Hosting emulator.
- Firebase CLI access to `talkie-trivia-beta` is verified. Its default Hosting
  site is `https://talkie-trivia-beta.web.app`; Firestore is Standard/Native in
  `us-central1`, and billing is enabled.
- Anonymous and Google Authentication are enabled. The Google client ID matches
  the supplied web client and the Hosting domain is authorized. OAuth consent
  audience and the client's redirect URI still require live sign-in validation.
- The Cloud Functions API is currently disabled. Backend deployment must enable
  the required APIs; no backend has been deployed by this preparation work.
- Backend compilation and a web export using the actual staging configuration
  succeeded. The artifact hash and target-project deployment guard passed.
  The generated pages identify Unrealities Media and `tom@unrealities.media`.
- No deployment was performed. Content approval/publication, policy review,
  deployed authorization and end-to-end acceptance remain outstanding.

After generating a beta build, repeat the hosting check with:

```sh
node integration/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only hosting --project demo-talkie-trivia "node scripts/web-beta-smoke.cjs"
```

## Five daily challenges — beta implementation evidence

Each difficulty now opens its own daily movie and saved progress. The publisher
assigns five distinct answers per day and enforces the existing 90-day repeat
cooldown across difficulties. There are 40 draft movie sets (200 clues), enough
for today plus seven future days once reviewed. The live approval pool remains
empty; draft generation does not constitute editorial approval.

Validation completed October 14, 2026: TypeScript checking, 158 backend unit
tests, 124 Firebase emulator integration tests, Go publisher unit/emulator tests,
and frontend tests (692 tests across the full run and targeted reruns after
updating obsolete expectations). New checks cover independent games, replay-safe
completion credit, All Five days, pending-save switching restrictions and
distinct history identities. Seven local-seed/deployment-guard tests passed.
The staging web export and its target/artifact verification succeeded.

This remains an undeployed build. Content approval and publication, live Google
sign-in and the live acceptance checks above are still required.
