// Compare every exported file with the live beta. This catches SPA HTML being
// returned with 200 for missing fonts/images as well as stale deployments.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { verifyBuild } = require('./web-beta.cjs')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function main() {
  const build = verifyBuild('talkie-trivia-beta')
  const root = path.resolve(__dirname, '../web-build')
  const files = fs.readdirSync(root, { recursive: true }).filter(file => fs.statSync(path.join(root, file)).isFile())
  for (const file of files) {
    const route = file.replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/')
    const response = await fetch(`${build.site}/${route}`, { signal: AbortSignal.timeout(20000) })
    assert.equal(response.status, 200, file)
    assert.equal(digest(Buffer.from(await response.arrayBuffer())), digest(fs.readFileSync(path.join(root, file))), `Wrong/stale live asset: ${file}`)
  }
  for (const route of ['/', '/game', '/profile', '/archive', '/privacy', '/support', '/delete-account']) {
    const response = await fetch(`${build.site}${route}`, { signal: AbortSignal.timeout(20000) })
    assert.equal(response.status, 200, route)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', route)
    assert.equal(response.headers.get('cache-control'), 'no-cache', route)
  }
  console.log(`Verified ${files.length} live exported files byte-for-byte and seven public routes.`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
