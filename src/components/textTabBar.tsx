import React from "react"
import { Pressable, Text, View } from "react-native"
import type { Tabs } from "expo-router"
import { useTheme } from "../contexts/themeContext"

// The launch app has two destinations. Keep icon/animation subtrees out of this
// text-only bar; hidden default icons caused native Fabric mount failures.
export type TextTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0] & { fontsLoaded: boolean }
export default function TextTabBar({ state, descriptors, navigation, insets, fontsLoaded }: TextTabBarProps) {
  const { colors } = useTheme()
  return <View style={{
    flexDirection: "row", alignItems: "stretch", gap: 20,
    paddingLeft: 20 + insets.left, paddingRight: 20 + insets.right,
    paddingTop: 5, paddingBottom: 5 + insets.bottom,
    minHeight: 70 + insets.bottom,
    backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 1,
  }}>
    {state.routes.filter(route => route.name === "game" || route.name === "profile").map(route => {
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
          backgroundColor: selected || pressed ? colors.surface : colors.background,
        })}>
        <Text style={{
          fontFamily: fontsLoaded ? "Arvo-Bold" : undefined,
          fontSize: 16, lineHeight: 22, textAlign: "center",
          color: selected ? colors.accentText : colors.textSecondary,
        }}>{label}</Text>
      </Pressable>
    })}
  </View>
}
