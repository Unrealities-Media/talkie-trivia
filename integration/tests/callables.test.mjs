import { projectId, functionBase } from "./environment.mjs"
import assert from "node:assert/strict"
import { beforeEach, after, describe, it } from "node:test"
import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import { randomUUID, createHash } from "node:crypto"
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, connectAuthEmulator, signInAnonymously, linkWithCredential, EmailAuthProvider, signOut, signInWithEmailAndPassword } from "firebase/auth"

const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url))
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = requireFunctions("firebase-admin/app")
const { getFirestore, Timestamp } = requireFunctions("firebase-admin/firestore")
const { getAuth: getAdminAuth } = requireFunctions("firebase-admin/auth")
const { accountDeletion } = requireFunctions("./lib/accountDeletion")
const { planAccountMergePage } = requireFunctions("./lib/accountMergePolicy")
const { initialStats } = requireFunctions("./lib/gameEngine")
const admin = initializeAdmin({ projectId })
const db = getFirestore(admin)
const catalog = JSON.parse(await readFile(new URL("../../src/data/searchIndex.json", import.meta.url), "utf8"))
const { version: catalogVersion } = JSON.parse(await readFile(new URL("../../src/data/catalogVersion.json", import.meta.url), "utf8"))
const answer = catalog[0]
const apps = []
const secrets = new Map()
let day

async function guest() {
  const app = initializeApp({ projectId, apiKey: "emulator-only", appId: "emulator-only" }, randomUUID())
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true })
  const credential = await signInAnonymously(auth)
  return { uid: credential.user.uid, auth, token: await credential.user.getIdToken() }
}
async function call(name, data, token) {
  if (name === "deleteAccount" && token && !data.secret) {
    if (!secrets.has(token)) secrets.set(token, (await call("prepareAccountDeletion", {}, token)).secret)
    data = { ...data, secret: secrets.get(token) }
  }
  const result = await fetch(`${functionBase}/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ data }), signal: AbortSignal.timeout(45000),
  })
  const body = await result.json()
  if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.status, status: result.status })
  assert.equal(result.status, 200)
  return body.result
}
const start = (user, overrides = {}) => call("startGame", { difficulty: "LEVEL_2", catalogVersion, ...overrides }, user?.token)
const command = (overrides = {}) => ({ challengeId: `${day}_LEVEL_2`, expectedRevision: 0, actionId: randomUUID(), type: "guess", itemId: answer.i, ...overrides })
const move = (user, data) => call("applyGameAction", data, user.token)
const saved = async (user, path) => (await db.doc(`players/${user.uid}/${path}`).get()).data()
const deletionData = async user => ({ confirmation: "DELETE", secret: (await accountDeletion(db, getAdminAuth(admin)).prepare({ auth: { uid: user.uid }, data: {} })).secret })
beforeEach(async () => {
  secrets.clear()
  const reset = await fetch(`http://127.0.0.1:8180/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE", signal: AbortSignal.timeout(10000) })
  assert.equal(reset.status, 200)
  day = new Date().toISOString().slice(0, 10)
  const description = "An editorially reviewed test clue about a character confronting an unexpected challenge and choosing a different future."
  for (let level = 1; level <= 5; level++) await db.doc(`dailyGames/${day}_LEVEL_${level}`).set({
    movieId: answer.i, difficulty: `LEVEL_${level}`, schemaVersion: 1, catalogVersion, date: new Date(`${day}T00:00:00Z`),
    content: { description, imdbId: "", tagline: "" },
    contentHash: createHash("sha256").update(`${answer.i}\n${description}\n\n`).digest("hex"),
    reviewedBy: "automated-fixture-only", reviewedAt: new Date(Date.now() - 86400000).toISOString(),
  })
})
after(async () => { await Promise.all(apps.map(deleteApp)); await db.terminate(); await deleteAdmin(admin) })

describe("merge policy with real server-owned game snapshots", () => {
  it("resumes five independent games and credits a single daily streak and All Five day", async () => {
    const user = await guest()
    for (let level = 1; level <= 5; level++) {
      const difficulty = `LEVEL_${level}`
      const first = await start(user, { difficulty })
      assert.equal(first.game.revision, 0)
      const action = command({ challengeId: `${day}_${difficulty}`, type: 'giveUp', itemId: undefined })
      const completed = await move(user, action)
      assert.equal(completed.stats.games, level)
      assert.equal(completed.stats.currentStreak, 1)
      assert.equal(completed.stats.byDifficulty[difficulty].games, 1)
      assert.deepEqual((await move(user, action)).stats, completed.stats)
    }
    for (let level = 1; level <= 5; level++) {
      const resumed = await start(user, { difficulty: `LEVEL_${level}` })
      assert.equal(resumed.game.gaveUp, true)
      assert.equal(resumed.game.revision, 1)
      assert.equal(resumed.stats.games, 5)
      assert.deepEqual(resumed.stats.allFiveDays, [day])
    }
    assert.equal((await db.collection(`players/${user.uid}/gameHistoryV2`).get()).size, 5)
  })
  it("blocks all gameplay callables for either reservation role without changing saved progress", async () => {
    const user = await guest()
    await start(user)
    const game = await saved(user, `games/movies_${day}_LEVEL_2`)
    const stats = await saved(user, "privateStats/summary")
    for (const role of ["source", "target"]) {
      await db.doc(`accountMergeLocks/${user.uid}`).set({ jobId: user.uid, role })
      await assert.rejects(start(user), { code: "FAILED_PRECONDITION" })
      await assert.rejects(move(user, command()), { code: "FAILED_PRECONDITION" })
      await assert.rejects(call("submitGameResult", { challengeId: `${day}_LEVEL_2` }, user.token), { code: "FAILED_PRECONDITION" })
      assert.deepEqual(await saved(user, `games/movies_${day}_LEVEL_2`), game)
      assert.deepEqual(await saved(user, "privateStats/summary"), stats)
    }
  })
  it("imports a partial guest game without resetting its hints, then completes once through the actual callable", async () => {
    const source = await guest()
    const destination = await guest()
    // This is a policy/storage fixture, not the account-merge authorization API.
    // No public merge endpoint exists until the resumable workflow and recovery
    // are implemented. Both synthetic accounts are controlled by this test.
    await start(source)
    await move(source, command({ type: "hint", hintType: "director", itemId: undefined }))
    const original = await saved(source, `games/movies_${day}_LEVEL_2`)
    const targetGameRef = db.doc(`players/${destination.uid}/games/${original.id}`)
    const targetStatsRef = db.doc(`players/${destination.uid}/privateStats/summary`)
    await db.runTransaction(async tx => {
      const [gameDoc, statsDoc] = await Promise.all([tx.get(targetGameRef), tx.get(targetStatsRef)])
      const plan = planAccountMergePage({
        sourceUid: source.uid, targetUid: destination.uid, sourceGames: [original],
        destinationGames: new Map([[original.id, gameDoc.data()]]),
        targetStats: statsDoc.exists ? statsDoc.data() : initialStats(destination.uid),
      })
      assert.equal(plan.imported, 1)
      assert.equal(plan.writes[0].history, undefined)
      tx.create(targetGameRef, plan.writes[0].game)
      tx.set(targetStatsRef, plan.stats)
    })
    const resumed = await start(destination)
    assert.equal(resumed.game.playerID, destination.uid)
    assert.equal(resumed.game.revision, 1)
    assert.deepEqual(resumed.game.hintsUsed, { director: true })
    assert.equal(resumed.stats.hintsUsedCount, 1)
    const action = command({ expectedRevision: 1 })
    const completed = await move(destination, action)
    const replay = await move(destination, action)
    assert.equal(completed.game.score, 500)
    assert.deepEqual(completed.stats, replay.stats)
    assert.equal(completed.stats.games, 1)
    assert.equal(completed.stats.allTimeScore, 500)
    assert.deepEqual(await saved(source, `games/${original.id}`), original)
    const history = await saved(destination, `gameHistoryV2/${day}_LEVEL_2`)
    assert.equal(history.score, 500)
    assert.equal(history.guessCount, 1)
    const again = planAccountMergePage({
      sourceUid: source.uid, targetUid: destination.uid, sourceGames: [original],
      destinationGames: new Map([[original.id, await saved(destination, `games/${original.id}`)]]),
      targetStats: await saved(destination, "privateStats/summary"),
    })
    assert.equal(again.alreadyImported, 1)
    assert.deepEqual(again.writes, [])
    assert.deepEqual(again.stats, completed.stats)
  })
})

describe("account deletion against real Auth and Firestore", () => {
  it("deletes owned current and legacy data, retains other accounts, and blocks stale tokens", async () => {
    const user = await guest()
    const other = await guest()
    await start(user)
    await move(user, command())
    await start(other)
    await Promise.all([
      db.doc(`players/${user.uid}`).set({ id: user.uid, name: "Player" }),
      db.doc(`players/${user.uid}/gameHistory/old`).set({ score: 2 }),
      db.doc(`players/${user.uid}/unknown/private`).set({ old: true }),
      db.doc(`playerStats/${user.uid}`).set({ games: 2 }),
      db.doc(`playerGames/${user.uid}-2025-01-01`).set({ playerID: user.uid }),
      db.doc(`playerGames/${user.uid}-2025-01-02`).set({ missingOwner: true }),
      db.doc(`playerGames/${user.uid}-another-2025-01-02`).set({ playerID: other.uid }),
    ])
    const legacy = db.batch()
    for (let index = 0; index < 205; index++) legacy.set(db.doc(`playerGames/legacy-${index}`), { playerID: user.uid })
    await legacy.commit()
    await assert.rejects(call("deleteAccount", { confirmation: "DELETE", uid: other.uid }, user.token), { code: "INVALID_ARGUMENT" })
    await assert.rejects(call("deleteAccount", { confirmation: "DELETE" }), { code: "UNAUTHENTICATED" })
    const results = await Promise.all([call("deleteAccount", { confirmation: "DELETE" }, user.token), call("deleteAccount", { confirmation: "DELETE" }, user.token)])
    assert.ok(results.every(result => result.accepted))
    assert.ok(results.some(result => result.complete))
    assert.equal((await db.doc(`players/${user.uid}`).get()).exists, false)
    for (const path of ["games", "privateStats", "gameHistoryV2", "gameHistory", "unknown"]) assert.equal((await db.collection(`players/${user.uid}/${path}`).get()).size, 0)
    assert.equal((await db.doc(`playerStats/${user.uid}`).get()).exists, false)
    assert.equal((await db.doc(`playerGames/${user.uid}-2025-01-01`).get()).exists, false)
    assert.equal((await db.doc(`playerGames/${user.uid}-2025-01-02`).get()).exists, false)
    assert.equal((await db.collection("playerGames").where("playerID", "==", user.uid).get()).size, 0)
    assert.equal((await db.doc(`playerGames/${user.uid}-another-2025-01-02`).get()).exists, true)
    await assert.rejects(getAdminAuth(admin).getUser(user.uid), { code: "auth/user-not-found" })
    await assert.rejects(start(user), { code: "PERMISSION_DENIED" })
    await assert.rejects(move(user, command()), { code: "PERMISSION_DENIED" })
    await assert.rejects(call("submitGameResult", { challengeId: `${day}_LEVEL_2` }, user.token), { code: "PERMISSION_DENIED" })
    assert.equal((await start(other)).game.playerID, other.uid)
    assert.deepEqual(await call("deleteAccount", { confirmation: "DELETE" }, user.token), { accepted: true, complete: true })
    const secret = secrets.get(user.token)
    assert.deepEqual(await call("getAccountDeletionStatus", { uid: user.uid, secret }), { status: "complete" })
    assert.deepEqual(await call("getAccountDeletionStatus", { uid: other.uid, secret }), { status: "unknown" })
    assert.deepEqual(await call("getAccountDeletionStatus", { uid: user.uid, secret: "0".repeat(64) }), { status: "unknown" })
  })

  it("requires recent authentication for linked accounts without queuing unauthorized deletion", async () => {
    const user = await guest()
    await linkWithCredential(user.auth.currentUser, EmailAuthProvider.credential(`${randomUUID()}@example.test`, "emulator-password"))
    const service = accountDeletion(db, getAdminAuth(admin))
    const data = await deletionData(user)
    for (const auth_time of [undefined, NaN, Infinity, Math.floor(Date.now() / 1000) - 301, Math.floor(Date.now() / 1000) + 60]) {
      await assert.rejects(service.request({ auth: { uid: user.uid, token: { auth_time } }, data }), { code: "failed-precondition" })
    }
    assert.equal((await db.doc(`accountDeletions/${user.uid}`).get()).exists, false)
    user.token = await user.auth.currentUser.getIdToken(true)
    assert.equal((await call("deleteAccount", { confirmation: "DELETE" }, user.token)).complete, true)
  })

  it("rejects revoked or malformed guest sessions before creating a deletion job", async () => {
    const user = await guest()
    const auth = getAdminAuth(admin)
    await auth.revokeRefreshTokens(user.uid)
    const owner = await auth.getUser(user.uid)
    const revokedBefore = Date.parse(owner.tokensValidAfterTime) / 1000
    const data = await deletionData(user)
    for (const auth_time of [undefined, NaN, revokedBefore - 1]) {
      await assert.rejects(accountDeletion(db, auth).request({ auth: { uid: user.uid, token: { auth_time } }, data }), { code: "unauthenticated" })
    }
    assert.equal((await db.doc(`accountDeletions/${user.uid}`).get()).exists, false)
    assert.equal((await auth.getUser(user.uid)).disabled, false)
  })

  it("does not recreate saved data when gameplay races deletion", async () => {
    const user = await guest()
    await start(user)
    const results = await Promise.allSettled([
      ...Array.from({ length: 3 }, () => move(user, command())),
      ...Array.from({ length: 3 }, () => start(user)),
      call("deleteAccount", { confirmation: "DELETE" }, user.token),
    ])
    assert.equal(results.at(-1).status, "fulfilled")
    assert.equal(results.at(-1).value.complete, true)
    for (const path of ["games", "privateStats", "gameHistoryV2"]) assert.equal((await db.collection(`players/${user.uid}/${path}`).get()).size, 0)
    await assert.rejects(start(user), { code: "PERMISSION_DENIED" })
  })

  it("keeps the deletion queued after partial Firestore cleanup and resumes safely", async () => {
    const user = await guest()
    await start(user)
    await db.doc(`playerStats/${user.uid}`).set({ legacy: true })
    const faultyDb = new Proxy(db, { get(target, name) {
      if (name === "recursiveDelete") return async ref => { await target.recursiveDelete(ref); throw new Error("injected partial database outage") }
      const value = Reflect.get(target, name)
      return typeof value === "function" ? value.bind(target) : value
    } })
    const auth = getAdminAuth(admin)
    const result = await accountDeletion(faultyDb, auth).request({ auth: { uid: user.uid, token: { auth_time: Math.floor(Date.now() / 1000) } }, data: await deletionData(user) })
    assert.deepEqual(result, { accepted: true, complete: false })
    assert.equal((await auth.getUser(user.uid)).disabled, true)
    assert.equal((await db.doc(`playerStats/${user.uid}`).get()).exists, true)
    const ref = db.doc(`accountDeletions/${user.uid}`)
    await ref.update({ nextAttemptAt: Timestamp.fromMillis(Date.now() - 1) })
    await accountDeletion(db, auth).retry()
    assert.equal((await ref.get()).data().status, "complete")
    assert.equal((await db.doc(`playerStats/${user.uid}`).get()).exists, false)
    await assert.rejects(auth.getUser(user.uid), { code: "auth/user-not-found" })
  })

  it("recovers a failed Auth cleanup from the durable queue and purges only expired receipts", async () => {
    const user = await guest()
    await start(user)
    const auth = getAdminAuth(admin)
    const fault = accountDeletion(db, {
      getUser: auth.getUser.bind(auth), updateUser: auth.updateUser.bind(auth),
      deleteUser: async () => { throw new Error("injected Auth outage") },
    })
    assert.deepEqual(await fault.request({ auth: { uid: user.uid, token: { auth_time: Math.floor(Date.now() / 1000) } }, data: await deletionData(user) }), { accepted: true, complete: false })
    assert.equal((await auth.getUser(user.uid)).disabled, true)
    const ref = db.doc(`accountDeletions/${user.uid}`)
    assert.equal((await ref.get()).data().status, "pending")
    await assert.rejects(start(user), { code: "PERMISSION_DENIED" })
    // Simulate lease expiry after a crashed/timed-out invocation.
    await ref.update({ nextAttemptAt: Timestamp.fromMillis(Date.now() - 1) })
    const service = accountDeletion(db, auth)
    await service.retry()
    await assert.rejects(auth.getUser(user.uid), { code: "auth/user-not-found" })
    const complete = (await ref.get()).data()
    assert.equal(complete.status, "complete")
    assert.equal(complete.attempts, 2)
    assert.equal(complete.nextAttemptAt, undefined)
    assert.ok(complete.purgeAt.toMillis() >= Date.now() + 23 * 3600000)
    await service.retry()
    assert.equal((await ref.get()).exists, true)
    await ref.update({ purgeAt: Timestamp.fromMillis(Date.now() - 1) })
    await service.retry()
    assert.equal((await ref.get()).exists, false)
    const receiptRef = db.doc(`accountDeletionReceipts/${user.uid}`)
    const receipt = (await receiptRef.get()).data()
    assert.deepEqual(await service.status({ data: { uid: user.uid, secret: receipt.secret } }), { status: "complete" })
    await receiptRef.update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) })
    await service.retry()
    assert.equal((await receiptRef.get()).exists, false)
    assert.deepEqual(await service.status({ data: { uid: user.uid, secret: receipt.secret } }), { status: "unknown" })
  })

  it("prepares a reusable receipt without deleting or blocking play; the secret alone cannot delete", async () => {
    const user = await guest()
    const first = await call("prepareAccountDeletion", {}, user.token)
    const second = await call("prepareAccountDeletion", {}, user.token)
    assert.equal(first.secret, second.secret)
    assert.match(first.secret, /^[a-f0-9]{64}$/)
    await start(user)
    assert.equal((await db.doc(`accountDeletions/${user.uid}`).get()).exists, false)
    await assert.rejects(call("deleteAccount", { confirmation: "DELETE", secret: first.secret }), { code: "UNAUTHENTICATED" })
    await assert.rejects(call("deleteAccount", { confirmation: "DELETE", secret: "a".repeat(64) }, user.token), { code: "FAILED_PRECONDITION" })
    assert.deepEqual(await call("getAccountDeletionStatus", { uid: user.uid, secret: first.secret }), { status: "prepared" })
    const ref = db.doc(`accountDeletionReceipts/${user.uid}`)
    await ref.update({ expiresAt: Timestamp.fromMillis(Date.now() - 1) })
    await accountDeletion(db, getAdminAuth(admin)).retry()
    assert.equal((await ref.get()).exists, false)
    assert.equal((await start(user)).game.playerID, user.uid)
  })
})

describe("real Auth, callable HTTP and Firestore transaction contract", () => {
  it("rejects missing/forged authentication, spoofed ownership, catalogs and legacy result payloads", async () => {
    await assert.rejects(start(null), { code: "UNAUTHENTICATED" })
    await assert.rejects(start({ token: "forged" }), { code: "UNAUTHENTICATED" })
    const user = await guest()
    await assert.rejects(start(user, { playerID: "victim" }), { code: "INVALID_ARGUMENT" })
    await assert.rejects(start(user, { catalogVersion: "0".repeat(64) }), { code: "FAILED_PRECONDITION" })
    await assert.rejects(call("submitGameResult", { playerGame: { correctAnswer: true, playerID: "victim" } }, user.token), { code: "INVALID_ARGUMENT" })
    assert.equal((await db.collection(`players/${user.uid}/games`).get()).size, 0)
  })
  it("does not create partial games or stats when reviewed content is unavailable", async () => {
    const user = await guest()
    await db.doc(`dailyGames/${day}_LEVEL_2`).delete()
    await assert.rejects(start(user), { code: "UNAVAILABLE" })
    assert.equal(await saved(user, "privateStats/summary"), undefined)
    assert.equal(await saved(user, `games/movies_${day}_LEVEL_2`), undefined)
  })
  it("concurrent starts preserve separate challenges and server UTC reset", async () => {
    const user = await guest()
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => start(user, { difficulty: index % 2 ? "LEVEL_5" : "LEVEL_2" })))
    assert.equal(new Set(results.map(result => result.game.difficulty)).size, 2)
    assert.equal((await db.collection(`players/${user.uid}/games`).get()).size, 2)
    for (const result of results) {
      assert.equal(result.challengeId, `${day}_${result.game.difficulty}`)
      assert.equal(Date.parse(result.resetAt), Date.parse(`${day}T00:00:00Z`) + 86400000)
      assert.ok(Math.abs(Date.parse(result.serverNow) - Date.now()) < 60000)
    }
  })
  it("concurrent identical winning commands credit exactly once and survive response replay", async () => {
    const user = await guest()
    await start(user)
    const action = command()
    const results = await Promise.all(Array.from({ length: 8 }, () => move(user, action)))
    const stats = await saved(user, "privateStats/summary")
    assert.equal(stats.games, 1)
    assert.equal(stats.wins.reduce((sum, wins) => sum + wins, 0), 1)
    assert.equal(stats.allTimeScore, results[0].game.score)
    assert.ok(stats.allTimeScore > 0)
    assert.equal((await db.collection(`players/${user.uid}/gameHistoryV2`).get()).size, 1)
    const replay = await move(user, action)
    assert.equal(replay.game.revision, 1)
    assert.equal(replay.stats.games, 1)
    await assert.rejects(move(user, { ...action, itemId: catalog[1].i }), { code: "ALREADY_EXISTS" })
  })
  it("conflicting commands at the same revision commit only one transition", async () => {
    const user = await guest()
    await start(user)
    const results = await Promise.allSettled([move(user, command({ itemId: catalog[1].i })), move(user, command({ itemId: catalog[2].i }))])
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
    assert.equal(results.find(result => result.status === "rejected").reason.code, "ABORTED")
    const game = await saved(user, `games/movies_${day}_LEVEL_2`)
    assert.equal(game.revision, 1)
    assert.equal(game.guesses.length, 1)
    assert.equal((await saved(user, "privateStats/summary")).games, 0)
  })
  it("enforces three distinct Easy hints and records give-up once", async () => {
    const user = await guest()
    await start(user)
    for (const [revision, hintType] of ["director", "genre", "decade"].entries()) {
      await move(user, command({ type: "hint", itemId: undefined, hintType, expectedRevision: revision }))
    }
    await assert.rejects(move(user, command({ type: "hint", itemId: undefined, hintType: "actors", expectedRevision: 3 })), { code: "FAILED_PRECONDITION" })
    const giveUp = command({ type: "giveUp", itemId: undefined, expectedRevision: 3 })
    const result = await move(user, giveUp)
    assert.equal(result.game.score, 0)
    assert.equal(result.stats.games, 1)
    assert.equal(result.stats.hintsUsedCount, 3)
    assert.equal(result.game.gaveUp, true)
    await move(user, giveUp)
    assert.equal((await saved(user, "privateStats/summary")).games, 1)
  })
  it("cannot apply another account's command to the victim's path", async () => {
    const victim = await guest()
    const attacker = await guest()
    await start(victim)
    await assert.rejects(move(attacker, command()), { code: "NOT_FOUND" })
    await assert.rejects(move(attacker, command({ playerID: victim.uid })), { code: "INVALID_ARGUMENT" })
    assert.equal((await saved(victim, `games/movies_${day}_LEVEL_2`)).revision, 0)
    assert.equal((await saved(victim, "privateStats/summary")).games, 0)
  })
  it("preserves guest-owned progress after a real emulator credential link and returning sign-in", async () => {
    const user = await guest()
    await start(user)
    await move(user, command({ itemId: catalog[1].i }))
    const email = `${randomUUID()}@example.test`
    const password = "emulator-only-password"
    const linked = await linkWithCredential(user.auth.currentUser, EmailAuthProvider.credential(email, password))
    assert.equal(linked.user.uid, user.uid)
    await signOut(user.auth)
    const returning = await signInWithEmailAndPassword(user.auth, email, password)
    user.token = await returning.user.getIdToken()
    const restored = await start(user)
    assert.equal(restored.game.playerID, user.uid)
    assert.equal(restored.game.guesses.length, 1)
    assert.equal(restored.game.revision, 1)
  })
})
