import React from "react"
import { render, screen, act } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import ConfettiCelebration from "../../src/components/confettiCelebration"

// --- Mocking the external library ---

// This mock function will allow us to check if the `start()` method was called.
const mockStart = jest.fn()
let mockReduced = false
jest.mock("../../src/utils/hooks/usePremiereMotion", () => ({ usePremiereMotion: () => mockReduced }))

jest.mock("react-native-confetti-cannon", () => {
  const React = require("react")
  const { forwardRef, useImperativeHandle } = React
  const { View } = require("react-native")

  const MockConfettiCannon = forwardRef(
    (
      {
        onAnimationEnd,
        ...props
      }: { onAnimationEnd?: () => void; [key: string]: any },
      ref: any
    ) => {
      useImperativeHandle(ref, () => ({
        start: mockStart,
      }))

      return (
        <View
          testID="confetti-cannon"
          onAnimationEnd={onAnimationEnd}
          {...props}
        />
      )
    }
  )
  MockConfettiCannon.displayName = "MockConfettiCannon"
  return MockConfettiCannon
})

// --- Test Suite ---

describe("ConfettiCelebration Component", () => {
  const mockOnConfettiStop = jest.fn()

  beforeEach(() => {
    // Clear mocks before each test to ensure a clean state
    mockStart.mockClear()
    mockOnConfettiStop.mockClear()
    mockReduced = false
  })

  it("should not render when startConfetti is false", () => {
    render(
      <ThemeProvider>
        <ConfettiCelebration startConfetti={false} />
      </ThemeProvider>
    )
    expect(screen.queryByTestId("confetti-cannon")).toBeNull()
  })

  it("clears a requested celebration without motion when reduced motion is enabled", () => {
    mockReduced = true
    render(<ConfettiCelebration startConfetti onConfettiStop={mockOnConfettiStop} />)
    expect(screen.queryByTestId("confetti-cannon")).toBeNull()
    expect(mockStart).not.toHaveBeenCalled()
    expect(mockOnConfettiStop).toHaveBeenCalledTimes(1)
  })

  it("stops rendering particles if reduced motion is enabled during a celebration", () => {
    const { rerender } = render(<ConfettiCelebration startConfetti onConfettiStop={mockOnConfettiStop} />)
    mockReduced = true
    rerender(<ConfettiCelebration startConfetti onConfettiStop={mockOnConfettiStop} />)
    expect(screen.queryByTestId("confetti-cannon")).toBeNull()
    expect(mockOnConfettiStop).toHaveBeenCalledTimes(1)
  })

  it("should render and call the start method when startConfetti is true", () => {
    render(
      <ThemeProvider>
        <ConfettiCelebration startConfetti={true} />
      </ThemeProvider>
    )
    expect(screen.getByTestId("confetti-cannon")).toBeTruthy()
    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it("should call onConfettiStop when the onAnimationEnd prop is triggered", () => {
    render(
      <ThemeProvider>
        <ConfettiCelebration
          startConfetti={true}
          onConfettiStop={mockOnConfettiStop}
        />
      </ThemeProvider>
    )

    const confettiCannon = screen.getByTestId("confetti-cannon")
    act(() => {
      confettiCannon.props.onAnimationEnd()
    })
    expect(mockOnConfettiStop).toHaveBeenCalledTimes(1)
  })

  it("should not call start() again on re-render if startConfetti is already true", () => {
    const { rerender } = render(
      <ThemeProvider>
        <ConfettiCelebration startConfetti={true} />
      </ThemeProvider>
    )
    expect(mockStart).toHaveBeenCalledTimes(1)

    rerender(
      <ThemeProvider>
        <ConfettiCelebration startConfetti={true} />
      </ThemeProvider>
    )
    expect(mockStart).toHaveBeenCalledTimes(1)
  })
})
