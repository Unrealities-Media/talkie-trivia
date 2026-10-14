import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import GuestArchive from "../../src/components/guestArchive"
import { GuestArchiveEntry, guestArchiveService } from "../../src/services/guestArchiveService"
import { defaultPlayerGame, defaultTriviaItem } from "../../src/models/default"

jest.mock("../../src/services/guestArchiveService", () => ({ ARCHIVE_PAGE_SIZE: 20, guestArchiveService: { page: jest.fn() } }))
jest.mock("../../src/services/movieDataService", () => ({ MovieDataService: jest.fn(() => ({ getCatalogLists: () => ({
  basicItems: [{ id: 1, title: "Catalog title", releaseDate: "1999-01-01" }],
}) })) }))
jest.mock("../../src/components/ui/button", () => ({ Button: ({ title, onPress, disabled }: any) => { const { Button } = require("react-native"); return <Button title={title} onPress={onPress} disabled={disabled} /> } }))
jest.mock("../../src/components/ui/typography", () => ({ Typography: ({ children }: any) => { const { Text } = require("react-native"); return <Text>{children}</Text> } }))
jest.mock("../../src/components/detailModal", () => ({ __esModule: true, default: ({ show, toggleModal, children, playerGame }: any) => {
  const { View, Button } = require("react-native")
  return show ? <View>{children}<Button title="Close" onPress={() => toggleModal(false)} />{playerGame && <Button title="Share" />}</View> : null
} }))
const entry = (overrides = {}): GuestArchiveEntry => ({ id: "guest_movies_2026-10-13", game: {
  ...defaultPlayerGame, id: "movies_2026-10-13", playerID: "saved", challengeId: "2026-10-13", difficulty: "LEVEL_2", guessesMax: 5,
  score: 425, correctAnswer: true, statsProcessed: true, gaveUp: false,
  guesses: [{ itemId: 404, hintInfo: [{ type: "genre", label: "Shared genre", value: [{ name: "Drama" }] }] }, { itemId: 1 }],
  triviaItem: { ...defaultTriviaItem, id: 1, title: "Archived answer", description: "Original reviewed clue", hints: [
    { type: "director", label: "Director", value: "Original Director" }, { type: "year", label: "Year", value: 1999 },
  ] }, hintsUsed: { director: true }, ...overrides,
} })
const page = guestArchiveService.page as jest.Mock
const cursor = { uid: "saved", dateId: "2026-10-13", id: "guest-20_movies_2026-10-13" }
beforeEach(() => { jest.clearAllMocks(); page.mockResolvedValue({ entries: [entry()], next: null }) })
it("reveals the original answer only when opened, with preserved guesses/hints and no share action", async () => {
  render(<GuestArchive uid="saved" />)
  await screen.findByText("View guest record 1")
  expect(screen.queryByText("Archived answer")).toBeNull()
  fireEvent.press(screen.getByText("View guest record 1"))
  expect(screen.getByText("Archived answer")).toBeTruthy()
  expect(screen.getByText("Original reviewed clue")).toBeTruthy()
  expect(screen.getByText(/Original score: 425/)).toBeTruthy()
  expect(screen.getByText(/Title no longer in the catalog \(movie 404\).*Incorrect/)).toBeTruthy()
  expect(screen.getByText(/Catalog title \(1999\).*Correct/)).toBeTruthy()
  expect(screen.getByText("Shared genre: Drama")).toBeTruthy()
  expect(screen.getByText("Director: Original Director")).toBeTruthy()
  expect(screen.queryByText("Year: 1999")).toBeNull()
  expect(screen.getByText(/cannot be continued or replace your account's game/)).toBeTruthy()
  expect(screen.queryByText("Share")).toBeNull()
  fireEvent.press(screen.getByText("Close"))
  expect(screen.queryByText("Archived answer")).toBeNull()
  expect(page).toHaveBeenCalledTimes(1)
})
it("shows Basic automatic clues even when no hint was spent and labels unfinished records", async () => {
  page.mockResolvedValue({ entries: [entry({ difficulty: "LEVEL_1", hintsUsed: {}, guesses: [], score: 0, correctAnswer: false, statsProcessed: false })], next: null })
  render(<GuestArchive uid="saved" />)
  fireEvent.press(await screen.findByText("View guest record 1"))
  expect(screen.getAllByText(/Unfinished/)).toHaveLength(2)
  expect(screen.getByText("No guesses were made.")).toBeTruthy()
  expect(screen.getByText("Year: 1999")).toBeTruthy()
  expect(screen.getByText(/available automatically/)).toBeTruthy()
})
it("retries a failed next page using its cursor and returns to the previous page", async () => {
  page.mockResolvedValueOnce({ entries: [entry()], next: cursor }).mockRejectedValueOnce(new Error("offline"))
  render(<GuestArchive uid="saved" />)
  fireEvent.press(await screen.findByText("More guest games"))
  await screen.findByText("Retry preserved games")
  expect(screen.queryByText("View guest record 1")).toBeNull()
  expect(screen.queryByText(/No preserved guest games/)).toBeNull()
  fireEvent.press(screen.getByText("Retry preserved games"))
  await screen.findByText("View guest record 21")
  expect(page).toHaveBeenNthCalledWith(2, "saved", cursor)
  expect(page).toHaveBeenNthCalledWith(3, "saved", cursor)
  fireEvent.press(screen.getByText("Previous guest games"))
  await screen.findByText("View guest record 1")
  expect(page).toHaveBeenLastCalledWith("saved", null)
})
it("coalesces rapid next/previous taps instead of skipping a cursor or moving below page zero", async () => {
  page.mockResolvedValueOnce({ entries: [entry()], next: cursor })
  render(<GuestArchive uid="saved" />)
  const next = await screen.findByText("More guest games")
  act(() => { fireEvent.press(next); fireEvent.press(next) })
  await screen.findByText("View guest record 21")
  expect(page).toHaveBeenLastCalledWith("saved", cursor)
  const previous = screen.getByText("Previous guest games")
  act(() => { fireEvent.press(previous); fireEvent.press(previous) })
  await screen.findByText("View guest record 1")
  expect(page).toHaveBeenLastCalledWith("saved", null)
  expect(screen.queryByText("Previous guest games")).toBeNull()
})
it("removes an open record immediately when its owner changes", async () => {
  const view = render(<GuestArchive uid="saved" />)
  fireEvent.press(await screen.findByText("View guest record 1"))
  page.mockReturnValueOnce(new Promise(() => {}))
  view.rerender(<GuestArchive uid="other" />)
  expect(screen.queryByText("Archived answer")).toBeNull()
  expect(screen.queryByText("View guest record 1")).toBeNull()
})
it("ignores a late response for the previous account", async () => {
  let resolve!: (value: unknown) => void
  page.mockReturnValueOnce(new Promise(done => { resolve = done })).mockResolvedValueOnce({ entries: [], next: null })
  const view = render(<GuestArchive uid="saved" />)
  view.rerender(<GuestArchive uid="other" />)
  await screen.findByText("No preserved guest games on this page.")
  await act(async () => { resolve({ entries: [entry()], next: cursor }) })
  await waitFor(() => expect(screen.queryByText("View guest record 1")).toBeNull())
  expect(screen.queryByText("More guest games")).toBeNull()
})
