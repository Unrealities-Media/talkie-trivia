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
      expect(screen.getAllByRole("button", { name: /^Play / })).toHaveLength(5)

      const mediumElements = screen.getAllByText(
        DIFFICULTY_MODES[DEFAULT_DIFFICULTY].label
      )
      expect(mediumElements.length).toBeGreaterThan(0)
    })
  })

  describe("Interactions", () => {
    it.each(["Not started", "In progress", "Won", "Lost"])("opens a %s challenge directly", status => {
      mockUseGameStore.mockImplementation(selector => selector({
        nextDifficulty: DEFAULT_DIFFICULTY, playerGame: { playerID: "test-player" },
        setDifficulty: mockSetDifficulty, dailyChallenges: { LEVEL_4: status }, syncStatus: "idle",
      }))
      renderWithTheme(<DifficultySelector />)
      fireEvent.press(screen.getByRole("button", { name: /^Play Hard\./ }))
      expect(mockSetDifficulty).toHaveBeenCalledWith("LEVEL_4")
      expect(screen.queryByText("Start challenge")).toBeNull()
    })

    it.each(["saving", "pending"])("keeps a %s move safe before switching", syncStatus => {
      mockUseGameStore.mockImplementation(selector => selector({
        nextDifficulty: DEFAULT_DIFFICULTY, playerGame: { playerID: "test-player" },
        setDifficulty: mockSetDifficulty, syncStatus,
      }))
      renderWithTheme(<DifficultySelector />)
      const hard = screen.getByRole("button", { name: /^Play Hard\./ })
      expect(hard).toBeDisabled()
      fireEvent.press(hard)
      expect(mockSetDifficulty).not.toHaveBeenCalled()
    })
  })
})
