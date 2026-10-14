import React, { ReactElement } from "react"
import { Text } from "react-native"
import {
  render,
  screen,
  fireEvent,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import { PickerUI } from "../../src/components/pickerUI"
import { BasicTriviaItem } from "../../src/models/trivia"

// --- Mocks ---

// Mock FlashList to render items simply
jest.mock("@shopify/flash-list", () => {
  const { View } = require("react-native")
  return {
    FlashList: ({ data, renderItem, onContentSizeChange }: any) => (
      <View testID="flash-list" onContentSizeChange={onContentSizeChange}>
        {data.map((item: any, index: number) => (
          <View key={item.id}>{renderItem({ item, index })}</View>
        ))}
      </View>
    ),
  }
})

// Mock Reanimated: useAnimatedStyle just passes styles through
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native")
  return {
    ...jest.requireActual("react-native-reanimated/mock"),
    default: {
      View: View,
      Text: View, // if Text is animated
    },
  }
})

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

// --- Mock Data ---
const mockResults: BasicTriviaItem[] = [
  { id: 1, title: "Movie A", releaseDate: "2000", posterPath: "/a.jpg" },
  { id: 2, title: "Movie B", releaseDate: "2001", posterPath: "/b.jpg" },
]

const mockRenderItem = ({ item }: any) => (
  <Text testID={`item-${item.id}`}>{item.title}</Text>
)
const mockHandleInputChange = jest.fn()

describe("PickerUI Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Search Input", () => {
    it("should render the input with placeholder and query", () => {
      renderWithTheme(
        <PickerUI
          query="Inception"
          isSearching={false}
          results={[]}
          showResults={false}
          animatedInputStyle={{}}
          isInteractionsDisabled={false}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      const input = screen.getByPlaceholderText("Search...")
      expect(input.props.value).toBe("Inception")
      expect(input.props.editable).toBe(true)
    })

    it("should be disabled when isInteractionsDisabled is true", () => {
      renderWithTheme(
        <PickerUI
          query=""
          isSearching={false}
          results={[]}
          showResults={false}
          animatedInputStyle={{}}
          isInteractionsDisabled={true}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      const input = screen.getByPlaceholderText("Search...")
      expect(input.props.editable).toBe(false)
    })

    it("should call handleInputChange when text changes", () => {
      renderWithTheme(
        <PickerUI
          query=""
          isSearching={false}
          results={[]}
          showResults={false}
          animatedInputStyle={{}}
          isInteractionsDisabled={false}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      const input = screen.getByPlaceholderText("Search...")
      fireEvent.changeText(input, "Matrix")
      expect(mockHandleInputChange).toHaveBeenCalledWith("Matrix")
    })

    it("should show activity indicator when isSearching is true", () => {
      renderWithTheme(
        <PickerUI
          query="Mat"
          isSearching={true}
          results={[]}
          showResults={true}
          animatedInputStyle={{}}
          isInteractionsDisabled={false}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      // ActivityIndicator usually doesn't have text, but we can check for existence
      // or check that "Searching..." text appears in the results container if implemented that way.
      // Looking at source: `isSearching` triggers an ActivityIndicator inside inputContainer
      // AND "Searching..." text in resultsContainer if showResults is true.

      // Check for ActivityIndicator (implicit role='progressbar' or similar, but default RN mock is simple)
      // We can just check if the text "Searching..." is present as per source logic:
      // {isSearching ? <Text...>Searching...</Text> : ...}

      expect(screen.getByText("Searching...")).toBeTruthy()
    })
  })

  describe("Results List", () => {
    it("grows for measured wrapped/expanded content and shrinks when it collapses", () => {
      renderWithTheme(<PickerUI query="Mo" isSearching={false} results={mockResults}
        showResults animatedInputStyle={{}} isInteractionsDisabled={false}
        handleInputChange={mockHandleInputChange} renderItem={mockRenderItem} placeholder="Search..." />)
      fireEvent(screen.getByTestId("flash-list"), "contentSizeChange", 350, 180)
      expect(screen.getByTestId("search-results-viewport")).toHaveStyle({ height: 180 })
      fireEvent(screen.getByTestId("flash-list"), "contentSizeChange", 350, 120)
      expect(screen.getByTestId("search-results-viewport")).toHaveStyle({ height: 120 })
      fireEvent(screen.getByTestId("flash-list"), "contentSizeChange", 350, 10000)
      const boundedHeight = screen.getByTestId("search-results-viewport").props.style.height
      expect(boundedHeight).toBeGreaterThan(180)
      expect(boundedHeight).toBeLessThan(10000)
      fireEvent(screen.getByTestId("flash-list"), "contentSizeChange", 350, 0)
      expect(screen.getByTestId("search-results-viewport")).toHaveStyle({ height: boundedHeight })
    })

    it("should NOT render results container if showResults is false", () => {
      renderWithTheme(
        <PickerUI
          query="Mat"
          isSearching={false}
          results={mockResults}
          showResults={false} // Key prop
          animatedInputStyle={{}}
          isInteractionsDisabled={false}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      expect(screen.queryByTestId("flash-list")).toBeNull()
    })

    it("should render the list of results when showResults is true and results exist", () => {
      renderWithTheme(
        <PickerUI
          query="Mo"
          isSearching={false}
          results={mockResults}
          showResults={true}
          animatedInputStyle={{}}
          isInteractionsDisabled={false}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      expect(screen.getByTestId("flash-list")).toBeTruthy()
      expect(screen.getByText("Movie A")).toBeTruthy()
      expect(screen.getByText("Movie B")).toBeTruthy()

      // Should also show the hint text
      expect(screen.getByText(/Hold any result to preview/)).toBeTruthy()
    })

    it("should render 'No titles found' if results are empty and query is long enough", () => {
      renderWithTheme(
        <PickerUI
          query="Zxywq"
          isSearching={false}
          results={[]}
          showResults={true}
          animatedInputStyle={{}}
          isInteractionsDisabled={false}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      expect(screen.getByText(/No titles found for "Zxywq"/)).toBeTruthy()
    })

    it("explains an empty result even for a single character", () => {
      renderWithTheme(
        <PickerUI
          query="Z"
          isSearching={false}
          results={[]}
          showResults={true} // Container might set this true? Logic says `showResults` is passed in.
          // Source logic: query.length >= 2 ? <NoResults> : null
          animatedInputStyle={{}}
          isInteractionsDisabled={false}
          handleInputChange={mockHandleInputChange}
          renderItem={mockRenderItem}
          placeholder="Search..."
        />
      )

      expect(screen.getByText(/No titles found/)).toBeTruthy()
    })
  })
})
