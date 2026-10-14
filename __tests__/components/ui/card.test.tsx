import React, { ReactElement } from "react"
import { Text } from "react-native"
import { render, screen, RenderOptions } from "@testing-library/react-native"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { Card } from "../../../src/components/ui/card"
import { darkColors } from "../../../src/styles/themes"

const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("UI Component: Card", () => {
  it("should render children content", () => {
    renderWithTheme(
      <Card>
        <Text>Card Content</Text>
      </Card>
    )
    expect(screen.getByText("Card Content")).toBeTruthy()
  })

  it("should apply basic card styles from theme", () => {
    renderWithTheme(
      <Card testID="card-container">
        <Text>Styled Card</Text>
      </Card>
    )

    const cardView = screen.getByTestId("card-container")

    // Card styles are an array [cardStyle, userStyle]
    // We check that the array contains the theme-based object
    expect(cardView.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: darkColors.surface,
          // borderRadius is calculated using responsive.scale, so we just check it exists
          borderRadius: expect.any(Number),
        }),
      ])
    )
  })

  it("should accept custom styles", () => {
    renderWithTheme(
      <Card style={{ marginTop: 20 }} testID="card-container">
        <Text>Margin Card</Text>
      </Card>
    )
    const cardView = screen.getByTestId("card-container")

    expect(cardView.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 20 })])
    )
  })
})
