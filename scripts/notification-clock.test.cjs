const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { prepareNotificationClock, originalSource, patchedSource, changes, version } = require("./prepare-notification-clock.cjs")
const project = path.resolve(__dirname, "..")
const installed = path.dirname(require.resolve("expo-notifications/package.json"))

function fixture(t) {
  const parent = path.join(project, ".expo", "notification-clock-tests")
  fs.mkdirSync(parent, { recursive: true })
  const root = fs.mkdtempSync(path.join(parent, "fixture-"))
  const dependency = path.join(root, "node_modules", "expo-notifications")
  fs.mkdirSync(dependency, { recursive: true })
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    expo: { autolinking: { android: { buildFromSource: ["expo-notifications"] } } },
  }))
  fs.writeFileSync(path.join(dependency, "package.json"), JSON.stringify({ name: "expo-notifications", version }))
  for (const change of changes) {
    const file = path.join(dependency, change.file)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, originalSource(fs.readFileSync(path.join(installed, change.file), "utf8"), change))
  }
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), parent)
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false)
    fs.rmSync(root, { recursive: true, force: true })
  })
  return { root, dependency }
}

test("clean generation and repeated generation produce the same reviewed native patch", t => {
  const { root, dependency } = fixture(t)
  const first = prepareNotificationClock(root)
  assert.deepEqual(prepareNotificationClock(root), first)
  const service = fs.readFileSync(path.join(dependency, changes[0].file), "utf8")
  const manifest = fs.readFileSync(path.join(dependency, changes[1].file), "utf8")
  assert.match(service, /synchronized\(DISPATCH_LOCK\)\s*\{\s*intent\?\.run \{ handleIntent\(context, intent\) \}/)
  assert.match(service, /Intent.ACTION_TIME_CHANGED,[\s\S]*Intent.ACTION_TIMEZONE_CHANGED,/)
  assert.match(manifest, /android.intent.action.TIME_SET/)
  assert.match(manifest, /android.intent.action.TIMEZONE_CHANGED/)
  assert.match(manifest, /android:exported="false"/)
})
test("dependency upgrades fail before changing source files", t => {
  const { root, dependency } = fixture(t)
  const file = path.join(dependency, changes[0].file)
  const before = fs.readFileSync(file, "utf8")
  fs.writeFileSync(path.join(dependency, "package.json"), JSON.stringify({ name: "expo-notifications", version: "58.0.0" }))
  assert.throws(() => prepareNotificationClock(root), /Review notification clock support/)
  assert.equal(fs.readFileSync(file, "utf8"), before)
})
test("prebuilt notification modules are rejected before any source modification", t => {
  const { root, dependency } = fixture(t)
  const file = path.join(dependency, changes[0].file)
  const before = fs.readFileSync(file, "utf8")
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ expo: {} }))
  assert.throws(() => prepareNotificationClock(root), /prebuilt modules omit the patch/)
  assert.equal(fs.readFileSync(file, "utf8"), before)
})
test("unreviewed changes in the second file cannot leave the first file partially patched", t => {
  const { root, dependency } = fixture(t)
  const file = path.join(dependency, changes[0].file)
  const before = fs.readFileSync(file, "utf8")
  fs.appendFileSync(path.join(dependency, changes[1].file), "<!-- unreviewed -->\n")
  assert.throws(() => prepareNotificationClock(root), /changed/)
  assert.equal(fs.readFileSync(file, "utf8"), before)
})
test("line endings are portable but edited or partial patches are rejected", t => {
  const { dependency } = fixture(t)
  const change = changes[0]
  const source = fs.readFileSync(path.join(dependency, change.file), "utf8")
  const patched = patchedSource(source, change)
  assert.equal(patchedSource(source.replace(/\n/g, "\r\n"), change), patched)
  assert.throws(() => patchedSource(patched.replace("synchronized(DISPATCH_LOCK)", "synchronized(Any())"), change), /changed/)
  assert.throws(() => patchedSource(source.replace(...change.replacements[0]), change), /changed/)
})
