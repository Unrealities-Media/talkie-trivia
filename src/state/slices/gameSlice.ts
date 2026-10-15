import { StateCreator } from "zustand"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { GameStoreState, GameSlice } from "../storeTypes"
import { defaultPlayerGame, defaultPlayerStats } from "../../models/default"
import { ActionInput, GameResponse, gameService } from "../../services/gameService"
import { MovieDataService } from "../../services/movieDataService"
import { ASYNC_STORAGE_KEYS } from "../../config/constants"
import { analyticsService } from "../../utils/analyticsService"
import { generateImplicitHint } from "../../utils/guessFeedbackUtils"
import { DEFAULT_DIFFICULTY, DIFFICULTY_MODES, DifficultyLevel } from "../../config/difficulty"

const finished = (game: GameResponse["game"]) => game.correctAnswer || game.gaveUp || game.guesses.length >= game.guessesMax
const message = (error: unknown) => {
  const code = (error as { code?: string })?.code?.replace("functions/", "")
  if (code === "resource-exhausted") return "Please wait a few seconds before trying again. Your saved progress is safe."
  if (["internal", "unavailable", "deadline-exceeded"].includes(code ?? "")) return "We couldn't reach the game service. Please try again shortly. Your saved progress is safe."
  return error instanceof Error ? error.message : "Please check your connection and try again."
}
const emptyGame = () => ({ ...defaultPlayerGame, guesses: [], hintsUsed: {} })
const emptyStats = () => ({ ...defaultPlayerStats, wins: [...defaultPlayerStats.wins] })

export const createGameSlice: StateCreator<GameStoreState, [], [], GameSlice> = (set, get) => {
  let generation = 0
  let loadingUid: string | null = null
  const accept = (result: GameResponse, reveal = false) => {
    const over = finished(result.game)
    set({
      challengeDate: result.challengeId.slice(0, 10),
      dailyChallenges: { ...(get().challengeDate === result.challengeId.slice(0, 10) ? get().dailyChallenges : {}),
        [result.game.difficulty]: over ? (result.game.correctAnswer ? "Won" : "Lost") : "In progress" },
      playerGame: result.game,
      playerStats: { ...result.stats, hintsAvailable: result.game.difficulty === "LEVEL_2" ? Math.max(0, 3 - Object.values(result.game.hintsUsed || {}).filter(Boolean).length) : 0 },
      difficulty: result.game.difficulty,
      isInteractionsDisabled: over,
      gameStatus: over ? (reveal ? "revealing" : "gameOver") : "playing",
      syncStatus: "idle", syncError: null,
      resetDeadline: result.receivedAtMonotonic + Math.max(0, Date.parse(result.resetAt) - Date.parse(result.serverNow)),
    })
  }
  const perform = async (action: ActionInput) => {
    const current = get()
    if (current.syncStatus !== "idle" || current.loading || finished(current.playerGame)) return
    // Duplicate guesses never spend an attempt or enter the durable retry queue.
    if (action.type === "guess" && current.playerGame.guesses.some(guess => guess.itemId === action.itemId)) return
    if (current.resetDeadline !== null && performance.now() >= current.resetDeadline) {
      await get().initializeGame({ id: current.playerGame.playerID, name: "Player" })
      return
    }
    const token = generation
    const before = current.playerGame
    set({ syncStatus: "saving", syncError: null })
    try {
      const result = await gameService.applyAction(before, action)
      if (generation !== token) return
      accept(result, true)
      if (action.type === "hint") analyticsService.trackHintUsed(action.hintType, result.game.guesses.length, get().playerStats.hintsAvailable)
      if (action.type === "giveUp") analyticsService.trackGameGiveUp(result.game.guesses.length, Object.values(result.game.hintsUsed || {}).filter(Boolean).length)
      if (action.type === "guess") {
        const guessed = get().fullItems.find(item => item.id === action.itemId)
        const feedback = guessed && before.difficulty === "LEVEL_3" && !result.game.correctAnswer
          ? generateImplicitHint(guessed, result.game.triviaItem, before.hintsUsed)
          : { feedback: result.game.correctAnswer ? "Correct!" : "Not quite! Try again.", hintInfo: null }
        set({ lastGuessResult: { itemId: action.itemId, correct: result.game.correctAnswer, feedback: feedback.feedback, hintInfo: feedback.hintInfo }, showConfetti: result.game.correctAnswer })
        analyticsService.trackGuessMade(result.game.guesses.length, result.game.correctAnswer, action.itemId, guessed?.title || "")
      }
    } catch (error) {
      if (generation !== token) return
      set({ syncStatus: "pending", syncError: message(error) })
    }
  }
  return {
    dailyChallenges: {}, challengeDate: null,
    playerGame: emptyGame(), playerStats: emptyStats(),
    gameStatus: "playing", isInteractionsDisabled: true, lastGuessResult: null,
    syncStatus: "idle", syncError: null, resetDeadline: null,
    resetSession: () => {
      // Invalidate in-flight work immediately, before another account is loaded.
      generation++
      loadingUid = null
      set({ dailyChallenges: {}, challengeDate: null, playerGame: emptyGame(), playerStats: emptyStats(), gameStatus: "playing",
        loading: false, error: null, isInteractionsDisabled: true, lastGuessResult: null,
        showModal: false, showConfetti: false, flashMessage: null, syncStatus: "idle", syncError: null, resetDeadline: null })
    },
    initializeGame: async (player, requestedDifficulty) => {
      if (get().loading && loadingUid === player.id) return
      loadingUid = player.id
      const token = ++generation
      const sameAccount = get().playerGame.playerID === player.id
      set({ loading: true, error: null, isInteractionsDisabled: true, lastGuessResult: null, showModal: false, showConfetti: false, syncStatus: "idle", syncError: null,
        ...(sameAccount ? {} : { dailyChallenges: {}, challengeDate: null, playerGame: emptyGame(), playerStats: emptyStats(), resetDeadline: null }) })
      try {
        const [storedDifficulty, inputTip, resultsTip] = await Promise.all([
          AsyncStorage.getItem(ASYNC_STORAGE_KEYS.DIFFICULTY_SETTING),
          // Optional teaching preferences must not block the daily game.
          AsyncStorage.getItem(ASYNC_STORAGE_KEYS.TUTORIAL_GUESS_INPUT_SEEN).catch(() => null),
          AsyncStorage.getItem(ASYNC_STORAGE_KEYS.TUTORIAL_RESULTS_SEEN).catch(() => null),
        ])
        const preference = requestedDifficulty ?? (storedDifficulty && Object.hasOwn(DIFFICULTY_MODES, storedDifficulty) ? storedDifficulty as DifficultyLevel : DEFAULT_DIFFICULTY)
        if (generation !== token) return
        set({ nextDifficulty: preference })
        const result = await gameService.startGame(player.id, preference)
        if (generation !== token) return
        const lists = new MovieDataService().getCatalogLists()
        set({ ...lists, nextDifficulty: preference, loading: false,
          tutorialState: { showGuessInputTip: inputTip === null, showResultsTip: resultsTip === null } })
        accept(result)
        // Progress reads never block playing; unknown statuses remain unlabeled.
        void gameService.fetchDailyChallenges(player.id, result.challengeId.slice(0, 10)).then(statuses => {
          if (generation === token) set({ dailyChallenges: { ...statuses, [get().difficulty]: get().dailyChallenges[get().difficulty] } })
        }).catch(() => undefined)
      } catch (error) {
        if (generation !== token) return
        set({ error: message(error), loading: false, isInteractionsDisabled: true })
      } finally {
        if (generation === token) loadingUid = null
      }
    },
    makeGuess: async selected => { await perform({ type: "guess", itemId: Number(selected.id) }) },
    useHint: async hintType => { await perform({ type: "hint", hintType }) },
    giveUp: async () => { await perform({ type: "giveUp" }) },
    retryPendingAction: async () => {
      const uid = get().playerGame.playerID
      if (!uid || get().syncStatus === "saving") return
      const token = generation
      set({ syncStatus: "saving", syncError: null })
      try {
        const result = await gameService.resumePendingAction(uid)
        const restored = result || await gameService.startGame(uid, get().nextDifficulty)
        if (generation !== token) return
        accept(restored, true)
      } catch (error) {
        if (generation === token) set({ syncStatus: "pending", syncError: message(error) })
      }
    },
    // Completion is part of the server action transaction, never a second write.
    processGameOver: async () => {
      if (get().syncStatus === "pending") await get().retryPendingAction()
    },
    completeRevealSequence: () => {
      if (finished(get().playerGame)) set({ gameStatus: "gameOver", showModal: true })
    },
  }
}
