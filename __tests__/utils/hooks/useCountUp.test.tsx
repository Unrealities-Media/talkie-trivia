import { act, renderHook } from "@testing-library/react-native"
import { useCountUp } from "../../../src/utils/hooks/useCountUp"
import { usePremiereMotion } from "../../../src/utils/hooks/usePremiereMotion"

jest.mock("../../../src/utils/hooks/usePremiereMotion", () => ({ usePremiereMotion: jest.fn(() => false) }))

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("counts up from zero after the delay and settles on the exact target", () => {
  const { result } = renderHook(() => useCountUp(700, { delay: 100, duration: 1000 }))
  expect(result.current).toBe(0)
  act(() => { jest.advanceTimersByTime(600) })
  expect(result.current).toBeGreaterThan(0)
  expect(result.current).toBeLessThan(700)
  act(() => { jest.advanceTimersByTime(1000) })
  expect(result.current).toBe(700)
})

it("shows the target immediately when motion is reduced", () => {
  jest.mocked(usePremiereMotion).mockReturnValue(true)
  const { result } = renderHook(() => useCountUp(1650))
  expect(result.current).toBe(1650)
  jest.mocked(usePremiereMotion).mockReturnValue(false)
})
