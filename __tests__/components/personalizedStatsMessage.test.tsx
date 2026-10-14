import React from "react"
import { render, screen } from "@testing-library/react-native"
import PersonalizedStatsMessage from "../../src/components/personalizedStatsMessage"
import { ThemeProvider } from "../../src/contexts/themeContext"
import { useGameStore } from "../../src/state/gameStore"
import { defaultPlayerGame, defaultPlayerStats } from "../../src/models/default"
jest.mock("../../src/state/gameStore")
jest.mock("../../src/services/gameService", () => ({ gameService: { fetchGameHistory: () => { throw new Error("No post-game history request") } } }))
let state: any
beforeEach(() => {
  state = { playerGame: { ...defaultPlayerGame, playerID: "p1", correctAnswer: true, guesses: [{ itemId: 1 }], difficulty: "LEVEL_2", hintsUsed: { genre: true }, score: 500, statsProcessed: true }, playerStats: { ...defaultPlayerStats, id: "p1", games: 6, wins: [1, 2, 0, 0, 0] } }
  ;(useGameStore as unknown as jest.Mock).mockImplementation(selector => selector(state))
})
const show = () => render(<ThemeProvider><PersonalizedStatsMessage /></ThemeProvider>)
it("celebrates a first guess without calling a hint-penalized score perfect", () => {
  show()
  expect(screen.getByText("Found it on your first guess!")).toBeTruthy()
  expect(screen.queryByText(/perfect/i)).toBeNull()
  expect(screen.getByText("You have won 3 of 6 completed daily games.")).toBeTruthy()
  expect(screen.queryByText(/last 7 days/)).toBeNull()
})
it.each(["account", "pending", "missing", "bad totals"])("does not show stale or invalid progress: %s", mode => {
  if (mode === "account") state.playerStats.id = "other"
  if (mode === "pending") state.playerGame.statsProcessed = false
  if (mode === "missing") state.playerStats = null
  if (mode === "bad totals") state.playerStats.games = 2
  show()
  expect(screen.queryByText(/completed daily/)).toBeNull()
})
it("uses the acknowledged completed-game denominator after a loss", () => {
  state.playerGame = { ...state.playerGame, correctAnswer: false, gaveUp: true, score: 0 }
  show()
  expect(screen.getByText("You have won 3 of 6 completed daily games.")).toBeTruthy()
  expect(screen.queryByText(/first guess/)).toBeNull()
})
