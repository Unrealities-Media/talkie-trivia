import { act, renderHook } from "@testing-library/react-native"
import { AppState, AppStateStatus } from "react-native"
import { useNotifications } from "../../../src/utils/hooks/useNotifications"
import { reminderService } from "../../../src/services/reminderService"

jest.mock("../../../src/services/reminderService", () => ({
  reminderService: { refresh: jest.fn().mockResolvedValue(undefined) },
}))

describe("notification preference reconciliation", () => {
  const remove = jest.fn()
  let listener: (state: AppStateStatus) => void
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(AppState, "addEventListener").mockImplementation((_event, callback) => {
      listener = callback
      return { remove }
    })
  })
  afterEach(() => jest.restoreAllMocks())

  it("refreshes saved preferences on mount and foreground, with cleanup", () => {
    const { unmount } = renderHook(() => useNotifications())
    expect(reminderService.refresh).toHaveBeenCalledTimes(1)
    act(() => listener("background"))
    expect(reminderService.refresh).toHaveBeenCalledTimes(1)
    act(() => listener("active"))
    expect(reminderService.refresh).toHaveBeenCalledTimes(2)
    unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it("does not reconcile during suspended account operations", () => {
    const { rerender } = renderHook<void, { suspended: boolean }>(({ suspended }) => useNotifications(suspended), { initialProps: { suspended: true } })
    expect(reminderService.refresh).not.toHaveBeenCalled()
    expect(AppState.addEventListener).not.toHaveBeenCalled()
    rerender({ suspended: false })
    expect(reminderService.refresh).toHaveBeenCalledTimes(1)
    rerender({ suspended: true })
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it("contains reconciliation failures without rejecting the render", async () => {
    jest.mocked(reminderService.refresh).mockRejectedValueOnce(new Error("offline"))
    renderHook(() => useNotifications())
    await act(async () => { await Promise.resolve() })
    expect(reminderService.refresh).toHaveBeenCalledTimes(1)
  })
})
