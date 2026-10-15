import React, { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  RenderOptions,
} from "@testing-library/react-native";
import { ThemeProvider } from "../../src/contexts/themeContext";
import CluesContainer from "../../src/components/clues";
import { GameState, useGameStore } from "../../src/state/gameStore";
import { hapticsService } from "../../src/utils/hapticsService";
import { ScrollView } from "react-native";
import { defaultPlayerGame, defaultTriviaItem } from "../../src/models/default";
import { PlayerGame } from "../../src/models/game";
import { DEFAULT_DIFFICULTY } from "../../src/config/difficulty";

jest.mock("../../src/state/gameStore");
jest.mock("../../src/utils/hapticsService");

const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options);
};

const mockSummary =
  "A young boy discovers a magical lamp. A powerful genie grants him three wishes, changing his life forever.";
const summaryChunks = [
  "A young boy discovers",
  "a magical lamp. A",
  "powerful genie grants him",
  "three wishes, changing his",
  "life forever.",
];
const fullSummaryText = summaryChunks.join(" ");

const defaultMockState: Partial<GameState> = {
  loading: false,
  isInteractionsDisabled: false,
  difficulty: DEFAULT_DIFFICULTY,
  playerGame: {
    ...defaultPlayerGame,
    triviaItem: {
      ...defaultTriviaItem,
      description: mockSummary,
    },
  },
};

type MockStateOverrides = Partial<Omit<GameState, "playerGame">> & {
  playerGame?: Partial<PlayerGame>;
};

describe("CluesContainer Component", () => {
  let scrollToEndSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    (useGameStore as unknown as jest.Mock).mockClear();
    (hapticsService.light as jest.Mock).mockClear();

    scrollToEndSpy = jest
      .spyOn(ScrollView.prototype, "scrollToEnd")
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    scrollToEndSpy.mockRestore();
  });

  const setMockStoreState = (overrides: MockStateOverrides = {}) => {
    const newState = {
      ...defaultMockState,
      ...overrides,
      playerGame: {
        ...defaultMockState.playerGame!,
        ...(overrides.playerGame || {}),
      },
    };

    (useGameStore as unknown as jest.Mock).mockImplementation(
      (selector: (s: GameState) => any) => selector(newState as GameState)
    );
  };

  describe("Rendering States", () => {
    it("replaces the visible clue when another challenge has the same reveal count", () => {
      setMockStoreState();
      const { rerender } = renderWithTheme(<CluesContainer />);
      expect(screen.getByText(summaryChunks[0])).toBeTruthy();
      setMockStoreState({ playerGame: { triviaItem: { ...defaultTriviaItem,
        description: "Different heroes begin another journey across distant planets beyond their home." } } });
      rerender(<ThemeProvider><CluesContainer /></ThemeProvider>);
      expect(screen.queryByText(summaryChunks[0])).toBeNull();
      expect(screen.getByText("Different heroes begin")).toBeTruthy();
    });
    it("shows the entire Very Hard clue before the first guess", () => {
      setMockStoreState({ difficulty: "LEVEL_5", playerGame: { guesses: [] } });
      renderWithTheme(<CluesContainer />);
      act(() => jest.advanceTimersByTime(2000));
      expect(screen.getByText(fullSummaryText)).toBeTruthy();
      expect(screen.queryByTestId("next-clue-projector")).toBeNull();
      const words = mockSummary.trim().split(/\s+/).length;
      expect(screen.getByText(`${words}/${words} words revealed`)).toBeTruthy();
    });
    it("should render the skeleton component when loading", () => {
      setMockStoreState({ loading: true });
      renderWithTheme(<CluesContainer />);
      expect(screen.getByTestId("clues-skeleton")).toBeTruthy();
      expect(screen.queryByText(/words revealed/)).toBeNull();
    });

    it("should render the first clue chunk and correct word count on initial load", () => {
      setMockStoreState();
      renderWithTheme(<CluesContainer />);

      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      expect(screen.getByText(summaryChunks[0])).toBeTruthy();
      expect(screen.queryByText(fullSummaryText)).toBeNull();
      expect(screen.queryByText(fullSummaryText, { includeHiddenElements: true })).toBeNull();
      expect(screen.getByTestId("next-clue-projector")).toBeTruthy();
      expect(scrollToEndSpy).not.toHaveBeenCalled();

      const revealedWords = summaryChunks[0].split(" ").length;
      const totalWords = mockSummary.trim().split(/\s+/).length;
      expect(
        screen.getByText(`${revealedWords}/${totalWords} words revealed`)
      ).toBeTruthy();
    });

    it("should render the full summary if the game is already over on load", () => {
      setMockStoreState({
        isInteractionsDisabled: true,
        playerGame: { guesses: [{ itemId: 123 }] },
      });
      renderWithTheme(<CluesContainer />);
      expect(screen.getByText(fullSummaryText)).toBeTruthy();
    });
  });

  describe("Game Progression", () => {
    it("should reveal the next clue chunk after a guess", () => {
      setMockStoreState({ playerGame: { guesses: [] } });
      const { rerender } = renderWithTheme(<CluesContainer />);

      act(() => jest.advanceTimersByTime(2000));
      expect(screen.getByText(summaryChunks[0])).toBeTruthy();

      (hapticsService.light as jest.Mock).mockClear();

      act(() => {
        setMockStoreState({ playerGame: { guesses: [{ itemId: 1 }] } });
        rerender(
          <ThemeProvider>
            <CluesContainer />
          </ThemeProvider>
        );
      });

      act(() => jest.advanceTimersByTime(2000));

      const expectedText = `${summaryChunks[0]} ${summaryChunks[1]}`;
      expect(screen.getByText(expectedText)).toBeTruthy();

      expect(hapticsService.light).toHaveBeenCalledTimes(1);
      expect(scrollToEndSpy).not.toHaveBeenCalled();
    });
  });

  describe("Interaction", () => {
    it("should call haptics on press", () => {
      setMockStoreState();
      renderWithTheme(<CluesContainer />);

      act(() => jest.advanceTimersByTime(2000));

      expect(screen.getByText(summaryChunks[0])).toBeTruthy();
      (hapticsService.light as jest.Mock).mockClear();

      const pressableArea = screen.getByLabelText(
        "Skip the current clue's text animation"
      );
      fireEvent.press(pressableArea);

      expect(hapticsService.light).toHaveBeenCalledTimes(1);
    });

    it("should be non-interactive when the game is over", () => {
      setMockStoreState({ isInteractionsDisabled: true });
      renderWithTheme(<CluesContainer />);
      (hapticsService.light as jest.Mock).mockClear();

      expect(
        screen.queryByLabelText("Skip the current clue's text animation")
      ).toBeNull();

      fireEvent.press(screen.getByText(fullSummaryText));
      expect(hapticsService.light).not.toHaveBeenCalled();
    });
  });
});
