import { useEffect } from "react"
import { AppState } from "react-native"
import { reminderService } from "../../services/reminderService"

// Reconcile existing preferences without requesting permission on launch.
export function useNotifications(suspended = false) {
  useEffect(() => {
    if (suspended) return
    const refresh = () => { void reminderService.refresh().catch(() => undefined) }
    refresh()
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") refresh()
    })
    return () => subscription.remove()
  }, [suspended])
}
