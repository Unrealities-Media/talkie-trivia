import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

assert.equal(process.env.TALKIE_BROWSER_TEST, '1')
assert.equal(process.env.GCLOUD_PROJECT, 'demo-talkie-web-test')
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.2:8080')
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.2:9099')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(resolve(root, 'functions/package.json'))
const { initializeApp, deleteApp } = req('firebase-admin/app')
const { getFirestore } = req('firebase-admin/firestore')
const { seed } = createRequire(import.meta.url)('../scripts/local-demo.cjs')
const app = initializeApp({ projectId: 'demo-talkie-web-test' })
const db = getFirestore(app)
try { await seed(db, Date.now()) } finally { await db.terminate(); await deleteApp(app) }
const result = spawnSync(process.execPath, ['integration/node_modules/@playwright/test/cli.js',
  'test', '--config', 'integration/playwright.config.mjs'], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true })
if (result.error) throw result.error
process.exitCode = result.status ?? 1
