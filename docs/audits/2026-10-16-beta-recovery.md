# Web beta deletion and recovery checks

Recorded October 16, 2026 (UTC), against `talkie-trivia-beta`.
These checks supplement the live web audit; they do not establish public-release readiness.

## Approved guest deletion

The owner explicitly approved deleting the dedicated anonymous release-test guest,
fingerprint `992f0c8aa5919f1f`. Before the UI action, the browser session was checked
against that fingerprint and confirmed anonymous. No other account was selected.

At 02:03:36 UTC, administrator reads verified:

- Firebase Authentication account absent.
- All nine games, four history entries and the private statistics document removed.
- Player document and legacy statistics absent; both legacy game queries returned zero.
- Deletion job and deletion receipt marked `complete`.

At 02:03:58 UTC, the browser displayed the completion screen after reload and offered
an explicit **Start again as a new guest** action. Reload made no anonymous signup
request and produced no page errors. The initial UI verifier stopped after deletion
because two elements matched the completion text; a separate read-only completion
check finished verification without repeating deletion. At 02:06:47 UTC, the
settled profile screen exposed exactly one completion heading and one restart
button to Playwright's accessibility-role queries; the duplicate heading was not
present in that settled screen.

This covers this anonymous guest's successful live deletion. Google reauthentication,
interrupted deletion and outage recovery remain separate acceptance cases. Minimal
completion records remain subject to their documented retention policy.

## Whole-database protection

At 01:58:55 UTC, Firestore database delete protection was enabled and read back as
`DELETE_PROTECTION_ENABLED`. Only `deleteProtectionState` was patched. Account and
document deletion continue to work, as demonstrated above.

The preceding recovery inventory found no backup schedules or backups, and point-in-time
recovery disabled. Database delete protection does not replace those capabilities.
No paid backup storage or restore operation was enabled by these checks.

## Hosting artifact rollback rehearsal

At 02:05:08 UTC, the previously deployed PR21 Hosting version
`sites/talkie-trivia-beta/versions/1be6ba63a7257d73` was verified on temporary channel
`rollback-rehearsal-20261016`. The source version was `FINALIZED`; the preview's
release referenced that same immutable version.

Seven routes returned HTTP 200 and HTML: `/`, `/play`, `/profile`, `/stats`,
`/privacy`, `/support`, and `/delete-account`. All three scripts referenced by the
root HTML existed in the version's file manifest, returned HTTP 200 with JavaScript
content types, and did not return HTML fallback content. This is not a byte-for-byte
verification of all files or a browser gameplay acceptance test.

The live release was identical before and after:
`sites/talkie-trivia-beta/channels/live/releases/1792115408238000`, using PR22 version
`f54b59e68626fad4`. No live rollback, app build, native build, function deployment,
database mutation or new player session was needed for this rehearsal.

The preview expires at **2026-10-16 03:04:46 UTC**. Do not rely on its URL as a
permanent artifact.

To repeat the procedure:

1. Read the live channel and record its release/version identifiers.
2. Select a known compatible prior version and confirm its status is `FINALIZED`.
3. Create a uniquely named preview channel with a short TTL, persisting the returned
   channel name immediately so an interrupted check can resume without duplication.
4. Use the Hosting channel release API with that version's name. Assert the target
   channel is the preview, then read back the resulting version identity.
5. Check the relevant routes and referenced assets on the preview URL.
6. Read the live channel again and confirm its release has not changed.

Firebase documents [channel expiration](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels)
and [releasing an existing version to a channel](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/sites.channels.releases/create).
An actual incident rollback also requires confirming compatibility with current
functions and stored data. This rehearsal does not verify backend rollback or
database restore.

## Local evidence

Ignored operator evidence: `.expo/live-beta/deletion-before.json`,
`.expo/live-beta/deletion-after.json`, `.expo/live-beta/deletion-ui.json`,
`.expo/beta-delete-protection.json`, `.expo/beta-recovery-inventory.json`, and
`.expo/hosting-rollback-rehearsal.json`. Credentials and full account identifiers
are not included here.

Remaining operational gates include backup/restore, alert delivery, real Google
account lifecycle checks, broader browser/device acceptance, abuse protection,
support delivery and content/rights review. Hosting preview recovery and successful
guest deletion do not close those gates.
