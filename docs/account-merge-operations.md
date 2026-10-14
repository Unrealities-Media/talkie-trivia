# Account merge recovery operations

This is the implementation and staging acceptance runbook for finding 15.
Nothing is deployed. Live merge creation remains disabled in `beginAccountMerge`.
The scheduled handler can recover already accepted jobs without an open app;
Administrative reconciliation is implemented locally; operator/staging and
native/provider acceptance still block rollout.

## Delivery and bounds

`retryAccountMerges` is a second-generation scheduled function, every five minutes
in UTC. It has one instance, concurrency one, 256 MiB memory and a 540-second
timeout. Scheduler-level retry count is zero: durable job checkpoints and the
next scheduled delivery own retries. Foreground recovery remains available.
No job is created, consent granted or review error cleared by the scheduler.

Each invocation checks up to 100 expired retired-account markers and 100 expired
cancellation records, then selects the 20 oldest due merge jobs. Each selected
job receives at most eight lifecycle steps; validation/copy steps handle at most
20 game/history records. A ten-minute per-job lease coordinates scheduled and
foreground workers. Duplicate delivery still needs transaction/lease protection
despite the instance limit. After a process dies, its checkpoint survives and a
later delivery may claim the expired lease.

A monotonic eight-minute soft budget prevents starting another step or cleanup
transaction once the budget is reached. It cannot interrupt an in-flight SDK
request or recursive source-data cleanup. A hard timeout can still occur; the
lease/checkpoint and idempotent identity cleanup support subsequent recovery.
The elapsed-time clock is independent of the wall clock used for stored expiry.

Transient errors retry after at least a minute. A validation/lock/schema failure
requires review, retains the accounts and removes the job from the automatic due
queue. Failures before lease acquisition follow the same rule. Queue repair is
conditional on the exact observed document update time, so it cannot overwrite
a concurrent claim or a newly confirmed operation. Stale due markers on complete,
cancelled or review jobs are removed without processing them.

Retention checks re-read each record transactionally. Only minimal expired
retired markers and valid, zero-copy cancelled jobs can be deleted. Invalid
expiry markers are removed while preserving the lock/job and adding
`retentionError: "merge-retention-review-required"`. This prevents an invalid
first page from blocking later legitimate cleanup. Retention runs before merges
so a busy merge queue cannot indefinitely postpone it. The 24-hour marker window
is a minimum; actual removal depends on scheduler delivery and bounded backlog.
Completed merge provenance remains until the destination account is deleted.

## Staging acceptance before rollout

1. Use the separate staging Firebase project, reviewed rules/indexes, synthetic
   accounts and reviewed deployment credentials. Deploy the compatible client,
   callables and scheduler together. Keep live creation disabled until all gates
   in [the merge contract](account-merging.md) are met; changing the scheduler
   does not authorize enabling creation.
2. Confirm the generated Scheduler job targets `retryAccountMerges`, uses UTC and
   the configured cadence, and invokes with the intended service identity.
   Verify the function is not anonymously invocable. Review the runtime identity's
   Auth/Firestore permissions and its separation from the Scheduler invoker;
   do not grant broad project roles to resolve a failed invocation.
3. Confirm deployed single-field indexes for `accountMerges.nextAttemptAt`,
   `accountMerges.purgeAt` and `accountMergeLocks.purgeAt`. Emulator success does
   not establish production index/IAM behavior.
4. Accept a synthetic operation through the authorized staging path, close all
   clients and observe actual scheduled delivery to completion. Verify source
   retirement, destination lock removal, exact imported/conflict counts and the
   preserved archive. Do not simulate acceptance by writing live account jobs.
5. Exercise a 45-game fixture over multiple scheduled deliveries, a transient
   failure, a worker terminated after a checkpoint, simultaneous foreground
   recovery, and duplicate delivery. Require one official credit per imported
   completed game and no destination access before finalization.
6. Exercise missing/inconsistent locks and a provider-change race. Require a
   review state with both profiles retained. Confirm the scheduler never clears
   review or enables a disabled identity by itself.
7. Verify the retired-token barrier throughout its retention window. Test expired
   marker cleanup, invalid-marker quarantine and destination-account deletion's
   removal of archives and completed/cancelled provenance.
8. Record deployed revision, project, job/function identities, IAM review, timing,
   redacted operation evidence, monitoring destinations and rollback owner in the
   release evidence. None of these deployed acceptance results exists yet.

## Monitoring and incident handling

Configure alerts before enabling creation; these are required checks, not an
assertion that cloud alerts already exist:

| Signal | Required response |
| --- | --- |
| Scheduler delivery or function failure | Check invocation identity, target, IAM, function logs, quota and index errors. Preserve accepted jobs. |
| `account_merge_retry_required` repeatedly, or old due work after three cadence intervals | Inspect the job queue through authorized administrative access and establish whether delivery, transport or backlog is responsible. |
| `account_merge_review_required` | Inspect `accountMerges` with `error == "merge-review-required"`; compare the durable phase, counters, locks, current Auth identities and deletion barriers before any recovery. |
| `account_merge_retry_budget_reached` repeatedly | Measure backlog and actual step duration before changing limits. Ensure the lease remains longer than the hard invocation timeout. |
| `account_merge_retention_review_required` | Inspect both collections for `retentionError == "merge-retention-review-required"`. Preserve active locks/jobs; resolve their invalid expiry metadata through reviewed reconciliation. |

Logs contain generic event names, not tokens, email, account IDs or raw provider
errors. Use access-controlled administrative evidence for investigation. Do not
place account records or credentials in issue bodies or general-purpose logs.

For an incident, keep creation disabled. Pausing Scheduler does not stop a worker
already running or an authenticated foreground recovery call. Wait for actual
invocations to end and inspect leases before a reviewed repair. Never clear a
lock, mark a job complete, delete source data or re-enable Auth simply to dismiss
the player's recovery screen. Source freezing/copying is not automatically
reversible. Before freezing, the owner's normal cancellation endpoint may be
used if its lease and copy guards allow it. After freezing, preserve the records
for reviewed administrative reconciliation. The tool below supports only bounded
retry and cancellation before copying; it cannot reverse a partial import.

## Administrative reconciliation

`scripts/reconcile-account-merge.cjs` loads the compiled administrative library,
not a client callable. Build Functions first. Run only with the intended operator
credentials and an explicitly selected project. Auth and Firestore must share
the same explicitly configured Admin app/project. IAM authorizes the operator;
the plan digest detects stale state and is not an authentication credential.

The two actions are `retry` and `cancel-before-copy`. Retry queues the existing
operation for the ordinary worker, which rechecks identity and data before
copying. A queued result does not mean the merge completed. Cancellation requires
zero imported/conflicting records, no source-origin copies, both matching locks,
and a valid pre-copy checkpoint. Neither action changes Auth, games or statistics.
There is no force-complete, partial rollback or automatic identity restoration.

For an isolated emulator session, use the existing integration runner's demo
environment (`TALKIE_EMULATOR_TEST=1`, Auth `127.0.0.1:9199`, Firestore
`127.0.0.1:8180`). Replace uppercase placeholders before running these examples;
use a new ignored plan filename for each inspection:

```powershell
rtk proxy node scripts/reconcile-account-merge.cjs inspect --project demo-talkie-trivia-test --emulator --source SOURCE_UID --operation OPERATION_ID --action cancel-before-copy --out .expo/merge-plan-UNIQUE.json
rtk proxy node scripts/reconcile-account-merge.cjs apply --project demo-talkie-trivia-test --emulator --plan .expo/merge-plan-UNIQUE.json --confirm-project demo-talkie-trivia-test --confirm-digest PLAN_DIGEST --reference INCIDENT_REFERENCE
```

Live mode requires `--live`, the exact live project in both project arguments,
and no emulator configuration. No live execution or deployed operator IAM
acceptance has been performed. Follow the staging gates before production use.
See Firebase's [Admin setup](https://firebase.google.com/docs/admin/setup) for
credential configuration and [user management](https://firebase.google.com/docs/auth/admin/manage-users)
for privileged Auth inspection/update behavior.

Inspect is read-only and writes a new plan exclusively, without overwriting an
old approval. Review its summary and require an empty `blockers` list. Plans expire
after ten minutes and bind the current Auth state and relevant Firestore versions.
Apply rechecks expiry, exact project/digest, operation, locks, deletion barriers,
lease and retention guards transactionally for Firestore. Any relevant change
requires a new inspection. Auth and Firestore have no shared transaction: quiesce
workers and other administrative changes during review/apply. After an ambiguous
response, inspect authoritative state; do not assume failure or replay an old plan.

Plans include account UIDs. Keep them in ignored, access-controlled storage and
out of tickets, source control and general logs; enforce filesystem ACLs on
Windows. The incident reference must contain no personal data. Reconciliation
metadata lives on the operation, not a separate permanent identity log: cancelled
jobs have 24-hour retention and successful merge finalization replaces the pending
metadata. Retain necessary redacted approvals in the incident system under its
retention policy.

For a provider linked during the disable race:

1. Inspect `cancel-before-copy`. A disabled source must block cancellation.
   Preserve both profiles and investigate why the identity is disabled.
2. Quiesce workers/admin mutations and verify whether a separate restriction
   exists. Only an authorized operator with evidence permitting restoration may
   restore that linked identity using the approved Auth administration workflow.
   This tool never re-enables it. Unknown disable causes remain under review.
3. Inspect again after restoration; the old plan is stale. Require no blockers,
   then apply with the exact fresh digest, project and incident reference.
4. Verify the same operation is cancelled, both locks are released, game/stat data
   is unchanged and no credit was added. Verify fresh provider sign-in and client
   recovery on the affected native platforms before closing the incident.

Missing locks, deletion barriers, partial copies, malformed games and
`retentionError` require an evidence-specific reviewed repair or migration. The
tool deliberately does not clear those conditions. A frozen anonymous source
cannot be cancelled by this workflow; use reviewed retry when its guards permit.

## Local evidence

Administrative reconciliation adds 12 real Auth/Firestore lifecycle cases,
including the actual inspect/apply CLI, stale Auth/Firestore plans, exact project
guards, leases, deletion/retention guards and existing imported/archive records.
The lifecycle provider-link race also proves cancellation remains blocked while
disabled and succeeds only with a fresh plan after separate synthetic Admin
restoration. One invocation passes all 38 reconciliation/lifecycle/scheduler
cases. Four CLI input tests pass; the final shared-project guard compiles and
passes all 12 reconciliation cases again. These do not prove live operator IAM,
real provider restoration, native recovery or arbitrary corruption repair.

`integration/tests/merge-retry.test.mjs` invokes the actual exported scheduled
handler against isolated demo Auth/Firestore emulators. It checks endpoint
metadata, background completion, bounded multi-page work, overlapping calls,
expired leases, pre-claim backoff, stale queue-repair races, review isolation,
the monotonic budget and retention-queue starvation. Synthetic fixtures are
retained; each test defers only its own intentionally unfinished jobs rather
than resetting the emulator database.

The standard integration runner discovers this test automatically. These are
direct handler/SDK tests, not proof of Cloud Scheduler delivery, production
signatures, IAM, hard process termination or device behavior.

References: Firebase's [scheduled functions](https://firebase.google.com/docs/functions/schedule-functions)
explains deployment and overlapping invocations; the
[schedule options](https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.scheduler.scheduleoptions)
define retry and timezone configuration. Installed SDK endpoint metadata is
asserted in the integration test.
