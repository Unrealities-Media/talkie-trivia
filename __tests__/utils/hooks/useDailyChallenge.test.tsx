import { act, renderHook } from "@testing-library/react-native"
import { AppState, AppStateStatus } from "react-native"
import { useDailyChallenge } from "../../../src/utils/hooks/useDailyChallenge"
import { useGameStore } from "../../../src/state/gameStore"
jest.mock("../../../src/state/gameStore", () => ({ useGameStore: { getState: jest.fn() } }))
describe("daily challenge lifecycle", () => {
  let listener: (value: AppStateStatus) => void
  let state: any
  const remove = jest.fn()
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => { listener = callback; return { remove } })
    state = { loading: false, syncStatus: "idle", resetDeadline: 10000, error: null, initializeGame: jest.fn() }
    ;(useGameStore.getState as jest.Mock).mockImplementation(() => state)
  })
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers() })
  it("starts even when the initial UI loading flag is true", () => {
    state.loading = true
    renderHook(() => useDailyChallenge({ id: "p1", name: "Player" }, true))
    expect(state.initializeGame).toHaveBeenCalledWith({ id: "p1", name: "Player" })
  })
  it("refreshes at UTC expiry and after a foreground event", () => {
    renderHook(() => useDailyChallenge({ id: "p1", name: "Player" }, true))
    act(() => jest.advanceTimersByTime(9000))
    expect(state.initializeGame).toHaveBeenCalledTimes(1)
    act(() => jest.advanceTimersByTime(1000))
    expect(state.initializeGame).toHaveBeenCalledTimes(2)
    act(() => { listener("background"); listener("active") })
    expect(state.initializeGame).toHaveBeenCalledTimes(3)
  })
  it("defers foreground refresh while a move is saving, then runs it", () => {
    renderHook(() => useDailyChallenge({ id: "p1", name: "Player" }, true))
    state.syncStatus = "saving"
    act(() => { listener("background"); listener("active"); jest.advanceTimersByTime(1000) })
    expect(state.initializeGame).toHaveBeenCalledTimes(1)
    state.syncStatus = "idle"
    act(() => jest.advanceTimersByTime(1000))
    expect(state.initializeGame).toHaveBeenCalledTimes(2)
  })
  it("retries missing content once a minute and cleans up on account change", () => {
    const hook = renderHook<void, { uid: string }>(({ uid }) => useDailyChallenge({ id: uid, name: "Player" }, true), { initialProps: { uid: "p1" } })
    state.error = "Unavailable"
    act(() => jest.advanceTimersByTime(59000))
    expect(state.initializeGame).toHaveBeenCalledTimes(1)
    act(() => jest.advanceTimersByTime(1000))
    expect(state.initializeGame).toHaveBeenCalledTimes(2)
    hook.rerender({ uid: "p2" })
    expect(remove).toHaveBeenCalledTimes(1)
    expect(state.initializeGame).toHaveBeenLastCalledWith({ id: "p2", name: "Player" })
    hook.unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
  it("waits when offline and refreshes on reconnect", () => {
    const hook = renderHook<void, { connected: boolean }>(({ connected }) => useDailyChallenge({ id: "p1", name: "Player" }, connected), { initialProps: { connected: false } })
    expect(state.initializeGame).not.toHaveBeenCalled()
    hook.rerender({ connected: true })
    expect(state.initializeGame).toHaveBeenCalledTimes(1)
  })
})
