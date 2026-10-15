import { onCall, HttpsError } from "firebase-functions/v2/https"
import { onSchedule } from "firebase-functions/v2/scheduler"
import { getAuth } from "firebase-admin/auth"
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { catalog, catalogVersion } from "./catalog"
import { publishedContent } from "./publishedContent"
import { DIFFICULTY_MODES } from "./utils/difficulty"
import { Game, Stats, completeStats, challengeKey, challengeDay, hints, initialStats, parseAction, parseStart, record, transition } from "./gameEngine"
import { user, requireActiveAccount } from "./accountAccess"
import { accountDeletion } from "./accountDeletion"
import { gameHistory } from "./gameHistory"
import { accountMergeLifecycle } from "./accountMergeLifecycle"
import { gameNow } from "./gameClock"

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
  const lastDay = stats.completedDays?.at(-1) ?? stats.winningDays.at(-1)
  const currentDay = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  return { game, stats: { ...stats, currentStreak: lastDay === currentDay || lastDay === yesterday ? stats.currentStreak : 0 }, challengeId: game.challengeId, serverNow: now.toISOString(), resetAt: new Date(Date.parse(`${challengeDay(game.challengeId)}T00:00:00Z`) + 86400000).toISOString() }
}

/** The date, content, paths, and defaults originate on the server. */
export const startGame = onCall(options, async request => {
  const uid = user(request)
  const command = parseStart(request.data)
  if (command.catalogVersion !== catalogVersion) {
    throw new HttpsError("failed-precondition", "Please update the app to load the current movie catalog.")
  }
  const now = await gameNow(db)
  const day = now.toISOString().slice(0, 10)
  const challengeId = `${day}_${command.difficulty}`
  const paths = refs(uid, challengeId)
  return db.runTransaction(async tx => {
    const [gameDoc, statsDoc, deletion, mergeLock] = await Promise.all([tx.get(paths.game), tx.get(paths.stats), tx.get(db.doc(`accountDeletions/${uid}`)), tx.get(db.doc(`accountMergeLocks/${uid}`))])
    requireActiveAccount(deletion, mergeLock)
    const stats = statsDoc.exists ? statsDoc.data() as Stats : initialStats(uid)
    if (gameDoc.exists) return response(gameDoc.data() as Game, stats, now)
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
        releaseDate: answer.y, metadata: { imdb_id: content.imdbId || null, tagline: content.tagline || null }, hints: hints(answer) },
    }
    tx.create(paths.game, game)
    if (!statsDoc.exists) tx.create(paths.stats, stats)
    return response(game, stats, now)
  })
})

/** One bounded, versioned action; transaction retries cannot award extra credit. */
export const applyGameAction = onCall(options, async request => {
  const uid = user(request)
  const action = parseAction(request.data)
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
    let stats = statsDoc.exists ? statsDoc.data() as Stats : initialStats(uid)
    if (next === game) return response(game, stats, now)
    if (action.type === "hint") stats = { ...stats, hintsUsedCount: stats.hintsUsedCount + 1 }
    if (next.statsProcessed && !game.statsProcessed) {
      stats = completeStats(stats, next)
      tx.create(paths.history, gameHistory(next))
    }
    tx.set(paths.game, next)
    tx.set(paths.stats, stats)
    return response(next, stats, now)
  })
})

/** Compatibility name, read-only. Legacy full-game payloads fail closed. */
export const submitGameResult = onCall(options, async request => {
  const uid = user(request)
  const data = record(request.data, ["challengeId"])
  const challengeId = challengeKey(data.challengeId)
  const now = await gameNow(db)
  const paths = refs(uid, challengeId)
  return db.runTransaction(async tx => {
    const [gameDoc, statsDoc, deletion, mergeLock] = await Promise.all([tx.get(paths.game), tx.get(paths.stats), tx.get(db.doc(`accountDeletions/${uid}`)), tx.get(db.doc(`accountMergeLocks/${uid}`))])
    requireActiveAccount(deletion, mergeLock)
    if (!gameDoc.exists || !gameDoc.data()?.statsProcessed) throw new HttpsError("failed-precondition", "Finish the challenge before requesting its result.")
    return response(gameDoc.data() as Game, statsDoc.exists ? statsDoc.data() as Stats : initialStats(uid), now)
  })
})

export const deleteAccount = onCall({ ...options, timeoutSeconds: 120 }, request => accountDeletion(db, getAuth()).request(request))
export const prepareAccountDeletion = onCall(options, request => accountDeletion(db, getAuth()).prepare(request))
export const getAccountDeletionStatus = onCall(options, request => accountDeletion(db, getAuth()).status(request))
export const retryAccountDeletions = onSchedule({ schedule: "every 5 minutes", timeZone: "UTC", timeoutSeconds: 540, maxInstances: 1, memory: "256MiB" }, () => accountDeletion(db, getAuth()).retry())
