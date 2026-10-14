import React from "react"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react-native"
import { Text, Alert } from "react-native"
import { reloadAppAsync } from "expo"
import ErrorBoundary from "../../src/components/errorBoundary"
import { analyticsService } from "../../src/utils/analyticsService"

jest.mock("expo", () => ({ reloadAppAsync: jest.fn() }))
jest.mock("../../src/utils/analyticsService")
jest.spyOn(Alert, "alert")

const errorMessage = "Test Error Message"
const ProblemChild = () => {
  throw new Error(errorMessage)
}

const HealthyChild = () => <Text>Healthy Content</Text>

describe("ErrorBoundary Component", () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(reloadAppAsync).mockReset().mockResolvedValue(undefined)
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    cleanup()
  })

  it("should render children components when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <HealthyChild />
      </ErrorBoundary>
    )
    expect(screen.getByText("Healthy Content")).toBeTruthy()
  })

  it("should catch an error and display the fallback UI", () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    )
    expect(screen.getByText("Oops! Something went wrong.")).toBeTruthy()
    expect(analyticsService.trackErrorBoundary).toHaveBeenCalledWith(
      errorMessage
    )
  })

  it("reloads the installed app without requiring OTA updates", async () => {
    render(
      <ErrorBoundary>
        <ProblemChild />
      </ErrorBoundary>
    )

    await act(async () => { fireEvent.press(screen.getByTestId("reload-button")) })

    expect(reloadAppAsync).toHaveBeenCalledWith("error-boundary")
    expect(screen.getByText("Reloading…")).toBeTruthy()
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it("does not request multiple reloads while the native request is pending", async () => {
    let finish!: () => void
    jest.mocked(reloadAppAsync).mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    render(<ErrorBoundary><ProblemChild /></ErrorBoundary>)
    fireEvent.press(screen.getByTestId("reload-button"))
    fireEvent.press(screen.getByTestId("reload-button"))
    expect(reloadAppAsync).toHaveBeenCalledTimes(1)
    await act(async () => { finish() })
    expect(screen.getByTestId("reload-button")).toBeDisabled()
  })

  it("explains a failed reload and allows another attempt", async () => {
    jest.mocked(reloadAppAsync).mockRejectedValueOnce(new Error("Native reload failed"))
    render(<ErrorBoundary><ProblemChild /></ErrorBoundary>)
    await act(async () => { fireEvent.press(screen.getByTestId("reload-button")) })
    expect(Alert.alert).toHaveBeenCalledWith("Reload Failed", expect.stringContaining("close and restart"))
    expect(screen.getByTestId("reload-button")).not.toBeDisabled()
    await act(async () => { fireEvent.press(screen.getByTestId("reload-button")) })
    expect(reloadAppAsync).toHaveBeenCalledTimes(2)
  })

  it("does not show a late reload error after the boundary unmounts", async () => {
    let fail!: (error: Error) => void
    jest.mocked(reloadAppAsync).mockReturnValue(new Promise<void>((_, reject) => { fail = reject }))
    const view = render(<ErrorBoundary><ProblemChild /></ErrorBoundary>)
    fireEvent.press(screen.getByTestId("reload-button"))
    view.unmount()
    await act(async () => { fail(new Error("Late failure")) })
    expect(Alert.alert).not.toHaveBeenCalled()
  })
})
