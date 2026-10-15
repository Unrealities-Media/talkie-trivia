import React, { ReactElement } from "react"
import { Alert, Platform } from "react-native"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import ShareResultButton from "../../../src/components/gameOver/shareResultButton"
import { shareGameResult, generateShareMessage } from "../../../src/utils/shareUtils"
import { defaultPlayerGame } from "../../../src/models/default"

// Mock dependencies
jest.mock("../../../src/utils/shareUtils")
jest.spyOn(Alert, "alert")

const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

describe("GameOver Component: ShareResultButton", () => {
  const mockPlayerGame = { ...defaultPlayerGame, id: "test-game-1", gaveUp: true, statsProcessed: true, score: 0 }
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("should render the share button", () => {
    renderWithTheme(<ShareResultButton playerGame={mockPlayerGame} />)
    expect(screen.getByText("Share Your Result")).toBeTruthy()
  })

  it.each([false, true])("offers usable web sharing when clipboard denial is %s", async denied => {
    const platform = Platform.OS
    const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator")
    const writeText = denied ? jest.fn().mockRejectedValue(new Error("Denied")) : jest.fn().mockResolvedValue(undefined)
    try {
      Platform.OS = "web"
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { writeText } } })
      jest.mocked(generateShareMessage).mockReturnValue("Talkie Trivia · spoiler-free result")
      renderWithTheme(<ShareResultButton playerGame={mockPlayerGame} />)
      fireEvent.press(screen.getByRole("button"))
      await waitFor(() => expect(screen.getByText(denied ? "Select and copy your result below." : "Result copied. Share it with a fellow movie lover.")).toBeTruthy())
      expect(writeText).toHaveBeenCalledWith("Talkie Trivia · spoiler-free result")
      if (denied) expect(screen.getByText("Talkie Trivia · spoiler-free result").props.selectable).toBe(true)
      expect(shareGameResult).not.toHaveBeenCalled()
    } finally {
      Platform.OS = platform
      if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor)
      else Reflect.deleteProperty(globalThis, "navigator")
    }
  })

  it("does not offer sharing for an unacknowledged result", () => {
    renderWithTheme(<ShareResultButton playerGame={{ ...mockPlayerGame, statsProcessed: false }} />)
    fireEvent.press(screen.getByRole("button"))
    expect(screen.getByRole("button")).toBeDisabled()
    expect(shareGameResult).not.toHaveBeenCalled()
  })

  it("should call shareGameResult with playerGame when pressed", async () => {
    ;(shareGameResult as jest.Mock).mockResolvedValue(true)

    renderWithTheme(<ShareResultButton playerGame={mockPlayerGame} />)
    fireEvent.press(screen.getByRole("button"))

    await waitFor(() => {
      expect(shareGameResult).toHaveBeenCalledWith(mockPlayerGame)
    })
  })

  it("should show an Alert if sharing fails", async () => {
    const errorMsg = "Share failed"
    // Make the share utility throw an error
    ;(shareGameResult as jest.Mock).mockRejectedValue(new Error(errorMsg))

    renderWithTheme(<ShareResultButton playerGame={mockPlayerGame} />)
    fireEvent.press(screen.getByRole("button"))

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Sharing Failed",
        "An error occurred while trying to share your results."
      )
    })

    // Verify the error was logged (and suppressed from test output)
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it("should prevent double clicks while sharing is in progress", async () => {
    // Create a promise that we can control
    let resolveShare: (value: unknown) => void
    const sharePromise = new Promise((resolve) => {
      resolveShare = resolve
    })
    ;(shareGameResult as jest.Mock).mockReturnValue(sharePromise)

    renderWithTheme(<ShareResultButton playerGame={mockPlayerGame} />)

    const button = screen.getByRole("button")

    // First press
    fireEvent.press(button)

    // Second press immediately after
    fireEvent.press(button)

    // Should only have been called once so far
    expect(shareGameResult).toHaveBeenCalledTimes(1)

    // Resolve the promise
    // @ts-ignore
    resolveShare(true)

    await waitFor(() => expect(shareGameResult).toHaveBeenCalledTimes(1))
  })
})
