import React, { ReactElement } from "react"
import { render, screen, RenderOptions } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import GuessesContainer from "../../src/components/guesses"
import { useGameStore } from "../../src/state/gameStore"
import { defaultPlayerGame } from "../../src/models/default"
import { PlayerGame } from "../../src/models/game"

// --- Mocks ---

// 1. Mock the child components to render standard Views with test data attributes
jest.mock("../../src/components/guess/guessRow", () => {
  const { View } = require("react-native")
  return {
    GuessRow: jest.fn(({ index, isLastGuess, guess }) => (
      <View
        testID={`guess-row-${index}`}
        // @ts-ignore - Custom data prop for testing verification
        data-is-last={isLastGuess}
        // @ts-ignore - Custom data prop for testing verification
        data-item-id={guess.itemId}
      />
    )),
  }
})

jest.mock("../../src/components/guess/emptyGuessTile", () => {
  const { View } = require("react-native")
  return {
    EmptyGuessTile: jest.fn(({ index }) => (
      <View testID={`empty-tile-${index}`} />
    )),
  }
})

jest.mock("../../src/components/guess/skeletonRow", () => {
  const { View } = require("react-native")
  return {
    SkeletonRow: jest.fn(({ index }) => (
      <View testID={`skeleton-row-${index}`} />
    )),
  }
})

// 3. Mock the Game Store
jest.mock("../../src/state/gameStore")
const mockUseGameStore = useGameStore as unknown as jest.Mock

// --- Helper Data ---
const mockBasicItems = [
  { id: 101, title: "Movie A", releaseDate: "2000", posterPath: "/a.jpg" },
  { id: 102, title: "Movie B", releaseDate: "2001", posterPath: "/b.jpg" },
]

const mockPlayerGame: PlayerGame = {
  ...defaultPlayerGame,
  id: "game-1",
  guessesMax: 5,
  triviaItem: { ...defaultPlayerGame.triviaItem, id: 100 }, // Correct answer ID is 100
  guesses: [
    { itemId: 101, hintInfo: [] }, // Wrong guess 1
    { itemId: 102, hintInfo: [] }, // Wrong guess 2
  ],
}

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

const setMockStoreState = (state: any) => {
  mockUseGameStore.mockImplementation((selector: any) => selector(state))
}

describe("GuessesContainer Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Loading States", () => {
    it("should render SkeletonRows when global state is loading and no display game is provided", () => {
      setMockStoreState({
        loading: true,
        playerGame: defaultPlayerGame,
        basicItems: [],
      })

      renderWithTheme(<GuessesContainer lastGuessResult={null} />)

      // Should render skeletons up to guessesMax (default 5)
      const skeletons = screen.getAllByTestId(/skeleton-row-/)
      expect(skeletons).toHaveLength(5)
      expect(screen.queryByTestId(/guess-row-/)).toBeNull()
    })

    it("should NOT render skeletons if gameForDisplay is provided, even if global loading is true", () => {
      // This simulates the Profile -> History Detail view where data is passed in directly
      setMockStoreState({
        loading: true, // Global loading is true (maybe background sync)
        playerGame: defaultPlayerGame,
      })

      renderWithTheme(
        <GuessesContainer
          lastGuessResult={null}
          gameForDisplay={mockPlayerGame} // Explicit data passed
          allItemsForDisplay={mockBasicItems}
        />
      )

      // Should use the data from props, not show skeletons
      expect(screen.queryByTestId(/skeleton-row-/)).toBeNull()
      expect(screen.getAllByTestId(/guess-row-/)).toHaveLength(2)
    })
  })

  describe("Active Gameplay Rendering", () => {
    beforeEach(() => {
      setMockStoreState({
        loading: false,
        playerGame: mockPlayerGame,
        basicItems: mockBasicItems,
      })
    })

    it("should render a mix of GuessRows and EmptyGuessTiles based on current progress", () => {
      renderWithTheme(<GuessesContainer lastGuessResult={null} />)

      // Mock game has 2 guesses out of 5 max
      const guesses = screen.getAllByTestId(/guess-row-/)
      const empties = screen.getAllByTestId(/empty-tile-/)

      expect(guesses).toHaveLength(2)
      expect(empties).toHaveLength(3) // 5 max - 2 used = 3 empty
    })

    it("should pass correct props to GuessRow components", () => {
      renderWithTheme(<GuessesContainer lastGuessResult={null} />)

      const firstGuess = screen.getByTestId("guess-row-0")
      expect(firstGuess.props["data-item-id"]).toBe(101)
    })

    it("should identify the last guess correctly when lastGuessResult matches", () => {
      const lastGuessResult = {
        itemId: 102, // Matches the second guess in mockPlayerGame
        correct: false,
        feedback: "Wrong",
      }

      renderWithTheme(<GuessesContainer lastGuessResult={lastGuessResult} />)

      const firstGuess = screen.getByTestId("guess-row-0")
      const secondGuess = screen.getByTestId("guess-row-1")

      // The first guess is NOT the last one made
      expect(firstGuess.props["data-is-last"]).toBe(false)

      // The second guess IS the last one made
      expect(secondGuess.props["data-is-last"]).toBe(true)
    })

    it("should NOT mark a row as last guess if the IDs do not match", () => {
      // This edge case happens if state desyncs slightly or during resets
      const mismatchResult = {
        itemId: 999, // Doesn't match any guess in the list
        correct: false,
      }

      renderWithTheme(<GuessesContainer lastGuessResult={mismatchResult} />)

      const secondGuess = screen.getByTestId("guess-row-1")
      expect(secondGuess.props["data-is-last"]).toBe(false)
    })
  })

  describe("Profile/History View Rendering", () => {
    it("shows only submitted guesses after a win, including when viewing a saved game", () => {
      setMockStoreState({ loading: true, playerGame: defaultPlayerGame })
      renderWithTheme(<GuessesContainer lastGuessResult={null}
        gameForDisplay={{ ...mockPlayerGame, correctAnswer: true }} allItemsForDisplay={mockBasicItems} />)
      expect(screen.getAllByTestId(/guess-row-/)).toHaveLength(2)
      expect(screen.queryByTestId(/empty-tile-/)).toBeNull()
      expect(screen.queryByTestId(/skeleton-row-/)).toBeNull()
    })

    it("does not show unused guess slots after giving up without a guess", () => {
      setMockStoreState({ loading: false, playerGame: { ...mockPlayerGame, gaveUp: true, guesses: [] }, basicItems: [] })
      renderWithTheme(<GuessesContainer lastGuessResult={null} />)
      expect(screen.queryByTestId(/guess-row-/)).toBeNull()
      expect(screen.queryByTestId(/empty-tile-/)).toBeNull()
    })

    it("should render correctly using passed props (gameForDisplay)", () => {
      const historicGame: PlayerGame = {
        ...mockPlayerGame,
        guesses: [{ itemId: 101, hintInfo: [] }], // Only 1 guess
        guessesMax: 3, // Custom max for this specific game
      }

      // Global store might be empty or different
      setMockStoreState({
        loading: false,
        playerGame: defaultPlayerGame,
      })

      renderWithTheme(
        <GuessesContainer
          lastGuessResult={null}
          gameForDisplay={historicGame}
          allItemsForDisplay={mockBasicItems}
        />
      )

      // Should respect the props: 1 guess, 2 empties (total 3)
      expect(screen.getAllByTestId(/guess-row-/)).toHaveLength(1)
      expect(screen.getAllByTestId(/empty-tile-/)).toHaveLength(2)
    })
  })

  describe("Layout and Styling", () => {
    it("renders all available slots for an unfinished game", () => {
      setMockStoreState({
        loading: false,
        playerGame: { ...mockPlayerGame, guessesMax: 10 }, // 10 max guesses
        basicItems: [],
      })

      renderWithTheme(<GuessesContainer lastGuessResult={null} />)

      // We verify that the list renders 10 slots total (guesses + empty tiles).
      const totalSlots =
        screen.queryAllByTestId(/guess-row-/).length +
        screen.queryAllByTestId(/empty-tile-/).length
      expect(totalSlots).toBe(10)
    })
  })
})
