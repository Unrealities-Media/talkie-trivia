import React from "react"
import {
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
  PressableStateCallbackType,
} from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated"

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export const ScalePressable: React.FC<PressableProps> = ({
  style,
  children,
  ...props
}) => {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const resolveStyle = (
    state: PressableStateCallbackType
  ): any => {
    const userStyle = typeof style === "function" ? style(state) : style
    return [userStyle, animatedStyle]
  }

  return (
    <AnimatedPressable
      onPressIn={() => (scale.value = withSpring(0.96))}
      onPressOut={() => (scale.value = withSpring(1))}
      style={resolveStyle as any}
      {...props}
    >
      {children as React.ReactNode}
    </AnimatedPressable>
  )
}
