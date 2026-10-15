import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import SeatHints from "../../src/components/seatHints"
import { useGameStore } from "../../src/state/gameStore"
import { useHintLogic } from "../../src/utils/hooks/useHintLogic"
import { defaultPlayerGame } from "../../src/models/default"

jest.mock("../../src/state/gameStore")
jest.mock("../../src/utils/hooks/useHintLogic")
const select = jest.fn()
const values: Record<string, string> = { genre: "Comedy", decade: "1980s", director: "Ivan Reitman", actors: "Bill Murray" }
let state: any
beforeEach(() => {
  select.mockClear()
  state = { difficulty: "LEVEL_2", playerGame: { ...defaultPlayerGame, id: "test", hintsUsed: {} }, playerStats: { hintsAvailable: 3 } }
  jest.mocked(useGameStore).mockImplementation((selector: any) => selector(state))
  jest.mocked(useHintLogic).mockReturnValue({ getHintText: (type: string) => values[type], hintStatuses: { genre: "available", decade: "available", director: "available", actors: "available" }, handleHintSelection: select } as any)
})
it("does not disclose concealed hint values before server confirmation", () => {
  const { rerender } = render(<ThemeProvider><SeatHints /></ThemeProvider>)
  fireEvent.press(screen.getByRole("button", { name: "Director: Reveal · −50 pts" }))
  expect(select).toHaveBeenCalledWith("director")
  expect(screen.queryByText("Ivan Reitman")).toBeNull()
  state.playerGame.hintsUsed = { director: true }
  rerender(<ThemeProvider><SeatHints /></ThemeProvider>)
  expect(screen.getByText("Ivan Reitman")).toBeTruthy()
  expect(screen.queryByText("Bill Murray")).toBeNull()
})
it.each(["LEVEL_4", "LEVEL_5"])("omits inactive seats in %s even if stale hints exist", difficulty => {
  state.difficulty = difficulty
  state.playerGame.hintsUsed = { director: true }
  render(<ThemeProvider><SeatHints /></ThemeProvider>)
  expect(screen.queryByText("Reserved")).toBeNull()
  expect(screen.queryByText("Ivan Reitman")).toBeNull()
  expect(screen.queryAllByRole("button")).toHaveLength(0)
})
it("shows every Very Easy hint", () => {
  state.difficulty = "LEVEL_1"
  render(<ThemeProvider><SeatHints /></ThemeProvider>)
  Object.values(values).forEach(value => expect(screen.getByText(value)).toBeTruthy())
})
it("shows only earned Medium hints with no purchase buttons", () => {
  state.difficulty = "LEVEL_3"
  state.playerGame.hintsUsed = { actors: true }
  render(<ThemeProvider><SeatHints /></ThemeProvider>)
  expect(screen.getByText("Bill Murray")).toBeTruthy()
  expect(screen.queryByText("Ivan Reitman")).toBeNull()
  expect(screen.queryAllByRole("button")).toHaveLength(0)
})
