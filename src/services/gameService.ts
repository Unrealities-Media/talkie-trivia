import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, documentId, startAfter } from "firebase/firestore"
import { getFunctions, httpsCallable } from "firebase/functions"
import AsyncStorage from "@react-native-async-storage/async-storage"
import uuid from "react-native-uuid"
import { db, app, auth } from "./firebaseClient"
import { playerConverter } from "../utils/firestore/converters/player"
import { playerGameConverter } from "../utils/firestore/converters/playerGame"
import { gameHistoryEntryConverter } from "../utils/firestore/converters/gameHistoryEntry"
import Player from "../models/player"
import PlayerStats from "../models/playerStats"
import { PlayerGame } from "../models/game"
import { GameHistoryEntry } from "../models/gameHistory"
import { DifficultyLevel, DIFFICULTY_MODES } from "../config/difficulty"
import { validChallengeKey } from "../utils/challengeKey"
import { version as catalogVersion } from "../data/catalogVersion.json"
import { deletionStorage } from "./deletionStorage"
import { mergeStorage } from "./mergeStorage"

export interface GameResponse { game: PlayerGame; stats: PlayerStats; challengeId: string; resetAt: string; serverNow: string; receivedAtMonotonic: number }
export type ChallengeStatus = "Not started" | "In progress" | "Won" | "Lost"
export type DailyChallenges = Partial<Record<DifficultyLevel, ChallengeStatus>>
export const HISTORY_PAGE_SIZE = 20
export interface HistoryCursor { uid: string; dateId: string; id: string }
export interface HistoryPage { entries: GameHistoryEntry[]; next: HistoryCursor | null }
export type ActionInput = { type: "guess"; itemId: number } | { type: "hint"; hintType: string } | { type: "giveUp" }
interface PendingAction {
  challengeId: string; expectedRevision: number; actionId: string
  type: ActionInput["type"]; itemId?: number; hintType?: string
}
const pendingKey = (uid: string) => `game-action-v2:${uid}`
const locks = new Map<string, Promise<unknown>>()
function serialize<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const next = (locks.get(uid) || Promise.resolve()).catch(() => undefined).then(operation)
  locks.set(uid, next)
  void next.finally(() => { if (locks.get(uid) === next) locks.delete(uid) }).catch(() => undefined)
  return next
}
function requireUser(uid: string) {
  if (auth.currentUser?.uid !== uid) throw new Error("Your account changed. Please reopen the game.")
}
function decode(data: unknown, uid: string): GameResponse {
  const result = data as GameResponse
  if (!result?.game || result.game.playerID !== uid || !result.stats || !Array.isArray(result.game.guesses) || !Number.isInteger(result.game.revision) ||
    !Number.isFinite(Date.parse(result.serverNow)) || !Number.isFinite(Date.parse(result.resetAt)) ||
    !validChallengeKey(result.challengeId) || result.game.challengeId !== result.challengeId ||
    (result.challengeId.includes("_LEVEL_") && !result.challengeId.endsWith(`_${result.game.difficulty}`)) ||
    Date.parse(result.resetAt) !== Date.parse(`${result.challengeId.slice(0, 10)}T00:00:00Z`) + 86400000) {
    throw new Error("The saved game could not be read. Please try again.")
  }
  return { ...result, receivedAtMonotonic: performance.now(), game: { ...result.game, startDate: new Date(result.game.startDate), endDate: new Date(result.game.endDate) } }
}
async function call(name: string, data: unknown, uid: string): Promise<GameResponse> {
  requireUser(uid)
  if ((await deletionStorage.read())?.uid === uid) throw new Error("Account deletion is in progress. Open Profile for its status.")
  if (await mergeStorage.read()) throw new Error("Finish account recovery before playing.")
  const result = await httpsCallable(getFunctions(app), name)(data)
  requireUser(uid)
  return decode(result.data, uid)
}
async function replay(uid: string): Promise<GameResponse | null> {
  requireUser(uid)
  const stored = await AsyncStorage.getItem(pendingKey(uid))
  if (!stored) return null
  const pending: PendingAction = JSON.parse(stored)
  try {
    const result = await call("applyGameAction", pending, uid)
    await AsyncStorage.removeItem(pendingKey(uid))
    return result
  } catch (error) {
    const code = (error as { code?: string }).code?.replace("functions/", "")
    // A rejected command did not commit. Transport failures retain the exact ID
    // and revision for safe retry, including commit-with-lost-response failures.
    if (["invalid-argument", "aborted", "already-exists", "failed-precondition", "not-found"].includes(code || "")) {
      await AsyncStorage.removeItem(pendingKey(uid))
    }
    throw error
  }
}

export const gameService = {
  fetchDailyChallenges: async (uid: string, day: string): Promise<DailyChallenges> => {
    requireUser(uid)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !validChallengeKey(day)) throw new Error("Invalid challenge day")
    const statuses = await Promise.all((Object.keys(DIFFICULTY_MODES) as DifficultyLevel[]).map(async level => {
      const snapshot = await getDoc(doc(db, "players", uid, "games", `movies_${day}_${level}`))
      const game = snapshot.exists() ? snapshot.data() : null
      const status: ChallengeStatus = !game ? "Not started" : game.correctAnswer ? "Won" : game.gaveUp || game.guesses.length >= game.guessesMax ? "Lost" : "In progress"
      return [level, status]
    }))
    requireUser(uid)
    return Object.fromEntries(statuses)
  },
  ensurePlayerExists: async (playerId: string, playerName: string): Promise<Player> => {
    const ref = doc(db, "players", playerId).withConverter(playerConverter)
    const snapshot = await getDoc(ref)
    if (snapshot.exists()) return snapshot.data()
    const player = new Player(playerId, (playerName.trim() || "Player").slice(0, 50))
    await setDoc(ref, player)
    return player
  },
  startGame: (uid: string, difficulty: DifficultyLevel): Promise<GameResponse> => serialize(uid, async () => {
    await replay(uid)
    return call("startGame", { difficulty, catalogVersion }, uid)
  }),
  applyAction: (game: PlayerGame, action: ActionInput): Promise<GameResponse> => serialize(game.playerID, async () => {
    requireUser(game.playerID)
    if ((await deletionStorage.read())?.uid === game.playerID) throw new Error("Account deletion is in progress. Open Profile for its status.")
    if (await mergeStorage.read()) throw new Error("Finish account recovery before playing.")
    if (!game.challengeId || game.revision === undefined) throw new Error("Reload this challenge before playing.")
    if (await AsyncStorage.getItem(pendingKey(game.playerID))) throw new Error("Retry your pending move before continuing.")
    const pending: PendingAction = { ...action, challengeId: game.challengeId, expectedRevision: game.revision, actionId: String(uuid.v4()) }
    // Persist before issuing the request. If storage fails, nothing is sent.
    await AsyncStorage.setItem(pendingKey(game.playerID), JSON.stringify(pending))
    return (await replay(game.playerID))!
  }),
  resumePendingAction: (uid: string) => serialize(uid, () => replay(uid)),
  clearLocalProgress: (uid: string) => serialize(uid, () => AsyncStorage.removeItem(pendingKey(uid))),
  fetchPlayerStats: async (uid: string): Promise<PlayerStats | null> => {
    requireUser(uid)
    const snapshot = await getDoc(doc(db, "players", uid, "privateStats", "summary"))
    requireUser(uid)
    return snapshot.exists() ? snapshot.data() as PlayerStats : null
  },
  fetchPlayerGameById: async (gameId: string): Promise<PlayerGame | null> => {
    const uid = auth.currentUser?.uid
    if (!uid || !gameId.startsWith("movies_") || !validChallengeKey(gameId.slice(7))) return null
    const ref = doc(db, "players", uid, "games", gameId).withConverter(playerGameConverter)
    const snapshot = await getDoc(ref)
    requireUser(uid)
    return snapshot.exists() ? snapshot.data() : null
  },
  fetchGameHistory: async (uid: string, cursor: HistoryCursor | null = null): Promise<HistoryPage> => {
    requireUser(uid)
    if (cursor && (cursor.uid !== uid || !/^\d{4}-\d{2}-\d{2}$/.test(cursor.dateId) ||
      !Number.isFinite(Date.parse(`${cursor.dateId}T00:00:00Z`)) ||
      new Date(`${cursor.dateId}T00:00:00Z`).toISOString().slice(0, 10) !== cursor.dateId ||
      !cursor.id || cursor.id.length > 200 || cursor.id.includes("/"))) {
      throw new Error("Refresh this account's game history.")
    }
    const ref = collection(db, "players", uid, "gameHistoryV2").withConverter(gameHistoryEntryConverter)
    // A stable tie-breaker and one lookahead row avoid skipped records and empty
    // trailing pages, including while imported results share a date.
    const snapshot = await getDocs(query(ref, orderBy("dateId", "desc"), orderBy(documentId(), "desc"),
      ...(cursor ? [startAfter(cursor.dateId, cursor.id)] : []), limit(HISTORY_PAGE_SIZE + 1)))
    requireUser(uid)
    const docs = snapshot.docs.slice(0, HISTORY_PAGE_SIZE)
    const entries = docs.map(item => item.data())
    return { entries, next: snapshot.docs.length > HISTORY_PAGE_SIZE
      ? { uid, dateId: entries[entries.length - 1].dateId, id: docs[docs.length - 1].id } : null }
  },
}
