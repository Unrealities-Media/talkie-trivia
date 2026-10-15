import { spawn, spawnSync } from 'node:child_process'
import { resolve, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBrowserBuild } from './browser/verify-build.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [major, minor] = process.versions.node.split('.').map(Number)
if (major !== 24 || minor < 12) throw Error('Browser tests require Node 24.12+ in the 24.x line.')
const env = { ...process.env, CI: 'true', EXPO_NO_DOTENV: '1', EXPO_NO_TELEMETRY: '1',
  APP_VARIANT: 'development', WEB_BETA: 'false', FIREBASE_PROJECTID_DEV: 'demo-talkie-web-test',
  FIREBASE_EMULATOR_HOST: '127.0.0.2', TALKIE_BROWSER_TEST: '1',
  FIREBASE_EMULATORS_PATH: resolve(root, '.expo/firebase-emulators'),
  PATH: [dirname(process.execPath), process.env.PATH].join(delimiter) }
// Always test fresh backend and browser artifacts, never a developer's dev server.
for (const args of [
  ['scripts/prepare-catalog.cjs'],
  ['functions/node_modules/typescript/bin/tsc', '--project', 'functions/tsconfig.json'],
  ['node_modules/expo/bin/cli', 'export', '--clear', '--platform', 'web', '--output-dir', '.expo/browser-build'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}
verifyBrowserBuild(resolve(root, '.expo/browser-build'))
const child = spawn(process.execPath, [
  'integration/node_modules/firebase-tools/lib/bin/firebase.js', 'emulators:exec',
  '--non-interactive', '--project', 'demo-talkie-web-test', '--config', 'firebase.browser.json',
  '--only', 'auth,firestore,functions', 'node integration/run-browser-contracts.mjs',
], { cwd: root, env, stdio: 'inherit', windowsHide: true })
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
