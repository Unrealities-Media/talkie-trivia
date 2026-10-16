# CI rollout checkpoint

## Incremental secret scanning follow-up (October 15)

Routine PRs scan from the PR base; main/master pushes scan from the event's
previous commit. Both include intermediate commits and merge-resolution changes.
Weekly Monday 08:23 UTC, manual and merge-queue runs retain full-history scans.
Changes to scanner policy, invalid event metadata, missing history or a
non-ancestor base also fall back to full history. Exact revoked-credential
exceptions remain unchanged; new findings still fail the required check.

The post-merge PR #17 history scan passed on October 16 at 00:57:35 UTC,
after approximately eight minutes. This follow-up avoids repeating that whole
history scan on ordinary merges. Its own policy-changing PR and merge will
still trigger full scans. Targeted tests verify push/PR ranges, fallback behavior,
and preservation of intermediate and merge-only findings using a real Git fixture.

## Web-beta build policy (October 15)

At the owner's request, Android/iOS builds are manual-only and are not required
merge checks during web beta. Native run `38763190055` was cancelled on request;
its unfinished results are not failures or passes. The workflow is also disabled
in GitHub until this trigger change reaches the default branch, preventing the
old default-branch triggers from spending runner time. Re-enable it after merge
only when an explicit native verification is wanted. Native release alignment
and device acceptance remain deferred release requirements.

Latest web-beta verification at `3cd092d`: tests/coverage, browser, emulator,
Go, CodeQL analyses/findings and dependency inventory passed. The history scan
failed on four findings across 883 commits before the owner-confirmed credential
remediation below. A new scan must verify the exact historical exceptions.

Earlier native verification at `181af99`: Linux tests/coverage, browser, emulator, Go,
CodeQL analyses/findings and iOS passed. The publication-summary disclosure
regression passed remotely. The history scanner scanned 881 commits and failed
on four findings. Android compiled successfully in 33m 3s and ZIP alignment
passed, but all 28 library inspections failed to parse tool output. The verifier
resolved the readelf alias and relied on its default output format. The next
candidate explicitly selects GNU program-header output and tests both real NDK
tool names. Six local tests, including that tool contract, and actionlint pass;
remote packaged ELF alignment remains unverified.

The combined snapshot is published in [draft PR #1](https://github.com/Unrealities-Media/talkie-trivia/pull/1).
Main now requires the observed unit, Go, emulator, browser, CodeQL and
secret-history checks, up-to-date branches, PRs and resolved conversations.
Administrators cannot bypass these rules; force pushes and branch deletion are
disabled. Secret scanning, push protection, dependency alerts and automated
security-update PRs are enabled. Remote validation is still in progress.

The first remote app test/coverage job passed. Integration installation failed
on a missing nested picomatch lock entry; clean lock regeneration repaired it.
The Go vulnerability gate exposed CI selecting Go 1.26.0; the module now pins
patched 1.26.9, matching the locally scanned toolchain. CodeQL flagged a
case-sensitive test assertion; mixed-case escaping assertions now cover it.
These corrections are published as `5af35f5`. Remote Linux unit/coverage,
browser, emulator and Go jobs now pass, as do both CodeQL language jobs and the
CodeQL findings gate. The iOS simulator release build passed. Android reached
the 75-minute timeout after a JVM metaspace exhaustion warning and failed Java
compilation/lint tasks; packaged alignment was not reached. The next candidate
increases the CI JVM allowance, bounds Gradle concurrency and fails promptly on
JVM exhaustion, with an earlier build timeout and retained logs. A remote rerun
must verify this correction. The remote secret scan
completed across 878 commits and failed on exactly four credential matches,
confirming detection and a failing required check. Because this PR is also a
draft, its blocked state alone does not prove non-draft merge enforcement.
Remote frontend evidence is 111 suites / 712 tests passed, with
89.09% statements, 81.21% branches, 88.58% functions and 92.71% lines. Backend
evidence remains seven suites / 158 tests and 44.02% line coverage.

## Change scope

- Unit workflow: all branch pushes, PRs and merge queues; lint, TypeScript,
  script contracts, architecture boundaries, coverage floors, browser gameplay,
  real Firebase emulator contracts, web export and Go checks.
- Native workflow (manual-only during web beta): explicit Android toolchain
  installation, existing binary alignment gates, Android and iOS builds.
- Security workflow: CodeQL, dependency inventory, production backend dependency
  gate and full-history Gitleaks scan with redacted diagnostics.
- Supporting files: root ESLint config and dependency locks, Jest configs,
  architecture checker, browser runner/config/tests, emulator config, Dependabot,
  exact checksum-only Gitleaks exceptions and validation documentation.
- Source fixes required by lint include hook dependencies and stable callbacks;
  they are mixed into pre-existing local app changes. Browser tests also depend
  on the local catalog fixtures, seed support and gameplay interface.

The initial checkout contained more than 125 modified tracked files plus new
app assets/content and tests. The candidate includes the tested source and its
fixtures; a workflow-only commit would not reproduce the tested snapshot.
The user selected one combined app/CI snapshot, published as `0e052e7` with
targeted CI corrections on top. No live deployment is part of this PR.

## Required evidence before completion

1. Review the chosen candidate commit and publish it on a `codex/` branch.
2. Verify remote Linux installs, lint, unit/coverage, browser, emulator, Go,
   and CodeQL jobs against that exact commit. Local Windows passes do not
   establish those results. Native verification is deferred until requested
   for native development or release readiness.
3. Verify the post-remediation history scan. On October 15 the owner confirmed
   Sentry organization-token revocation and TMDB API Read Access Token
   regeneration, and authorized exact historical exceptions. The confirmation
   and its evidence limits are recorded below. New findings must still fail CI.
4. Require the job names listed in the audit on main, require PRs and resolved
   conversations, prohibit force pushes/deletion and administrator bypass.
   Verify a deliberately failing PR cannot merge. Never substitute passing
   inventory uploads for a clean security result.
5. Enable supported repository secret scanning/push protection and dependency
   alerts; verify actual environment approval policies for publication jobs.
6. Keep the audit's app-release findings separate from CI acceptance: abuse
   controls, answer exposure, dependency remediation and release-device/provider
   testing remain explicit open work, even after CI runs correctly.

Two anonymous beta accounts were accidentally created by the initial browser
run before isolation was fixed. Cleanup was rejected by automatic approval
review and awaits explicit user authorization. Subsequent browser runs use only
the verified dedicated emulator project; no live account deletion is claimed.

## Credential remediation record — October 15, 2026

The four history matches cover Sentry organization-token patterns in historical
Android/iOS `sentry.properties` and two detections of a TMDB bearer token in the
old movie-fetching script. No provider requests have been made with those
credentials. Provider-side invalidation has not been independently tested.

The account owner reported revoking the Sentry token found under Organizations.
The historical configuration identifies organization `tom-szymanski` and project
`talkie-trivia`. Sentry remains disabled in the application; no replacement is
needed for the web beta.

The owner reported regenerating the TMDB key and, after checking the historical
bearer-token identifier, explicitly confirmed a new API Read Access Token.
This is owner-attested rotation, not a provider receipt or an independent test
that the old token is rejected. No replacement values were requested or stored.
The local movie importer uses `TMDB_API_KEY` when fetching; updating that local
secret is the owner's responsibility before the next import.

The owner explicitly authorized documenting this remediation, accepting the
old historical findings and rerunning CI while keeping native builds disabled.
The redacted report from run `38767004212` supplies the four exact fingerprints
now listed in `.gitleaksignore`: two Sentry findings in commit `8108c8a` and two
rules matching the TMDB bearer credential in commit `f12fa4d`. No whole paths,
rules, token values or future commits are excluded. The 12 existing checksum
false-positive exceptions are unchanged.

Sentry documents organizational credential management through
[organization integrations](https://docs.sentry.io/api/guides/create-auth-token/).
TMDB documents its bearer credential in the account's API settings under
[API Read Access Token](https://developer.themoviedb.org/docs/authentication-application).
Full-history scanning remains enabled and new credential findings must fail CI.
There is no authenticated Sentry/TMDB administration connector in this session;
GitHub repository administration cannot revoke credentials issued by them.
