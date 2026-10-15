import React, { ReactElement } from "react"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  RenderOptions,
  act,
  within,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import GameplayView from "../../src/components/gameplayView"
import { useGameStore } from "../../src/state/gameStore"
import { hapticsService } from "../../src/utils/hapticsService"
import { GameState } from "../../src/state/gameStore"

// --- Mocking Dependencies ---
jest.mock("../../src/components/picker", () => {
  const { Text } = require("react-native")
  return () => <Text>mock-PickerContainer</Text>
})
jest.mock("../../src/components/seatHints", () => {
  const { Text } = require("react-native")
  return () => <Text>mock-HintContainer</Text>
})
jest.mock("../../src/components/confirmationModal", () => jest.fn(() => null))
jest.mock("../../src/state/gameStore")
jest.mock("../../src/utils/hapticsService")

import ConfirmationModal from "../../src/components/confirmationModal"

const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

const mockGiveUp = jest.fn()
const mockUseGameStore = useGameStore as unknown as jest.Mock
const MockedConfirmationModal = ConfirmationModal as unknown as jest.Mock

describe("GameplayView Component", () => {
  const setMockStoreState = (overrides: Partial<GameState> = {}) => {
    const defaultState: Partial<GameState> = {
      giveUp: mockGiveUp,
      isInteractionsDisabled: false,
      gameMode: "movies",
      syncStatus: "idle",
      ...overrides,
    }
    mockUseGameStore.mockImplementation((selector: (state: any) => any) =>
      selector(defaultState)
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockGiveUp.mockImplementation(() => new Promise(() => {}))
    setMockStoreState()
  })

  afterEach(cleanup)

  describe("Rendering", () => {
    it("should render all primary components", () => {
      renderWithTheme(<GameplayView />)
      expect(screen.getByText("mock-PickerContainer")).toBeTruthy()
      expect(screen.getByText("mock-HintContainer")).toBeTruthy()
      expect(screen.getByTestId("give-up-button")).toBeTruthy()
    })
  })

  describe("Give Up Flow", () => {
    it("should show the confirmation modal when 'Give Up?' is pressed", () => {
      renderWithTheme(<GameplayView />)
      fireEvent.press(screen.getByTestId("give-up-button"))
      expect(hapticsService.warning).toHaveBeenCalledTimes(1)
      const { isVisible } = MockedConfirmationModal.mock.calls.pop()[0]
      expect(isVisible).toBe(true)
    })

    it("should call the giveUp action when confirmed", () => {
      renderWithTheme(<GameplayView />)
      fireEvent.press(screen.getByTestId("give-up-button"))
      const { onConfirm } = MockedConfirmationModal.mock.calls.pop()[0]
      act(() => {
        onConfirm()
      })
      expect(mockGiveUp).toHaveBeenCalledTimes(1)
    })
  })

  describe("Disabled State", () => {
    it("should disable the 'Give Up?' button when isInteractionsDisabled is true", () => {
      setMockStoreState({ isInteractionsDisabled: true })
      renderWithTheme(<GameplayView />)
      const giveUpButton = screen.getByTestId("give-up-button")
      expect(giveUpButton).toBeDisabled()
    })

    it("should show the 'Give Up?' button in a loading state while the giveUp action is processing", () => {
      renderWithTheme(<GameplayView />)
      const giveUpButton = screen.getByTestId("give-up-button")

      expect(within(giveUpButton).getByText("Give Up?")).toBeTruthy()

      fireEvent.press(giveUpButton)
      const { onConfirm } = MockedConfirmationModal.mock.calls.pop()[0]

      act(() => {
        onConfirm()
      })

      // Re-query for the button after the re-render
      const giveUpButtonAfterClick = screen.getByTestId("give-up-button")
      expect(within(giveUpButtonAfterClick).queryByText("Give Up?")).toBeNull()
    })
  })
})
