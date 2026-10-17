import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import { DailySlate, ProgressRing } from "../../src/components/profileSlate"

const statuses = { LEVEL_1: "Won", LEVEL_2: "Lost", LEVEL_3: "Won", LEVEL_4: "Not started", LEVEL_5: "In progress" } as const

it("labels every seat with its status and what an unfinished one is worth", () => {
  render(<ThemeProvider><DailySlate statuses={statuses} /></ThemeProvider>)
  expect(screen.getByLabelText("Very Easy: Won")).toBeTruthy()
  expect(screen.getByLabelText("Easy: Lost")).toBeTruthy()
  expect(screen.getByLabelText("Hard: Not started, worth up to 850 points")).toBeTruthy()
  expect(screen.getByLabelText("Very Hard: In progress, worth up to 1000 points")).toBeTruthy()
})

it("opens the chosen difficulty, and ignores presses while choosing is blocked", () => {
  const onSelect = jest.fn()
  const view = render(<ThemeProvider><DailySlate statuses={statuses} onSelect={onSelect} /></ThemeProvider>)
  fireEvent.press(screen.getByLabelText("Hard: Not started, worth up to 850 points"))
  expect(onSelect).toHaveBeenCalledWith("LEVEL_4")
  view.rerender(<ThemeProvider><DailySlate statuses={statuses} /></ThemeProvider>)
  fireEvent.press(screen.getByLabelText("Very Hard: In progress, worth up to 1000 points"))
  expect(onSelect).toHaveBeenCalledTimes(1)
})

it("does not show progress it could not confirm", () => {
  const view = render(<ThemeProvider><ProgressRing completed={3} ready /></ThemeProvider>)
  expect(screen.getByLabelText("3 of 5 daily challenges completed")).toBeTruthy()
  view.rerender(<ThemeProvider><ProgressRing completed={3} ready={false} /></ThemeProvider>)
  expect(screen.getByLabelText("Daily progress unavailable")).toBeTruthy()
})
