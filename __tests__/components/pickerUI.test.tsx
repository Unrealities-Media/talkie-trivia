import React, { ReactElement } from "react"
import { Text, Dimensions } from "react-native"
import { responsive, spacing } from "../../src/styles/global"
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
    it("keeps results visible at zero startup size and updates after resize", () => {
      const dimensions = jest.spyOn(require("react-native"), "useWindowDimensions")
      dimensions.mockReturnValue({ width: 0, height: 0, scale: 1, fontScale: 1 })
      const props = { query: "Mo", isSearching: false, results: mockResults,
        showResults: true, animatedInputStyle: {}, isInteractionsDisabled: false,
        handleInputChange: mockHandleInputChange, renderItem: mockRenderItem, placeholder: "Search..." }
      try {
        const { rerender } = renderWithTheme(<PickerUI {...props} />)
        fireEvent(screen.getByTestId("flash-list"), "contentSizeChange", 350, 1000)
        expect(screen.getByTestId("search-results-viewport").props.style.height).toBeGreaterThan(0)
        dimensions.mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 })
        rerender(<ThemeProvider><PickerUI {...props} query="Movie" /></ThemeProvider>)
        expect(screen.getByTestId("search-results-viewport")).toHaveStyle({ height: 360 })
        dimensions.mockReturnValue({ width: 320, height: 568, scale: 1, fontScale: 1 })
        rerender(<ThemeProvider><PickerUI {...props} query="Movies" /></ThemeProvider>)
        expect(screen.getByTestId("search-results-viewport").props.style.height).toBeCloseTo(227.2)
      } finally {
        dimensions.mockRestore()
      }
    })

    it("recovers shared sizing from unavailable dimensions without reloading modules", () => {
      const dimensions = Dimensions.get as jest.Mock
      const originalImplementation = dimensions.getMockImplementation()
      try {
        dimensions.mockReturnValue({ width: 0, height: 0, scale: 1, fontScale: 1 })
        expect(responsive.scale(250)).toBeGreaterThan(0)
        expect(spacing.medium).toBeGreaterThan(0)
        dimensions.mockReturnValue({ width: 750, height: 1624, scale: 1, fontScale: 1 })
        expect(responsive.scale(250)).toBe(500)
        expect(spacing.medium).toBe(32)
        expect(responsive.screenWidth).toBe(750)
      } finally {
        dimensions.mockImplementation(originalImplementation!)
      }
    })

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

      // Search results do not add another instruction footer.
      expect(screen.queryByText(/Hold any result to preview/)).toBeNull()
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
