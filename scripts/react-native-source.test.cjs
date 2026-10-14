const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const { configureSourceBuild } = require("../plugins/withReactNativeSource.cjs")
const { includeSourceFile, gradleString, patchSource } = require("./prepare-react-native-source.cjs")

test("source copy keeps real build-named source packages but omits compiled output", () => {
  const root = path.resolve("react-native-fixture")
  for (const file of ["ReactAndroid/src/main/java/com/facebook/react/common/build/ReactBuildConfig.kt", "node_modules/tool/build/index.js", "ReactCommon/jsi/jsi.cpp"]) {
    assert.equal(includeSourceFile(root, path.join(root, file)), true, file)
  }
  for (const file of ["build/generated/file", "ReactAndroid/build", "ReactAndroid/build/obj/library.so", "ReactAndroid/hermes-engine/build/hermesc.exe", "ReactAndroid/.cxx/obj/file"]) {
    assert.equal(includeSourceFile(root, path.join(root, file)), false, file)
  }
})

test("source settings survive repeated prebuild without changing surrounding configuration", () => {
  const original = 'pluginManagement { includeBuild("../node_modules/@react-native/gradle-plugin") }\ninclude(":app")\n'
  const once = configureSourceBuild(original)
  assert.equal(configureSourceBuild(once), once)
  assert.ok(once.startsWith(original.trimEnd()))
  assert.ok(once.includes('module("com.facebook.hermes:hermes-android")'))
  assert.ok(once.includes('module("com.facebook.react:hermes-android")'))
})

test("malformed owned settings fail instead of silently stacking substitutions", () => {
  assert.throws(() => configureSourceBuild("// Talkie: React Native source build\n"), /Malformed/)
  const block = configureSourceBuild('include(":app")')
  assert.throws(() => configureSourceBuild(block + block), /Malformed/)
})

test("Gradle paths normalize Windows separators and escape interpolation", () => {
  assert.equal(gradleString('C:\\Users\\test $name\\codegen'), '"C:/Users/test \\$name/codegen"')
  assert.equal(gradleString('/home/test "name"/codegen'), '"/home/test \\"name\\"/codegen"')
})

test("upstream source drift fails before patches can be applied", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "talkie-source-patch-"))
  try {
    fs.writeFileSync(path.join(directory, "settings.gradle.kts"), "// incompatible upstream settings\n")
    assert.throws(() => patchSource(directory, "/codegen", "28.2.13676358"), /review Gradle placeholder directories/)
  } finally {
    // The exact directory returned by mkdtemp is the only recursive target.
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) && path.dirname(directory) !== path.resolve(os.tmpdir())) throw new Error("Unsafe test directory")
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
