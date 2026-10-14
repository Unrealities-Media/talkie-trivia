import React from "react"
import { render, fireEvent, screen } from "@testing-library/react-native"
import AccountDeletion from "../../src/components/accountDeletion"
import { useAuth } from "../../src/contexts/authContext"
jest.mock("../../src/contexts/authContext", () => ({ useAuth: jest.fn() }))
jest.mock("../../src/components/ui/button", () => ({ Button: ({ title, onPress, disabled, isLoading }: any) => { const { Button } = require("react-native"); return <Button title={title} onPress={onPress} disabled={disabled || isLoading} /> } }))
jest.mock("../../src/components/ui/typography", () => ({ Typography: ({ children }: any) => { const { Text } = require("react-native"); return <Text>{children}</Text> } }))
jest.mock("../../src/components/confirmationModal", () => ({ __esModule: true, default: ({ isVisible, confirmText, cancelText, onConfirm, onCancel }: any) => { const { Button } = require("react-native"); return isVisible ? <><Button title={confirmText} onPress={onConfirm} /><Button title={cancelText} onPress={onCancel} /></> : null } }))

const remove = jest.fn()
const refresh = jest.fn()
const restart = jest.fn()
const state = { user: { uid: "guest", isAnonymous: true }, deletion: null as any, deletionError: null, isDeleting: false, isSigningIn: false, handleDeleteAccount: remove, refreshDeletion: refresh, startNewGuest: restart }
beforeEach(() => { jest.clearAllMocks(); (useAuth as jest.Mock).mockReturnValue({ ...state }) })

it("lets a guest cancel the confirmation without requesting deletion", () => {
  render(<AccountDeletion />)
  fireEvent.press(screen.getByText("Delete account and data"))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Keep my account"))
  expect(remove).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Delete account and data"))
  fireEvent.press(screen.getByText("Permanently delete"))
  expect(remove).toHaveBeenCalledTimes(1)
})

it("distinguishes pending and unknown results from completion and does not offer a new account", () => {
  for (const status of ["pending", "unknown", "submitting"]) {
    ;(useAuth as jest.Mock).mockReturnValue({ ...state, deletion: { status } })
    const view = render(<AccountDeletion />)
    expect(screen.queryByText("Account deleted")).toBeNull()
    expect(screen.queryByText("Start again as a new guest")).toBeNull()
    fireEvent.press(screen.getByText("Check deletion status"))
    view.unmount()
  }
  expect(refresh).toHaveBeenCalledTimes(3)
})

it("requires an explicit choice to create a replacement guest after completion", () => {
  ;(useAuth as jest.Mock).mockReturnValue({ ...state, user: null, deletion: { status: "complete" } })
  render(<AccountDeletion />)
  expect(screen.getByText("Account deleted")).toBeTruthy()
  expect(restart).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Start again as a new guest"))
  expect(restart).toHaveBeenCalledTimes(1)
})
