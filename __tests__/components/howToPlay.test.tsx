import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import HowToPlay from "../../src/components/howToPlay"
import { ThemeProvider } from "../../src/contexts/themeContext"

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const open = () => {
  render(<ThemeProvider><HowToPlay /></ThemeProvider>)
  press("How to play")
}

it("is optional, replayable, and explains launch rules without login or network", () => {
  render(<ThemeProvider><HowToPlay /></ThemeProvider>)
  expect(screen.queryByText("One movie each day")).toBeNull()
  expect(screen.getByRole("button", { name: "How to play" }).props.accessibilityState.expanded).toBe(false)
  press("How to play")
  expect(screen.getByText(/Tapping a search result immediately submits a guess/)).toBeTruthy()
  expect(screen.getByText(/00:00 UTC/)).toBeTruthy()
  expect(screen.getByText(/Each Easy hint subtracts 50 points/)).toBeTruthy()
  expect(screen.getByText(/three per game/)).toBeTruthy()
  expect(screen.getByText(/A loss or Give Up scores zero/)).toBeTruthy()
  for (const rule of ["Basic: 5 guesses, up to 400 points", "Easy: 5 guesses, up to 550 points", "Medium: 5 guesses, up to 700 points", "Hard: 5 guesses, up to 850 points", "Extreme: 3 guesses, up to 1000 points"]) {
    expect(screen.getByRole("header", { name: rule })).toBeTruthy()
  }
  press("Close instructions")
  press("How to play")
  expect(screen.getByText("One movie each day")).toBeTruthy()
})

it("teaches incorrect guesses, shared hints and clue progression, then resets on replay", () => {
  open()
  press("Try a practice example")
  press("Moon Detective (1992)")
  expect(screen.getByText(/Moon Detective is incorrect/)).toBeTruthy()
  expect(screen.getByText(/4 guesses left/)).toBeTruthy()
  expect(screen.getByRole("button", { name: "Moon Detective (1992)" })).toBeDisabled()
  expect(screen.getByText(/Her floating cakes feed the crew/)).toBeTruthy()
  press("Space Bakery (1995)")
  expect(screen.getByText(/You used 2 guesses/)).toBeTruthy()
  press("Restart example")
  expect(screen.getByText(/5 guesses left/)).toBeTruthy()
  expect(screen.queryByText(/Moon Detective is incorrect/)).toBeNull()
  press("Space Bakery (1995)")
  expect(screen.getByText(/You used 1 guess/)).toBeTruthy()
})

it("can skip practice midway and starts a fresh example when reopened", () => {
  open()
  press("Try a practice example")
  press("Moon Detective (1992)")
  press("Hide instructions")
  press("How to play")
  expect(screen.queryByText(/These movies are invented/)).toBeNull()
  press("Try a practice example")
  expect(screen.getByText(/5 guesses left/)).toBeTruthy()
})
