import React from "react"
import { render, screen, act, cleanup } from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import CountdownTimer from "../../src/components/countdownTimer"
import { useGameStore } from "../../src/state/gameStore"
import { releaseYear } from "../../src/utils/dateDisplay"
jest.mock("../../src/state/gameStore")
describe("server UTC countdown", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    ;(useGameStore as unknown as jest.Mock).mockImplementation(select => select({ resetDeadline: 10000 }))
  })
  afterEach(() => { cleanup(); jest.useRealTimers() })
  it("counts down against monotonic time even if the device clock changes", () => {
    render(<ThemeProvider><CountdownTimer /></ThemeProvider>)
    expect(screen.getByText("Daily reset in 00:00:10 · 00:00 UTC")).toBeTruthy()
    jest.setSystemTime(new Date("2035-01-01T13:00:00-11:00"))
    act(() => jest.advanceTimersByTime(1000))
    expect(screen.getByText("Daily reset in 00:00:09 · 00:00 UTC")).toBeTruthy()
  })
  it("waits for the next server challenge rather than resetting the countdown locally", () => {
    render(<ThemeProvider><CountdownTimer /></ThemeProvider>)
    act(() => jest.advanceTimersByTime(12000))
    expect(screen.getByText("Checking the next daily challenge…")).toBeTruthy()
  })
  it("announces the UTC reset convention before server timing is available", () => {
    ;(useGameStore as unknown as jest.Mock).mockImplementation(select => select({ resetDeadline: null }))
    render(<ThemeProvider><CountdownTimer /></ThemeProvider>)
    expect(screen.getByText("Daily reset: 00:00 UTC")).toBeTruthy()
  })
  it.each(["1999", "1999-01-01", "1999-12-31"])("preserves calendar year metadata %s", value => {
    expect(releaseYear(value)).toBe("1999")
  })
})
