import React from "react"
import { Stack, router } from "expo-router"
import { Pressable, Text } from "react-native"
import { useTheme } from "../../../contexts/themeContext"

export default function ProfileLayout() {
  const { colors } = useTheme()
  return <Stack screenOptions={{
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.textPrimary,
    headerTitleStyle: { fontFamily: "PremiereSans", fontSize: 16 },
    contentStyle: { backgroundColor: colors.background },
    headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Back to profile"
      onPress={() => router.dismissTo("/profile")} style={{ minHeight: 44, justifyContent: "center", paddingRight: 16 }}>
      <Text style={{ color: colors.accentText, fontFamily: "PremiereSans" }}>‹ Profile</Text>
    </Pressable>,
  }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="statistics" options={{ title: "Statistics" }} />
    <Stack.Screen name="settings" options={{ title: "Settings" }} />
    <Stack.Screen name="history" options={{ title: "Movie history" }} />
  </Stack>
}
