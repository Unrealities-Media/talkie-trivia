import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import { useAuth } from "../../src/contexts/authContext"
import { useGameStore } from "../../src/state/gameStore"
import NextChallenge from "../../src/components/nextChallenge"

jest.mock("../../src/state/gameStore")
jest.mock("../../src/contexts/authContext")

const setDifficulty = jest.fn()
let state: Record<string, unknown>
const show = () => render(<ThemeProvider><NextChallenge /></ThemeProvider>)
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  ;(useAuth as jest.Mock).mockReturnValue({ player: { id: "guest" } })
  state = { playerGame: { difficulty: "LEVEL_3", playerID: "guest" },
    dailyChallenges: { LEVEL_1: "Not started", LEVEL_2: "Won", LEVEL_3: "Won", LEVEL_4: "Not started", LEVEL_5: "Lost" },
    resetDeadline: 10000, loading: false, syncStatus: "idle", setDifficulty }
  ;(useGameStore as unknown as jest.Mock).mockImplementation(select => select(state))
})
afterEach(() => jest.useRealTimers())

it("starts the next unfinished difficulty directly", () => {
  show()
  fireEvent.press(screen.getByRole("button", { name: "Next challenge: Hard" }))
  expect(setDifficulty).toHaveBeenCalledWith("LEVEL_4")
})
it("prefers resuming a saved challenge to starting another", () => {
  state.dailyChallenges = { LEVEL_1: "In progress", LEVEL_3: "Won", LEVEL_4: "Not started" }
  show()
  fireEvent.press(screen.getByRole("button", { name: "Continue Very Easy" }))
  expect(setDifficulty).toHaveBeenCalledWith("LEVEL_1")
})
it.each([
  { dailyChallenges: { LEVEL_1: "Won", LEVEL_2: "Lost", LEVEL_3: "Won", LEVEL_4: "Won", LEVEL_5: "Lost" } },
  { dailyChallenges: {} },
  { resetDeadline: null },
  { resetDeadline: 0 },
  { playerGame: { difficulty: "LEVEL_3", playerID: "old-guest" } },
])("does not invent an available challenge from stale or incomplete state: %j", patch => {
  Object.assign(state, patch)
  show()
  expect(screen.queryByRole("button")).toBeNull()
})
it.each([{ loading: true }, { syncStatus: "saving" }, { syncStatus: "pending" }])("does not interrupt saving or loading: %j", patch => {
  Object.assign(state, patch)
  show()
  fireEvent.press(screen.getByRole("button"))
  expect(setDifficulty).not.toHaveBeenCalled()
})
it("does not use yesterday's suggestion after the deadline passes", () => {
  show()
  jest.advanceTimersByTime(11000)
  fireEvent.press(screen.getByRole("button"))
  expect(setDifficulty).not.toHaveBeenCalled()
})
