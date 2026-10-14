import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"
import { useReducedMotion } from "react-native-reanimated"

// Read synchronously to avoid briefly opening the curtains before the preference
// resolves, then subscribe so changes made while the app is open apply as well.
export function usePremiereMotion() {
  const initial = useReducedMotion()
  const [reduced, setReduced] = useState(initial)
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => {
      setReduced(value)
    })
    return () => subscription.remove()
  }, [])
  return reduced
}
