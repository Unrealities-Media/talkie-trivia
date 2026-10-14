const { withDangerousMod, withSettingsGradle } = require("expo/config-plugins")
const { prepareReactNativeSource, sourceDirectory } = require("../scripts/prepare-react-native-source.cjs")

const start = "// Talkie: React Native source build"
const end = "// End Talkie: React Native source build"

function configureSourceBuild(contents) {
  if (contents.includes(start)) {
    const first = contents.indexOf(start)
    const last = contents.indexOf(end, first)
    if (contents.split(start).length !== 2 || contents.split(end).length !== 2 || last < first) {
      throw new Error("Malformed React Native source block; regenerate the Android project.")
    }
    contents = contents.slice(0, first) + contents.slice(last + end.length).replace(/^\r?\n/, "")
  }
  return contents.trimEnd() + `

${start}
includeBuild("../${sourceDirectory}") {
    dependencySubstitution {
        substitute(module("com.facebook.react:react-android")).using(project(":packages:react-native:ReactAndroid"))
        substitute(module("com.facebook.react:react-native")).using(project(":packages:react-native:ReactAndroid"))
        substitute(module("com.facebook.react:hermes-android")).using(project(":packages:react-native:ReactAndroid:hermes-engine"))
        substitute(module("com.facebook.hermes:hermes-android")).using(project(":packages:react-native:ReactAndroid:hermes-engine"))
    }
}
${end}
`
}

module.exports = config => {
  config = withDangerousMod(config, ["android", mod => {
    prepareReactNativeSource(mod.modRequest.projectRoot)
    return mod
  }])
  return withSettingsGradle(config, mod => {
    if (mod.modResults.language !== "groovy") throw new Error("Review source build for the new Gradle format.")
    mod.modResults.contents = configureSourceBuild(mod.modResults.contents)
    return mod
  })
}
module.exports.configureSourceBuild = configureSourceBuild
