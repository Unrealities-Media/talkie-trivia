import { renderHook, act } from "@testing-library/react-native"
import { useHintLogic } from "../../../src/utils/hooks/useHintLogic"
import { useGameStore } from "../../../src/state/gameStore"
import { defaultPlayerGame, defaultPlayerStats } from "../../../src/models/default"

jest.mock("../../../src/utils/analyticsService")
jest.mock("../../../src/utils/hapticsService", () => ({
  hapticsService: { light: jest.fn(), medium: jest.fn() },
}))
jest.mock("react-native/Libraries/LayoutAnimation/LayoutAnimation", () => ({
  ...jest.requireActual(
    "react-native/Libraries/LayoutAnimation/LayoutAnimation"
  ),
  configureNext: jest.fn(),
}))

describe("Hook: useHintLogic (Comprehensive)", () => {
  const mockItem = {
    id: 1,
    title: "Test",
    description: "Desc",
    posterPath: "",
    releaseDate: "",
    metadata: {},
    hints: [
      { type: "director", label: "Director", value: "Nolan" },
      { type: "genre", label: "Genre", value: "Action" },
    ],
  }

  const resetStore = (
    difficulty: string = "LEVEL_2",
    hintsAvailable: number = 3
  ) => {
    useGameStore.setState(
      {
        playerGame: {
          ...defaultPlayerGame,
          triviaItem: mockItem,
          hintsUsed: {},
        },
        playerStats: { ...defaultPlayerStats, hintsAvailable },
        difficulty: difficulty as any,
        isInteractionsDisabled: false,
        loading: false,
        syncStatus: "idle",
      } as any,
      true
    )
  }

  describe("Strategy: HINTS_ONLY_REVEALED (Basic / LEVEL_1)", () => {
    beforeEach(() => resetStore("LEVEL_1"))

    it("should return empty label (handled by BasicHints component instead)", () => {
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.hintLabelText).toBe("")

      // In the current implementation, HINTS_ONLY_REVEALED falls through to "available" status
      // This is acceptable because the UI for this mode doesn't use these statuses
      expect(result.current.hintStatuses["director"]).toBe("available")
    })
  })

  describe("Strategy: USER_SPEND (Easy / LEVEL_2)", () => {
    beforeEach(() => resetStore("LEVEL_2", 3))

    it("should allow toggling and show correct label", () => {
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.hintLabelText).toContain("Need a Hint?")
      expect(result.current.isToggleDisabled).toBe(false)

      act(() => {
        result.current.handleToggleHintOptions()
      })
      expect(result.current.showHintOptions).toBe(true)
    })

    it("should disable hint toggle if no points and no used hints", () => {
      resetStore("LEVEL_2", 0)
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.hintLabelText).toBe("")

      act(() => {
        result.current.handleToggleHintOptions()
      })
      expect(result.current.showHintOptions).toBe(false)
    })

    it("should mark purchased hints as 'used'", () => {
      useGameStore.setState((state) => ({
        playerGame: { ...state.playerGame, hintsUsed: { director: true } },
      }))
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.hintStatuses["director"]).toBe("used")
      expect(result.current.hintStatuses["genre"]).toBe("available")
    })
  })

  describe("Strategy: IMPLICIT_FEEDBACK (Medium / LEVEL_3)", () => {
    beforeEach(() => resetStore("LEVEL_3"))

    it("should disable manual toggling but show info label", () => {
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.isToggleDisabled).toBe(true)
      expect(result.current.hintLabelText).toBe(
        "Match an actor, director, genre or decade to reveal a hint."
      )
    })

    it("should show hints that are revealed by gameplay", () => {
      useGameStore.setState((state) => ({
        playerGame: { ...state.playerGame, hintsUsed: { genre: true } },
      }))
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.hintStatuses["genre"]).toBe("used")
    })
  })

  describe("Strategy: NONE_DISABLED (Hard / LEVEL_4)", () => {
    beforeEach(() => resetStore("LEVEL_4"))

    it("should disable all hints", () => {
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.hintStatuses["director"]).toBe("disabled")
      expect(result.current.hintLabelText).toBe("")
    })
  })

  describe("Game Over State", () => {
    it("should show 'Game Over' label", () => {
      resetStore("LEVEL_2")
      useGameStore.setState({ isInteractionsDisabled: true })
      const { result } = renderHook(() => useHintLogic())
      expect(result.current.hintLabelText).toBe("Game Over")
      expect(result.current.isToggleDisabled).toBe(true)
    })
  })
})
