import AsyncStorage from "@react-native-async-storage/async-storage"
import { Platform } from "react-native"
import type * as Notifications from "expo-notifications"

export const REMINDER_KEY = "talkie.daily-reminder.v1"
export const REMINDER_ID = "talkie-daily-reminder-v1"
const CHANNEL = "daily-movie-reminders"
export type ReminderPreference = { enabled: boolean; hour: number; minute: number }
export type ReminderSnapshot = ReminderPreference & {
  status: "loading" | "off" | "scheduled" | "blocked" | "error" | "unsupported"
  busy: boolean
}
type NotificationApi = Pick<typeof Notifications,
  "getPermissionsAsync" | "requestPermissionsAsync" | "setNotificationChannelAsync" |
  "getNotificationChannelAsync" | "getAllScheduledNotificationsAsync" |
  "scheduleNotificationAsync" | "cancelScheduledNotificationAsync" |
  "dismissNotificationAsync" | "setNotificationHandler" |
  "AndroidImportance" | "IosAuthorizationStatus" | "SchedulableTriggerInputTypes">
const defaults: ReminderPreference = { enabled: false, hour: 9, minute: 0 }

function valid(value: unknown): value is ReminderPreference {
  const v = value as ReminderPreference | null
  return !!v && typeof v.enabled === "boolean" && Number.isInteger(v.hour) &&
    v.hour >= 0 && v.hour <= 23 && Number.isInteger(v.minute) && v.minute >= 0 && v.minute <= 59
}

function isLegacy(request: Notifications.NotificationRequest): boolean {
  return request.content.title === "Talkie Trivia 🎬" &&
    /^The daily movie is live! (Can you guess it\?|Start a new winning streak today!|Keep your \d+-day streak alive! 🔥)$/.test(request.content.body ?? "")
}

export function createReminderService(deps: {
  platform: string
  storage: Pick<typeof AsyncStorage, "getItem" | "setItem">
  notifications: () => NotificationApi
}) {
  let snapshot: ReminderSnapshot = { ...defaults, status: deps.platform === "web" ? "unsupported" : "loading", busy: false }
  const listeners = new Set<() => void>()
  let queue = Promise.resolve()
  let api: NotificationApi | undefined
  const publish = (change: Partial<ReminderSnapshot>) => {
    snapshot = { ...snapshot, ...change }
    listeners.forEach(listener => listener())
  }
  const native = () => {
    if (!api) {
      api = deps.notifications()
      api.setNotificationHandler({ handleNotification: async () => ({
        shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false,
      }) })
    }
    return api
  }
  const read = async (): Promise<ReminderPreference> => {
    const raw = await deps.storage.getItem(REMINDER_KEY)
    if (raw === null) return { ...defaults }
    const value = JSON.parse(raw)
    if (!value || value.version !== 1 || !valid(value)) throw new Error("Invalid reminder preference.")
    return { enabled: value.enabled, hour: value.hour, minute: value.minute }
  }
  const reconcile = async (preference: ReminderPreference, prompt: boolean) => {
    const notifications = native()
    publish(preference)
    const scheduled = await notifications.getAllScheduledNotificationsAsync()
    const legacy = scheduled.filter(isLegacy)
    const cancel = async () => {
      // The fixed identifier also handles an ambiguous scheduling response.
      await notifications.cancelScheduledNotificationAsync(REMINDER_ID)
      await notifications.dismissNotificationAsync(REMINDER_ID)
      for (const request of legacy) {
        await notifications.cancelScheduledNotificationAsync(request.identifier)
        await notifications.dismissNotificationAsync(request.identifier)
      }
    }
    if (!preference.enabled) {
      await cancel()
      publish({ status: "off" })
      return
    }
    // Android 13 permission requests require a notification channel first.
    if (deps.platform === "android") await notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Daily movie reminders", importance: notifications.AndroidImportance.DEFAULT,
      sound: null, enableVibrate: false, showBadge: false,
    })
    let permission = await notifications.getPermissionsAsync()
    const permitted = () => permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL ||
      permission.ios?.status === notifications.IosAuthorizationStatus.EPHEMERAL
    if (!permitted() && prompt && permission.canAskAgain) permission = await notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    })
    const channel = deps.platform === "android" ? await notifications.getNotificationChannelAsync(CHANNEL) : null
    if (!permitted() || (deps.platform === "android" && (!channel || channel.importance === notifications.AndroidImportance.NONE))) {
      await cancel()
      publish({ status: "blocked" })
      return
    }
    // Stable identity replaces the reminder without canceling the old one first.
    // Persisted intent makes a lost response/restart retry the same request.
    const identifier = await notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: { title: "Time for Talkie Trivia", body: "Fancy a movie puzzle? Open Talkie Trivia to play or see today's result.",
        data: { kind: "daily-reminder", version: 1 }, sound: false },
      trigger: { type: notifications.SchedulableTriggerInputTypes.DAILY,
        hour: preference.hour, minute: preference.minute, channelId: CHANNEL },
    })
    if (identifier !== REMINDER_ID) throw new Error("Reminder confirmation did not match.")
    for (const request of legacy) await notifications.cancelScheduledNotificationAsync(request.identifier)
    publish({ status: "scheduled" })
  }
  const run = (operation: () => Promise<void>) => {
    const result = queue.then(async () => {
      if (deps.platform === "web") return
      publish({ busy: true })
      try { await operation() }
      catch { publish({ status: "error" }); throw new Error("Reminder update could not be confirmed.") }
      finally { publish({ busy: false }) }
    })
    queue = result.catch(() => undefined)
    return result
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    refresh: () => run(async () => reconcile(await read(), false)),
    configure: (preference: ReminderPreference) => run(async () => {
      if (!valid(preference)) throw new Error("Invalid reminder time.")
      await deps.storage.setItem(REMINDER_KEY, JSON.stringify({ version: 1, ...preference }))
      await reconcile(preference, preference.enabled)
    }),
    // Independent of corrupt/missing preferences; durable off intent precedes cleanup.
    disable: () => run(async () => {
      const previous = await read().catch(() => defaults)
      const preference = { ...previous, enabled: false }
      await deps.storage.setItem(REMINDER_KEY, JSON.stringify({ version: 1, ...preference }))
      await reconcile(preference, false)
    }),
  }
}

export const reminderService = createReminderService({
  platform: Platform.OS, storage: AsyncStorage, notifications: () => require("expo-notifications"),
})
