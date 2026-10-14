import React from "react"
import { Text, Share, Alert } from "react-native"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native"
import DetailModal from "../../src/components/detailModal"
import { ThemeProvider } from "../../src/contexts/themeContext"
import { defaultPlayerGame } from "../../src/models/default"
import { generateShareMessage } from "../../src/utils/shareUtils"
import { analyticsService } from "../../src/utils/analyticsService"
jest.mock("../../src/utils/analyticsService")
jest.mock("../../src/utils/hapticsService")
jest.spyOn(Share, "share")
jest.spyOn(Alert, "alert")
const game = { ...defaultPlayerGame, challengeId: "2026-10-13", correctAnswer: true, guesses: [{ itemId: 1 }], statsProcessed: true, score: 700 }
const close = jest.fn()
const show = (playerGame = game, visible = true) => render(<ThemeProvider><DetailModal show={visible} toggleModal={close} playerGame={playerGame}><Text>Movie details</Text></DetailModal></ThemeProvider>)
beforeEach(() => { jest.clearAllMocks(); (Share.share as jest.Mock).mockResolvedValue({ action: Share.sharedAction }) })

it("hides content when closed and closes through the explicit button or backdrop", () => {
  const view = show(game, false)
  expect(screen.queryByText("Movie details")).toBeNull()
  view.unmount()
  show()
  fireEvent.press(screen.getByRole("button", { name: "Close" }))
  fireEvent.press(screen.getByLabelText("Close modal by tapping outside"))
  expect(close).toHaveBeenCalledTimes(2)
  expect(close).toHaveBeenCalledWith(false)
})

it("hides sharing until there is a saved completed result", () => {
  show({ ...game, statsProcessed: false })
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull()
})

it("uses the same spoiler-safe saved result as the post-game share button", async () => {
  show()
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Share" })))
  expect(Share.share).toHaveBeenCalledWith({ message: generateShareMessage(game), title: "Talkie Trivia Results" }, expect.anything())
  expect(analyticsService.trackShareResults).toHaveBeenCalledWith("win")
})

it("quietly handles dismissed sheets without recording a share", async () => {
  ;(Share.share as jest.Mock).mockResolvedValueOnce({ action: Share.dismissedAction })
  show()
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Share" })))
  expect(Alert.alert).not.toHaveBeenCalled()
  expect(analyticsService.trackShareResults).not.toHaveBeenCalled()
})

it("shows a useful failure message and allows retry without exposing native error text", async () => {
  ;(Share.share as jest.Mock).mockRejectedValueOnce(null)
  show()
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Share" })))
  expect(Alert.alert).toHaveBeenCalledWith("Sharing Failed", "Your result could not be shared. Please try again.")
  await act(async () => fireEvent.press(screen.getByRole("button", { name: "Share" })))
  expect(Share.share).toHaveBeenCalledTimes(2)
})

it("blocks repeated presses until the current share sheet completes", async () => {
  let finish!: (value: unknown) => void
  ;(Share.share as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  show()
  fireEvent.press(screen.getByRole("button", { name: "Share" }))
  fireEvent.press(screen.getByRole("button", { name: "Share" }))
  expect(Share.share).toHaveBeenCalledTimes(1)
  expect(analyticsService.trackShareResults).not.toHaveBeenCalled()
  await act(async () => finish({ action: Share.sharedAction }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Share" })).not.toBeDisabled())
})
