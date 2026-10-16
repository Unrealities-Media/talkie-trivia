import { Firestore, Transaction, DocumentSnapshot, FieldPath } from "firebase-admin/firestore"
import { HttpsError } from "firebase-functions/v2/https"
import { isDeepStrictEqual } from "node:util"
import { Game, Stats, completeStats, initialStats } from "./gameEngine"
import { validateMergeGame, validateMergeStats } from "./accountMergePolicy"

// A lifetime summary has constant size. Calendar documents contain at most 366
// days each; they are read only for completion, migration and account merging.
export interface Calendar {
  winningDays: string[]
  completedDays: string[]
  completedDifficulties: Record<string, string[]>
  solvedDifficulties: Record<string, string[]>
}
export function summary(stats: Stats): Stats {
  const { winningDays: _wins, completedDays: _days, completedDifficulties: _levels,
    solvedDifficulties: _solved, allFiveDays: _five, ...bounded } = stats
  return bounded as Stats
}
export function calendars(stats: Stats): Map<string, Calendar> {
  const result = new Map<string, Calendar>()
  const winningDays = new Set(stats.winningDays)
  for (const day of stats.completedDays ?? []) {
    const year = day.slice(0, 4)
    const bucket = result.get(year) ?? { winningDays: [], completedDays: [], completedDifficulties: {}, solvedDifficulties: {} }
    bucket.completedDays.push(day)
    if (winningDays.has(day)) bucket.winningDays.push(day)
    bucket.completedDifficulties[day] = stats.completedDifficulties?.[day] ?? []
    if (stats.solvedDifficulties?.[day]) bucket.solvedDifficulties[day] = stats.solvedDifficulties[day]
    result.set(year, bucket)
  }
  return result
}
export function hydrate(stats: Stats, buckets: Calendar[]): Stats {
  return { ...stats, winningDays: buckets.flatMap(b => b.winningDays).sort(),
    completedDays: buckets.flatMap(b => b.completedDays).sort(),
    completedDifficulties: Object.assign({}, ...buckets.map(b => b.completedDifficulties)),
    solvedDifficulties: Object.assign({}, ...buckets.map(b => b.solvedDifficulties)),
    allFiveDays: buckets.flatMap(b => Object.keys(b.completedDifficulties).filter(day => b.completedDifficulties[day].length === 5)).sort() }
}
export function effectiveStats(stats: Stats, now: Date): Stats {
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  return { ...summary(stats), currentStreak: stats.lastCompletedDate === today || stats.lastCompletedDate === yesterday ? stats.currentStreak : 0 }
}
export async function loadStatistics(tx: Transaction, db: Firestore, uid: string, snapshot: DocumentSnapshot, calendar = true) {
  const stored = snapshot.exists ? snapshot.data() as Stats : summary(initialStats(uid))
  const before = new Map<string, Calendar>()
  let stats: Stats
  if (stored.statisticsVersion === 3 && !stored.completedDays) {
    if (calendar) {
      const docs = await tx.get(db.collection(`players/${uid}/statisticsCalendar`))
      for (const doc of docs.docs) before.set(doc.id, doc.data() as Calendar)
    }
    stats = calendar ? hydrate(stored, [...before.values()]) : stored
  } else {
    // Upgrade from authoritative games, never from the incomplete legacy day
    // arrays. Transaction query reads also protect against concurrent actions.
    stats = initialStats(uid)
    let cursor: string | undefined
    for (;;) {
      let query = db.collection(`players/${uid}/games`).orderBy(FieldPath.documentId()).limit(100)
      if (cursor) query = query.startAfter(cursor)
      const page = await tx.get(query)
      for (const doc of page.docs) {
        const game = doc.data() as Game
        validateMergeGame(game, uid)
        if (game.id !== doc.id) throw new HttpsError("failed-precondition", "Saved statistics need review.")
        if (game.difficulty === "LEVEL_2") stats.hintsUsedCount += Object.values(game.hintsUsed).filter(Boolean).length
        if (game.statsProcessed) stats = completeStats(stats, game)
      }
      if (page.size < 100) break
      cursor = page.docs.at(-1)!.id
    }
    // Fix semantics without hiding missing games or changing earned points.
    for (const key of ["games", "wins", "allTimeScore", "hintsUsedCount"] as const) {
      if (!isDeepStrictEqual(stats[key], stored[key])) throw new HttpsError("failed-precondition", "Saved statistics need review.")
    }
  }
  if (calendar || stored.statisticsVersion !== 3 || stored.completedDays) validateMergeStats(stats, uid)
  return { stats, save(next: Stats) {
    tx.set(db.doc(`players/${uid}/privateStats/summary`), summary(next))
    // A hint/ordinary guess does not rewrite calendar history.
    if (next.completedDays) for (const [year, bucket] of calendars(next)) {
      if (!isDeepStrictEqual(before.get(year), bucket)) tx.set(db.doc(`players/${uid}/statisticsCalendar/${year}`), bucket)
    }
  } }
}

/** Bounded checkpoint for ordered verification: keep only the current day's
 * membership, while carrying lifetime counters and the current run forward. */
export function chronologicalStats(stats: Stats, game: Game): Stats {
  const day = game.challengeId.slice(0, 10)
  const same = day === stats.lastCompletedDate
  const next = completeStats(same ? stats : { ...stats, winningDays: [], completedDays: [], completedDifficulties: {}, solvedDifficulties: {}, allFiveDays: [] }, game)
  next.daysCompleted = (stats.daysCompleted ?? 0) + Number(!same)
  next.allFiveCompleted = (stats.allFiveCompleted ?? 0) + Number((next.allFiveDays?.length ?? 0) > (same ? stats.allFiveDays?.length ?? 0 : 0))
  const solvedBefore = same && Object.values(stats.solvedDifficulties ?? {}).some(levels => levels.length === 5)
  next.allFiveSolved = (stats.allFiveSolved ?? 0) + Number(!solvedBefore && Object.values(next.solvedDifficulties ?? {}).some(levels => levels.length === 5))
  next.currentStreak = same ? stats.currentStreak : stats.lastCompletedDate && Date.parse(day) - Date.parse(stats.lastCompletedDate) === 86400000 ? stats.currentStreak + 1 : 1
  next.maxStreak = Math.max(stats.maxStreak, next.currentStreak)
  return next
}
