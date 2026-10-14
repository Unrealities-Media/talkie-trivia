import { createReminderService, REMINDER_ID, REMINDER_KEY } from "../../src/services/reminderService"
import { SchedulableTriggerInputTypes } from "expo-notifications/src/Notifications.types"
import { AndroidImportance } from "expo-notifications/src/NotificationChannelManager.types"
import { IosAuthorizationStatus } from "expo-notifications/src/NotificationPermissions.types"
import { scheduleNotificationAsync, parseTrigger } from "expo-notifications/src/scheduleNotificationAsync"

const mockNativeSchedule = jest.fn()
jest.mock("expo-notifications/src/NotificationScheduler", () => ({
  __esModule: true, default: { scheduleNotificationAsync: (...args: unknown[]) => mockNativeSchedule(...args) },
}))

const enabled = { enabled: true, hour: 19, minute: 35 }
const granted = { granted: true, canAskAgain: true, status: "granted" }
const denied = { granted: false, canAskAgain: false, status: "denied" }
function fixture(platform = "android", initial: unknown = null) {
  let raw: string | null = initial === null ? null : JSON.stringify(initial)
  const pending = new Map<string, any>()
  const storage = {
    getItem: jest.fn(async () => raw),
    setItem: jest.fn(async (_key: string, value: string) => { raw = value }),
  }
  const api = {
    AndroidImportance, IosAuthorizationStatus, SchedulableTriggerInputTypes,
    getPermissionsAsync: jest.fn().mockResolvedValue(granted),
    requestPermissionsAsync: jest.fn().mockResolvedValue(granted),
    setNotificationChannelAsync: jest.fn().mockResolvedValue({ importance: AndroidImportance.DEFAULT }),
    getNotificationChannelAsync: jest.fn().mockResolvedValue({ importance: AndroidImportance.DEFAULT }),
    setNotificationHandler: jest.fn(),
    getAllScheduledNotificationsAsync: jest.fn(async () => [...pending.values()]),
    scheduleNotificationAsync: jest.fn(async (request: any) => {
      // Exercise the installed JS parser/bridge, not a permissive schedule mock.
      const result = await scheduleNotificationAsync(request)
      pending.set(request.identifier, request)
      return result
    }),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => { pending.delete(id) }),
    dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  }
  const notifications = jest.fn(() => api as any)
  const make = () => createReminderService({ platform, storage, notifications })
  return { service: make(), make, storage, api, notifications, pending, raw: () => raw }
}
beforeEach(() => { mockNativeSchedule.mockReset().mockImplementation(async id => id) })

it("reproduces the old invalid trigger against the installed parser", () => {
  expect(() => parseTrigger({ hour: 9, minute: 0, repeats: true } as any)).toThrow("invalid")
})

it("defaults off without prompting or scheduling and removes only recognized legacy reminders", async () => {
  const f = fixture()
  f.pending.set("old", { identifier: "old", content: { title: "Talkie Trivia 🎬", body: "The daily movie is live! Start a new winning streak today!" } })
  f.pending.set("unrelated", { identifier: "unrelated", content: { title: "Another notification" } })
  await f.service.refresh()
  expect(f.service.getSnapshot().status).toBe("off")
  expect(f.api.getPermissionsAsync).not.toHaveBeenCalled()
  expect(f.api.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(mockNativeSchedule).not.toHaveBeenCalled()
  expect([...f.pending.keys()]).toEqual(["unrelated"])
})

it("persists opt-in before native calls and uses the installed daily trigger contract", async () => {
  const f = fixture()
  f.api.getPermissionsAsync.mockResolvedValue({ ...denied, canAskAgain: true })
  f.api.requestPermissionsAsync.mockImplementation(async () => {
    expect(JSON.parse(f.raw()!)).toEqual({ version: 1, ...enabled })
    expect(f.api.setNotificationChannelAsync).toHaveBeenCalled()
    return granted
  })
  await f.service.configure(enabled)
  expect(f.storage.setItem).toHaveBeenCalledWith(REMINDER_KEY, expect.any(String))
  expect(mockNativeSchedule).toHaveBeenCalledWith(REMINDER_ID, expect.objectContaining({ sound: false }),
    { type: "daily", hour: 19, minute: 35, channelId: "daily-movie-reminders" })
  expect(f.service.getSnapshot()).toMatchObject({ ...enabled, status: "scheduled", busy: false })
  expect(f.api.cancelScheduledNotificationAsync).not.toHaveBeenCalled()
})

it("denied permission keeps the chosen time without scheduling or repeatedly prompting", async () => {
  const f = fixture()
  f.api.getPermissionsAsync.mockResolvedValue({ ...denied, canAskAgain: true })
  f.api.requestPermissionsAsync.mockResolvedValue(denied)
  await f.service.configure(enabled)
  expect(f.service.getSnapshot()).toMatchObject({ ...enabled, status: "blocked" })
  expect(mockNativeSchedule).not.toHaveBeenCalled()
  await f.service.refresh()
  expect(f.api.requestPermissionsAsync).toHaveBeenCalledTimes(1)
})

it("revocation removes the old schedule; a later settings grant restores it without a prompt", async () => {
  const f = fixture()
  await f.service.configure(enabled)
  f.api.getPermissionsAsync.mockResolvedValue(denied)
  await f.service.refresh()
  expect(f.pending.size).toBe(0)
  expect(f.service.getSnapshot().status).toBe("blocked")
  f.api.getPermissionsAsync.mockResolvedValue(granted)
  await f.service.refresh()
  expect(f.pending.size).toBe(1)
  expect(f.api.requestPermissionsAsync).not.toHaveBeenCalled()
})

it("respects a blocked Android channel even when app permission is granted", async () => {
  const f = fixture()
  f.api.getNotificationChannelAsync.mockResolvedValue({ importance: AndroidImportance.NONE })
  await f.service.configure(enabled)
  expect(f.service.getSnapshot().status).toBe("blocked")
  expect(mockNativeSchedule).not.toHaveBeenCalled()
})

it("accepts iOS provisional delivery without asking again or creating Android channels", async () => {
  const f = fixture("ios")
  f.api.getPermissionsAsync.mockResolvedValue({ ...denied, ios: { status: IosAuthorizationStatus.PROVISIONAL } })
  await f.service.configure(enabled)
  expect(f.service.getSnapshot().status).toBe("scheduled")
  expect(f.api.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(f.api.setNotificationChannelAsync).not.toHaveBeenCalled()
})

it("does not touch native schedules when preference storage fails", async () => {
  const f = fixture()
  f.storage.setItem.mockRejectedValueOnce(new Error("full disk"))
  await expect(f.service.configure(enabled)).rejects.toThrow("could not be confirmed")
  expect(f.notifications).not.toHaveBeenCalled()
  expect(f.service.getSnapshot().status).toBe("error")
})

it("retries ambiguous scheduling with one stable identity across a process restart", async () => {
  const f = fixture()
  f.api.scheduleNotificationAsync.mockImplementationOnce(async request => {
    f.pending.set(request.identifier, request)
    throw new Error("response lost")
  })
  await expect(f.service.configure(enabled)).rejects.toThrow()
  const restarted = f.make()
  await restarted.refresh()
  expect(f.pending.size).toBe(1)
  expect(restarted.getSnapshot()).toMatchObject({ ...enabled, status: "scheduled" })
  expect(f.api.requestPermissionsAsync).not.toHaveBeenCalled()
})

it("retains the previous schedule when replacement fails and converges on retry", async () => {
  const f = fixture()
  await f.service.configure(enabled)
  mockNativeSchedule.mockRejectedValueOnce(new Error("OS unavailable"))
  await expect(f.service.configure({ ...enabled, hour: 8 })).rejects.toThrow()
  expect(f.pending.get(REMINDER_ID).trigger.hour).toBe(19)
  expect(f.api.cancelScheduledNotificationAsync).not.toHaveBeenCalled()
  await f.service.refresh()
  expect(f.pending.get(REMINDER_ID).trigger.hour).toBe(8)
})

it("records off before cancellation and retries a failed cancellation on restart", async () => {
  const f = fixture()
  await f.service.configure(enabled)
  f.api.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error("OS unavailable"))
  await expect(f.service.disable()).rejects.toThrow()
  expect(JSON.parse(f.raw()!).enabled).toBe(false)
  expect(f.service.getSnapshot().status).toBe("error")
  const restarted = f.make()
  await restarted.refresh()
  expect(f.pending.size).toBe(0)
  expect(restarted.getSnapshot()).toMatchObject({ status: "off", hour: 19, minute: 35 })
})

it("serializes delayed opt-in, off and foreground recovery so off wins", async () => {
  const f = fixture()
  let release!: (value: string) => void
  mockNativeSchedule.mockImplementationOnce(() => new Promise<string>(resolve => { release = resolve }))
  const first = f.service.configure(enabled)
  // Wait until the delayed native operation, without timers or guessed sleeps.
  for (let i = 0; i < 30 && !release; i++) await Promise.resolve()
  expect(release).toBeDefined()
  const off = f.service.disable()
  const foreground = f.service.refresh()
  release(REMINDER_ID)
  await Promise.all([first, off, foreground])
  expect(f.service.getSnapshot()).toMatchObject({ enabled: false, status: "off" })
  expect(f.pending.size).toBe(0)
})

it.each([{ version: 2, ...enabled }, { version: 1, ...enabled, hour: 24 }, null])("never enables a corrupt stored preference: %p", async value => {
  const f = fixture("ios", value)
  if (value === null) f.storage.getItem.mockResolvedValue("broken json")
  await expect(f.service.refresh()).rejects.toThrow()
  expect(mockNativeSchedule).not.toHaveBeenCalled()
  await f.service.disable()
  expect(f.service.getSnapshot().status).toBe("off")
})

it.each([-1, 24, 1.5, NaN])("rejects invalid hour %p before saving or loading native modules", async hour => {
  const f = fixture()
  await expect(f.service.configure({ ...enabled, hour })).rejects.toThrow()
  expect(f.storage.setItem).not.toHaveBeenCalled()
  expect(f.notifications).not.toHaveBeenCalled()
})

it("does not initialize native modules or storage on web", async () => {
  const f = fixture("web")
  await f.service.refresh()
  await f.service.configure(enabled)
  await f.service.disable()
  expect(f.service.getSnapshot().status).toBe("unsupported")
  expect(f.notifications).not.toHaveBeenCalled()
  expect(f.storage.getItem).not.toHaveBeenCalled()
  expect(f.storage.setItem).not.toHaveBeenCalled()
})

it.each([0, 23])("schedules boundary hour %i with boundary minute 59", async hour => {
  const f = fixture()
  await f.service.configure({ ...enabled, hour, minute: 59 })
  expect(mockNativeSchedule).toHaveBeenCalledWith(REMINDER_ID, expect.any(Object), expect.objectContaining({ type: "daily", hour, minute: 59 }))
})

it.each([-1, 60, 1.5])("rejects invalid minute %i without changing saved intent", async minute => {
  const f = fixture()
  await expect(f.service.configure({ ...enabled, minute })).rejects.toThrow()
  expect(f.storage.setItem).not.toHaveBeenCalled()
})

it("does not report success for a mismatched native scheduling confirmation", async () => {
  const f = fixture()
  mockNativeSchedule.mockResolvedValueOnce("wrong-id")
  await expect(f.service.configure(enabled)).rejects.toThrow()
  expect(f.service.getSnapshot().status).toBe("error")
})
