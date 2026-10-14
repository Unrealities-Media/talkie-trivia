import React, { ReactElement } from "react"
import { render, screen, RenderOptions } from "@testing-library/react-native"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { Typography } from ",./../../src/components/ui/typography"
import { darkColors } from "../../../src/styles/themes"

const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("UI Component: Typography", () => {
  it("should render children text correctly", () => {
    renderWithTheme(<Typography>Hello World</Typography>)
    expect(screen.getByText("Hello World")).toBeTruthy()
  })

  it("should render body variant by default", () => {
    renderWithTheme(<Typography>Body Text</Typography>)
    const text = screen.getByText("Body Text")

    // Body text usually has PremiereSans
    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontFamily: "PremiereSans",
          color: darkColors.textSecondary,
        }),
      ])
    )
  })

  it("should render h1 variant with bold font", () => {
    renderWithTheme(<Typography variant="h1">Header 1</Typography>)
    const text = screen.getByText("Header 1")

    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fontFamily: "PremiereDisplay-Bold",
          color: darkColors.textPrimary,
        }),
      ])
    )
  })

  it("should render error variant with error color", () => {
    renderWithTheme(<Typography variant="error">Error Message</Typography>)
    const text = screen.getByText("Error Message")

    expect(text.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: darkColors.error }),
      ])
    )
  })

  it("should accept and merge custom style props", () => {
    renderWithTheme(
      <Typography style={{ fontSize: 99 }}>Custom Size</Typography>
    )
    const text = screen.getByText("Custom Size")

    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 99 })])
    )
  })
})
