# CI rollout checkpoint

The local workflow changes are ready for review, but are not published or
enforced on GitHub. The October 15 audit records the test evidence and open
security findings. Main is currently unprotected and its latest unit/native
runs failed.

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

There are more than 125 modified tracked files plus new app assets/content and
test files in this checkout. Do not publish a workflow-only commit and claim it
tests this checkout: the tested source and its fixtures must be in the candidate
commit. Do not silently include the existing product work in a CI-only PR.
Select either a reviewed combined app/CI snapshot, or separate the product work
into a prerequisite commit and put the CI changes on top. No live deployment is
part of either option.

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
