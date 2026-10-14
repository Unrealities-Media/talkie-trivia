import { projectId, firestore } from "./environment.mjs"
import { before, after, beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing"
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, query, orderBy, limit, setLogLevel, documentId, startAfter } from "firebase/firestore"

// Expected permission denials are asserted below; keep the SDK's retry logs out of TAP.
setLogLevel("silent")

let environment
before(async () => {
  environment = await initializeTestEnvironment({ projectId, firestore: { ...firestore, rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") } })
})
after(async () => { await environment?.cleanup() })
beforeEach(async () => {
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, "players/alice"), { id: "alice", name: "Player" }),
      setDoc(doc(db, "players/alice/games/movies_2026-10-13"), { score: 700 }),
      setDoc(doc(db, "players/alice/privateStats/summary"), { games: 1 }),
      setDoc(doc(db, "players/alice/gameHistoryV2/2026-10-13"), { dateId: "2026-10-13", score: 700 }),
      setDoc(doc(db, "players/alice/gameHistory/2026-10-12"), { score: 500 }),
      setDoc(doc(db, "players/alice/mergedGuestGames/retired_movies_2026-10-13"), { game: { challengeId: "2026-10-13", playerID: "alice", score: 500 } }),
      setDoc(doc(db, "dailyGames/2026-10-14"), { movieId: 1 }),
      setDoc(doc(db, "movies/1"), { title: "Movie" }),
    ])
  })
})
const paths = ["players/alice", "players/alice/games/movies_2026-10-13", "players/alice/privateStats/summary", "players/alice/gameHistoryV2/2026-10-13", "players/alice/gameHistory/2026-10-12", "players/alice/mergedGuestGames/retired_movies_2026-10-13"]
describe("deployed rules source against real Firestore emulator", () => {
  for (const role of ["source", "target", "retired"]) {
    it(`blocks owner access during a merge ${role} reservation and protects administrative records`, async () => {
      await environment.withSecurityRulesDisabled(async context => {
        const db = context.firestore()
        await setDoc(doc(db, "accountMergeLocks/alice"), { jobId: "alice", role })
        await setDoc(doc(db, "accountMerges/alice"), { status: "pending" })
      })
      const db = environment.authenticatedContext("alice").firestore()
      for (const path of paths) await assertFails(getDoc(doc(db, path)))
      await assertFails(setDoc(doc(db, "players/alice"), { id: "alice", name: "Player" }))
      await assertFails(getDocs(collection(db, "players/alice/gameHistoryV2")))
      await assertFails(getDocs(query(collection(db, "players/alice/mergedGuestGames"), limit(21))))
      for (const path of ["accountMergeLocks/alice", "accountMerges/alice"]) {
        await assertFails(getDoc(doc(db, path)))
        await assertFails(setDoc(doc(db, path), { status: "complete" }))
        await assertFails(deleteDoc(doc(db, path)))
      }
      const other = environment.authenticatedContext("bob").firestore()
      await assertSucceeds(setDoc(doc(other, "players/bob"), { id: "bob", name: "Player" }))
      await assertSucceeds(getDoc(doc(other, "players/bob")))
    })
  }
  it("blocks even owner reads and profile recreation behind a deletion barrier", async () => {
    await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "accountDeletions/alice"), { status: "pending" }))
    const db = environment.authenticatedContext("alice").firestore()
    for (const path of paths) await assertFails(getDoc(doc(db, path)))
    await assertFails(setDoc(doc(db, "players/alice"), { id: "alice", name: "Player" }))
    await assertFails(getDocs(collection(db, "players/alice/gameHistoryV2")))
    await assertFails(getDocs(query(collection(db, "players/alice/mergedGuestGames"), limit(21))))
    await assertFails(getDoc(doc(db, "accountDeletions/alice")))
    await assertFails(deleteDoc(doc(db, "accountDeletions/alice")))
  })
  it("allows a guest owner to read their profile, saved game, statistics and history", async () => {
    const db = environment.authenticatedContext("alice", { firebase: { sign_in_provider: "anonymous" } }).firestore()
    await Promise.all(paths.map(path => assertSucceeds(getDoc(doc(db, path)))))
    await assertSucceeds(getDocs(query(collection(db, "players/alice/gameHistoryV2"), orderBy("dateId", "desc"), limit(20))))
  })
  it("denies unauthenticated and other-account reads, queries, updates and deletes", async () => {
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext("bob")]) {
      const db = context.firestore()
      for (const path of paths) {
        await assertFails(getDoc(doc(db, path)))
        await assertFails(updateDoc(doc(db, path), { score: 999999 }))
        await assertFails(deleteDoc(doc(db, path)))
      }
      await assertFails(getDocs(collection(db, "players/alice/gameHistoryV2")))
      await assertFails(getDocs(query(collection(db, "players/alice/mergedGuestGames"), limit(21))))
    }
  })
  it("allows only bounded owner profile fields, including after account linking", async () => {
    const db = environment.authenticatedContext("alice", { firebase: { sign_in_provider: "google.com" } }).firestore()
    await assertSucceeds(updateDoc(doc(db, "players/alice"), { name: "New name" }))
    for (const payload of [{ id: "bob", name: "Player" }, { id: "alice", name: "" }, { id: "alice", name: "x".repeat(51) }, { id: "alice", name: 1 }, { id: "alice", name: "Player", admin: true }]) {
      await assertFails(setDoc(doc(db, "players/alice"), payload))
    }
    await assertFails(deleteDoc(doc(db, "players/alice")))
    const guest = environment.authenticatedContext("new-guest").firestore()
    await assertSucceeds(setDoc(doc(guest, "players/new-guest"), { id: "new-guest", name: "Player" }))
    await assertFails(setDoc(doc(guest, "players/someone-else"), { id: "someone-else", name: "Player" }))
  })
  it("denies all direct owner writes to authoritative state and legacy paths", async () => {
    const db = environment.authenticatedContext("alice").firestore()
    const protectedPaths = [...paths.slice(1), "players/alice/games/new-game", "playerGames/alice-2026-10-13", "playerStats/alice", "dailyGames/2026-10-14", "movieImports/1", "admin/config"]
    for (const path of protectedPaths) {
      await assertFails(setDoc(doc(db, path), { correctAnswer: true, score: 999999 }))
      await assertFails(deleteDoc(doc(db, path)))
    }
  })
  it("denies schedule enumeration, player enumeration, and administrative collection reads", async () => {
    const db = environment.authenticatedContext("alice").firestore()
    for (const path of ["dailyGames/2026-10-14", "movies/1", "movieImports/1", "admin/config", "playerStats/alice", "playerGames/alice-2026-10-13"]) await assertFails(getDoc(doc(db, path)))
    for (const path of ["players", "dailyGames", "movies", "players/alice/privateStats"]) await assertFails(getDocs(collection(db, path)))
  })
  it("requires bounded archive queries and paginates tied dates without skipping or repeating guest records", async () => {
    await environment.withSecurityRulesDisabled(async context => {
      await Promise.all(Array.from({ length: 44 }, (_, index) => setDoc(doc(context.firestore(), `players/alice/mergedGuestGames/guest-${String(index).padStart(2, "0")}_movies_2026-10-12`),
        { game: { challengeId: "2026-10-12", playerID: "alice" } })))
    })
    const db = environment.authenticatedContext("alice").firestore()
    const archive = collection(db, "players/alice/mergedGuestGames")
    await assertFails(getDocs(archive))
    await assertFails(getDocs(query(archive, limit(22))))
    const seen = new Set()
    let cursor
    for (let page = 0; page < 4; page++) {
      const request = query(archive, orderBy("game.challengeId", "desc"), orderBy(documentId(), "desc"), ...(cursor ? [startAfter(...cursor)] : []), limit(21))
      const rows = await assertSucceeds(getDocs(request))
      for (const row of rows.docs.slice(0, 20)) {
        if (seen.has(row.id)) throw new Error("Archive pagination repeated a row")
        seen.add(row.id)
      }
      if (rows.size <= 20) break
      cursor = [rows.docs[19].data().game.challengeId, rows.docs[19].id]
    }
    if (seen.size !== 45) throw new Error(`Expected 45 preserved records, read ${seen.size}`)
    const retiredGuest = environment.authenticatedContext("retired").firestore()
    await assertFails(getDoc(doc(retiredGuest, paths.at(-1))))
    await assertFails(getDocs(query(collection(retiredGuest, "players/alice/mergedGuestGames"), limit(21))))
    await assertFails(setDoc(doc(db, "players/alice/mergedGuestGames/forged-record"), { game: { playerID: "alice", score: 99999 } }))
  })
  it("bounds history reads and pages every result with stable date/document cursors", async () => {
    const expected = ["2026-10-13", ...Array.from({ length: 44 }, (_, i) => `history-${String(43 - i).padStart(2, "0")}`)]
    await environment.withSecurityRulesDisabled(async context => {
      await Promise.all(expected.slice(1).map(id => setDoc(doc(context.firestore(), `players/alice/gameHistoryV2/${id}`), { dateId: "2026-10-12", score: 400 })))
    })
    const db = environment.authenticatedContext("alice").firestore()
    const history = collection(db, "players/alice/gameHistoryV2")
    await assertFails(getDocs(history))
    await assertFails(getDocs(query(history, limit(22))))
    const seen = []
    let cursor
    for (let page = 0; page < 3; page++) {
      const rows = await assertSucceeds(getDocs(query(history, orderBy("dateId", "desc"), orderBy(documentId(), "desc"),
        ...(cursor ? [startAfter(...cursor)] : []), limit(21))))
      seen.push(...rows.docs.slice(0, 20).map(row => row.id))
      if (page === 0) {
        // A new completion is picked up on refresh, without shifting subsequent
        // older pages as an offset-based query would.
        await environment.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "players/alice/gameHistoryV2/2026-10-14"), { dateId: "2026-10-14" }))
      }
      if (rows.size <= 20) { assert.equal(page, 2); break }
      cursor = [rows.docs[19].data().dateId, rows.docs[19].id]
    }
    assert.deepEqual(seen, expected)
    const refreshed = await assertSucceeds(getDocs(query(history, orderBy("dateId", "desc"), orderBy(documentId(), "desc"), limit(21))))
    assert.equal(refreshed.docs[0].id, "2026-10-14")
    for (const context of [environment.unauthenticatedContext(), environment.authenticatedContext("bob")]) {
      await assertFails(getDocs(query(collection(context.firestore(), "players/alice/gameHistoryV2"), orderBy("dateId", "desc"),
        orderBy(documentId(), "desc"), startAfter(...cursor), limit(21))))
    }
  })
})
