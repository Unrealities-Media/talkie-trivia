import { getAnalytics, logEvent, setUserId } from "firebase/analytics"
import { getPerformance } from "firebase/performance"
import { analytics, perf } from "../../src/config/firebase"
import { analyticsService } from "../../src/utils/analyticsService"

jest.mock("firebase/analytics", () => ({ getAnalytics: jest.fn(), logEvent: jest.fn(), setUserId: jest.fn(), setUserProperties: jest.fn() }))
jest.mock("firebase/performance", () => ({ getPerformance: jest.fn() }))

it("does not initialize optional telemetry or transmit identity/events by default", async () => {
  analyticsService.identifyUser("uid", { email: "private@example.com" })
  await analyticsService.trackGoogleSignInFailure("private@example.com")
  await analyticsService.trackGameStart(1, "Movie")
  await analyticsService.trackSignOut()
  expect(analytics).toBeUndefined()
  expect(perf).toBeUndefined()
  expect(getAnalytics).not.toHaveBeenCalled()
  expect(getPerformance).not.toHaveBeenCalled()
  expect(setUserId).not.toHaveBeenCalled()
  expect(logEvent).not.toHaveBeenCalled()
})
