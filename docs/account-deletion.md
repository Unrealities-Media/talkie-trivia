# Account deletion

## Current state

The backend and in-app flow are implemented with unit/component and real emulator
checks. Profile > Settings offers deletion for guests and linked Google accounts. This is
not release approval: real-provider validation, ownership-verified support recovery,
cross-device recovery and deployed scheduler/monitoring remain release gates.
The public deletion instructions are published, as verified by the
[hosted-page audit](audits/2026-10-15-hosted-public-pages.md); that does not establish
support mailbox delivery or successful handling of a real deletion request.
Native provider/device acceptance is deferred during the web-beta stage.
Nothing in this work has deleted a real account or been deployed.

## Server contract

`prepareAccountDeletion({})` obtains a cryptographically random 256-bit receipt
secret for the authenticated UID without deleting data or blocking gameplay.
Preparation reuses one unexpired receipt per UID. The client must persist it before
calling `deleteAccount({ confirmation: "DELETE", secret })`, which accepts a request for
the caller's UID only. Unknown fields (including a target UID) are rejected. A
linked account must have authenticated within five minutes. A failed freshness
check returns `failed-precondition` with `details.reason` equal to
`reauthentication-required`. Anonymous accounts do not have a provider with which
to reauthenticate and can delete their own account directly. All new requests reject
malformed authentication times and sessions older than Auth's revocation time.

The server commits `accountDeletions/{uid}` before any cleanup. Firestore rules
deny owner reads and profile writes while that document exists. All three game
callables read this barrier in their transactions, including saved-result reads.
An action racing deletion either commits before the barrier and is subsequently
removed or is rejected; it cannot recreate a game after cleanup.

Cleanup disables Firebase Auth, recursively deletes `players/{uid}` (including
all subcollections), deletes legacy `playerStats/{uid}` and matching legacy
`playerGames`, then removes Firebase Auth. Legacy games are matched by `playerID`
and by the exact historical `{uid}-YYYY-MM-DD` document key to include incomplete
old records. A shared UID prefix does not authorize deleting another account.
Collection queries are paged. Content catalogs and published schedules are shared
game content and are retained.

Preparation and acceptance reject active account-merge locks, including a receipt
prepared before the lock. For a completed merge, recursive profile cleanup also
erases imported games and `mergedGuestGames` archives. Before declaring deletion
complete, the worker removes every completed/cancelled `accountMerges` record
pointing to this destination, in pages of twenty, and any cancelled source job
owned by this UID. Pending/inconsistent merge records stop deletion for retry or
review instead of being silently discarded. Failed provenance cleanup is not
reported as completed deletion. Retired guest security tombstones have no target
or job identifiers; they retain their independent 24-hour anti-replay window.
The merge lifecycle and its tombstone purge handler are currently internal and
not exposed/scheduled; see [merge implementation and gates](account-merging.md).

The response is `{ accepted: true, complete: boolean }`. `accepted` means a durable
request exists; it does **not** mean cleanup has completed. Only `complete: true`
may be shown as completion. Duplicate requests do not create duplicate work;
retrying an accepted request does not require fresh authentication again. A
temporary ten-minute lease bounds competing workers and survives process failure.
Failures leave the barrier and queued request intact, including failures after
partial data removal or Auth deletion.

If another worker takes the lease before finalization, the earlier worker returns
incomplete unless the durable job is already complete. Finishing its local cleanup
steps alone cannot produce a completion response: the job and status receipt must
be finalized transactionally. The emulator regression injects a replacement lease
after Auth removal, verifies pending status, then expires that lease and verifies
successful idempotent recovery with the real Auth/Firestore emulators.

`retryAccountDeletions` runs every five minutes in UTC. It retries up to twenty
eligible jobs per invocation, with failures moved behind other eligible work by
their lease. It purges up to one hundred expired completion records. A completed
record retains only the UID in its document path, status, attempt count and timing
metadata for 24 hours, then becomes eligible for purge. That barrier outlasts the
one-hour Firebase ID-token lifetime after refresh/sign-in has been disabled.
Pending requests never expire automatically: dropping one would abandon deletion.
Runtime logs emit a generic retry event without account identifiers or raw errors.

The scheduled worker is limited to one instance with concurrency one. Scheduler
retries are disabled; the next five-minute invocation resumes durable pending
jobs. Transactional leases remain necessary for interrupted executions and manual
requests racing the worker.

After Firebase CLI login and installing the integration dependencies, run
`npm run beta:operations` for read-only checks against `talkie-trivia-beta`.
The report checks the current Hosting release, scheduler configuration/recent
attempt, worker limits, pending-job count, and completion/receipt cleanup overdue
by at least an hour. A failed check or unavailable API exits nonzero. Pagination
is followed with a finite limit; incomplete inventories and malformed aggregation
results cannot silently count as healthy. Output contains counts and service
metadata, not player identifiers, receipt secrets or account data.

This manual command does not send alerts, install a schedule, prove scheduler
delivery, or replace end-to-end deletion testing. Pending count alone is
informational because an accepted deletion may legitimately still be running.

`accountDeletionReceipts/{uid}` separately holds a secret and deletion status.
Unused preparations expire after 24 hours. Accepting deletion atomically marks the
receipt pending and removes its expiry; completion marks it complete and eligible
for removal after 30 days. The scheduler purges expired receipts in bounded batches.
This limited UID/secret/status retention is disclosed in the confirmation dialog.
Never include receipt secrets in logs, analytics, URLs or support screenshots.

`getAccountDeletionStatus({ uid, secret })` does not require Auth. It returns only
`prepared`, `pending`, `complete` or `unknown`; wrong secrets and missing/expired
receipts return the same unknown status. The secret cannot authorize deletion or
read account data. Both collections deny all client Firestore access. The client
uses an HTTP status request without an Auth header so a deleted user's failed
token refresh cannot prevent recovery. Status-call abuse limits still require
staging/App Check/rate-control work alongside the other public app endpoints.

## Client behavior and remaining verification

The Profile control explains irreversible loss and supports cancellation before
confirmation. Linked Google users reauthenticate the current Firebase user, never
sign into a different user or link another credential. Cancellation, mismatched
accounts and stale provider replies prevent the new deletion request. Guests do
not need a provider prompt.

Native clients persist receipts in Expo SecureStore; web uses local AsyncStorage.
Accepted deletion also removes the matching UID's local account-continuity marker
(`account-session-v1`) without clearing an unrelated account's marker. A failure
to remove it leaves local cleanup unfinished and keeps the deletion receipt for
retry. See [account continuity](account-sessions.md).
Storage failure stops submission. Once a receipt exists, auth recovery clears
visible gameplay, blocks new commands and pending replay, and does not silently
create a replacement guest. The server's transaction barrier handles any already
in-flight commands. After acceptance, local outbox removal is serialized with
existing commands, reminders/visible notifications are cancelled, and the old
account is signed out. Local cleanup failures retain the receipt and expose Retry.
An unrelated account is never signed out by a stale deletion response.

The UI distinguishes delivery not confirmed, accepted pending cleanup, complete,
and unknown/expired receipts. It checks pending status on foreground and at most
once every 30 seconds while active, with a manual check available. A timeout does
not clear intent or imply success. After confirmed completion, starting as a new
guest requires an explicit choice and successful local cleanup first. Receipt
expiry does not overwrite completion already acknowledged on this device.

Still verify native Google reauthentication, SecureStore failures/restores,
notification cancellation, force-kill/restart and network loss on actual devices.
Finish Apple-provider support and cross-device recovery when another device has
no receipt. Publish a usable recovery route for an expired/lost receipt instead
of assuming unknown means deleted. Uninstalling clears some local data and may
lose the receipt; a public, ownership-verified deletion/recovery route remains
required. The current provider flow still shares the audit's native OAuth gate.

## Deployment and operations gates

Deploy the account barrier rules and all game endpoints together with deletion
and its scheduled retry function into the separate staging project first. Verify
the runtime service account can manage Auth users and delete Firestore data, and
that Cloud Scheduler invokes the retry function successfully. Do not deploy only
the callable: that could strand failed requests or leave old writers active.

Configure alerts for `account_deletion_retry_required`, scheduler failures and the
age of pending jobs; verify notifications reach the operator. Set and publish the
actual completion/retention commitments based on tested operations. Account for
backups, historical analytics/crash data, and provider token revocation (including
Apple when implemented); current optional telemetry being disabled does not prove
historical copies have been erased. Never restore deleted identities from a backup
without reapplying deletion records. Validate the current and historical storage
inventory against the deployed project before making a complete-erasure claim.

Publish an authenticated or otherwise ownership-verified web deletion request
flow at the actual operator domain. Populate store listings with that URL and the
real policy/contact information. Do not substitute a placeholder link or require
email support as the normal in-app deletion route.

## Evidence and limits

`npm --prefix integration test` exercises the production callable through HTTP,
real Auth deletion and real Firestore rules/transactions. Fault-injection checks
call the same worker against the emulator while replacing one Auth or Firestore
operation with a deliberate failure. Retry-worker tests directly invoke `retry()`;
the suite does not prove Cloud Scheduler delivery or production IAM.

Sources: [Apple account-deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/),
[Google Play account-deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111),
[Firebase session lifetimes](https://firebase.google.com/docs/auth/admin/manage-sessions),
and [Firestore deletion semantics](https://firebase.google.com/docs/firestore/manage-data/delete-data).
