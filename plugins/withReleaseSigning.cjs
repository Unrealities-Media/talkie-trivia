const { withAppBuildGradle } = require("expo/config-plugins")

// EAS injects its protected signing config after prebuild. Plain local release
// tasks must remain unsigned unless the developer supplies upload credentials.
function removeDebugReleaseSigning(source) {
  const release = /release\s*\{([\s\S]*?)signingConfig signingConfigs\.debug/
  if (!release.test(source)) {
    if (source.includes("// Talkie: release signing is supplied by EAS")) return source
    throw new Error("Android template changed: review release signing before generating a build.")
  }
  return source.replace(release, "release {$1// Talkie: release signing is supplied by EAS\n            signingConfig null")
}

module.exports = config => withAppBuildGradle(config, mod => {
  if (mod.modResults.language !== "groovy") throw new Error("Review release signing for the new Gradle format.")
  mod.modResults.contents = removeDebugReleaseSigning(mod.modResults.contents)
  return mod
})
module.exports.removeDebugReleaseSigning = removeDebugReleaseSigning
