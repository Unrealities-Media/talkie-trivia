import { act, renderHook } from "@testing-library/react-native"
import { Platform } from "react-native"
import { usePremiereMotion } from "../../../src/utils/hooks/usePremiereMotion"

jest.mock("react-native-reanimated", () => ({ useReducedMotion: () => false }))

it("reads the current web preference on mount, follows changes, and removes listeners", () => {
  const originalOS = Platform.OS
  const originalMatchMedia = window.matchMedia
  const listeners = new Set<() => void>()
  const media = {
    matches: true,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" })
  window.matchMedia = jest.fn(() => media) as unknown as typeof window.matchMedia
  try {
    // Reanimated's startup snapshot is false; a later mount must read true.
    const first = renderHook(usePremiereMotion)
    expect(first.result.current).toBe(true)
    act(() => { media.matches = false; listeners.forEach(listener => listener()) })
    expect(first.result.current).toBe(false)
    act(() => { media.matches = true; listeners.forEach(listener => listener()) })
    expect(first.result.current).toBe(true)
    const later = renderHook(usePremiereMotion)
    expect(later.result.current).toBe(true)
    first.unmount()
    later.unmount()
    expect(listeners.size).toBe(0)
  } finally {
    Object.defineProperty(Platform, "OS", { configurable: true, value: originalOS })
    window.matchMedia = originalMatchMedia
  }
})
