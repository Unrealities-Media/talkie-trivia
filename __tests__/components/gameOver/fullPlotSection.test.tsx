import React from "react"
import { render, screen } from "@testing-library/react-native"
import FullPlotSection from "../../../src/components/gameOver/fullPlotSection"
import { ThemeProvider } from "../../../src/contexts/themeContext"
it("labels the saved clue accurately without claiming a complete movie plot", () => {
  render(<ThemeProvider><FullPlotSection overview="A reviewed clue from the saved game." /></ThemeProvider>)
  expect(screen.getByRole("header", { name: "The complete clue" })).toBeTruthy()
  expect(screen.getByText("A reviewed clue from the saved game.")).toBeTruthy()
})
