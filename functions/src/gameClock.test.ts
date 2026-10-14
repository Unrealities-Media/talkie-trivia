import { gameNow, usesDemoClock } from "./gameClock"

const demo = { FUNCTIONS_EMULATOR: "true", GCLOUD_PROJECT: "demo-talkie-trivia", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }
const original = process.env
afterEach(() => { process.env = original; jest.useRealTimers() })
test.each([
  {}, { ...demo, FUNCTIONS_EMULATOR: "false" },
  { ...demo, GCLOUD_PROJECT: "production" },
  { ...demo, GCLOUD_PROJECT: "demo-talkie-trivia-test" },
  { ...demo, FIRESTORE_EMULATOR_HOST: "remote:8080" },
])("does not read a development clock outside the exact local runtime: %j", async env => {
  process.env = env
  expect(usesDemoClock(env)).toBe(false)
  await expect(gameNow({ doc: () => { throw Error("Must not read") } } as any)).resolves.toBeInstanceOf(Date)
})
test("offset advances with real time and missing clock uses real time", async () => {
  process.env = demo
  jest.useFakeTimers().setSystemTime(new Date("2026-10-13T23:59:50Z"))
  const db = (offsetMs?: number) => ({ doc: () => ({ get: async () => ({ data: () => ({ offsetMs }) }) }) }) as any
  expect((await gameNow(db())).toISOString()).toBe("2026-10-13T23:59:50.000Z")
  expect((await gameNow(db(86400000))).toISOString()).toBe("2026-10-14T23:59:50.000Z")
  jest.advanceTimersByTime(20000)
  expect((await gameNow(db(86400000))).toISOString()).toBe("2026-10-15T00:00:10.000Z")
  await expect(gameNow(db(NaN))).rejects.toThrow("Invalid local demo clock")
})
