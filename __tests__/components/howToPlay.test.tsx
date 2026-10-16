import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import HowToPlay from "../../src/components/howToPlay"
import { ThemeProvider } from "../../src/contexts/themeContext"

it("keeps rules out of the play flow until requested and closes from the same control", () => {
  render(<ThemeProvider><HowToPlay /></ThemeProvider>)
  expect(screen.queryByText("Guess the movie")).toBeNull()
  fireEvent.press(screen.getByRole("button", { name: "How to play" }))
  expect(screen.getByRole("button", { name: "Close help" }).props.accessibilityState.expanded).toBe(true)
  expect(screen.getByText(/Preview shows the poster and year without using a guess/)).toBeTruthy()
  expect(screen.getByText(/−50 points each/)).toBeTruthy()
  expect(screen.getByText(/three guesses/)).toBeTruthy()
  expect(screen.getByText(/00:00 UTC/)).toBeTruthy()
  fireEvent.press(screen.getByRole("button", { name: "Close help" }))
  expect(screen.queryByText("Guess the movie")).toBeNull()
  expect(screen.getByRole("button", { name: "How to play" }).props.accessibilityState.expanded).toBe(false)
})
