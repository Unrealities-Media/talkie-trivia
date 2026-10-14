import React, { ReactElement } from "react"
import {
  render,
  fireEvent,
  screen,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import HintUI from "../../src/components/hintUI"
import { Hint } from "../../src/models/trivia"

// --- Mocks ---
jest.mock("../../src/components/hintButton", () => {
  const { View } = require("react-native")
  return (props: any) => (
    <View
      testID={`mock-hint-button-${props.hintType}`}
      // @ts-ignore
      data-label={props.label}
      // @ts-ignore
      data-status={props.status}
    />
  )
})

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

// --- Mock Data ---
const mockHints: Hint[] = [
  { type: "director", label: "Director", value: "Spielberg" },
  { type: "genre", label: "Genre", value: "Action" },
]

const mockHintStatuses = {
  director: "available",
  genre: "disabled",
} as const

describe("HintUI Component", () => {
  const mockHandleToggle = jest.fn()
  const mockHandleSelection = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Rendering", () => {
    it("should render the toggle label", () => {
      renderWithTheme(
        <HintUI
          showHintOptions={false}
          displayedHintText={null}
          hintLabelText="Need a Hint?"
          isToggleDisabled={false}
          hintsAvailable={3}
          hintStatuses={mockHintStatuses}
          highlightedHint={null}
          handleToggleHintOptions={mockHandleToggle}
          handleHintSelection={mockHandleSelection}
          allHints={mockHints}
        />
      )

      expect(screen.getByText("Hint · 3 left")).toBeTruthy()
      expect(screen.getByLabelText("Need a Hint?")).toBeTruthy()
    })

    it("should render the correct number of HintButtons based on allHints prop", () => {
      renderWithTheme(
        <HintUI
          showHintOptions={true}
          displayedHintText={null}
          hintLabelText="Toggle Hints"
          isToggleDisabled={false}
          hintsAvailable={3}
          hintStatuses={mockHintStatuses}
          highlightedHint={null}
          handleToggleHintOptions={mockHandleToggle}
          handleHintSelection={mockHandleSelection}
          allHints={mockHints}
        />
      )

      expect(screen.getByTestId("mock-hint-button-director")).toBeTruthy()
      expect(screen.getByTestId("mock-hint-button-genre")).toBeTruthy()
    })

    it("should display the hint text when provided", () => {
      const hintText = "This is the hint text."
      renderWithTheme(
        <HintUI
          showHintOptions={false}
          displayedHintText={hintText}
          hintLabelText="Toggle Hints"
          isToggleDisabled={false}
          hintsAvailable={2}
          hintStatuses={mockHintStatuses}
          highlightedHint={null}
          handleToggleHintOptions={mockHandleToggle}
          handleHintSelection={mockHandleSelection}
          allHints={mockHints}
        />
      )

      expect(screen.getByText(hintText)).toBeTruthy()
    })
  })

  describe("Interactions", () => {
    it("should call handleToggleHintOptions when label is pressed", () => {
      renderWithTheme(
        <HintUI
          showHintOptions={false}
          displayedHintText={null}
          hintLabelText="Click Me"
          isToggleDisabled={false}
          hintsAvailable={3}
          hintStatuses={mockHintStatuses}
          highlightedHint={null}
          handleToggleHintOptions={mockHandleToggle}
          handleHintSelection={mockHandleSelection}
          allHints={mockHints}
        />
      )

      fireEvent.press(screen.getByLabelText("Click Me"))
      expect(mockHandleToggle).toHaveBeenCalledTimes(1)
    })

    it("should disable the toggle press when isToggleDisabled is true", () => {
      renderWithTheme(
        <HintUI
          showHintOptions={false}
          displayedHintText={null}
          hintLabelText="Disabled Label"
          isToggleDisabled={true}
          hintsAvailable={0}
          hintStatuses={mockHintStatuses}
          highlightedHint={null}
          handleToggleHintOptions={mockHandleToggle}
          handleHintSelection={mockHandleSelection}
          allHints={mockHints}
        />
      )

      fireEvent.press(screen.getByText("Disabled Label"))
      expect(mockHandleToggle).not.toHaveBeenCalled()
    })
  })
})
