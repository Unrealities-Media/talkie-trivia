# Android native library compatibility investigation

This records binary evidence for audit finding 05. Successful compilation does
not establish 16 KB device compatibility. The release check runs SDK `zipalign`
and NDK `llvm-readelf` against the actual packaged 64-bit libraries, including
the [RELRO end-alignment check](https://developer.android.com/guide/practices/page-sizes#relro-flag).

## Source-built libraries

`plugins/withAndroidPageSize.cjs` selects NDK r30 (30.0.16248370). Both 64-bit
ABIs compile and a limited x86_64 device smoke test passes; full compatibility
remains blocked below. The preceding verified build used r28c (28.2.13676358).
The plugin applies both
`max-page-size=16384` and `common-page-size=16384` linker settings at Android DSL
finalization for every application/library module. The first rebuilt ARM64 APK
reduced failures from 23 to 15. These eight formerly failing libraries now pass:
expo-modules-core, gesturehandler, react_codegen_rnscreens, react_codegen_rnsvg,
react_codegen_safeareacontext, reanimated, rnscreens and worklets.

That intermediate APK had SHA-256
`a2d25a54fb589b5efbe3c7230b2dd985bb672cdb84279ccc1bef1d54a7a340f1`
and size 58,494,072 bytes. See `../native-builds.md` for the latest packaged result.

## Prebuilt candidate inspection

Downloaded AARs were inspected separately before choosing dependency changes.
These ARM64 results concern the binaries, not API compatibility or device behavior.
Downloads came from Google Maven or Maven Central. No binary was patched, and
RELRO protection was not disabled to make the check pass.

| Candidate | ARM64 result | Decision |
| --- | --- | --- |
| androidx.datastore:datastore-core-android:1.2.1 | Shared counter passes LOAD and RELRO | Select the stable 1.2.1 family together; verify the rebuilt APK and storage behavior. |
| androidx.graphics:graphics-path:1.1.0 | RELRO fails | Upgrade alone does not resolve it. |
| com.facebook.fresco native artifacts:3.9.0 | gifimage and native-imagetranscoder pass; imagepipeline, native-filters and static-webp fail | No broad Fresco override applied. |
| com.facebook.fbjni:fbjni:0.8.1 | fbjni passes; bundled c++_shared fails | No standalone override applied; C++ and React Native compatibility need review together. |
| com.squareup.zstd:zstd-kmp-android:0.4.0 | RELRO fails | Same version as installed; source/upstream fix required. |
| com.github.penfeizhou.android.animation:gif:3.0.5 | RELRO fails | Same version as installed; source/upstream fix required. |
| io.sentry:sentry-native-ndk:0.17.3 | sentry passes; sentry-android fails | No override applied; changing the native SDK alone is insufficient. |

[DataStore's release notes](https://developer.android.com/jetpack/androidx/releases/datastore#1.2.1)
identify 1.2.1 as stable. The downloaded core AAR's SHA-256 was
`435edad7bcb1fbb1a2a46de7be4d6daf299479b3328ebf757ebdfe02810cbdd8`.
The local candidate report, including exact URLs and all hashes, is preserved in
ignored `.expo/native-candidates/report.json`. Candidate downloads are not app
dependencies unless explicitly configured by the plugin.

A follow-up checked FBJNI 0.8.1's x86_64 binary too: its RELRO end is 188416
and fails the 16 KB check, although ARM64 passes. Comparing ARM64 exported
symbol names with the packaged 0.7.0 library found 37 removed names, none
referenced by the other libraries in the verified r28c APK. This does not prove
ABI compatibility, and upgrading to 0.8.1 alone cannot satisfy both ABI gates.
The full result is `.expo/fbjni-candidate-report.json`; no override was applied.

## React Native/Hermes source-build experiment

An isolated copy of the installed React Native 0.86.3 and its pinned Hermes
source compiled an unsigned ARM64 Release APK. This experiment uses NDK
28.2.13676358 and both linker flags above, including in the React Native
composite build. App-level Gradle settings alone do not configure that build.

Artifact SHA-256:
`7d0bb8a54970fb1359bd7611cd31a8932a21ab08978df542652ce1748b980575`
(58,142,895 bytes). All 28 LOAD checks and ZIP alignment pass. RELRO failures
fall from 14 to 11: `libhermestooling.so`, `libjsi.so` and `libhermesvm.so` now
pass. `libreactnative.so` also passes. The remaining failures are graphics.path,
animation-decoder-gif, c++_shared, fbjni, gifimage, imagepipeline, native-filters,
native-imagetranscoder, sentry, static-webp and zstd-kmp.

The local experiment/report are in ignored `.expo/prepare-source-probe.cjs`,
`.expo/build-source-probe.ps1` and `.expo/source-apk-page-size-report.json`.
Required adjustments included unique Gradle placeholder directories, resolving
the nested codegen package, substituting both Hermes Maven groups, Windows
CMake path normalization and a short native staging directory. The copy filter
must preserve source directories named `build`, including ReactBuildConfig.
The Hermes host compiler needed MSVC and CMake 3.30.5 on this Windows host.

The experiment is now implemented by `withReactNativeSource.cjs` and
`prepare-react-native-source.cjs`. A fresh generated project/source copy using
those files completed ARM64 Release compilation (982 tasks, 950 executed).
Its APK SHA-256 is
`035c71631c177a1351800bf551f46909e4ef2f7b9fe0e7774ba7bbae780bb9f9`
(58,142,907 bytes). ZIP/all 28 LOAD checks pass, with the same 11 RELRO failures.
The preparation script guards its upstream version/patches and generated-directory
ownership, preserves legitimate source directories named `build`, and reuses an
unchanged copy. It leaves installed dependencies untouched. The plugin applies
during Android prebuild, including EAS; iOS generation is unchanged.

The fresh fixture reused installed locked dependencies and the Gradle download
cache. Verify a clean dependency install, remote CI, every required ABI and
native behavior before claiming full reproducibility/compatibility. No
source-built APK has been signed for distribution. A later r30 development
artifact was installed using a disposable test certificate, as recorded below.

## NDK r30 baseline

The [current NDK LTS release](https://developer.android.com/ndk/downloads) is r30
(30.0.16248370). A side-by-side installation using already accepted SDK licenses
provided a candidate C++ runtime: its ARM64 and x86_64 LOAD/RELRO checks pass.
ARM64 SHA-256 is
`7466ed097631a564ed6bff0b47768caa76bf03270d2047b5a65c03f497b824df`;
x86_64 SHA-256 is
`7918ebd0b8074c312d0c610205d49760b98c008026e6b817cd92103a3e12241b`.
Compared with the currently packaged ARM64 runtime, 12 old exported symbol
names are absent; none is referenced by that APK's other native libraries.
This is a narrow static comparison, not proof of ABI or device compatibility.
The candidate/report are recorded in `.expo/ndk30-runtime-report.json`. The
plugin now selects r30 and both ARM64/x86_64 Release compilation pass. The
merged, pre-strip C++ library hashes match those NDK candidates exactly. Both
packaged/stripped C++ libraries pass LOAD and RELRO, reducing the ARM64 failures
from 11 to 10. All 56 libraries pass LOAD and ZIP alignment; **19 RELRO failures
remain: 10 ARM64 and 9 x86_64**. The x86_64 failures are graphics.path,
avif_android, fbjni, gifimage, imagepipeline, native-filters, sentry, static-webp
and zstd-kmp. ARM64 retains the earlier list minus c++_shared.

That APK is 84,154,443 bytes, SHA-256
`865db06c2b90b3cabe4aa6c739d067d909383017e4452322ca067192d046a0ad`.
Its report is `.expo/r30-routes-apk-page-size-report.json`. See the
[device smoke test](android-device-smoke.md) for installed startup, guessing,
process-death recovery, completion and first-win statistics evidence, plus
fixture corrections and remaining accessibility/compatibility failures.

## FBJNI source follow-up (2026-10-13 local / 2026-10-14 UTC)

The app now builds FBJNI 0.7.0 from unmodified upstream CMake/C++/Java sources,
pinned to commit `474795fa9ff0dda60b838871171be935432bae16` in
`vendor/fbjni/upstream.json`. The Apache 2.0 license is retained. The imported
archive SHA-256 is
`0675c0b4ad39003062d98dfbec8e98e45e35df53bad6b63f94899bf1f3fc9ca8`.
The module uses the app's NDK and page-size flags, publishes its headers through
Prefab and replaces the Maven dependency through `withFbjniSource.cjs`.
React Native's included build still compiles against its matching 0.7.0 Maven
dependency. No newer FBJNI API is substituted.

Generation checks the React Native dependency version, exact imported file set
and every source hash, rejects source symlinks and preserves unrelated Gradle
configuration. `.gitattributes` keeps upstream bytes LF on Windows checkouts.
All 13 focused environment/build-guard checks pass, including modified, added,
removed and missing-manifest-entry source failures. Expo prebuild in the isolated
fixture generates both module inclusion and dependency substitution successfully.

The full app compiled for ARM64/x86_64 in 2m 26s (1,085 tasks, 251 executed).
Unsigned APK: 84,106,095 bytes, SHA-256
`3c7fc4905982c03a3674ff8f3d437a2af8f9e6763f7facc3e47fd6496d140d6d`.
Both packaged FBJNI libraries now pass LOAD and RELRO checks. ZIP alignment and
all 56 LOAD checks pass; **17 RELRO failures remain: 9 ARM64 and 8 x86_64**.
ARM64 failures: graphics.path, animation-decoder-gif, gifimage, imagepipeline,
native-filters, native-imagetranscoder, sentry, static-webp and zstd-kmp.
x86_64 failures: graphics.path, avif_android, gifimage, imagepipeline,
native-filters, sentry, static-webp and zstd-kmp. The verifier still exits nonzero.

The actual packaged FBJNI export comparison finds seven removed symbol names on
each ABI. Only two are referenced by packaged consumers (C++ bad_function_call
type information and vtable); both are supplied by the packaged C++ runtime.
This is a bounded static check, not full ABI proof. Eighteen packaged native
libraries changed because the app's FBJNI consumers also rebuilt; compatibility
claims cannot rely on those consumers being byte-identical to the previous APK.

A copy signed with the existing disposable local emulator certificate has SHA-256
`f8264402b9e44e0973f8fd37ebb3e4df0129064653a1b579158274abc3132f8f`.
On API 36 x86_64 with verified 16,384-byte pages, a separate Android user profile
passed guest startup, title search, long-press preview, visible poster rendering,
one-guess Medium completion, Profile navigation, cold restart and background/resume.
Backend assertions verify one game/history result, one credited win and 700 points.
All ten prior accounts/123 records remain unchanged; the new guest adds four
records. The eleven-account/127-record state was exported before stopping services.

Four hierarchy assertions and both app-process log checks pass. The first
UiAutomation connection timed out, and result-screen hierarchy captures returned
empty status; these attempts are not counted as passing checks. Completion,
restart and resume results were instead checked through screenshots and backend
records. No app crash, native link error or known view-mount error appears in the
captured app-process logs. The emulator owner profile was restored; test services
were stopped. These checks do not cover physical ARM64, 4 KB, iOS, every native
API or release signing.

Local evidence: `.expo/fbjni-source-probe/app-page-size-report.json`,
`packaged-symbol-check.json` in the same directory, and
`.expo/device-proof/fbjni-source/` (screenshots, XML, process logs and backend/UI
assertions). The signed artifact/report are in
`.expo/device-proof/r30-fbjni-source/`; the backend export is
`.expo/device-proof/firebase-export-fbjni-final/`.

## Remaining work

Resolve React Native/Hermes/FBJNI/C++ dependencies together with ABI compatibility
checks; changing the application's NDK does not rebuild their published AARs.
Resolve the other failing SDKs through compatible upstream builds or reproducible
source builds. Recheck every packaged ABI after each final dependency change.
Then install and exercise signed release artifacts on 4 KB and 16 KB environments,
covering startup, image rendering, storage, background/resume and gameplay.
The AAB's generated APKs need their own check before submission.

The native CI gate deliberately fails while incompatible libraries remain. It
must not be waived based on successful JavaScript tests or APK compilation.
