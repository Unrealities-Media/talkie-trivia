import React, { ReactElement } from "react"
import { render, screen, RenderOptions } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import PlayerStatsContainer from "../../src/components/playerStats"
import { defaultPlayerStats } from "../../src/models/default"
import PlayerStats from "../../src/models/playerStats"

// --- Mocks ---

// Mock WinChart to avoid complex SVG/Victory rendering
jest.mock("../../src/components/winChart", () => {
  const { View } = require("react-native")
  return (props: any) => (
    <View testID="mock-win-chart" data-wins={JSON.stringify(props.wins)} />
  )
})

// Mock StatItem to verify props passed
jest.mock("../../src/components/statItem", () => {
  const { Text, View } = require("react-native")
  return (props: any) => (
    <View testID={`stat-item-${props.label}`}>
      <Text>
        {props.label}: {props.value}
      </Text>
    </View>
  )
})

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

// --- Mock Data ---
const mockPlayer = { id: "player-1", name: "Test Player" }
const mockStats: PlayerStats = {
  ...defaultPlayerStats,
  games: 10,
  currentStreak: 3,
  maxStreak: 5,
  hintsAvailable: 2,
  allTimeScore: 1250,
  wins: [1, 2, 3, 0, 4], // Distribution array
}

describe("PlayerStatsContainer Component", () => {
  describe("Empty State", () => {
    it("should render 'No statistics available' if player is null", () => {
      renderWithTheme(
        <PlayerStatsContainer player={null} playerStats={mockStats} />
      )
      expect(screen.getByText("No statistics available.")).toBeTruthy()
    })

    it("should render 'No statistics available' if playerStats is null", () => {
      renderWithTheme(
        <PlayerStatsContainer player={mockPlayer} playerStats={null} />
      )
      expect(screen.getByText("No statistics available.")).toBeTruthy()
    })
  })

  describe("Data Rendering", () => {
    it("should render the WinChart with correct data", () => {
      renderWithTheme(
        <PlayerStatsContainer player={mockPlayer} playerStats={mockStats} />
      )

      const chart = screen.getByTestId("mock-win-chart")
      expect(chart).toBeTruthy()
      // Verify props passed to chart
      // @ts-ignore
      expect(JSON.parse(chart.props["data-wins"])).toEqual(mockStats.wins)
    })

    it("should render all stat items with correct values", () => {
      renderWithTheme(
        <PlayerStatsContainer player={mockPlayer} playerStats={mockStats} />
      )

      // All-Time Score
      expect(screen.getByText("All-Time Score: 1,250")).toBeTruthy()

      // Games Played
      expect(screen.getByText("Challenges completed: 10")).toBeTruthy()

      // Current Streak
      expect(screen.getByText("Current Streak: 3")).toBeTruthy()

      // Max Streak
      expect(screen.getByText("Max Streak: 5")).toBeTruthy()

      // Hints Available
      expect(screen.queryByText(/Hints Available/)).toBeNull()
      expect(screen.getByText(/Each Easy challenge includes three optional hints/)).toBeTruthy()
    })

    it("should format large score numbers with commas", () => {
      const largeStats = { ...mockStats, allTimeScore: 1000000 }
      renderWithTheme(
        <PlayerStatsContainer player={mockPlayer} playerStats={largeStats} />
      )

      expect(screen.getByText("All-Time Score: 1,000,000")).toBeTruthy()
    })
  })
})
