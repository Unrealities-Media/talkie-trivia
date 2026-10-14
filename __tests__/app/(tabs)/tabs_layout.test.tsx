import React from "react"
import { render, screen } from "@testing-library/react-native"
import { useFonts } from "expo-font"
import { Dimensions } from "react-native"

jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}))

// Fixed mock for expo-font
jest.mock("expo-font", () => ({
  useFonts: jest.fn(),
}))

jest.mock("expo-router", () => ({
  Tabs: Object.assign((props: any) => <>{props.children}</>, {
    Screen: ({ name }: { name: string }) => {
      const { View } = require("react-native")
      return <View testID={`tab-${name}`} />
    },
  }),
}))

jest.mock("../../../src/contexts/themeContext", () => ({
  useTheme: () => ({
    colors: {
      primary: "blue",
      textSecondary: "gray",
      surface: "white",
      background: "white",
      border: "black",
    },
  }),
}))

import TabLayout from "../../../src/app/(tabs)/_layout"

describe("App: TabsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Dimensions.addEventListener as jest.Mock).mockReturnValue({ remove: jest.fn() })
    // Default to NOT loaded
    ;(useFonts as jest.Mock).mockReturnValue([false, null])
  })

  it("should show loading indicator if fonts are not loaded", () => {
    render(<TabLayout />)
    expect(screen.getByTestId("loading-indicator-container")).toBeTruthy()
  })

  it("uses available fallback fonts when custom font loading fails", () => {
    const errorMsg = "Font load failed"
    const error = new Error(errorMsg)
    // We must mock the return value BEFORE rendering
    ;(useFonts as jest.Mock).mockReturnValue([false, error])

    render(<TabLayout />)

    expect(screen.getByTestId("tab-game")).toBeTruthy()
    expect(screen.getByTestId("tab-profile")).toBeTruthy()
  })

  it("should render tabs when fonts are loaded", () => {
    ;(useFonts as jest.Mock).mockReturnValue([true, null])
    render(<TabLayout />)
    expect(screen.toJSON()).toBeDefined()
    expect(screen.getByTestId("tabs-safe-area")).toHaveStyle({ paddingTop: 24, flex: 1 })
  })
})
