import React from "react"
import { ScrollView, View, Text } from "react-native"
import { useTheme } from "../contexts/themeContext"

export default function ProfilePage({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme()
  return <ScrollView contentContainerStyle={{ padding: 20, alignItems: "center", paddingBottom: 32 }}>
    <View style={{ width: "100%", maxWidth: 420, gap: 20 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "PremiereDisplay", fontSize: 36, color: colors.textPrimary }}>{title}</Text>
      {children}
    </View>
  </ScrollView>
}
