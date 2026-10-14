import { projectId } from "./environment.mjs"
import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithCredential, OAuthProvider, linkWithCredential, unlink } from "firebase/auth"

const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url))
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app")
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth")
const { getFirestore } = requireFunctions("firebase-admin/firestore")
const { authorizeAccountMerge } = requireFunctions("./lib/accountMergeAuthorization")
const { reserveAccountMerge } = requireFunctions("./lib/accountMergeReservation")
const { accountDeletion } = requireFunctions("./lib/accountDeletion")
const admin = initializeAdmin({ projectId }, `merge-authorization-${randomUUID()}`)
const auth = getAdminAuth(admin)
const db = getFirestore(admin)
const apps = []
after(async () => { await Promise.all(apps.map(deleteApp)); await db.terminate(); await deleteAdmin(admin) })

async function guest() {
  const app = initializeApp({ projectId, apiKey: "emulator-only", appId: "emulator-only" }, randomUUID())
  apps.push(app)
  const client = getAuth(app)
  connectAuthEmulator(client, "http://127.0.0.1:9199", { disableWarnings: true })
  const { user } = await signInAnonymously(client)
  return { client, user, token: await user.getIdToken() }
}
function providerCredential(provider = "google.com") {
  // Official Auth-emulator-only OpenID fixture. These are synthetic provider
  // claims, not real Google/Apple credentials or evidence of native OAuth.
  return new OAuthProvider(provider).credential({ idToken: JSON.stringify({
    sub: randomUUID(), email: `${randomUUID()}@example.test`, email_verified: true,
  }) })
}
async function linked(provider = "google.com") {
  const session = await guest()
  const credential = providerCredential(provider)
  await linkWithCredential(session.user, credential)
  const { user } = await signInWithCredential(session.client, credential)
  return { ...session, user, token: await user.getIdToken(true) }
}
async function requestFor(source, destination) {
  // Supply only claims actually verified by Firebase, as onCall middleware does.
  // Intentionally leave revocation checking to the function's current-record
  // check for the caller, matching the callable middleware's default behavior.
  const token = await auth.verifyIdToken(source.token)
  return { auth: { uid: token.uid, token }, data: { confirmation: "MERGE", targetIdToken: destination.token, operationId: randomUUID() } }
}
async function revokeAfterIssuance(session) {
  const decoded = await auth.verifyIdToken(session.token)
  // Firebase's revocation boundary has second precision; don't create a flaky
  // test by revoking in the same second in which the session was authenticated.
  const waitMs = Math.max(0, (decoded.auth_time + 1) * 1000 + 30 - Date.now())
  if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs))
  await auth.revokeRefreshTokens(session.user.uid)
}

describe("account merge authorization against real Auth emulator records", () => {
  for (const provider of ["google.com", "apple.com"]) {
    it(`proves ownership of a guest and a distinct ${provider} profile without changing either session`, async () => {
      const source = await guest()
      const destination = await linked(provider)
      const before = (await auth.getUser(source.user.uid)).toJSON()
      const request = await requestFor(source, destination)
      const result = await authorizeAccountMerge(auth, request)
      assert.deepEqual(result, { sourceUid: source.user.uid, targetUid: destination.user.uid, operationId: request.data.operationId })
      assert.equal(source.client.currentUser.uid, source.user.uid)
      assert.equal(source.client.currentUser.isAnonymous, true)
      assert.equal(destination.client.currentUser.uid, destination.user.uid)
      assert.deepEqual((await auth.getUser(source.user.uid)).toJSON(), before)
    })
  }
  it("rejects a still-valid anonymous token after that guest links on another device", async () => {
    const source = await guest()
    const destination = await linked()
    const request = await requestFor(source, destination)
    assert.equal(request.auth.token.firebase.sign_in_provider, "anonymous")
    await linkWithCredential(source.user, providerCredential())
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated" })
  })
  it("rejects a revoked source session using the current Auth record", async () => {
    const source = await guest()
    const destination = await linked()
    const request = await requestFor(source, destination)
    await revokeAfterIssuance(source)
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated" })
  })
  it("rejects a revoked destination token through Admin token verification", async () => {
    const source = await guest()
    const destination = await linked()
    const request = await requestFor(source, destination)
    await revokeAfterIssuance(destination)
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated" })
  })
  it("rejects destination provider removal even when its old token still verifies", async () => {
    const source = await guest()
    const destination = await linked()
    const request = await requestFor(source, destination)
    await unlink(destination.user, "google.com")
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated" })
  })
  it("rejects disabled and deleted destinations without leaking their Auth error", async () => {
    const source = await guest()
    const destination = await linked()
    const request = await requestFor(source, destination)
    await auth.updateUser(destination.user.uid, { disabled: true })
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated", message: "We couldn't verify both accounts. Sign in and try again." })
    await auth.deleteUser(destination.user.uid)
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated", message: "We couldn't verify both accounts. Sign in and try again." })
  })
  it("requires recent authentication rather than a newly refreshed old session", async () => {
    const source = await guest()
    const destination = await linked()
    destination.token = await destination.user.getIdToken(true)
    const request = await requestFor(source, destination)
    const claims = await auth.verifyIdToken(destination.token, true)
    await assert.rejects(authorizeAccountMerge(auth, request, () => (claims.auth_time + 301) * 1000), {
      code: "failed-precondition", details: { reason: "reauthentication-required" },
    })
  })
  it("rejects an anonymous destination and a non-Firebase provider token", async () => {
    const source = await guest()
    const destination = await guest()
    const request = await requestFor(source, destination)
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated" })
    request.data.targetIdToken = "not-a-firebase-token"
    await assert.rejects(authorizeAccountMerge(auth, request), { code: "unauthenticated" })
  })
})

describe("durable account merge reservations", () => {
  const job = source => db.doc(`accountMerges/${source.user.uid}`)
  const lock = session => db.doc(`accountMergeLocks/${session.user.uid}`)
  it("coalesces concurrent retries and preserves an advanced cursor without storing tokens", async () => {
    const source = await guest()
    const target = await linked()
    const request = await requestFor(source, target)
    const results = await Promise.all(Array.from({ length: 3 }, () => reserveAccountMerge(db, auth, request)))
    assert.deepEqual(results[0], results[1])
    assert.deepEqual(results[1], results[2])
    const original = (await job(source).get()).data()
    assert.deepEqual(Object.keys(original).sort(), ["sourceUid", "targetUid", "status", "policyVersion", "operationId", "cursor", "imported", "conflicts", "startedAt", "updatedAt", "nextAttemptAt"].sort())
    assert.equal(original.cursor, null)
    assert.equal(original.imported, 0)
    assert.deepEqual((await lock(source).get()).data(), { jobId: source.user.uid, role: "source" })
    assert.deepEqual((await lock(target).get()).data(), { jobId: source.user.uid, role: "target" })
    await job(source).update({ cursor: "movies_2026-10-12", imported: 7, conflicts: 2 })
    const advanced = (await job(source).get()).data()
    await reserveAccountMerge(db, auth, request)
    assert.deepEqual((await job(source).get()).data(), advanced)
    assert.equal(source.client.currentUser.uid, source.user.uid)
    assert.equal(target.client.currentUser.uid, target.user.uid)
  })
  for (const shared of ["source", "target"]) {
    it(`allows only one competing reservation sharing a ${shared}`, async () => {
      const sources = [await guest(), await guest()]
      const targets = [await linked(), await linked()]
      if (shared === "source") sources[1] = sources[0]
      else targets[1] = targets[0]
      const requests = await Promise.all(sources.map((source, i) => requestFor(source, targets[i])))
      const results = await Promise.allSettled(requests.map(request => reserveAccountMerge(db, auth, request)))
      assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
      const losing = results.findIndex(result => result.status === "rejected")
      assert.equal(results[losing].reason.code, "already-exists")
      const winning = 1 - losing
      const saved = (await job(sources[winning]).get()).data()
      assert.equal(saved.targetUid, targets[winning].user.uid)
      assert.equal((await lock(shared === "source" ? targets[losing] : sources[losing]).get()).exists, false)
      if (shared === "target") assert.equal((await job(sources[losing]).get()).exists, false)
    })
  }
  for (const role of ["source", "target"]) {
    it(`rejects a ${role} deletion barrier without creating partial merge records`, async () => {
      const source = await guest()
      const target = await linked()
      const session = role === "source" ? source : target
      await db.doc(`accountDeletions/${session.user.uid}`).set({ status: "pending" })
      await assert.rejects(reserveAccountMerge(db, auth, await requestFor(source, target)), { code: "failed-precondition" })
      for (const ref of [job(source), lock(source), lock(target)]) assert.equal((await ref.get()).exists, false)
    })
    it(`prevents deletion of the reserved ${role}, including with a receipt prepared earlier`, async () => {
      const source = await guest()
      const target = await linked()
      const session = role === "source" ? source : target
      const service = accountDeletion(db, auth)
      const token = await auth.verifyIdToken(session.token)
      const request = { auth: { uid: token.uid, token }, data: {} }
      const { secret } = await service.prepare(request)
      await reserveAccountMerge(db, auth, await requestFor(source, target))
      await assert.rejects(service.prepare(request), { code: "failed-precondition", details: { reason: "account-merge-pending" } })
      await assert.rejects(service.request({ ...request, data: { confirmation: "DELETE", secret } }), { code: "failed-precondition", details: { reason: "account-merge-pending" } })
      assert.equal((await db.doc(`accountDeletions/${session.user.uid}`).get()).exists, false)
      assert.equal((await auth.getUser(session.user.uid)).disabled, false)
    })
  }
  it("fails closed on orphaned locks and inconsistent retry state", async () => {
    const source = await guest()
    const target = await linked()
    const request = await requestFor(source, target)
    await lock(target).set({ jobId: "another-operation", role: "target" })
    await assert.rejects(reserveAccountMerge(db, auth, request), { code: "already-exists" })
    assert.equal((await job(source).get()).exists, false)
    assert.equal((await lock(source).get()).exists, false)
    await lock(target).delete()
    await reserveAccountMerge(db, auth, request)
    await lock(source).delete()
    const original = (await job(source).get()).data()
    await assert.rejects(reserveAccountMerge(db, auth, request), { code: "failed-precondition" })
    assert.equal((await lock(source).get()).exists, false)
    assert.deepEqual((await job(source).get()).data(), original)
  })
})
