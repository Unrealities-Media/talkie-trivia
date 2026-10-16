import React from "react"
import { Tabs } from "expo-router"
import { FontDisplay, useFonts } from "expo-font"
import LoadingIndicator from "../../components/loadingIndicator"
import FontAwesome from "@expo/vector-icons/FontAwesome"
import TextTabBar from "../../components/textTabBar"
import { Platform, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { StatusBar } from "expo-status-bar"
import { useTheme } from "../../contexts/themeContext"

const TabLayout = () => {
  const insets = useSafeAreaInsets()
  const { colors, colorScheme } = useTheme()
  const font = (uri: number) => Platform.OS === "web" ? { uri, display: FontDisplay.SWAP } : uri
  const [fontsLoaded, fontError] = useFonts({
    "PremiereDisplay": font(require("../../../assets/fonts/PremiereDisplay.ttf")),
    "PremiereDisplay-Bold": font(require("../../../assets/fonts/PremiereDisplay-Bold.ttf")),
    "PremiereClue": font(Platform.OS === "web"
      ? require("../../../assets/fonts/PremiereClue.woff2")
      : require("../../../assets/fonts/PremiereClue.ttf")),
    "PremiereSans": font(require("../../../assets/fonts/PremiereSans.ttf")),
    "Arvo-Bold": font(require("../../../assets/fonts/Arvo-Bold.ttf")),
    "Arvo-Italic": font(require("../../../assets/fonts/Arvo-Italic.ttf")),
    "Arvo-Regular": font(require("../../../assets/fonts/Arvo-Regular.ttf")),
    ...FontAwesome.font,
  })

  // Web has readable system fallbacks; optional font downloads must not hide
  // navigation or prevent account/game recovery on an unreliable connection.
  if (Platform.OS !== "web" && !fontsLoaded && !fontError) {
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
