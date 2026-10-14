import React, { ReactElement } from "react"
import { render, screen, RenderOptions } from "@testing-library/react-native"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { EmptyGuessTile } from "../../../src/components/guess/emptyGuessTile"

const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("Guess Component: EmptyGuessTile", () => {
  it("should render the correct guess number based on index", () => {
    // Index 0 should display "1", Index 4 should display "5"
    const { rerender } = renderWithTheme(<EmptyGuessTile index={0} />)
    expect(screen.getByText("1")).toBeTruthy()

    rerender(
      <ThemeProvider>
        <EmptyGuessTile index={4} />
      </ThemeProvider>
    )
    expect(screen.getByText("5")).toBeTruthy()
  })

  it("should have dashed border styling", () => {
    renderWithTheme(<EmptyGuessTile index={0} testID="empty-tile" />)

    const container = screen.getByTestId("empty-tile")

    expect(container.props.style).toEqual(
      expect.objectContaining({
        borderStyle: "dashed",
        borderWidth: 1,
      })
    )
  })
})
