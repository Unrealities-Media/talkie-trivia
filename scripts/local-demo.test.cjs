const { test } = require('node:test')
const assert = require('node:assert/strict')
const { nextOffset } = require('./local-demo.cjs')
const now = Date.parse('2026-10-13T15:30:00Z')
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
  const fixtures = require('./demo-movies.cjs')
  assert.equal(new Set(fixtures.map(f => `${f.title}/${f.year}`)).size, fixtures.length)
  for (const f of fixtures) {
    assert.equal(movies.filter(m => m.t === f.title && m.y === f.year).length, 1, f.title)
    assert.ok(f.clue.length >= 100 && f.clue.length <= 2500)
  }
})
