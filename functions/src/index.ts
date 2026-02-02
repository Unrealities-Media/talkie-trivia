import { onCall, HttpsError } from "firebase-functions/v2/https"
import { initializeApp } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import { calculateScore } from "./utils/scoreUtils"

initializeApp()
const db = getFirestore()

/**
 * Atomic submission for game results.
 * Calculates score on server to prevent tampering, updates player streaks/stats,
 * and records a history entry for the user.
 */
export const submitGameResult = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    )
  }

  const { playerGame } = request.data
  const userId = request.auth.uid

  // Security check: Ensure the user is only submitting results for their own account
  if (!playerGame || playerGame.playerID !== userId) {
    throw new HttpsError("permission-denied", "Invalid game data ownership.")
  }

  const score = calculateScore(playerGame)
  const isWin = playerGame.correctAnswer

  /**
   * Date ID Parsing Logic:
   * Safely derive a YYYY-MM-DD string from the client's startDate.
   * Handles raw ISO strings, Firestore Timestamp objects, or falls back to server time.
   */
  let dateId = new Date().toISOString().split("T")[0]
  try {
    const raw = playerGame.startDate
    if (raw) {
      if (typeof raw === "string") {
        dateId = raw.split("T")[0]
      } else if (raw.seconds) {
        dateId = new Date(raw.seconds * 1000).toISOString().split("T")[0]
      } else if (typeof raw.toDate === "function") {
        dateId = raw.toDate().toISOString().split("T")[0]
      }
    }
  } catch (e) {
    console.warn("Date parsing error, falling back to server date:", e)
  }

  const playerStatsRef = db.collection("playerStats").doc(userId)
  const playerGameRef = db.collection("playerGames").doc(playerGame.id)
  const historyRef = db
    .collection("players")
    .doc(userId)
    .collection("gameHistory")
    .doc(dateId)

  try {
    await db.runTransaction(async (transaction) => {
      const statsDoc = await transaction.get(playerStatsRef)
      let stats = statsDoc.exists ? statsDoc.data() : null

      if (!stats) {
        stats = {
          id: userId,
          currentStreak: 0,
          games: 0,
          maxStreak: 0,
          wins: [0, 0, 0, 0, 0],
          hintsAvailable: 3,
          hintsUsedCount: 0,
          allTimeScore: 0,
        }
      }

      stats!.games = (stats!.games || 0) + 1
      stats!.allTimeScore = (stats!.allTimeScore || 0) + score

      if (isWin) {
        stats!.currentStreak = (stats!.currentStreak || 0) + 1
        stats!.maxStreak = Math.max(stats!.currentStreak, stats!.maxStreak || 0)

        const guessCount = playerGame.guesses.length
        if (!stats!.wins) stats!.wins = [0, 0, 0, 0, 0]

        // Map guess count (1-5) to 0-indexed wins array
        if (guessCount > 0 && guessCount <= 5) {
          stats!.wins[guessCount - 1] = (stats!.wins[guessCount - 1] || 0) + 1
        }
      } else {
        stats!.currentStreak = 0
      }

      // Mark game as processed so client doesn't attempt re-submission
      transaction.set(
        playerGameRef,
        { ...playerGame, statsProcessed: true, score },
        { merge: true },
      )

      transaction.set(playerStatsRef, stats!)

      transaction.set(historyRef, {
        dateId,
        itemId: playerGame.triviaItem.id,
        itemTitle: playerGame.triviaItem.title || "Unknown Title",
        posterPath: playerGame.triviaItem.posterPath || "",
        wasCorrect: isWin,
        gaveUp: playerGame.gaveUp,
        guessCount: playerGame.guesses.length,
        guessesMax: playerGame.guessesMax,
        difficulty: playerGame.difficulty,
        score: score,
        gameMode: playerGame.gameMode || "movies",
        createdAt: FieldValue.serverTimestamp(),
      })
    })

    return { success: true, score }
  } catch (error: any) {
    console.error("Transaction failure:", error)
    throw new HttpsError(
      "internal",
      `Could not submit game result: ${error.message}`,
    )
  }
})
