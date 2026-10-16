# Secret scanning and CI cost

The required check remains named **Secret history scan**. It uses pinned
Gitleaks v8.30.1 with fully redacted output and the existing exact historical
exceptions. No finding or rule was suppressed by this optimization.

Ordinary pull requests scan all commits in `base..HEAD`, where `base` is the
GitHub event's target SHA and `HEAD` is checkout's synthetic merge. This includes
intermediate commits even when their content is removed before the final diff,
and `-m` includes merge changes. This is a commit-history scan, not a final-file
or final-diff scan. Gitleaks documents the
[`--log-opts` commit-range mechanism](https://github.com/gitleaks/gitleaks#git).

Full-history scans remain on main/master pushes, weekly schedules, manual runs,
and merge queues. PRs also use full history when event data is invalid, the base
is missing/not an ancestor, or the final diff changes `.gitleaks*`, the security
workflow or the scan runner. Full fetch depth remains required. Missing metadata
never results in skipping the check. Scanner errors and findings remain failures.

The existing latest PR 14 full scan took 10m14s and passed. Avoiding repeated
old-history scans should reduce ordinary PR time, but no remote speedup has yet
been measured. This policy-change PR itself deliberately takes the full-history
path. Main and scheduled scans provide continuing checks under current rules.

Validation: the pinned workflow linter passed. Node tests cover fallback cases
and use an actual temporary Git repository to verify history selection. An
additional local run with `TALKIE_TEST_GITLEAKS=1` invoked the pinned scanner and
confirmed findings for both a removed intermediate value and a merge-only value
using synthetic data/custom fixture rules. Normal CI runs the Git fixture tests
with the existing script suite; production scans continue using the normal rules.

No native build trigger or dependency schedule changes are part of this work.
