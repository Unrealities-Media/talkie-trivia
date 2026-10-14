const test = require("node:test")
const assert = require("node:assert/strict")
const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const { configureSettings, configureProject, validateSource, validateVendoredSource } = require("../plugins/withFbjniSource.cjs")

test("FBJNI prebuild owns one replaceable block and preserves other settings", () => {
  for (const configure of [configureSettings, configureProject]) {
    const original = '// Existing project configuration\ninclude(":app")\n'
    const once = configure(original)
    assert.equal(configure(once), once)
    assert.ok(once.startsWith(original.trimEnd()))
    assert.throws(() => configure(once + once), /Malformed/)
    assert.throws(() => configure("// Talkie: FBJNI source build\n"), /Malformed/)
    assert.throws(() => configure("// End Talkie: FBJNI source build\n"), /Malformed/)
  }
})

test("vendored FBJNI files match the pinned upstream hashes and React Native dependency", () => {
  validateSource(path.resolve(__dirname, ".."))
})

for (const [name, mutate, expected] of [
  ["modified source", dir => fs.appendFileSync(path.join(dir, "CMakeLists.txt"), "\n# changed\n"), /source changed/],
  ["added globbed implementation", dir => fs.writeFileSync(path.join(dir, "cxx/unreviewed.cpp"), "void added() {}"), /file set changed/],
  ["removed source", dir => fs.unlinkSync(path.join(dir, "java/com/facebook/jni/HybridData.java")), /file set changed/],
  ["empty hash manifest", dir => {
    const file = path.join(dir, "upstream.json")
    const manifest = JSON.parse(fs.readFileSync(file, "utf8"))
    manifest.files = {}
    fs.writeFileSync(file, JSON.stringify(manifest))
  }, /file set changed/],
]) {
  test(`FBJNI generation rejects ${name}`, t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "talkie-fbjni-test-"))
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
    fs.cpSync(path.resolve(__dirname, "../vendor/fbjni"), dir, { recursive: true })
    mutate(dir)
    assert.throws(() => validateVendoredSource(dir), expected)
  })
}
