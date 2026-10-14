import React from "react"
import { render, screen } from "@testing-library/react-native"
import ResultSummary from "../../../src/components/gameOver/resultSummary"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { defaultPlayerGame } from "../../../src/models/default"

const game = { ...defaultPlayerGame, difficulty: "LEVEL_2" as const, correctAnswer: true, guesses: [{ itemId: 1 }], hintsUsed: { genre: true, actors: true }, statsProcessed: true, score: 450, challengeId: "2026-10-13" }
it("explains the saved winning score and manual hint penalty", () => {
  render(<ThemeProvider><ResultSummary game={game} /></ThemeProvider>)
  expect(screen.getByText("Saved score: 450 points")).toBeTruthy()
  expect(screen.getByText("2/3 Easy hints used: 100 points deducted from the winning score.")).toBeTruthy()
  expect(screen.getByText(/time taken does not affect it/)).toBeTruthy()
})
it("explains give-up scoring without inventing a negative hint penalty", () => {
  render(<ThemeProvider><ResultSummary game={{ ...game, correctAnswer: false, gaveUp: true, score: 0 }} /></ThemeProvider>)
  expect(screen.getByText("Saved score: 0 points")).toBeTruthy()
  expect(screen.getByText(/Hints do not subtract extra points from a loss/)).toBeTruthy()
})
it("does not recompute a missing canonical score", () => {
  render(<ThemeProvider><ResultSummary game={{ ...game, score: undefined }} /></ThemeProvider>)
  expect(screen.getByText("Saved score unavailable")).toBeTruthy()
})
