const { test } = require('node:test')
const assert = require('node:assert/strict')
const { nextOffset, seed } = require('./local-demo.cjs')
const now = Date.parse('2026-10-13T15:30:00Z')
test('local schedule contains five distinct answers per day and preserves existing snapshots', async () => {
  const docs = new Map()
  const db = { doc: path => ({ create: async value => {
    if (docs.has(path)) throw Object.assign(Error('exists'), { code: 6 })
    docs.set(path, value)
  } }) }
  assert.equal(await seed(db, now), 40)
  assert.equal(await seed(db, now), 0)
  assert.equal(new Set([...docs.values()].map(x => x.movieId)).size, 40)
  for (let day = 0; day < 8; day++) for (let level = 1; level <= 5; level++) {
    const date = new Date(now + day * 86400000).toISOString().slice(0, 10)
    assert.equal(docs.get(`dailyGames/${date}_LEVEL_${level}`).difficulty, `LEVEL_${level}`)
  }
})
test('day advancement and near-midnight preserve UTC across month/year boundaries', () => {
  assert.equal(nextOffset('next', 0, now), 86400000)
  assert.equal(new Date(now + nextOffset('midnight', 86400000, now)).toISOString(), '2026-10-14T23:59:30.000Z')
  const end = Date.parse('2026-12-31T23:59:59Z')
  assert.equal(new Date(end + nextOffset('next', 0, end)).toISOString(), '2027-01-01T23:59:59.000Z')
  assert.equal(nextOffset('reset', 999, now), 0)
})
test('explicit dates reject normalized invalid dates, arbitrary input and extreme offsets', () => {
  assert.equal(new Date(now + nextOffset('2026-11-01', 0, now)).toISOString(), '2026-11-01T12:00:00.000Z')
  for (const date of ['2026-02-30', '2026-13-01', 'tomorrow', '2100-01-01']) assert.throws(() => nextOffset(date, 0, now))
  assert.throws(() => nextOffset('next', NaN, now))
})
test('each demo clue has a unique released movie and meets the content length gate', () => {
  const movies = require('../src/data/searchIndex.json')
  const fixtures = require('../content/beta-movies.json')
  const originals = require('../data/movies.json')
  assert.ok(fixtures.length >= 8 * 5, 'at least eight days of distinct beta movies')
  assert.equal(new Set(fixtures.map(f => f.movieId)).size, fixtures.length)
  for (const f of fixtures) {
    assert.equal(movies.filter(m => m.i === f.movieId).length, 1)
    assert.equal(f.description, originals.find(m => m.id === f.movieId).overview)
    assert.equal(f.clues.LEVEL_1, f.description)
    assert.equal(Object.keys(f.clues).length, 5)
    for (const clue of Object.values(f.clues)) assert.ok(clue.length >= 20 && clue.length <= 2500)
    assert.ok(f.clues.LEVEL_5.length < f.clues.LEVEL_4.length)
    assert.equal(f.approved, false)
  }
})
