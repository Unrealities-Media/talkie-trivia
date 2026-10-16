import React from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { useGameStore } from "../../../src/state/gameStore"
import { useAuth } from "../../../src/contexts/authContext"
import { useNetwork } from "../../../src/contexts/networkContext"
import GameScreen from "../../../src/app/(tabs)/game"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

jest.mock("../../../src/contexts/authContext")
jest.mock("../../../src/contexts/networkContext")
jest.mock("../../../src/state/gameStore")
// Keep the real header/difficulty and screen branches. Unrelated lazy gameplay
// and effects are covered separately; this Jest runtime cannot import them.
jest.mock("react", () => ({ ...jest.requireActual("react"), lazy: () => () => null }))
jest.mock("../../../src/components/sessionRecovery", () => {
  const { Text } = require("react-native")
  return () => <Text>Reopen your account</Text>
})
jest.mock("../../../src/components/accountDeletion", () => {
  const { Text } = require("react-native")
  return () => <Text>Account deletion</Text>
})

const mockUseGameStore = useGameStore as unknown as jest.Mock
let state: any
let auth: any
let network: any
const renderGame = () => render(
  <SafeAreaInsetsContext.Provider value={{ top: 24, bottom: 16, left: 0, right: 0 }}>
    <ThemeProvider><GameScreen /></ThemeProvider>
  </SafeAreaInsetsContext.Provider>
)

beforeEach(() => {
  auth = { player: { id: "p1" }, loading: false, error: null }
  network = { isNetworkConnected: true, refreshNetwork: jest.fn() }
  state = {
    gameMode: "movies", showConfetti: false, handleConfettiStop: jest.fn(),
    flashMessage: null, playerGame: { id: "movies_2026-10-13", difficulty: "LEVEL_5" },
    difficulty: "LEVEL_3", loading: false, initializeGame: jest.fn(),
    makeGuess: jest.fn(), useHint: jest.fn(), giveUp: jest.fn(),
  }
  ;(useAuth as jest.Mock).mockImplementation(() => auth)
  ;(useNetwork as jest.Mock).mockImplementation(() => network)
  mockUseGameStore.mockImplementation(selector => selector(state))
})

it("shows the saved challenge difficulty and an accessible heading when playable", () => {
  renderGame()
  expect(screen.getByRole("header", { name: "TALKIE TRIVIA" })).toBeTruthy()
  expect(screen.getByRole("button", { name: /^Play Very Hard\./ })).toBeTruthy()
})

it.each(["recovery", "auth loading", "auth error", "deletion", "offline", "game loading", "game error", "no game"])(
  "does not claim a current difficulty during %s, even with stale game state", mode => {
    if (mode === "recovery") auth = { ...auth, player: null, lostSession: { uid: "old", isAnonymous: true } }
    if (mode === "auth loading") auth.loading = true
    if (mode === "auth error") auth.error = "Account unavailable"
    if (mode === "deletion") auth.deletion = { status: "pending" }
    if (mode === "offline") network.isNetworkConnected = false
    if (mode === "game loading") state.loading = true
    if (mode === "game error") state.error = "No daily movie"
    if (mode === "no game") state.playerGame = {}
    renderGame()
    expect(screen.queryByText(/· daily challenge/)).toBeNull()
    if (mode === "recovery") expect(screen.getByText("Reopen your account")).toBeTruthy()
    if (["game loading", "game error", "no game"].includes(mode)) {
      fireEvent.press(screen.getByRole("button", { name: "How to play" }))
      expect(screen.getByText("Guess the movie")).toBeTruthy()
    } else {
      expect(screen.queryByRole("button", { name: "How to play" })).toBeNull()
      expect(screen.queryByRole("button", { name: /^Play / })).toBeNull()
    }
    expect(state.initializeGame).not.toHaveBeenCalled()
  }
)

it("opens and closes optional help without changing the saved daily game", () => {
  const original = JSON.stringify(state)
  renderGame()
  fireEvent.press(screen.getByRole("button", { name: "How to play" }))
  expect(screen.getByText("Guess the movie")).toBeTruthy()
  fireEvent.press(screen.getByRole("button", { name: "Close help" }))
  expect(screen.queryByText("Guess the movie")).toBeNull()
  expect(JSON.stringify(state)).toBe(original)
  expect(state.initializeGame).not.toHaveBeenCalled()
  expect(state.makeGuess).not.toHaveBeenCalled()
  expect(state.useHint).not.toHaveBeenCalled()
  expect(state.giveUp).not.toHaveBeenCalled()
})

it("rechecks connectivity before retrying a failed daily game", async () => {
  network.isNetworkConnected = false
  network.refreshNetwork.mockResolvedValue(true)
  state.playerGame = {}
  state.error = "Unavailable"
  renderGame()
  expect(screen.getByText(/You’re offline/)).toBeTruthy()
  fireEvent.press(screen.getByText("Retry"))
  await waitFor(() => expect(state.initializeGame).toHaveBeenCalledWith({ id: "p1" }))
  expect(network.refreshNetwork).toHaveBeenCalledTimes(1)
})
