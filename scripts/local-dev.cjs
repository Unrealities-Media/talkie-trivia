const { spawn, spawnSync } = require('node:child_process')
const { resolve, dirname, delimiter } = require('node:path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } = require('node:fs')
const net = require('node:net')
const { run: seed } = require('./local-demo.cjs')
const root = resolve(__dirname, '..')
const stateRoot = resolve(root, '.expo/local-dev')
const statePointer = resolve(stateRoot, 'latest.json')
const cli = resolve(root, 'integration/node_modules/firebase-tools/lib/bin/firebase.js')
const config = resolve(root, 'firebase.device.json')
const backendOnly = process.argv.includes('--backend-only')
const children = []
let stopping = false
let backendReady = false
let expoChild

function savedState() {
  if (existsSync(statePointer)) {
    const { directory } = JSON.parse(readFileSync(statePointer, 'utf8'))
    if (!/^exports\/[a-zA-Z0-9-]+$/.test(directory)) throw Error('Invalid local export pointer')
    const path = resolve(stateRoot, directory)
    if (!existsSync(resolve(path, 'firebase-export-metadata.json'))) throw Error('Saved local export is missing. Restore it before starting; refusing an empty database.')
    return path
  }
  const legacy = resolve(stateRoot, 'state')
  return existsSync(resolve(legacy, 'firebase-export-metadata.json')) ? legacy : null
}

function environment() {
  let java = process.env.JAVA_HOME
  const bundled = 'C:/Program Files/Android/Android Studio/jbr'
  if (!java && process.platform === 'win32' && existsSync(`${bundled}/bin/java.exe`)) java = bundled
  const env = { ...process.env, CI: 'true', APP_VARIANT: 'development',
    FIREBASE_PROJECTID_DEV: 'demo-talkie-trivia', FIREBASE_EMULATOR_HOST: 'localhost',
    FIREBASE_EMULATORS_PATH: resolve(root, '.expo/firebase-emulators'),
    PATH: [dirname(process.execPath), ...(java ? [resolve(java, 'bin')] : []), process.env.PATH || ''].join(delimiter) }
  if (java) env.JAVA_HOME = java
  return env
}
const env = environment()
function execute(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
  if (result.error || result.status !== 0) throw result.error || Error(`Command failed (${result.status}): ${args[0]}`)
}
function launch(args, childEnv = env) {
  const child = spawn(process.execPath, args, { cwd: root, env: childEnv, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true, detached: true })
  children.push(child)
  child.on('error', error => { console.error(error.message); void stop(1) })
  child.on('exit', code => { if (!stopping) { console.error(`Development service stopped (${code}).`); void stop(code || 1) } })
  return child
}
async function stop(code = 0) {
  if (stopping) return
  stopping = true
  // Metro's Windows watcher can hold Firebase's temporary export directory open.
  // Stop that watcher before the CLI tries to rename its completed snapshot.
  if (expoChild) stopChild(expoChild)
  if (backendReady) {
    try {
      console.log('Saving local accounts, games and demo clock...')
      const directory = `exports/${Date.now()}`
      const destination = resolve(stateRoot, directory)
      mkdirSync(dirname(destination), { recursive: true })
      execute([cli, 'emulators:export', destination, '--project', 'demo-talkie-trivia', '--config', config, '--non-interactive'])
      if (!existsSync(resolve(destination, 'firebase-export-metadata.json'))) throw Error('Export metadata is missing')
      writeFileSync(`${statePointer}.tmp`, JSON.stringify({ directory }) + '\n')
      renameSync(`${statePointer}.tmp`, statePointer)
    } catch (error) {
      console.error(`Local save failed: ${error.message}\nBackend remains running and previous snapshots are intact. Resolve the error, then type q to retry.`)
      stopping = false
      return
    }
  }
  for (const child of [...children].reverse()) stopChild(child)
  process.exitCode = code
  process.stdin.pause()
}
function stopChild(child) {
  if (!child.pid || child.exitCode !== null || child.killed) return
  // Stop only processes launched by this command, including their Java workers.
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  else { try { process.kill(-child.pid, 'SIGINT') } catch { /* Already stopped. */ } }
}
async function main() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major !== 24 || minor < 12) throw Error('Use Node 24.21.0 from .nvmrc')
  for (const path of [cli, resolve(root, 'functions/node_modules/typescript/bin/tsc'), resolve(root, 'node_modules/expo/bin/cli')]) {
    if (!existsSync(path)) throw Error('Install dependencies: npm ci && npm --prefix functions ci && npm --prefix integration ci')
  }
  const java = spawnSync('java', ['-version'], { env, windowsHide: true, encoding: 'utf8' })
  if (java.error || java.status !== 0) throw Error('Java 21+ is required; set JAVA_HOME or add Java to PATH')
  for (const port of [9099, 8080, 5001, 4502, 4602, 9150, ...(!backendOnly ? [8081] : [])]) {
    await new Promise((accept, reject) => {
      const server = net.createServer()
      server.once('error', () => reject(Error(`Port ${port} is busy. Stop the existing local service before starting npm run dev.`)))
      server.listen(port, '127.0.0.1', () => server.close(accept))
    })
  }
  execute([resolve(root, 'scripts/prepare-catalog.cjs')])
  execute([resolve(root, 'functions/node_modules/typescript/bin/tsc'), '--project', resolve(root, 'functions/tsconfig.json')])
  mkdirSync(stateRoot, { recursive: true })
  const previous = savedState()
  launch([cli, 'emulators:start', '--non-interactive', '--project', 'demo-talkie-trivia', '--config', config,
    '--only', 'auth,firestore,functions', ...(previous ? ['--import', previous] : [])])
  // Existence of the hub alone does not mean Functions has loaded the game API.
  const deadline = Date.now() + 120000
  while (!stopping) {
    try {
      const response = await fetch('http://127.0.0.1:5001/demo-talkie-trivia/us-central1/startGame', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"data":{}}', signal: AbortSignal.timeout(2000),
      })
      if (response.status === 401 && (await response.json()).error?.status === 'UNAUTHENTICATED') break
    } catch { /* Backend is still starting. */ }
    if (Date.now() > deadline) throw Error('The demo backend did not become ready within two minutes; inspect the emulator output above')
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  if (stopping) return
  backendReady = true
  await seed('seed')
  if (stopping) return
  if (!backendOnly) {
    const expoEnv = { ...env }
    delete expoEnv.CI // Keep Metro's development file watching and Fast Refresh.
    expoChild = launch([resolve(root, 'node_modules/expo/bin/cli'), 'start', '--web', '--localhost', '--port', '8081'], expoEnv)
    const webDeadline = Date.now() + 90000
    while (!stopping) {
      try {
        const response = await fetch('http://localhost:8081', { signal: AbortSignal.timeout(2000) })
        if (response.ok) break
      } catch { /* Metro is still starting. */ }
      if (Date.now() > webDeadline) throw Error('Metro did not become ready within 90 seconds; inspect its output above')
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  if (stopping) return
  console.log(`\nDemo ready. ${backendOnly ? 'Start Expo in another terminal.' : 'Open http://localhost:8081'}\nUse npm run dev:day -- next for another challenge; midnight for a 30-second reset test.\nType q then Enter (or Ctrl+C) to save local state and stop. All writes stay in demo-talkie-trivia emulators.\n`)
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', value => { if (value.trim() === 'q') void stop() })
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop() })
main().catch(error => { console.error(error.message); void stop(1) })
