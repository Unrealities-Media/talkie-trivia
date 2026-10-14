import { projectId } from "./environment.mjs"
import assert from "node:assert/strict"
import { after, afterEach, describe, it } from "node:test"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously, OAuthProvider, linkWithCredential, signInWithCredential } from "firebase/auth"

const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url))
const { getApp, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app")
const { getFirestore, Timestamp } = requireFunctions("firebase-admin/firestore")
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth")
const { accountMergeLifecycle } = requireFunctions("./lib/accountMergeLifecycle")
const { initialStats, completeStats, transition, hints } = requireFunctions("./lib/gameEngine")
const { gameHistory } = requireFunctions("./lib/gameHistory")
const { retryAccountMerges } = requireFunctions("./lib/index")
const admin = getApp()
const db = getFirestore(admin)
const auth = getAdminAuth(admin)
const apps = []
const ownedJobs = []
const service = accountMergeLifecycle(db, auth)
const tick = () => retryAccountMerges.run({ scheduleTime: new Date().toISOString() })
after(async () => { await Promise.all(apps.map(deleteApp)); await db.terminate(); await deleteAdmin(admin) })
afterEach(async () => {
  // Preserve fixture data. Keep this test's intentionally unfinished jobs out
  // of subsequent scheduler selections; never reset an emulator database.
  for (const ref of ownedJobs.splice(0)) await db.runTransaction(async tx => {
    const job = (await tx.get(ref)).data()
    if (job?.status === "pending" && !job.error) tx.update(ref, { nextAttemptAt: Timestamp.fromDate(new Date("2100-01-01T00:00:00Z")) })
  })
})
async function session(linked = false) {
  const app = initializeApp({ projectId, apiKey: "emulator-only", appId: "emulator-only" }, randomUUID())
  apps.push(app)
  const client = getAuth(app)
  connectAuthEmulator(client, "http://127.0.0.1:9199", { disableWarnings: true })
  let { user } = await signInAnonymously(client)
  if (linked) {
    const credential = new OAuthProvider("google.com").credential({ idToken: JSON.stringify({ sub: randomUUID(), email: `${randomUUID()}@example.test`, email_verified: true }) })
    await linkWithCredential(user, credential)
    user = (await signInWithCredential(client, credential)).user
  }
  const token = await user.getIdToken(true)
  const claims = await auth.verifyIdToken(token)
  return { uid: user.uid, token, request: data => ({ auth: { uid: user.uid, token: claims }, data }) }
}
async function setup(count = 2) {
  const source = await session()
  const target = await session(true)
  const movie = { i: 1, t: "Fixture", y: "1999", p: "", d: "Director", c: ["Actor"], g: ["Drama"] }
  let stats = initialStats(source.uid)
  const batch = db.batch()
  for (let index = 0; index < count; index++) {
    const day = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10)
    const fresh = { schemaVersion: 2, scoringVersion: 1, gameMode: "movies", id: `movies_${day}`, challengeId: day, playerID: source.uid,
      difficulty: "LEVEL_2", guessesMax: 5, guesses: [], answerId: 1, correctAnswer: false, gaveUp: false, hintsUsed: {}, revision: 0, actions: [],
      startDate: `${day}T12:00:00.000Z`, endDate: `${day}T12:00:00.000Z`, statsProcessed: false, score: 0,
      triviaItem: { id: 1, title: movie.t, description: "Reviewed fixture", posterPath: "", releaseDate: movie.y, metadata: {}, hints: hints(movie) } }
    const game = transition(fresh, { challengeId: day, expectedRevision: 0, actionId: randomUUID(), type: "guess", itemId: 1 }, new Map([[1, movie]]), new Date(`${day}T13:00:00Z`))
    stats = completeStats(stats, game)
    batch.set(db.doc(`players/${source.uid}/games/${game.id}`), game)
    batch.set(db.doc(`players/${source.uid}/gameHistoryV2/${day}`), gameHistory(game))
  }
  batch.set(db.doc(`players/${source.uid}/privateStats/summary`), stats)
  batch.set(db.doc(`players/${target.uid}/privateStats/summary`), initialStats(target.uid))
  await batch.commit()
  const accepted = await service.begin(source.request({ confirmation: "MERGE", targetIdToken: target.token, operationId: randomUUID() }))
  const job = db.doc(`accountMerges/${source.uid}`)
  ownedJobs.push(job)
  return { source, target, job, operation: { jobId: source.uid, operationId: accepted.operationId } }
}
function override(target, methods) {
  return new Proxy(target, { get(object, key) {
    if (Object.hasOwn(methods, key)) return methods[key]
    const value = Reflect.get(object, key)
    return typeof value === "function" ? value.bind(object) : value
  } })
}
const savedStats = async fixture => (await db.doc(`players/${fixture.target.uid}/privateStats/summary`).get()).data()

describe("scheduled account merge recovery", () => {
  it("exports bounded UTC scheduling and completes accepted work without an open client", async () => {
    const endpoint = retryAccountMerges.__endpoint
    assert.equal(endpoint.scheduleTrigger.schedule, "every 5 minutes")
    assert.equal(endpoint.scheduleTrigger.timeZone, "UTC")
    assert.equal(endpoint.scheduleTrigger.retryConfig.retryCount, 0)
    assert.equal(endpoint.timeoutSeconds, 540)
    assert.equal(endpoint.maxInstances, 1)
    assert.equal(endpoint.concurrency, 1)
    const fixture = await setup()
    await tick()
    assert.equal((await fixture.job.get()).data().status, "complete")
    assert.equal((await savedStats(fixture)).games, 2)
    await assert.rejects(auth.getUser(fixture.source.uid), { code: "auth/user-not-found" })
  })
  it("bounds a large job to eight steps per tick and continues from its checkpoint", async () => {
    const fixture = await setup(45)
    await tick()
    const first = (await fixture.job.get()).data()
    assert.equal(first.status, "pending")
    assert.equal(first.phase, "copy")
    assert.equal(first.imported, 0)
    assert.equal((await db.doc(`accountMergeLocks/${fixture.target.uid}`).get()).exists, true)
    await tick()
    assert.equal((await fixture.job.get()).data().status, "complete")
    assert.equal((await savedStats(fixture)).games, 45)
    const stats = await savedStats(fixture)
    await tick()
    assert.deepEqual(await savedStats(fixture), stats)
  })
  it("quarantines a full page of invalid old jobs so they cannot starve later accepted work", async () => {
    const fixture = await setup()
    const batch = db.batch()
    const ids = Array.from({ length: 20 }, () => randomUUID())
    for (const [index, uid] of ids.entries()) batch.set(db.doc(`accountMerges/${uid}`), { sourceUid: uid, targetUid: randomUUID(), operationId: randomUUID(),
      policyVersion: 999, status: "pending", imported: 0, conflicts: 0, nextAttemptAt: Timestamp.fromMillis(index + 1) })
    await batch.commit()
    await tick()
    assert.equal((await fixture.job.get()).data().phase, undefined)
    for (const uid of ids) {
      const job = (await db.doc(`accountMerges/${uid}`).get()).data()
      assert.equal(job.error, "merge-review-required")
      assert.equal(job.nextAttemptAt, undefined)
      assert.equal(job.imported, 0)
    }
    await tick()
    assert.equal((await fixture.job.get()).data().status, "complete")
  })
  it("backs off a pre-claim transport failure and recovers on a later delivery", async () => {
    const fixture = await setup()
    let fail = true
    const flaky = override(db, { runTransaction: callback => {
      if (fail) { fail = false; throw new Error("injected transport failure") }
      return db.runTransaction(callback)
    } })
    await accountMergeLifecycle(flaky, auth).retry()
    const deferred = (await fixture.job.get()).data()
    assert.equal(deferred.phase, undefined)
    assert.ok(deferred.nextAttemptAt.toMillis() > Date.now())
    assert.equal(deferred.error, undefined)
    await tick()
    assert.equal((await fixture.job.get()).data().phase, undefined)
    await fixture.job.update({ nextAttemptAt: Timestamp.fromMillis(Date.now() - 1) })
    await tick()
    assert.equal((await fixture.job.get()).data().status, "complete")
  })
  it("preserves a concurrent claim when repairing an observed queue failure", async () => {
    const fixture = await setup()
    let fail = true
    const racing = override(db, { runTransaction: async callback => {
      if (fail) {
        fail = false
        await fixture.job.update({ lease: "another-worker", nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000) })
        throw new Error("injected lost race")
      }
      return db.runTransaction(callback)
    } })
    await accountMergeLifecycle(racing, auth).retry()
    assert.equal((await fixture.job.get()).data().lease, "another-worker")
    assert.equal((await fixture.job.get()).data().error, undefined)
    assert.equal((await savedStats(fixture)).games, 0)
  })
  it("does not reset review or live-lease jobs and resumes an expired lease", async () => {
    const reviewing = await setup()
    const running = await setup()
    await reviewing.job.update({ error: "merge-review-required" })
    await running.job.update({ lease: "interrupted-worker", nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000) })
    await tick()
    assert.equal((await reviewing.job.get()).data().error, "merge-review-required")
    assert.equal((await reviewing.job.get()).data().nextAttemptAt, undefined)
    assert.equal((await running.job.get()).data().lease, "interrupted-worker")
    await running.job.update({ nextAttemptAt: Timestamp.fromMillis(Date.now() - 1) })
    await tick()
    assert.equal((await running.job.get()).data().status, "complete")
    assert.equal((await reviewing.job.get()).data().status, "pending")
    assert.equal((await auth.getUser(reviewing.source.uid)).disabled, false)
  })
  it("stops at the soft time budget between durable pages and completes on the next tick", async () => {
    const fixture = await setup(45)
    let elapsed = 0
    const slowAuth = override(auth, { getUser: async uid => {
      const owner = await auth.getUser(uid)
      elapsed = 8 * 60_000
      return owner
    } })
    await accountMergeLifecycle(db, slowAuth, () => elapsed).retry()
    const checkpoint = (await fixture.job.get()).data()
    assert.equal(checkpoint.status, "pending")
    assert.equal(checkpoint.checkedGames, 20)
    assert.equal(checkpoint.lease, undefined)
    assert.equal((await savedStats(fixture)).games, 0)
    await tick()
    await tick()
    assert.equal((await fixture.job.get()).data().status, "complete")
    assert.equal((await savedStats(fixture)).games, 45)
  })
  it("tolerates overlapping scheduler delivery and foreground recovery without duplicate credit", async () => {
    const fixture = await setup(45)
    await Promise.all([tick(), tick(), service.resume(fixture.target.request(fixture.operation))])
    for (let attempt = 0; attempt < 3 && (await fixture.job.get()).data().status !== "complete"; attempt++) await tick()
    assert.equal((await fixture.job.get()).data().status, "complete")
    assert.equal((await savedStats(fixture)).games, 45)
    assert.equal((await db.collection(`players/${fixture.target.uid}/gameHistoryV2`).get()).size, 45)
    assert.equal((await db.doc(`accountMergeLocks/${fixture.target.uid}`).get()).exists, false)
  })
  it("preserves invalid expiry records without letting them starve legitimate retention cleanup", async () => {
    const cancelled = await setup()
    await service.cancel(cancelled.target.request(cancelled.operation))
    await cancelled.job.update({ purgeAt: Timestamp.fromMillis(Date.now() - 1) })
    const tombstone = db.doc(`accountMergeLocks/${randomUUID()}`)
    await tombstone.set({ role: "retired", purgeAt: Timestamp.fromMillis(Date.now() - 1) })
    const locks = [], jobs = []
    const batch = db.batch()
    for (let index = 0; index < 100; index++) {
      const lock = db.doc(`accountMergeLocks/${randomUUID()}`)
      const job = db.doc(`accountMerges/${randomUUID()}`)
      locks.push(lock); jobs.push(job)
      batch.set(lock, { role: "target", jobId: "preserved-operation", purgeAt: Timestamp.fromMillis(index + 1) })
      batch.set(job, { status: "pending", imported: 7, purgeAt: Timestamp.fromMillis(index + 1) })
    }
    await batch.commit()
    await tick()
    assert.equal((await tombstone.get()).exists, true)
    assert.equal((await cancelled.job.get()).exists, true)
    for (let index = 0; index < 100; index++) {
      assert.deepEqual((await locks[index].get()).data(), { role: "target", jobId: "preserved-operation", retentionError: "merge-retention-review-required" })
      assert.deepEqual((await jobs[index].get()).data(), { status: "pending", imported: 7, retentionError: "merge-retention-review-required" })
    }
    await tick()
    assert.equal((await tombstone.get()).exists, false)
    assert.equal((await cancelled.job.get()).exists, false)
  })
})
