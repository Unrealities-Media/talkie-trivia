import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { spawnSync } from "node:child_process"

const require = createRequire(import.meta.url)
const ftpPath = require.resolve("basic-ftp", { paths: [dirname(require.resolve("get-uri"))] })
const { Client, parseList } = require(ftpPath)

test("Pub/Sub trace propagation remains compatible with patched telemetry core", () => {
  const pubsubDirectory = dirname(require.resolve("@google-cloud/pubsub"))
  const core = require(require.resolve("@opentelemetry/core", { paths: [pubsubDirectory] }))
  const api = require(require.resolve("@opentelemetry/api", { paths: [pubsubDirectory] }))
  const telemetry = require(join(pubsubDirectory, "telemetry-tracing.js"))
  const spanContext = { traceId: "12345678901234567890123456789012", spanId: "1234567890123456", traceFlags: 1 }
  const message = {}
  telemetry.setGloballyEnabled(true)
  try {
    telemetry.injectSpan({ spanContext: () => spanContext }, message)
    delete message.parentSpan // Exercise serialized propagation, without the local shortcut.
    assert.equal(telemetry.containsSpanContext(message), true)
    const extracted = new core.W3CTraceContextPropagator().extract(api.ROOT_CONTEXT, message, telemetry.pubsubGetter)
    assert.deepEqual(api.trace.getSpanContext(extracted), { ...spanContext, isRemote: true })
    const oversized = { baggage: "entry=" + "x".repeat(10000) }
    const baggageContext = new core.W3CBaggagePropagator().extract(api.ROOT_CONTEXT, oversized, api.defaultTextMapGetter)
    assert.equal(api.propagation.getBaggage(baggageContext), undefined)
  } finally {
    telemetry.setGloballyEnabled(false)
  }
})

test("get-uri's FTP dependency preserves listing metadata and its client interface", () => {
  // These are the entry fields and public methods consumed by get-uri's FTP adapter.
  const client = new Client()
  try {
    for (const method of ["access", "lastMod", "list", "downloadTo", "close"]) {
      assert.equal(typeof client[method], "function", method)
    }
    const [entry] = parseList("type=file;size=42;modify=20260102030405; clue.txt\r\n")
    assert.equal(entry.name, "clue.txt")
    assert.equal(entry.size, 42)
    assert.equal(entry.modifiedAt.toISOString(), "2026-01-02T03:04:05.000Z")
    assert.equal(parseList("-rw-r--r-- 1 owner group 42 Jan 02 2026 clue.txt\r\n")[0].name, "clue.txt")
  } finally {
    client.close()
  }
})

test("malformed FTP listings finish within a bounded child process", () => {
  const source = `const {parseList} = require(${JSON.stringify(ftpPath)}); try { parseList('-rw-r--r-- 1 ' + 'a '.repeat(50000) + '!'); } catch { /* Rejection is allowed. A hang is not. */ }`
  const result = spawnSync(process.execPath, ["-e", source], { timeout: 5000, encoding: "utf8" })
  assert.ifError(result.error)
  assert.equal(result.status, 0, result.stderr)
})

test("gaxios creates a multipart body using its updated CommonJS UUID dependency", async () => {
  const { Gaxios } = require("gaxios")
  let captured = false
  await new Gaxios().request({
    url: "https://dependency-contract.invalid/upload",
    method: "POST",
    multipart: [{ headers: { "Content-Type": "text/plain" }, content: "clue" }],
    adapter: async options => {
      captured = true
      const type = options.headers["Content-Type"]
      assert.match(type, /^multipart\/related; boundary=[0-9a-f-]{36}$/)
      const boundary = type.split("boundary=")[1]
      let body = ""
      for await (const chunk of options.body) body += chunk.toString()
      assert.ok(body.includes(`--${boundary}`))
      assert.ok(body.includes("clue"))
      return { config: options, status: 200, statusText: "OK", headers: {}, data: "ok" }
    },
  })
  assert.equal(captured, true)
})
