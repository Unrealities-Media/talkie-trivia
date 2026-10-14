const { withAppBuildGradle } = require("expo/config-plugins")

// Ninja on Windows can fail creating React Native codegen object directories
// beneath ordinary checkout paths. Ask CMake to hash long object paths earlier.
const marker = "// Talkie: bound native object paths for Windows Ninja"
function configureNativeBuildPaths(source) {
  if (source.includes(marker)) return source
  return `${source}\n${marker}\nandroid {\n    defaultConfig {\n        externalNativeBuild {\n            cmake {\n                arguments "-DCMAKE_OBJECT_PATH_MAX=240"\n            }\n        }\n    }\n    externalNativeBuild {\n        cmake {\n            def shortStaging = findProperty("talkie.cmakeStagingDirectory")\n            if (shortStaging != null) {\n                buildStagingDirectory file(shortStaging)\n            }\n        }\n    }\n}\n`
}

module.exports = config => withAppBuildGradle(config, mod => {
  if (mod.modResults.language !== "groovy") throw new Error("Review native build paths for the new Gradle format.")
  mod.modResults.contents = configureNativeBuildPaths(mod.modResults.contents)
  return mod
})
module.exports.configureNativeBuildPaths = configureNativeBuildPaths
