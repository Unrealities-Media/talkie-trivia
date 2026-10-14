# Dependency security review

Verified locally on 2026-10-13. Finding 24 remains open. Audit counts include
transitive parent packages and are not counts of independent vulnerabilities.
No advisory has been suppressed or accepted as a permanent exception.

| Install scope | Current npm audit | Underlying remaining advisories |
| --- | --- | --- |
| App and its build/test tools | 57 affected packages: 52 high, 5 moderate | braces, node-forge, sprintf-js |
| Functions, including development tools | 20 moderate | sprintf-js |
| Functions production dependencies (`--omit=dev`) | 0 | None reported by npm |
| Isolated emulator tooling | 3 high | braces |

These are npm registry results, not a complete native SDK, operating-system,
license or supply-chain audit. Repeat before release and after lockfile changes.

## Changes and compatibility evidence

- Removed unused browserify-fs, crypto-browserify, comlink, fs, vm,
  react-native-config, react-native-vector-icons and resize-observer-polyfill.
  The app uses `@expo/vector-icons`. Babel module resolution and jest-expo are
  development dependencies. This follows the earlier unused chart/Skia removal.
- Pinned grpc-js 1.14.6 in the app, matching the emulator tooling override.
  Firebase's Node-side dependency range otherwise retained an affected version.
- Scoped UUID 11.1.1 to Xcode project tooling and integration gaxios. Their
  consumers use CommonJS `v4`; project-ID generation and gaxios multipart-body
  construction pass real consumer tests. The release contains the upstream
  [UUID security backport](https://github.com/uuidjs/uuid/releases/tag/v11.1.1).
- Scoped basic-ftp 6.2.3 to integration get-uri. Its constructor/method interface,
  MLSD/Unix metadata parsing and a bounded malformed-list regression pass. This
  does not establish real FTP/proxy interoperability. Version 6 disallows a
  separate transfer host by default, which we retain; see the
  [upstream release notes](https://github.com/patrickjuchli/basic-ftp/releases).
- Scoped OpenTelemetry core 2.8.0 to integration Pub/Sub. Source inspection found
  its single core API use, `W3CTraceContextPropagator`; a test exercises Pub/Sub's
  actual serialization with the upgraded core, and rejects oversized baggage.
  Node 24 and the installed API meet its peer/runtime requirements. The
  [upstream fix](https://github.com/open-telemetry/opentelemetry-js/releases/tag/v2.8.0)
  bounds incoming baggage processing. This override does not update a full
  telemetry SDK, enable app telemetry, or verify deployed Pub/Sub delivery.
- Applied compatible Functions lockfile updates. Production npm audit is clear;
  the backend build and 43 unit tests passed after these updates. The final real
  emulator run passed 21 Node and 3 Go contracts after all integration overrides.

### Router decoder backport

Expo Router's query-string 7 dependency requires a callable CommonJS decoder.
The upstream [malformed-input decoding fix](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr)
is ESM-only. `vendor/decode-uri-component` contains the exact 0.5.0 algorithm,
with only its export adapted, its MIT license retained, and source/archive hashes
recorded. Tests reverse the adaptation and verify the upstream source hash, then
exercise the router's actual parser with normal and malformed inputs.

The package is a direct local dependency, referenced by the npm override using
`$decode-uri-component`. A relative file override alone produced an invalid
nested path in npm's lockfile: the installed tree worked but `npm ci` failed.
That failure was reproduced and fixed. An isolated `npm ci --ignore-scripts`
now installs successfully, and all four app dependency tests pass in that fresh
tree. This establishes lockfile/resolver reproducibility; lifecycle scripts and
the complete build from that isolated install were not exercised. Regular CI
uses `npm ci` with scripts enabled. Do not replace this with an absolute path or
silently alter the backported algorithm to satisfy tests.

## Remaining advisories and exposure

| Advisory | Observed dependency path / inputs | Required follow-up |
| --- | --- | --- |
| [braces recursion](https://github.com/micromatch/braces/issues/70) | App Jest/Babel tooling through micromatch; emulator Firebase CLI through chokidar. Inputs include configured glob/watch patterns. | Adopt a supported patched upstream chain, or review and test a bounded compatible patch. Restrict tooling to trusted repository patterns meanwhile. No vulnerable-pattern sanitization is claimed. |
| [node-forge signature verification](https://github.com/digitalbazaar/forge/issues/1149) | Expo CLI and `@expo/code-signing-certificates`; the latter actually calls certificate/signature verification. | Upgrade to a verified fix when available, or replace the affected tooling path. Do not treat the absence from app JS as proof that build/signing tools are safe. OTA remains disabled. |
| [sprintf-js precision](https://github.com/alexei/sprintf.js/issues/237) | argparse 1 via js-yaml/Istanbul in app and Functions test tooling. Formatting strings come from parser usage/help definitions and fixed error templates in the inspected consumer. | Replace the old coverage/config chain with a supported compatible version or a reviewed fix; verify Jest/Expo/ts-jest together. No blanket override of Jest majors. |

The ARM64 Release Metro source map contains 2,427 sources. It includes the
vendored decoder and contains no braces, node-forge, sprintf-js or grpc-js source
paths. This supports a build/test-tool exposure classification for those npm
findings in that Android JS bundle. It does not prove iOS bundle equivalence,
native library safety, or absence of other vulnerabilities.

Do not run `npm audit fix --force` indiscriminately. Its proposed resolutions
included major framework/CLI downgrades and mutually incompatible test runners.
The three remaining underlying advisories above were still reported after the
compatible updates; fewer parent-package reports alone do not resolve them.

## Reproduce

Use the repository's pinned Node 24 runtime. From the root:

```sh
npm ci
npm run test:dependencies
npm audit
npm --prefix functions ci
npm --prefix functions audit --omit=dev
npm --prefix functions audit
npm --prefix integration ci
npm --prefix integration run test:dependencies
npm --prefix integration audit
npm --prefix integration test
```

Audit commands with outstanding advisories intentionally return nonzero. CI
enforces the clear production-backend audit and both dependency contract suites.
It does not currently enforce a clean full app/tooling audit. The remaining
advisories remain explicit release work, not hidden by severity thresholds.

For a dependency change, inspect the consuming API, test the affected contract,
regenerate native projects when native packages change, build the release bundle,
and verify a clean install. The latest app run passed all 89 suites / 451 tests
and TypeScript; Android ARM64 unsigned Release also compiled. Native runtime,
signed artifacts, iOS, and the RELRO issue in `native-builds.md` remain open.
