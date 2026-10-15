# Dependency maintenance

## Web beta policy

Use one monthly Dependabot version-update PR spanning the app, Functions,
integration tools, Go modules, and GitHub Actions. The group permits one open
version-update PR and automatic rebasing is disabled to avoid repeated CI runs.
Feature and bot branches run verification on `pull_request`, without a duplicate
`push` run. Push verification remains enabled on main/master after merging.
Security updates remain enabled and npm security updates are grouped separately;
GitHub applies a separate security-PR limit, so the monthly cap is not a promise
that security updates can never open another PR.

Android and iOS builds remain manual-only and the Native Builds workflow remains
disabled in GitHub. Dependency maintenance during web beta does not require
native compilation or deployment.

## October 2026 consolidation

The refresh updates the stable Expo 57 patch releases, independent app packages,
Functions and integration tooling, Go's Google API client, and pinned GitHub
Actions. All ten original Dependabot PRs (#2–#11) are superseded by one reviewed
snapshot. Action updates from #3, #5, #9, #10, and #11 are incorporated (or advanced
to a newer release). The proposed Babel 8 (#2), gesture-handler 3 (#4), React 19.3
(#6), and Expo 58 modules (#7 and #8) are deferred as coordinated framework
upgrades, rather than installed independently.

“Latest” means the newest stable version compatible with the current framework
and supported tooling. The following exceptions are intentional:

| Dependency family | Policy and reason |
| --- | --- |
| Expo / React Native / React | Stay on Expo's default stable SDK 57, RN 0.86.3, and matched React/React DOM/test-renderer 19.2.3. SDK 58 is on npm's `next` channel; upgrading individual modules or React independently breaks the supported combination. |
| SDK-coupled native libraries | Keep compatible AsyncStorage, gesture-handler, Reanimated, Worklets, screens, SVG, and safe-area versions until a coordinated SDK migration. |
| TypeScript | Keep 6.0.3. Current typescript-eslint accepts versions below 6.1; ts-jest accepts versions below 7. Do not force TypeScript 7 past those peer constraints. |
| Babel | Keep 7.29.7, including an explicit core dependency. Expo's Babel preset and plugins use Babel 7. |
| App test tooling | Keep Jest 29 and RNTL 13 with jest-expo 57. The next SDK's Jest 30/RNTL 14 migration changes test-renderer APIs and is not part of this maintenance update. Functions can use Jest 30 independently. |
| Security overrides | Retain the reviewed gRPC, Xcode UUID, and vendored URI-decoder overrides and their behavioral checks. |

Dependabot ignores the known incompatible upgrade ranges. Revisit those entries
when adopting the next **stable** Expo SDK or when the compiler tooling explicitly
supports TypeScript 7; these are compatibility holds, not permanent bans.

The notification-clock patch now accepts expo-notifications 57.0.23. Both patched
upstream files have exactly the same reviewed SHA-256 hashes as 57.0.22; its
fail-closed source checks remain in place. Native builds were not run.

Firebase CLI 15.34 removes `get-uri` and `basic-ftp` from the integration lockfile.
Their old compatibility tests and now-unused FTP override are removed; the
remaining telemetry and multipart-upload dependency contracts still run in CI.

References: [Expo SDK compatibility](https://docs.expo.dev/versions/latest/),
[Dependabot multi-ecosystem updates](https://docs.github.com/en/code-security/concepts/supply-chain-security/multi-ecosystem-updates),
[Dependabot limits and rebasing](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
