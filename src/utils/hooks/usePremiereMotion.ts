import { useEffect, useState } from "react"
import { AccessibilityInfo, Platform } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

const webPreference = () => Platform.OS === "web" && typeof window !== "undefined" && typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-reduced-motion: reduce)") : null

// Read synchronously to avoid briefly opening the curtains before the preference
// resolves, then subscribe so changes made while the app is open apply as well.
export function usePremiereMotion() {
  const initial = useReducedMotion()
  const [reduced, setReduced] = useState(() => webPreference()?.matches ?? initial)
  useEffect(() => {
    const media = webPreference()
    if (media) {
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
