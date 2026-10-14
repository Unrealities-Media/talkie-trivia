import React from "react"
import { Text, Appearance } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ThemeProvider, useTheme } from "../../src/contexts/themeContext"
import ThemeSelector from "../../src/components/themeSelector"
import { ASYNC_STORAGE_KEYS } from "../../src/config/constants"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function CurrentTheme() {
  const { theme, colorScheme } = useTheme()
  return <Text testID="current-theme">{theme}:{colorScheme}</Text>
}

function mount() {
  return render(<ThemeProvider><ThemeSelector /><CurrentTheme /></ThemeProvider>)
}

const select = (name: string) => fireEvent.press(screen.getByRole("button", { name: `Set theme to ${name}` }))
const flush = () => act(async () => {})
const getItem = jest.mocked(AsyncStorage.getItem)
const setItem = jest.mocked(AsyncStorage.setItem)

describe("Theme persistence and native appearance", () => {
  let appearance: jest.SpyInstance

  beforeEach(() => {
    getItem.mockReset().mockResolvedValue(null)
    setItem.mockReset().mockResolvedValue()
    appearance = jest.spyOn(Appearance, "setColorScheme").mockImplementation(() => {})
  })

  afterEach(() => appearance.mockRestore())

  it("restores the saved theme for app content and native controls", async () => {
    getItem.mockResolvedValue("dark")
    mount()
    await flush()
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark:dark")
    expect(appearance).toHaveBeenLastCalledWith("dark")
    expect(setItem).not.toHaveBeenCalled()
  })

  it("ignores malformed stored preferences", async () => {
    getItem.mockResolvedValue("not-a-theme")
    mount()
    await flush()
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark:dark")
    expect(appearance).toHaveBeenLastCalledWith("dark")
  })

  it("does not let a delayed startup read replace a newer choice", async () => {
    const read = deferred<string | null>()
    getItem.mockReturnValue(read.promise)
    mount()
    select("Dark")
    await act(async () => { read.resolve("light") })
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark:dark")
    expect(setItem).toHaveBeenLastCalledWith(ASYNC_STORAGE_KEYS.THEME_PREFERENCE, "dark")
  })

  it("shows the newest choice immediately and serializes writes in tap order", async () => {
    const firstWrite = deferred<void>()
    setItem.mockReturnValueOnce(firstWrite.promise)
    mount()
    await flush()
    select("Dark")
    await flush()
    select("Light")
    await flush()
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light:light")
    expect(setItem).toHaveBeenCalledTimes(1)
    await act(async () => { firstWrite.resolve() })
    expect(setItem.mock.calls.map((call) => call[1])).toEqual(["dark", "light"])
    expect(appearance).toHaveBeenLastCalledWith("light")
  })

  it("reports a failed save and allows the same choice to be retried", async () => {
    setItem.mockRejectedValueOnce(new Error("storage unavailable"))
    mount()
    await flush()
    select("Dark")
    await flush()
    expect(screen.getByRole("alert")).toHaveTextContent(/Tap your choice again to save it/)
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark:dark")
    select("Dark")
    await flush()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(setItem).toHaveBeenCalledTimes(2)
  })

  it("continues after an older failed save without showing a stale error", async () => {
    const firstWrite = deferred<void>()
    setItem.mockReturnValueOnce(firstWrite.promise)
    mount()
    await flush()
    select("Dark")
    await flush()
    select("System")
    await act(async () => { firstWrite.reject(new Error("write failed")) })
    expect(setItem).toHaveBeenLastCalledWith(ASYNC_STORAGE_KEYS.THEME_PREFERENCE, "system")
    expect(screen.queryByRole("alert")).toBeNull()
    expect(appearance).toHaveBeenLastCalledWith("unspecified")
  })

  it("does not change native appearance when a startup read resolves after unmount", async () => {
    const read = deferred<string | null>()
    getItem.mockReturnValue(read.promise)
    const view = mount()
    await view.unmountAsync()
    appearance.mockClear()
    await act(async () => { read.resolve("dark") })
    expect(appearance).not.toHaveBeenCalled()
  })
})
