# FBJNI source build

Unmodified CMake, C++ and Java sources from Facebook's FBJNI 0.7.0,
commit `474795fa9ff0dda60b838871171be935432bae16`:
https://github.com/facebookincubator/fbjni/tree/474795fa9ff0dda60b838871171be935432bae16

The Apache 2.0 license is preserved in LICENSE and upstream source headers.
`upstream.json` records every imported file hash and the downloaded source ZIP
SHA-256. No compiled libraries or publishing credentials are vendored.

Talkie's build.gradle compiles these sources using the app's NDK and page-size
settings and publishes FBJNI's headers through Android Prefab. The Expo plugin
substitutes the resulting project for the Maven dependency in the app build.
React Native's included build still uses its pinned 0.7.0 Maven headers/library
when compiling; the app packages the rebuilt same-version implementation.

Generated native/Java outputs go under android/build, outside this source tree.
The plugin checks the exact upstream file set, hashes, absence of source symlinks
and React Native's expected FBJNI version. Git attributes preserve LF bytes
across Windows checkouts. Source additions picked up by CMake globbing are rejected
during prebuild rather than silently compiled. Review the source pin, Java
dependencies, build flags, exported
symbols and device behavior together when upgrading React Native or FBJNI.
