import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"
import { router } from "expo-router"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { useAuth } from "../../../src/contexts/authContext"
import { useGameStore } from "../../../src/state/gameStore"
import ProfileScreen from "../../../src/app/(tabs)/profile"

jest.mock("expo-router", () => ({ router: { push: jest.fn(), navigate: jest.fn() } }))
jest.mock("../../../src/contexts/authContext")
jest.mock("../../../src/state/gameStore")
jest.mock("../../../src/components/accountStats", () => () => null)
jest.mock("../../../src/components/profileHistory", () => () => null)
jest.mock("../../../src/components/detailModal", () => ({ show, children }: any) => show ? children : null)

let state: any
beforeEach(() => {
  jest.clearAllMocks()
  ;(useAuth as jest.Mock).mockReturnValue({ player: { id: "p1", name: "Guest" }, user: { uid: "p1", isAnonymous: true } })
  state = { dailyChallenges: { LEVEL_1: "Won", LEVEL_2: "Lost", LEVEL_3: "Won", LEVEL_4: "Not started", LEVEL_5: "Not started" }, challengeDate: "2026-10-19", playerGame: { playerID: "p1" }, resetDeadline: performance.now() + 60000, syncStatus: "idle", setDifficulty: jest.fn(), initializeGame: jest.fn() }
  ;(useGameStore as unknown as jest.Mock).mockImplementation(select => select(state))
})
const view = () => render(<ThemeProvider><ProfileScreen /></ThemeProvider>)

it("routes full statistics, settings, and movie history to their own screens", () => {
  view()
  fireEvent.press(screen.getByText("Settings"))
  expect(router.push).toHaveBeenLastCalledWith("/profile/settings")
  fireEvent.press(screen.getByText("All stats ↗"))
  expect(router.push).toHaveBeenLastCalledWith("/profile/statistics")
  fireEvent.press(screen.getByText("View all movies"))
  expect(router.push).toHaveBeenLastCalledWith("/profile/history")
})
it("counts losses as completed and starts the selected next challenge", () => {
  view()
  expect(screen.getByText("3 of 5 complete")).toBeTruthy()
  fireEvent.press(screen.getByText("Choose your next challenge →"))
  fireEvent.press(screen.getByText("Hard · Not started"))
  expect(state.setDifficulty).toHaveBeenCalledWith("LEVEL_4")
  expect(router.navigate).toHaveBeenCalledWith("/game")
})
it.each(["account", "partial", "expired", "unavailable"])("does not present stale or incomplete daily progress: %s", reason => {
  if (reason === "account") state.playerGame.playerID = "other"
  if (reason === "partial") delete state.dailyChallenges.LEVEL_5
  if (reason === "expired") state.resetDeadline = 0
  if (reason === "unavailable") state.error = "Unavailable"
  view()
  expect(screen.getByText("Progress unavailable")).toBeTruthy()
  expect(screen.queryByText("3 of 5 complete")).toBeNull()
  expect(screen.getByText("View all movies")).toBeTruthy()
})
it("routes pending saves to Play instead of switching difficulties", () => {
  state.syncStatus = "pending"
  view()
  fireEvent.press(screen.getByText("Open Play →"))
  expect(router.navigate).toHaveBeenCalledWith("/game")
  expect(state.setDifficulty).not.toHaveBeenCalled()
})
