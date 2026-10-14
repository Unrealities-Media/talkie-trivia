const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { withSettingsGradle, withProjectBuildGradle } = require("expo/config-plugins")

const marker = "// Talkie: FBJNI source build"
const endMarker = "// End Talkie: FBJNI source build"

function validateSource(root) {
  const source = path.join(root, "vendor/fbjni")
  validateVendoredSource(source)
  const rn = path.dirname(require.resolve("react-native/package.json", { paths: [root] }))
  const versions = fs.readFileSync(path.join(rn, "gradle/libs.versions.toml"), "utf8")
  if (!/^fbjni = "0\.7\.0"\r?$/m.test(versions)) throw new Error("React Native changed its FBJNI dependency; review the source substitution.")
}

function validateVendoredSource(source) {
  if (fs.lstatSync(source).isSymbolicLink()) throw new Error("Pinned FBJNI source must not be a symlink.")
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "upstream.json"), "utf8"))
  if (manifest.version !== "0.7.0" || manifest.commit !== "474795fa9ff0dda60b838871171be935432bae16") {
    throw new Error("Review the pinned FBJNI source version before generating Android.")
  }
  // CMake discovers source files with globbing. Hashing only manifest entries
  // would silently allow added implementation files or directory symlinks.
  const actual = []
  function collect(relative) {
    const file = path.join(source, relative)
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink()) throw new Error(`Pinned FBJNI source must not be a symlink: ${relative}`)
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file)) collect(`${relative}/${name}`)
    } else if (stat.isFile()) actual.push(relative)
    else throw new Error(`Invalid FBJNI source file: ${relative}`)
  }
  for (const relative of ["CMakeLists.txt", "LICENSE", "cxx", "java"]) collect(relative)
  if (JSON.stringify(actual.sort()) !== JSON.stringify(Object.keys(manifest.files).sort())) {
    throw new Error("Pinned FBJNI source file set changed.")
  }
  for (const [relative, expected] of Object.entries(manifest.files)) {
    if (relative.includes("\\") || relative.split("/").some(part => !part || part === ".." || part === ".") || path.isAbsolute(relative)) {
      throw new Error("Invalid FBJNI source manifest path.")
    }
    const file = path.join(source, relative)
    if (fs.lstatSync(file).isSymbolicLink() || crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== expected) {
      throw new Error(`Pinned FBJNI source changed: ${relative}`)
    }
  }
}

function replaceBlock(contents, block) {
  if (contents.includes(marker) || contents.includes(endMarker)) {
    const start = contents.indexOf(marker), end = contents.indexOf(endMarker)
    if (contents.split(marker).length !== 2 || contents.split(endMarker).length !== 2 || end < start || start < 0) {
      throw new Error("Malformed FBJNI source block; regenerate Android.")
    }
    contents = contents.slice(0, start) + contents.slice(end + endMarker.length).replace(/^\r?\n/, "")
  }
  return contents.trimEnd() + `\n\n${marker}\n${block}\n${endMarker}\n`
}

function configureSettings(contents) {
  return replaceBlock(contents, `include(":fbjni")
project(":fbjni").projectDir = file("../vendor/fbjni")`)
}

function configureProject(contents) {
  return replaceBlock(contents, `allprojects { nativeProject ->
    nativeProject.configurations.configureEach {
        resolutionStrategy.dependencySubstitution {
            substitute(module("com.facebook.fbjni:fbjni")).using(project(":fbjni"))
                .because("Rebuild pinned FBJNI 0.7.0 with the app's 16 KB LOAD/RELRO flags")
        }
    }
}`)
}

module.exports = config => {
  config = withSettingsGradle(config, mod => {
    if (mod.modResults.language !== "groovy") throw new Error("Review FBJNI source configuration for the new Gradle format.")
    validateSource(mod.modRequest.projectRoot)
    mod.modResults.contents = configureSettings(mod.modResults.contents)
    return mod
  })
  return withProjectBuildGradle(config, mod => {
    if (mod.modResults.language !== "groovy") throw new Error("Review FBJNI source configuration for the new Gradle format.")
    mod.modResults.contents = configureProject(mod.modResults.contents)
    return mod
  })
}
module.exports.validateSource = validateSource
module.exports.validateVendoredSource = validateVendoredSource
module.exports.configureSettings = configureSettings
module.exports.configureProject = configureProject
