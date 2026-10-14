import { logEvent, setUserId, setUserProperties } from "firebase/analytics"

jest.mock("../../src/config/firebase", () => ({
  analytics: {},
}))

jest.mock("firebase/analytics", () => ({
  getAnalytics: jest.fn(),
  logEvent: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn(),
}))

import { analyticsService } from "../../src/utils/analyticsService"

describe("Utils: analyticsService", () => {
  const mockConsoleLog = jest.spyOn(console, "log").mockImplementation(() => {})
  const mockConsoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {})

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  describe("Safety Checks", () => {
    it("should fail gracefully if analytics is not initialized", async () => {
      jest.isolateModules(() => {
        jest.doMock("../../src/config/firebase", () => ({
          __esModule: true,
          analytics: null,
        }))

        const mockLogEvent = jest.fn()
        jest.doMock("firebase/analytics", () => ({
          getAnalytics: jest.fn(),
          logEvent: mockLogEvent,
        }))

        const {
          analyticsService: freshService,
        } = require("../../src/utils/analyticsService")

        freshService.trackGameStart(1, "Test Movie")

        expect(mockLogEvent).not.toHaveBeenCalled()
      })
    })

    it("does not expose SDK error payloads in logs", async () => {
      jest.resetModules()

      jest.doMock("../../src/config/firebase", () => ({ analytics: {} }))

      const mockLogEvent = jest
        .fn()
        .mockRejectedValue(new Error("Firebase Error"))
      jest.doMock("firebase/analytics", () => ({
        logEvent: mockLogEvent,
        getAnalytics: jest.fn(),
        setUserId: jest.fn(),
        setUserProperties: jest.fn(),
      }))

      const {
        analyticsService: freshService,
      } = require("../../src/utils/analyticsService")

      await freshService.trackGameStart(1, "Test Movie")

      expect(mockConsoleError).not.toHaveBeenCalled()
    })
  })

  describe("User Identification", () => {
    it("should set user ID", () => {
      analyticsService.identifyUser("user-123")
      expect(setUserId).toHaveBeenCalledWith(expect.anything(), "user-123")
    })

    it("only forwards an allowlisted sign-in method, never profile properties", () => {
      analyticsService.identifyUser("user-123", { sign_in_method: "google", name: "Private Name", email: "private@example.com" })
      expect(setUserProperties).toHaveBeenCalledWith(expect.anything(), {
        sign_in_method: "google",
      })
    })
    it("clears the user ID and method on sign-out", async () => {
      await analyticsService.trackSignOut()
      expect(setUserId).toHaveBeenCalledWith(expect.anything(), null)
      expect(setUserProperties).toHaveBeenCalledWith(expect.anything(), { sign_in_method: null })
    })
  })

  describe("Event Tracking", () => {
    it("trackOnboardingStarted", async () => {
      await analyticsService.trackOnboardingStarted()
      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "onboarding_started",
        undefined
      )
    })

    it("trackGameStart", async () => {
      await analyticsService.trackGameStart(101, "Inception")
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), "game_start", {
        movie_id: 101,
        movie_title: "Inception",
      })
    })

    it("trackGameWin", async () => {
      await analyticsService.trackGameWin(3, 1)
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), "game_win", {
        guesses_taken: 3,
        hints_used_count: 1,
      })
    })

    it("trackGameLose", async () => {
      await analyticsService.trackGameLose(2)
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), "game_lose", {
        hints_used_count: 2,
      })
    })

    it("trackGuessMade", async () => {
      await analyticsService.trackGuessMade(1, true, 500, "Movie A")
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), "guess_made", {
        guess_number: 1,
        is_correct: true,
        guessed_movie_id: 500,
        guessed_movie_title: "Movie A",
      })
    })

    it("trackHintUsed", async () => {
      await analyticsService.trackHintUsed("director", 2, 1)
      expect(logEvent).toHaveBeenCalledWith(expect.anything(), "hint_used", {
        hint_type: "director",
        guess_number_before_hint: 2,
        hints_remaining: 1,
      })
    })

    it("trackShareResults", async () => {
      await analyticsService.trackShareResults("win")
      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "share_results_tapped",
        {
          game_outcome: "win",
        }
      )
    })

    it("never sends arbitrary auth error text", async () => {
      const longError = "private@example.com " + "a".repeat(200)
      await analyticsService.trackGoogleSignInFailure(longError)

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "google_signin_failure",
        {
          error_code: "unknown",
        }
      )
    })

    it("never sends raw error-boundary messages", async () => {
      const longError = "e".repeat(200)
      await analyticsService.trackErrorBoundary(longError)

      expect(logEvent).toHaveBeenCalledWith(
        expect.anything(),
        "error_boundary_triggered",
        undefined
      )
    })
  })
})
