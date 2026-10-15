import React, { ReactElement } from "react"
import { render, screen, waitFor } from "@testing-library/react-native"
import { ThemeProvider } from "../../../src/contexts/themeContext"
import { useAuth } from "../../../src/contexts/authContext"
import { useGameStore } from "../../../src/state/gameStore"

// 1. Mock React.lazy to avoid dynamic import error and circular dependency.
jest.mock("react", () => {
  const actual = jest.requireActual("react")
  return {
    ...actual,
    lazy: (_factory: any) => {
      const Component = (props: any) => {
        // Use STRING "View" to avoid requiring react-native which causes circular dependency
        return actual.createElement(
          "View",
          { ...props, testID: "lazy-component" },
          props.children
        )
      }
      return Component
    },
    Suspense: ({ children }: any) => children,
  }
})

// 2. Mock the modules.
jest.mock("../../../src/components/googleLogin", () => () => <></>)
jest.mock("../../../src/components/playerStats", () => () => <></>)
jest.mock("../../../src/components/gameHistory", () => () => <></>)
jest.mock("../../../src/components/themeSelector", () => () => <></>)
jest.mock("../../../src/components/difficultySelector", () => () => <></>)
jest.mock("../../../src/components/historyDetailModal", () => () => <></>)

jest.mock("../../../src/contexts/authContext")
jest.mock("../../../src/state/gameStore")
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0", extra: { publicSiteUrl: "https://beta.example.com" } } }))

// Import after mocks
import ProfileScreen from "../../../src/app/(tabs)/profile"

const mockUseAuth = useAuth as jest.Mock
const mockUseGameStore = useGameStore as unknown as jest.Mock

const renderWithTheme = (ui: ReactElement) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe("App: ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseGameStore.mockImplementation((selector: any) =>
      selector({
        playerStats: {},
        loading: false,
      })
    )
  })

  it("should show loading indicator if authentication is loading", () => {
    mockUseAuth.mockReturnValue({ player: null, user: null, loading: true })
    mockUseGameStore.mockImplementation((selector: any) =>
      selector({ loading: true })
    )

    renderWithTheme(<ProfileScreen />)

    expect(screen.getByTestId("loading-indicator-container")).toBeTruthy()
    expect(screen.getByText("Settings")).toBeTruthy()
    expect(screen.getByText("Privacy Policy")).toBeTruthy()
  })

  it("should render guest profile correctly", async () => {
    mockUseAuth.mockReturnValue({
      player: { name: "Guest" },
      user: { isAnonymous: true },
    })

    renderWithTheme(<ProfileScreen />)

    await waitFor(() => {
      expect(screen.getByText("Your life in movies, one challenge at a time.")).toBeTruthy()
      expect(screen.getByText("Link Your Guest Account")).toBeTruthy()
      expect(screen.queryByText("Preserved guest games")).toBeNull()
    })
  })

  it("should render signed-in user profile correctly", async () => {
    mockUseAuth.mockReturnValue({
      player: { id: "saved", name: "Test User" },
      user: { uid: "saved", isAnonymous: false },
    })

    renderWithTheme(<ProfileScreen />)

    await waitFor(() => {
      expect(screen.getByText("Welcome back, Test User.")).toBeTruthy()
      expect(screen.queryByText("Link Your Guest Account")).toBeNull()
      expect(screen.getByText("Preserved guest games")).toBeTruthy()
      expect(screen.getAllByTestId("lazy-component").filter(item => item.props.uid === "saved")).toHaveLength(1)
    })
  })

  it("should render legal footer and version info", async () => {
    mockUseAuth.mockReturnValue({
      player: { name: "User" },
      user: { isAnonymous: true },
    })

    renderWithTheme(<ProfileScreen />)

    await waitFor(() => {
      expect(screen.getByText(/Version/)).toBeTruthy()
      expect(screen.getByText(/uses the TMDB API/)).toBeTruthy()
    })
  })
  it("keeps settings and the footer reachable after an account error", () => {
    mockUseAuth.mockReturnValue({ player: null, user: null, loading: false, error: "Account unavailable", retryAuthentication: jest.fn() })
    renderWithTheme(<ProfileScreen />)
    expect(screen.getByText("Account unavailable")).toBeTruthy()
    expect(screen.getByText("Settings")).toBeTruthy()
    expect(screen.getByText("Privacy Policy")).toBeTruthy()
  })
})
