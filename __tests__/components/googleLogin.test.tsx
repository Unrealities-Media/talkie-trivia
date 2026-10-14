import React, { ReactElement } from "react"
import {
  render,
  screen,
  fireEvent,
  cleanup,
  RenderOptions,
  within,
} from "@testing-library/react-native"
import { ThemeProvider } from "../../src/contexts/themeContext"
import GoogleLogin from "../../src/components/googleLogin"
import { useAuth } from "../../src/contexts/authContext"
import { hapticsService } from "../../src/utils/hapticsService"

// --- Mocking Dependencies ---
jest.mock("../../src/contexts/authContext")
jest.mock("../../src/utils/hapticsService")

// --- Test Setup ---
const renderWithTheme = (ui: ReactElement, options?: RenderOptions) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>, options)
}

const mockUseAuth = useAuth as jest.Mock
const mockHandleSignIn = jest.fn()
const mockHandleSignOut = jest.fn()

describe("GoogleLogin Component", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(cleanup)

  describe("Signed Out State", () => {
    it("should render 'Sign In with Google' button and call handleSignIn on press", () => {
      mockUseAuth.mockReturnValue({
        user: { isAnonymous: true },
        handleSignIn: mockHandleSignIn,
        isSigningIn: false,
        error: null,
      })

      renderWithTheme(<GoogleLogin />)
      const signInButton = screen.getByRole("button", {
        name: "Sign In with Google",
      })
      fireEvent.press(signInButton)

      expect(hapticsService.medium).toHaveBeenCalledTimes(1)
      expect(mockHandleSignIn).toHaveBeenCalledTimes(1)
    })
  })

  describe("Signed In State", () => {
    it("should render 'Sign Out' with displayName and call handleSignOut on press", () => {
      mockUseAuth.mockReturnValue({
        user: { isAnonymous: false, displayName: "Test User" },
        handleSignOut: mockHandleSignOut,
        isSigningIn: false,
        error: null,
      })

      renderWithTheme(<GoogleLogin />)
      const signOutButton = screen.getByRole("button", {
        name: "Sign Out Test User",
      })
      fireEvent.press(signOutButton)

      expect(hapticsService.medium).toHaveBeenCalledTimes(1)
      expect(mockHandleSignOut).toHaveBeenCalledTimes(1)
    })
  })

  describe("Loading State", () => {
    it("should render a loading indicator and be disabled when isSigningIn is true", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        handleSignIn: mockHandleSignIn,
        isSigningIn: true, // Set loading state
        error: null,
      })

      renderWithTheme(<GoogleLogin />)

      const button = screen.getByRole("button")
      expect(button).toBeDisabled()

      // Query for the ActivityIndicator by the testID we added to the Button component.
      const activityIndicator = within(button).getByTestId("activity-indicator")
      expect(activityIndicator).toBeTruthy()

      // The button title should not be rendered while loading
      expect(screen.queryByText(/Sign In/)).toBeNull()
    })
  })

  describe("Error State", () => {
    it("should display an error message when an error is provided", () => {
      const errorMessage = "Authentication failed."
      mockUseAuth.mockReturnValue({
        user: null,
        accountError: errorMessage,
        isSigningIn: false,
      })

      renderWithTheme(<GoogleLogin />)
      expect(screen.getByText(errorMessage)).toBeTruthy()
    })
  })
})
