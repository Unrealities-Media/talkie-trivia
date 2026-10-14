import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import TextTabBar, { TextTabBarProps } from "../../src/components/textTabBar"
import { ThemeContext } from "../../src/contexts/themeContext"
import { lightColors } from "../../src/styles/themes"

function setup(prevent = false) {
  const navigation = { emit: jest.fn(() => ({ defaultPrevented: prevent })), navigate: jest.fn() }
  const props = {
    state: { index: 0, routes: [
      { key: "game-key", name: "game" }, { key: "profile-key", name: "profile", params: { test: "retained" } },
      { key: "index-key", name: "index" },
    ] },
    descriptors: { "game-key": { options: { title: "Game" } }, "profile-key": { options: { title: "Profile" } } },
    navigation, insets: { bottom: 24, top: 0, left: 0, right: 0 },
  } as unknown as TextTabBarProps
  render(<ThemeContext.Provider value={{ theme: "light", colorScheme: "light", colors: lightColors, setTheme: jest.fn() }}>
    <TextTabBar {...props} fontsLoaded />
  </ThemeContext.Provider>)
  return navigation
}
it("exposes only launch destinations with selected tab semantics", () => {
  setup()
  expect(screen.getAllByRole("tab")).toHaveLength(2)
  expect(screen.getByRole("tab", { name: "Game" }).props.accessibilityState.selected).toBe(true)
  expect(screen.getByRole("tab", { name: "Profile" }).props.accessibilityState.selected).toBe(false)
})
it("preserves cancellable tab navigation and route parameters", () => {
  const navigation = setup()
  fireEvent.press(screen.getByRole("tab", { name: "Profile" }))
  expect(navigation.emit).toHaveBeenCalledWith({ type: "tabPress", target: "profile-key", canPreventDefault: true })
  expect(navigation.navigate).toHaveBeenCalledWith("profile", { test: "retained" })
})
it("respects prevented navigation", () => {
  const navigation = setup(true)
  fireEvent.press(screen.getByRole("tab", { name: "Profile" }))
  expect(navigation.navigate).not.toHaveBeenCalled()
})
it("emits reselection and long-press events without navigating the selected route again", () => {
  const navigation = setup()
  const game = screen.getByRole("tab", { name: "Game" })
  fireEvent.press(game)
  fireEvent(game, "longPress")
  expect(navigation.emit).toHaveBeenCalledWith({ type: "tabPress", target: "game-key", canPreventDefault: true })
  expect(navigation.emit).toHaveBeenCalledWith({ type: "tabLongPress", target: "game-key" })
  expect(navigation.navigate).not.toHaveBeenCalled()
})
