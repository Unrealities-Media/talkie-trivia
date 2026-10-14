# Native builds and environment isolation

## Source of truth

Native projects are generated from `app.config.js`, `config/appEnvironment.cjs`,
`plugins/`, the locked dependencies and Expo template **57.0.30**. `android/` and
`ios/` are ignored build output. Do not hand-edit them or restore the old SDK-era
projects. Change app config or a config plugin and regenerate instead.

The migration removes the old checked-in projects, including obsolete React Native
entry points, disabled New Architecture settings, Android API 34 overrides,
debug-key release signing and Sentry upload configuration. Android's back/linking
and splash handling and iOS's linking/notification forwarding were generated Expo
code; the current template/plugins replace them. App icons, splash assets, package
identity, portrait preference, tablet support and URL schemes now come from config.
The old Google URL scheme is replaced by each environment's explicit iOS OAuth ID.
There is no native Firebase SDK configuration: the app uses the Firebase JS SDK.
The old broad ProGuard rules and manually accumulated privacy manifest are not
copied blindly; release native compilation, merged SDK privacy manifests and actual
data disclosures must be reviewed before submission.

The pre-migration native directories were preserved locally under
`.expo/legacy-native-before-cng/`; Git retains the previous source. While reviewing
the migration, use an isolated build checkout to avoid recreating deleted tracked
files in the review. After committing the source removal, normal local generation
is safe. The generator refuses to clean existing tracked or linked native folders.

Expo's [CNG guide](https://docs.expo.dev/workflow/continuous-native-generation/)
explains why the native directories must be absent from the EAS upload for app
config/plugins to be applied. `.easignore` explicitly excludes both directories
and local secrets. It replaces, rather than augments, `.gitignore`; keep secret
exclusions aligned when changing either file.

## Environments

| Variant | App identity | Firebase | OAuth |
| --- | --- | --- | --- |
| `development` (local default) | Talkie Dev / `com.unrealities.talkietrivia.dev` | `demo-*` emulators only | Optional `_DEV` IDs |
| `preview` | Talkie Preview / `com.unrealities.talkietrivia.preview` | Explicit `_PREVIEW` config | Explicit `_PREVIEW` IDs |
| `production` | Talkie Trivia / `com.unrealities.talkietrivia` | Explicit unsuffixed config | Explicit unsuffixed IDs |

Copy `.env.example` to a local `.env` or supply variables in your shell. Firebase
client configuration and OAuth client IDs are public configuration, not backend
credentials. Never put service-account keys, OAuth client secrets or signing keys
in app config/`extra`, which are bundled into the app.

Live variants require distinct preview and production project IDs and all selected
Firebase/Google values. There is no fallback from preview to production. Unknown
variants, a live development project, incomplete live settings and the old E2E
auth bypass fail configuration. EAS builds require an explicit variant. This
validation proves configuration separation, not ownership or readiness of a cloud
project; an actual isolated staging project and provider registrations are still
required. Configure the relevant EAS environment with the same public variables.

The client uses `firebaseUseEmulators`, not `__DEV__`, to choose its backend. Thus a
preview debug build still targets its selected cloud project. Auth, Firestore,
callables and account-deletion status share the selected emulator host. Android
emulators default to `10.0.2.2`; iOS simulators/web default to `localhost`. For a
physical device, set `FIREBASE_EMULATOR_HOST` to the development computer's LAN
hostname/IP, configure emulator bind addresses, and allow only that trusted local
network through the firewall. Never expose emulators to the public internet.
Emulator setup errors now fail visibly instead of silently continuing against the
wrong backend. See [emulator testing](emulator-testing.md) for ports and seeding.

## Local generation and compilation

Use Node **24.21.0**, Java **21**, Android SDK **36**, and macOS/Xcode for iOS.
The React Native package currently requires iOS 15.1 or later. Native CI selects
Xcode **26.3** explicitly from the documented
[macOS 15 runner image](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md),
rather than inheriting its older default Xcode.

```sh
npm ci
npm run test:config
npm run native:generate -- android
# On macOS:
npm run native:generate -- ios
cd ios
pod install
```

The local generator downloads the exact template and verifies its recorded SHA-512
before running the installed Expo CLI. A hash mismatch stops generation. `all` is
supported only on macOS; other hosts default to Android and reject iOS requests.
Regenerate after changing variants, native dependencies or app config. Generation
uses `--no-install`: dependency installation and iOS `pod install` are explicit.
Once generated, `npm run android` / `npm run ios` can launch local native builds.

Android generation now prepares React Native 0.86.3 and its pinned Hermes for
source compilation in `.expo/react-native-source`. The Expo plugin runs for
local and EAS Android prebuilds; it does not change iOS generation or installed
`node_modules`. It validates the upstream patch locations, resolves the actual
nested codegen package, and substitutes both current/legacy Hermes Maven groups.
The copied Gradle build receives the same NDK and 16 KB linker settings as the
app build. Do not also enable Expo's `buildReactNativeFromSource` option: this
plugin owns the included build and its compatibility adjustments.

Android also builds pinned FBJNI 0.7.0 from `vendor/fbjni` through
`withFbjniSource.cjs`. Keep that directory in source control and EAS uploads,
including its upstream license and hash manifest. Prebuild rejects source drift,
extra globbed implementation files and a changed React Native FBJNI version.
The app substitutes the source module for Maven FBJNI; React Native's composite
build retains the same-version Maven compile dependency. See
[native library evidence](audits/android-native-libraries.md#fbjni-source-follow-up-2026-10-13-local--2026-10-14-utc)
for the binary/symbol checks and bounded device acceptance.

The generated copy has an ownership/input marker. Repeated generation preserves
its build outputs when the lockfile, preparation script and patched input files
are unchanged. Changed inputs refresh only the owned generated directory. An
unowned directory, linked output path, unsupported React Native version or
changed upstream patch location stops generation instead of silently using a
different build. After upgrading React Native, review the source patches and
verify release artifacts before updating the version guard.

Source compilation needs a host C/C++ compiler plus the Android SDK command-line
tools, the NDK version pinned in `withAndroidPageSize.cjs`, and CMake 3.30.5.
The current r30 pin compiles both 64-bit ABIs and passes a limited x86_64
device smoke test; full library compatibility remains blocked. On Windows, launch Gradle from an x64 Visual
Studio developer environment (MSVC/NMake); plain PowerShell lacks the host
compiler used to build `hermesc`. The verified local toolchain uses Visual Studio
2022. Linux/macOS need their normal native compiler/make toolchain. The first
build downloads upstream native dependencies and compiles Hermes, so allow
additional time and disk space. CI's Android timeout is 75 minutes.
The native-path plugin sets
[`CMAKE_OBJECT_PATH_MAX`](https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html)
to 240 so CMake hashes long generated object paths before Windows Ninja fails.
Very deep checkout paths can still exceed native-tool limits; use a short checkout
path if CMake reports that even its hashed paths cannot fit.
On Windows, keep `GRADLE_USER_HOME` short as well: headers inside its transformed
dependency cache are input files, which CMake's object-path hashing cannot shorten.
For a deep checkout, the native-path plugin also accepts the Gradle property
`-Ptalkie.cmakeStagingDirectory=C:/short/path` to place the app's generated native
objects in a shorter, dedicated directory. Use a distinct directory per checkout;
never point it at source files or reuse it across concurrent builds. After moving
the Gradle cache, clear generated release CMake/Ninja caches that retain the old
absolute header paths before rebuilding.
The source build separately accepts
`-Ptalkie.reactNativeCmakeStagingDirectory=C:/short/rn-path`; it creates distinct
ReactAndroid/Hermes subdirectories below that absolute path. Use a dedicated
path per checkout, separate from the app staging directory. Short staging paths
do not shorten the checkout's source paths; use a short checkout if those exceed
the compiler's limits.

For an Android release compile without store credentials:

```sh
cd android
# Windows: use gradlew.bat instead of bash gradlew
bash gradlew :app:assembleRelease --no-daemon --console=plain -PreactNativeArchitectures=arm64-v8a
```

This produces an **unsigned** artifact with the configured environment. The
release-signing plugin removes the template's debug-key fallback; it rejects
unrecognized template structure. Debug builds retain their normal debug key.
Unsigned compilation is a build check, not an installable/store-approved release.
Do not manually substitute the debug keystore to make a release installable.

## EAS and CI

`eas.json` pins EAS CLI **24.13.0**, Node and the prebuild template. Development
builds use demo backends; preview builds use separate cloud configuration and
internal distribution; production builds create store artifacts. Live build
numbers use EAS remote versioning and auto-increment. No credentials are committed
and no build or submission is automatically triggered by these profiles.

EAS's documented [prebuild override](https://docs.expo.dev/eas/json/#prebuildcommand)
uses the same exact template version as the local generator; EAS resolves the npm
package itself, whereas the local wrapper additionally verifies the recorded hash.
EAS injects Android signing after generation, as described in its
[Android build process](https://docs.expo.dev/build-reference/android-builds/).
No post-install hook regenerates iOS after CocoaPods or signing setup.

`.github/workflows/native-builds.yml` generates native projects from a clean
checkout and compiles Android ARM64 Release and iOS Simulator Release with the
demo environment and no account/signing secrets. It retains failure diagnostics.
These jobs exercise native dependencies and production-mode JS bundling; they do
not verify live OAuth, store certificates, backend deployment or gameplay on a
device. Remote workflow execution has not yet been observed.

## Remaining release gates

Local evidence across stages: seven configuration/signing tests, 451 app tests,
TypeScript, online Expo Doctor (21/21 checks), development/preview generation,
Android x86_64 Debug and unsigned Release builds passed. The release artifact's
signature verification failed as expected for an unsigned APK. This is separate
from the following outstanding requirements.

Previous prebuilt alignment baseline: regenerated Android using the checked-in clean
generator and compiled unsigned **ARM64 Release** with NDK r28c (28.2.13676358),
16 KB maximum/common linker page sizes across source modules, and DataStore 1.2.1.
Gradle completed 874 tasks (842 executed). The resulting
APK is 58,584,495 bytes, SHA-256
`430bd09f6332bdee5e68a14285947ee04e045cb842d1173b6c3aab02eddbf7e1`.
It is a development-identity/demo-backend artifact, not a signed store build.
`zipalign -c -P 16 4` passes, and all 28 shared libraries extracted from the APK
have LOAD segment alignment of at least 16 KB.

**16 KB compatibility is still unproven and has a concrete failed check.**
Following the [Android RELRO guidance](https://developer.android.com/guide/practices/page-sizes#relro-flag),
`llvm-readelf -lW` finds that 14 of those libraries have a nonzero remainder for
`(GNU_RELRO.VirtAddr + GNU_RELRO.MemSiz) % 0x4000`. This includes
androidx.graphics.path, animation-decoder-gif, c++_shared,
fbjni, gifimage, hermestooling, hermesvm,
imagepipeline, jsi, native-filters, native-imagetranscoder,
sentry, static-webp and zstd-kmp.
Do not infer runtime compatibility from the successful build/ZIP/LOAD checks.
The eight source-built failures and DataStore's failure are resolved in this APK;
the remaining failures in that baseline are in prebuilt dependencies. Review compatible replacements
or reproducible source builds, then repeat ELF/ZIP checks and installed 16 KB device
tests. Merely aligning the ZIP or changing the app's NDK cannot repair a prebuilt
library. Raw local evidence is in ignored `.expo/android-page-size-report.json`;
the artifact hash above identifies the inspected binary.

Previous r28c source-build result: a fresh generated Android project and source copy,
using the checked-in plugin/preparation script, compiled ARM64 Release in
12m30s (982 tasks; 950 executed). It reused the installed locked dependencies
and the local Gradle download cache; this is not evidence of a fresh dependency
install or a remote Linux CI run. Its unsigned APK is 58,142,907 bytes, SHA-256
`035c71631c177a1351800bf551f46909e4ef2f7b9fe0e7774ba7bbae780bb9f9`.
ZIP and all 28 LOAD checks pass. Rebuilt hermestooling, hermesvm and jsi pass
RELRO, reducing failures from 14 to **11**. The other libraries listed above
still fail. The report is `.expo/clean-source-apk-page-size-report.json`.
Fresh generation verified cache reuse, preservation of real source folders
named `build`, ownership rejection and unchanged installed sources. All 12
configuration contracts and workflow YAML parsing pass.

Device infrastructure: WHPX acceleration is usable outside the execution
sandbox. A separate workspace-local API 36 Google APIs 16 KB x86_64 AVD booted
and returned `sys.boot_completed=1` and `getconf PAGE_SIZE=16384`. First boot
during native compilation showed a System UI ANR and stale ADB transport;
targeted ADB reconnect restored shell access. The emulator was then stopped
without wiping its data. A second boot with 4 GB RAM/four cores reached its home
screen without an ANR event. Existing user AVDs were not changed.

Earlier r30 result: both ARM64/x86_64 Release compilation succeeds. The packaged
C++ runtime now passes alignment, leaving 10 ARM64 and 9 x86_64 RELRO failures
across 56 libraries; all LOAD/ZIP checks pass. The final unsigned APK is
84,154,443 bytes, SHA-256
`865db06c2b90b3cabe4aa6c739d067d909383017e4452322ca067192d046a0ad`.
A copy signed with a disposable local-only certificate passed a limited 16 KB
emulator flow: guest startup, search, wrong guess, process-death recovery,
correct guess, first-win chart and authoritative record checks. Search results
have invalid native accessibility bounds. See the
[device smoke-test record](audits/android-device-smoke.md) for exact evidence,
fixture route/cache corrections and limits. This does not waive the binary
gate or prove store signing, native OAuth, all-device compatibility or iOS.

Latest FBJNI follow-up: source rebuilding reduces RELRO failures to **17**
(9 ARM64, 8 x86_64). All 56 LOAD checks and ZIP alignment pass. The unsigned
APK SHA-256 is `3c7fc4905982c03a3674ff8f3d437a2af8f9e6763f7facc3e47fd6496d140d6d`.
Thirteen focused config/source guards and isolated Expo generation pass. The
full source-built app passes bounded x86_64/16 KB startup, image/search/preview,
completion and restart/resume checks. Prior test records are preserved.
The [native library investigation](audits/android-native-libraries.md) records
artifact identity, symbol differences, automation failures and remaining gates.

`scripts/verify-android-page-size.py` performs all three checks and exits nonzero
on any failure. Native CI runs its five regression tests and applies the check
after compiling; the present prebuilt failures are expected to fail that gate.
Run locally against the generated artifact (use the corresponding Windows/macOS
tool paths on those hosts):

```sh
NDK_VERSION=$(node -p 'require("./plugins/withAndroidPageSize.cjs").ndkVersion')
python3 scripts/verify-android-page-size.py android/app/build/outputs/apk/release/app-release-unsigned.apk \
  --readelf "$ANDROID_HOME/ndk/$NDK_VERSION/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf" \
  --zipalign "$ANDROID_HOME/build-tools/36.0.0/zipalign" \
  --report .expo/android-page-size-report.json
```

The page-size plugin replaces its own generated block on subsequent prebuilds;
malformed/older unbounded blocks require the clean generator. Actual clean
generation and repeated application passed, as did seven configuration tests.
A supplemental comparison found no NDK r28 C++ exports missing from the bundled
C++ runtime (2,340 exports in each); this is not an ABI/device compatibility proof.
See [native dependency investigation](audits/android-native-libraries.md) for
the source-library fixes, upstream candidate binary results and next actions.

- Compile the clean generated iOS project on macOS, install Android/iOS builds,
  and test startup, fonts, images, dark mode, deep links, system bars and navigation.
- Verify live preview and production identities, Google registration/signing
  fingerprints, Apple sign-in and return URLs on real devices.
- Create/review protected signing credentials and account access; verify an actual
  signed AAB and iOS archive, build numbers, upgrade behavior and internal-store
  installation. Preserve the upload key through the established store workflow.
- Inspect merged permissions, backup/restore behavior, privacy manifests and
  network traffic. The encryption exemption declaration needs final verification
  against the shipped binary and submission answers. Disabled optional telemetry
  is not a substitute for these checks.
- Resolve the ARM64 RELRO failures above and verify 16 KB page-size compatibility
  and release performance on supported devices; compilation alone proves neither.
- Review dependency advisories independently of Expo compatibility checks. Online
  Expo Doctor passed 21/21 checks during this stage; this does not prove security
  advisories resolved or native runtime behavior correct. Repeat after SDK changes.
- Keep OTA updates disabled until catalog/runtime compatibility and rollback are
  verified. No production deployment or store submission has occurred.
