import React from "react"
import { render, screen } from "@testing-library/react-native"
import PremiereMasthead from "../../src/components/premiereMasthead"
import { defaultPlayerGame } from "../../src/models/default"

let mockGame = { ...defaultPlayerGame }
let mockStatus = "playing"
jest.mock("../../src/state/gameStore", () => ({
  useGameStore: (select: (state: any) => unknown) => select({ playerGame: mockGame, gameStatus: mockStatus }),
}))
jest.mock("../../src/components/premiereStage", () => ({
  premiere: { cream: "#F8E7CA", muted: "#AF9B84" },
}))
jest.mock("../../src/contexts/themeContext", () => ({
  useTheme: () => ({ colors: { textPrimary: "#F8E7CA", textSecondary: "#AF9B84" } }),
}))

it("does not advertise the placeholder game's date before a challenge loads", () => {
  mockGame = { ...defaultPlayerGame }
  render(<PremiereMasthead />)
  expect(screen.getByText("A NEW MYSTERY")).toBeTruthy()
  expect(screen.queryByText(/DAILY \//)).toBeNull()
})

it("uses the loaded challenge day rather than the device date", () => {
  mockGame = { ...defaultPlayerGame, id: "loaded-game", challengeId: "2026-10-18" }
  render(<PremiereMasthead />)
  expect(screen.getByText("DAILY / OCT 18")).toBeTruthy()
})

it.each(["revealing", "gameOver"])("keeps the compact brand masthead during %s", status => {
  mockStatus = status
  render(<PremiereMasthead />)
  expect(screen.getByRole("header", { name: "TALKIE TRIVIA" })).toBeTruthy()
  expect(screen.queryByText("GREAT MOVIES LIVE ON", { includeHiddenElements: true })).toBeNull()
})
