import React from "react"
import { render, screen, waitFor } from "@testing-library/react-native"
import { useFonts } from "expo-font"

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

jest.mock("../../src/contexts/themeContext", () => ({
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

import TabLayout from "../../src/app/(tabs)/_layout"

describe("App: TabsLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should show loading indicator if fonts are not loaded", () => {
    ;(useFonts as jest.Mock).mockReturnValue([false, null])
    render(<TabLayout />)
    expect(screen.getByTestId("loading-indicator-container")).toBeTruthy()
  })

  it("keeps navigation available when fonts fail to load", async () => {
    const errorMsg = "Font load failed"
    const error = new Error(errorMsg)
    ;(useFonts as jest.Mock).mockReturnValue([false, error])

    render(<TabLayout />)

    await waitFor(() => {
      expect(screen.getByTestId("tab-game")).toBeTruthy()
      expect(screen.getByTestId("tab-profile")).toBeTruthy()
      expect(screen.queryByTestId("loading-indicator-container")).toBeNull()
    })
  })

  it("should render tabs when fonts are loaded", () => {
    ;(useFonts as jest.Mock).mockReturnValue([true, null])
    render(<TabLayout />)
    expect(screen.toJSON()).toBeDefined()
  })
})
