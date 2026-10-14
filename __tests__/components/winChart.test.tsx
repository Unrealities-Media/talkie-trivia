import React from "react"
import { render, screen } from "@testing-library/react-native"
import { StyleSheet } from "react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import WinChart from "../../src/components/winChart"

const chart = (wins: number[]) => <ThemeProvider><WinChart wins={wins} /></ThemeProvider>

it("explains zero wins without drawing a misleading distribution", () => {
  render(chart([0, 0, 0, 0, 0]))
  expect(screen.getByText(/after your first win/)).toBeTruthy()
  expect(screen.queryByTestId("win-distribution")).toBeNull()
})
it("renders actual native bars and readable counts, including zero buckets", () => {
  render(chart([1, 5, 2, 0, 1]))
  expect(screen.getByText(/9 wins across all difficulties/)).toBeTruthy()
  expect(screen.getByLabelText("1 guess: 1 win")).toBeTruthy()
  expect(screen.getByLabelText("2 guesses: 5 wins")).toBeTruthy()
  expect(screen.getByLabelText("4 guesses: 0 wins")).toBeTruthy()
  expect(StyleSheet.flatten(screen.getByTestId("win-bar-1", { includeHiddenElements: true }).props.style).width).toBe("20%")
  expect(StyleSheet.flatten(screen.getByTestId("win-bar-2", { includeHiddenElements: true }).props.style).width).toBe("100%")
  expect(StyleSheet.flatten(screen.getByTestId("win-bar-4", { includeHiddenElements: true }).props.style).width).toBe("0%")
})
it("shows a first win immediately when statistics refresh, padding old short arrays", () => {
  const view = render(chart([]))
  view.rerender(chart([1]))
  expect(screen.getByText(/1 win across all difficulties/)).toBeTruthy()
  expect(screen.getByLabelText("5 guesses: 0 wins")).toBeTruthy()
})
it.each([undefined, [NaN], [-1], [1.5], [Number.MAX_SAFE_INTEGER, 1]])(
  "does not disguise malformed saved statistics as zero wins: %s", wins => {
    render(chart(wins as number[]))
    expect(screen.getByText(/unavailable for these saved statistics/)).toBeTruthy()
    expect(screen.queryByTestId("win-distribution")).toBeNull()
  }
)
