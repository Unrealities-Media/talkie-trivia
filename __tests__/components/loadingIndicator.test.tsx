import React, { ReactElement } from "react"
import { Platform } from "react-native"
import {
  render,
  screen,
  cleanup,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import LoadingIndicator from "../../src/components/loadingIndicator"
import Constants from "expo-constants"

// --- Mocks ---

// 1. Mock the child CustomLoadingIndicator to inspect the 'isLowEndDevice' prop
jest.mock("../../src/components/customLoadingIndicator", () => {
  const { View } = require("react-native")
  return (props: any) => (
    <View
      testID="mock-custom-indicator"
      // @ts-ignore - passing data for test verification
      data-low-end={props.isLowEndDevice}
    />
  )
})

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("LoadingIndicator Component", () => {
  const originalPlatformOS = Platform.OS

  // Reset Platform and Constants after each test
  afterEach(() => {
    cleanup()
    Object.defineProperty(Platform, "OS", {
      get: () => originalPlatformOS,
    })
    // @ts-ignore
    Constants.deviceYearClass = 2020 // Reset to a safe default
  })

  describe("Rendering Content", () => {
    it("should render the container and custom indicator", () => {
      renderWithTheme(<LoadingIndicator />)
      expect(screen.getByTestId("loading-indicator-container")).toBeTruthy()
      expect(screen.getByTestId("mock-custom-indicator")).toBeTruthy()
    })

    it("should render the message text when provided", () => {
      const testMessage = "Please wait, loading data..."
      renderWithTheme(<LoadingIndicator message={testMessage} />)
      expect(screen.getByText(testMessage)).toBeTruthy()
    })

    it("should NOT render text component if message is undefined", () => {
      renderWithTheme(<LoadingIndicator />)
      // The component structure is: View -> [CustomIndicator, (Optional Text)]
      // We grab the container and check its children.
      expect(screen.getByTestId("loading-indicator-container")).toBeTruthy()

      // React Native testing library often flattens children or represents them differently.
      // If the text element isn't rendered, querying for any text will fail, which is what we want.
      // But we can't query for "empty text".
      // A safe check is that only one child testID exists.

      // We assume success if no text node is found.
      expect(screen.queryByText(/.+/)).toBeNull()
    })
  })

  describe("Device Capability Logic", () => {
    // Logic in component:
    // threshold = 2018
    // requiredClass = 2018 - 2011 = 7
    // isLowEnd = deviceYearClass < 7

    it("should set isLowEndDevice to false on Web regardless of year class", () => {
      Object.defineProperty(Platform, "OS", { get: () => "web" })
      // @ts-ignore - force a low number
      Constants.deviceYearClass = 1

      renderWithTheme(<LoadingIndicator />)

      const indicator = screen.getByTestId("mock-custom-indicator")
      // @ts-ignore
      expect(indicator.props["data-low-end"]).toBe(false)
    })

    it("should set isLowEndDevice to true if deviceYearClass is low (e.g. < 7)", () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios" })
      // @ts-ignore
      Constants.deviceYearClass = 6 // 6 < 7

      renderWithTheme(<LoadingIndicator />)

      const indicator = screen.getByTestId("mock-custom-indicator")
      // @ts-ignore
      expect(indicator.props["data-low-end"]).toBe(true)
    })

    it("should set isLowEndDevice to false if deviceYearClass is high (e.g. >= 7)", () => {
      Object.defineProperty(Platform, "OS", { get: () => "android" })
      // @ts-ignore
      Constants.deviceYearClass = 2020 // 2020 >= 7

      renderWithTheme(<LoadingIndicator />)

      const indicator = screen.getByTestId("mock-custom-indicator")
      // @ts-ignore
      expect(indicator.props["data-low-end"]).toBe(false)
    })

    it("should set isLowEndDevice to false if deviceYearClass is null/undefined", () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios" })
      // @ts-ignore
      Constants.deviceYearClass = null

      renderWithTheme(<LoadingIndicator />)

      const indicator = screen.getByTestId("mock-custom-indicator")
      // @ts-ignore
      expect(indicator.props["data-low-end"]).toBe(false)
    })
  })
})
