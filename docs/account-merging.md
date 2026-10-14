# Guest progress and existing profiles

## Implemented policy, version 1

Finding 15 requires a deterministic merge when a guest's chosen credential
already belongs to another account. Linking a new credential in place remains
the first choice. An existing-profile collision leaves the guest signed in while
emulator builds offer explicit merge confirmation. Live creation remains disabled
until the remaining operational and native acceptance gates below pass.

`functions/src/accountMergePolicy.ts` implements the game/statistics policy for
bounded pages of server-owned V2 game records:

| Situation | Result |
| --- | --- |
| Saved profile has no game for that UTC day | Copy the guest game under the saved profile's UID, preserving its difficulty, content snapshot, guesses, hints, revision and action IDs. |
| Saved profile already has that day | Keep its game unchanged. Preserve the guest game in a separate archive, attributed to the destination owner. Do not add its score, win, hint usage or streak credit to official statistics. |
| Same guest game was already imported | Skip it without writes or extra credit, even if the destination has since continued playing. |
| Source revision changed after import | Stop for reconciliation; do not silently discard later guest moves. |
| Invalid/incompatible record, ownership, stats or incomplete destination lookup | Stop before producing writes. Never silently replace stored statistics with zero. |

The existing profile wins every same-day conflict, regardless of difficulty,
progress or score. This avoids selecting the better of two daily outcomes. The
guest copy remains separate and read-only; merging guesses together would not
represent a game played under the original rules.

Only imported, completed games add completion/win/score credit. Imported Easy
games add their actual hint spending, including unfinished games. Medium's
automatically revealed clues do not count as spending. Calendar dates determine
combined streaks, using the same implementation as normal gameplay. The shared
`gameHistory` builder produces the same immutable history shape for both paths.
Local theme/difficulty/reminder preferences are not profile statistics and are
not changed by this policy.

Plans are deterministic across input order and contain at most 20 source games.
The pure planner does not read or write Firestore, authenticate either account,
delete a guest, mint credentials, or switch the app's current user. It is not a
safe standalone account-merge endpoint.

## Implemented authorization and reservations

`accountMergeAuthorization` accepts only the verified callable caller's guest
identity, explicit `MERGE` confirmation, a client-generated operation ID and a
destination Firebase ID token. Reconfirmation after cancellation also carries
the previous operation ID, preventing old requests from replacing newer work.
It checks current Auth records, source anonymity, distinct UIDs, disabled and
revoked sessions, current Google/Apple provider identity and destination
authentication within five minutes. Tenant identities and malformed/extra
request fields fail closed. Errors do not expose credentials or raw Auth errors.
The helper is used by the rollout-gated callable; native Google/Apple provider
acceptance remains separate from emulator authorization tests.

`accountMergeReservation` creates `accountMerges/{sourceUid}` and locks for both
accounts in one Firestore transaction. It rejects deletion barriers and competing
operations. A retry of the same valid reservation preserves its cursor/counters;
missing or inconsistent locks require review rather than being silently repaired.
The job contains identifiers, a per-confirmation operation ID, policy/status,
counters/cursor and timestamps, never either account's ID token. Pending
reservations do not expire automatically; the lifecycle handles cancellation,
completion and release.

All three gameplay transactions and deletion preparation/acceptance check these
locks. Firestore owner reads and profile writes are also blocked during a merge,
so a partially imported profile cannot be exposed through those access paths.
Auth verification happens before the Firestore transaction; these are not one
atomic Auth/Firestore operation. The lifecycle below checks identity changes
between verification, reservation, copying and cleanup.

## Implemented resumable storage worker

`processAccountMergePage` is an internal storage operation with six durable
phases: source games, source history, destination games, destination history,
copy, and copied. Each invocation handles at most 20 records in one transaction.
Concurrent invocations read the same job checkpoint and use Firestore transaction
retry behavior; no process-local cursor or lock determines what gets credited.

Before any destination data changes, the game passes rebuild statistics from
each account's complete V2 game collection and compare the result with its stored
summary. They verify document ownership/keys and exact completion histories.
Reverse history passes reject orphan histories. Missing/inconsistent statistics,
incompatible games and legacy progress stop processing for review; migration is
still required. Legacy UID-prefix detection is conservative: an ambiguous prefix
also requires migration review rather than risking an incomplete old record.

The copy phase reads source/destination games, both histories, archive locations,
destination statistics, both locks and the job in the transaction. It creates
imports/histories or conflict archives under
`players/{targetUid}/mergedGuestGames/{sourceUid}_{gameId}`, then commits statistics,
counts and cursor together. A stored expected statistics snapshot detects a
summary being changed or removed between pages. Archives/imports unexpectedly
ahead of the cursor cause review; no existing archive is overwritten. Exhaustion
must account for the complete validated source-game count.

`copied` is deliberately not a completed merge. The job remains pending, both
accounts remain locked, and no Auth identity or source data is removed. Repeating
the copied state performs no writes. The internal worker neither proves account
ownership nor schedules itself; the lifecycle below surrounds it. Ordinary client
changes are prevented by the locks; live
administrative migrations must not edit reserved data concurrently.

## Implemented identity lifecycle and recovery service

`accountMergeLifecycle` provides internal begin/status/cancel/resume/process/retry
operations. Callable wrappers now expose begin/status/cancel/resume, while begin
rejects live creation outside `FUNCTIONS_EMULATOR=true`. `retryAccountMerges` now
wires the retry worker to a five-minute UTC schedule. Status and
recovery require a currently valid, non-revoked Firebase session belonging to
either recorded account. Missing/unrelated operations return the same `none`
result. A signed-in destination can discover its active operation from its lock,
including after losing local state. Mutations identify both the source job ID
and its unique operation ID; old cancellation requests cannot affect a new merge
accepted after cancellation.

Only the destination can request foreground resume; the scheduled worker also
processes accepted jobs without an open client. A ten-minute lease prevents overlapping
identity cleanup; an expired lease can be reclaimed. Resume/retry performs at most
eight bounded steps per operation, and retry selects at most twenty due operations.
Temporary failures keep durable progress and use a retry delay. Inconsistent
data/identity requires review and stops automatic processing. Logs contain only
generic retry/review events. The retry implementation also purges expired retired
and cancelled markers. An eight-minute monotonic budget bounds new work before
the nine-minute scheduled timeout. Pre-claim failures and invalid expiry markers
are moved out of the due queue without losing data or overwriting concurrent
claims. Real scheduler delivery/IAM/monitoring remain unconfigured. See the
[operations runbook](account-merge-operations.md) for exact bounds and staging gates.

Validation runs while the guest identity is still active and both game accounts
are locked. Before copying, the service records disabling intent, disables the
guest, rechecks that it still has no linked identity, and revokes refresh tokens.
Each processing step rechecks source/destination Auth state. After the final copy,
it verifies the saved statistics and counts before recording retirement intent,
deleting guest Auth, recursively removing the guest profile/subcollections, and
removing unused guest deletion receipts. Only after cleanup does one transaction
mark the merge complete and release the destination lock.

The original guest lock becomes a security tombstone containing only `role` and
`purgeAt`, with the old UID in its document key. It remains for 24 hours to block
already-issued tokens. Completed jobs retain only source/destination IDs, operation
ID, policy/status, counts and completion time; source games/statistics/checkpoints
are removed. Deleting the destination removes its imports, archives and all
completed/cancelled merge provenance in bounded pages. Tombstones have no target
or job link and retain their independent security expiry.

Before disabling/copying begins, either current owner may cancel when no active
worker holds the lease. Both game profiles remain unchanged and both locks are
removed. A cancelled record expires after 24 hours, and a new confirmation may
replace it immediately with a new operation ID and the previous confirmation ID.
Repeating a cancelled begin returns cancellation rather than creating new work.
The original authenticated source can also withdraw a not-yet-accepted request:
the transaction records a cancelled operation without touching the destination,
so an in-flight begin observes the same barrier. If begin won the race, ordinary
lease/copy cancellation checks apply. Cancellation after retirement
starts is rejected; recovery must finish the accepted merge.

Auth and Firestore still have no shared transaction. A provider linked immediately
before the disable call can leave that newly linked identity disabled. The
post-disable check detects it, preserves all progress and stops without deleting
the identity or importing games. It deliberately does not blindly re-enable an
account that may also have an administrative restriction. The administrative
reconciliation tool now supports reviewed retry or guarded pre-copy cancellation.
It cannot restore Auth or reverse partial copies. The
[operations runbook](account-merge-operations.md#administrative-reconciliation)
requires separate investigation/restoration and a fresh cancellation plan for
this race. Operator/staging and production identity verification remain required
before enabling this flow. Admin migrations must not mutate reserved profiles in place.

## Implemented client confirmation and recovery

In emulator builds, a Google credential collision opens the destination in a
separate named Firebase app using `inMemoryPersistence`. The primary guest stays
signed in. Game/Profile show the import/conflict policy and guest retirement
before the player confirms. Declining disposes temporary Auth and reloads the
guest without a merge request or local progress deletion.

Confirmation flushes pending moves, checks existing operations, and persists
only source/destination IDs, confirmation IDs and progress counts before sending
begin. Provider/Firebase tokens and email never enter this receipt. A missing,
late, malformed or unrelated response cannot clear the gate. Gameplay, ordinary
sign-in/sign-out, deletion and automatic replacement guests are blocked while
recovery is pending. A storage read failure fails closed rather than creating a
guest. On reinstall/another device, current-account lock discovery restores an
accepted operation before loading the profile (currently emulator builds only).

Recovery verifies the same destination when temporary Auth has been lost or
revoked, then uses that session for status and bounded resume calls, including
after the guest was disabled/deleted. Foreground processing retries every 15
seconds while a verified destination remains in memory. The scheduled export
supports background recovery; actual cloud delivery is not yet verified. Review
states preserve the receipt and expose a recovery reference.
Cancellation always needs a server-confirmed cancelled result, including an
ambiguous initial request; a local receipt alone cannot assert cancellation.

After confirmed completion the screen shows imported/conflicting counts. The
player explicitly opens the saved account. The service rechecks the server,
copies the verified destination user into primary Auth, persists its continuity
marker, clears the source outbox, and removes the receipt last. Cleanup failures
retain the gate and retry safely. Firebase documents this user-copy behavior in
[updateCurrentUser](https://firebase.google.com/docs/reference/js/auth.auth#authupdatecurrentuser);
the callable emulator contract verifies it with the installed SDK and closes the
temporary app before refreshing the copied primary session.

## Preserved guest records

Profile now exposes a read-only archive for linked accounts. It shows 20 records
per page with the original UTC day, difficulty, outcome and guess count. A warning
explains that opening a record reveals its answer. Details use the archived
content snapshot, guesses, feedback and revealed hints, including Basic's
automatic clues. They never fetch the destination's same-day game or add score,
streak, continuation or sharing actions. Guess titles come from the local catalog;
a removed title is identified by its movie ID instead of disappearing.

The service validates archive ownership/schema and rejects an unreadable page
without silently skipping a record. Date plus document ID provide an unambiguous
cursor when several retired guests share a day. One lookahead record determines
whether another page exists. Rules allow only owner reads and queries limited
to 21 documents; writes remain server-only, and deletion/merge locks block reads.
Client recovery receipts also gate access before and after reads. Changing
accounts unmounts rows and open details immediately and ignores late responses.
Failed pages have a local retry that retains the cursor; previous-page navigation
remains available. Rapid navigation taps cannot skip a cursor.

Live creation remains disabled pending operator/staging acceptance, deployed scheduled
delivery and native/provider acceptance, including native archive rendering and
screen-reader checks. No store-build or real-provider success is inferred from
React fixtures or synthetic SDK tests. The paged query uses the automatic
single-field index and its document-ID tie-breaker; staged index verification
is still required because the emulator does not prove production index behavior.

## Complete workflow and remaining gates before live creation

1. Finish saving the current guest's durable pending move. Keep the primary
   Firebase guest session while authenticating the destination in a separate,
   memory-only Auth instance. Never store/log either ID token in merge metadata.
2. Show both the import and same-day conflict policy before confirmation. A
   cancellation must leave the guest's session, local outbox and server data
   unchanged. Signing into an existing profile alone must not imply consent to
   retire the guest.
3. Integrate the implemented proof of current control of guest and destination,
   valid/revocation-checked Firebase tokens, a linked destination, distinct UIDs
   and recent destination authentication. Verify authoritative account state;
   client-supplied UIDs, games, scores and claimed anonymous status are not proof.
4. Expose the implemented lifecycle only after client recovery and an explicit
   reconciliation tool/runbook exist. Verify production identity behavior and
   configure bounded scheduling, IAM and monitoring.
5. Run the implemented validation/copy worker to its durable copied phase; handle
   failures and legacy migration explicitly. Retain both locks until verified
   source retirement and finalization. The destination cannot resume play while
   only part of its account has been imported.
6. Retry partial/ambiguous work by durable job identity. App restart, token
   expiry, two-device requests and a lost final response must not re-credit a
   page or abandon either account. Provide status/recovery authenticated as the
   destination as well as the original guest.
7. After verified completion, switch the primary session and clear stale UI
   state. Retire the guest from further game writes. Coordinate guest identity/
   data cleanup with deletion; deleting the merged profile must erase archived
   copies and any retained source data or provenance containing its identifiers.
8. Display imported/conflicting counts and expose the separate guest records so
   preservation is visible to the player. Verify the promised recovery behavior
   across logout, reinstall, multiple devices and both native providers.

These describe the complete required workflow. Callable routes and client
confirmation/recovery now exist with emulator-only creation. The scheduled retry
export and bounded administrative reconciliation are implemented and directly
tested; deployed delivery, operator acceptance and corruption-specific repair
remain open. Archive viewing now has local
service/UI and real rules evidence; device acceptance remains open. Nothing is
deployed; source retirement and recovery have the emulator evidence below.
Legacy data migration and Apple/provider-device verification remain separate
release blockers.

## Verification

Administrative reconciliation follow-up: 38 lifecycle/scheduler/reconciliation
cases pass in one emulator invocation, including actual CLI inspection/apply and
provider-link race recovery after separate synthetic identity restoration. Four
CLI input cases pass. The final same-project Admin guard passes Functions
TypeScript and all 12 reconciliation cases again. No live credentials, deployment,
real provider restoration or native acceptance is claimed. See the
[reconciliation limits and procedure](account-merge-operations.md#administrative-reconciliation).

Scheduler follow-up: one isolated Auth/Firestore invocation passes 26 contracts
(17 existing lifecycle and nine new scheduled-recovery cases). The final addition
of searchable retention-review metadata then passes all nine affected scheduler
cases in a focused rerun. Fourteen existing callable unit tests and Functions
TypeScript pass. The tests invoke the actual scheduled export and assert its
endpoint settings, 45-game checkpoint continuation, concurrent delivery and
foreground recovery, expired leases, queue starvation prevention, pre-claim
backoff, stale repair isolation and the monotonic time budget. All emulator
invocations exit 0. Direct invocation does not prove cloud delivery, IAM, indexes,
alerts or actual process termination. The test setup preserves its own fixtures
and defers unfinished jobs instead of resetting the emulator database. See the
[operational acceptance requirements](account-merge-operations.md).

Archive follow-up: 24 new service/component tests and 16 existing Profile/modal
tests pass across targeted runs, with app TypeScript and whitespace checks.
The first component run exposed an ambiguous test assertion matching both the
list and detail outcome; the corrected assertion passes. The pagination race was
fixed and a rapid double-tap regression verifies next and previous navigation.
One isolated Auth/Firestore run passes all 27 lifecycle/rules contracts. It
verifies 45 archived records across tied-date pages without repeats/omissions,
bounded owner access, rejected writes and other-account reads, and locked reads.
The lifecycle case reads the real worker-created archive through the destination
Firebase SDK after retirement, compares it to the original guest snapshot and
checks that the destination's ordinary game remains unchanged. The emulator
process exits 0 and all test ports are closed. This does not establish actual
native layout/accessibility, background execution, production indexes or OAuth.

Client/callable follow-up: 105 distinct affected app tests and 126 backend unit
tests pass across targeted runs; TypeScript checks pass for both packages. One
complete emulator invocation passed all 95 Node contracts and three Go publishing
contracts. After adding the unaccepted-request cancellation barrier, all 39
affected authorization/reservation/callable/lifecycle contracts pass in a focused
run, including two new HTTP cancellation-race cases. Thus 97 distinct Node
contracts pass across these runs, not a single 97-case invocation. Both emulator
processes exited successfully. Temporary-Auth persistence configuration has unit
coverage; the installed Firebase SDK's cross-app user copy and refresh after
temporary-app disposal have real Auth/Functions emulator coverage. These use
synthetic provider identities, not native Google/Apple sign-in or process-kill
tests. Initial client fixtures incorrectly reset the AsyncStorage implementation
and returned a completed job for lock discovery after lock removal; corrected
fixtures now reflect SDK storage and server lock semantics.

Earlier lifecycle follow-up: all 119 affected backend unit tests pass, as do
Functions TypeScript and whitespace checks. The full emulator run passes 89 of
90 Node tests, stopping on a new fixture that incorrectly prepared deletion after
reservation. The focused rerun then exposes an overly specific expected SDK
error: revocation can report `auth/user-token-expired`, as well as disabled status.
The corrected fixture and narrow invalidation expectations pass all 17 lifecycle
cases, including two added deletion/disabled-destination checks. A direct REST
provider-link request using the old guest token is also rejected and the source
provider list remains empty. All three Go publishing contracts pass in that final
focused invocation. This is 92 distinct passing Node contracts and three Go
contracts across runs, not one successful full-suite invocation.

Lifecycle contracts exercise real synthetic Auth/Firestore records, ownership
isolation, cancellation/reconfirmation IDs, active/expired leases, guest provider
changes before and during disabling, saved-account revocation, final-stat changes,
Auth deletion errors/lost responses, cleanup failure, retirement markers and
deletion of more than one page of provenance. The retry handler is invoked
directly; native OAuth, actual process termination, production provider behavior,
Cloud Scheduler delivery and the absent player flow are not proved.

Earlier storage-worker checkpoint: 32 focused Firestore-emulator contracts pass in
one invocation, and the 29 affected merge-policy regressions pass separately.
Functions TypeScript and whitespace checks pass; test emulators exit 0 and their
ports are closed. The worker contracts cover 45 source games over multiple pages,
mixed outcomes/conflicts, full-page/empty boundaries, simultaneous workers,
unchanged source data, exact import/archive contents and statistics, and failures
in either profile's history, statistics, keys or legacy data. Fault injection
throws after transaction writes are staged but before committing the checkpoint,
then verifies zero partial writes and successful retry. A separate injected lost
response after a real committed page resumes from its saved cursor without extra
credit. Inter-page lock/deletion/statistics/archive/source changes also fail
without partial page writes. These are storage tests, not an end-to-end player
merge, actual process termination test, production network fault test or Auth
lifecycle proof. The previously passing full contract suite was not rerun for
this internal-worker-only addition.

Earlier authorization/reservation checkpoint: all 119 unit tests in the four
affected backend suites pass, including 62 authorization cases, 29 policy cases
and 28 engine/callable cases. Functions TypeScript and whitespace checks pass.
One combined Auth/Firestore/Functions run passes 42 Node contracts plus all three
Go publication contracts. It verifies concurrent duplicate/competing reservations,
unchanged advanced cursors, failure on inconsistent locks, deletion barriers and
earlier prepared deletion receipts, real HTTP gameplay denial, and owner-access
rules for both roles. Emulators shut down with exit 0.

Provider identities in that checkpoint are synthetic Auth-emulator fixtures. They do
not establish production JWT signature verification, native Google/Apple OAuth,
worker interruption/recovery, Auth changes racing with reservation, lock release,
or source retirement/deletion cleanup. Reservations are exercised directly as an
internal helper; there is still no enabled public merge endpoint.

Earlier policy-only checkpoint:

On 2026-10-13, 29 merge-policy unit cases and 27 existing game-engine/callable
unit cases pass across focused runs (56 distinct tests). Functions TypeScript and
whitespace checks pass. The emulator run passes all 22 Node contracts, including
the new policy fixture, deletion, gameplay transactions and rules. The combined
runner then fails to locate Go on PATH; a separate Firestore-only run with the
workspace Go runtime passes the three remaining publishing contracts. That is
25 passing emulator contracts across two runs, not a single successful combined
runner invocation. Both emulator processes exit and the test ports are closed.
The final tightening of calendar-stat/replay-ID validation was checked with the
29 policy cases and TypeScript after the Node emulator run; the emulator suite
was not repeated for those additional rejection checks.

The policy tests use the real game transition/scoring functions to build games
and continue imported games. They cover attempt/hint preservation, terminal
losses, all four existing-game states, duplicate import after further play,
calendar order, overlapping-day streaks, source changes, malformed records,
ownership and bounded pages. Existing gameplay callable tests verify that the
shared history writer retains its prior contract.

The emulator policy fixture explicitly uses administrator writes for synthetic
accounts; it is not an account-merge authorization test. It imports a real
server-created partial Easy game, resumes through the actual `startGame` and
`applyGameAction` HTTP endpoints, checks hint/score/history state, replays the
completion, and confirms that the source record remains unchanged. The fixture
also checks planner replay against the resulting Firestore snapshot.

Security/API references: [Firebase ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[anonymous-account linking](https://firebase.google.com/docs/auth/web/anonymous-auth),
and [Firestore transaction behavior](https://firebase.google.com/docs/firestore/manage-data/transactions).
The worker uses the server SDK's [transaction query and write APIs](https://docs.cloud.google.com/nodejs/docs/reference/firestore/latest/firestore/transaction).
Identity lifecycle references: [Admin user management](https://firebase.google.com/docs/auth/admin/manage-users)
and [Firebase Auth REST operations](https://firebase.google.com/docs/reference/rest/auth).
