import React, { ReactElement } from "react"
import {
  render,
  screen,
  fireEvent,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { Button } from "../../../src/components/ui/button"
import { lightColors } from "../../../src/styles/themes"

// Custom Render Helper
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("UI Component: Button", () => {
  const mockOnPress = jest.fn()

  beforeEach(() => {
    mockOnPress.mockClear()
  })

  describe("Rendering and Variants", () => {
    it("should render the title correctly", () => {
      renderWithTheme(<Button title="Click Me" onPress={mockOnPress} />)
      expect(screen.getByText("Click Me")).toBeTruthy()
    })

    it("should apply primary variant styles by default", () => {
      renderWithTheme(<Button title="Primary" onPress={mockOnPress} />)
      const button = screen.getByRole("button")

      // Check background color for primary
      expect(button.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: lightColors.primary }),
        ])
      )
    })

    it("should apply secondary variant styles", () => {
      renderWithTheme(
        <Button title="Secondary" variant="secondary" onPress={mockOnPress} />
      )
      const button = screen.getByRole("button")
      const text = screen.getByText("Secondary")

      // Secondary usually has transparent bg and primary border/text
      expect(button.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            backgroundColor: "transparent",
            borderColor: lightColors.primary,
          }),
        ])
      )
      expect(text.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: lightColors.accentText }),
        ])
      )
    })
  })

  describe("Interaction and State", () => {
    it("should call onPress when clicked", () => {
      renderWithTheme(<Button title="Press Me" onPress={mockOnPress} />)
      fireEvent.press(screen.getByRole("button"))
      expect(mockOnPress).toHaveBeenCalledTimes(1)
    })

    it("should not call onPress when disabled", () => {
      renderWithTheme(
        <Button title="Disabled" disabled={true} onPress={mockOnPress} />
      )
      fireEvent.press(screen.getByRole("button"))
      expect(mockOnPress).not.toHaveBeenCalled()
    })

    it("should show loading indicator and hide text when isLoading is true", () => {
      renderWithTheme(
        <Button title="Loading" isLoading={true} onPress={mockOnPress} />
      )

      // Spinner should be present
      expect(screen.getByTestId("activity-indicator")).toBeTruthy()

      // Text should NOT be present
      expect(screen.queryByText("Loading")).toBeNull()
    })

    it("should not trigger onPress when isLoading is true", () => {
      renderWithTheme(
        <Button title="Loading" isLoading={true} onPress={mockOnPress} />
      )
      fireEvent.press(screen.getByRole("button"))
      expect(mockOnPress).not.toHaveBeenCalled()
    })
  })
})
