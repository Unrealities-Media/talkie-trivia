import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import { useAuth } from "../../src/contexts/authContext"
import SessionRecovery from "../../src/components/sessionRecovery"

jest.mock("../../src/contexts/authContext", () => ({ useAuth: jest.fn() }))
jest.mock("../../src/components/googleLogin", () => () => null)
const replace = jest.fn()
const retry = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  ;(useAuth as jest.Mock).mockReturnValue({ lostSession: { uid: "old", isAnonymous: true }, retryAuthentication: retry, replaceLostSession: replace })
})

it("lets the user retry or cancel without creating another guest", () => {
  render(<ThemeProvider><SessionRecovery /></ThemeProvider>)
  fireEvent.press(screen.getByText("Retry session"))
  expect(retry).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByText("Start a new guest instead"))
  expect(screen.getByText(/will not carry over/)).toBeTruthy()
  expect(replace).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Keep trying"))
  expect(replace).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Start a new guest instead"))
  fireEvent.press(screen.getByText("Start new guest"))
  expect(replace).toHaveBeenCalledTimes(1)
})

it("guides a previously linked player back to the same account", () => {
  ;(useAuth as jest.Mock).mockReturnValue({ lostSession: { uid: "linked", isAnonymous: false } })
  render(<ThemeProvider><SessionRecovery /></ThemeProvider>)
  expect(screen.getByText(/same Google account/)).toBeTruthy()
  expect(replace).not.toHaveBeenCalled()
})
