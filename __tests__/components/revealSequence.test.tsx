import React, { ReactElement } from "react"
import {
  render,
  screen,
  act,
  RenderOptions,
  fireEvent,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import RevealSequence from "../../src/components/revealSequence"
import { useGameStore } from "../../src/state/gameStore"
import { defaultPlayerGame } from "../../src/models/default"
import { API_CONFIG } from "../../src/config/constants"
import { usePremiereMotion } from "../../src/utils/hooks/usePremiereMotion"

jest.mock("../../src/utils/hooks/usePremiereMotion", () => ({ usePremiereMotion: jest.fn(() => false) }))

// --- Mocks ---

// Mock Reanimated to handle layout animations predictably
// We don't need deep mocks since we are testing the callback via timer advancement
jest.mock("react-native-reanimated", () => {
  const Reanimated = jest.requireActual("react-native-reanimated/mock")
  return {
    ...Reanimated,
    // Ensure runOnJS executes the callback
    runOnJS: (fn: Function) => fn,
    // Ensure withDelay calls callback after delay (simulated)
    withDelay: (delay: number, animation: any) => {
      return animation
    },
    // Ensure withTiming calls callback immediately for test purposes if provided
    withTiming: (toValue: number, config: any, callback: any) => {
      if (callback) callback(true) // Simulate completion
      return { value: toValue }
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: Function) => fn(),
  }
})

// Mock Game Store
jest.mock("../../src/state/gameStore")
const mockUseGameStore = useGameStore as unknown as jest.Mock

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

const mockTriviaItem = {
  ...defaultPlayerGame.triviaItem,
  id: 101,
  title: "The Matrix",
  posterPath: "/matrix_poster.jpg",
}

const setMockStoreState = (state: any) => {
  mockUseGameStore.mockImplementation((selector: any) => selector(state))
}

describe("RevealSequence Component", () => {
  const onAnimationCompleteMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.mocked(usePremiereMotion).mockReturnValue(false)

    setMockStoreState({
      playerGame: {
        ...defaultPlayerGame,
        triviaItem: mockTriviaItem,
      },
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("should render the correct movie title and poster", () => {
    renderWithTheme(
      <RevealSequence onAnimationComplete={onAnimationCompleteMock} />
    )

    expect(screen.getByText("The Matrix")).toBeTruthy()

    for (const image of screen.getAllByTestId("mock-expo-image")) {
      expect(image.props["data-source"]).toBe(`${API_CONFIG.TMDB_IMAGE_BASE_URL_W500}${mockTriviaItem.posterPath}`)
    }
  })

  it("should render fallback image if posterPath is missing", () => {
    setMockStoreState({
      playerGame: {
        ...defaultPlayerGame,
        triviaItem: { ...mockTriviaItem, posterPath: null },
      },
    })

    renderWithTheme(
      <RevealSequence onAnimationComplete={onAnimationCompleteMock} />
    )

    // Both the sharp poster and its soft-focus layer use the local fallback.
    for (const image of screen.getAllByTestId("mock-expo-image")) expect(image.props.source).toBe(1)
  })

  it("should call onAnimationComplete after the sequence finishes", () => {
    renderWithTheme(
      <RevealSequence onAnimationComplete={onAnimationCompleteMock} />
    )

    expect(onAnimationCompleteMock).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(3200)
    })

    expect(onAnimationCompleteMock).toHaveBeenCalledTimes(1)
  })

  it("lets the player skip without completing again when the timer expires", () => {
    renderWithTheme(<RevealSequence onAnimationComplete={onAnimationCompleteMock} />)
    fireEvent.press(screen.getByRole("button", { name: "Skip reveal and view results" }))
    act(() => jest.advanceTimersByTime(5000))
    expect(onAnimationCompleteMock).toHaveBeenCalledTimes(1)
  })

  it("cancels completion when unmounted during the reveal", () => {
    const { unmount } = renderWithTheme(<RevealSequence onAnimationComplete={onAnimationCompleteMock} />)
    unmount()
    act(() => jest.advanceTimersByTime(5000))
    expect(onAnimationCompleteMock).not.toHaveBeenCalled()
  })

  it("completes the still reduced-motion reveal without waiting for worklets", () => {
    jest.mocked(usePremiereMotion).mockReturnValue(true)
    renderWithTheme(<RevealSequence onAnimationComplete={onAnimationCompleteMock} />)
    act(() => jest.advanceTimersByTime(1800))
    expect(onAnimationCompleteMock).toHaveBeenCalledTimes(1)
  })
})
