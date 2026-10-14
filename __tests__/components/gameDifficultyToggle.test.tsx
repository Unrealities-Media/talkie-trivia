import React from "react"
import { render, screen } from "@testing-library/react-native"
import GameDifficultyToggle from "../../src/components/gameDifficultyToggle"
import { ThemeProvider } from "../../src/contexts/themeContext"
import { useGameStore } from "../../src/state/gameStore"
jest.mock("../../src/state/gameStore")
it("presents saved difficulty without offering to mutate the current challenge", () => {
  ;(useGameStore as unknown as jest.Mock).mockImplementation(selector => selector({ difficulty: "LEVEL_3", playerGame: { difficulty: "LEVEL_5" } }))
  render(<ThemeProvider><GameDifficultyToggle /></ThemeProvider>)
  expect(screen.getByText("Extreme · locked for today")).toBeTruthy()
  expect(screen.queryByRole("button")).toBeNull()
})
