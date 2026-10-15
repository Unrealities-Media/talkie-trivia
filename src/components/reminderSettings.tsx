import React, { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Linking, Pressable, Text, TextInput, View } from "react-native"
import { reminderService } from "../services/reminderService"
import { useStyles, Theme } from "../utils/hooks/useStyles"

const format = (hour: number, minute: number) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`

export default function ReminderSettings({ suspended = false }: { suspended?: boolean }) {
  const state = useSyncExternalStore(reminderService.subscribe, reminderService.getSnapshot, reminderService.getSnapshot)
  const [time, setTime] = useState(format(state.hour, state.minute))
  const [inputError, setInputError] = useState("")
  const [settingsError, setSettingsError] = useState("")
  const pending = useRef(false)
  const styles = useStyles(themedStyles)
  useEffect(() => { setTime(format(state.hour, state.minute)) }, [state.hour, state.minute])
  const disabled = suspended || state.busy || state.status === "loading"
  const act = async (operation: () => Promise<void>) => {
    if (pending.current || disabled) return
    pending.current = true
    try { await operation() } catch { /* Service publishes a retryable error. */ }
    finally { pending.current = false }
  }
  const save = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setInputError("Enter a time from 00:00 to 23:59, such as 09:00.")
      return
    }
    setInputError("")
    const [hour, minute] = time.split(":").map(Number)
    void act(() => reminderService.configure({ enabled: true, hour, minute }))
  }
  const button = (label: string, onPress: () => void) => <Pressable onPress={onPress} disabled={disabled}
    accessibilityRole="button" accessibilityState={{ disabled }} style={styles.button}>
    <Text style={styles.buttonText}>{label}</Text>
  </Pressable>
  if (state.status === "unsupported") return null
  return <View style={styles.container}>
    <Text style={styles.title}>Daily reminder</Text>
    <Text style={styles.text}>Optional, on this device only. Remind me around this local time each day, even if I've already played. The puzzle changes worldwide at 00:00 UTC.</Text>
    <Text style={styles.text}>Time (24-hour clock)</Text>
    <TextInput accessibilityLabel="Daily reminder time, 24-hour clock" value={time}
      onChangeText={value => { setTime(value); setInputError("") }} editable={!disabled}
      maxLength={5} autoCorrect={false} autoCapitalize="none" placeholder="09:00" style={styles.input} />
    {inputError ? <Text accessibilityRole="alert" style={styles.text}>{inputError}</Text> : null}
    <Text accessibilityLiveRegion="polite" style={styles.text}>
      {state.busy ? "Updating reminder…" : state.status === "loading" ? "Checking reminder…" :
        state.status === "scheduled" ? `Reminder scheduled for around ${format(state.hour, state.minute)} local time.` :
        state.status === "off" ? "Reminders are off." : state.status === "blocked" ?
        "Notifications are blocked in device settings. Your chosen time is saved." :
        "The reminder update could not be confirmed. A previous reminder may still arrive. Retry or turn reminders off."}
    </Text>
    {suspended && <Text style={styles.text}>Finish account recovery or deletion before changing reminders.</Text>}
    <View style={styles.actions}>
      {button(state.enabled ? "Save reminder time" : "Enable daily reminder", save)}
      {(state.enabled || state.status === "error") && button("Turn reminders off", () => { void act(() => reminderService.disable()) })}
      {state.status === "error" && button("Retry reminder update", () => { void act(() => reminderService.refresh()) })}
      {(state.status === "blocked" || state.status === "error") && button("Open device settings", () => {
        setSettingsError("")
        void Linking.openSettings().catch(() => setSettingsError("Could not open settings. Open your device settings and find Talkie Trivia notifications."))
      })}
    </View>
    {settingsError ? <Text accessibilityRole="alert" style={styles.text}>{settingsError}</Text> : null}
    <Text style={styles.text}>Delivery can be delayed by your device. If the reminder time looks wrong after traveling or changing its clock, reopen the app to refresh it.</Text>
  </View>
}

const themedStyles = (theme: Theme) => ({
  container: { gap: theme.spacing.small, width: "100%" as const },
  title: { ...theme.typography.heading2, color: theme.colors.textPrimary },
  text: { ...theme.typography.bodyText, color: theme.colors.textPrimary },
  input: { ...theme.typography.bodyText, color: theme.colors.textPrimary, backgroundColor: theme.colors.background,
    minHeight: 48, padding: theme.spacing.small, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8 },
  actions: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: theme.spacing.small },
  button: { minHeight: 48, minWidth: 48, justifyContent: "center" as const, padding: theme.spacing.small,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, flexShrink: 1 },
  buttonText: { ...theme.typography.bodyText, color: theme.colors.accentText },
})
