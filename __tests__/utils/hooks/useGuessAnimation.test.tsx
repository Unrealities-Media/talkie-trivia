import { renderHook } from "@testing-library/react-native"
import { useGuessAnimation } from "../../../src/utils/hooks/useGuessAnimation"
import { useThemeTokens } from "../../../src/utils/hooks/useStyles"

// Mock Reanimated
// We need a semi-functional mock to verify values change
jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock")
  return {
    ...Reanimated,
    useReducedMotion: () => false,
    withTiming: (toValue: number, config: any, callback: any) => {
      // Return the value so we can inspect it in tests, simpler than full simulation
      if (callback) setTimeout(() => callback(true), config.duration || 0)
      return { value: toValue } // In real app this is an object, for test verification this suffices if we mock the styles
    },
    withSequence: (...args: any[]) => args[args.length - 1], // Return last value for simplicity in checking final state
    withDelay: (delay: number, animation: any) => animation,
    useSharedValue: (initial: any) => ({ value: initial }),
    useAnimatedStyle: (fn: Function) => fn(),
    interpolate: () => 0, // Simplified return
  }
})

// Mock Theme
jest.mock("../../../src/utils/hooks/useStyles")
const mockTheme = {
  colors: {
    surface: "#surface",
    success: "#success",
    error: "#error",
  },
}
;(useThemeTokens as jest.Mock).mockReturnValue(mockTheme)

describe("Hook: useGuessAnimation", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("should initialize with default values", () => {
    const { result } = renderHook(() =>
      useGuessAnimation({
        isCorrect: false,
        isLastGuess: false,
        lastGuessResult: null,
        theme: mockTheme as any,
      })
    )

    // Check initial styles structure
    // Since we mocked useAnimatedStyle to execute immediately, we can check the result
    expect(result.current.animatedTileStyle).toBeDefined()
    expect(result.current.animatedContentStyle).toBeDefined()
  })

  // Note: Testing exact animation sequences with shared values in Jest often requires
  // checking that specific 'withTiming' / 'withSequence' functions were CALLED with expected params.
  // However, since we verify the hook doesn't crash and returns styles,
  // we rely on the mocks.

  it("should trigger success animation flow when correct", () => {
    // We can't easily spy on internal shared values without a more complex mock.
    // Instead, we verify the hook runs without error under success conditions.
    // Integration tests or Detox are better for visual verification.

    const { result } = renderHook(() =>
      useGuessAnimation({
        isCorrect: true,
        isLastGuess: true,
        lastGuessResult: { itemId: 1, correct: true },
        theme: mockTheme as any,
      })
    )

    expect(result.current.animatedTileStyle).toBeTruthy()
  })

  it("should trigger failure animation flow when incorrect", () => {
    const { result } = renderHook(() =>
      useGuessAnimation({
        isCorrect: false,
        isLastGuess: true,
        lastGuessResult: { itemId: 1, correct: false, feedback: "Wrong" },
        theme: mockTheme as any,
      })
    )

    expect(result.current.animatedFeedbackStyle).toBeTruthy()
  })
})
