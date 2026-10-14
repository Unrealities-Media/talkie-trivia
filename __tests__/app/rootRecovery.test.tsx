import React from "react"
import { render, screen } from "@testing-library/react-native"
import RootLayout from "../../src/app/_layout"
import { useAuth } from "../../src/contexts/authContext"
import { useNetwork } from "../../src/contexts/networkContext"
import { useNotifications } from "../../src/utils/hooks/useNotifications"
jest.mock("expo-router", () => {
  const { Text } = require("react-native")
  return { Slot: () => <Text>Tabs remain available</Text> }
})
jest.mock("../../src/contexts/authContext", () => ({ AuthProvider: ({ children }: any) => children, useAuth: jest.fn() }))
jest.mock("../../src/contexts/networkContext", () => ({ NetworkProvider: ({ children }: any) => children, useNetwork: jest.fn() }))
jest.mock("../../src/contexts/themeContext", () => ({ ThemeProvider: ({ children }: any) => children }))
jest.mock("../../src/components/errorBoundary", () => ({ children }: any) => children)
jest.mock("../../src/utils/hooks/useDailyChallenge", () => ({ useDailyChallenge: jest.fn() }))
jest.mock("../../src/utils/hooks/useNotifications", () => ({ useNotifications: jest.fn() }))
jest.mock("@sentry/react-native", () => ({ init: jest.fn(), wrap: (component: any) => component }))
it.each([null, false, true])("keeps navigation available with connectivity %s and a failed account", connected => {
  ;(useNetwork as jest.Mock).mockReturnValue({ isNetworkConnected: connected })
  ;(useAuth as jest.Mock).mockReturnValue({ player: null, error: "Account unavailable", loading: false })
  render(<RootLayout />)
  expect(screen.getByText("Tabs remain available")).toBeTruthy()
  expect(useNotifications).toHaveBeenLastCalledWith(false)
})

it.each([{ loading: true }, { loading: false, deletion: { status: "pending" } }])("suspends reminder reconciliation during account initialization/deletion: %p", state => {
  ;(useNetwork as jest.Mock).mockReturnValue({ isNetworkConnected: true })
  ;(useAuth as jest.Mock).mockReturnValue({ player: null, ...state })
  render(<RootLayout />)
  expect(useNotifications).toHaveBeenLastCalledWith(true)
})
