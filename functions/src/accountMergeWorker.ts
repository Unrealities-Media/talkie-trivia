import { isDeepStrictEqual } from "node:util"
import { DocumentData, FieldPath, FieldValue, Firestore, Query, Timestamp, Transaction } from "firebase-admin/firestore"
import { HttpsError } from "firebase-functions/v2/https"
import { MERGE_PAGE_SIZE, MERGE_POLICY_VERSION, MergeGame, planAccountMergePage, validateMergeGame, validateMergeStats } from "./accountMergePolicy"
import { Stats, completeStats, dateId, initialStats } from "./gameEngine"
import { gameHistory } from "./gameHistory"

const phases = ["source-games", "source-history", "target-games", "target-history", "copy", "copied"] as const
export type MergePhase = typeof phases[number]
export interface MergePageResult {
  phase: MergePhase
  imported: number
  conflicts: number
  // Data copying is complete; identities, locks and final cleanup still exist.
  copied: boolean
}
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const validUid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/")
function review(): never {
  throw new HttpsError("failed-precondition", "Saved progress needs review before accounts can be combined.", { reason: "merge-review-required" })
}
function cursorValid(cursor: unknown, phase: MergePhase): boolean {
  if (cursor === null) return true
  if (typeof cursor !== "string") return false
  const value = phase.endsWith("history") ? cursor : cursor.replace(/^movies_/, "")
  try { return dateId(value) === value && (phase.endsWith("history") || cursor === `movies_${value}`) } catch { return false }
}
function page(query: Query, cursor: string | null): Query {
  const ordered = query.orderBy(FieldPath.documentId()).limit(MERGE_PAGE_SIZE)
  return cursor === null ? ordered : ordered.startAfter(cursor)
}
function historyMatches(game: MergeGame | undefined, history: DocumentData | undefined): void {
  if (game?.statsProcessed ? !isDeepStrictEqual(history, gameHistory(game)) : history !== undefined) review()
}
function checkedGame(data: DocumentData, documentId: string, uid: string, source: boolean): MergeGame {
  const game = data as MergeGame
  validateMergeGame(game, uid)
  if (game.id !== documentId || (source && game.mergeOrigin)) review()
  return game
}
async function requireNoLegacy(tx: Transaction, db: Firestore, uid: string): Promise<void> {
  const [stats, history, games, keyedGames] = await Promise.all([
    tx.get(db.doc(`playerStats/${uid}`)),
    tx.get(db.collection(`players/${uid}/gameHistory`).limit(1)),
    tx.get(db.collection("playerGames").where("playerID", "==", uid).limit(1)),
    // Conservatively stop on any old UID-prefix record, including incomplete
    // records with no playerID. Migration must resolve ambiguous prefixes first.
    tx.get(db.collection("playerGames").orderBy(FieldPath.documentId()).startAt(`${uid}-`).endAt(`${uid}-\uf8ff`).limit(1)),
  ])
  if (stats.exists || !history.empty || !games.empty || !keyedGames.empty) review()
}

/**
 * Internal storage worker, not an authorization boundary or public callable.
 * Each invocation commits at most one bounded page plus its durable checkpoint.
 * Both accounts stay locked, including after `copied`; the identity lifecycle,
 * authenticated recovery and deletion cleanup must be integrated before use.
 */
export async function processAccountMergePage(db: Firestore, sourceUid: string): Promise<MergePageResult> {
  if (!validUid(sourceUid)) review()
  const jobRef = db.doc(`accountMerges/${sourceUid}`)
  return db.runTransaction(async tx => {
    const jobDoc = await tx.get(jobRef)
    if (!jobDoc.exists) review()
    const job = jobDoc.data()!
    const targetUid: unknown = job.targetUid
    if (job.sourceUid !== sourceUid || !validUid(targetUid) || targetUid === sourceUid ||
      job.policyVersion !== MERGE_POLICY_VERSION || job.status !== "pending" ||
      !count(job.imported) || !count(job.conflicts) || !count(job.imported + job.conflicts)) review()
    const [sourceLock, targetLock, sourceDeletion, targetDeletion] = await Promise.all([
      tx.get(db.doc(`accountMergeLocks/${sourceUid}`)), tx.get(db.doc(`accountMergeLocks/${targetUid}`)),
      tx.get(db.doc(`accountDeletions/${sourceUid}`)), tx.get(db.doc(`accountDeletions/${targetUid}`)),
    ])
    if (sourceLock.data()?.jobId !== sourceUid || sourceLock.data()?.role !== "source" ||
      targetLock.data()?.jobId !== sourceUid || targetLock.data()?.role !== "target" ||
      sourceDeletion.exists || targetDeletion.exists) review()
    // Reservations made before their first worker invocation have no phase yet.
    const phase: MergePhase = job.phase ?? "source-games"
    if (!phases.includes(phase) || !cursorValid(job.cursor, phase)) review()
    if (job.phase === undefined && (job.cursor !== null || job.imported !== 0 || job.conflicts !== 0)) review()
    if (phase !== "copy" && phase !== "copied" && (job.imported !== 0 || job.conflicts !== 0)) review()
    if (phase !== "source-games" && !count(job.sourceGameCount)) review()
    const result = (nextPhase: MergePhase, imported = job.imported, conflicts = job.conflicts): MergePageResult => ({
      phase: nextPhase, imported, conflicts, copied: nextPhase === "copied",
    })
    if (phase === "copied") {
      if (job.imported + job.conflicts !== job.sourceGameCount) review()
      return result(phase)
    }
    const checkpoint = (data: DocumentData) => tx.update(jobRef, { ...data, updatedAt: Timestamp.now() })
    const isSource = phase.startsWith("source-")
    const uid = isSource ? sourceUid : targetUid
    const statsRef = db.doc(`players/${uid}/privateStats/summary`)
    if (phase.endsWith("games")) {
      if (job.cursor === null) await requireNoLegacy(tx, db, uid)
      const [games, statsDoc] = await Promise.all([
        tx.get(page(db.collection(`players/${uid}/games`), job.cursor)), tx.get(statsRef),
      ])
      let checkedStats: Stats = job.checkedStats ?? initialStats(uid)
      const priorCount = job.checkedGames ?? 0
      validateMergeStats(checkedStats, uid)
      if (!count(priorCount) || (job.cursor !== null && (!job.checkedStats || priorCount === 0)) ||
        (job.cursor === null && (priorCount !== 0 || !isDeepStrictEqual(checkedStats, initialStats(uid))))) review()
      const checkedGamesPage = games.docs.map(doc => checkedGame(doc.data(), doc.id, uid, isSource))
      const histories = await Promise.all(checkedGamesPage.map(game => tx.get(db.doc(`players/${uid}/gameHistoryV2/${game.challengeId}`))))
      for (const [index, game] of checkedGamesPage.entries()) {
        historyMatches(game, histories[index].data())
        if (game.difficulty === "LEVEL_2") checkedStats = { ...checkedStats,
          hintsUsedCount: checkedStats.hintsUsedCount + Object.values(game.hintsUsed).filter(Boolean).length }
        if (game.statsProcessed) checkedStats = completeStats(checkedStats, game)
      }
      validateMergeStats(checkedStats, uid)
      const checkedGames = priorCount + games.size
      if (!count(checkedGames)) review()
      const exhausted = games.size < MERGE_PAGE_SIZE
      if (exhausted) {
        if ((!statsDoc.exists && checkedGames > 0) ||
          !isDeepStrictEqual(statsDoc.data() ?? initialStats(uid), checkedStats)) review()
        const nextPhase = isSource ? "source-history" : "target-history"
        checkpoint({ phase: nextPhase, cursor: null, checkedStats: FieldValue.delete(), checkedGames: FieldValue.delete(),
          ...(isSource ? { sourceGameCount: checkedGames } : { copyStats: checkedStats }) })
        return result(nextPhase)
      }
      checkpoint({ phase, cursor: games.docs.at(-1)!.id, checkedStats, checkedGames })
      return result(phase)
    }
    if (phase.endsWith("history")) {
      // The game pass catches missing histories; this reverse pass catches
      // orphaned histories, so neither account can silently lose completion data.
      const histories = await tx.get(page(db.collection(`players/${uid}/gameHistoryV2`), job.cursor))
      for (const doc of histories.docs) { try { dateId(doc.id) } catch { review() } }
      const games = await Promise.all(histories.docs.map(doc => tx.get(db.doc(`players/${uid}/games/movies_${doc.id}`))))
      for (const [index, doc] of histories.docs.entries()) {
        if (!games[index].exists) review()
        const game = checkedGame(games[index].data()!, games[index].id, uid, isSource)
        historyMatches(game, doc.data())
      }
      const nextPhase = histories.size < MERGE_PAGE_SIZE ? (isSource ? "target-games" : "copy") : phase
      checkpoint({ phase: nextPhase, cursor: nextPhase === phase ? histories.docs.at(-1)!.id : null })
      return result(nextPhase)
    }

    const [sources, targetStatsDoc] = await Promise.all([
      tx.get(page(db.collection(`players/${sourceUid}/games`), job.cursor)), tx.get(statsRef),
    ])
    validateMergeStats(job.copyStats, targetUid)
    if (!isDeepStrictEqual(targetStatsDoc.data() ?? initialStats(targetUid), job.copyStats)) review()
    const sourceGames = sources.docs.map(doc => checkedGame(doc.data(), doc.id, sourceUid, true))
    const rows = await Promise.all(sourceGames.map(async game => {
      const gameRef = db.doc(`players/${targetUid}/games/${game.id}`)
      const historyRef = db.doc(`players/${targetUid}/gameHistoryV2/${game.challengeId}`)
      const archiveRef = db.doc(`players/${targetUid}/mergedGuestGames/${sourceUid}_${game.id}`)
      const [destination, sourceHistory, history, archive] = await Promise.all([
        tx.get(gameRef), tx.get(db.doc(`players/${sourceUid}/gameHistoryV2/${game.challengeId}`)), tx.get(historyRef), tx.get(archiveRef),
      ])
      const targetGame = destination.exists ? checkedGame(destination.data()!, destination.id, targetUid, false) : undefined
      historyMatches(game, sourceHistory.data())
      historyMatches(targetGame, history.data())
      // An atomic page can never leave a same-job import or archive beyond its
      // cursor. Do not cover up inconsistent checkpoints with extra credit.
      if (archive.exists || targetGame?.mergeOrigin?.guestUid === sourceUid) review()
      return { gameRef, historyRef, archiveRef, targetGame }
    }))
    const plan = planAccountMergePage({ sourceUid, targetUid, sourceGames,
      destinationGames: new Map(sourceGames.map((game, index) => [game.id, rows[index].targetGame])),
      targetStats: targetStatsDoc.exists ? targetStatsDoc.data() as Stats : initialStats(targetUid),
    })
    const imported = job.imported + plan.imported
    const conflicts = job.conflicts + plan.conflicts
    if (!count(imported + conflicts) || imported + conflicts > job.sourceGameCount) review()
    const exhausted = sources.size < MERGE_PAGE_SIZE
    if (exhausted && imported + conflicts !== job.sourceGameCount) review()
    for (const write of plan.writes) {
      const row = rows[sourceGames.findIndex(game => game.id === write.gameId)]
      if (write.game) tx.create(row.gameRef, write.game)
      if (write.history) tx.create(row.historyRef, write.history)
      if (write.archive) tx.create(row.archiveRef, write.archive.record)
    }
    if (plan.imported) tx.set(statsRef, plan.stats)
    const nextPhase = exhausted ? "copied" : "copy"
    checkpoint({ phase: nextPhase, cursor: sources.docs.at(-1)?.id ?? job.cursor, imported, conflicts, copyStats: plan.stats })
    return result(nextPhase, imported, conflicts)
  })
}
