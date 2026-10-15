import { ReactElement } from "react"
import {
  render,
  screen,
  cleanup,
  within,
  RenderOptions,
  fireEvent,
} from "@testing-library/react-native"
import { Animated, Platform } from "react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import CustomLoadingIndicator from "../../src/components/customLoadingIndicator"
import { darkColors } from "../../src/styles/themes"
import { responsive } from "../../src/styles/global"

// Mock react-native-svg to test its props without actual rendering
jest.mock("react-native-svg", () => {
  const { View } = require("react-native")

  const createMockSvgComponent = (name: string) => {
    return (props: any) => (
      <View testID={`mock-svg-${name.toLowerCase()}`} {...props} />
    )
  }

  return {
    Svg: createMockSvgComponent("Svg"),
    Circle: createMockSvgComponent("Circle"),
  }
})

// Custom Render Helper with ThemeProvider
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("CustomLoadingIndicator Component", () => {
  // Store original Platform.OS to restore it after tests
  const originalPlatformOS = Platform.OS

  afterEach(() => {
    cleanup()
    // Restore original Platform.OS after each test
    Object.defineProperty(Platform, "OS", {
      get: () => originalPlatformOS,
    })
  })

  describe("Fallback to Standard ActivityIndicator", () => {
    it("should render the standard ActivityIndicator when isLowEndDevice is true", () => {
      renderWithTheme(<CustomLoadingIndicator isLowEndDevice={true} />)

      expect(screen.getByTestId("standard-activity-indicator")).toBeTruthy()
      expect(screen.queryByTestId("activity-indicator")).toBeNull()
    })

    it("should render the standard ActivityIndicator on the web platform", () => {
      Object.defineProperty(Platform, "OS", { get: () => "web" })

      renderWithTheme(<CustomLoadingIndicator />)

      expect(screen.getByTestId("standard-activity-indicator")).toBeTruthy()
      expect(screen.queryByTestId("activity-indicator")).toBeNull()
    })

    it("should still render the standard ActivityIndicator on web even if isLowEndDevice is false", () => {
      Object.defineProperty(Platform, "OS", { get: () => "web" })

      renderWithTheme(<CustomLoadingIndicator isLowEndDevice={false} />)

      expect(screen.getByTestId("standard-activity-indicator")).toBeTruthy()
      expect(screen.queryByTestId("activity-indicator")).toBeNull()
    })
  })

  describe("Custom SVG Indicator Rendering", () => {
    beforeEach(() => {
      // Ensure tests in this block run as if on a native platform
      Object.defineProperty(Platform, "OS", { get: () => "ios" })
    })

    it("starts after native layout and stops its loop when removed", () => {
      const start = jest.fn()
      const stop = jest.fn()
      const loop = jest.spyOn(Animated, "loop").mockReturnValue({ start, stop, reset: jest.fn() })
      try {
        const { unmount } = renderWithTheme(<CustomLoadingIndicator />)
        expect(start).not.toHaveBeenCalled()
        fireEvent(screen.getByTestId("loading-ring"), "layout", {
          nativeEvent: { layout: { x: 0, y: 0, width: 50, height: 50 } },
        })
        expect(start).toHaveBeenCalledTimes(1)
        unmount()
        expect(stop).toHaveBeenCalledTimes(1)
      } finally {
        loop.mockRestore()
      }
    })

    it("can switch to the standard indicator after mounting", () => {
      const { rerender } = renderWithTheme(<CustomLoadingIndicator />)

      rerender(
        <ThemeProvider>
          <CustomLoadingIndicator isLowEndDevice />
        </ThemeProvider>
      )

      expect(screen.getByTestId("standard-activity-indicator")).toBeTruthy()
      expect(screen.queryByTestId("activity-indicator")).toBeNull()
    })

    it("should render the custom SVG indicator on a non-low-end native device by default", () => {
      renderWithTheme(<CustomLoadingIndicator />)

      expect(screen.getByTestId("activity-indicator")).toBeTruthy()
      expect(screen.queryByTestId("standard-activity-indicator")).toBeNull()
    })

    it("should render the Svg component with two Circle components inside", () => {
      renderWithTheme(<CustomLoadingIndicator />)

      const customIndicator = screen.getByTestId("activity-indicator")
      const svgContainer = within(customIndicator).getByTestId("mock-svg-svg")
      const circles = within(svgContainer).getAllByTestId("mock-svg-circle")

      expect(circles).toHaveLength(2)
    })

    it("should have correctly calculated props on the Circle components", () => {
      renderWithTheme(<CustomLoadingIndicator />)
      const colors = darkColors

      // Replicate the calculations from the component to verify props
      const size = responsive.scale(50)
      const strokeWidth = responsive.scale(4)
      const radius = size / 2 - strokeWidth / 2
      const circumference = 2 * Math.PI * radius

      const circles = screen.getAllByTestId("mock-svg-circle")
      const [circle1, circle2] = circles

      // Check Circle 1 (Primary color)
      expect(circle1.props.stroke).toBe(colors.primary)
      expect(circle1.props.strokeWidth).toBe(strokeWidth)
      expect(circle1.props.strokeDasharray).toBe(circumference)
      expect(circle1.props.strokeDashoffset).toBe(circumference * 0.25)
      expect(circle1.props.strokeLinecap).toBe("round")

      // Check Circle 2 (Tertiary color)
      expect(circle2.props.stroke).toBe(colors.tertiary)
      expect(circle2.props.strokeWidth).toBe(strokeWidth)
      expect(circle2.props.strokeDasharray).toBe(circumference)
      expect(circle2.props.strokeDashoffset).toBe(circumference * 0.75)
      expect(circle2.props.strokeLinecap).toBe("round")
    })
  })

  describe("Accessibility", () => {
    it("should have the correct accessibility props for the custom indicator", () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios" })

      renderWithTheme(<CustomLoadingIndicator />)

      const customIndicator = screen.getByTestId("activity-indicator")
      expect(customIndicator.props.accessibilityLabel).toBe("Loading content")
      expect(customIndicator.props.accessibilityRole).toBe("progressbar")
    })
  })
})
