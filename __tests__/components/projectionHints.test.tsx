import React from "react"
import { render, screen } from "@testing-library/react-native"
import ProjectionHints from "../../src/components/projectionHints"
import { useGameStore } from "../../src/state/gameStore"
import { defaultPlayerGame } from "../../src/models/default"

jest.mock("../../src/state/gameStore")
const game = {
  ...defaultPlayerGame,
  triviaItem: { ...defaultPlayerGame.triviaItem, hints: [
    { type: "genre", label: "Genre", value: "Sci-Fi" },
    { type: "decade", label: "Decade", value: "2010s" },
  ] },
}
function setup(difficulty: string, hintsUsed = {}) {
  jest.mocked(useGameStore).mockImplementation((selector: any) => selector({ difficulty, playerGame: { ...game, hintsUsed } }))
  render(<ProjectionHints />)
}
it("does not expose unrevealed categories from the full movie", () => {
  setup("LEVEL_2")
  expect(screen.queryByText("Sci-Fi")).toBeNull()
  expect(screen.queryByText("2010s")).toBeNull()
})
it("shows only the purchased or earned category", () => {
  setup("LEVEL_3", { genre: true })
  expect(screen.getByText("Sci-Fi")).toBeTruthy()
  expect(screen.queryByText("2010s")).toBeNull()
})
it("reveals basic-mode categories without a purchase", () => {
  setup("LEVEL_1")
  expect(screen.getByText("Sci-Fi")).toBeTruthy()
  expect(screen.getByText("2010s")).toBeTruthy()
})
it.each(["LEVEL_4", "LEVEL_5"])("never shows category hints in %s", difficulty => {
  setup(difficulty, { genre: true, decade: true })
  expect(screen.queryByText("Sci-Fi")).toBeNull()
  expect(screen.queryByText("2010s")).toBeNull()
})
