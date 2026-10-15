import React, { ReactElement } from "react"
import {
  render,
  screen,
  fireEvent,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import DifficultySelector from "../../src/components/difficultySelector"
import { useGameStore } from "../../src/state/gameStore"
import { useAuth } from "../../src/contexts/authContext"
import { DEFAULT_DIFFICULTY, DIFFICULTY_MODES } from "../../src/config/difficulty"

// --- Mocking Dependencies ---
jest.mock("../../src/state/gameStore")
jest.mock("../../src/contexts/authContext")
jest.mock("../../src/utils/hapticsService")

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

const mockSetDifficulty = jest.fn()
const mockUseGameStore = useGameStore as unknown as jest.Mock
const mockUseAuth = useAuth as jest.Mock

describe("DifficultySelector Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    mockUseAuth.mockReturnValue({ player: { id: "test-player" } })

    mockUseGameStore.mockImplementation((selector: (state: any) => any) => {
      const state = {
        nextDifficulty: DEFAULT_DIFFICULTY, playerGame: { playerID: "test-player" },
        setDifficulty: mockSetDifficulty,
      }
      return selector(state)
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("Rendering", () => {
    it("should render correctly with default difficulty selected", () => {
      renderWithTheme(<DifficultySelector />)

      expect(screen.getByText("Daily challenges")).toBeTruthy()
      expect(screen.getAllByRole("button")).toHaveLength(5)

      const mediumElements = screen.getAllByText(
        DIFFICULTY_MODES[DEFAULT_DIFFICULTY].label
      )
      expect(mediumElements.length).toBeGreaterThan(0)
    })
  })

  describe("Interactions", () => {
    it.each(["In progress", "Won", "Lost"])("opens a saved %s challenge without a new-start confirmation", status => {
      mockUseGameStore.mockImplementation(selector => selector({
        nextDifficulty: DEFAULT_DIFFICULTY, playerGame: { playerID: "test-player" },
        setDifficulty: mockSetDifficulty, dailyChallenges: { LEVEL_4: status }, syncStatus: "idle",
      }))
      renderWithTheme(<DifficultySelector />)
      fireEvent.press(screen.getByRole("button", { name: /^Play Hard\./ }))
      expect(mockSetDifficulty).toHaveBeenCalledWith("LEVEL_4")
      expect(screen.queryByText("Start challenge")).toBeNull()
    })

    it("starts a new challenge only after confirmation", () => {
      renderWithTheme(<DifficultySelector />)

      const hardButton = screen.getByText("Hard")
      fireEvent.press(hardButton)
      expect(mockSetDifficulty).not.toHaveBeenCalled()
      fireEvent.press(screen.getByText("Keep browsing"))
      expect(mockSetDifficulty).not.toHaveBeenCalled()
      fireEvent.press(hardButton)
      fireEvent.press(screen.getByText("Start challenge"))
      expect(mockSetDifficulty).toHaveBeenCalledWith("LEVEL_4")
    })
  })
})
