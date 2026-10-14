import { useEffect } from "react"
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated"
import { usePremiereMotion } from "./usePremiereMotion"

export const useSkeletonAnimation = (
  initialValue = 1,
  finalValue = 0.6,
  duration = 800
) => {
  const opacity = useSharedValue(initialValue)
  const reduced = usePremiereMotion()

  useEffect(() => {
    if (reduced) {
      opacity.value = initialValue
      return
    }
    opacity.value = withRepeat(
      withTiming(finalValue, {
        duration: duration,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    )
    return () => cancelAnimation(opacity)
  }, [opacity, initialValue, finalValue, duration, reduced])

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    }
  })

  return animatedStyle
}
