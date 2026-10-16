import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"
import { useAuth } from "../../src/contexts/authContext"
import ProfileHistory from "../../src/components/profileHistory"

jest.mock("../../src/contexts/authContext")
jest.mock("../../src/components/gameHistory", () => {
  const { Button } = require("react-native")
  return ({ onHistoryItemPress }: any) => <Button title="Open movie" onPress={() => onHistoryItemPress({ itemTitle: "Inception" })} />
})
jest.mock("../../src/components/historyDetailModal", () => {
  const { Text, Button, View } = require("react-native")
  return ({ historyItem, onClose }: any) => historyItem ? <View><Text>{historyItem.itemTitle}</Text><Button title="Close result" onPress={onClose} /></View> : null
})

beforeEach(() => {
  ;(useAuth as jest.Mock).mockReturnValue({ player: { id: "p1" }, user: { uid: "p1" } })
})

it("opens movie details and closes them without leaving history", () => {
  render(<ProfileHistory compact />)
  fireEvent.press(screen.getByText("Open movie"))
  expect(screen.getByText("Inception")).toBeTruthy()
  fireEvent.press(screen.getByText("Close result"))
  expect(screen.queryByText("Inception")).toBeNull()
  expect(screen.getByText("Open movie")).toBeTruthy()
})

it("clears the selected movie when the player changes", () => {
  const { rerender } = render(<ProfileHistory />)
  fireEvent.press(screen.getByText("Open movie"))
  ;(useAuth as jest.Mock).mockReturnValue({ player: { id: "p2" }, user: { uid: "p2" } })
  rerender(<ProfileHistory />)
  expect(screen.queryByText("Inception")).toBeNull()
  ;(useAuth as jest.Mock).mockReturnValue({ player: { id: "p1" }, user: { uid: "p1" } })
  rerender(<ProfileHistory />)
  expect(screen.queryByText("Inception")).toBeNull()
})

it("hides history after sign-out", () => {
  const { rerender } = render(<ProfileHistory />)
  fireEvent.press(screen.getByText("Open movie"))
  ;(useAuth as jest.Mock).mockReturnValue({ player: null, user: null })
  rerender(<ProfileHistory />)
  expect(screen.queryByText("Inception")).toBeNull()
  expect(screen.queryByText("Open movie")).toBeNull()
})
