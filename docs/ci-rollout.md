# CI rollout checkpoint

The combined snapshot is published in [draft PR #1](https://github.com/Unrealities-Media/talkie-trivia/pull/1).
Main now requires the observed unit, Go, emulator, browser, native, CodeQL and
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
CodeQL findings gate. Native builds are still running. The remote secret scan
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
- Native workflow: explicit Android toolchain installation, existing binary
  alignment gates, Android and iOS builds.
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
   CodeQL and native jobs against that exact commit. Local Windows passes do
   not establish those results.
3. Resolve historical Sentry and TMDB credential exposure. The owner confirmed
   no remediation on October 15. Confirm revocation/rotation without exposing
   replacement values; retain evidence before accepting narrowly scoped
   historical exceptions. Deleting a file or rewriting history does not revoke
   a credential. Current checksum exceptions do not exempt credential matches.
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

## Credential remediation handoff

The four history matches cover Sentry organization-token patterns in historical
Android/iOS `sentry.properties` and two detections of a TMDB bearer token in the
old movie-fetching script. No provider requests have been made with those
credentials, and their current validity is unknown.

The account owner must revoke the exposed credentials in the provider consoles,
replace any still-used credentials in the appropriate secret store, and confirm
the provider, date and affected integration without sharing token values.
Sentry documents organizational credential management through
[organization integrations](https://docs.sentry.io/api/guides/create-auth-token/).
TMDB documents its bearer credential in the account's API settings under
[API Read Access Token](https://developer.themoviedb.org/docs/authentication-application).
Confirm that the old bearer credential is revoked; changing a different key
alone is not sufficient evidence. If a console cannot revoke it, contact that
provider's support through the account owner.

After revocation is confirmed, record the evidence and review exceptions for
only the exact historical fingerprints. Keep full-history scanning enabled so
new credentials continue to fail CI. Current exceptions cover checksums only.
There is no authenticated Sentry/TMDB administration connector in this session;
GitHub repository administration cannot revoke credentials issued by them.
