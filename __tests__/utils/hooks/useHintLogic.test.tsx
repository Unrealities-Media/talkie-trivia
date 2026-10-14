import { renderHook, act } from "@testing-library/react-native"
import { useHintLogic } from "../../../src/utils/hooks/useHintLogic"
import { useGameStore } from "../../../src/state/gameStore"
import { defaultPlayerGame } from "../../../src/models/default"

// Mock dependencies
jest.mock("../../../src/utils/hapticsService", () => ({
  hapticsService: { light: jest.fn(), medium: jest.fn() },
}))
jest.mock("react-native/Libraries/LayoutAnimation/LayoutAnimation", () => ({
  ...jest.requireActual(
    "react-native/Libraries/LayoutAnimation/LayoutAnimation"
  ),
  configureNext: jest.fn(),
}))

describe("Hook: useHintLogic", () => {
  const initialState = useGameStore.getState()
  const mockItem = {
    id: 1,
    title: "Test",
    description: "Desc",
    posterPath: "",
    releaseDate: "",
    metadata: {},
    hints: [
      { type: "director", label: "Director", value: "Nolan" },
      { type: "genre", label: "Genre", value: "Action" },
    ],
  }

  beforeEach(() => {
    useGameStore.setState({
      ...initialState,
      playerGame: { ...defaultPlayerGame, triviaItem: mockItem, hintsUsed: {} },
      // Ensure hints are available
      playerStats: { ...initialState.playerStats, hintsAvailable: 5 },
      // Explicitly set Difficulty to LEVEL_2 which maps to USER_SPEND strategy
      difficulty: "LEVEL_2",
      isInteractionsDisabled: false,
      syncStatus: "idle",
      useHint: jest.fn().mockResolvedValue(undefined),
    })
  })

  it("should allow toggling hint options in USER_SPEND mode", () => {
    const { result } = renderHook(() => useHintLogic())

    expect(result.current.showHintOptions).toBe(false)

    act(() => {
      result.current.handleToggleHintOptions()
    })

    expect(result.current.showHintOptions).toBe(true)
  })

  it("should correctly calculate hint statuses", () => {
    useGameStore.setState({
      playerGame: {
        ...defaultPlayerGame,
        triviaItem: mockItem,
        hintsUsed: { director: true },
      },
    })

    const { result } = renderHook(() => useHintLogic())

    expect(result.current.hintStatuses["director"]).toBe("used")
    expect(result.current.hintStatuses["genre"]).toBe("available")
  })

  it("should disable toggle if difficulty is Hard (NONE_DISABLED)", () => {
    // Override difficulty for this specific test
    useGameStore.setState({ difficulty: "LEVEL_4" })

    const { result } = renderHook(() => useHintLogic())

    expect(result.current.hintStatuses["director"]).toBe("disabled")
  })

  it("should handle hint selection and trigger store action", () => {
    const { result } = renderHook(() => useHintLogic())
    const spyUseHint = jest.spyOn(useGameStore.getState(), "useHint")

    // 1. Open options first (not strictly required by logic but good for realism)
    act(() => {
      result.current.handleToggleHintOptions()
    })

    // 2. Select a hint
    act(() => {
      result.current.handleHintSelection("genre")
    })

    // 3. Verify action was called
    expect(spyUseHint).toHaveBeenCalledWith("genre")

    // Selecting must not reveal content before authoritative acknowledgment.
    expect(result.current.displayedHintText).toBeNull()
    act(() => useGameStore.setState(state => ({ playerGame: { ...state.playerGame, hintsUsed: { genre: true } } })))
    expect(result.current.displayedHintText).toBe("Action")
  })

  it("keeps a pending hint hidden until retry returns an acknowledged hint", () => {
    const { result } = renderHook(() => useHintLogic())
    act(() => result.current.handleHintSelection("genre"))
    act(() => useGameStore.setState({ syncStatus: "pending" }))
    expect(result.current.displayedHintText).toBeNull()
    expect(result.current.isToggleDisabled).toBe(true)
    act(() => result.current.handleHintSelection("director"))
    expect(useGameStore.getState().useHint).toHaveBeenCalledTimes(1)
    act(() => useGameStore.setState(state => ({ syncStatus: "idle", playerGame: { ...state.playerGame, hintsUsed: { genre: true } } })))
    expect(result.current.displayedHintText).toBe("Action")
  })

  it("does not reveal disabled or unknown hints or reuse a selection for another account", () => {
    const { result } = renderHook(() => useHintLogic())
    act(() => result.current.handleHintSelection("unknown"))
    expect(useGameStore.getState().useHint).not.toHaveBeenCalled()
    act(() => useGameStore.setState({ isInteractionsDisabled: true }))
    act(() => result.current.handleHintSelection("genre"))
    expect(useGameStore.getState().useHint).not.toHaveBeenCalled()
    act(() => useGameStore.setState({ isInteractionsDisabled: false }))
    act(() => result.current.handleHintSelection("genre"))
    act(() => useGameStore.setState(state => ({ playerGame: { ...state.playerGame, playerID: "another-account", hintsUsed: { genre: true } } })))
    expect(result.current.displayedHintText).toBeNull()
  })

  it("reopens an already acknowledged hint without another server action", () => {
    useGameStore.setState(state => ({ playerGame: { ...state.playerGame, hintsUsed: { genre: true } } }))
    const { result } = renderHook(() => useHintLogic())
    act(() => result.current.handleHintSelection("genre"))
    expect(result.current.displayedHintText).toBe("Action")
    expect(useGameStore.getState().useHint).not.toHaveBeenCalled()
  })
})
