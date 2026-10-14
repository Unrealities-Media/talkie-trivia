import AsyncStorage from "@react-native-async-storage/async-storage"
import { sessionStorage } from "../../src/services/sessionStorage"

beforeEach(async () => {
  jest.clearAllMocks()
  await AsyncStorage.clear()
})

it("persists only account identity and never grants access to server data", async () => {
  await expect(sessionStorage.read()).resolves.toBeNull()
  await sessionStorage.write({ uid: "guest", isAnonymous: true })
  await expect(sessionStorage.read()).resolves.toEqual({ uid: "guest", isAnonymous: true })
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith("account-session-v1", JSON.stringify({ uid: "guest", isAnonymous: true }))
})

it.each(["", "null", "{}", '{"uid":"guest","isAnonymous":"true"}'])
("rejects unreadable existing markers (%s) instead of treating them as a fresh install", async raw => {
  // The upstream AsyncStorage mock collapses an empty string to null. Return
  // the actual stored value here so this covers corrupt native storage too.
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(raw)
  await expect(sessionStorage.read()).rejects.toThrow()
})

it("cleans up only the deleted account and preserves an unrelated new session", async () => {
  await sessionStorage.write({ uid: "old", isAnonymous: true })
  await Promise.all([
    sessionStorage.write({ uid: "new", isAnonymous: false }),
    sessionStorage.clearFor("old"),
  ])
  await expect(sessionStorage.read()).resolves.toEqual({ uid: "new", isAnonymous: false })
  await sessionStorage.clearFor("new")
  await expect(sessionStorage.read()).resolves.toBeNull()
})

it("propagates storage failures and permits a later successful retry", async () => {
  ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("disk full"))
  await expect(sessionStorage.write({ uid: "guest", isAnonymous: true })).rejects.toThrow("disk full")
  await sessionStorage.write({ uid: "guest", isAnonymous: true })
  await expect(sessionStorage.read()).resolves.toMatchObject({ uid: "guest" })
})
