import React, { ReactElement } from "react"
import {
  render,
  screen,
  waitFor,
  fireEvent,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import HistoryDetailModal from "../../src/components/historyDetailModal"
import { useAuth } from "../../src/contexts/authContext"
import { gameService } from "../../src/services/gameService"
import { GameHistoryEntry } from "../../src/models/gameHistory"
import { defaultPlayerGame, defaultTriviaItem } from "../../src/models/default"
import { PlayerGame } from "../../src/models/game"
import { TriviaItem } from "../../src/models/trivia"

// --- Mocks ---

// 1. Mock Contexts and Services
jest.mock("../../src/contexts/authContext")
jest.mock("../../src/services/gameService")
jest.mock("../../src/components/facts", () => {
  const { View, Text } = require("react-native")
  return (props: any) => (
    <View testID="mock-facts" data-title={props.item.title}>
      <Text>Facts: {props.item.title}</Text>
    </View>
  )
})

// 2. Mock Child Components
// DetailModal is now imported directly, so we mock the module.
jest.mock("../../src/components/detailModal", () => {
  const { View, Pressable, Text } = require("react-native")
  return ({ show, toggleModal, children }: any) => {
    if (!show) return null
    return (
      <View testID="mock-detail-modal">
        <Pressable onPress={() => toggleModal(false)}>
          <Text>Close</Text>
        </Pressable>
        {children}
      </View>
    )
  }
})

// 3. Mock React.lazy for other components (Guesses)
jest.mock("react", () => {
  const React = jest.requireActual("react")
  return {
    ...React,
    lazy: (_factory: any) => {
      const LazyComponent = (props: any) => {
        const { View } = require("react-native")

        // Heuristic to identify GuessesContainer
        if (props.gameForDisplay || props.lastGuessResult !== undefined) {
          const count = props.gameForDisplay?.guesses?.length ?? 0
          return <View testID="mock-guesses" data-guesses-count={count} />
        }

        return <View testID="unknown-lazy-component" />
      }
      return LazyComponent
    },
    Suspense: ({ children }: any) => children,
  }
})

// --- Helper Types & Data ---
const mockUseAuth = useAuth as jest.Mock
const mockGameService = gameService as jest.Mocked<typeof gameService>

const mockHistoryItem: GameHistoryEntry = {
  dateId: "2023-01-01",
  itemId: 123,
  itemTitle: "Mock Movie",
  posterPath: "/mock.jpg",
  wasCorrect: true,
  gaveUp: false,
  guessCount: 3,
  guessesMax: 5,
  difficulty: "LEVEL_3",
  score: 500,
  gameMode: "movies",
}

const mockTriviaItem: TriviaItem = {
  ...defaultTriviaItem,
  id: 123,
  title: "Mock Movie Full",
  description: "A mock description",
}

const mockPlayerGame: PlayerGame = {
  ...defaultPlayerGame,
  triviaItem: mockTriviaItem,
  id: "player-1-2023-01-01",
  correctAnswer: true,
  statsProcessed: true,
  score: 500,
  challengeId: "2023-01-01",
  guesses: [
    { itemId: 1, hintInfo: [] },
    { itemId: 123, hintInfo: [] },
  ],
}

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("HistoryDetailModal Component", () => {
  const onCloseMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    // Default auth state: logged in
    mockUseAuth.mockReturnValue({ player: { id: "player-1" } })

    // Default data resolves
    mockGameService.fetchPlayerGameById.mockResolvedValue(mockPlayerGame)
  })

  describe("Visibility and Initialization", () => {
    it("should render nothing if historyItem is null", async () => {
      renderWithTheme(
        <HistoryDetailModal historyItem={null} onClose={onCloseMock} />
      )
      expect(screen.queryByTestId("mock-detail-modal")).toBeNull()
    })

    it("should render the modal but NO content if player is null (not logged in)", async () => {
      mockUseAuth.mockReturnValue({ player: null })
      renderWithTheme(
        <HistoryDetailModal
          historyItem={mockHistoryItem}
          onClose={onCloseMock}
        />
      )

      // The modal wrapper should be present because historyItem is not null
      await waitFor(() => {
        expect(screen.getByTestId("mock-detail-modal")).toBeTruthy()
      })

      // BUT the content fetching should not have triggered, so no Facts or Guesses
      expect(screen.queryByTestId("mock-facts")).toBeNull()
      expect(screen.queryByTestId("mock-guesses")).toBeNull()
    })

    it("should call services with correct IDs when mounted", async () => {
      renderWithTheme(
        <HistoryDetailModal
          historyItem={mockHistoryItem}
          onClose={onCloseMock}
        />
      )

      await waitFor(() => {
        expect(mockGameService.fetchPlayerGameById).toHaveBeenCalledWith(
          "movies_2023-01-01"
        )
      })
    })
  })

  describe("Data Loading and Display", () => {
    it("should show error message if data fetch fails", async () => {
      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {})

      mockGameService.fetchPlayerGameById.mockRejectedValueOnce(new Error("Network Error"))

      renderWithTheme(
        <HistoryDetailModal
          historyItem={mockHistoryItem}
          onClose={onCloseMock}
        />
      )

      await waitFor(() => {
        expect(screen.getByText("Could not load this result. Please try again.")).toBeTruthy()
      })

      fireEvent.press(screen.getByText("Retry"))
      expect(await screen.findByTestId("mock-facts")).toBeTruthy()
      expect(mockGameService.fetchPlayerGameById).toHaveBeenCalledTimes(2)

      consoleSpy.mockRestore()
    })

    it("should render Facts and Guesses when data loads successfully", async () => {
      mockGameService.fetchPlayerGameById.mockResolvedValue({ ...mockPlayerGame,
        triviaItem: { ...mockTriviaItem, metadata: { fullSummary: "The complete saved movie synopsis." } } })
      renderWithTheme(
        <HistoryDetailModal
          historyItem={mockHistoryItem}
          onClose={onCloseMock}
        />
      )

      // Wait for the suspense fallback to resolve and content to appear
      await waitFor(() => {
        expect(screen.getByTestId("mock-facts")).toBeTruthy()
        expect(screen.getByTestId("mock-guesses")).toBeTruthy()
      })

      // Verify props passed to children via our lazy mock attributes
      const facts = screen.getByTestId("mock-facts")
      const guesses = screen.getByTestId("mock-guesses")

      // @ts-ignore
      expect(facts.props["data-title"]).toBe("Mock Movie Full")
      // @ts-ignore
      expect(guesses.props["data-guesses-count"]).toBe(2)
      expect(screen.getByText("The complete saved movie synopsis.")).toBeTruthy()
      expect(screen.queryByText("A mock description")).toBeNull()
    })
  })

  describe("Interaction", () => {
    it("should call onClose when DetailModal close is triggered", async () => {
      renderWithTheme(
        <HistoryDetailModal
          historyItem={mockHistoryItem}
          onClose={onCloseMock}
        />
      )

      // Wait for modal to appear
      await waitFor(() => screen.getByTestId("mock-detail-modal"))

      // Mock DetailModal renders a "Close" text inside a Pressable that calls toggleModal(false)
      fireEvent.press(screen.getByText("Close"))

      expect(onCloseMock).toHaveBeenCalledTimes(1)
    })
  })
})
