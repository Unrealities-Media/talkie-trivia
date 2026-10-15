import { PlayerGame, HintInfo } from "../models/game"
import PlayerStats from "../models/playerStats"
import { BasicTriviaItem, TriviaItem, GameMode } from "../models/trivia"
import { DifficultyLevel } from "../config/difficulty"
import Player from "../models/player"
import { DailyChallenges } from "../services/gameService"

export type GameStatus = "playing" | "revealing" | "gameOver"

export interface GameSlice {
  dailyChallenges: DailyChallenges
  challengeDate: string | null
  syncStatus: "idle" | "saving" | "pending"
  syncError: string | null
  retryPendingAction: () => Promise<void>
  resetSession: () => void
  resetDeadline: number | null
  playerGame: PlayerGame
  playerStats: PlayerStats
  gameStatus: GameStatus
  isInteractionsDisabled: boolean
  lastGuessResult: {
    itemId: number | string
    correct: boolean
    feedback?: string | null
    hintInfo?: HintInfo[] | null
  } | null

  initializeGame: (player: Player, difficulty?: DifficultyLevel) => Promise<void>
  makeGuess: (selectedItem: BasicTriviaItem) => Promise<void>
  useHint: (hintType: string) => Promise<void>
  giveUp: () => Promise<void>
  processGameOver: () => Promise<void>
  completeRevealSequence: () => void
}

export interface UISlice {
  loading: boolean
  error: string | null
  showModal: boolean
  showConfetti: boolean
  flashMessage: string | null
  tutorialState: {
    showGuessInputTip: boolean
    showResultsTip: boolean
  }

  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setShowModal: (show: boolean) => void
  setFlashMessage: (message: string | null) => void
  handleConfettiStop: () => void
  dismissGuessInputTip: () => void
  dismissResultsTip: () => void
}

export interface SettingsSlice {
  nextDifficulty: DifficultyLevel
  gameMode: GameMode
  difficulty: DifficultyLevel
  setGameMode: (mode: GameMode) => Promise<void>
  setDifficulty: (newDifficulty: DifficultyLevel) => void
}

export interface DataSlice {
  basicItems: readonly BasicTriviaItem[]
  fullItems: readonly TriviaItem[]
  setGameData: (
    full: readonly TriviaItem[],
    basic: readonly BasicTriviaItem[]
  ) => void
}

export type GameStoreState = GameSlice & UISlice & SettingsSlice & DataSlice
