import React, { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  RenderOptions,
  act, // Correctly imported `act`
} from "@testing-library/react-native";
import { Text, Share, Alert } from "react-native";
import { ThemeProvider } from "../../src/contexts/themeContext";
import DetailModal from "../../src/components/detailModal";
import { hapticsService } from "../../src/utils/hapticsService";
import { analyticsService } from "../../src/utils/analyticsService";
import { generateShareMessage } from "../../src/utils/shareUtils";
import { defaultPlayerGame } from "../../src/models/default";
import { PlayerGame } from "../../src/models/game";

// --- Mocking Dependencies ---
jest.mock("../../src/utils/hapticsService");
jest.mock("../../src/utils/analyticsService");
jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
jest.spyOn(Alert, "alert");

// Custom Render Helper with ThemeProvider
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options);
};

// --- Mock Data ---
const mockPlayerGame: PlayerGame = {
  ...defaultPlayerGame,
  id: "test-game-123",
  playerID: "test-player-1",
  correctAnswer: true, // For testing the 'win' analytics event
  guesses: [{ itemId: 1 }],
};

const mockShareMessage = generateShareMessage(mockPlayerGame);

describe("DetailModal Component", () => {
  const toggleModalMock = jest.fn();

  beforeEach(() => {
    // Clear all mocks before each test to ensure isolation
    jest.clearAllMocks();
  });

  afterEach(cleanup);

  describe("Rendering and Visibility", () => {
    it("should not be visible when the 'show' prop is false", () => {
      renderWithTheme(
        <DetailModal show={false} toggleModal={toggleModalMock}>
          <Text>Child Content</Text>
        </DetailModal>
      );
      // The modal's content should not be in the component tree
      expect(screen.queryByText("Child Content")).toBeNull();
    });

    it("should be visible and render children when the 'show' prop is true", () => {
      renderWithTheme(
        <DetailModal show={true} toggleModal={toggleModalMock}>
          <Text>Visible Child Content</Text>
        </DetailModal>
      );
      expect(screen.getByText("Visible Child Content")).toBeTruthy();
      expect(screen.getByText("Close")).toBeTruthy();
    });

    it("should not render the Share button if 'playerGame' prop is not provided", () => {
      renderWithTheme(
        <DetailModal show={true} toggleModal={toggleModalMock}>
          <Text>Child Content</Text>
        </DetailModal>
      );
      expect(screen.queryByText("Share")).toBeNull();
    });

    it("should render the Share button if 'playerGame' prop is provided", () => {
      renderWithTheme(
        <DetailModal
          show={true}
          toggleModal={toggleModalMock}
          playerGame={mockPlayerGame}
        >
          <Text>Child Content</Text>
        </DetailModal>
      );
      expect(screen.getByText("Share")).toBeTruthy();
    });
  });

  describe("User Interactions and Dismissal", () => {
    it("should call toggleModal(false) and trigger haptics when the Close button is pressed", () => {
      renderWithTheme(
        <DetailModal show={true} toggleModal={toggleModalMock}>
          <Text>Child Content</Text>
        </DetailModal>
      );

      fireEvent.press(screen.getByText("Close"));

      expect(toggleModalMock).toHaveBeenCalledWith(false);
      expect(hapticsService.light).toHaveBeenCalledTimes(1);
    });

    it("should call toggleModal(false) when the modal backdrop is pressed", () => {
      renderWithTheme(
        <DetailModal show={true} toggleModal={toggleModalMock}>
          <Text>Child Content</Text>
        </DetailModal>
      );

      // The backdrop is the Pressable with the accessibility label for closing
      fireEvent.press(
        screen.getByLabelText("Close modal by tapping outside")
      );

      expect(toggleModalMock).toHaveBeenCalledWith(false);
      expect(hapticsService.light).toHaveBeenCalledTimes(1);
    });

    it("should call toggleModal(false) when onRequestClose is triggered (e.g., Android back button)", () => {
      renderWithTheme(
        <DetailModal show={true} toggleModal={toggleModalMock}>
          <Text>Child Content</Text>
        </DetailModal>
      );

      // The modal content is wrapped in a view that we can find by its child text
      const modal = screen.getByText("Child Content").parent?.parent?.parent;
      expect(modal).toBeDefined();

      // Fire the onRequestClose event on the Modal component itself
      fireEvent(modal!, "requestClose");

      expect(toggleModalMock).toHaveBeenCalledWith(false);
      expect(hapticsService.light).toHaveBeenCalledTimes(1);
    });
  });

  describe("Share Functionality", () => {
    it("should call Share API, haptics, and analytics on successful share", async () => {
      (Share.share as jest.Mock).mockResolvedValue({
        action: Share.sharedAction,
      });

      renderWithTheme(
        <DetailModal
          show={true}
          toggleModal={toggleModalMock}
          playerGame={mockPlayerGame}
        >
          <Text>Child Content</Text>
        </DetailModal>
      );

      fireEvent.press(screen.getByText("Share"));

      // Verify haptics were triggered
      expect(hapticsService.medium).toHaveBeenCalledTimes(1);

      // Verify analytics were tracked with the correct outcome ('win')
      expect(analyticsService.trackShareResults).toHaveBeenCalledWith("win");

      // Verify the Share API was called with the correct message
      await expect(Share.share).toHaveBeenCalledWith(
        {
          message: mockShareMessage,
          title: "Talkie Trivia Results",
        },
        {
          dialogTitle: "Share your Talkie Trivia results!",
        }
      );
    });

    it("should show an alert if the Share API fails", async () => {
      const errorMessage = "Sharing failed";
      (Share.share as jest.Mock).mockRejectedValue(new Error(errorMessage));

      renderWithTheme(
        <DetailModal
          show={true}
          toggleModal={toggleModalMock}
          playerGame={mockPlayerGame}
        >
          <Text>Child Content</Text>
        </DetailModal>
      );

      fireEvent.press(screen.getByText("Share"));

      // Wait for the async share process to complete
      await act(async () => {
        // This flushes the promise queue
        await new Promise((resolve) => setImmediate(resolve));
      });

      expect(Alert.alert).toHaveBeenCalledWith("Share Error", errorMessage);
    });

    it("should determine the correct 'lose' outcome for analytics", () => {
      const losingGame = { ...mockPlayerGame, correctAnswer: false };
      renderWithTheme(
        <DetailModal
          show={true}
          toggleModal={toggleModalMock}
          playerGame={losingGame}
        >
          <Text>Child Content</Text>
        </DetailModal>
      );

      fireEvent.press(screen.getByText("Share"));
      expect(analyticsService.trackShareResults).toHaveBeenCalledWith("lose");
    });

    it("should determine the correct 'give_up' outcome for analytics", () => {
      const gaveUpGame = {
        ...mockPlayerGame,
        gaveUp: true,
        correctAnswer: false,
      };
      renderWithTheme(
        <DetailModal
          show={true}
          toggleModal={toggleModalMock}
          playerGame={gaveUpGame}
        >
          <Text>Child Content</Text>
        </DetailModal>
      );

      fireEvent.press(screen.getByText("Share"));
      expect(analyticsService.trackShareResults).toHaveBeenCalledWith(
        "give_up"
      );
    });
  });
});