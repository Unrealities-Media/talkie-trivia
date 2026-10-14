import React, { ReactElement } from "react"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  RenderOptions,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import Facts from "../../src/components/facts"
import { TriviaItem } from "../../src/models/trivia"
import { useExternalLink } from "../../src/utils/hooks/useExternalLink"
import { analyticsService } from "../../src/utils/analyticsService"
import { API_CONFIG } from "../../src/config/constants"

// --- Mocking Dependencies ---
jest.mock("../../src/utils/hooks/useExternalLink")
jest.mock("../../src/utils/analyticsService")

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

const mockOpenLink = jest.fn()
const mockUseExternalLink = useExternalLink as jest.Mock
const mockAnalyticsService = analyticsService as jest.Mocked<
  typeof analyticsService
>

// --- Mock Data ---
const mockTriviaItem: TriviaItem = {
  id: 1,
  title: "Inception",
  description: "A thief who steals corporate secrets...",
  posterPath: "/inception_poster.jpg",
  releaseDate: "2010-07-16",
  metadata: {
    imdb_id: "tt1375666",
    tagline: "Your mind is the scene of the crime.",
  },
  hints: [
    { type: "director", label: "Director", value: "Christopher Nolan" },
    {
      type: "actors",
      label: "Actors",
      value: [
        { id: 1, name: "Leonardo DiCaprio", imdb_id: "nm0000138" },
        { id: 2, name: "Joseph Gordon-Levitt", imdb_id: "nm0330687" },
      ],
    },
    { type: "genre", label: "Genre", value: "Sci-Fi" },
  ],
}

describe("Facts Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseExternalLink.mockReturnValue({ openLink: mockOpenLink })
  })

  afterEach(cleanup)

  describe("Conditional States", () => {
    it("should render the loading indicator when isLoading is true", () => {
      renderWithTheme(<Facts item={mockTriviaItem} isLoading={true} />)
      expect(screen.getByTestId("activity-indicator")).toBeTruthy()
      expect(screen.queryByText(mockTriviaItem.title)).toBeNull()
    })

    it("should render the error message when an error is provided", () => {
      const errorMessage = "Failed to load movie details."
      renderWithTheme(<Facts item={mockTriviaItem} error={errorMessage} />)
      expect(screen.getByText(errorMessage)).toBeTruthy()
      expect(screen.queryByText(mockTriviaItem.title)).toBeNull()
    })
  })

  describe("Content Rendering", () => {
    it("replaces a failed poster and loads a different movie's poster", () => {
      const { rerender } = renderWithTheme(<Facts item={mockTriviaItem} />)
      fireEvent(screen.getAllByTestId("mock-expo-image")[0], "error")
      expect(screen.getAllByTestId("mock-expo-image")[0].props.source).toBe(require("../../assets/premiere/theatre.png"))
      rerender(<ThemeProvider><Facts item={{ ...mockTriviaItem, posterPath: "/next-film.jpg" }} /></ThemeProvider>)
      expect(screen.getAllByTestId("mock-expo-image")[0].props["data-source"]).toContain("/next-film.jpg")
    })

    it("should render all movie details correctly", () => {
      renderWithTheme(<Facts item={mockTriviaItem} />)

      // Header and Tagline
      expect(screen.getByText(mockTriviaItem.title)).toBeTruthy()
      expect(screen.getByText(mockTriviaItem.metadata.tagline)).toBeTruthy()

      // Poster Image - FIX: Use getAllByTestId and select the first one
      const allImages = screen.getAllByTestId("mock-expo-image")
      const poster = allImages[0] // The main poster is rendered before the actor images
      expect(poster.props["data-source"]).toContain(mockTriviaItem.posterPath)

      // Hints (Director)
      expect(screen.getByText("Director: Christopher Nolan")).toBeTruthy()
      expect(screen.getByText("Released: 2010")).toBeTruthy()

      // Hints (Actors) - Check that the Actors component rendered its content
      expect(screen.getByText("Leonardo DiCaprio")).toBeTruthy()
    })

    it("should use a fallback image if posterPath is null", () => {
      const itemWithNoPoster = { ...mockTriviaItem, posterPath: "" }
      renderWithTheme(<Facts item={itemWithNoPoster} />)

      const allImages = screen.getAllByTestId("mock-expo-image")
      const poster = allImages[0]
      // The fileMock returns '1' for any require() call
      expect(poster.props.source).toBe(1)
    })

    it("should render the header as non-pressable if imdb_id is missing", () => {
      const itemWithoutImdb = {
        ...mockTriviaItem,
        metadata: { ...mockTriviaItem.metadata, imdb_id: null },
      }
      renderWithTheme(<Facts item={itemWithoutImdb} />)

      const headerPressable = screen.getByText(
        itemWithoutImdb.title
      ).parent
      expect(headerPressable?.props.onPress).toBeUndefined()

      expect(screen.queryByTestId("mock-icon-external-link-square")).toBeNull()
    })
  })

  describe("Interactions", () => {
    it("does not make malformed title IDs into external links", () => {
      renderWithTheme(<Facts item={{ ...mockTriviaItem, metadata: { imdb_id: "tt1375666/../../other" } }} />)
      expect(screen.queryByRole("link", { name: "Open IMDb page for Inception" })).toBeNull()
      fireEvent.press(screen.getByText("Inception"))
      expect(mockOpenLink).not.toHaveBeenCalled()
    })

    it("shows the exact release year in compact history rather than substituting the decade", () => {
      renderWithTheme(<Facts compact item={{ ...mockTriviaItem, hints: [...mockTriviaItem.hints, { type: "decade", label: "Decade", value: "2010s" }] }} />)
      expect(screen.getByText("Released: 2010")).toBeTruthy()
      expect(screen.queryByText("Released: 2010s")).toBeNull()
    })
    it("should call openLink and analytics when the linkable header is pressed", () => {
      renderWithTheme(<Facts item={mockTriviaItem} />)

      const headerPressable = screen.getByText(mockTriviaItem.title)
      fireEvent.press(headerPressable)

      const expectedUrl = `${API_CONFIG.IMDB_BASE_URL_TITLE}${mockTriviaItem.metadata.imdb_id}`
      expect(mockOpenLink).toHaveBeenCalledWith(expectedUrl)
      expect(mockAnalyticsService.trackImdbLinkTapped).toHaveBeenCalledWith(
        mockTriviaItem.title
      )
    })

    it("should call openLink and analytics when an actor is pressed", () => {
      renderWithTheme(<Facts item={mockTriviaItem} />)

      const actorToPress = screen.getByTestId("actor-pressable-1")
      fireEvent.press(actorToPress)

      const actor = mockTriviaItem.hints.find((h) => h.type === "actors")
        ?.value[0]
      const expectedUrl = `${API_CONFIG.IMDB_BASE_URL_NAME}${actor.imdb_id}`

      expect(mockOpenLink).toHaveBeenCalledWith(expectedUrl)
      expect(mockAnalyticsService.trackActorLinkTapped).toHaveBeenCalledWith(
        actor.name
      )
    })
  })
})
