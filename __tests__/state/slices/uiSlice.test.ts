import { act, renderHook } from "@testing-library/react-native"
import { useGameStore } from "../../../src/state/gameStore"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { analyticsService } from "../../../src/utils/analyticsService"
import { ASYNC_STORAGE_KEYS } from "../../../src/config/constants"

// Mocks
jest.mock("../../../src/utils/analyticsService")
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
)

describe("State: UI Slice", () => {
  const initialState = useGameStore.getState()

  beforeEach(() => {
    useGameStore.setState(initialState, true)
    jest.clearAllMocks()
  })

  it("should update loading state", () => {
    const { result } = renderHook(() => useGameStore())
    act(() => result.current.setLoading(true))
    expect(result.current.loading).toBe(true)
    act(() => result.current.setLoading(false))
    expect(result.current.loading).toBe(false)
  })

  it("should update error state", () => {
    const { result } = renderHook(() => useGameStore())
    act(() => result.current.setError("Something went wrong"))
    expect(result.current.error).toBe("Something went wrong")
  })

  it("should toggle modal visibility", () => {
    const { result } = renderHook(() => useGameStore())
    act(() => result.current.setShowModal(true))
    expect(result.current.showModal).toBe(true)
  })

  it("should set flash messages", () => {
    const { result } = renderHook(() => useGameStore())
    act(() => result.current.setFlashMessage("Test Message"))
    expect(result.current.flashMessage).toBe("Test Message")
  })

  it("should handle confetti stop", () => {
    const { result } = renderHook(() => useGameStore())
    act(() => useGameStore.setState({ showConfetti: true }))
    act(() => result.current.handleConfettiStop())
    expect(result.current.showConfetti).toBe(false)
  })

  it("should dismiss guess input tip and persist to storage", () => {
    const { result } = renderHook(() => useGameStore())
    act(() => useGameStore.setState({
      tutorialState: { showGuessInputTip: true, showResultsTip: false },
    }))

    act(() => result.current.dismissGuessInputTip())

    expect(result.current.tutorialState.showGuessInputTip).toBe(false)
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      ASYNC_STORAGE_KEYS.TUTORIAL_GUESS_INPUT_SEEN,
      "true"
    )
  })

  it("dismisses the results tip without claiming the player completed onboarding", () => {
    const { result } = renderHook(() => useGameStore())
    act(() => useGameStore.setState({
      tutorialState: { showGuessInputTip: false, showResultsTip: true },
    }))

    act(() => result.current.dismissResultsTip())

    expect(result.current.tutorialState.showResultsTip).toBe(false)
    expect(analyticsService.trackOnboardingCompleted).not.toHaveBeenCalled()
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      ASYNC_STORAGE_KEYS.TUTORIAL_RESULTS_SEEN,
      "true"
    )
  })

  it("keeps both tips dismissed if optional preference writes fail", async () => {
    ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("Storage unavailable"))
      .mockRejectedValueOnce(new Error("Storage unavailable"))
    useGameStore.setState({ tutorialState: { showGuessInputTip: true, showResultsTip: true } })
    useGameStore.getState().dismissGuessInputTip()
    useGameStore.getState().dismissResultsTip()
    await Promise.resolve()
    expect(useGameStore.getState().tutorialState).toEqual({ showGuessInputTip: false, showResultsTip: false })
  })
})
