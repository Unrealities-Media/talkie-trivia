import { projectId } from "./environment.mjs"
import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithCredential, OAuthProvider, linkWithCredential } from "firebase/auth"
import { getFirestore as getClientFirestore, connectFirestoreEmulator, collection, query, orderBy, documentId, limit, getDocs, terminate } from "firebase/firestore"

const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url))
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app")
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth")
const { getFirestore, Timestamp } = requireFunctions("firebase-admin/firestore")
const { accountMergeLifecycle } = requireFunctions("./lib/accountMergeLifecycle")
const { accountMergeReconciliation } = requireFunctions("./lib/accountMergeReconciliation")
const { accountDeletion } = requireFunctions("./lib/accountDeletion")
const { initialStats, completeStats, hints, transition } = requireFunctions("./lib/gameEngine")
const { gameHistory } = requireFunctions("./lib/gameHistory")
const { requireActiveAccount } = requireFunctions("./lib/accountAccess")
const admin = initializeAdmin({ projectId }, `merge-lifecycle-${randomUUID()}`)
const auth = getAdminAuth(admin)
const db = getFirestore(admin)
const apps = []
const clientStores = []
const reconciliation = accountMergeReconciliation(db, auth, projectId)
const selection = (fixture, action = "cancel-before-copy") => ({ projectId, sourceUid: fixture.source.user.uid, operationId: fixture.operation.operationId, action })
const confirmation = plan => ({ projectId, digest: plan.digest, reference: "incident-emulator-001" })
after(async () => { await Promise.all(clientStores.map(terminate)); await Promise.all(apps.map(deleteApp)); await db.terminate(); await deleteAdmin(admin) })

const credential = () => new OAuthProvider("google.com").credential({ idToken: JSON.stringify({ sub: randomUUID(), email: `${randomUUID()}@example.test`, email_verified: true }) })
async function session(linked = false) {
  const app = initializeApp({ projectId, apiKey: "emulator-only", appId: "emulator-only" }, randomUUID())
  apps.push(app)
  const client = getAuth(app)
  connectAuthEmulator(client, "http://127.0.0.1:9199", { disableWarnings: true })
  let { user } = await signInAnonymously(client)
  if (linked) {
    const provider = credential()
    await linkWithCredential(user, provider)
    user = (await signInWithCredential(client, provider)).user
  }
  const token = await user.getIdToken(true)
  const claims = await auth.verifyIdToken(token)
  return { user, client, token, request: data => ({ auth: { uid: user.uid, token: claims }, data }) }
}
function saved(uid, day, win = true) {
  const movie = { i: 1, t: "Fixture", y: "1999", p: "", d: "Director", c: ["Actor"], g: ["Drama"] }
  const game = { schemaVersion: 2, scoringVersion: 1, id: `movies_${day}`, challengeId: day, playerID: uid,
    gameMode: "movies", difficulty: "LEVEL_2", guessesMax: 5, guesses: [], answerId: 1, correctAnswer: false, gaveUp: false,
    hintsUsed: {}, revision: 0, actions: [], startDate: `${day}T12:00:00.000Z`, endDate: `${day}T12:00:00.000Z`, statsProcessed: false, score: 0,
    triviaItem: { id: 1, title: movie.t, description: "Reviewed fixture", posterPath: "", releaseDate: movie.y, metadata: {}, hints: hints(movie) } }
  return win ? transition(game, { challengeId: day, expectedRevision: 0, actionId: randomUUID(), type: "guess", itemId: 1 }, new Map([[1, movie]]), new Date(`${day}T13:00:00Z`)) : game
}
async function setup({ prepareReceipt = false } = {}) {
  const source = await session()
  const target = await session(true)
  const games = [saved(source.user.uid, "2026-10-12"), saved(source.user.uid, "2026-10-13")]
  const existing = saved(target.user.uid, "2026-10-13", false)
  const batch = db.batch()
  for (const [user, records] of [[source, games], [target, [existing]]]) {
    const uid = user.user.uid
    batch.set(db.doc(`players/${uid}`), { id: uid, name: "Player" })
    let stats = initialStats(uid)
    for (const game of records) {
      batch.set(db.doc(`players/${uid}/games/${game.id}`), game)
      if (game.statsProcessed) {
        stats = completeStats(stats, game)
        batch.set(db.doc(`players/${uid}/gameHistoryV2/${game.challengeId}`), gameHistory(game))
      }
    }
    batch.set(db.doc(`players/${uid}/privateStats/summary`), stats)
  }
  await batch.commit()
  const receipt = prepareReceipt ? await accountDeletion(db, auth).prepare(source.request({})) : undefined
  const service = accountMergeLifecycle(db, auth)
  const beginRequest = source.request({ confirmation: "MERGE", targetIdToken: target.token, operationId: randomUUID() })
  const accepted = await service.begin(beginRequest)
  return { source, target, games, existing, service, accepted, beginRequest, receipt,
    job: db.doc(`accountMerges/${source.user.uid}`), operation: { jobId: accepted.jobId, operationId: accepted.operationId } }
}
async function reach(fixture, phase) {
  for (let index = 0; index < 12; index++) {
    if ((await fixture.job.get()).data().phase === phase) return
    const result = await fixture.service.process(fixture.source.user.uid)
    assert.equal(result.status, "pending")
  }
  assert.fail(`Did not reach ${phase}`)
}
const contents = async (uid, collection) => (await db.collection(`players/${uid}/${collection}`).orderBy("__name__").get()).docs.map(doc => doc.data())
function override(target, methods) {
  return new Proxy(target, { get(object, key) {
    if (Object.hasOwn(methods, key)) return methods[key]
    const value = Reflect.get(object, key)
    return typeof value === "function" ? value.bind(object) : value
  } })
}

describe("administrative merge reconciliation", () => {
  it("previews without writes and cancels only an untouched operation with exact confirmation", async () => {
    assert.throws(() => accountMergeReconciliation(db, auth, "another-project"), /must match explicitly/)
    const fixture = await setup()
    const before = (await fixture.job.get()).data()
    const originalSource = await contents(fixture.source.user.uid, "games")
    const plan = await reconciliation.inspect(selection(fixture))
    assert.deepEqual(plan.blockers, [])
    assert.deepEqual((await fixture.job.get()).data(), before)
    assert.equal(JSON.stringify(plan).includes("@example.test"), false)
    assert.equal(JSON.stringify(plan).includes(fixture.target.token), false)
    assert.equal(plan.summary.target.providers[0], "google.com")
    await assert.rejects(reconciliation.apply(plan, { ...confirmation(plan), projectId: "another-project" }), /confirmation/)
    await assert.rejects(reconciliation.apply(plan, { ...confirmation(plan), digest: "0".repeat(64) }), /confirmation/)
    await assert.rejects(reconciliation.apply({ ...plan, expiresAt: Date.now() - 1 }, confirmation(plan)), /confirmation/)
    assert.deepEqual((await fixture.job.get()).data(), before)
    assert.equal((await reconciliation.apply(plan, confirmation(plan))).status, "cancelled")
    assert.deepEqual(await contents(fixture.source.user.uid, "games"), originalSource)
    assert.deepEqual(await contents(fixture.target.user.uid, "games"), [fixture.existing])
    assert.equal((await auth.getUser(fixture.source.user.uid)).disabled, false)
    assert.equal((await fixture.job.get()).data().reconciliation.reference, "incident-emulator-001")
  })
  it("refuses a stale Firestore observation without modifying the new state", async () => {
    const fixture = await setup()
    const plan = await reconciliation.inspect(selection(fixture))
    await fixture.job.update({ lease: "other-worker", nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000) })
    const before = (await fixture.job.get()).data()
    await assert.rejects(reconciliation.apply(plan, confirmation(plan)), /changed/)
    assert.deepEqual((await fixture.job.get()).data(), before)
  })
  it("refuses an Auth identity change and does not expose private provider data", async () => {
    const fixture = await setup()
    const plan = await reconciliation.inspect(selection(fixture, "retry"))
    await auth.updateUser(fixture.target.user.uid, { disabled: true })
    await assert.rejects(reconciliation.apply(plan, confirmation(plan)), /changed/)
    const current = await reconciliation.inspect(selection(fixture, "retry"))
    assert.ok(current.blockers.some(message => message.includes("Destination must be an enabled")))
    await assert.rejects(reconciliation.apply(current, confirmation(current)), /blocked/)
    assert.equal((await fixture.job.get()).data().phase, undefined)
  })
  it("queues reviewed work through normal validation instead of importing or releasing locks directly", async () => {
    const fixture = await setup()
    await fixture.job.update({ error: "merge-review-required" })
    const plan = await reconciliation.inspect(selection(fixture, "retry"))
    assert.deepEqual(plan.blockers, [])
    assert.equal((await reconciliation.apply(plan, confirmation(plan))).status, "queued")
    const queued = (await fixture.job.get()).data()
    assert.equal(queued.error, undefined)
    assert.equal(queued.phase, undefined)
    assert.equal((await db.doc(`accountMergeLocks/${fixture.target.user.uid}`).get()).exists, true)
    assert.equal((await fixture.service.resume(fixture.target.request(fixture.operation))).status, "complete")
    assert.equal((await contents(fixture.target.user.uid, "privateStats"))[0].games, 1)
  })
  for (const barrier of ["lease", "deletion", "missing-lock", "retention"]) {
    it(`preserves both accounts when the plan encounters ${barrier}`, async () => {
      const fixture = await setup()
      if (barrier === "lease") await fixture.job.update({ lease: "active-worker", nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000) })
      if (barrier === "deletion") await db.doc(`accountDeletions/${fixture.source.user.uid}`).set({ status: "pending" })
      if (barrier === "missing-lock") await db.doc(`accountMergeLocks/${fixture.target.user.uid}`).delete()
      if (barrier === "retention") await fixture.job.update({ retentionError: "merge-retention-review-required" })
      const before = (await fixture.job.get()).data()
      const plan = await reconciliation.inspect(selection(fixture))
      assert.ok(plan.blockers.length)
      await assert.rejects(reconciliation.apply(plan, confirmation(plan)), /blocked/)
      assert.deepEqual((await fixture.job.get()).data(), before)
      assert.equal((await contents(fixture.source.user.uid, "games")).length, 2)
      assert.deepEqual(await contents(fixture.target.user.uid, "games"), [fixture.existing])
    })
  }
  for (const copied of ["games", "mergedGuestGames"]) {
    it(`does not trust zero counters when ${copied} already contains a copied record`, async () => {
      const fixture = await setup()
      await db.doc(`players/${fixture.target.user.uid}/${copied}/synthetic-copy`).set(copied === "games" ?
        { mergeOrigin: { guestUid: fixture.source.user.uid } } : { sourceUid: fixture.source.user.uid })
      const plan = await reconciliation.inspect(selection(fixture))
      assert.ok(plan.blockers.some(message => message.includes("Copying/retirement")))
      await assert.rejects(reconciliation.apply(plan, confirmation(plan)), /blocked/)
      assert.equal((await db.doc(`players/${fixture.target.user.uid}/${copied}/synthetic-copy`).get()).exists, true)
    })
  }
  it("never cancels a copied operation or marks partial progress complete", async () => {
    const fixture = await setup()
    await reach(fixture, "copied")
    const before = (await fixture.job.get()).data()
    const plan = await reconciliation.inspect(selection(fixture))
    assert.ok(plan.blockers.some(message => message.includes("Copying/retirement")))
    await assert.rejects(reconciliation.apply(plan, confirmation(plan)), /blocked/)
    assert.deepEqual((await fixture.job.get()).data(), before)
    assert.equal((await auth.getUser(fixture.source.user.uid)).disabled, true)
  })
  it("runs the real CLI preview and explicit apply against the isolated demo project", async () => {
    const fixture = await setup()
    const directory = await mkdtemp(join(tmpdir(), "talkie-reconciliation-"))
    const file = join(directory, "plan.json")
    const cli = fileURLToPath(new URL("../../scripts/reconcile-account-merge.cjs", import.meta.url))
    const run = args => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", windowsHide: true, timeout: 30000, env: process.env })
    const preview = run(["inspect", "--project", projectId, "--emulator", "--source", fixture.source.user.uid, "--operation", fixture.operation.operationId,
      "--action", "cancel-before-copy", "--out", file])
    assert.equal(preview.status, 0, preview.stderr)
    const plan = JSON.parse(await readFile(file, "utf8"))
    assert.equal(JSON.parse(preview.stdout).status, "inspected")
    assert.equal((await fixture.job.get()).data().status, "pending")
    const applied = run(["apply", "--project", projectId, "--emulator", "--plan", file, "--confirm-project", projectId, "--confirm-digest", plan.digest, "--reference", "incident-cli-001"])
    assert.equal(applied.status, 0, applied.stderr)
    assert.equal(JSON.parse(applied.stdout).status, "cancelled")
    assert.equal((await fixture.job.get()).data().status, "cancelled")
    assert.equal((await auth.getUser(fixture.source.user.uid)).disabled, false)
    // Keep the redacted plan fixture for inspection; no recursive cleanup.
  })
})

describe("account merge identity lifecycle and deletion contracts", () => {
  it("recovers as the saved profile, freezes provider changes, retires the guest and releases only the destination", async () => {
    const fixture = await setup({ prepareReceipt: true })
    const { source, target, service, operation } = fixture
    const clientStore = getClientFirestore(target.client.app)
    connectFirestoreEmulator(clientStore, "127.0.0.1", 8180)
    clientStores.push(clientStore)
    const archiveQuery = query(collection(clientStore, `players/${target.user.uid}/mergedGuestGames`),
      orderBy("game.challengeId", "desc"), orderBy(documentId(), "desc"), limit(21))
    await assert.rejects(getDocs(archiveQuery), { code: "permission-denied" })
    assert.ok(fixture.receipt.secret)
    assert.equal((await service.status(source.request(operation))).status, "pending")
    assert.deepEqual(await service.status(target.request({})), fixture.accepted)
    await reach(fixture, "copy")
    assert.equal((await auth.getUser(source.user.uid)).disabled, false)
    await service.process(source.user.uid)
    assert.equal((await fixture.job.get()).data().phase, "copied")
    await assert.rejects(getDocs(archiveQuery), { code: "permission-denied" })
    assert.equal((await auth.getUser(source.user.uid)).disabled, true)
    const invalidated = error => ["auth/user-disabled", "auth/user-token-expired"].includes(error.code)
    await assert.rejects(linkWithCredential(source.user, credential()), invalidated)
    await assert.rejects(source.user.getIdToken(true), invalidated)
    // Also bypass SDK preflight/refresh to exercise the actual provider-link
    // endpoint with the originally issued, now-retired guest ID token.
    const staleLink = await fetch("http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=emulator-only", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ idToken: source.token, requestUri: "http://localhost",
        postBody: new URLSearchParams({ providerId: "google.com", id_token: JSON.stringify({ sub: randomUUID(), email: `${randomUUID()}@example.test`, email_verified: true }) }).toString(),
        returnSecureToken: true, returnIdpCredential: true }),
    })
    assert.equal(staleLink.status, 400)
    assert.ok(["USER_DISABLED", "TOKEN_EXPIRED"].includes((await staleLink.json()).error.message))
    assert.deepEqual((await auth.getUser(source.user.uid)).providerData, [])
    await assert.rejects(service.status(source.request(operation)), { code: "unauthenticated" })
    const result = await service.resume(target.request(operation))
    assert.deepEqual(result, { status: "complete", jobId: source.user.uid, targetUid: target.user.uid, operationId: operation.operationId, imported: 1, conflicts: 1 })
    await assert.rejects(auth.getUser(source.user.uid), { code: "auth/user-not-found" })
    assert.equal((await db.doc(`players/${source.user.uid}`).get()).exists, false)
    for (const path of ["games", "gameHistoryV2", "privateStats"]) assert.deepEqual(await contents(source.user.uid, path), [])
    assert.equal((await db.doc(`accountDeletionReceipts/${source.user.uid}`).get()).exists, false)
    assert.equal((await db.doc(`accountMergeLocks/${target.user.uid}`).get()).exists, false)
    const retired = await db.doc(`accountMergeLocks/${source.user.uid}`).get()
    assert.deepEqual(Object.keys(retired.data()).sort(), ["purgeAt", "role"])
    assert.equal(retired.data().role, "retired")
    assert.throws(() => requireActiveAccount({ exists: false }, retired), { code: "failed-precondition" })
    assert.equal((await contents(target.user.uid, "privateStats"))[0].games, 1)
    assert.equal((await contents(target.user.uid, "mergedGuestGames")).length, 1)
    // Read the actual worker output through the destination SDK and security rules.
    // The archive must be the guest's completed game, not the destination's fresh game.
    const archive = await getDocs(archiveQuery)
    assert.equal(archive.size, 1)
    assert.equal(archive.docs[0].id, `${source.user.uid}_movies_2026-10-13`)
    assert.deepEqual(archive.docs[0].data(), { policyVersion: 1, reason: "existing-profile-kept", sourceUid: source.user.uid,
      game: { ...fixture.games[1], playerID: target.user.uid } })
    assert.deepEqual((await db.doc(`players/${target.user.uid}/games/${fixture.existing.id}`).get()).data(), fixture.existing)
    const completedJob = (await fixture.job.get()).data()
    assert.deepEqual(Object.keys(completedJob).sort(), ["sourceUid", "targetUid", "operationId", "policyVersion", "status", "imported", "conflicts", "completedAt"].sort())
    assert.deepEqual(await service.resume(target.request(operation)), result)
    assert.deepEqual((await fixture.job.get()).data(), completedJob)
  })
  it("keeps unrelated accounts from inspecting, cancelling or resuming a known operation", async () => {
    const fixture = await setup()
    const stranger = await session(true)
    const before = (await fixture.job.get()).data()
    for (const method of ["status", "cancel", "resume"]) {
      assert.deepEqual(await fixture.service[method](stranger.request(fixture.operation)), { status: "none" })
      assert.deepEqual(await fixture.service[method](stranger.request({ jobId: randomUUID(), operationId: randomUUID() })), { status: "none" })
    }
    await assert.rejects(fixture.service.resume(fixture.source.request(fixture.operation)), { code: "failed-precondition" })
    await assert.rejects(fixture.service.status({ data: fixture.operation }), { code: "unauthenticated" })
    await assert.rejects(fixture.service.status(fixture.target.request({ uid: fixture.source.user.uid })), { code: "invalid-argument" })
    await assert.rejects(fixture.service.cancel(fixture.target.request({ jobId: fixture.source.user.uid })), { code: "invalid-argument" })
    assert.deepEqual((await fixture.job.get()).data(), before)
  })
  it("cancels before retirement and allows a new confirmation without accepting stale cancellation", async () => {
    const fixture = await setup()
    await reach(fixture, "copy")
    const before = await contents(fixture.source.user.uid, "games")
    const cancelled = await fixture.service.cancel(fixture.source.request(fixture.operation))
    assert.equal(cancelled.status, "cancelled")
    for (const owner of [fixture.source, fixture.target]) {
      assert.equal((await auth.getUser(owner.user.uid)).disabled, false)
      assert.equal((await db.doc(`accountMergeLocks/${owner.user.uid}`).get()).exists, false)
    }
    assert.deepEqual(await contents(fixture.source.user.uid, "games"), before)
    // Lost begin response followed by cancellation: replay never recreates work.
    assert.equal((await fixture.service.begin(fixture.beginRequest)).status, "cancelled")
    const nextRequest = { ...fixture.beginRequest, data: { ...fixture.beginRequest.data, operationId: randomUUID(), previousOperationId: fixture.operation.operationId } }
    const accepted = await fixture.service.begin(nextRequest)
    assert.notEqual(accepted.operationId, fixture.operation.operationId)
    assert.deepEqual(await fixture.service.cancel(fixture.source.request(fixture.operation)), { status: "none" })
    assert.equal((await fixture.job.get()).data().status, "pending")
    await fixture.service.cancel(fixture.source.request({ jobId: accepted.jobId, operationId: accepted.operationId }))
    // An older confirmation also cannot resurrect after a newer cancellation.
    await assert.rejects(fixture.service.begin(fixture.beginRequest), { code: "failed-precondition" })
  })
  it("does not cancel after source freezing or while a live worker owns the lease", async () => {
    const fixture = await setup()
    let release
    let started
    const gate = new Promise(resolve => { release = resolve })
    const entered = new Promise(resolve => { started = resolve })
    const slowAuth = override(auth, { getUser: async uid => { if (uid === fixture.target.user.uid) { started(); await gate } return auth.getUser(uid) } })
    const running = accountMergeLifecycle(db, slowAuth).process(fixture.source.user.uid)
    await entered
    try { await assert.rejects(fixture.service.cancel(fixture.target.request(fixture.operation)), { code: "failed-precondition" }) }
    finally { release() }
    await running
    await reach(fixture, "copied")
    await assert.rejects(fixture.service.cancel(fixture.target.request(fixture.operation)), { code: "failed-precondition" })
    assert.equal((await fixture.job.get()).data().status, "pending")
  })
  it("stops without disabling or deleting a guest that linked a provider after reservation", async () => {
    const fixture = await setup()
    await linkWithCredential(fixture.source.user, credential())
    const before = await contents(fixture.source.user.uid, "games")
    assert.equal((await fixture.service.process(fixture.source.user.uid)).status, "review")
    const owner = await auth.getUser(fixture.source.user.uid)
    assert.equal(owner.disabled, false)
    assert.equal(owner.providerData.length, 1)
    assert.deepEqual(await contents(fixture.source.user.uid, "games"), before)
    assert.equal((await fixture.service.cancel(fixture.target.request(fixture.operation))).status, "cancelled")
  })
  it("detects a provider linking during the Auth disable race and never deletes that identity or copies progress", async () => {
    const fixture = await setup()
    await reach(fixture, "copy")
    const racedAuth = override(auth, { updateUser: async (uid, update) => {
      await linkWithCredential(fixture.source.user, credential())
      return auth.updateUser(uid, update)
    } })
    const result = await accountMergeLifecycle(db, racedAuth).process(fixture.source.user.uid)
    assert.equal(result.status, "review")
    assert.equal((await auth.getUser(fixture.source.user.uid)).providerData.length, 1)
    assert.equal((await contents(fixture.source.user.uid, "games")).length, 2)
    assert.equal((await contents(fixture.target.user.uid, "games")).length, 1)
    assert.equal((await fixture.job.get()).data().imported, 0)
    // It remains disabled for explicit reconciliation; do not blindly undo a
    // possible administrative disable or delete the newly linked identity.
    assert.equal((await auth.getUser(fixture.source.user.uid)).disabled, true)
    const blocked = await reconciliation.inspect(selection(fixture))
    assert.ok(blocked.blockers.some(message => message.includes("Source must exist and be enabled")))
    await assert.rejects(reconciliation.apply(blocked, confirmation(blocked)), /blocked/)
    assert.equal((await auth.getUser(fixture.source.user.uid)).disabled, true)
    // Simulate the separate, explicitly reviewed administrative identity step.
    // The reconciliation library itself never updates or re-enables Auth.
    await auth.updateUser(fixture.source.user.uid, { disabled: false })
    await assert.rejects(reconciliation.apply(blocked, confirmation(blocked)), /changed/)
    const approved = await reconciliation.inspect(selection(fixture))
    assert.deepEqual(approved.blockers, [])
    assert.equal((await reconciliation.apply(approved, confirmation(approved))).status, "cancelled")
    assert.equal((await auth.getUser(fixture.source.user.uid)).providerData.length, 1)
    assert.equal((await contents(fixture.source.user.uid, "games")).length, 2)
    assert.deepEqual(await contents(fixture.target.user.uid, "games"), [fixture.existing])
    for (const uid of [fixture.source.user.uid, fixture.target.user.uid]) assert.equal((await db.doc(`accountMergeLocks/${uid}`).get()).exists, false)
  })
  for (const fault of ["delete-rejected", "delete-response-lost", "cleanup-rejected"]) {
    it(`recovers through the saved account when guest retirement has ${fault}`, async () => {
      const fixture = await setup()
      await reach(fixture, "copied")
      const failingAuth = override(auth, { deleteUser: async uid => {
        if (fault === "delete-response-lost") await auth.deleteUser(uid)
        throw new Error("synthetic private Auth error must not escape")
      } })
      const failingDb = override(db, { recursiveDelete: async () => { throw new Error("synthetic cleanup failure") } })
      const service = accountMergeLifecycle(fault === "cleanup-rejected" ? failingDb : db, fault === "cleanup-rejected" ? auth : failingAuth)
      assert.equal((await service.process(fixture.source.user.uid)).status, "pending")
      assert.equal((await fixture.job.get()).data().retirement, "requested")
      assert.equal((await db.doc(`accountMergeLocks/${fixture.target.user.uid}`).get()).exists, true)
      const resumed = await fixture.service.resume(fixture.target.request(fixture.operation))
      assert.equal(resumed.status, "complete")
      assert.equal(resumed.imported, 1)
      assert.equal((await contents(fixture.target.user.uid, "privateStats"))[0].games, 1)
      await assert.rejects(auth.getUser(fixture.source.user.uid), { code: "auth/user-not-found" })
    })
  }
  it("rechecks the final statistics before deleting the guest", async () => {
    const fixture = await setup()
    await reach(fixture, "copied")
    await db.doc(`players/${fixture.target.user.uid}/privateStats/summary`).update({ allTimeScore: 99999 })
    assert.equal((await fixture.service.process(fixture.source.user.uid)).status, "review")
    assert.equal((await auth.getUser(fixture.source.user.uid)).disabled, true)
    assert.equal((await contents(fixture.source.user.uid, "games")).length, 2)
  })
  it("does not trust a stale or revoked saved-account recovery token", async () => {
    const fixture = await setup()
    const claims = await auth.verifyIdToken(fixture.target.token)
    const waitMs = Math.max(0, (claims.auth_time + 1) * 1000 + 30 - Date.now())
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs))
    await auth.revokeRefreshTokens(fixture.target.user.uid)
    for (const method of ["status", "resume", "cancel"]) await assert.rejects(fixture.service[method](fixture.target.request(fixture.operation)), { code: "unauthenticated" })
    assert.equal((await fixture.job.get()).data().imported, 0)
  })
  it("resumes an expired worker lease while respecting a live lease", async () => {
    const fixture = await setup()
    await fixture.job.update({ lease: "previous-worker", nextAttemptAt: Timestamp.fromMillis(Date.now() + 60_000) })
    assert.equal((await fixture.service.resume(fixture.target.request(fixture.operation))).status, "pending")
    assert.equal((await fixture.job.get()).data().phase, undefined)
    await fixture.job.update({ nextAttemptAt: Timestamp.fromMillis(Date.now() - 1000) })
    assert.equal((await fixture.service.resume(fixture.target.request(fixture.operation))).status, "complete")
  })
  it("erases merge archives and every completed/cancelled provenance page when the saved account is deleted", async () => {
    const fixture = await setup()
    assert.equal((await fixture.service.resume(fixture.target.request(fixture.operation))).status, "complete")
    const other = await session(true)
    const otherJob = db.doc(`accountMerges/${randomUUID()}`)
    await otherJob.set({ targetUid: other.user.uid, status: "complete" })
    const batch = db.batch()
    for (let index = 0; index < 23; index++) batch.set(db.doc(`accountMerges/${randomUUID()}`), { targetUid: fixture.target.user.uid, status: index % 2 ? "complete" : "cancelled" })
    await batch.commit()
    const deletion = accountDeletion(db, auth)
    const { secret } = await deletion.prepare(fixture.target.request({}))
    assert.deepEqual(await deletion.request(fixture.target.request({ confirmation: "DELETE", secret })), { accepted: true, complete: true })
    for (const path of ["games", "privateStats", "gameHistoryV2", "mergedGuestGames"]) assert.deepEqual(await contents(fixture.target.user.uid, path), [])
    assert.equal((await db.collection("accountMerges").where("targetUid", "==", fixture.target.user.uid).get()).size, 0)
    assert.equal((await fixture.job.get()).exists, false)
    assert.equal((await otherJob.get()).exists, true)
    assert.equal((await auth.getUser(other.user.uid)).disabled, false)
    const tombstone = await db.doc(`accountMergeLocks/${fixture.source.user.uid}`).get()
    assert.deepEqual(Object.keys(tombstone.data()).sort(), ["purgeAt", "role"])
    assert.equal(tombstone.data().role, "retired")
  })
  it("does not claim deletion complete when provenance cleanup fails, then retries without touching another account", async () => {
    const fixture = await setup()
    assert.equal((await fixture.service.resume(fixture.target.request(fixture.operation))).status, "complete")
    const failingDb = override(db, { collection: path => {
      if (path === "accountMerges") throw new Error("injected provenance query failure")
      return db.collection(path)
    } })
    const deletion = accountDeletion(failingDb, auth)
    const { secret } = await deletion.prepare(fixture.target.request({}))
    assert.deepEqual(await deletion.request(fixture.target.request({ confirmation: "DELETE", secret })), { accepted: true, complete: false })
    assert.equal((await fixture.job.get()).exists, true)
    await db.doc(`accountDeletions/${fixture.target.user.uid}`).update({ nextAttemptAt: Timestamp.fromMillis(Date.now() - 1000) })
    assert.equal(await accountDeletion(db, auth).process(fixture.target.user.uid), true)
    assert.equal((await fixture.job.get()).exists, false)
  })
  it("purges expired retired and cancellation markers without removing live operation locks", async () => {
    const fixture = await setup()
    await fixture.service.cancel(fixture.target.request(fixture.operation))
    await fixture.job.update({ purgeAt: Timestamp.fromMillis(Date.now() - 1000) })
    const retired = db.doc(`accountMergeLocks/${randomUUID()}`)
    const live = db.doc(`accountMergeLocks/${randomUUID()}`)
    await retired.set({ role: "retired", purgeAt: Timestamp.fromMillis(Date.now() - 1000) })
    await live.set({ role: "target", jobId: "other", purgeAt: Timestamp.fromMillis(Date.now() - 1000) })
    await fixture.service.retry()
    assert.equal((await retired.get()).exists, false)
    assert.equal((await live.get()).exists, true)
    assert.equal((await fixture.job.get()).exists, false)
  })
  it("removes a cancelled source's operation record when that guest is deleted", async () => {
    const fixture = await setup()
    await fixture.service.cancel(fixture.target.request(fixture.operation))
    const targetBefore = await contents(fixture.target.user.uid, "games")
    const deletion = accountDeletion(db, auth)
    const { secret } = await deletion.prepare(fixture.source.request({}))
    assert.equal((await deletion.request(fixture.source.request({ confirmation: "DELETE", secret }))).complete, true)
    assert.equal((await fixture.job.get()).exists, false)
    assert.deepEqual(await contents(fixture.target.user.uid, "games"), targetBefore)
    assert.equal((await auth.getUser(fixture.target.user.uid)).disabled, false)
  })
  it("retains both profiles for review when the destination becomes disabled", async () => {
    const fixture = await setup()
    await auth.updateUser(fixture.target.user.uid, { disabled: true })
    assert.equal((await fixture.service.process(fixture.source.user.uid)).status, "review")
    assert.equal((await auth.getUser(fixture.source.user.uid)).disabled, false)
    assert.equal((await contents(fixture.source.user.uid, "games")).length, 2)
    assert.equal((await contents(fixture.target.user.uid, "games")).length, 1)
    assert.equal((await fixture.service.cancel(fixture.source.request(fixture.operation))).status, "cancelled")
  })
})
