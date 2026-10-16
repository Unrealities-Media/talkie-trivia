import { useEffect, useState } from "react"
import { AccessibilityInfo, Platform } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

// Read synchronously to avoid briefly opening the curtains before the preference
// resolves, then subscribe so changes made while the app is open apply as well.
export function usePremiereMotion() {
  const initial = useReducedMotion()
  const [reduced, setReduced] = useState(() =>
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : initial)
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)")
      const update = () => setReduced(media.matches)
      update()
      media.addEventListener("change", update)
      return () => media.removeEventListener("change", update)
    }
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => {
      setReduced(value)
    })
    return () => subscription.remove()
  }, [])
  return reduced
}
