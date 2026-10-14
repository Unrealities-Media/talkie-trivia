# Temporary CommonJS security backport

This is the **unmodified decoding implementation** from upstream
`decode-uri-component@0.5.0`, with only its `export default` declaration replaced by
`module.exports` and an attribution comment added. The MIT license is preserved;
`upstream.json` records source/archive hashes. This is an app-maintained backport,
not a claim that the upstream author publishes a CommonJS 0.5 release.

Expo Router 57 imports query-string 7 as a CommonJS namespace, and that parser
requires its decoder as a callable CommonJS export. Directly overriding its
decoder to the ESM-only upstream release changes that contract. This package
preserves the existing module interface while incorporating the upstream fix for
[GHSA-vcc3-ghjq-m6fr](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr).

Keep this package as a direct local dependency and reference it in overrides with
`$decode-uri-component`. A relative file override without that direct dependency
can create an invalid nested path in npm's lockfile that fails clean installs.

`scripts/dependency-contracts.test.cjs` verifies the effective query-string
resolution, normal/malformed inputs and a bounded-time malformed-input regression
in a separate process. It also verifies that the vendored algorithm still matches
the recorded upstream source hash after reversing the module-export adaptation.

Review upstream advisories whenever dependencies change. Remove this package and
the npm override once the supported Expo Router dependency chain consumes a
patched decoder with a compatible module interface. Do not silently edit the
algorithm or its provenance hashes to make a regression pass.
