import { projectId } from "./environment.mjs"
import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { initializeApp, deleteApp } from "firebase/app"
import { initializeAuth, inMemoryPersistence, connectAuthEmulator, signInAnonymously, onAuthStateChanged, signOut } from "firebase/auth"
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions"
import { withSessionRefresh } from "../../src/services/sessionRefresh.ts"

const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url))
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app")
const { getAuth } = requireFunctions("firebase-admin/auth")
const admin = initializeAdmin({ projectId }, `session-recovery-${randomUUID()}`)
const adminAuth = getAuth(admin)
const apps = []
after(async () => { await Promise.all(apps.map(deleteApp)); await deleteAdmin(admin) })

async function fixture() {
  const app = initializeApp({ projectId, apiKey: "emulator-only", appId: "emulator-only" }, randomUUID())
  apps.push(app)
  const auth = initializeAuth(app, { persistence: inMemoryPersistence })
  connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true })
  const functions = getFunctions(app)
  connectFunctionsEmulator(functions, "127.0.0.1", 5101)
  const user = (await signInAnonymously(auth)).user
  const read = async () => (await httpsCallable(functions, "getAccountMergeStatus")({})).data
  assert.deepEqual(await read(), { status: "none" })
  return { auth, user, read }
}

describe("cached session rejection through real callable and Auth SDK", () => {
  it("loads a valid session without an unnecessary forced refresh", async () => {
    const { auth, user, read } = await fixture()
    let refreshes = 0
    const result = await withSessionRefresh({ getIdToken: async force => { refreshes++; return user.getIdToken(force) } },
      () => auth.currentUser === user, read)
    assert.deepEqual(result, { status: "none" })
    assert.equal(refreshes, 0)
    assert.equal(auth.currentUser, user)
  })

  for (const invalidation of ["revoked", "disabled"]) {
    it(`invalidates a ${invalidation} cached session through refresh without replacing or deleting its account`, async () => {
      const { auth, user, read } = await fixture()
      if (invalidation === "revoked") {
        const { claims } = await user.getIdTokenResult()
        const delay = Math.max(0, (Number(claims.auth_time) + 1) * 1000 + 30 - Date.now())
        if (delay) await new Promise(resolve => setTimeout(resolve, delay))
        await adminAuth.revokeRefreshTokens(user.uid)
      } else await adminAuth.updateUser(user.uid, { disabled: true })
      const before = (await adminAuth.getUser(user.uid)).toJSON()
      const uids = (await adminAuth.listUsers()).users.map(record => record.uid).sort()
      // The callable rejects revocation, but this alone leaves Firebase signed in.
      await assert.rejects(read(), { code: "functions/unauthenticated" })
      assert.equal(auth.currentUser, user)
      let refreshes = 0
      let sawSignedOut = false
      const unsubscribe = onAuthStateChanged(auth, current => { if (!current) sawSignedOut = true })
      try {
        await assert.rejects(withSessionRefresh({ getIdToken: async force => { refreshes++; return user.getIdToken(force) } },
          () => auth.currentUser === user, read),
        invalidation === "revoked"
          ? { code: "functions/unauthenticated", details: { reason: "session-invalid" } }
          : { code: "auth/user-disabled" })
        assert.equal(refreshes, 1)
        if (invalidation === "revoked") {
          // The emulator permits refresh with the original revoked auth_time.
          // AuthProvider signs out only on this explicit second server rejection.
          assert.equal(auth.currentUser, user)
          await signOut(auth)
        }
        assert.equal(auth.currentUser, null)
        assert.equal(sawSignedOut, true)
        const after = (await adminAuth.getUser(user.uid)).toJSON()
        // Successful token refresh may advance Auth's own refresh timestamp;
        // identity, sign-in time, revocation boundary and providers must not change.
        if (after.metadata.lastRefreshTime && before.metadata.lastRefreshTime) {
          assert.ok(Date.parse(after.metadata.lastRefreshTime) >= Date.parse(before.metadata.lastRefreshTime))
        }
        delete after.metadata.lastRefreshTime
        delete before.metadata.lastRefreshTime
        assert.deepEqual(after, before)
        assert.deepEqual((await adminAuth.listUsers()).users.map(record => record.uid).sort(), uids)
      } finally { unsubscribe() }
    })
  }
})
