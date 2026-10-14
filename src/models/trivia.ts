/**
 * Defines the available game modes in the application.
 */
export type GameMode = "movies" | "videoGames" | "tvShows"

export interface Genre {
  id: number
  name: string
}

/**
 * Represents a generic hint for any trivia item.
 */
export interface Hint {
  type: string // Machine-readable type, e.g., 'director', 'developer'
  label: string // UI-friendly label, e.g., 'Director', 'Developer'
  value: any // The actual hint data, e.g., a string or an array of objects
  isLinkable?: boolean // Optional: To indicate if the value can be linked externally (like IMDb)
  metadata?: { [key: string]: any } // Optional: For extra data like an actor's imdb_id
}

/**
 * A generic trivia item that can represent a movie, video game, book, etc.
 */
export interface TriviaItem {
  id: number | string
  title: string
  description: string // The main clue text (e.g., plot summary, gameplay description)
  posterPath: string
  releaseDate: string

  // A flexible object for all other non-hint metadata
  metadata: {
    [key: string]: any // e.g., { imdb_id: 'tt12345', metacritic_score: 95 }
  }
  hints: Hint[]
}

/**
 * A lightweight version of TriviaItem, used for the search picker.
 */
export interface BasicTriviaItem {
  id: number | string
  title: string
  releaseDate: string
  posterPath: string
  /** Reviewed alternate/localized titles, always resolving to the same ID. */
  aliases?: readonly string[]
}
