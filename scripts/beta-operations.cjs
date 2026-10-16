// Manual, read-only operational checks. Never print credentials or player records.
const project = 'talkie-trivia-beta'
const location = `projects/${project}/locations/us-central1`

async function collect(request, now = new Date()) {
  const list = async (url, key) => {
    const items = []
    let pageToken
    for (let page = 0; page < 10; page++) {
      const next = new URL(url)
      if (pageToken) next.searchParams.set('pageToken', pageToken)
      const data = await request(next.href)
      items.push(...(data[key] || []))
      if (!data.nextPageToken) return items
      pageToken = data.nextPageToken
    }
    throw new Error(`Incomplete ${key} inventory; pagination limit reached.`)
  }
  const count = async (collectionId, fieldPath, value, op = 'LESS_THAN_OR_EQUAL') => {
    const rows = await request(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runAggregationQuery`, {
      structuredAggregationQuery: { structuredQuery: { from: [{ collectionId }],
        where: { fieldFilter: { field: { fieldPath }, op, value } } }, aggregations: [{ alias: 'total', count: {} }] },
    })
    const valueText = rows[0]?.result?.aggregateFields?.total?.integerValue
    if (typeof valueText !== 'string' || !/^\d+$/.test(valueText) || !Number.isSafeInteger(Number(valueText))) {
      throw new Error('Invalid aggregation response; refusing to report zero.')
    }
    return Number(valueText)
  }
  const [jobs, functions, channel, pending, overdueJobs, overdueReceipts] = await Promise.all([
    list(`https://cloudscheduler.googleapis.com/v1/${location}/jobs`, 'jobs'),
    list(`https://cloudfunctions.googleapis.com/v2/${location}/functions`, 'functions'),
    request(`https://firebasehosting.googleapis.com/v1beta1/sites/${project}/channels/live`),
    count('accountDeletions', 'status', { stringValue: 'pending' }, 'EQUAL'),
    count('accountDeletions', 'purgeAt', { timestampValue: new Date(now.getTime() - 3600000).toISOString() }),
    count('accountDeletionReceipts', 'expiresAt', { timestampValue: new Date(now.getTime() - 3600000).toISOString() }),
  ])
  const job = jobs.find(item => item.name === `${location}/jobs/firebase-schedule-retryAccountDeletions-us-central1`)
  const worker = functions.find(item => item.name === `${location}/functions/retryAccountDeletions`)
  const age = now.getTime() - Date.parse(job?.lastAttemptTime)
  const checks = {
    hostingReleasePresent: Boolean(channel.release?.version?.name && channel.release?.releaseTime),
    deletionScheduleEnabled: job?.state === 'ENABLED' && job?.schedule === 'every 5 minutes',
    deletionScheduleAttemptRecent: Number.isFinite(age) && age >= 0 && age <= 15 * 60000,
    deletionScheduleLastStatusOk: Boolean(job?.status) && (job.status.code === undefined || job.status.code === 0),
    deletionWorkerActive: worker?.state === 'ACTIVE',
    deletionWorkerSerial: worker?.serviceConfig?.maxInstanceCount === 1 && worker?.serviceConfig?.maxInstanceRequestConcurrency === 1,
    completionCleanupNotOverdue: overdueJobs === 0,
    receiptCleanupNotOverdue: overdueReceipts === 0,
  }
  return { recordedAt: now.toISOString(), project, checks,
    healthy: Object.values(checks).every(Boolean),
    hosting: { version: channel.release?.version?.name, releaseTime: channel.release?.releaseTime },
    deletion: { pending, completionRecordsOverdueByOneHour: overdueJobs, receiptsOverdueByOneHour: overdueReceipts,
      lastSchedulerAttempt: job?.lastAttemptTime },
    scope: 'Operational configuration and queue checks only; not proof of end-to-end deletion, notification delivery or release readiness.' }
}

async function main() {
  const auth = require('../integration/node_modules/firebase-tools/lib/auth')
  const account = auth.getGlobalDefaultAccount()
  if (!account?.tokens?.refresh_token) throw new Error('Run firebase login before checking beta operations.')
  const token = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform'])
  const request = async (url, body) => {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) })
    if (!response.ok) throw new Error(`Read-only operations request failed: HTTP ${response.status} ${new URL(url).pathname}`)
    return response.json()
  }
  const report = await collect(request)
  console.log(JSON.stringify(report, null, 2))
  if (!report.healthy) process.exitCode = 1
}
module.exports = { collect }
if (require.main === module) main().catch(() => {
  console.error('Beta operations check failed. Verify Firebase login, API access and network connectivity; no healthy result was produced.')
  process.exitCode = 1
})
