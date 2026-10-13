import React, { ReactElement } from "react"
import {
  render,
  screen,
  fireEvent,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import PickerItem from "../../src/components/pickerItem"
import { BasicTriviaItem, TriviaItem } from "../../src/models/trivia"
import { API_CONFIG } from "../../src/config/constants"
import { Platform } from "react-native"

// --- Mocks ---

import { LayoutAnimation } from "react-native"
jest.spyOn(LayoutAnimation, "configureNext").mockImplementation(jest.fn())

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

// --- Mock Data ---
const mockBasicItem: BasicTriviaItem = {
  id: 1,
  title: "The Matrix",
  releaseDate: "1999-03-31",
  posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
}

const mockDetailedItem: TriviaItem = {
  id: 1,
  title: "The Matrix",
  description: "A computer hacker learns...",
  posterPath: "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  releaseDate: "1999-03-31",
  metadata: {},
  hints: [],
}

const mockOnSelect = jest.fn()
const mockOnLongPress = jest.fn()

describe("PickerItem Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Collapsed State (Default)", () => {
    it("should render the basic info correctly", () => {
      renderWithTheme(
        <PickerItem
          item={mockBasicItem}
          detailedItem={null}
          isDisabled={false}
          isExpanded={false}
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      // Check title and year formatting
      expect(screen.getByText("The Matrix (1999)")).toBeTruthy()

      // Check Image source
      const image = screen.getByTestId("mock-expo-image")
      expect(image.props["data-source"]).toBe(
        `${API_CONFIG.TMDB_IMAGE_BASE_URL_W92}${mockBasicItem.posterPath}`
      )
    })

    it("should use a default image if posterPath is missing", () => {
      const itemNoPoster = { ...mockBasicItem, posterPath: "" }
      renderWithTheme(
        <PickerItem
          item={itemNoPoster}
          detailedItem={null}
          isDisabled={false}
          isExpanded={false}
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      const image = screen.getByTestId("mock-expo-image")
      // In Jest mocks for require(), images usually resolve to 1
      expect(image.props.source).toBe(1)
    })

    it("should NOT render expanded details", () => {
      renderWithTheme(
        <PickerItem
          item={mockBasicItem}
          detailedItem={mockDetailedItem} // Even if data exists...
          isDisabled={false}
          isExpanded={false} // ...it shouldn't show if isExpanded is false
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      expect(screen.queryByText("Tap this item to select.")).toBeNull()
    })
  })

  describe("Expanded State", () => {
    it("should render expanded details when isExpanded is true and detailedItem is provided", () => {
      renderWithTheme(
        <PickerItem
          item={mockBasicItem}
          detailedItem={mockDetailedItem}
          isDisabled={false}
          isExpanded={true}
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      // Should show the detailed view content
      expect(screen.getByText("Tap this item to select.")).toBeTruthy()
      expect(screen.getByText("Release Year: 1999")).toBeTruthy()

      // Should show the larger image
      const images = screen.getAllByTestId("mock-expo-image")
      // First is the small thumbnail, second is the expanded preview
      const expandedImage = images[1]
      expect(expandedImage.props["data-source"]).toBe(
        `${API_CONFIG.TMDB_IMAGE_BASE_URL_W500}${mockBasicItem.posterPath}`
      )
    })

    it("should trigger LayoutAnimation when expansion state changes", () => {
      const { configureNext } = require("react-native").LayoutAnimation

      // Initial render
      const { rerender } = renderWithTheme(
        <PickerItem
          item={mockBasicItem}
          detailedItem={null}
          isDisabled={false}
          isExpanded={false}
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      // It runs once on mount
      if (Platform.OS !== "web") {
        expect(configureNext).toHaveBeenCalledTimes(1)
      }

      // Update prop to expand
      rerender(
        <ThemeProvider>
          <PickerItem
            item={mockBasicItem}
            detailedItem={mockDetailedItem}
            isDisabled={false}
            isExpanded={true}
            onSelect={mockOnSelect}
            onLongPress={mockOnLongPress}
          />
        </ThemeProvider>
      )

      // It should run again on update
      if (Platform.OS !== "web") {
        expect(configureNext).toHaveBeenCalledTimes(2)
      }
    })
  })

  describe("Interactions", () => {
    it("should call onSelect with the item when pressed", () => {
      renderWithTheme(
        <PickerItem
          item={mockBasicItem}
          detailedItem={null}
          isDisabled={false}
          isExpanded={false}
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      fireEvent.press(screen.getByRole("button"))
      expect(mockOnSelect).toHaveBeenCalledWith(mockBasicItem)
    })

    it("should call onLongPress with the item when long pressed", () => {
      renderWithTheme(
        <PickerItem
          item={mockBasicItem}
          detailedItem={null}
          isDisabled={false}
          isExpanded={false}
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      const pressable = screen.getByRole("button")
      fireEvent(pressable, "longPress")
      expect(mockOnLongPress).toHaveBeenCalledWith(mockBasicItem)
    })

    it("should be disabled when isDisabled is true", () => {
      renderWithTheme(
        <PickerItem
          item={mockBasicItem}
          detailedItem={null}
          isDisabled={true}
          isExpanded={false}
          onSelect={mockOnSelect}
          onLongPress={mockOnLongPress}
        />
      )

      const pressable = screen.getByRole("button")
      expect(pressable.props.accessibilityState.disabled).toBe(true)

      fireEvent.press(pressable)
    })
  })
})
