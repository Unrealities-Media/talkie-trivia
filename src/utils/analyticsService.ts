import {
  logEvent as firebaseLogEvent,
  setUserId,
  setUserProperties,
  Analytics,
} from "firebase/analytics"
import { analytics } from "../config/firebase"

// A type-safe wrapper for logging events
const logEvent = async (eventName: string, params?: { [key: string]: any }) => {
  // Ensure analytics is initialized before logging
  if (!analytics) {
    return
  }

  try {
    // Use the initialized analytics instance
    await firebaseLogEvent(analytics as Analytics, eventName, params)
  } catch {
    // Telemetry failures must neither interrupt play nor expose SDK payloads.
  }
}

export const analyticsService = {
  // --- User Identification ---
  identifyUser: (userId: string, properties?: { [key: string]: any }) => {
    if (!analytics) return
    setUserId(analytics as Analytics, userId)
    const method = properties?.sign_in_method
    if (["google", "anonymous", "apple"].includes(method)) {
      setUserProperties(analytics as Analytics, { sign_in_method: method })
    }
  },
  clearIdentity: () => {
    if (!analytics) return
    setUserId(analytics as Analytics, null)
    setUserProperties(analytics as Analytics, { sign_in_method: null })
  },

  // --- Onboarding ---
  trackOnboardingStarted: () => logEvent("onboarding_started"),
  trackOnboardingCompleted: () => logEvent("onboarding_completed"),

  // --- Game Lifecycle ---
  trackGameStart: (movieId: number, movieTitle: string) =>
    logEvent("game_start", { movie_id: movieId, movie_title: movieTitle }),
  trackGameWin: (guesses: number, hintsUsed: number) =>
    logEvent("game_win", {
      guesses_taken: guesses,
      hints_used_count: hintsUsed,
    }),
  trackGameLose: (hintsUsed: number) =>
    logEvent("game_lose", { hints_used_count: hintsUsed }),
  trackGameGiveUp: (guessesMade: number, hintsUsed: number) =>
    logEvent("game_give_up", {
      guesses_made: guessesMade,
      hints_used_count: hintsUsed,
    }),

  // --- User Actions ---
  trackGuessMade: (
    guessNumber: number,
    isCorrect: boolean,
    guessedMovieId: number,
    guessedMovieTitle: string
  ) =>
    logEvent("guess_made", {
      guess_number: guessNumber,
      is_correct: isCorrect,
      guessed_movie_id: guessedMovieId,
      guessed_movie_title: guessedMovieTitle,
    }),
  trackHintUsed: (
    hintType: string,
    guessNumber: number,
    hintsRemaining: number
  ) =>
    logEvent("hint_used", {
      hint_type: hintType,
      guess_number_before_hint: guessNumber,
      hints_remaining: hintsRemaining,
    }),
  trackHintOptionsToggled: () => logEvent("hint_options_toggled"),
  trackShareResults: (outcome: "win" | "lose" | "give_up") =>
    logEvent("share_results_tapped", { game_outcome: outcome }),
  trackImdbLinkTapped: (movieTitle: string) =>
    logEvent("imdb_link_tapped", { movie_title: movieTitle }),
  trackActorLinkTapped: (actorName: string) =>
    logEvent("actor_link_tapped", { actor_name: actorName }),

  // --- Auth ---
  trackGoogleSignInStart: () => logEvent("google_signin_start"),
  trackGoogleSignInSuccess: (userId: string) => {
    logEvent("login", { method: "google" })
    logEvent("google_signin_success")
    analyticsService.identifyUser(userId, { sign_in_method: "google" })
  },
  trackGoogleSignInFailure: (error: string) =>
    logEvent("google_signin_failure", {
      error_code: ["auth/network-request-failed", "auth/credential-already-in-use", "auth/email-already-in-use", "auth/too-many-requests"].includes(error) ? error : "unknown",
    }),
  trackAnonymousSignIn: (userId: string) => {
    logEvent("login", { method: "anonymous" })
    analyticsService.identifyUser(userId, { sign_in_method: "anonymous" })
  },
  trackSignOut: () => {
    const event = logEvent("sign_out")
    analyticsService.clearIdentity()
    return event
  },

  // --- App Health ---
  trackNetworkStatusChange: (isConnected: boolean) =>
    logEvent("network_status_change", { is_connected: isConnected }),
  trackErrorBoundary: (_errorMessage: string) => logEvent("error_boundary_triggered"),
}
