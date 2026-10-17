import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import AccountStats from "../../src/components/accountStats"
import { gameService } from "../../src/services/gameService"
import { ThemeProvider } from "../../src/contexts/themeContext"
jest.mock("../../src/utils/hooks/usePremiereMotion", () => ({ usePremiereMotion: () => true }))
jest.mock("../../src/services/gameService", () => ({ gameService: { fetchPlayerStats: jest.fn() } }))
jest.mock("../../src/state/gameStore", () => ({ useGameStore: (select: any) => select({ playerStats: null, error: "Today's content unavailable", loading: true }) }))
jest.mock("../../src/components/playerStats", () => {
  const { Text } = require("react-native")
  return ({ playerStats }: any) => <Text>Saved games: {playerStats.games}</Text>
})
const view = (id = "p1") => <ThemeProvider><AccountStats player={{ id, name: "Player" }} /></ThemeProvider>
describe("statistics independent of daily content", () => {
  beforeEach(() => jest.clearAllMocks())
  it("summarizes all wins while keeping the full breakdown off the dashboard", async () => {
    ;(gameService.fetchPlayerStats as jest.Mock).mockResolvedValue({ games: 4, wins: [1, 1, 1, 0, 0], allTimeScore: 1650, currentStreak: 1 })
    render(<ThemeProvider><AccountStats player={{ id: "p1", name: "Player" }} compact /></ThemeProvider>)
    await screen.findByText("1,650")
    expect(screen.getByText("3 / 4")).toBeTruthy()
    expect(screen.getByText("1 day")).toBeTruthy()
    expect(screen.queryByText("Saved games: 4")).toBeNull()
  })
  it("refreshes at the server's UTC midnight without requiring a game action", async () => {
    jest.useFakeTimers()
    try {
      ;(gameService.fetchPlayerStats as jest.Mock).mockResolvedValueOnce({ games: 1, serverNow: "2026-10-14T23:59:59Z" }).mockResolvedValueOnce({ games: 1, serverNow: "2026-10-15T00:00:00Z" })
      const mounted = render(view())
      await act(async () => {})
      await act(async () => { jest.advanceTimersByTime(1100) })
      expect(gameService.fetchPlayerStats).toHaveBeenCalledTimes(2)
      mounted.unmount()
    } finally { jest.useRealTimers() }
  })
  it("reads account stats even when today's challenge is loading or unavailable", async () => {
    ;(gameService.fetchPlayerStats as jest.Mock).mockResolvedValue({ games: 18 })
    render(view())
    await waitFor(() => screen.getByText("Saved games: 18"))
    expect(gameService.fetchPlayerStats).toHaveBeenCalledWith("p1")
  })
  it("offers a working Retry for a failed statistics read", async () => {
    ;(gameService.fetchPlayerStats as jest.Mock).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ games: 9 })
    render(view())
    await waitFor(() => screen.getByText("Could not load your statistics."))
    fireEvent.press(screen.getByText("Retry"))
    await waitFor(() => screen.getByText("Saved games: 9"))
  })
  it("does not show a previous account's late response", async () => {
    let finish!: (value: unknown) => void
    ;(gameService.fetchPlayerStats as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValueOnce({ games: 2 })
    const { rerender } = render(view())
    rerender(view("p2"))
    await waitFor(() => screen.getByText("Saved games: 2"))
    await act(async () => finish({ games: 18 }))
    expect(screen.queryByText("Saved games: 18")).toBeNull()
  })
  it("distinguishes missing statistics from a confirmed zero score", async () => {
    ;(gameService.fetchPlayerStats as jest.Mock).mockResolvedValue(null)
    render(view())
    await waitFor(() => screen.getByText("No saved statistics yet."))
    expect(screen.queryByText("Saved games: 0")).toBeNull()
  })
})
