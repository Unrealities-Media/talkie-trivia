const { test } = require("node:test")
const assert = require("node:assert/strict")
const { verifyBackend } = require("./beta-backend-readiness.cjs")
const site = "https://talkie-staging.web.app"
const cors = { "access-control-allow-origin": site, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type" }
const preflight = () => new Response(null, { status: 204, headers: cors })
const denied = () => Response.json({ error: { status: "UNAUTHENTICATED" } }, { status: 401, headers: cors })

test("checks browser access and callable authentication without credentials or player data", async () => {
  const calls = []
  const names = await verifyBackend("talkie-staging", site, async (url, options) => {
    calls.push({ url, options })
    assert.equal(options.redirect, "error")
    assert.equal(options.headers.Authorization, undefined)
    assert.equal(options.headers.Origin, site)
    if (options.method === "OPTIONS") return preflight()
    assert.equal(options.body, '{"data":{}}')
    return denied()
  })
  assert.deepEqual(names, ["startGame", "applyGameAction", "getPlayerStatistics"])
  assert.equal(calls.length, 6)
  assert.equal(calls[4].url, "https://us-central1-talkie-staging.cloudfunctions.net/getPlayerStatistics")
})

test("blocks Hosting when the newly required statistics function is absent or inaccessible", async () => {
  for (const failure of [
    () => new Response("Not found", { status: 404 }),
    () => new Response("Forbidden", { status: 403 }),
    () => Response.json({ error: { status: "INTERNAL" } }, { status: 500, headers: cors }),
    () => Response.json({ result: {} }, { status: 200, headers: cors }),
    () => Response.json({ error: { status: "UNAUTHENTICATED" } }, { status: 401 }),
    () => { throw new Error("request timed out") },
  ]) {
    await assert.rejects(verifyBackend("talkie-staging", site, async (url, options) => {
      if (options.method === "OPTIONS") return preflight()
      return url.endsWith("/getPlayerStatistics") ? failure() : denied()
    }), /getPlayerStatistics.*before publishing Hosting/)
  }
})

test("blocks failed or incomplete browser preflight before sending a callable request", async () => {
  for (const headers of [{}, { ...cors, "access-control-allow-origin": "https://wrong.example" }, { ...cors, "access-control-allow-methods": "GET" }, { ...cors, "access-control-allow-headers": "authorization" }]) {
    let calls = 0
    await assert.rejects(verifyBackend("talkie-staging", site, async () => {
      calls++
      return new Response(null, { status: 204, headers })
    }), /startGame.*preflight failed/)
    assert.equal(calls, 1)
  }
})

test("rejects emulator projects and invalid origins without a network request", async () => {
  const request = () => { throw new Error("unexpected network request") }
  await assert.rejects(verifyBackend("demo-talkie", site, request), /live Firebase/)
  await assert.rejects(verifyBackend("talkie-staging/other", site, request), /live Firebase/)
  await assert.rejects(verifyBackend("talkie-staging", "http://localhost", request), /HTTPS origin/)
})
