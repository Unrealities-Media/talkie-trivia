# Local development and playtesting

The browser development workflow runs against loopback Auth, Firestore and
Functions emulators in `demo-talkie-trivia`. It never deploys or writes cloud
data. Demo clues and fake provider identities are development fixtures, not
production content approval or verification of real Google OAuth.

## Start and stop

Install Node 24.21.0 and Java 21+ (JAVA_HOME or PATH). On Windows the launcher also
recognizes Android Studio's bundled Java at its standard installation location.

```sh
npm ci
npm --prefix functions ci
npm --prefix integration ci
npm run dev
```

Open http://localhost:8081. The launcher checks occupied ports, builds Functions
and the catalog, restores its latest export, waits for an actual callable response,
seeds demo challenges, and starts Metro with file watching enabled. The first run
may download the Firestore emulator. No global Firebase CLI or cloud login is needed.

Use `q` then Enter, or Ctrl+C, in that terminal to stop. Metro stops first to
release Windows file watchers. A new snapshot is written under
`.expo/local-dev/exports/`; `latest.json` changes only after successful export.
Previous snapshots remain available. An export failure leaves the backend
running so you can retry `q`; it does not replace the last good snapshot. Avoid
killing the terminal if you want to preserve unsaved local changes.

To recover an older snapshot, stop the launcher and set `latest.json` to
`{"directory":"exports/EXISTING-SNAPSHOT-NAME"}`. Do not point it at a different
project's export. These files are ignored by Git. Deleting browser storage removes
the local account continuity marker and is not a recovery procedure.

The app backend uses Auth 9099, Firestore 8080, Functions 5001, hub 4502, logging
4602 and Firestore websocket 9150. Metro uses 8081. An occupied port causes a
clear failure rather than killing an existing process or selecting a different port.

## Demo days

Run these in another terminal while the backend is running:

| Command | Effect |
| --- | --- |
| `npm run dev:day` | Show the current simulated time and fill missing demo days |
| `npm run dev:day -- next` | Advance one day, preserving time of day |
| `npm run dev:day -- midnight` | Move to 30 seconds before the current day's UTC reset |
| `npm run dev:day -- 2026-11-01` | Set a valid date at noon UTC |
| `npm run dev:day -- reset` | Return to real time |

Reload after changing time. Once loaded, the countdown rolls over automatically.
The offset continues ticking with real elapsed time and survives emulator export.
It affects challenge selection, game action timestamps and countdown responses.
Auth tokens and deletion/merge security deadlines always use real time.

Each command prepares eight days before updating the clock. Existing schedules
and player games are never overwritten; moving back to a played day resumes it.
Use a new date or a separate demo account to replay. Preferences in Profile apply
to the next day's challenge. The eight original demo clues intentionally repeat
for convenient development and are kept in `scripts/demo-movies.cjs`.

The backend clock override requires all of: Functions emulator, exact project
`demo-talkie-trivia`, and loopback Firestore on 8080. The `_development` document
cannot be read or written by app clients under Firestore rules. The destructive
integration suite uses a different project/ports and always uses the real clock.

## Accounts without Google credentials

In browser development, **Sign in to local demo** requests a short fake name such
as `player-one`. It follows the normal guest-link, returning-account, collision,
merge and reauthentication paths with a mocked Google provider credential accepted
only by the Auth emulator. Reuse the same name to reopen the same saved account.
Names use letters, numbers and hyphens. No real email or password is required.

Firebase export/import preserves accounts but invalidates session refresh tokens.
After restarting, sign in again with the same demo name. The prompt remembers the
last name used in that browser. If an unlinked guest is at recovery, **Link and
restore local guest** explicitly links the existing UID to a fake named account
and reopens its games. It checks that the exported account exists and refuses to
overwrite another provider identity. It does not recreate a missing guest.

These tools require a development browser, exact demo project, and a connected
loopback Auth emulator on 9099. They cannot run in preview/production or against a
live SDK instance. Firebase documents the emulator's
[mock provider credential support](https://firebase.google.com/docs/emulator-suite/connect_auth#non-interactive_testing).

For native development use `npm run dev:backend` and launch your development
build separately. Android emulators use `10.0.2.2`; loopback binding intentionally
does not expose the backend to physical phones. Named mock identity prompts are
browser-only. Native OAuth, native reminders, platform share sheets and real-device
acceptance still need separate verification; see [native builds](native-builds.md).

## Account error troubleshooting

“We couldn't load your account. Check your connection and try again.” was reproduced
in Chromium when guest sign-up to `localhost:9099` failed with
`ERR_CONNECTION_REFUSED`: the frontend was running while Auth was stopped.

Use `npm run dev`, wait for backend readiness, then reload or tap Retry. If you
started Metro separately, stop it first so port 8081 is available, or start only
the backend with `npm run dev:backend`. Keep the emulator terminal running.
An account recovery screen after restart is a different case: use the same demo
name or the explicit local guest recovery option above.

## Suggested manual coverage

1. Start as a guest. Make an incorrect guess, observe the next clue, then win.
2. In Profile select Easy; advance the day and reload. Spend all three hints,
   verify the fourth is disabled, then win and inspect the 150-point deduction.
3. Set `midnight`, reload and let the countdown open the next challenge.
4. Cancel Give Up, then confirm it. Verify zero points and a reset win streak.
5. Inspect history and open an earlier result. Change themes and browser width.
6. Link a named demo account, stop/restart, sign in again and check the same scores.
7. Test account collision/merge or deletion using separate named fake accounts.

Focused checks: `npm run test:local-dev`; the app's local-demo identity tests; and
Functions' `gameClock` tests. The broader independent contract suite remains
`npm --prefix integration test`.
