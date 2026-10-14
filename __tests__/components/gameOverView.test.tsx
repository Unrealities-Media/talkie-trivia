// __tests__/gameOverView.test.tsx

import React, { ReactElement } from "react"
import {
  render,
  screen,
  cleanupAsync,
  act,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import GameOverView from "../../src/components/gameOverView"
import { defaultPlayerGame } from "../../src/models/default"
import { PlayerGame } from "../../src/models/game"

// --- Mocking Child Components ---
// FIX: require dependencies inside the mock factory to avoid out-of-scope errors.
jest.mock("../../src/components/facts", () => {
  const { View } = require("react-native")
  return (props: { item: any }) => (
    <View testID="mock-facts" data-itemid={props.item.id} />
  )
})
jest.mock("../../src/components/gameOver/fullPlotSection", () => {
  const { View } = require("react-native")
  return (props: { overview: string }) => (
    <View testID="mock-full-plot" data-overview={props.overview} />
  )
})
jest.mock("../../src/components/guesses", () => {
  const { View } = require("react-native")
  return (props: { lastGuessResult: any }) => (
    <View
      testID="mock-guesses"
      data-lastguess={props.lastGuessResult?.itemId}
    />
  )
})
jest.mock("../../src/components/gameOver/shareResultButton", () => {
  const { View } = require("react-native")
  return (props: { playerGame: any }) => (
    <View testID="mock-share-button" data-gameid={props.playerGame.id} />
  )
})
jest.mock("../../src/components/personalizedStatsMessage", () => {
  const { View } = require("react-native")
  return () => <View testID="mock-stats-message" />
})
jest.mock("../../src/components/countdownTimer", () => {
  const { View } = require("react-native")
  return () => <View testID="mock-countdown-timer" />
})

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

// Mock data for different game outcomes
const mockPlayerGameWin: PlayerGame = {
  ...defaultPlayerGame,
  id: "win-game-1",
  correctAnswer: true,
  score: 423,
  statsProcessed: true,
  challengeId: "2026-10-13",
  guesses: [{ itemId: 1 }, { itemId: 2 }],
  triviaItem: {
    ...defaultPlayerGame.triviaItem,
    id: 123,
    description: "The winning plot.",
  },
}

const mockPlayerGameLoss: PlayerGame = {
  ...defaultPlayerGame,
  id: "loss-game-1",
  correctAnswer: false,
  gaveUp: false,
  guesses: [{ itemId: 1 }, { itemId: 2 }, { itemId: 3 }],
  guessesMax: 3,
  triviaItem: {
    ...defaultPlayerGame.triviaItem,
    id: 456,
    description: "The losing plot.",
  },
}

const mockPlayerGameGiveUp: PlayerGame = {
  ...defaultPlayerGame,
  id: "giveup-game-1",
  correctAnswer: false,
  gaveUp: true,
  guesses: [{ itemId: 1 }],
  triviaItem: {
    ...defaultPlayerGame.triviaItem,
    id: 789,
    description: "The give-up plot.",
  },
}

const mockLastGuess = { itemId: 2, correct: true }

describe("GameOverView Component", () => {
  beforeEach(() => jest.useFakeTimers())

  afterEach(async () => {
    // Flush the cancelled animation's queued frame before Jest tears down.
    try {
      await cleanupAsync()
      await act(async () => {
        await jest.runOnlyPendingTimersAsync()
      })
    } finally {
      jest.useRealTimers()
    }
  })

  describe("Win Scenario", () => {
    beforeEach(() => {
      renderWithTheme(
        <GameOverView
          playerGame={mockPlayerGameWin}
          lastGuessResult={mockLastGuess}
        />
      )
    })

    it("should display the win title and message", () => {
      expect(screen.getByText("You Got It!")).toBeTruthy()
      expect(screen.getByText("You guessed it in 2 guesses!")).toBeTruthy()
      expect(screen.getByText("Saved score: 423 points")).toBeTruthy()
      expect(screen.getByText("2026-10-13 (UTC day)")).toBeTruthy()
    })

    it("should render all child components", () => {
      expect(screen.getByTestId("mock-facts")).toBeTruthy()
      expect(screen.getByTestId("mock-full-plot")).toBeTruthy()
      expect(screen.getByTestId("mock-guesses")).toBeTruthy()
      expect(screen.getByTestId("mock-share-button")).toBeTruthy()
      expect(screen.getByTestId("mock-stats-message")).toBeTruthy()
      expect(screen.getByTestId("mock-countdown-timer")).toBeTruthy()
    })

    it("should pass the correct props to child components", () => {
      expect(screen.getByTestId("mock-facts").props["data-itemid"]).toBe(
        mockPlayerGameWin.triviaItem.id
      )
      expect(screen.getByTestId("mock-full-plot").props["data-overview"]).toBe(
        mockPlayerGameWin.triviaItem.description
      )
      expect(screen.getByTestId("mock-guesses").props["data-lastguess"]).toBe(
        mockLastGuess.itemId
      )
      expect(screen.getByTestId("mock-share-button").props["data-gameid"]).toBe(
        mockPlayerGameWin.id
      )
    })
  })

  describe("Loss Scenario", () => {
    it("should display the loss title and message", () => {
      renderWithTheme(
        <GameOverView playerGame={mockPlayerGameLoss} lastGuessResult={null} />
      )
      expect(screen.getByText("Out of guesses")).toBeTruthy()
      expect(screen.getByText("You used all 3 guesses. Here's today's movie.")).toBeTruthy()
    })
  })

  describe("Give Up Scenario", () => {
    it("should display the give up title and message", () => {
      renderWithTheme(
        <GameOverView
          playerGame={mockPlayerGameGiveUp}
          lastGuessResult={null}
        />
      )
      expect(screen.getByText("Answer revealed")).toBeTruthy()
      expect(
        screen.getByText("You ended this game after 1 guess.")
      ).toBeTruthy()
    })
  })
})
