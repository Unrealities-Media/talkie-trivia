import { projectId } from "./environment.mjs"
import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { randomUUID } from "node:crypto"
import { initializeApp, deleteApp } from "firebase/app"
import { initializeAuth, inMemoryPersistence, connectAuthEmulator, signInAnonymously, signInWithCredential, GoogleAuthProvider, updateCurrentUser } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions"

const apps = []
after(async () => { await Promise.all(apps.map(deleteApp)) })
function client() {
  const app = initializeApp({ projectId, apiKey: "emulator-only", appId: "emulator-only" }, randomUUID())
  apps.push(app)
  const auth = initializeAuth(app, { persistence: inMemoryPersistence })
  connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true })
  const functions = getFunctions(app)
  connectFunctionsEmulator(functions, "127.0.0.1", 5101)
  return { app, auth, call: async (name, data) => (await httpsCallable(functions, name, { timeout: 135000 })(data)).data }
}
async function fixture() {
  const primary = client()
  const secondary = client()
  const source = (await signInAnonymously(primary.auth)).user
  const credential = GoogleAuthProvider.credential(JSON.stringify({ sub: randomUUID(), email: `${randomUUID()}@example.test`, email_verified: true }))
  const target = (await signInWithCredential(secondary.auth, credential)).user
  const request = { confirmation: "MERGE", targetIdToken: await target.getIdToken(), operationId: randomUUID() }
  return { primary, secondary, source, target, request }
}
describe("merge callable client contract", () => {
  it("keeps the guest primary until confirmed completion and persists a copy independent of temporary Auth", async () => {
    const { primary, secondary, source, target, request } = await fixture()
    assert.equal(primary.auth.currentUser.uid, source.uid)
    const begun = await primary.call("beginAccountMerge", request)
    assert.equal(begun.status, "pending")
    assert.equal(begun.targetUid, target.uid)
    assert.equal(begun.operationId, request.operationId)
    assert.equal(primary.auth.currentUser.uid, source.uid)
    const operation = { jobId: source.uid, operationId: request.operationId }
    assert.deepEqual(await secondary.call("getAccountMergeStatus", {}), begun)
    let status = begun
    for (let page = 0; page < 5 && status.status === "pending"; page++) status = await secondary.call("resumeAccountMerge", operation)
    assert.equal(status.status, "complete")
    assert.equal(status.imported, 0)
    assert.equal(primary.auth.currentUser.uid, source.uid)
    assert.equal((await secondary.call("getAccountMergeStatus", operation)).status, "complete")
    await assert.rejects(primary.call("getAccountMergeStatus", operation), { code: "functions/unauthenticated" })
    await updateCurrentUser(primary.auth, target)
    await deleteApp(secondary.app)
    apps.splice(apps.indexOf(secondary.app), 1)
    assert.equal(primary.auth.currentUser.uid, target.uid)
    assert.ok(await primary.auth.currentUser.getIdToken(true))
    assert.equal((await primary.call("getAccountMergeStatus", {})).status, "none")
    assert.equal((await primary.call("getAccountMergeStatus", operation)).status, "complete")
  })
  it("recovers a dropped begin response by operation ID and never restarts cancelled consent", async () => {
    const { primary, secondary, source, request } = await fixture()
    await primary.call("beginAccountMerge", request) // Deliberately discard the response.
    const operation = { jobId: source.uid, operationId: request.operationId }
    assert.equal((await secondary.call("getAccountMergeStatus", operation)).status, "pending")
    assert.equal((await secondary.call("cancelAccountMerge", operation)).status, "cancelled")
    assert.equal((await primary.call("beginAccountMerge", request)).status, "cancelled")
    assert.equal(primary.auth.currentUser.uid, source.uid)
    const newer = { ...request, operationId: randomUUID(), previousOperationId: request.operationId }
    assert.equal((await primary.call("beginAccountMerge", newer)).status, "pending")
    assert.equal((await secondary.call("cancelAccountMerge", operation)).status, "none")
    await secondary.call("cancelAccountMerge", { ...operation, operationId: newer.operationId })
    await assert.rejects(primary.call("beginAccountMerge", request), { code: "functions/failed-precondition" })
  })
  it("does not disclose other accounts' operations or accept unauthenticated commands", async () => {
    const { primary, source, request } = await fixture()
    await primary.call("beginAccountMerge", request)
    const stranger = client()
    const operation = { jobId: source.uid, operationId: request.operationId }
    await assert.rejects(stranger.call("getAccountMergeStatus", operation), { code: "functions/unauthenticated" })
    await signInAnonymously(stranger.auth)
    for (const name of ["getAccountMergeStatus", "cancelAccountMerge", "resumeAccountMerge"]) {
      assert.deepEqual(await stranger.call(name, operation), { status: "none" })
    }
    await primary.call("cancelAccountMerge", operation)
  })
  it("cancels an unaccepted request so a delayed begin cannot start copying", async () => {
    const { primary, secondary, source, target, request } = await fixture()
    const operation = { jobId: source.uid, operationId: request.operationId }
    // The original source can withdraw consent without reauthenticating a
    // destination that may now be unavailable. It cannot affect that destination.
    const cancelled = await primary.call("cancelAccountMerge", { ...operation, targetUid: target.uid })
    assert.equal(cancelled.status, "cancelled")
    assert.equal(cancelled.imported, 0)
    assert.equal((await primary.call("beginAccountMerge", request)).status, "cancelled")
    assert.deepEqual(await secondary.call("getAccountMergeStatus", {}), { status: "none" })
    assert.equal(primary.auth.currentUser.uid, source.uid)
    await assert.rejects(secondary.call("cancelAccountMerge", { ...operation, targetUid: target.uid }), { code: "functions/invalid-argument" })
  })
  it("serializes an in-flight begin against cancellation without leaving a playable partial account", async () => {
    const { primary, secondary, source, target, request } = await fixture()
    const operation = { jobId: source.uid, operationId: request.operationId }
    const [, cancelled] = await Promise.all([
      primary.call("beginAccountMerge", request),
      primary.call("cancelAccountMerge", { ...operation, targetUid: target.uid }),
    ])
    assert.equal(cancelled.status, "cancelled")
    assert.equal((await secondary.call("getAccountMergeStatus", operation)).status, "cancelled")
    assert.equal((await primary.call("beginAccountMerge", request)).status, "cancelled")
    assert.deepEqual(await secondary.call("getAccountMergeStatus", {}), { status: "none" })
  })
})
