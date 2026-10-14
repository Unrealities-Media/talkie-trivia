import React from "react"
import { Pressable, Text, View } from "react-native"
import type { Tabs } from "expo-router"
import { useTheme } from "../contexts/themeContext"
import Svg, { Path, Circle, Rect } from "react-native-svg"

// Render only the visible custom icons; no hidden navigator icon subtrees.
export type TextTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0] & { fontsLoaded: boolean }
export default function TextTabBar({ state, descriptors, navigation, insets, fontsLoaded }: TextTabBarProps) {
  const { colors } = useTheme()
  return <View style={{
    flexDirection: "row", alignItems: "stretch", gap: 20,
    paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right,
    paddingTop: 5, paddingBottom: 5 + insets.bottom,
    minHeight: 70 + insets.bottom,
    backgroundColor: colors.background, borderTopColor: colors.surface, borderTopWidth: 1,
  }}>
    {state.routes.filter(route => ["game", "archive", "profile"].includes(route.name)).map(route => {
      const selected = state.routes[state.index].key === route.key
      const options = descriptors[route.key].options
      const label = options.title ?? (route.name === "game" ? "Game" : "Profile")
      return <Pressable key={route.key}
        accessibilityRole="tab" accessibilityState={{ selected }}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        testID={options.tabBarButtonTestID}
        onPress={() => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true })
          if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params)
        }}
        onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
        style={({ pressed }) => ({
          flex: 1, minWidth: 48, minHeight: 48, borderRadius: 10,
          paddingHorizontal: 8, paddingVertical: 10,
          alignItems: "center", justifyContent: "center",
          backgroundColor: pressed ? colors.surface : colors.background,
        })}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={selected ? colors.primary : colors.textSecondary} strokeWidth={1.2} aria-hidden={true}>
          {route.name === "game" ? <><Circle cx={11} cy={11} r={9} /><Circle cx={11} cy={11} r={1} /><Circle cx={11} cy={5.8} r={2} /><Circle cx={16.2} cy={11} r={2} /><Circle cx={11} cy={16.2} r={2} /><Circle cx={5.8} cy={11} r={2} /><Path d="M17 18l5 4" /></> : route.name === "archive" ? <><Rect x={4} y={6} width={16} height={15} rx={1} /><Path d="M3 3h18v4H3zM9 11h6" /></> : <><Circle cx={12} cy={7} r={4} /><Path d="M4 22v-3a8 8 0 0116 0v3" /></>}
        </Svg>
        <Text style={{
          fontFamily: fontsLoaded ? "PremiereSans" : undefined,
          fontSize: 12, lineHeight: 20, letterSpacing: 0.5, textAlign: "center",
          color: selected ? colors.primary : colors.textSecondary,
        }}>{label}</Text>
      </Pressable>
    })}
  </View>
}
