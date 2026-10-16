// __tests__/gameHistory.test.tsx

import { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  RenderOptions,
} from "@testing-library/react-native";
import { ThemeProvider } from "../../src/contexts/themeContext";
import GameHistory from "../../src/components/gameHistory";
import { useAuth } from "../../src/contexts/authContext";
import { gameService } from "../../src/services/gameService";
import { GameHistoryEntry } from "../../src/models/gameHistory";
import { useGameStore } from "../../src/state/gameStore";

// --- Mocking Dependencies ---
jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { FlatList } = require("react-native");
  return {
    FlashList: React.forwardRef((props: any, ref: any) => (
      <FlatList ref={ref} {...props} />
    )),
  };
});
jest.mock("../../src/contexts/authContext");
jest.mock("../../src/services/gameService");
jest.mock("../../src/utils/hapticsService");
jest.mock("../../src/state/gameStore", () => ({ useGameStore: jest.fn() }));

const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options);
};

const mockUseAuth = useAuth as jest.Mock;
const mockGameService = gameService as jest.Mocked<typeof gameService>;

const mockHistoryData: GameHistoryEntry[] = [
  { dateId: "2025-11-15", itemId: 101, itemTitle: "Inception", posterPath: "/inception.jpg", wasCorrect: true, gaveUp: false, guessCount: 2, guessesMax: 5, difficulty: "LEVEL_3", score: 850, gameMode: "movies" },
];

describe("GameHistory Component", () => {
  const onHistoryItemPressMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGameService.fetchGameHistory.mockReset();
    mockUseAuth.mockReturnValue({ player: { id: "test-player-id" } });
    (useGameStore as unknown as jest.Mock).mockReturnValue(1);
  });

  afterEach(cleanup);

  it("shows only three recent movies and keeps their result actions", async () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({ ...mockHistoryData[0], itemId: i, itemTitle: `Movie ${i}` }));
    mockGameService.fetchGameHistory.mockResolvedValue({ entries, next: null });
    renderWithTheme(<GameHistory compact onHistoryItemPress={onHistoryItemPressMock} />);
    await screen.findByText("Movie 0");
    expect(screen.getByText("Movie 2")).toBeTruthy();
    expect(screen.queryByText("Movie 3")).toBeNull();
    expect(screen.queryByText("Refresh history")).toBeNull();
    fireEvent.press(screen.getByLabelText("View Movie 1 result"));
    expect(onHistoryItemPressMock).toHaveBeenCalledWith(entries[1]);
  });

  it("navigates older/newer pages without accumulating rows and refreshes from the newest page", async () => {
    const cursor = { uid: "test-player-id", dateId: "2025-11-15", id: "2025-11-15" };
    const older = { ...mockHistoryData[0], dateId: "2025-11-14", itemTitle: "Older movie" };
    mockGameService.fetchGameHistory
      .mockResolvedValueOnce({ entries: mockHistoryData, next: cursor })
      .mockResolvedValueOnce({ entries: [older], next: null })
      .mockResolvedValueOnce({ entries: mockHistoryData, next: cursor })
      .mockResolvedValueOnce({ entries: [older], next: null })
      .mockResolvedValueOnce({ entries: mockHistoryData, next: null });
    renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);
    fireEvent.press(await screen.findByLabelText("Older games"));
    expect(await screen.findByText("Older movie")).toBeTruthy();
    expect(screen.queryByText("Inception")).toBeNull();
    expect(screen.queryByLabelText("Older games")).toBeNull();
    expect(mockGameService.fetchGameHistory).toHaveBeenLastCalledWith("test-player-id", cursor);
    fireEvent.press(screen.getByLabelText("Newer games"));
    expect(await screen.findByText("Inception")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Older games"));
    await screen.findByText("Older movie");
    fireEvent.press(screen.getByLabelText("Refresh history"));
    await screen.findByText("Inception");
    expect(mockGameService.fetchGameHistory).toHaveBeenLastCalledWith("test-player-id", null);
    expect(screen.queryByLabelText("Newer games")).toBeNull();
  });

  it("retries the same failed older page without losing the way back", async () => {
    const cursor = { uid: "test-player-id", dateId: "2025-11-15", id: "2025-11-15" };
    mockGameService.fetchGameHistory
      .mockResolvedValueOnce({ entries: mockHistoryData, next: cursor })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ entries: [{ ...mockHistoryData[0], itemTitle: "Recovered" }], next: null });
    renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);
    fireEvent.press(await screen.findByLabelText("Older games"));
    await screen.findByText("Could not load game history.");
    expect(screen.getByLabelText("Newer games")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry"));
    expect(await screen.findByText("Recovered")).toBeTruthy();
    expect(mockGameService.fetchGameHistory).toHaveBeenLastCalledWith("test-player-id", cursor);
  });

  it.each(["account", "completion"])("discards a late page after %s changes", async change => {
    let finish!: (value: any) => void;
    const cursor = { uid: "test-player-id", dateId: "2025-11-15", id: "2025-11-15" };
    mockGameService.fetchGameHistory
      .mockResolvedValueOnce({ entries: mockHistoryData, next: cursor })
      .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
      .mockResolvedValueOnce({ entries: [{ ...mockHistoryData[0], itemTitle: "Current result" }], next: null });
    const view = renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);
    fireEvent.press(await screen.findByLabelText("Older games"));
    if (change === "account") mockUseAuth.mockReturnValue({ player: { id: "other" } });
    else (useGameStore as unknown as jest.Mock).mockReturnValue(2);
    view.rerender(<ThemeProvider><GameHistory onHistoryItemPress={onHistoryItemPressMock} /></ThemeProvider>);
    await screen.findByText("Current result");
    await act(async () => finish({ entries: [{ ...mockHistoryData[0], itemTitle: "Stale result" }], next: cursor }));
    expect(screen.queryByText("Stale result")).toBeNull();
    expect(screen.queryByLabelText("Newer games")).toBeNull();
    expect(mockGameService.fetchGameHistory).toHaveBeenLastCalledWith(change === "account" ? "other" : "test-player-id", null);
  });

  describe("Loading State", () => {
    it("should display skeleton loaders while fetching data", () => {
      mockGameService.fetchGameHistory.mockReturnValue(new Promise(() => {}));
      
      renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);

      // The refactored component now reliably renders these items
      const skeletons = screen.getAllByTestId("skeleton-item");
      expect(skeletons.length).toBe(5);
      expect(screen.queryByText("Inception")).toBeNull();
    });
  });

  describe("Data Display", () => {
    it("should render a list of game history items on successful fetch", async () => {
      mockGameService.fetchGameHistory.mockResolvedValue({ entries: mockHistoryData, next: null });
      
      renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);

      expect(await screen.findByText("Inception")).toBeTruthy();
      expect(screen.getByText("Correct in 2/5 guesses!")).toBeTruthy();
      expect(screen.queryAllByTestId("skeleton-item").length).toBe(0);
    });
  });

  describe("Empty and Error States", () => {
    it("should display an empty message if no history is returned", async () => {
      mockGameService.fetchGameHistory.mockResolvedValue({ entries: [], next: null });
      renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);
      expect(await screen.findByText("Play a game to see your history here!")).toBeTruthy();
    });

    it("should display an error message if the fetch fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGameService.fetchGameHistory.mockRejectedValue(new Error("Network Error"));
      renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);
      expect(await screen.findByText("Could not load game history.")).toBeTruthy();
      consoleErrorSpy.mockRestore();
    });

    it("should display the empty message if there is no authenticated player", async () => {
      mockUseAuth.mockReturnValue({ player: null });
      renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);

      // The component logic was updated to immediately set loading to false.
      // We still use findByText to wait for the state update.
      const emptyMessage = await screen.findByText("Play a game to see your history here!");
      expect(emptyMessage).toBeTruthy();
      expect(gameService.fetchGameHistory).not.toHaveBeenCalled();
      expect(screen.queryAllByTestId("skeleton-item").length).toBe(0);
    });
  });

  describe("Interaction", () => {
    it("should call onHistoryItemPress with the correct item when pressed", async () => {
      mockGameService.fetchGameHistory.mockResolvedValue({ entries: mockHistoryData, next: null });
      renderWithTheme(<GameHistory onHistoryItemPress={onHistoryItemPressMock} />);

      const firstItem = await screen.findByText("Inception");
      fireEvent.press(firstItem);

      expect(onHistoryItemPressMock).toHaveBeenCalledWith(mockHistoryData[0]);
    });
  });
});
