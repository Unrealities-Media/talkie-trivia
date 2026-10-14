// __tests__/gameplayContainer.test.tsx

import React, { ReactElement } from "react"
import {
  render,
  screen,
  cleanup,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import GameplayContainer from "../../src/components/gameplayContainer"
import { useGameStore } from "../../src/state/gameStore"
import { GameStatus, GameState } from "../../src/state/gameStore"

// --- Mocking Dependencies ---
jest.mock("../../src/components/clues", () => {
  const { View } = require("react-native")
  return () => <View testID="mock-clues" />
})
jest.mock("../../src/components/gameplayView", () => {
  const { View } = require("react-native")
  return ({ children }: { children: React.ReactNode }) => <View testID="mock-gameplay-view">{children}</View>
})
jest.mock("../../src/components/gameOverView", () => {
  const { View } = require("react-native")
  return () => <View testID="mock-game-over-view" />
})
jest.mock("../../src/components/guesses", () => {
  const { View } = require("react-native")
  return () => <View testID="mock-guesses" />
})
jest.mock("../../src/components/revealSequence", () => {
  const { View } = require("react-native")
  return (props: { onAnimationComplete: () => void }) => (
    <View
      testID="mock-reveal-sequence"
      onAnimationComplete={props.onAnimationComplete}
    />
  )
})
jest.mock("../../src/state/gameStore")

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

// FIX: Use 'as unknown as jest.Mock' to satisfy TypeScript
const mockUseGameStore = useGameStore as unknown as jest.Mock
const mockCompleteRevealSequence = jest.fn()

const setMockStoreState = (gameStatus: GameStatus) => {
  const mockState: Partial<GameState> = {
    gameStatus,
    playerGame: { guesses: [] } as any,
    lastGuessResult: null,
    completeRevealSequence: mockCompleteRevealSequence,
  }

  mockUseGameStore.mockImplementation((selector: (state: any) => any) => {
    return selector(mockState)
  })
}

describe("GameplayContainer Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(cleanup)

  describe('when gameStatus is "playing"', () => {
    it("should render the core gameplay components", () => {
      setMockStoreState("playing")
      renderWithTheme(<GameplayContainer />)
      expect(screen.getByTestId("mock-clues")).toBeTruthy()
      expect(screen.getByTestId("mock-gameplay-view")).toBeTruthy()
      expect(screen.getByTestId("mock-guesses")).toBeTruthy()
    })
  })

  describe('when gameStatus is "gameOver"', () => {
    it("should render the GameOverView component and not the gameplay components", () => {
      setMockStoreState("gameOver")
      renderWithTheme(<GameplayContainer />)
      expect(screen.getByTestId("mock-game-over-view")).toBeTruthy()
      expect(screen.queryByTestId("mock-clues")).toBeNull()
      expect(screen.queryByTestId("mock-gameplay-view")).toBeNull()
    })
  })

  describe('when gameStatus is "revealing"', () => {
    it("prepares the completed result beneath the reveal for a seamless handoff", () => {
      setMockStoreState("revealing")
      renderWithTheme(<GameplayContainer />)
      expect(screen.queryByTestId("mock-clues")).toBeNull()
      expect(screen.getByTestId("mock-game-over-view")).toBeTruthy()
      expect(screen.getByTestId("mock-reveal-sequence")).toBeTruthy()
    })

    it("should call completeRevealSequence when the animation completes", () => {
      setMockStoreState("revealing")
      renderWithTheme(<GameplayContainer />)
      const revealSequence = screen.getByTestId("mock-reveal-sequence")
      revealSequence.props.onAnimationComplete()
      expect(mockCompleteRevealSequence).toHaveBeenCalledTimes(1)
    })
  })
})
