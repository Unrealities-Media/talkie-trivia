export const API_CONFIG = {
  TMDB_IMAGE_BASE_URL_W780: "https://image.tmdb.org/t/p/w780",
  TMDB_IMAGE_BASE_URL_W92: "https://image.tmdb.org/t/p/w92",
  TMDB_IMAGE_BASE_URL_W185: "https://image.tmdb.org/t/p/w185",
  TMDB_IMAGE_BASE_URL_W500: "https://image.tmdb.org/t/p/w500",
  IMDB_BASE_URL_NAME: "https://www.imdb.com/name/",
  IMDB_BASE_URL_TITLE: "https://www.imdb.com/title/",
}

export const FIRESTORE_COLLECTIONS = {
  MOVIES: "movies",
  DAILY_GAMES: "dailyGames",
  PLAYERS: "players",
  PLAYER_STATS: "playerStats",
  PLAYER_GAMES: "playerGames",
  GAME_HISTORY: "gameHistory",
}

export const ASYNC_STORAGE_KEYS = {
  THEME_PREFERENCE: "theme_preference",
  DIFFICULTY_SETTING: "difficulty_setting",
  ONBOARDING_STATUS: "hasSeenOnboarding",
  TUTORIAL_GUESS_INPUT_SEEN: "tutorial_guess_input_seen",
  TUTORIAL_RESULTS_SEEN: "tutorial_results_seen",
}

export const GAME_DEFAULTS = {
  MAX_GUESSES: 5,
  INITIAL_HINTS: 3,
}

export const ANIMATION_CONSTANTS = {
  TYPEWRITER_CHAR_DURATION: 40, // ms
  MODAL_ANIMATION_DURATION: 300, // ms
}

export const DEVICE_CONFIG = {
  LOW_END_DEVICE_THRESHOLD_YEAR: 2018,
}
