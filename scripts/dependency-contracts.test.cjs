const { test } = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { spawnSync } = require("node:child_process")
const root = path.resolve(__dirname, "..")
const queryPath = require.resolve("query-string", { paths: [path.dirname(require.resolve("expo-router/package.json"))] })
const query = require(queryPath)

test("Xcode project IDs still work with the scoped UUID security update", () => {
  const project = require("xcode").project("unused.pbxproj")
  project.hash = { project: { objects: {} } }
  const ids = Array.from({ length: 100 }, () => project.generateUuid())
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[A-F0-9]{24}$/)
})

test("the router's actual query parser resolves the CommonJS security backport", () => {
  const decoderPath = require.resolve("decode-uri-component", { paths: [path.dirname(queryPath)] })
  assert.equal(fs.realpathSync(decoderPath), fs.realpathSync(path.join(root, "vendor/decode-uri-component/index.js")))
  assert.equal(typeof require(decoderPath), "function")
  const cases = [
    ["title=Am%C3%A9lie&year=2001", { title: "Amélie", year: "2001" }],
    ["title=hello+world&value=a%26b%3Dc", { title: "hello world", value: "a&b=c" }],
    ["tag=a&tag=b&empty=&flag", { tag: ["a", "b"], empty: "", flag: null }],
    ["value=%F0%9F%8E%AC", { value: "🎬" }],
    ["value=%G1%20text%FE%FF", { value: "%G1 text��" }],
  ]
  for (const [encoded, expected] of cases) assert.deepEqual({ ...query.parse(encoded) }, expected)
  const input = { title: "a&b=🎬", tag: ["x", "y"], empty: "" }
  assert.deepEqual({ ...query.parse(query.stringify(input)) }, input)
})

test("malformed percent-encoded input completes in a bounded child process", () => {
  const source = `const assert = require('node:assert/strict'); const query = require(${JSON.stringify(queryPath)}); const value = '%C0%AF'.repeat(20000); assert.equal(query.parse('value=' + value).value, value);`
  const result = spawnSync(process.execPath, ["-e", source], { timeout: 5000, encoding: "utf8" })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
})

test("vendored decoder retains the reviewed upstream algorithm", () => {
  const folder = path.join(root, "vendor/decode-uri-component")
  const provenance = JSON.parse(fs.readFileSync(path.join(folder, "upstream.json"), "utf8"))
  const source = fs.readFileSync(path.join(folder, "index.js"), "utf8")
    .replace(/^\/\/ Upstream[^\n]*\n/, "")
    .replace("module.exports = function decodeUriComponent(encodedURI) {", "export default function decodeUriComponent(encodedURI) {")
    .replace(/\r\n/g, "\n")
  assert.equal(crypto.createHash("sha256").update(source).digest("hex"), provenance.sourceSha256)
})
