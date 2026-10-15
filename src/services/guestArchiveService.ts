import { collection, documentId, getDocs, limit, orderBy, query, startAfter } from "firebase/firestore"
import { auth, db } from "./firebaseClient"
import { PlayerGame } from "../models/game"
import { DIFFICULTY_MODES } from "../config/difficulty"
import { deletionStorage } from "./deletionStorage"
import { mergeStorage } from "./mergeStorage"
import { validChallengeKey } from "../utils/challengeKey"

export const ARCHIVE_PAGE_SIZE = 20
export interface GuestArchiveEntry { id: string; game: PlayerGame }
export interface GuestArchiveCursor { uid: string; dateId: string; id: string }
export interface GuestArchivePage { entries: GuestArchiveEntry[]; next: GuestArchiveCursor | null }
const validDate = validChallengeKey
const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("/")
const validHint = (hint: any) => hint && typeof hint.type === "string" && typeof hint.label === "string"
function requireUser(uid: string) {
  if (auth.currentUser?.uid !== uid) throw new Error("Your account changed. Reopen Profile to view its guest records.")
}
async function requireAvailable(uid: string) {
  requireUser(uid)
  if (await deletionStorage.read() || await mergeStorage.read()) throw new Error("Finish account recovery before viewing preserved games.")
  requireUser(uid)
}
function readEntry(id: string, data: any, uid: string): GuestArchiveEntry {
  const game = data?.game
  if (!data || data.policyVersion !== 1 || data.reason !== "existing-profile-kept" || !validId(data.sourceUid) ||
    !game || game.schemaVersion !== 2 || game.scoringVersion !== 1 || game.gameMode !== "movies" ||
    game.playerID !== uid || !validDate(game.challengeId) || game.id !== `movies_${game.challengeId}` || id !== `${data.sourceUid}_${game.id}` ||
    !Object.hasOwn(DIFFICULTY_MODES, game.difficulty) || game.guessesMax !== DIFFICULTY_MODES[game.difficulty as keyof typeof DIFFICULTY_MODES].guessesMax ||
    !Array.isArray(game.guesses) || game.guesses.length > game.guessesMax || game.guesses.some((guess: any) => !guess || !Number.isSafeInteger(guess.itemId) || guess.itemId <= 0 ||
      (guess.hintInfo != null && (!Array.isArray(guess.hintInfo) || !guess.hintInfo.every(validHint)))) ||
    typeof game.correctAnswer !== "boolean" || typeof game.gaveUp !== "boolean" || typeof game.statsProcessed !== "boolean" ||
    !Number.isSafeInteger(game.score) || game.score < 0 ||
    !game.hintsUsed || typeof game.hintsUsed !== "object" || Array.isArray(game.hintsUsed) || Object.values(game.hintsUsed).some(value => typeof value !== "boolean") ||
    !game.triviaItem || !Number.isSafeInteger(game.triviaItem.id) || game.triviaItem.id <= 0 || game.answerId !== game.triviaItem.id ||
    typeof game.triviaItem.title !== "string" || typeof game.triviaItem.description !== "string" || !Array.isArray(game.triviaItem.hints) ||
    !game.triviaItem.hints.every(validHint) ||
    typeof game.startDate !== "string" || !Number.isFinite(Date.parse(game.startDate)) ||
    typeof game.endDate !== "string" || !Number.isFinite(Date.parse(game.endDate))) {
    throw new Error("A preserved game could not be read. Retry or contact support; no record was skipped.")
  }
  return { id, game: { ...game, startDate: new Date(game.startDate), endDate: new Date(game.endDate) } }
}

export const guestArchiveService = {
  async page(uid: string, cursor: GuestArchiveCursor | null = null): Promise<GuestArchivePage> {
    await requireAvailable(uid)
    if (cursor && (cursor.uid !== uid || !validDate(cursor.dateId) || !validId(cursor.id))) throw new Error("Reopen this account's preserved games.")
    // Include the document ID: several retired guests can have the same UTC day.
    // The lookahead allows exact pagination without an empty trailing page.
    const request = query(collection(db, "players", uid, "mergedGuestGames"), orderBy("game.challengeId", "desc"), orderBy(documentId(), "desc"),
      ...(cursor ? [startAfter(cursor.dateId, cursor.id)] : []), limit(ARCHIVE_PAGE_SIZE + 1))
    const snapshot = await getDocs(request)
    await requireAvailable(uid)
    const entries = snapshot.docs.map(item => readEntry(item.id, item.data(), uid))
    const last = entries[ARCHIVE_PAGE_SIZE - 1]
    return { entries: entries.slice(0, ARCHIVE_PAGE_SIZE),
      next: entries.length > ARCHIVE_PAGE_SIZE ? { uid, dateId: last.game.challengeId!, id: last.id } : null }
  },
}
