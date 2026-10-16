import React from "react"
import { Text } from "react-native"
import { render, screen, fireEvent } from "@testing-library/react-native"
import DetailModal from "../../src/components/detailModal"
import { ThemeProvider } from "../../src/contexts/themeContext"
jest.mock("../../src/utils/hapticsService")
const close = jest.fn()
const show = (visible = true) => render(<ThemeProvider><DetailModal show={visible} toggleModal={close}><Text>Movie details</Text></DetailModal></ThemeProvider>)
beforeEach(() => jest.clearAllMocks())

it("hides content when closed and closes through the explicit button or backdrop", () => {
  const view = show(false)
  expect(screen.queryByText("Movie details")).toBeNull()
  view.unmount()
  show()
  fireEvent.press(screen.getByRole("button", { name: "Close" }))
  fireEvent.press(screen.getByLabelText("Close modal by tapping outside"))
  expect(close).toHaveBeenCalledTimes(2)
  expect(close).toHaveBeenCalledWith(false)
})
