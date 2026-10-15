# Combined web-beta candidate — October 15, 2026

Local branch: `codex/web-beta-candidate`. Integration commit:
`5ce65888dfc9a19d92459f552e4fb177972575c2` (subsequent changes are documentation).
The merge was local only; main and the hosted beta were not changed.

## Included changes

| Review | Included head | Resulting behavior |
| --- | --- | --- |
| [PR 13](https://github.com/Unrealities-Media/talkie-trivia/pull/13) | `dd1fc1cd90c121b45f8c402d2bfc904a3a243043` | Explicit keyboard/pointer movie preview without submitting a guess. |
| [PR 14](https://github.com/Unrealities-Media/talkie-trivia/pull/14) | `135d53faffa16444c203f2ad703cf98f9096b224` | Shared per-account gameplay budget and durable retry after throttling. |
| [PR 15](https://github.com/Unrealities-Media/talkie-trivia/pull/15) | `3d6de2b6ac8b6bb24e324d59666fbb804a505320` | Read-only, answer-free upcoming schedule readiness report. |
| Hosted audit | `19d3167` | Records verified public pages and corrects the stale publication blocker. |

All branches combined without conflicts. The combined browser test file retains
both the keyboard-preview assertions and the throttled-action recovery scenario.

## Combined verification

One fresh emulator-configured web export and all six Chromium contracts passed
on the integrated source: desktop and mobile guest play, keyboard previews,
give-up/win/history/share fallback, hint persistence, duplicate prevention,
throttled manual retry and reload recovery. TypeScript checking also passed.
These are combined-candidate results, not an assumption based on separate PRs.

The normal beta build also completed for `talkie-trivia-beta`, preview variant,
with emulators disabled. Its `web-build` directory passed the existing
`verifyBuild('talkie-trivia-beta')` receipt/digest check. Artifact tree SHA-256:
`7a8a81194ebbb5cd5ca33d9b081068e1d026be7e50eff097fa270285547824e3`.
This local artifact has not been deployed; the hosted audit identifies the
currently observed hosted bytes separately. Build output and receipt are ignored
local artifacts and must be rebuilt if absent or changed.

The backend, rules and Go changes are unchanged from their individually tested
PR heads; their full suites were not redundantly rerun locally in this pass.
PRs 13 and 15 had all remote checks green. PR 14 had all checks green except its
still-running full-history secret scan at this checkpoint. Recheck final heads
before merging; no failing check may be waived based on this document.

## Before rollout

- Confirm the reviewed heads are still current and required checks have passed.
- Use the candidate's normal beta build and project-verification receipt; never
  deploy the emulator-configured browser-test export.
- Confirm the deployed catalog when running the read-only content check. The
  previously reported October 21 horizon has not been revalidated against live
  Firestore in this pass. More approved content is still needed before expiry.
- A Functions rollout is required for the gameplay budget. Publishing only the
  web artifact does not enable backend abuse controls. Follow existing project
  guards and deployment authorization; this document does not authorize writes.
- After deployment, verify cold-load/restored-tab search, keyboard preview,
  normal game progress and safe retry against the deployed build. Local emulator
  evidence does not establish production IAM, App Check or real-provider login.

Keep invited-group access. App Check, global abuse monitoring, content/rights,
staging/rollback and operational support/deletion acceptance remain open.
Android/iOS builds remain disabled throughout this web-beta stage.

## Live schedule check blocked by expired authentication

The subsequent read-only check targeted `talkie-trivia-beta`, today plus seven
days ahead, using the existing Firebase CLI account. A saved account/refresh
credential exists, but obtaining an access token fails with the CLI's
reauthentication-required error. No Firestore reads or writes were completed;
there is no live health result. The prior October 21 horizon remains unverified.

Restore the local session interactively using the installed CLI:

```powershell
rtk proxy node .expo/dependency-upgrade.cjs node integration node_modules/firebase-tools/lib/bin/firebase.js login --reauth
```

The wrapper uses the project's local Node 24 runtime. Do not paste credentials
or login codes into a chat or commit them. After local login is restored, run the
read-only `-check-schedule` command with the explicit beta project and released
catalog. The local `.expo/check-live-schedule.cjs` helper passes the short-lived
access token only in the child environment and emits no token or answer data.
This authentication blocker applies to live verification, not local development.
