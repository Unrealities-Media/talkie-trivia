# Content pipeline runbook

The Go CLI in `utils/pipeline` separates upstream drafts, the released search
catalog, editorial approval, and immutable daily publication. Run commands from
that directory with Go 1.26 or newer. Use `go run .` so every source file is built.

## Source refresh and catalog releases

Provide `TMDB_API_KEY` through the process environment or a secret manager. The
CLI no longer reads a credential file from the repository. Fetch and validate the
complete response set before replacing the raw draft; HTTP/JSON/validation/file
failures exit nonzero and do not proceed to publication.

```sh
go run . -fetch -process
```

This writes ignored `utils/data-source/rawTMDB.json` and
`candidate-searchIndex.json`. It **does not replace** `src/data/searchIndex.json`.
Review a candidate diff for removals, duplicates, release years, actor/genre names,
searchability, size, and content suitability. A catalog-changing release currently
requires coordinated app/Functions deployment because the server requires an exact
catalog hash. Multi-version support remains an open release requirement.

Candidate generation preserves a distinct source `original_title` in optional
`a` (alternate-title) entries. Editors may add verified localized/common release
titles there, keeping the canonical movie ID and primary title unchanged. Review
aliases for the correct movie/year and language before promoting a candidate;
these imports are not editorial approval. The bundled catalog has not been
refreshed with aliases yet. Search accepts `a` entries, normalized punctuation and
accents, exact one-character titles, and a trailing release year. The catalog
search regression checks every released title with and without its year.
Publication checks direct title/alias spoilers in both description and tagline;
short titles and normalized/translated variations still require human review.

Optional source imports write only `movieImports`, leaving `movies` and all
editorial overrides untouched. Database commands require an explicit project and
default to the emulator and preview mode:

```sh
go run . -upload -project demo-talkie-trivia
go run . -upload -project demo-talkie-trivia -apply
```

## Review and publication

Prepare entries according to [the editorial contract](../content/README.md).
The checked-in approval list has no approved production clues yet. New entries
must contain all five difficulty variants; see [clue difficulty](clue-difficulty.md).
Schema-2 publication snapshots hash the entire set, and the server selects the
requested variant when creating a player's game. Existing schema-1 snapshots
remain readable and are never overwritten by normal publication.

Preview against an emulator (start it separately); then apply the reviewed plan:

```sh
go run . -schedule -project demo-talkie-trivia
go run . -schedule -project demo-talkie-trivia -apply
```

The private report is `utils/data-source/schedule-plan.json`; it includes upcoming
answers. Never put it on a public website. By default the schedule covers tomorrow
through the chosen horizon. GitHub Actions uploads only `schedule-summary.json`
containing slot counts and dates; it must never upload the full answer-bearing
plan, even under an artifact name containing "private". The default horizon runs
through 30 days ahead, filling five difficulty slots per date (150 movies).
Each slot has a distinct answer and uses `YYYY-MM-DD_LEVEL_N` as its document ID. Rerunning on the same day makes no changes;
rerunning a week later adds only missing days through the new horizon. The planner
avoids repeats across all difficulties in the preceding 90 days and the future
window, including legacy date-only records. Repeats may become eligible after
that cooldown. Keep adding reviewed sets before the schedule runs out. Use
`-include-today` only for an explicit first-time bootstrap; it cannot overwrite
today if a document exists. `-horizon-days` accepts 1–90.

The publisher reads the entire bounded window in one Firestore transaction, aborts
on read/validation failures, and creates missing dates with existence preconditions.
Concurrent runs retry against the updated window. At most 455 new documents are
committed atomically. Each challenge contains its difficulty, reviewed clues, link metadata, content
digest, review metadata, and catalog version. Functions read this snapshot, never
the mutable upstream movie record, when starting a game. Firestore's transaction
API supplies retry/commit semantics; local pure-planner tests do not substitute
for emulator concurrency verification. [Firestore Go transaction reference](https://pkg.go.dev/cloud.google.com/go/firestore#Transaction).

For an explicitly configured cloud project, use Application Default Credentials
and remove `FIRESTORE_EMULATOR_HOST`. Preview first:

```sh
go run . -schedule -live -project YOUR_STAGING_PROJECT
go run . -schedule -live -project YOUR_STAGING_PROJECT -apply -confirm-project YOUR_STAGING_PROJECT
```

Live writes require both `-apply` and the exact project confirmation. There is no
hardcoded production target or flag that silently clears an emulator connection.
Import batches can partially succeed before a later batch fails, but they never
publish games and are safe to retry. A publication transaction is atomic. If writing
the local report fails after commit, the CLI states that the database operation
already succeeded; rerun to reconcile rather than deleting published documents.

## GitHub Actions

`data-pipeline.yml` calls the actual CLI, runs Go tests/vet before credentials are
issued, and uses [Google Workload Identity Federation](https://github.com/google-github-actions/auth)
instead of writing long-lived service account JSON from shell interpolation.
Configure **separate protected** staging and production environments with:

| Variable | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID` | The distinct project for that environment. |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Provider restricted to this repository, approved branch/workflow and environment. |
| `PIPELINE_SERVICE_ACCOUNT` | Dedicated publisher service account with narrowly scoped Firestore permissions; no project owner/editor role. |
| `RELEASED_CATALOG_SHA256` | Catalog hash actually deployed to the app and Functions for that environment. |

Restrict production environment branches and require reviewer approval for writes.
Configure and test IAM independently; this repository does not prove deployed
permissions or environment isolation. Workflows serialize runs per environment;
Firestore transactions also protect against local/concurrent publishers.

Manual dispatch defaults to a staging preview. Inspect the public-safe summary
and an authorized local private preview before dispatching with `apply=true`.
The workflow does not upload the answer-bearing private plan. Weekly scheduling is disabled unless the repository
variable `ENABLE_STAGING_SCHEDULE=true`; enabled scheduled writes target staging
only. Production remains manually dispatched until staging evidence and operator
approval support automation. The workflow never fetches a new catalog while
publishing daily content. Assign an operator to workflow failure notifications and
verify notification delivery; a configured alert owner is still outstanding.

## Read-only schedule readiness

From `utils/pipeline`, check today plus the next seven UTC days:

```sh
go run . -check-schedule -project demo-talkie-trivia -horizon-days 7
```

Use the emulator address configured for that project. For an explicitly selected
cloud project, use existing Application Default Credentials (prefer an identity
with only the necessary Firestore read permissions), unset
`FIRESTORE_EMULATOR_HOST`, and add `-live`:

```sh
go run . -check-schedule -live -project YOUR_STAGING_PROJECT -horizon-days 7
```

The command checks all five difficulty slots, including today, without fetching
TMDB, loading the unpublished approval pool, or writing Firestore. It rejects
write/bootstrap flags and cannot be combined with publication or source imports.
It compares snapshots with the catalog at `-catalog`; use the exact catalog
deployed to Functions. A local catalog check does not establish deployed parity.

JSON on stdout contains only `healthy`, `from`, `through`, `expectedSlots`,
`readySlots`, and `issues` (slot date/difficulty plus `missing` or `invalid`). No
movie IDs, clues, titles or reviewer identities are included. Diagnostics go to
stderr. Exit status is nonzero if any slot is missing/invalid, a read fails, or
the report cannot be written. A read failure means health is unknown; never reuse
an earlier successful report as current evidence.

Checks cover catalog membership/version, date/difficulty, supported content
schema, clue lengths/variants, review metadata and the content digest. Legacy
schema-1 snapshots remain supported when valid; legacy date-only documents do
not satisfy the five difficulty slots. This does not certify clue quality,
rights clearance, deployed authorization, or successful end-to-end gameplay.

The horizon accepts 1–90 days ahead (10–455 document reads per invocation).
No scheduled job or alert is enabled by this change. A future monitor must check
the exit status, retain only the safe report, and deliver failures to a verified
operator. Until alert delivery is proven, monitoring remains a release gate.

Local validation on October 15, 2026 passed Go tests/vet and the targeted
Firestore emulator contract: valid schedules, holes, malformed records,
read failure, and unchanged published snapshots. Unit tests also cover UTC
boundaries, catalog mismatch, invalid review/content, bounded horizons,
write-flag rejection and report disclosure.

## Migration, rollback, and release gates

Existing legacy `dailyGames` documents have no reviewed content snapshot. The new
server intentionally rejects them. Do not deploy it over a live legacy schedule
without a tested, coordinated migration. Back up the project, inventory existing
games and future dates, review their content, and migrate future dates in staging
while preserving answer IDs. The normal publisher refuses incompatible existing
future dates instead of guessing or replacing them. A production migration tool
and rehearsal are still required. Never retrofit a different clue into an active
day or silently reset existing player results.

Changing a review entry affects only unscheduled dates. If a published challenge
is unsuitable, stop publication, preserve an incident record, and use a separately
reviewed correction/withdrawal plan. Rollback must retain already issued game
snapshots and scores. Do not delete schedules as a shortcut to rerun the publisher.

Before enabling real publication, prove: enough reviewed content; catalog parity;
source-fetch failure retains drafts; preview causes no database changes; import
preserves editorial data; repeat/concurrent publication cannot overwrite or repeat;
permission/read/commit failures exit nonzero; a deployed app receives identical
clues for all players at the same difficulty on one day; backup/restore and an alert reach the responsible
operator. Local Go/Functions tests and the [emulator suite](emulator-testing.md)
cover planning, preview, concurrent publication, immutable reruns and failed-plan
atomicity. Staging, actual editorial and operational evidence remains pending.
