import React, { ReactElement } from "react"
import {
  render,
  screen,
  fireEvent,
  act,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import PickerContainer from "../../src/components/picker"
import { useGameStore } from "../../src/state/gameStore"
import { hapticsService } from "../../src/utils/hapticsService"
import { BasicTriviaItem, TriviaItem } from "../../src/models/trivia"

// --- Mocks ---

// 2. Mock `hapticsService`
jest.mock("../../src/utils/hapticsService", () => ({
  hapticsService: {
    light: jest.fn(),
    medium: jest.fn(),
    heavy: jest.fn(),
  },
}))

// 3. Mock `useGameStore` and `zustand/react/shallow`
jest.mock("../../src/state/gameStore")
jest.mock("zustand/react/shallow", () => ({
  useShallow: (fn: any) => fn,
}))

// 4. Mock Child Components to expose event handlers
// This allows us to trigger the container's logic via props passed to children.

// Mock PickerUI: Renders an input to drive query, and a list to drive item rendering
jest.mock("../../src/components/pickerUI", () => {
  const { View, TextInput } = require("react-native")
  return {
    PickerUI: ({
      handleInputChange,
      renderItem,
      results,
      query,
      placeholder,
    }: any) => (
      <View testID="mock-picker-ui">
        <TextInput
          testID="mock-input"
          value={query}
          onChangeText={handleInputChange}
          placeholder={placeholder}
        />
        {/* We manually render the list items using the container's renderItem prop */}
        {results &&
          results.map((item: any, index: number) => (
            <View key={item.id}>{renderItem({ item, index })}</View>
          ))}
      </View>
    ),
  }
})

// Mock PickerItem: Renders pressables to drive selection logic
jest.mock("../../src/components/pickerItem", () => {
  const { View, Text, Pressable } = require("react-native")
  return (props: any) => (
    <Pressable
      testID={`picker-item-${props.item.id}`}
      onPress={() => props.onSelect(props.item)}
      onLongPress={() => props.onLongPress(props.item)}
    >
      <Text>{props.item.title}</Text>
      {props.isExpanded && <Text>EXPANDED_DETAILS</Text>}
      {props.isDisabled && <Text>DISABLED</Text>}
    </Pressable>
  )
})

// Mock PickerSkeleton
jest.mock("../../src/components/pickerSkeleton", () => {
  const { View } = require("react-native")
  return () => <View testID="mock-picker-skeleton" />
})

// Mock TutorialTooltip
jest.mock("../../src/components/tutorialTooltip", () => {
  const { View, Text } = require("react-native")
  return ({ isVisible, text }: any) =>
    isVisible ? <Text testID="mock-tooltip">{text}</Text> : null
})

// --- Test Data ---
const mockBasicItems: BasicTriviaItem[] = [
  { id: 9, title: "9", releaseDate: "2009", posterPath: "" },
  {
    id: 1,
    title: "Inception",
    releaseDate: "2010",
    posterPath: "/inception.jpg",
  },
  {
    id: 2,
    title: "Interstellar",
    release_date: "2014",
    poster_path: "/interstellar.jpg",
  } as any, // casting for mismatch prop names in some mocks
]

const mockFullItems: TriviaItem[] = [
  {
    id: 1,
    title: "Inception",
    description: "Dreams...",
    posterPath: "/inception.jpg",
    releaseDate: "2010",
    metadata: {},
    hints: [],
  },
]

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

const mockUseGameStore = useGameStore as unknown as jest.Mock
const mockMakeGuess = jest.fn()
const mockDismissGuessInputTip = jest.fn()

const defaultStoreState = {
  isInteractionsDisabled: false,
  basicItems: mockBasicItems,
  fullItems: mockFullItems,
  makeGuess: mockMakeGuess,
  loading: false,
  tutorialState: { showGuessInputTip: false, showResultsTip: false },
  dismissGuessInputTip: mockDismissGuessInputTip,
  dismissResultsTip: jest.fn(),
  gameMode: "movies",
  playerGame: { id: "movies_2026-10-13", playerID: "guest", guesses: [] },
}

describe("PickerContainer Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockUseGameStore.mockImplementation((selector: any) =>
      selector(defaultStoreState)
    )
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("Rendering", () => {
    it("should render Skeleton when loading is true", () => {
      mockUseGameStore.mockImplementation((selector: any) =>
        selector({ ...defaultStoreState, loading: true })
      )
      renderWithTheme(<PickerContainer />)
      expect(screen.getByTestId("mock-picker-skeleton")).toBeTruthy()
      expect(screen.queryByTestId("mock-picker-ui")).toBeNull()
    })

    it("should render PickerUI when loading is false", () => {
      renderWithTheme(<PickerContainer />)
      expect(screen.getByTestId("mock-picker-ui")).toBeTruthy()
      // Check if placeholder text is passed correctly based on game mode
      expect(
        screen.getByPlaceholderText("Search for a movie title...")
      ).toBeTruthy()
    })

    it("should show tutorial tooltip if enabled in state", () => {
      mockUseGameStore.mockImplementation((selector: any) =>
        selector({
          ...defaultStoreState,
          tutorialState: { showGuessInputTip: true },
        })
      )
      renderWithTheme(<PickerContainer />)
      expect(screen.getByTestId("mock-tooltip")).toBeTruthy()
    })
  })

  describe("Search Logic", () => {
    it("allows a one-character exact title to be guessed", () => {
      renderWithTheme(<PickerContainer />)
      fireEvent.changeText(screen.getByTestId("mock-input"), "9")
      act(() => jest.advanceTimersByTime(300))
      fireEvent.press(screen.getByTestId("picker-item-9"))
      expect(mockMakeGuess).toHaveBeenCalledWith(mockBasicItems[0])
    })
    it("rejects duplicate selections even if a stale row invokes its handler", () => {
      mockUseGameStore.mockImplementation((selector: any) => selector({ ...defaultStoreState,
        playerGame: { ...defaultStoreState.playerGame, guesses: [{ itemId: 1 }] } }))
      renderWithTheme(<PickerContainer />)
      fireEvent.changeText(screen.getByTestId("mock-input"), "Inception")
      act(() => jest.advanceTimersByTime(300))
      fireEvent.press(screen.getByTestId("picker-item-1"))
      expect(mockMakeGuess).not.toHaveBeenCalled()
    })
    it("cancels pending searches and clears input when the account changes", () => {
      const view = renderWithTheme(<PickerContainer />)
      fireEvent.changeText(screen.getByTestId("mock-input"), "Inception")
      mockUseGameStore.mockImplementation((selector: any) => selector({ ...defaultStoreState,
        playerGame: { ...defaultStoreState.playerGame, playerID: "other" } }))
      view.rerender(<ThemeProvider><PickerContainer /></ThemeProvider>)
      act(() => jest.advanceTimersByTime(300))
      expect(screen.getByTestId("mock-input").props.value).toBe("")
      expect(screen.queryByText("Inception")).toBeNull()
    })
    it("should debounce search input and update results", () => {
      renderWithTheme(<PickerContainer />)

      const input = screen.getByTestId("mock-input")
      fireEvent.changeText(input, "Incep")

      // Should not have searched yet (debounce)
      expect(screen.queryByText("Inception")).toBeNull()

      // Advance timers
      act(() => {
        jest.advanceTimersByTime(300)
      })

      expect(hapticsService.light).toHaveBeenCalled() // Haptic on result found

      // Verify result list renders
      expect(screen.getByText("Inception")).toBeTruthy()
    })

    it("does not return fuzzy results for a single character", () => {
      renderWithTheme(<PickerContainer />)
      const input = screen.getByTestId("mock-input")

      fireEvent.changeText(input, "I")

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(screen.queryByText("Inception")).toBeNull()
    })

    it("should clear results if input is cleared", () => {
      // 1. Populate results
      renderWithTheme(<PickerContainer />)
      const input = screen.getByTestId("mock-input")
      fireEvent.changeText(input, "Incep")
      act(() => jest.runAllTimers())
      expect(screen.getByText("Inception")).toBeTruthy()

      // 2. Clear input
      fireEvent.changeText(input, "")
      act(() => jest.runAllTimers())

      // 3. Verify results gone
      expect(screen.queryByText("Inception")).toBeNull()
    })

    it("should not trigger search if interactions are disabled", () => {
      mockUseGameStore.mockImplementation((selector: any) =>
        selector({ ...defaultStoreState, isInteractionsDisabled: true })
      )

      renderWithTheme(<PickerContainer />)
      const input = screen.getByTestId("mock-input")
      fireEvent.changeText(input, "Inception")

      act(() => jest.runAllTimers())

      expect(screen.queryByText("Inception")).toBeNull()
    })
  })

  describe("Item Interaction", () => {

    it("should expand item details on long press", () => {
      renderWithTheme(<PickerContainer />)

      // Search to show items
      fireEvent.changeText(screen.getByTestId("mock-input"), "Incep")
      act(() => jest.runAllTimers())

      const item = screen.getByTestId("picker-item-1")

      // Initial state: collapsed
      expect(screen.queryByText("EXPANDED_DETAILS")).toBeNull()

      // Perform Long Press
      fireEvent(item, "longPress")

      // Should call haptics and expand
      expect(hapticsService.medium).toHaveBeenCalled()
      expect(screen.getByText("EXPANDED_DETAILS")).toBeTruthy()
    })

    it("should collapse item if long pressed again", () => {
      renderWithTheme(<PickerContainer />)
      fireEvent.changeText(screen.getByTestId("mock-input"), "Incep")
      act(() => jest.runAllTimers())
      const item = screen.getByTestId("picker-item-1")

      // Expand
      fireEvent(item, "longPress")
      expect(screen.getByText("EXPANDED_DETAILS")).toBeTruthy()

      // Collapse
      fireEvent(item, "longPress")
      expect(screen.queryByText("EXPANDED_DETAILS")).toBeNull()
    })

    it("should call makeGuess and clear input on select", () => {
      renderWithTheme(<PickerContainer />)
      const input = screen.getByTestId("mock-input")

      // Type and search
      fireEvent.changeText(input, "Incep")
      act(() => jest.runAllTimers())

      // Select
      const item = screen.getByTestId("picker-item-1")
      fireEvent.press(item)

      // Assertions
      expect(mockMakeGuess).toHaveBeenCalledWith(mockBasicItems[1])

      // Input should be cleared (component calls handleInputChange("") on select)
      // Note: In this test setup, the TextInput value is controlled by the 'query' state passed into the mock.
      // Since we are re-rendering after state update, we verify the prop value.
      expect(input.props.value).toBe("")
    })

    it("should collapse extended details when a new search is started", () => {
      renderWithTheme(<PickerContainer />)
      fireEvent.changeText(screen.getByTestId("mock-input"), "Incep")
      act(() => jest.runAllTimers())

      // Expand item
      const item = screen.getByTestId("picker-item-1")
      fireEvent(item, "longPress")
      expect(screen.getByText("EXPANDED_DETAILS")).toBeTruthy()

      // Change text
      fireEvent.changeText(screen.getByTestId("mock-input"), "Inception 2")

      // Should immediately collapse details (logic: setExpandedItemId(null) in handleInputChange)
      expect(screen.queryByText("EXPANDED_DETAILS")).toBeNull()
    })
  })
})
