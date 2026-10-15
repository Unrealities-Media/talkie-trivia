import { HttpsError } from "firebase-functions/v2/https"
import { DIFFICULTY_MODES, DifficultyLevel } from "./utils/difficulty"
import { calculateScore } from "./utils/scoreUtils"

export const HINT_TYPES = ["director", "genre", "decade", "actors"] as const
export type HintType = typeof HINT_TYPES[number]
export interface CatalogMovie {
  i: number; t: string; y: string; p: string; d: string; c: string[]; g: string[]
}
export interface GameAction {
  challengeId: string
  expectedRevision: number
  actionId: string
  type: "guess" | "hint" | "giveUp"
  itemId?: number
  hintType?: HintType
}
export interface Game {
  schemaVersion: 2
  id: string
  challengeId: string
  playerID: string
  gameMode: "movies"
  difficulty: DifficultyLevel
  guessesMax: number
  guesses: { itemId: number }[]
  answerId: number
  correctAnswer: boolean
  gaveUp: boolean
  hintsUsed: Partial<Record<HintType, boolean>>
  revision: number
  actions: { id: string; fingerprint: string }[]
  startDate: string
  endDate: string
  statsProcessed: boolean
  score: number
  scoringVersion: 1
  // An immutable snapshot keeps a published game's content stable during updates.
  triviaItem: {
    id: number; title: string; description: string; posterPath: string
    releaseDate: string; metadata: Record<string, string | null>
    hints: { type: HintType; label: string; value: unknown }[]
  }
}
export interface Stats {
  id: string; currentStreak: number; maxStreak: number; games: number
  wins: number[]; allTimeScore: number; hintsAvailable: number; hintsUsedCount: number
  lastCompletedDate: string | null
  winningDays: string[]
  completedDays?: string[]
  completedDifficulties?: Record<string, string[]>
  allFiveDays?: string[]
  byDifficulty?: Partial<Record<DifficultyLevel, { games: number; wins: number; score: number }>>
}

function invalid(message = "Invalid game command."): never {
  throw new HttpsError("invalid-argument", message)
}
export function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid()
  const result = value as Record<string, unknown>
  if (Object.keys(result).some(key => !keys.includes(key))) invalid()
  return result
}
export function dateId(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid()
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid()
  return value
}
export function parseStart(value: unknown): { difficulty: DifficultyLevel; catalogVersion: string } {
  const data = record(value, ["difficulty", "catalogVersion"])
  if (typeof data.difficulty !== "string" || !Object.hasOwn(DIFFICULTY_MODES, data.difficulty)) invalid()
  if (typeof data.catalogVersion !== "string" || !/^[a-f0-9]{64}$/.test(data.catalogVersion)) invalid()
  return data as unknown as { difficulty: DifficultyLevel; catalogVersion: string }
}
export function challengeKey(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:_LEVEL_[1-5])?$/.test(value)) invalid()
  dateId(value.slice(0, 10))
  return value
}
export const challengeDay = (value: string) => challengeKey(value).slice(0, 10)
export function parseAction(value: unknown): GameAction {
  const data = record(value, ["challengeId", "expectedRevision", "actionId", "type", "itemId", "hintType"])
  challengeKey(data.challengeId)
  if (!Number.isSafeInteger(data.expectedRevision) || Number(data.expectedRevision) < 0 || Number(data.expectedRevision) > 9) invalid()
  if (typeof data.actionId !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(data.actionId)) invalid()
  if (data.type === "guess") {
    if (!Number.isSafeInteger(data.itemId) || Number(data.itemId) <= 0 || data.hintType !== undefined) invalid()
  } else if (data.type === "hint") {
    if (!HINT_TYPES.includes(data.hintType as HintType) || data.itemId !== undefined) invalid()
  } else if (data.type === "giveUp") {
    if (data.itemId !== undefined || data.hintType !== undefined) invalid()
  } else invalid()
  return data as unknown as GameAction
}
export function initialStats(uid: string): Stats {
  return { id: uid, currentStreak: 0, maxStreak: 0, games: 0, wins: [0, 0, 0, 0, 0], allTimeScore: 0, hintsAvailable: 3, hintsUsedCount: 0, lastCompletedDate: null, winningDays: [] }
}
export function terminal(game: Game): boolean {
  return game.correctAnswer || game.gaveUp || game.guesses.length >= game.guessesMax
}
export function fingerprint(action: GameAction): string {
  return JSON.stringify([action.challengeId, action.expectedRevision, action.type, action.itemId ?? null, action.hintType ?? null])
}
export function hints(movie: CatalogMovie): Game["triviaItem"]["hints"] {
  return [
    { type: "director", label: "Director", value: movie.d },
    { type: "genre", label: "Genre", value: movie.g[0] || "Unknown" },
    { type: "decade", label: "Decade", value: `${movie.y.slice(0, 3)}0s` },
    { type: "actors", label: "Actors", value: movie.c.map(name => ({ name })) },
  ]
}
const meaningful = (value: string) => !!value && !["n/a", "unknown"].includes(value.toLowerCase())
const normalized = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("en-US")
export function matchingHints(answer: CatalogMovie, guess: CatalogMovie): HintType[] {
  const matches: HintType[] = []
  if (meaningful(answer.d) && normalized(answer.d) === normalized(guess.d)) matches.push("director")
  if (answer.g[0] && answer.g[0] === guess.g[0]) matches.push("genre")
  if (/^\d{4}$/.test(answer.y) && answer.y.slice(0, 3) === guess.y.slice(0, 3)) matches.push("decade")
  // This catalog contains names, not TMDB person IDs. Missing/placeholder IDs never match.
  if (answer.c.some(name => meaningful(name) && guess.c.some(other => normalized(name) === normalized(other)))) matches.push("actors")
  return matches
}

export function transition(game: Game, action: GameAction, catalog: Map<number, CatalogMovie>, now: Date): Game {
  const previous = game.actions.find(item => item.id === action.actionId)
  if (previous) {
    if (previous.fingerprint !== fingerprint(action)) throw new HttpsError("already-exists", "This action ID was already used.")
    return game
  }
  if (game.revision !== action.expectedRevision) throw new HttpsError("aborted", "This game changed on another device. Refresh to continue.")
  if (terminal(game)) throw new HttpsError("failed-precondition", "This challenge is already complete.")
  if (now.getTime() - Date.parse(`${challengeDay(game.challengeId)}T00:00:00Z`) > 48 * 60 * 60 * 1000) {
    throw new HttpsError("failed-precondition", "The save window for this challenge has ended.")
  }
  const next = structuredClone(game)
  if (action.type === "guess") {
    const guessed = catalog.get(action.itemId!)
    if (!guessed) invalid("That movie is not in this challenge's catalog.")
    if (game.guesses.some(guess => guess.itemId === action.itemId)) throw new HttpsError("already-exists", "You already guessed that movie.")
    next.guesses.push({ itemId: action.itemId! })
    next.correctAnswer = action.itemId === game.answerId
    if (!next.correctAnswer && game.difficulty === "LEVEL_3") {
      const answer = catalog.get(game.answerId)
      if (!answer) throw new HttpsError("failed-precondition", "Challenge content is unavailable.")
      for (const type of matchingHints(answer, guessed)) next.hintsUsed[type] = true
    }
  } else if (action.type === "hint") {
    if (game.difficulty !== "LEVEL_2" || game.hintsUsed[action.hintType!] || Object.values(game.hintsUsed).filter(Boolean).length >= 3) {
      throw new HttpsError("failed-precondition", "This hint is not available.")
    }
    next.hintsUsed[action.hintType!] = true
  } else next.gaveUp = true
  next.revision++
  next.actions.push({ id: action.actionId, fingerprint: fingerprint(action) })
  if (terminal(next)) {
    next.endDate = now.toISOString()
    next.score = calculateScore(next)
    next.statsProcessed = true
  }
  return next
}

export function completeStats(stats: Stats, game: Game): Stats {
  const next = structuredClone(stats)
  next.games++
  next.allTimeScore += game.score
  if (game.correctAnswer) next.wins[game.guesses.length - 1]++
  // Dates, rather than request arrival order, determine daily win streaks.
  const day = challengeDay(game.challengeId)
  next.lastCompletedDate = [next.lastCompletedDate || "", day].sort().at(-1)!
  if (game.correctAnswer) next.winningDays = [...new Set([...next.winningDays, day])].sort()
  if (game.challengeId.includes("_LEVEL_") || next.completedDays) {
    next.completedDays = [...new Set([...(next.completedDays ?? next.winningDays), day])].sort()
    next.completedDifficulties ??= {}
    next.completedDifficulties[day] = [...new Set([...(next.completedDifficulties[day] ?? []), game.difficulty])].sort()
    next.allFiveDays = Object.keys(next.completedDifficulties).filter(date => next.completedDifficulties![date].length === 5).sort()
    next.byDifficulty ??= {}
    const level = next.byDifficulty[game.difficulty] ?? { games: 0, wins: 0, score: 0 }
    next.byDifficulty[game.difficulty] = { games: level.games + 1, wins: level.wins + Number(game.correctAnswer), score: level.score + game.score }
  }
  let run = 0
  let previousTime = 0
  next.maxStreak = 0
  const streakDays = next.completedDays ?? next.winningDays
  for (const day of streakDays) {
    const time = Date.parse(`${day}T00:00:00Z`)
    run = time - previousTime === 86400000 ? run + 1 : 1
    previousTime = time
    next.maxStreak = Math.max(next.maxStreak, run)
  }
  next.currentStreak = streakDays.at(-1) === next.lastCompletedDate ? run : 0
  return next
}
