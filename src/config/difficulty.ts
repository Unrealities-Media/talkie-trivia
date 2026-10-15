import { GameMode } from "../models/trivia"

/**
 * Internal, machine-readable identifiers for difficulty levels.
 */
export type DifficultyLevel =
  | "LEVEL_1"
  | "LEVEL_2"
  | "LEVEL_3"
  | "LEVEL_4"
  | "LEVEL_5"

/**
 * Defines the core mechanism for how hints/clues are handled in this difficulty.
 */
export type HintStrategy =
  | "ALL_REVEALED"
  | "HINTS_ONLY_REVEALED"
  | "USER_SPEND"
  | "IMPLICIT_FEEDBACK"
  | "NONE_DISABLED"
  | "EXTREME_CHALLENGE"

export interface DifficultyMode {
  label: string
  description: string
  guessesMax: number
  hintStrategy: HintStrategy
  scoreMultiplier: number
  scoreRangePercentage: number
}

/**
 * Default difficulty used when the user has no preference stored.
 */
export const DEFAULT_DIFFICULTY: DifficultyLevel = "LEVEL_3"

/**
 * A numerical ranking for each difficulty level to easily compare them.
 * Lower numbers are easier.
 */
export const DIFFICULTY_RANKING: Record<DifficultyLevel, number> = {
  LEVEL_1: 1,
  LEVEL_2: 2,
  LEVEL_3: 3,
  LEVEL_4: 4,
  LEVEL_5: 5,
}

/**
 * Centralized mapping of internal difficulty levels to their configuration.
 */
export const DIFFICULTY_MODES: Record<DifficultyLevel, DifficultyMode> = {
  LEVEL_1: {
    label: "Very Easy",
    description:
      "A movie synopsis that unfolds with each miss. All four hints are yours from the start. Five guesses.",
    guessesMax: 5,
    hintStrategy: "HINTS_ONLY_REVEALED",
    scoreMultiplier: 0.4, // Max score: 400
    scoreRangePercentage: 0.75,
  },
  LEVEL_2: {
    label: "Easy",
    description:
      "A synopsis with the names left out. Five guesses and three optional hints, each costing 50 points from a winning score.",
    guessesMax: 5,
    hintStrategy: "USER_SPEND",
    scoreMultiplier: 0.55, // Max score: 550
    scoreRangePercentage: 0.65,
  },
  LEVEL_3: {
    label: "Medium",
    description:
      "A more mysterious synopsis. Match a genre, decade, director or actor with your guesses to reveal a hint. Five guesses.",
    guessesMax: 5,
    hintStrategy: "IMPLICIT_FEEDBACK",
    scoreMultiplier: 0.7, // Max score: 700
    scoreRangePercentage: 0.6,
  },
  LEVEL_4: {
    label: "Hard",
    description:
      "An abstract version of the central conflict, without signature details. Five guesses and no hints.",
    guessesMax: 5,
    hintStrategy: "NONE_DISABLED",
    scoreMultiplier: 0.85, // Max score: 850
    scoreRangePercentage: 0.5,
  },
  LEVEL_5: {
    label: "Very Hard",
    description:
      "One short, highly vague clue shown in full. Three guesses and no hints.",
    guessesMax: 3,
    hintStrategy: "EXTREME_CHALLENGE",
    scoreMultiplier: 1.0, // Max score: 1000
    scoreRangePercentage: 0.4,
  },
}

export type Difficulty = DifficultyLevel

/**
 * Configuration for UI text and settings specific to each game mode.
 * This allows components to remain generic by pulling mode-specific content from this central location.
 */
export const GAME_MODE_CONFIG: Record<
  GameMode,
  {
    title: string
    searchPlaceholder: string
    giveUpConfirmation: string
    fullDescriptionTitle: string
    shareResultTitle: string
    shareResultBody: (didWin: boolean) => string
  }
> = {
  movies: {
    title: "Find the title!",
    searchPlaceholder: "Search for a movie title...",
    giveUpConfirmation: "Are you sure you want to give up on this movie?",
    fullDescriptionTitle: "The Full Plot",
    shareResultTitle: "Talkie Trivia 🎬",
    shareResultBody: (didWin) =>
      didWin ? "I guessed today's movie!" : "I couldn't guess today's movie!",
  },
  videoGames: {
    title: "Name that game!",
    searchPlaceholder: "Search for a video game title...",
    giveUpConfirmation: "Are you sure you want to give up on this game?",
    fullDescriptionTitle: "The Full Description",
    shareResultTitle: "Talkie Trivia 🎮",
    shareResultBody: (didWin) =>
      didWin ? "I guessed today's game!" : "I couldn't guess today's game!",
  },
  tvShows: {
    title: "Find the TV show!",
    searchPlaceholder: "Search for a TV show title...",
    giveUpConfirmation: "Are you sure you want to give up on this show?",
    fullDescriptionTitle: "The Full Synopsis",
    shareResultTitle: "Talkie Trivia 📺",
    shareResultBody: (didWin) =>
      didWin ? "I guessed today's show!" : "I couldn't guess today's show!",
  },
}
