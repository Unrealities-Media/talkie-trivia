import React from "react"
import { Tabs } from "expo-router"
import { useFonts } from "expo-font"
import LoadingIndicator from "../../components/loadingIndicator"
import { FontAwesome } from "@expo/vector-icons"
import TextTabBar from "../../components/textTabBar"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useTheme } from "../../contexts/themeContext"

const TabLayout = () => {
  const insets = useSafeAreaInsets()
  const { colors, colorScheme } = useTheme()
  const [fontsLoaded, fontError] = useFonts({
    "PremiereDisplay": require("../../../assets/fonts/PremiereDisplay.ttf"),
    "PremiereDisplay-Bold": require("../../../assets/fonts/PremiereDisplay-Bold.ttf"),
    "PremiereSerif": require("../../../assets/fonts/PremiereSerif.ttf"),
    "PremiereClue": require("../../../assets/fonts/PremiereClue.ttf"),
    "PremiereSans": require("../../../assets/fonts/PremiereSans.ttf"),
    "Arvo-Bold": require("../../../assets/fonts/Arvo-Bold.ttf"),
    "Arvo-Italic": require("../../../assets/fonts/Arvo-Italic.ttf"),
    "Arvo-Regular": require("../../../assets/fonts/Arvo-Regular.ttf"),
    ...FontAwesome.font,
  })

  if (!fontsLoaded && !fontError) {
    return <LoadingIndicator />
  }

  return (
    <View testID="tabs-safe-area" style={{ flex: 1, paddingTop: insets.top, backgroundColor: colors.background }}>
    <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    <Tabs
      tabBar={props => <TextTabBar {...props} fontsLoaded={fontsLoaded} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background, paddingLeft: insets.left, paddingRight: insets.right },
      }}
      initialRouteName="game"
    >
      <Tabs.Screen name="game" options={{ title: "Play" }} />
      <Tabs.Screen name="archive" options={{ title: "Archive" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      {/* Hide the index route from the tab bar */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
    </View>
  )
}

export default TabLayout
