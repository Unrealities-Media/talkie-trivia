import React, { ReactElement } from "react"
import { render, screen, RenderOptions } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import HintContainer from "../../src/components/hint"
import { useGameStore } from "../../src/state/gameStore"
import { useHintLogic } from "../../src/utils/hooks/useHintLogic"
import { DEFAULT_DIFFICULTY } from "../../src/config/difficulty"

// --- Mocks ---

// 1. Mock the child UI component to verify it receives correct props
jest.mock("../../src/components/hintUI", () => {
  const { View } = require("react-native")
  return (props: any) => (
    <View
      testID="mock-hint-ui"
      // @ts-ignore - storing props for assertions
      data-label={props.hintLabelText}
      // @ts-ignore
      data-disabled={props.isToggleDisabled}
    />
  )
})

// 2. Mock the logic hook to control internal state behaviors
jest.mock("../../src/utils/hooks/useHintLogic")
const mockUseHintLogic = useHintLogic as jest.Mock

// 3. Mock the Game Store
// We need to mock it as a function that also has a 'getState' method
jest.mock("../../src/state/gameStore", () => {
  const mockStore = jest.fn()
  // @ts-ignore
  mockStore.getState = jest.fn()
  return { useGameStore: mockStore }
})
const mockUseGameStore = useGameStore as unknown as jest.Mock
const mockGetState = (useGameStore as any).getState as jest.Mock

// 4. Mock Animations to avoid Reanimated issues
jest.mock("../../src/utils/hooks/useSkeletonAnimation", () => ({
  useSkeletonAnimation: () => ({ opacity: 1 }),
}))

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

// Default mock return values for the logic hook
const defaultLogicReturn = {
  showHintOptions: false,
  hintLabelText: "Need a Hint?",
  isToggleDisabled: false,
  hintStatuses: {},
  highlightedHint: null,
  handleToggleHintOptions: jest.fn(),
  handleHintSelection: jest.fn(),
  displayedHintText: null,
  allHints: [],
  getHintText: (type: string) => `Mock Value for ${type}`,
}

const setMockStoreState = (stateOverrides: any) => {
  const fullState = {
    loading: false,
    difficulty: DEFAULT_DIFFICULTY,
    isInteractionsDisabled: false,
    playerStats: {},
    ...stateOverrides,
  }

  // Mock the hook selector usage: useGameStore(selector)
  mockUseGameStore.mockImplementation((selector: any) => selector(fullState))

  // Mock the direct access usage: useGameStore.getState()
  mockGetState.mockReturnValue(fullState)
}

describe("HintContainer Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseHintLogic.mockReturnValue(defaultLogicReturn)
  })
  it("keeps earned Medium director and actor hints visible without exposing unearned hints", () => {
    setMockStoreState({ difficulty: "LEVEL_3", playerGame: { hintsUsed: { director: true } } })
    const { rerender } = renderWithTheme(<HintContainer />)
    expect(screen.getByText("Mock Value for director")).toBeTruthy()
    expect(screen.queryByText("Mock Value for actors")).toBeNull()
    setMockStoreState({ difficulty: "LEVEL_3", playerGame: { hintsUsed: { director: true, actors: true } } })
    rerender(<ThemeProvider><HintContainer /></ThemeProvider>)
    expect(screen.getByText("Mock Value for actors")).toBeTruthy()
  })

  describe("Loading State", () => {
    it("should render the HintSkeleton when loading is true", () => {
      setMockStoreState({
        loading: true,
        difficulty: "LEVEL_3",
      })

      renderWithTheme(<HintContainer />)

      // The skeleton renders a generic View container.
      // We verify that the main HintUI or BasicHints are NOT there.
      expect(screen.queryByTestId("mock-hint-ui")).toBeNull()
      expect(screen.queryByText("All Hints Revealed")).toBeNull()
    })
  })

  describe("Difficulty Strategy: NONE_DISABLED / EXTREME", () => {
    it("should return null (render nothing) for Hard difficulty (LEVEL_4)", () => {
      setMockStoreState({
        difficulty: "LEVEL_4", // Hard: NONE_DISABLED
      })

      const { toJSON } = renderWithTheme(<HintContainer />)
      expect(toJSON()).toBeNull()
    })

    it("should return null (render nothing) for Extreme difficulty (LEVEL_5)", () => {
      setMockStoreState({
        difficulty: "LEVEL_5", // Extreme: EXTREME_CHALLENGE
      })

      const { toJSON } = renderWithTheme(<HintContainer />)
      expect(toJSON()).toBeNull()
    })
  })

  describe("Difficulty Strategy: ALL_REVEALED / HINTS_ONLY", () => {
    it("should render BasicHints (static list) for Basic difficulty (LEVEL_1)", () => {
      setMockStoreState({
        difficulty: "LEVEL_1", // Basic: HINTS_ONLY_REVEALED
        isInteractionsDisabled: false, // Game is active
      })

      renderWithTheme(<HintContainer />)

      expect(screen.queryByText("All Hints Revealed")).toBeNull()
      expect(screen.queryByText("Decade:")).toBeNull()
      // Verify it calls getHintText from the hook
      expect(screen.getByText("Mock Value for director")).toBeTruthy()
    })

    it("should NOT render BasicHints if interactions are disabled (Game Over)", () => {
      setMockStoreState({
        difficulty: "LEVEL_1",
        isInteractionsDisabled: true,
      })

      // We need the logic hook to return "Game Over" label for this scenario
      mockUseHintLogic.mockReturnValue({
        ...defaultLogicReturn,
        hintLabelText: "Game Over",
        isToggleDisabled: true,
      })

      renderWithTheme(<HintContainer />)

      expect(screen.queryByText("All Hints Revealed")).toBeNull()
      expect(screen.getByTestId("mock-hint-ui")).toBeTruthy()
    })
  })

  describe("Difficulty Strategy: IMPLICIT_FEEDBACK (Medium)", () => {
    it("should render a simple text label when toggle is NOT disabled", () => {
      setMockStoreState({
        difficulty: "LEVEL_3", // Medium: IMPLICIT_FEEDBACK
        isInteractionsDisabled: false,
        playerStats: { hintsAvailable: 3 },
      })

      mockUseHintLogic.mockReturnValue({
        ...defaultLogicReturn,
        hintLabelText: "Hints are revealed by successful guesses!",
        isToggleDisabled: false, // Key condition
      })

      renderWithTheme(<HintContainer />)

      // Should see the text
      expect(
        screen.queryByText("Hints are revealed by successful guesses!")
      ).toBeNull()
      // Should NOT render the complex HintUI
      expect(screen.queryByTestId("mock-hint-ui")).toBeNull()
    })

    it("keeps Medium's game-over label informational without hint controls", () => {
      setMockStoreState({
        difficulty: "LEVEL_3",
        isInteractionsDisabled: true,
      })

      mockUseHintLogic.mockReturnValue({
        ...defaultLogicReturn,
        hintLabelText: "Game Over",
        isToggleDisabled: true,
      })

      renderWithTheme(<HintContainer />)

      expect(screen.queryByText("Game Over")).toBeNull()
      expect(screen.queryByTestId("mock-hint-ui")).toBeNull()
    })
  })

  describe("Difficulty Strategy: USER_SPEND (Easy)", () => {
    it("should render HintUI for Easy difficulty (LEVEL_2)", () => {
      setMockStoreState({
        difficulty: "LEVEL_2", // Easy: USER_SPEND
        isInteractionsDisabled: false,
        playerStats: { hintsAvailable: 3 },
      })

      renderWithTheme(<HintContainer />)

      const hintUI = screen.getByTestId("mock-hint-ui")
      expect(hintUI).toBeTruthy()
      // Verify props passed to HintUI via the mocked hook values
      expect(hintUI.props["data-label"]).toBe("Need a Hint?")
      expect(hintUI.props["data-disabled"]).toBe(false)
    })

    it("should render null if HintUI has no label text (e.g., out of hints)", () => {
      setMockStoreState({
        difficulty: "LEVEL_2",
        isInteractionsDisabled: false,
      })

      // Simulate logic returning empty label (e.g., no hints left)
      mockUseHintLogic.mockReturnValue({
        ...defaultLogicReturn,
        hintLabelText: "",
      })

      const { toJSON } = renderWithTheme(<HintContainer />)
      expect(toJSON()).toBeNull()
    })
  })
})
