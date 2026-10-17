import React from "react"
import { Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import PremiereStage from "../../src/components/premiereStage"
import ShareResultButton from "../../src/components/gameOver/shareResultButton"
import GameOverView from "../../src/components/gameOverView"
import { DailySlate, ProgressRing } from "../../src/components/profileSlate"
import WinChart from "../../src/components/winChart"
import { defaultPlayerGame } from "../../src/models/default"
import { useGameStore } from "../../src/state/gameStore"

// These suites exercise the motion-on paths; content suites run with reduced motion.
let mockReduced = false
jest.mock("../../src/utils/hooks/usePremiereMotion", () => ({ usePremiereMotion: () => mockReduced }))
jest.mock("../../src/utils/shareUtils")
jest.mock("../../src/utils/hooks/useExternalLink", () => ({ useExternalLink: () => ({ openLink: jest.fn() }) }))
jest.mock("../../src/components/countdownTimer", () => () => null)
jest.mock("../../src/components/nextChallenge", () => () => null)

const themed = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>
const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } })
const game = {
  ...defaultPlayerGame, id: "won", difficulty: "LEVEL_2" as const, correctAnswer: true, score: 423, statsProcessed: true,
  guesses: [{ itemId: 1 }, { itemId: 2 }],
  hintsUsed: { director: true },
  triviaItem: { ...defaultPlayerGame.triviaItem, title: "The Matrix", releaseDate: "1999-03-31", hints: [] },
} as typeof defaultPlayerGame

beforeEach(() => { mockReduced = false; jest.useFakeTimers() })
afterEach(() => { act(() => { jest.runOnlyPendingTimers() }); jest.useRealTimers() })

describe("projector lamp", () => {
  it.each([false, true])("lights the clue screen after layout (reduced motion: %s)", reduced => {
    mockReduced = reduced
    render(themed(<PremiereStage cue={0}><Text>An anxious father</Text></PremiereStage>))
    fireEvent(screen.getByTestId("premiere-screen"), "layout", layout(320, 200))
    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getByText("An anxious father")).toBeTruthy()
    expect(screen.getByTestId("projector-flicker", { includeHiddenElements: true })).toBeTruthy()
  })
})

describe("share shimmer", () => {
  it("sweeps a saved result's button, but not with reduced motion or an unsaved score", () => {
    const view = render(themed(<ShareResultButton playerGame={game} shimmer />))
    expect(screen.getByTestId("share-shimmer")).toBeTruthy()
    act(() => { jest.advanceTimersByTime(4000) })
    view.rerender(themed(<ShareResultButton playerGame={{ ...game, statsProcessed: false }} shimmer />))
    expect(screen.queryByTestId("share-shimmer")).toBeNull()
    mockReduced = true
    view.rerender(themed(<ShareResultButton playerGame={game} shimmer />))
    expect(screen.queryByTestId("share-shimmer")).toBeNull()
  })
})

describe("curtain call result", () => {
  afterEach(() => act(() => useGameStore.setState({ playerStats: { ...useGameStore.getState().playerStats, currentStreak: 0 } })))

  it("counts the score up and rings the streak card with bulbs once measured", () => {
    act(() => useGameStore.setState({ playerStats: { ...useGameStore.getState().playerStats, currentStreak: 1 } }))
    render(themed(<GameOverView playerGame={game} lastGuessResult={null} />))
    expect(screen.queryByText("423")).toBeNull()
    act(() => { jest.advanceTimersByTime(3000) })
    expect(screen.getByText("423")).toBeTruthy()
    expect(screen.getByText("1 hint used · −50 points")).toBeTruthy()
    expect(screen.getByText("Day streak")).toBeTruthy()
    const marquee = screen.getByTestId("streak-marquee")
    expect(screen.queryAllByTestId("marquee-bulb")).toHaveLength(0)
    fireEvent(marquee, "layout", layout(300, 60))
    expect(screen.getAllByTestId("marquee-bulb")).toHaveLength(Math.floor(720 / 18))
    fireEvent(marquee, "layout", layout(300, 60))
    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getAllByTestId("marquee-bulb")).toHaveLength(40)
  })

  it("keeps the marquee still with reduced motion and names longer streaks", () => {
    mockReduced = true
    act(() => useGameStore.setState({ playerStats: { ...useGameStore.getState().playerStats, currentStreak: 6 } }))
    render(themed(<GameOverView playerGame={{ ...game, correctAnswer: false, score: 0 }} lastGuessResult={null} />))
    expect(screen.getByText("Days in a row")).toBeTruthy()
    expect(screen.getByText("1 hint used")).toBeTruthy()
    fireEvent(screen.getByTestId("streak-marquee"), "layout", layout(200, 50))
    expect(screen.getAllByTestId("marquee-bulb").length).toBeGreaterThan(0)
  })
})

describe("profile motion", () => {
  it("animates seats and the ring, and nudges only the next unfinished seat", () => {
    const statuses = { LEVEL_1: "Won", LEVEL_2: "Lost", LEVEL_3: "Not started" } as const
    const view = render(themed(<><ProgressRing completed={2} ready /><DailySlate statuses={statuses} /></>))
    act(() => { jest.advanceTimersByTime(4000) })
    expect(screen.getByLabelText("2 of 5 daily challenges completed")).toBeTruthy()
    expect(screen.getByLabelText("Medium: Not started, worth up to 700 points")).toBeTruthy()
    expect(screen.getByLabelText("Hard: Not started, worth up to 850 points")).toBeTruthy()
    view.rerender(themed(<DailySlate statuses={{ ...statuses, LEVEL_3: "Won" }} />))
    act(() => { jest.advanceTimersByTime(1000) })
    expect(screen.getByLabelText("Medium: Won")).toBeTruthy()
  })

  it("grows win bars from zero", () => {
    render(themed(<WinChart wins={[2, 1, 0, 0, 0]} />))
    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getByLabelText("1 guess: 2 wins")).toBeTruthy()
  })
})
