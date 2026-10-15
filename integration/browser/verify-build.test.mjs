import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { verifyBrowserBuild } from './verify-build.mjs'

test('artifact validation requires an embedded emulator configuration and rejects mixed bundles', () => {
  const directory = mkdtempSync(join(tmpdir(), 'talkie-browser-build-'))
  const extra = { firebaseProjectId: 'demo-talkie-web-test', firebaseUseEmulators: true,
    firebaseEmulatorHost: '127.0.0.2', appVariant: 'development' }
  const bundle = value => `const config = JSON.parse(${JSON.stringify(JSON.stringify({ extra: value }))});`
  try {
    writeFileSync(join(directory, 'app.js'), 'const config = {};')
    assert.throws(() => verifyBrowserBuild(directory), /No verifiable/)
    writeFileSync(join(directory, 'app.js'), bundle(extra))
    assert.doesNotThrow(() => verifyBrowserBuild(directory))
    for (const change of [
      { firebaseProjectId: 'talkie-trivia-beta' }, { firebaseUseEmulators: false },
      { firebaseEmulatorHost: 'localhost' }, { appVariant: 'preview' },
    ]) {
      writeFileSync(join(directory, 'stale.js'), bundle({ ...extra, ...change }))
      assert.throws(() => verifyBrowserBuild(directory), /non-isolated/)
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
