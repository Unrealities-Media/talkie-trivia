import { onCall, HttpsError } from "firebase-functions/v2/https"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { getAuth } from "firebase-admin/auth"
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { catalog, catalogVersion } from "./catalog"
import { publishedContent } from "./publishedContent"
import { DIFFICULTY_MODES } from "./utils/difficulty"
import { Game, Stats, completeStats, challengeKey, challengeDay, hints, parseAction, parseStart, record, transition } from "./gameEngine"
import { user, requireActiveAccount } from "./accountAccess"
import { accountDeletion } from "./accountDeletion"
import { gameHistory } from "./gameHistory"
import { accountMergeLifecycle } from "./accountMergeLifecycle"
import { gameNow } from "./gameClock"
import { consumeGameRequest } from "./gameRequestLimit"
import { effectiveStats, loadStatistics, summary } from "./statisticsStorage"

initializeApp()
const db = getFirestore()
// Browsers must reach callable endpoints (including CORS preflight); each
// handler enforces Firebase authentication and account ownership itself.
const options = { invoker: "public" as const, maxInstances: 10, concurrency: 40, timeoutSeconds: 30, memory: "256MiB" as const }
// Live rollout requires reconciliation tooling and native-provider acceptance.
// Recovery stays available for already accepted operations even if rollout stops.
export const beginAccountMerge = onCall(options, request => {
  if (process.env.FUNCTIONS_EMULATOR !== "true") throw new HttpsError("failed-precondition", "Combining accounts is not available in this release.")
  return accountMergeLifecycle(db, getAuth()).begin(request)
})
export const getAccountMergeStatus = onCall(options, request => accountMergeLifecycle(db, getAuth()).status(request))
export const cancelAccountMerge = onCall(options, request => accountMergeLifecycle(db, getAuth()).cancel(request))
export const resumeAccountMerge = onCall({ ...options, timeoutSeconds: 120 }, request => accountMergeLifecycle(db, getAuth()).resume(request))
export const retryAccountMerges = onSchedule({
  schedule: "every 5 minutes", timeZone: "UTC", timeoutSeconds: 540,
  maxInstances: 1, concurrency: 1, memory: "256MiB", retryCount: 0,
}, () => accountMergeLifecycle(db, getAuth()).retry())
const refs = (uid: string, challengeId: string) => ({
  game: db.doc(`players/${uid}/games/movies_${challengeId}`),
  stats: db.doc(`players/${uid}/privateStats/summary`),
  history: db.doc(`players/${uid}/gameHistoryV2/${challengeId}`),
})
const response = (game: Game, stats: Stats, now: Date) => {
  return { game, stats: effectiveStats(stats, now), challengeId: game.challengeId, serverNow: now.toISOString(), resetAt: new Date(Date.parse(`${challengeDay(game.challengeId)}T00:00:00Z`) + 86400000).toISOString() }
}

/** Profile statistics use the same server clock and projection as gameplay. */
export const getPlayerStatistics = onCall({ ...options, timeoutSeconds: 120 }, async request => {
  const uid = user(request)
  record(request.data, [])
  await consumeGameRequest(db, uid)
  const now = await gameNow(db)
  return db.runTransaction(async tx => {
    const [snapshot, deletion, mergeLock] = await Promise.all([tx.get(db.doc(`players/${uid}/privateStats/summary`)), tx.get(db.doc(`accountDeletions/${uid}`)), tx.get(db.doc(`accountMergeLocks/${uid}`))])
    requireActiveAccount(deletion, mergeLock)
    if (!snapshot.exists) return { stats: null, serverNow: now.toISOString() }
    const loaded = await loadStatistics(tx, db, uid, snapshot, false)
    if (snapshot.data()?.statisticsVersion !== 3 || snapshot.data()?.completedDays) loaded.save(loaded.stats)
    return { stats: effectiveStats(loaded.stats, now), serverNow: now.toISOString() }
  })
})

/** The date, content, paths, and defaults originate on the server. */
export const startGame = onCall(options, async request => {
  const uid = user(request)
  const command = parseStart(request.data)
  if (command.catalogVersion !== catalogVersion) {
    throw new HttpsError("failed-precondition", "Please update the app to load the current movie catalog.")
  }
  await consumeGameRequest(db, uid)
  const now = await gameNow(db)
  const day = now.toISOString().slice(0, 10)
  const challengeId = `${day}_${command.difficulty}`
  const paths = refs(uid, challengeId)
  return db.runTransaction(async tx => {
    const [gameDoc, statsDoc, deletion, mergeLock] = await Promise.all([tx.get(paths.game), tx.get(paths.stats), tx.get(db.doc(`accountDeletions/${uid}`)), tx.get(db.doc(`accountMergeLocks/${uid}`))])
    requireActiveAccount(deletion, mergeLock)
    const loaded = await loadStatistics(tx, db, uid, statsDoc, false)
    const stats = loaded.stats
    if (gameDoc.exists && !statsDoc.exists) throw new HttpsError("failed-precondition", "Saved statistics need review.")
    if (gameDoc.exists) {
      if (statsDoc.data()?.statisticsVersion !== 3 || statsDoc.data()?.completedDays) loaded.save(stats)
      return response(gameDoc.data() as Game, stats, now)
    }
    const schedule = await tx.get(db.doc(`dailyGames/${challengeId}`))
    const answer = catalog.get(schedule.data()?.movieId)
    if (!answer) throw new HttpsError("unavailable", "Today's challenge is not available yet. Please try again soon.")
    if (schedule.data()?.difficulty !== command.difficulty) throw new HttpsError("unavailable", "This challenge is being prepared.")
    const content = publishedContent(schedule.data(), day, catalogVersion)
    const description = content.clues?.[command.difficulty] ?? content.description
    const game: Game = {
      schemaVersion: 2, id: `movies_${challengeId}`, challengeId, playerID: uid, gameMode: "movies",
      difficulty: command.difficulty, guessesMax: DIFFICULTY_MODES[command.difficulty].guessesMax,
      answerId: answer.i, guesses: [], correctAnswer: false, gaveUp: false, hintsUsed: {},
      revision: 0, actions: [], startDate: now.toISOString(), endDate: now.toISOString(),
      statsProcessed: false, score: 0, scoringVersion: 1,
      triviaItem: { id: answer.i, title: answer.t, description, posterPath: answer.p,
        releaseDate: answer.y, metadata: { imdb_id: content.imdbId || null, tagline: content.tagline || null, fullSummary: content.description }, hints: hints(answer) },
    }
    tx.create(paths.game, game)
    if (!statsDoc.exists) tx.create(paths.stats, summary(stats))
    else if (statsDoc.data()?.statisticsVersion !== 3 || statsDoc.data()?.completedDays) loaded.save(stats)
    return response(game, stats, now)
  })
})

/** One bounded, versioned action; transaction retries cannot award extra credit. */
export const applyGameAction = onCall(options, async request => {
  const uid = user(request)
  const action = parseAction(request.data)
  await consumeGameRequest(db, uid)
  const now = await gameNow(db)
  const paths = refs(uid, action.challengeId)
  return db.runTransaction(async tx => {
    const [gameDoc, statsDoc, deletion, mergeLock] = await Promise.all([tx.get(paths.game), tx.get(paths.stats), tx.get(db.doc(`accountDeletions/${uid}`)), tx.get(db.doc(`accountMergeLocks/${uid}`))])
    requireActiveAccount(deletion, mergeLock)
    if (!gameDoc.exists) throw new HttpsError("not-found", "Start this challenge before playing.")
    const game = gameDoc.data() as Game
    if (game.playerID !== uid || game.schemaVersion !== 2 || game.challengeId !== action.challengeId) {
      throw new HttpsError("failed-precondition", "This saved game needs support assistance.")
    }
    const next = transition(game, action, catalog, now)
    const loaded = await loadStatistics(tx, db, uid, statsDoc, next.statsProcessed && !game.statsProcessed)
    let stats = loaded.stats
    if (!statsDoc.exists) throw new HttpsError("failed-precondition", "Saved statistics need review.")
    if (next === game) {
      if (statsDoc.data()?.statisticsVersion !== 3 || statsDoc.data()?.completedDays) loaded.save(stats)
      return response(game, stats, now)
    }
    if (action.type === "hint") stats = { ...stats, hintsUsedCount: stats.hintsUsedCount + 1 }
    if (next.statsProcessed && !game.statsProcessed) {
      stats = completeStats(stats, next)
      tx.create(paths.history, gameHistory(next))
    }
    tx.set(paths.game, next)
    loaded.save(stats)
    return response(next, stats, now)
  })
})

/** Compatibility result read; may upgrade legacy statistics. Full-game payloads fail closed. */
export const submitGameResult = onCall(options, async request => {
  const uid = user(request)
  const data = record(request.data, ["challengeId"])
  const challengeId = challengeKey(data.challengeId)
  await consumeGameRequest(db, uid)
  const now = await gameNow(db)
  const paths = refs(uid, challengeId)
  return db.runTransaction(async tx => {
    const [gameDoc, statsDoc, deletion, mergeLock] = await Promise.all([tx.get(paths.game), tx.get(paths.stats), tx.get(db.doc(`accountDeletions/${uid}`)), tx.get(db.doc(`accountMergeLocks/${uid}`))])
    requireActiveAccount(deletion, mergeLock)
    if (!gameDoc.exists || !gameDoc.data()?.statsProcessed) throw new HttpsError("failed-precondition", "Finish the challenge before requesting its result.")
    if (!statsDoc.exists) throw new HttpsError("failed-precondition", "Saved statistics need review.")
    const loaded = await loadStatistics(tx, db, uid, statsDoc, false)
    if (statsDoc.data()?.statisticsVersion !== 3 || statsDoc.data()?.completedDays) loaded.save(loaded.stats)
    return response(gameDoc.data() as Game, loaded.stats, now)
  })
})

export const deleteAccount = onCall({ ...options, timeoutSeconds: 120 }, request => accountDeletion(db, getAuth()).request(request))
export const prepareAccountDeletion = onCall(options, request => accountDeletion(db, getAuth()).prepare(request))
export const getAccountDeletionStatus = onCall(options, request => accountDeletion(db, getAuth()).status(request))
export const retryAccountDeletions = onSchedule({ schedule: "every 5 minutes", timeZone: "UTC", timeoutSeconds: 540, maxInstances: 1, concurrency: 1, retryCount: 0, memory: "256MiB" }, () => accountDeletion(db, getAuth()).retry())
