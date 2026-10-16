import React from "react"
import { render, screen } from "@testing-library/react-native"
import FullPlotSection from "../../../src/components/gameOver/fullPlotSection"
import { ThemeProvider } from "../../../src/contexts/themeContext"
it("labels and displays the supplied synopsis", () => {
  render(<ThemeProvider><FullPlotSection overview="A reviewed clue from the saved game." /></ThemeProvider>)
  expect(screen.getByRole("header", { name: "Synopsis" })).toBeTruthy()
  expect(screen.getByText("A reviewed clue from the saved game.")).toBeTruthy()
})
