const { test } = require('node:test')
const assert = require('node:assert/strict')
const { collect } = require('./beta-operations.cjs')
const now = new Date('2026-10-16T03:00:00Z')
const root = 'projects/talkie-trivia-beta/locations/us-central1'
function fixture(overrides = {}) {
  return async (url, body) => {
    if (url.includes('cloudscheduler')) return overrides.jobs || { jobs: [{ name: `${root}/jobs/firebase-schedule-retryAccountDeletions-us-central1`, state: 'ENABLED', schedule: 'every 5 minutes', lastAttemptTime: '2026-10-16T02:58:00Z', status: {} }] }
    if (url.includes('cloudfunctions')) return { functions: [{ name: `${root}/functions/retryAccountDeletions`, state: 'ACTIVE', serviceConfig: { maxInstanceCount: 1, maxInstanceRequestConcurrency: overrides.concurrency || 1 } }] }
    if (url.includes('firebasehosting')) return { release: { version: { name: 'known-version' }, releaseTime: '2026-10-16T02:00:00Z' } }
    if (body?.structuredAggregationQuery) {
      if (overrides.malformedCount) return []
      const field = body.structuredAggregationQuery.structuredQuery.where.fieldFilter.field.fieldPath
      return [{ result: { aggregateFields: { total: { integerValue: field === 'purgeAt' ? String(overrides.overdue || 0) : '0' } } } }]
    }
    throw new Error('Unexpected request')
  }
}
test('reports bounded operational health without identifiers from player data', async () => {
  const report = await collect(fixture(), now)
  assert.equal(report.healthy, true)
  assert.equal(report.deletion.pending, 0)
  assert.equal(report.project, 'talkie-trivia-beta')
})
test('missing scheduler, concurrent workers and overdue cleanup fail the report', async () => {
  const report = await collect(fixture({ jobs: { jobs: [] }, concurrency: 80, overdue: 2 }), now)
  assert.equal(report.healthy, false)
  assert.equal(report.checks.deletionScheduleEnabled, false)
  assert.equal(report.checks.deletionScheduleAttemptRecent, false)
  assert.equal(report.checks.deletionScheduleLastStatusOk, false)
  assert.equal(report.checks.deletionWorkerSerial, false)
  assert.equal(report.checks.completionCleanupNotOverdue, false)
})
test('missing aggregation results cannot become a false zero', async () => {
  await assert.rejects(collect(fixture({ malformedCount: true }), now), /Invalid aggregation/)
})
test('pagination is followed and bounded rather than reporting a partial healthy inventory', async () => {
  const base = fixture()
  let calls = 0
  const request = async (url, body) => {
    if (url.includes('cloudscheduler') && !url.includes('pageToken=')) { calls++; return { jobs: [], nextPageToken: 'next' } }
    return base(url, body)
  }
  assert.equal((await collect(request, now)).healthy, true)
  assert.equal(calls, 1)
  await assert.rejects(collect(fixture({ jobs: { jobs: [], nextPageToken: 'repeat' } }), now), /pagination limit/)
})
test('API failures propagate instead of producing a healthy report', async () => {
  await assert.rejects(collect(async () => { throw new Error('Forbidden') }, now), /Forbidden/)
})
