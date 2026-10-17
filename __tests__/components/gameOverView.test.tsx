import React from "react"
import { act, render as renderComponent, screen, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import GameOverView from "../../src/components/gameOverView"
import { defaultPlayerGame } from "../../src/models/default"
import { useGameStore } from "../../src/state/gameStore"
const render = (ui: React.ReactElement) => renderComponent(<ThemeProvider>{ui}</ThemeProvider>)

// Content checks read final values; the count-up itself is covered in useCountUp tests.
jest.mock("../../src/utils/hooks/usePremiereMotion", () => ({ usePremiereMotion: () => true }))
jest.mock("../../src/utils/hooks/useExternalLink", () => ({ useExternalLink: () => ({ openLink: jest.fn() }) }))
jest.mock("../../src/components/countdownTimer", () => () => null)
jest.mock("../../src/components/nextChallenge", () => () => null)
jest.mock("../../src/components/gameOver/shareResultButton", () => () => null)
jest.mock("../../src/components/guesses", () => {
  const { Text } = require("react-native")
  return () => <Text>Guess history content</Text>
})
const game = {
  ...defaultPlayerGame, id: "finished", difficulty: "LEVEL_3" as const,
  correctAnswer: true, score: 423, statsProcessed: true,
  guesses: [{ itemId: 1 }, { itemId: 2 }],
  triviaItem: { ...defaultPlayerGame.triviaItem, title: "The Matrix", description: "A complete movie clue.", releaseDate: "1999-03-31",
    hints: [{ type: "director", label: "Director", value: "The Wachowskis" }, { type: "actors", label: "Actors", value: [{ name: "Keanu Reeves" }] }] },
}
describe("Movie celebration", () => {
  it("shows the saved score, outcome and available movie details once", () => {
    render(<GameOverView playerGame={game} lastGuessResult={null} />)
    for (const text of ["The Matrix", "That's a wrap!", "Solved in 2 guesses · Medium", "423", "POINTS EARNED", "The Wachowskis", "Keanu Reeves", "A complete movie clue."]) {
      expect(screen.getByText(text)).toBeTruthy()
    }
    expect(screen.queryByText("Guess history content")).toBeNull()
    fireEvent.press(screen.getByRole("button", { name: /View your guesses/ }))
    expect(screen.getByText("Guess history content")).toBeTruthy()
    fireEvent.press(screen.getByRole("button", { name: /Hide your guesses/ }))
    expect(screen.queryByText("Guess history content")).toBeNull()
  })
  it.each([
    [true, "Answer revealed", "Revealed after 2 guesses"],
    [false, "Out of guesses", "2 guesses used"],
  ])("describes a non-winning result accurately", (gaveUp, title, message) => {
    render(<GameOverView playerGame={{ ...game, correctAnswer: false, gaveUp: gaveUp as boolean, guessesMax: 2, score: 0 }} lastGuessResult={null} />)
    expect(screen.getByText(title as string)).toBeTruthy()
    expect(screen.getByText(`${message} · Medium`)).toBeTruthy()
    expect(screen.getByText("0")).toBeTruthy()
  })
  it("lights the streak marquee only for a confirmed result with an active streak", () => {
    useGameStore.setState({ playerStats: { ...useGameStore.getState().playerStats, currentStreak: 4 } })
    const view = render(<GameOverView playerGame={game} lastGuessResult={null} />)
    expect(screen.getByLabelText("4 day streak. Every challenge you finish keeps it alive, win or lose.")).toBeTruthy()
    expect(screen.getByLabelText("2 of 5 guesses used")).toBeTruthy()
    view.rerender(<ThemeProvider><GameOverView playerGame={{ ...game, id: "unconfirmed", statsProcessed: false }} lastGuessResult={null} /></ThemeProvider>)
    expect(screen.queryByText("Days in a row")).toBeNull()
    act(() => useGameStore.setState({ playerStats: { ...useGameStore.getState().playerStats, currentStreak: 0 } }))
  })
  it("does not invent a saved score before confirmation", () => {
    render(<GameOverView playerGame={{ ...game, statsProcessed: false }} lastGuessResult={null} />)
    expect(screen.getByText("Score unavailable")).toBeTruthy()
    expect(screen.queryByText("423")).toBeNull()
  })
  it("resets expanded guess history for another result", () => {
    const view = render(<GameOverView playerGame={game} lastGuessResult={null} />)
    fireEvent.press(screen.getByRole("button", { name: /View your guesses/ }))
    expect(screen.getByText("Guess history content")).toBeTruthy()
    view.rerender(<ThemeProvider><GameOverView playerGame={{ ...game, id: "other-result" }} lastGuessResult={null} /></ThemeProvider>)
    expect(screen.queryByText("Guess history content")).toBeNull()
  })
  it("shows the full saved synopsis instead of the difficulty clue", () => {
    render(<GameOverView playerGame={{ ...game, triviaItem: { ...game.triviaItem, metadata: { fullSummary: "The complete published synopsis." } } }} lastGuessResult={null} />)
    expect(screen.getByText("The complete published synopsis.")).toBeTruthy()
    expect(screen.queryByText("A complete movie clue.")).toBeNull()
  })
  it("falls back from a failed backdrop to the poster, then to local artwork", () => {
    render(<GameOverView playerGame={{ ...game, triviaItem: { ...game.triviaItem, posterPath: "/poster.jpg", metadata: { backdrop_path: "/backdrop.jpg" } } }} lastGuessResult={null} />)
    expect(screen.getByTestId("reward-backdrop").props.source.uri).toContain("/backdrop.jpg")
    fireEvent(screen.getByTestId("reward-backdrop"), "error")
    expect(screen.getByTestId("reward-backdrop").props.source.uri).toContain("/poster.jpg")
    fireEvent(screen.getByTestId("reward-poster"), "error")
    expect(screen.getByTestId("reward-backdrop").props.source.uri).toBeUndefined()
    expect(screen.getByTestId("reward-poster").props.source.uri).toBeUndefined()
  })
})
