import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { Linking } from "react-native"
import ReminderSettings from "../../src/components/reminderSettings"
import { reminderService, ReminderSnapshot } from "../../src/services/reminderService"
import { ThemeProvider } from "../../src/contexts/themeContext"

jest.mock("../../src/services/reminderService", () => ({ reminderService: {
  subscribe: jest.fn(() => () => undefined), getSnapshot: jest.fn(),
  configure: jest.fn(), disable: jest.fn(), refresh: jest.fn(),
} }))
let snapshot: ReminderSnapshot
beforeEach(() => {
  jest.clearAllMocks()
  snapshot = { enabled: false, hour: 9, minute: 0, status: "off", busy: false }
  jest.mocked(reminderService.getSnapshot).mockImplementation(() => snapshot)
  jest.mocked(reminderService.configure).mockResolvedValue(undefined)
  jest.mocked(reminderService.disable).mockResolvedValue(undefined)
  jest.mocked(reminderService.refresh).mockResolvedValue(undefined)
})
const show = (suspended = false) => render(<ThemeProvider><ReminderSettings suspended={suspended} /></ThemeProvider>)

it("explains device-local daily delivery and does nothing until explicit opt-in", async () => {
  show()
  expect(screen.getByText("Reminders are off.")).toBeTruthy()
  expect(screen.getByText(/even if I've already played/)).toBeTruthy()
  expect(reminderService.configure).not.toHaveBeenCalled()
  fireEvent.changeText(screen.getByLabelText("Daily reminder time, 24-hour clock"), "20:15")
  fireEvent.press(screen.getByRole("button", { name: "Enable daily reminder" }))
  await waitFor(() => expect(reminderService.configure).toHaveBeenCalledWith({ enabled: true, hour: 20, minute: 15 }))
})

it("rejects invalid time without requesting permission or saving", () => {
  show()
  fireEvent.changeText(screen.getByLabelText("Daily reminder time, 24-hour clock"), "25:99")
  fireEvent.press(screen.getByRole("button", { name: "Enable daily reminder" }))
  expect(screen.getByRole("alert")).toHaveTextContent(/00:00 to 23:59/)
  expect(reminderService.configure).not.toHaveBeenCalled()
})

it("prevents duplicate actions while the same event handler is still pending", async () => {
  let resolve!: () => void
  jest.mocked(reminderService.configure).mockImplementation(() => new Promise<void>(r => { resolve = r }))
  show()
  fireEvent.press(screen.getByRole("button", { name: "Enable daily reminder" }))
  fireEvent.press(screen.getByRole("button", { name: "Enable daily reminder" }))
  expect(reminderService.configure).toHaveBeenCalledTimes(1)
  await act(async () => resolve())
})

it("shows an honest failed-update state with retry and explicit cancellation", async () => {
  snapshot = { ...snapshot, enabled: true, status: "error" }
  show()
  expect(screen.getByText(/previous reminder may still arrive/)).toBeTruthy()
  fireEvent.press(screen.getByRole("button", { name: "Retry reminder update" }))
  await waitFor(() => expect(reminderService.refresh).toHaveBeenCalledTimes(1))
  fireEvent.press(screen.getByRole("button", { name: "Turn reminders off" }))
  await waitFor(() => expect(reminderService.disable).toHaveBeenCalledTimes(1))
})

it("offers system settings after denial and handles failure to open them", async () => {
  snapshot = { ...snapshot, enabled: true, status: "blocked" }
  jest.spyOn(Linking, "openSettings").mockRejectedValueOnce(new Error("unavailable"))
  show()
  fireEvent.press(screen.getByRole("button", { name: "Open device settings" }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Open your device settings/))
  expect(reminderService.configure).not.toHaveBeenCalled()
})

it.each(["deletion", "busy"])("disables controls during %s", reason => {
  snapshot = { ...snapshot, busy: reason === "busy" }
  show(reason === "deletion")
  expect(screen.getByRole("button", { name: "Enable daily reminder" })).toBeDisabled()
  expect(screen.getByLabelText("Daily reminder time, 24-hour clock").props.editable).toBe(false)
})

it("does not offer native notification controls on web", () => {
  snapshot = { ...snapshot, status: "unsupported" }
  show()
  expect(screen.queryByRole("button")).toBeNull()
  expect(screen.getByText(/Android and iOS app/)).toBeTruthy()
})
