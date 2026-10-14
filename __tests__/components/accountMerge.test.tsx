import React from "react"
import { render, fireEvent, screen } from "@testing-library/react-native"
import AccountMerge from "../../src/components/accountMerge"
import { useAuth } from "../../src/contexts/authContext"
jest.mock("../../src/contexts/authContext", () => ({ useAuth: jest.fn() }))
jest.mock("../../src/components/ui/button", () => ({ Button: ({ title, onPress, disabled }: any) => { const { Button } = require("react-native"); return <Button title={title} onPress={onPress} disabled={disabled} /> } }))
jest.mock("../../src/components/ui/typography", () => ({ Typography: ({ children }: any) => { const { Text } = require("react-native"); return <Text>{children}</Text> } }))
const state = { merge: null as any, mergeProposal: null as any, mergeError: null, isMerging: false, isSigningIn: false,
  confirmMerge: jest.fn(), cancelMerge: jest.fn(), continueMerge: jest.fn(), finishMerge: jest.fn() }
beforeEach(() => { jest.clearAllMocks(); (useAuth as jest.Mock).mockReturnValue({ ...state }) })
it("explains conflicts and guest retirement before the explicit confirmation", () => {
  ;(useAuth as jest.Mock).mockReturnValue({ ...state, mergeProposal: { accountLabel: "saved@example.test" } })
  render(<AccountMerge />)
  expect(screen.getByText(/saved account's game and score stay/)).toBeTruthy()
  expect(screen.getByText(/this guest account will be retired/)).toBeTruthy()
  expect(state.confirmMerge).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Keep playing as guest"))
  expect(state.cancelMerge).toHaveBeenCalledTimes(1)
  expect(state.confirmMerge).not.toHaveBeenCalled()
})
it("requires server recovery or cancellation without offering account switching for an ambiguous request", () => {
  ;(useAuth as jest.Mock).mockReturnValue({ ...state, merge: { status: "submitting", operationId: "confirmation-00001" } })
  render(<AccountMerge />)
  expect(screen.queryByText("Open saved account")).toBeNull()
  expect(screen.getByText("Cancel if copying hasn't started")).toBeTruthy()
  fireEvent.press(screen.getByText("Verify account and continue"))
  expect(state.continueMerge).toHaveBeenCalledTimes(1)
})
it("shows imported and separately preserved counts before opening the saved account", () => {
  ;(useAuth as jest.Mock).mockReturnValue({ ...state, merge: { status: "complete", imported: 3, conflicts: 2 } })
  render(<AccountMerge />)
  expect(screen.getByText(/3 guest games added. 2 same-day guest games preserved separately/)).toBeTruthy()
  expect(state.finishMerge).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText("Open saved account"))
  expect(state.finishMerge).toHaveBeenCalledTimes(1)
})
it("blocks duplicate taps during confirmation", () => {
  ;(useAuth as jest.Mock).mockReturnValue({ ...state, isMerging: true, mergeProposal: { accountLabel: "saved@example.test" } })
  render(<AccountMerge />)
  fireEvent.press(screen.getByText("Combine progress"))
  fireEvent.press(screen.getByText("Keep playing as guest"))
  expect(state.confirmMerge).not.toHaveBeenCalled()
  expect(state.cancelMerge).not.toHaveBeenCalled()
})
