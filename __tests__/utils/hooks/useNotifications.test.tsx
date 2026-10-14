import { AppState } from "react-native"
import { act, renderHook, waitFor } from "@testing-library/react-native"
import { useNotifications } from "../../../src/utils/hooks/useNotifications"
import { reminderService } from "../../../src/services/reminderService"

jest.mock("../../../src/services/reminderService", () => ({ reminderService: { refresh: jest.fn() } }))
let onChange: (state: string) => void
const remove = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(reminderService.refresh).mockResolvedValue(undefined)
  jest.spyOn(AppState, "addEventListener").mockImplementation((_event, listener) => {
    onChange = listener
    return { remove }
  })
})
afterEach(() => jest.restoreAllMocks())

it("refreshes on launch/foreground, ignores background, and removes its subscription", async () => {
  const hook = renderHook(() => useNotifications())
  await waitFor(() => expect(reminderService.refresh).toHaveBeenCalledTimes(1))
  act(() => onChange("background"))
  expect(reminderService.refresh).toHaveBeenCalledTimes(1)
  act(() => onChange("active"))
  await waitFor(() => expect(reminderService.refresh).toHaveBeenCalledTimes(2))
  hook.unmount()
  expect(remove).toHaveBeenCalledTimes(1)
})

it("does not reconcile while account initialization/deletion is suspended", async () => {
  const hook = renderHook(({ suspended }) => useNotifications(suspended), { initialProps: { suspended: true } })
  expect(reminderService.refresh).not.toHaveBeenCalled()
  expect(AppState.addEventListener).not.toHaveBeenCalled()
  hook.rerender({ suspended: false })
  await waitFor(() => expect(reminderService.refresh).toHaveBeenCalledTimes(1))
  hook.rerender({ suspended: true })
  expect(remove).toHaveBeenCalledTimes(1)
})

it("allows another foreground attempt after a failed native/storage refresh", async () => {
  jest.mocked(reminderService.refresh).mockRejectedValueOnce(new Error("OS unavailable"))
  renderHook(() => useNotifications())
  await act(async () => undefined)
  act(() => onChange("active"))
  await waitFor(() => expect(reminderService.refresh).toHaveBeenCalledTimes(2))
})
