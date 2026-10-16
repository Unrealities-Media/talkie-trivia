const { test } = require('node:test')
const assert = require('node:assert/strict')
const { buildRewards } = require('./prepare-movie-rewards.cjs')
test('reward metadata matches movie IDs and exact actor names, and excludes unsafe paths', () => {
  const result = buildRewards([{ i: 1, c: ['Actor', 'Other'] }, { i: 2, c: null }], [{ id: 1, backdrop_path: '/scene.jpg', overview: 'Full story' }], [], { 1: [{ name: 'Actor', profile_path: '/actor.jpg' }, { name: 'Other', profile_path: 'https://elsewhere.invalid/a.jpg' }] })
  assert.deepEqual(result, { 1: { backdrop: '/scene.jpg', summary: 'Full story', portraits: { Actor: '/actor.jpg' } } })
})
test('uses original overview rather than a redacted clue and prefers refreshed portraits', () => {
  const result = buildRewards([{ i: 1, c: ['Actor'] }], [{ id: 1, overview: 'Old story' }], [{ id: 1, original_overview: 'Complete story', overview: '[Redacted]', actors: [{ name: 'Actor', profile_path: '/new.jpg' }] }], { 1: [{ name: 'Actor', profile_path: '/old.jpg' }] })
  assert.equal(result[1].summary, 'Complete story')
  assert.equal(result[1].portraits.Actor, '/new.jpg')
})
