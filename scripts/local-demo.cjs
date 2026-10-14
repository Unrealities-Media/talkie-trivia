const { createRequire } = require('node:module')
const { resolve } = require('node:path')
const { createHash } = require('node:crypto')
const root = resolve(__dirname, '..')
const projectId = 'demo-talkie-trivia'
const dayMs = 86400000

function nextOffset(command, currentOffset, now = Date.now()) {
  if (!Number.isSafeInteger(currentOffset) || Math.abs(currentOffset) > 3660 * dayMs) throw Error('Invalid demo offset')
  const current = now + currentOffset
  if (command === 'next') return currentOffset + dayMs
  if (command === 'reset') return 0
  if (command === 'midnight') return Math.floor(current / dayMs) * dayMs + dayMs - 30000 - now
  if (/^\d{4}-\d{2}-\d{2}$/.test(command)) {
    const target = Date.parse(`${command}T12:00:00Z`)
    if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== command || Math.abs(target - now) > 3650 * dayMs) throw Error('Date must be valid and within ten years of today')
    return target - now
  }
  throw Error('Use next, midnight, reset, status, or YYYY-MM-DD')
}

async function withDemo(run) {
  // No host/project flags: these tools cannot be redirected to cloud resources.
  const response = await fetch('http://127.0.0.1:4502/emulators', { signal: AbortSignal.timeout(3000) })
  if (!response.ok) throw Error('Local emulator hub is unavailable; run npm run dev')
  const hub = await response.json()
  for (const [name, port] of Object.entries({ auth: 9099, firestore: 8080, functions: 5001 })) {
    if (hub[name]?.port !== port || !['127.0.0.1', 'localhost'].includes(hub[name]?.host)) throw Error(`Unexpected ${name} emulator; refusing to write`)
  }
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  const req = createRequire(resolve(root, 'functions/package.json'))
  const { initializeApp, deleteApp } = req('firebase-admin/app')
  const { getFirestore } = req('firebase-admin/firestore')
  const app = initializeApp({ projectId })
  const db = getFirestore(app)
  try { return await run(db) } finally { await db.terminate(); await deleteApp(app) }
}

async function seed(db, now) {
  const movies = require('../src/data/searchIndex.json')
  const { version: catalogVersion } = require('../src/data/catalogVersion.json')
  const fixtures = require('./demo-movies.cjs')
  const start = Math.floor(now / dayMs)
  let created = 0
  for (let index = 0; index < 8; index++) {
    const day = new Date((start + index) * dayMs).toISOString().slice(0, 10)
    const fixture = fixtures[((start + index) % fixtures.length + fixtures.length) % fixtures.length]
    const movie = movies.find(m => m.t === fixture.title && m.y === fixture.year)
    if (!movie) throw Error(`Demo movie missing from catalog: ${fixture.title}`)
    try {
      await db.doc(`dailyGames/${day}`).create({
        movieId: movie.i, schemaVersion: 1, catalogVersion, date: new Date(`${day}T00:00:00Z`),
        content: { description: fixture.clue, imdbId: '', tagline: '' },
        contentHash: createHash('sha256').update(`${movie.i}\n${fixture.clue}\n\n`).digest('hex'),
        reviewedBy: 'LOCAL-DEMO-ONLY', reviewedAt: new Date(Date.now() - 1000).toISOString(),
      })
      created++
    } catch (error) { if (error.code !== 6) throw error } // Existing snapshots are immutable.
  }
  return created
}

async function run(command = 'status') {
  return withDemo(async db => {
    const clock = db.doc('_development/clock')
    const saved = (await clock.get()).data()?.offsetMs ?? 0
    const now = Date.now()
    const offset = command === 'status' || command === 'seed' ? saved : nextOffset(command, saved, now)
    if (!Number.isSafeInteger(offset) || Math.abs(offset) > 3660 * dayMs) throw Error('Invalid demo clock')
    // Prepare content before moving the clock so a new day is never empty.
    const created = await seed(db, now + offset)
    if (command !== 'status' && command !== 'seed') await clock.set({ offsetMs: offset })
    console.log(`Local demo only: ${new Date(now + offset).toISOString()} (${created} new challenges).`)
    if (command !== 'seed') console.log('Reload the app to pick up a changed day/time. The clock continues ticking normally.')
  })
}

module.exports = { nextOffset, run }
if (require.main === module) run(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1 })
