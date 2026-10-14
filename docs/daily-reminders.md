# Daily reminders

Finding 18 now has an opt-in implementation, local contract tests and bounded
Android emulator delivery evidence. Physical Android devices, iOS and the full
release acceptance matrix remain open.

## Player contract

Profile > Settings offers a daily reminder, off by default, at a chosen device-local
time using a labeled 24-hour input. Only pressing Enable/Save can request system
permission. Launch and foreground refresh never prompt. Guest and linked accounts
can use the preference; it belongs to this installation, survives sign-out and
does not sync to another device. Account initialization/deletion suspends controls
and automatic reconciliation. Account deletion persists off before clearing native
notifications so the reminder cannot be recreated by the next foreground refresh.

The notification is a neutral invitation to play or see today's result. It carries
no UID, token, answer, score or stale streak. It repeats even if the player already
played. Its local reminder time is separate from the worldwide 00:00 UTC puzzle
reset. There is no remote push token registration or server reminder database.
Web displays availability information without initializing notification APIs.

The UI describes delivery as "around" the chosen time. Device settings, battery
restrictions and notification summaries may delay/suppress it. Reopening remains
a recovery suggestion if the time looks wrong after travel or clock changes.
Android now repairs stored schedules on system timezone/clock broadcasts without
opening the UI. The closed-process emulator checks below pass; DST boundaries,
physical-device restrictions and iOS behavior still need acceptance evidence.

## Scheduling and recovery

`src/services/reminderService.ts` serializes preference writes, reconciliation and
cancellation. Versioned AsyncStorage intent is saved before changing the OS
schedule. One stable identifier replaces the previous reminder without cancelling
it first. A lost response or process restart retries that same identity instead
of creating another reminder. Off is also a durable intent: failed cancellation
reports an error and retries on foreground/Retry. The previously chosen time is
retained when switched off. Corrupt preferences never enable a schedule; explicit
off can replace the invalid record. Storage/native failures never claim success.

Only the owned reminder and exact recognized legacy daily-reminder messages are
cancelled by ordinary reconciliation. Other notifications are preserved. Account
deletion additionally clears all app notifications through its existing cleanup.
This flow never uses `cancelAllScheduledNotificationsAsync` when changing time.

The actual installed Expo daily-trigger parser receives an explicit `DAILY` type,
hour and minute. Android creates a silent, non-vibrating reminder channel before
permission requests and checks that the channel is not blocked. iOS provisional
authorization permits quiet delivery. A denied/revoked permission cancels pending
reminders while preserving opt-in/time; the UI offers device settings. A later
grant reconciles on foreground without another permission prompt. A settings-link
failure has manual recovery instructions. Native settings remain authoritative.

The installed Android scheduler uses an inexact alarm fallback when exact-alarm
access is unavailable. This feature adds no exact-alarm permission request. Its
boot receiver reschedules stored requests; the app refreshes schedules on launch
and foreground. Those source observations are not evidence of real device delivery.
Foreground notifications are silent and enter the list without an interrupting
banner. Notification taps currently open the app through normal OS behavior;
no arbitrary URL from notification data is followed.

## Local evidence

One focused run passes 55 tests across reminder service (26), settings (8),
lifecycle hook (3), deletion service (8), root recovery (5) and Profile (5).
App TypeScript passes. The tests use the installed Expo parser/JS scheduler with
only its native bridge mocked. They reproduce the previous invalid trigger and
verify typed daily conversion, boundary times, platform permissions/channels,
revocation, denied permission without repeated prompts, durable intent, ambiguous
responses, failed replacements/cancellation, restart, serialized enable/off,
corrupt storage, web isolation, duplicate UI actions and deletion failure handling.
The first UI run had two partial-string assertions that needed regex matchers;
the corrected complete focused run passes. None of these tests executes AlarmManager
or UNUserNotificationCenter.

## Installed Android evidence

On 2026-10-13, the API 36 x86_64, 16 KB `talkie-16k-audit` emulator ran the
demo-only signed release APK against the isolated Firebase emulators. No live
backend, store certificate or real player was used. Evidence is retained locally
under `.expo/device-proof/r30-reminders/` (ignored generated files).

- Reminders started off. Explicit Enable opened the Android permission prompt;
  denial produced a blocked state. Granting permission through device settings
  restored scheduling on foreground without another prompt.
- Saving 18:18 in America/Chicago produced one pending app alarm. After Home and
  ordinary process termination (not force-stop), one silent notification was
  observed at 18:19:14, about 74 seconds after the selected minute. The next alarm
  was scheduled for the following day at 18:18. This is inexact delivery evidence,
  not a punctuality guarantee.
- The shade showed the neutral movie-puzzle invitation. Tapping it opened Game.
  Reboot restored the next-day 18:18 alarm before the app was reopened.
- Changing to America/Los_Angeles while the process was closed retained the old
  absolute alarm, now at 16:18 local time. Reopening reconciled to the saved 18:18
  local time. America/Chicago was restored after the test.
- Turning off through the UI removed the pending alarm. Off survived a subsequent
  force-stop and cold launch. Normal-size controls were readable; this run does
  not establish screen-reader or large-text acceptance.

The final tested APK is
`.expo/device-proof/r30-reminders-final/talkie-demo-emulator-only.apk`, SHA-256
`75c29666a9eb5a7a7f0267c4769d138d48adee60b4e7a7d49cad97458e6c7598`.
The build completed in 57 seconds; v2/v3 signatures and 16 KB ZIP alignment passed.
All 56 native libraries are byte-identical to the preceding checked artifact:
the existing 19 RELRO failures remain unresolved. An earlier intermediate APK
was replaced before reminder testing and is not delivery evidence.

The tested settings link opened Android app info, with Notifications one level
deeper. Source copy now says "Open device settings"; all eight settings component
tests pass after that wording correction. The native artifact predates only this
wording change.

Account recovery failed independently during this run: the preserved session
displayed the generic account-loading error, including after notification open.
The likely cause is merge-status discovery rejecting a session invalidated by
Auth emulator import; the exact response/token cause is not yet proven. Navigation
and reminder controls remained usable, and no replacement guest was created.
The subsequent [cached-session recovery follow-up](account-sessions.md#cached-token-rejection-follow-up-2026-10-13)
fixes the reproduced rejection loop with app/server and real callable tests, plus
bounded Android revocation/restart evidence. This reminder run itself is not
successful account acceptance.

## Closed-process clock repair follow-up (2026-10-13)

Android CNG applies a version- and source-hash-guarded patch to
`expo-notifications` 57.0.22. The existing non-exported native receiver now handles
`TIME_SET` and `TIMEZONE_CHANGED`, rebuilding stored schedules using the current
local timezone. Native dispatch is serialized so clock repair and cancellation
cannot concurrently restore a stale request. No additional permission, JavaScript
startup or server operation is required. Five build-guard tests verify repeat
generation, version/source drift, line endings and refusal to use prebuilt modules.

The initial patched build still failed the timezone check: Expo selected its
prebuilt notification AAR and omitted both source changes. `package.json` now
requires Android `buildFromSource: ["expo-notifications"]`; prebuild refuses to
patch without that setting. The corrected Gradle log proves Kotlin compilation,
and the merged/installed manifests contain both clock actions. This follows
[Expo's source-build configuration](https://docs.expo.dev/modules/autolinking/).
Android lists these system events among its
[manifest broadcast exceptions](https://developer.android.com/develop/background-work/background-tasks/broadcasts/broadcast-exceptions).

The same API 36 x86_64/16 KB emulator, with the app process verified absent before
each system event, retained exactly one 18:18 local reminder through Chicago,
Los Angeles, Kolkata and back to Chicago. Dates changed correctly across both the
local midnight and whether today's chosen minute had passed. Moving the emulator
clock back to 18:05 moved the next request from tomorrow to today at 18:18. Restoring
the real clock crossed that due time and produced one alarm wakeup; this does not
establish suppression of already-due notifications during forward clock jumps.
Turning off removed the alarm; further closed-process timezone events left zero
pending alarms. After a subsequent process restart, Profile displayed off with
the chosen 18:18 retained. Original timezone and automatic-time settings restored.

Evidence: `.expo/device-proof/r30-clock-change/` contains native dumps, event
timestamps, UI captures and eight saved-evidence assertions. The corrected APK is
`.expo/device-proof/r30-clock-change-final/talkie-demo-emulator-only.apk`, SHA-256
`79f33b70122ff5d4a6c5a070b4fcfd3a35f7e1f81f7e37b2d290df2c2a6530cd`.
The Android build completed in 54 seconds; v2/v3 signing and 16 KB ZIP checks pass.
All 56 native shared libraries match the preceding session-recovery artifact;
the 19 known RELRO failures remain. No live backend or real accounts were used.

An additional native failure remains open: after the clock tests, reopening and
switching to Profile followed by a swipe produced a persistent blank screen.
`blank-screen-logcat.txt` records Fabric `MissingViewState` followed by
`addViewAt: failed to insert view [40] into parent [44] at index 1` and React host
destruction. Process restart recovered Game and Profile, and the reminder remained
off. Cause and reliable reproduction are unproven; this run cannot establish
navigation stability. Track under findings 05/26, independently of native alarm
repair. DST gaps/overlaps, iOS, physical-device delivery and accessibility also
remain open; the clock patch does not complete finding 18.

The subsequent [tab mount investigation](audits/android-tab-mount.md) identifies
the missing views as hidden default tab icons. The replacement text-only bar
removes that subtree and passes bounded native restart/navigation and large-text
checks; broader navigation stability acceptance remains open.

## Native release gates

The observations above cover only part of this matrix. Use synthetic accounts
and installed release builds for each platform; record
revision, OS/device, permission state, chosen time, timezone and observed delivery.

1. Fresh install: no startup permission prompt, no queued reminders, usable guest
   play. Enable after playing; verify the request follows the tap and chosen time.
2. Inspect the actual native scheduled request and Android channel. Change time
   repeatedly, force-close/reopen and retry an interrupted update; require one
   repeating reminder at the saved time, not duplicates or an immediate alert.
3. Confirm delivery with the app backgrounded and closed, and after reboot where
   supported. Check OS battery-saving/summary behavior and document actual delays.
   Distinguish a user force-stop (OS restrictions) from ordinary process death.
4. Deny permission, deny further requests, block only the Android channel, revoke
   permission and restore it through Settings. Verify clear status and cancellation;
   foreground recovery must never request permission without a new player action.
5. Cross UTC midnight, DST and timezone changes with the app open and closed.
   Confirm the chosen local time after reopening and that copy never implies a
   puzzle reset at that time. Resolve any misleading closed-app behavior before
   claiming seamless time-zone support.
6. Turn off while an update is in flight, terminate/reopen, and delete the account.
   Verify native pending/delivered notifications are cleared and never recreated
   by foreground recovery. Other settings and gameplay must remain usable after
   notification failures.
7. Tap cold/warm notifications and confirm useful navigation and account/game
   recovery. Verify silent foreground/list behavior and no personal data in content.
8. Test keyboard entry, small screens, both themes, 200% text, TalkBack and VoiceOver.
   Confirm labeled input, readable live status/errors, focus order, disabled state
   and minimum 48-point button/input targets in the installed UI.

Reference: Expo's [notification API](https://docs.expo.dev/versions/latest/sdk/notifications/)
documents scheduling, permissions and Android channels. Installed SDK source and
the parser tests bind this implementation to the version in the lockfile; current
web documentation alone is not a native compatibility test.
