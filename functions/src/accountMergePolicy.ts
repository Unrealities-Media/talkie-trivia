import { HttpsError } from "firebase-functions/v2/https"
import { Game, Stats, HINT_TYPES, completeStats, dateId, challengeKey, terminal } from "./gameEngine"
import { gameHistory } from "./gameHistory"
import { DIFFICULTY_MODES } from "./utils/difficulty"
import { calculateScore } from "./utils/scoreUtils"

export const MERGE_POLICY_VERSION = 1 as const
export const MERGE_PAGE_SIZE = 20

export interface MergeGame extends Game {
  mergeOrigin?: { guestUid: string; revision: number; policyVersion: typeof MERGE_POLICY_VERSION }
}
export interface GuestGameArchive {
  policyVersion: typeof MERGE_POLICY_VERSION
  reason: "existing-profile-kept"
  sourceUid: string
  game: Game
}
interface MergeWrite {
  gameId: string
  game?: MergeGame
  history?: ReturnType<typeof gameHistory>
  archive?: { id: string; record: GuestGameArchive }
}
export interface MergePagePlan {
  writes: MergeWrite[]
  stats: Stats
  imported: number
  conflicts: number
  alreadyImported: number
}

function inconsistent(): never {
  throw new HttpsError("failed-precondition", "Saved progress needs review before accounts can be combined.")
}
function validUid(uid: string): boolean {
  return typeof uid === "string" && uid.length > 0 && uid.length <= 128 && !uid.includes("/")
}
function validDate(value: unknown): boolean {
  try { dateId(value); return true } catch { return false }
}
function validChallenge(value: unknown): boolean {
  try { challengeKey(value); return true } catch { return false }
}
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

// Source records are server-owned. Fail closed on incompatible or corrupt
// records instead of silently dropping a day or manufacturing replacement stats.
export function validateMergeGame(game: MergeGame, uid: string): void {
  if (!game || game.schemaVersion !== 2 || game.scoringVersion !== 1 || game.gameMode !== "movies" ||
    game.playerID !== uid || !validChallenge(game.challengeId) || game.id !== `movies_${game.challengeId}` ||
    (game.challengeId.includes("_LEVEL_") && !game.challengeId.endsWith(`_${game.difficulty}`)) ||
    !Object.hasOwn(DIFFICULTY_MODES, game.difficulty) ||
    game.guessesMax !== DIFFICULTY_MODES[game.difficulty].guessesMax ||
    !Array.isArray(game.guesses) || game.guesses.length > game.guessesMax ||
    game.guesses.some(guess => !guess || !Number.isSafeInteger(guess.itemId) || guess.itemId <= 0) ||
    new Set(game.guesses.map(guess => guess.itemId)).size !== game.guesses.length ||
    !count(game.answerId) || game.answerId === 0 ||
    !game.triviaItem || game.triviaItem.id !== game.answerId || typeof game.triviaItem.title !== "string" ||
    typeof game.triviaItem.posterPath !== "string" ||
    !game.hintsUsed || typeof game.hintsUsed !== "object" || Array.isArray(game.hintsUsed) ||
    Object.entries(game.hintsUsed).some(([type, used]) => !HINT_TYPES.includes(type as typeof HINT_TYPES[number]) || typeof used !== "boolean") ||
    typeof game.correctAnswer !== "boolean" || typeof game.gaveUp !== "boolean" ||
    game.correctAnswer !== game.guesses.some(guess => guess.itemId === game.answerId) ||
    (game.correctAnswer && (game.gaveUp || game.guesses.at(-1)?.itemId !== game.answerId)) ||
    !count(game.revision) || game.revision > 9 || !Array.isArray(game.actions) || game.actions.length !== game.revision ||
    game.actions.some(action => !action || typeof action.id !== "string" || !/^[a-zA-Z0-9_-]{16,80}$/.test(action.id) || typeof action.fingerprint !== "string") ||
    new Set(game.actions.map(action => action.id)).size !== game.actions.length ||
    typeof game.startDate !== "string" || typeof game.endDate !== "string" ||
    !Number.isFinite(Date.parse(game.startDate)) || !Number.isFinite(Date.parse(game.endDate)) ||
    Date.parse(game.endDate) < Date.parse(game.startDate) ||
    game.statsProcessed !== terminal(game) || !count(game.score) ||
    game.score !== (terminal(game) ? calculateScore(game) : 0)) inconsistent()
  const spent = Object.values(game.hintsUsed).filter(Boolean).length
  if ((game.difficulty === "LEVEL_2" && spent > 3) ||
    (game.difficulty !== "LEVEL_2" && game.difficulty !== "LEVEL_3" && spent > 0)) inconsistent()
  if (game.mergeOrigin && (!validUid(game.mergeOrigin.guestUid) || !count(game.mergeOrigin.revision) ||
    game.mergeOrigin.revision > game.revision || game.mergeOrigin.policyVersion !== MERGE_POLICY_VERSION)) inconsistent()
}

export function validateMergeStats(stats: Stats, uid: string, calendarComplete = true): void {
  if (!stats || stats.id !== uid ||
    ![stats.currentStreak, stats.maxStreak, stats.games, stats.allTimeScore, stats.hintsAvailable, stats.hintsUsedCount].every(count) ||
    !Array.isArray(stats.wins) || stats.wins.length !== 5 || !stats.wins.every(count) ||
    stats.wins.reduce((sum, value) => sum + value, 0) > stats.games ||
    stats.currentStreak > stats.maxStreak || stats.maxStreak > stats.games ||
    (stats.lastCompletedDate !== null && !validDate(stats.lastCompletedDate)) ||
    (stats.games === 0) !== (stats.lastCompletedDate === null) ||
    !Array.isArray(stats.winningDays) || !stats.winningDays.every(validDate) ||
    new Set(stats.winningDays).size !== stats.winningDays.length ||
    stats.winningDays.length > stats.wins.reduce((sum, value) => sum + value, 0) ||
    (calendarComplete && stats.maxStreak > (stats.completedDays ?? stats.winningDays).length) ||
    stats.winningDays.some((day, index) => index > 0 && day <= stats.winningDays[index - 1]) ||
    stats.winningDays.some(day => !stats.lastCompletedDate || day > stats.lastCompletedDate)) inconsistent()
  if (stats.statisticsVersion === 3 && (!stats.completedDays || !stats.byDifficulty ||
    ![stats.daysCompleted, stats.allFiveCompleted, stats.allFiveSolved].every(count) ||
    stats.allFiveSolved! > stats.allFiveCompleted! || stats.allFiveCompleted! > stats.daysCompleted! || stats.maxStreak > stats.daysCompleted! ||
    (calendarComplete && (stats.daysCompleted !== stats.completedDays.length || stats.allFiveCompleted !== stats.allFiveDays?.length || (stats.wins.some(value => value > 0) && stats.winningDays.length === 0))) ||
    Object.values(stats.byDifficulty).reduce((sum, level) => sum + level.games, 0) !== stats.games ||
    Object.values(stats.byDifficulty).reduce((sum, level) => sum + level.score, 0) !== stats.allTimeScore ||
    Object.entries(stats.byDifficulty).some(([key, level]) => !Object.hasOwn(DIFFICULTY_MODES, key) || level.guesses?.length !== DIFFICULTY_MODES[key as keyof typeof DIFFICULTY_MODES].guessesMax) ||
    stats.wins.some((value, index) => value !== Object.values(stats.byDifficulty!).reduce((sum, level) => sum + (level.guesses?.[index] ?? 0), 0)) ||
    Object.values(stats.byDifficulty).some(level => ![level.games, level.wins, level.score, level.gaveUp].every(count) ||
      !Array.isArray(level.guesses) || !level.guesses.every(count) || level.guesses.reduce((a, b) => a + b, 0) !== level.wins || level.wins + level.gaveUp > level.games))) inconsistent()
  if (stats.statisticsVersion === 3 && calendarComplete) {
    const days = stats.completedDays!
    const daySet = new Set(days)
    const winningDays = new Set(stats.winningDays)
    if (!days.every(validDate) || days.some((day, i) => i > 0 && day <= days[i - 1]) ||
      days.at(-1) !== (stats.lastCompletedDate ?? undefined) ||
      stats.winningDays.some(day => !daySet.has(day)) ||
      !stats.completedDifficulties || !stats.solvedDifficulties ||
      Object.keys(stats.completedDifficulties).length !== days.length ||
      stats.allFiveSolved !== Object.values(stats.solvedDifficulties).filter(levels => levels.length === 5).length) inconsistent()
    for (const [day, levels] of Object.entries(stats.completedDifficulties!)) {
      const solved = stats.solvedDifficulties![day] ?? []
      if (!daySet.has(day) || !Array.isArray(levels) || levels.length > 5 ||
        new Set(levels).size !== levels.length || levels.some(level => !Object.hasOwn(DIFFICULTY_MODES, level)) ||
        !Array.isArray(solved) || new Set(solved).size !== solved.length || solved.some(level => !levels.includes(level))) inconsistent()
    }
    if (Object.keys(stats.solvedDifficulties!).some(day => !winningDays.has(day))) inconsistent()
  }
}

/**
 * Pure plan for one transaction, not a callable or an authorization boundary.
 * A worker must prove control of both accounts, lock both against writes/deletion,
 * read these records within the transaction, then commit every write + stats +
 * its durable cursor atomically. Never pass client-supplied games or statistics.
 */
export function planAccountMergePage(input: {
  sourceUid: string
  targetUid: string
  sourceGames: MergeGame[]
  // One entry per source game: undefined means the destination document is absent.
  destinationGames: ReadonlyMap<string, MergeGame | undefined>
  targetStats: Stats
}): MergePagePlan {
  const { sourceUid, targetUid, sourceGames, destinationGames, targetStats } = input
  if (!validUid(sourceUid) || !validUid(targetUid) || sourceUid === targetUid ||
    !Array.isArray(sourceGames) || sourceGames.length > MERGE_PAGE_SIZE) inconsistent()
  validateMergeStats(targetStats, targetUid)
  const seen = new Set<string>()
  for (const source of sourceGames) {
    validateMergeGame(source, sourceUid)
    if (source.mergeOrigin || seen.has(source.id) || !destinationGames.has(source.id)) inconsistent()
    seen.add(source.id)
    const destination = destinationGames.get(source.id)
    if (destination) {
      validateMergeGame(destination, targetUid)
      if (destination.id !== source.id) inconsistent()
    }
  }
  const plan: MergePagePlan = { writes: [], stats: structuredClone(targetStats), imported: 0, conflicts: 0, alreadyImported: 0 }
  // Stable ordering makes page input order irrelevant, including streak updates.
  for (const source of [...sourceGames].sort((a, b) => a.id.localeCompare(b.id))) {
    const destination = destinationGames.get(source.id)
    if (destination?.mergeOrigin?.guestUid === sourceUid) {
      if (destination.mergeOrigin.revision !== source.revision) inconsistent()
      plan.alreadyImported++
      continue
    }
    if (destination) {
      plan.conflicts++
      plan.writes.push({ gameId: source.id, archive: {
        id: `${sourceUid}_${source.id}`,
        record: { policyVersion: MERGE_POLICY_VERSION, reason: "existing-profile-kept", sourceUid,
          game: { ...structuredClone(source), playerID: targetUid } },
      } })
      continue
    }
    const game: MergeGame = {
      ...structuredClone(source), playerID: targetUid,
      mergeOrigin: { guestUid: sourceUid, revision: source.revision, policyVersion: MERGE_POLICY_VERSION },
    }
    plan.imported++
    plan.writes.push({ gameId: game.id, game, ...(game.statsProcessed ? { history: gameHistory(game) } : {}) })
    // Only Easy hints are spent. Medium clues are unlocked by guesses.
    if (game.difficulty === "LEVEL_2") plan.stats.hintsUsedCount += Object.values(game.hintsUsed).filter(Boolean).length
    if (game.statsProcessed) plan.stats = completeStats(plan.stats, game)
  }
  validateMergeStats(plan.stats, targetUid)
  return plan
}
