// Run inside the Firebase Hosting emulator against a generated beta export.
const assert = require("node:assert/strict")
async function main() {
  for (const [route, expected] of [
    ["/", "<html"], ["/game", "<html"], ["/profile", "<html"],
    ["/privacy", "Beta privacy notice"], ["/support", "Beta support"],
    ["/delete-account", "Delete your Talkie Trivia account"], ["/robots.txt", "Disallow: /"],
  ]) {
    const response = await fetch(`http://127.0.0.1:5000${route}`)
    assert.equal(response.status, 200, route)
    assert.ok((await response.text()).includes(expected), `${route} served wrong content`)
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", `${route}: ${JSON.stringify(Object.fromEntries(response.headers))}`)
    assert.equal(response.headers.get("cache-control"), "no-cache")
    console.log(`PASS ${route}`)
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
