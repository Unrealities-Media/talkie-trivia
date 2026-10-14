const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const reactNativeVersion = "0.86.3"
const sourceDirectory = ".expo/react-native-source"
const markerFile = ".talkie-source.json"

function replaceOnce(text, original, replacement, label) {
  if (text.split(original).length !== 2) {
    throw new Error(`React Native source changed: review ${label} before rebuilding.`)
  }
  return text.replace(original, replacement)
}

// Kotlin/Groovy string literal: paths can contain spaces and dollar signs.
function gradleString(value) {
  return JSON.stringify(value.replaceAll("\\", "/")).replaceAll("$", "\\$")
}

function patchSource(source, codegen, ndkVersion) {
  const patches = new Map()
  let settings = fs.readFileSync(path.join(source, "settings.gradle.kts"), "utf8")
  for (const project of ["packages", "packages:react-native"]) {
    settings = replaceOnce(settings,
      `project(":${project}").projectDir = file("/tmp")`,
      `project(":${project}").projectDir = file(".gradle/project-placeholders/${project.replaceAll(":", "-")}").also { it.mkdirs() }`,
      "Gradle placeholder directories")
  }
  patches.set("settings.gradle.kts", settings)

  let react = fs.readFileSync(path.join(source, "ReactAndroid/build.gradle.kts"), "utf8").replaceAll("\r\n", "\n")
  const oldCodegen = `    codegenDir =
        if (file("$rootDir/../@react-native/codegen").exists()) {
          file("$rootDir/../@react-native/codegen")
        } else {
          file("$rootDir/../react-native-codegen")
        }`
  react = replaceOnce(react, oldCodegen, `    codegenDir = file(${gradleString(codegen)})`, "source codegen location")
  react = replaceOnce(react, 'codegenDir.set(file("$rootDir/node_modules/@react-native/codegen"))',
    `codegenDir.set(file(${gradleString(codegen)}))`, "codegen task location")
  patches.set("ReactAndroid/build.gradle.kts", react)

  let hermes = fs.readFileSync(path.join(source, "ReactAndroid/hermes-engine/build.gradle.kts"), "utf8")
  for (const [before, after] of [
    ["jsiDir.absolutePath", "jsiDir.invariantSeparatorsPath"],
    ['"-DJSI_DIR=${jsiDir}"', '"-DJSI_DIR=${jsiDir.invariantSeparatorsPath}"'],
    ['File(hermesBuildDir, "ImportHostCompilers.cmake").toString()', 'File(hermesBuildDir, "ImportHostCompilers.cmake").invariantSeparatorsPath'],
  ]) hermes = replaceOnce(hermes, before, after, "Hermes Windows CMake paths")
  patches.set("ReactAndroid/hermes-engine/build.gradle.kts", hermes)

  patches.set("build.gradle.kts", fs.readFileSync(path.join(source, "build.gradle.kts"), "utf8") + `
// Talkie: configure the included source build separately from the app build.
extra["ndkVersion"] = ${gradleString(ndkVersion)}
subprojects {
  plugins.withId("com.android.library") {
    extensions.configure<com.android.build.gradle.LibraryExtension>("android") {
      defaultConfig.externalNativeBuild.cmake.arguments.addAll(listOf(
        "-DCMAKE_SHARED_LINKER_FLAGS=-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384",
        "-DCMAKE_MODULE_LINKER_FLAGS=-Wl,-z,max-page-size=16384 -Wl,-z,common-page-size=16384",
        "-DCMAKE_OBJECT_PATH_MAX=240"
      ))
      providers.gradleProperty("talkie.reactNativeCmakeStagingDirectory").orNull?.let {
        require(java.io.File(it).isAbsolute) { "talkie.reactNativeCmakeStagingDirectory must be absolute" }
        externalNativeBuild.cmake.buildStagingDirectory = file(it).resolve(project.name)
      }
    }
  }
}
`)
  return patches
}

function includeSourceFile(source, file) {
  const relative = path.relative(source, file).replaceAll("\\", "/")
  const outputs = ["build", "ReactAndroid/build", "ReactAndroid/hermes-engine/build"]
  return !relative.split("/").includes(".cxx") &&
    !outputs.some(output => relative === output || relative.startsWith(output + "/"))
}

function prepareReactNativeSource(projectRoot) {
  const root = fs.realpathSync(projectRoot)
  const source = path.dirname(require.resolve("react-native/package.json", { paths: [root] }))
  const version = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8")).version
  if (version !== reactNativeVersion) throw new Error(`Review source-build patches for React Native ${version}; expected ${reactNativeVersion}.`)
  const codegen = path.dirname(require.resolve("@react-native/codegen/package.json", { paths: [source] }))
  const { ndkVersion } = require("../plugins/withAndroidPageSize.cjs")
  // Validate all upstream anchors before touching the generated copy.
  const patches = patchSource(source, codegen, ndkVersion)
  const hash = crypto.createHash("sha256")
    .update(fs.readFileSync(__filename)).update(ndkVersion).update(source).update(codegen)
    .update(fs.readFileSync(path.join(root, "package-lock.json")))
  for (const [file, contents] of patches) hash.update(file).update(contents)
  const fingerprint = hash.digest("hex")
  const parent = path.join(root, ".expo")
  fs.mkdirSync(parent, { recursive: true })
  if (fs.realpathSync(parent) !== parent) throw new Error("Refusing linked .expo source-build output directory.")
  const target = path.join(root, sourceDirectory)
  if (path.dirname(target) !== parent) throw new Error("Source-build output must stay inside .expo.")
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error("Refusing linked source-build output directory.")
    const manifestPath = path.join(target, markerFile)
    if (!fs.existsSync(manifestPath)) throw new Error("Source-build directory is not owned by the generator; preserve or relocate it before generating.")
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    if (manifest.owner !== "talkie-react-native-source") throw new Error("Source-build ownership marker is invalid.")
    if (manifest.fingerprint === fingerprint && manifest.complete === true) return target
    // Only this exact, owned, non-linked generated directory may be refreshed.
    fs.rmSync(target, { recursive: true, force: true })
  }
  fs.mkdirSync(target)
  const manifestPath = path.join(target, markerFile)
  const manifest = { owner: "talkie-react-native-source", fingerprint, complete: false }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest))
  fs.cpSync(source, target, { recursive: true, dereference: true, filter: file => includeSourceFile(source, file) })
  for (const [file, contents] of patches) fs.writeFileSync(path.join(target, file), contents)
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, complete: true }, null, 2) + "\n")
  return target
}

module.exports = { prepareReactNativeSource, patchSource, includeSourceFile, gradleString, sourceDirectory }
