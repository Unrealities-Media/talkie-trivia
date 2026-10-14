const { withProjectBuildGradle } = require("expo/config-plugins")

const ndkVersion = "30.0.16248370"
// The 1.1.7 prebuilt shared counter fails RELRO end alignment. Keep the
// DataStore family together; 1.2.1's ARM64 binary passes the artifact check.
const datastoreVersion = "1.2.1"
const marker = "// Talkie: 16 KB native page-size configuration"
const endMarker = "// End Talkie: 16 KB native page-size configuration"
const anchor = 'apply plugin: "expo-root-project"'

function configureAndroidPageSize(source) {
  if (source.includes(marker)) {
    const start = source.indexOf(marker)
    const end = source.indexOf(endMarker, start)
    if (source.split(marker).length !== 2 || source.split(endMarker).length !== 2 || end < start) {
      throw new Error("Native page-size block is outdated or malformed; regenerate with npm run native:generate -- android.")
    }
    // Replace our owned block so repeated prebuilds apply changed pins/flags.
    // Returning early here silently retains stale configuration after upgrades.
    source = source.slice(0, start) + source.slice(end + endMarker.length).replace(/^\r?\n\r?\n/, "")
  }
  if (source.split(anchor).length !== 2) {
    throw new Error("Expo root Gradle template changed; review the NDK/page-size configuration.")
  }
  // Configure every Android module at DSL finalization: changing only the app
  // leaves native libraries in dependencies compiled with the old settings.
  const block = `${marker}
ext.ndkVersion = "${ndkVersion}"
subprojects { nativeProject ->
    nativeProject.configurations.configureEach {
        resolutionStrategy.eachDependency { dependency ->
            if (dependency.requested.group == "androidx.datastore") {
                dependency.useVersion("${datastoreVersion}")
                dependency.because("Use the DataStore release with a 16 KB aligned native shared counter")
            }
        }
    }
    ["com.android.application", "com.android.library"].each { pluginId ->
        nativeProject.pluginManager.withPlugin(pluginId) {
            nativeProject.extensions.getByName("androidComponents").finalizeDsl { androidDsl ->
                androidDsl.ndkVersion = rootProject.ext.ndkVersion
                def cmakeArgs = androidDsl.defaultConfig.externalNativeBuild.cmake.arguments
                ["CMAKE_SHARED_LINKER_FLAGS", "CMAKE_MODULE_LINKER_FLAGS"].each { variable ->
                    def prefix = "-D" + variable + "="
                    def existing = cmakeArgs.findAll { it.startsWith(prefix) }
                    if (existing.size() > 1) {
                        throw new GradleException("Conflicting native linker arguments in " + nativeProject.path)
                    }
                    def original = existing ? existing[0].substring(prefix.length()) : ""
                    cmakeArgs.removeAll(existing)
                    cmakeArgs.add(prefix + original + " -Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384")
                }
                cmakeArgs.removeAll { it.startsWith("-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=") }
                cmakeArgs.add("-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON")
            }
        }
    }
}
${endMarker}

`
  return source.replace(anchor, block + anchor)
}

module.exports = config => withProjectBuildGradle(config, mod => {
  if (mod.modResults.language !== "groovy") throw new Error("Review page-size configuration for the new Gradle format.")
  mod.modResults.contents = configureAndroidPageSize(mod.modResults.contents)
  return mod
})
module.exports.configureAndroidPageSize = configureAndroidPageSize
module.exports.ndkVersion = ndkVersion
module.exports.datastoreVersion = datastoreVersion
