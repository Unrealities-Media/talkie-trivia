import { projectId } from "./environment.mjs"
import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"

const requireFunctions = createRequire(new URL("../../functions/package.json", import.meta.url))
const { initializeApp, deleteApp } = requireFunctions("firebase-admin/app")
const { getFirestore, Timestamp } = requireFunctions("firebase-admin/firestore")
const { processAccountMergePage } = requireFunctions("./lib/accountMergeWorker")
const { initialStats, completeStats, transition, hints } = requireFunctions("./lib/gameEngine")
const { gameHistory } = requireFunctions("./lib/gameHistory")
const app = initializeApp({ projectId }, `merge-worker-${randomUUID()}`)
const db = getFirestore(app)
after(async () => { await db.terminate(); await deleteApp(app) })

const answer = { i: 1, t: "Synthetic answer", y: "1999", p: "/fixture.jpg", d: "Director", c: ["Actor"], g: ["Drama"] }
const catalog = new Map([[1, answer], [2, { ...answer, i: 2, t: "Wrong answer" }]])
function game(index, outcome = "win") {
  const day = new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10)
  let value = {
    schemaVersion: 2, scoringVersion: 1, id: `movies_${day}`, challengeId: day, playerID: "fixture-owner",
    gameMode: "movies", difficulty: "LEVEL_2", guessesMax: 5, guesses: [], answerId: 1,
    correctAnswer: false, gaveUp: false, hintsUsed: {}, revision: 0, actions: [],
    startDate: `${day}T12:00:00.000Z`, endDate: `${day}T12:00:00.000Z`, statsProcessed: false, score: 0,
    triviaItem: { id: 1, title: answer.t, description: "Immutable test clue", posterPath: answer.p,
      releaseDate: answer.y, metadata: {}, hints: hints(answer) },
  }
  const move = action => {
    value = transition(value, { challengeId: day, expectedRevision: value.revision, actionId: randomUUID(), ...action }, catalog, new Date(`${day}T13:00:00Z`))
  }
  if (outcome === "fresh") return value
  move({ type: "hint", hintType: "director" })
  move({ type: "guess", itemId: 2 })
  if (outcome === "win") move({ type: "guess", itemId: 1 })
  if (outcome === "loss") move({ type: "giveUp" })
  return value
}
function statsFor(uid, games) {
  return games.reduce((stats, saved) => {
    if (saved.difficulty === "LEVEL_2") stats.hintsUsedCount += Object.values(saved.hintsUsed).filter(Boolean).length
    return saved.statsProcessed ? completeStats(stats, saved) : stats
  }, initialStats(uid))
}
async function setup(sourceGames = [game(0)], targetGames = []) {
  // Administrator-created storage fixture: authorization/reservation contracts
  // are tested separately. This worker has no public callable or Auth side effect.
  const sourceUid = randomUUID()
  const targetUid = randomUUID()
  const batch = db.batch()
  for (const [uid, games] of [[sourceUid, sourceGames], [targetUid, targetGames]]) {
    batch.set(db.doc(`players/${uid}/privateStats/summary`), statsFor(uid, games))
    for (const saved of games) {
      batch.set(db.doc(`players/${uid}/games/${saved.id}`), { ...saved, playerID: uid })
      if (saved.statsProcessed) batch.set(db.doc(`players/${uid}/gameHistoryV2/${saved.challengeId}`), gameHistory(saved))
    }
  }
  const jobRef = db.doc(`accountMerges/${sourceUid}`)
  const now = Timestamp.now()
  batch.create(jobRef, { sourceUid, targetUid, status: "pending", policyVersion: 1, cursor: null, imported: 0, conflicts: 0, startedAt: now, updatedAt: now })
  batch.create(db.doc(`accountMergeLocks/${sourceUid}`), { jobId: sourceUid, role: "source" })
  batch.create(db.doc(`accountMergeLocks/${targetUid}`), { jobId: sourceUid, role: "target" })
  await batch.commit()
  return { sourceUid, targetUid, jobRef }
}
const data = async path => (await db.doc(path).get()).data()
const owned = (uid, path) => `players/${uid}/${path}`
async function reach(fixture, phase) {
  for (let index = 0; index < 30; index++) {
    if ((await fixture.jobRef.get()).data().phase === phase) return
    await processAccountMergePage(db, fixture.sourceUid)
  }
  assert.fail(`Worker did not reach ${phase}`)
}
async function destinationSnapshot(fixture) {
  const result = {}
  for (const collection of ["games", "privateStats", "gameHistoryV2", "mergedGuestGames"]) {
    const docs = await db.collection(owned(fixture.targetUid, collection)).orderBy("__name__").get()
    result[collection] = docs.docs.map(doc => ({ id: doc.id, data: doc.data() }))
  }
  return result
}

describe("resumable merge storage worker against real Firestore transactions", () => {
  it("validates both profiles, resumes across multiple pages and concurrent workers, and never duplicates credit", async () => {
    const sources = Array.from({ length: 45 }, (_, index) => game(index, ["win", "loss", "partial", "fresh"][index % 4]))
    const targets = [game(0, "loss"), game(12, "fresh"), game(20, "win"), game(60, "win")]
    const fixture = await setup(sources, targets)
    const before = await destinationSnapshot(fixture)
    await processAccountMergePage(db, fixture.sourceUid)
    const checked = (await fixture.jobRef.get()).data()
    assert.equal(checked.phase, "source-games")
    assert.equal(checked.checkedGames, 20)
    assert.equal(checked.cursor, sources[19].id)
    assert.deepEqual(await destinationSnapshot(fixture), before)
    await reach(fixture, "copy")
    assert.deepEqual(await destinationSnapshot(fixture), before)
    const first = await processAccountMergePage(db, fixture.sourceUid)
    assert.equal(first.phase, "copy")
    assert.equal(first.imported + first.conflicts, 20)
    assert.equal((await fixture.jobRef.get()).data().cursor, sources[19].id)
    // New invocations use only durable state, with no in-memory cursor/lease.
    await Promise.all(Array.from({ length: 3 }, () => processAccountMergePage(db, fixture.sourceUid)))
    const result = await processAccountMergePage(db, fixture.sourceUid)
    assert.deepEqual(result, { phase: "copied", copied: true, imported: 42, conflicts: 3 })
    const afterCopy = await destinationSnapshot(fixture)
    const finalJob = (await fixture.jobRef.get()).data()
    await processAccountMergePage(db, fixture.sourceUid)
    assert.deepEqual(await destinationSnapshot(fixture), afterCopy)
    assert.deepEqual((await fixture.jobRef.get()).data(), finalJob)
    const imported = sources.filter(saved => !targets.some(target => target.id === saved.id))
    assert.deepEqual(await data(owned(fixture.targetUid, "privateStats/summary")), statsFor(fixture.targetUid, [...targets, ...imported]))
    assert.equal(afterCopy.games.length, 46)
    for (const saved of sources) {
      assert.deepEqual(await data(owned(fixture.sourceUid, `games/${saved.id}`)), { ...saved, playerID: fixture.sourceUid })
      const existing = targets.find(target => target.id === saved.id)
      const destination = await data(owned(fixture.targetUid, `games/${saved.id}`))
      if (existing) {
        assert.deepEqual(destination, { ...existing, playerID: fixture.targetUid })
        assert.deepEqual(await data(owned(fixture.targetUid, `mergedGuestGames/${fixture.sourceUid}_${saved.id}`)), {
          policyVersion: 1, reason: "existing-profile-kept", sourceUid: fixture.sourceUid, game: { ...saved, playerID: fixture.targetUid },
        })
      } else {
        assert.deepEqual(destination, { ...saved, playerID: fixture.targetUid, mergeOrigin: { guestUid: fixture.sourceUid, revision: saved.revision, policyVersion: 1 } })
        assert.deepEqual(await data(owned(fixture.targetUid, `gameHistoryV2/${saved.challengeId}`)), saved.statsProcessed ? gameHistory(saved) : undefined)
      }
    }
    // "copied" is not completion: both reservations remain until safe retirement.
    assert.equal(finalJob.status, "pending")
    assert.equal((await db.doc(`accountMergeLocks/${fixture.sourceUid}`).get()).exists, true)
    assert.equal((await db.doc(`accountMergeLocks/${fixture.targetUid}`).get()).exists, true)
  })
  it("handles empty profiles and an exact full-page boundary", async () => {
    for (const count of [0, 20]) {
      const fixture = await setup(Array.from({ length: count }, (_, index) => game(index, "fresh")))
      if (count === 0) {
        await db.doc(owned(fixture.sourceUid, "privateStats/summary")).delete()
        await db.doc(owned(fixture.targetUid, "privateStats/summary")).delete()
      }
      await reach(fixture, "copied")
      assert.equal((await fixture.jobRef.get()).data().imported, count)
      assert.equal((await db.collection(owned(fixture.targetUid, "games")).get()).size, count)
    }
  })
  for (const role of ["source", "target"]) {
    for (const corruption of ["missing-history", "changed-history", "orphan-history", "missing-stats", "changed-stats", "legacy-history", "legacy-stats", "legacy-game", "incomplete-legacy-game", "wrong-path"]) {
      it(`refuses ${role} ${corruption} before copying any player data`, async () => {
        const saved = game(0)
        const fixture = await setup([saved], [game(2)])
        const uid = fixture[`${role}Uid`]
        const ownGame = role === "source" ? saved : game(2)
        const historyRef = db.doc(owned(uid, `gameHistoryV2/${ownGame.challengeId}`))
        const statsRef = db.doc(owned(uid, "privateStats/summary"))
        if (corruption === "missing-history") await historyRef.delete()
        if (corruption === "changed-history") await historyRef.update({ score: 9999 })
        if (corruption === "orphan-history") await db.doc(owned(uid, "gameHistoryV2/2026-01-01")).set({ dateId: "2026-01-01", score: 7 })
        if (corruption === "missing-stats") await statsRef.delete()
        if (corruption === "changed-stats") await statsRef.update({ allTimeScore: 9999 })
        if (corruption === "legacy-history") await db.doc(owned(uid, "gameHistory/2020-01-01")).set({ score: 7 })
        if (corruption === "legacy-stats") await db.doc(`playerStats/${uid}`).set({ games: 1 })
        if (corruption === "legacy-game") await db.doc(`playerGames/${randomUUID()}`).set({ playerID: uid })
        if (corruption === "incomplete-legacy-game") await db.doc(`playerGames/${uid}-2020-01-01`).set({ score: 7 })
        if (corruption === "wrong-path") await db.doc(owned(uid, "games/movies_2020-01-01")).set({ ...ownGame, playerID: uid })
        const before = await destinationSnapshot(fixture)
        await assert.rejects(reach(fixture, "copy"), { code: "failed-precondition" })
        assert.deepEqual(await destinationSnapshot(fixture), before)
        const job = (await fixture.jobRef.get()).data()
        assert.equal(job.imported + job.conflicts, 0)
      })
    }
  }
  it("rolls back the entire page on a failure after writes are staged, then resumes successfully", async () => {
    const fixture = await setup([game(0), game(1), game(2)], [game(1, "fresh")])
    await reach(fixture, "copy")
    const before = await destinationSnapshot(fixture)
    const jobBefore = (await fixture.jobRef.get()).data()
    const failingDb = new Proxy(db, { get(target, key) {
      if (key === "runTransaction") return callback => target.runTransaction(tx => callback(new Proxy(tx, { get(transaction, property) {
        if (property === "update") return () => { throw new Error("injected checkpoint failure") }
        const value = Reflect.get(transaction, property)
        return typeof value === "function" ? value.bind(transaction) : value
      } })))
      const value = Reflect.get(target, key)
      return typeof value === "function" ? value.bind(target) : value
    } })
    await assert.rejects(processAccountMergePage(failingDb, fixture.sourceUid), /injected checkpoint failure/)
    assert.deepEqual(await destinationSnapshot(fixture), before)
    assert.deepEqual((await fixture.jobRef.get()).data(), jobBefore)
    assert.deepEqual(await processAccountMergePage(db, fixture.sourceUid), { phase: "copied", copied: true, imported: 2, conflicts: 1 })
  })
  it("survives a committed page whose response is lost", async () => {
    const fixture = await setup(Array.from({ length: 21 }, (_, index) => game(index)))
    await reach(fixture, "copy")
    const lostResponseDb = new Proxy(db, { get(target, key) {
      if (key === "runTransaction") return async callback => { await target.runTransaction(callback); throw new Error("injected lost response") }
      const value = Reflect.get(target, key)
      return typeof value === "function" ? value.bind(target) : value
    } })
    await assert.rejects(processAccountMergePage(lostResponseDb, fixture.sourceUid), /injected lost response/)
    assert.equal((await fixture.jobRef.get()).data().imported, 20)
    assert.deepEqual(await processAccountMergePage(db, fixture.sourceUid), { phase: "copied", copied: true, imported: 21, conflicts: 0 })
    assert.equal((await data(owned(fixture.targetUid, "privateStats/summary"))).games, 21)
  })
  for (const change of ["missing-lock", "wrong-lock", "deletion", "stats-changed", "stats-removed", "orphan-destination-history", "existing-archive", "source-removed"]) {
    it(`stops on ${change} between validation and copying without partial writes`, async () => {
      const saved = game(0)
      const fixture = await setup([saved], [game(1)])
      await reach(fixture, "copy")
      if (change === "missing-lock") await db.doc(`accountMergeLocks/${fixture.sourceUid}`).delete()
      if (change === "wrong-lock") await db.doc(`accountMergeLocks/${fixture.targetUid}`).update({ jobId: "different-job" })
      if (change === "deletion") await db.doc(`accountDeletions/${fixture.targetUid}`).set({ status: "pending" })
      if (change === "stats-changed") await db.doc(owned(fixture.targetUid, "privateStats/summary")).update({ allTimeScore: 0 })
      if (change === "stats-removed") await db.doc(owned(fixture.targetUid, "privateStats/summary")).delete()
      if (change === "orphan-destination-history") await db.doc(owned(fixture.targetUid, `gameHistoryV2/${saved.challengeId}`)).set(gameHistory(saved))
      if (change === "existing-archive") await db.doc(owned(fixture.targetUid, `mergedGuestGames/${fixture.sourceUid}_${saved.id}`)).set({ unexpected: true })
      if (change === "source-removed") await db.doc(owned(fixture.sourceUid, `games/${saved.id}`)).delete()
      const before = await destinationSnapshot(fixture)
      const jobBefore = (await fixture.jobRef.get()).data()
      await assert.rejects(processAccountMergePage(db, fixture.sourceUid), { code: "failed-precondition" })
      assert.deepEqual(await destinationSnapshot(fixture), before)
      assert.deepEqual((await fixture.jobRef.get()).data(), jobBefore)
    })
  }
})
