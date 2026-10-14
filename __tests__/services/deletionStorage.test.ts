import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { deletionStorage } from "../../src/services/deletionStorage"
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }))
jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }))
const receipt = { uid: "owner", secret: "a".repeat(64), status: "pending" as const }
const originalOS = Platform.OS
afterEach(() => { Platform.OS = originalOS })
beforeEach(() => { jest.resetAllMocks() })
it("keeps the receipt in native SecureStore and removes it only explicitly", async () => {
  Platform.OS = "ios"
  ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValue(JSON.stringify(receipt))
  await expect(deletionStorage.read()).resolves.toEqual(receipt)
  await deletionStorage.write(receipt)
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith("account-deletion-v1", JSON.stringify(receipt))
  expect(AsyncStorage.setItem).not.toHaveBeenCalled()
  await deletionStorage.clear()
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("account-deletion-v1")
})
it("persists status recovery on web without requiring a native keychain", async () => {
  Platform.OS = "web"
  ;(AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(receipt))
  await expect(deletionStorage.read()).resolves.toEqual(receipt)
  await deletionStorage.write(receipt)
  expect(AsyncStorage.setItem).toHaveBeenCalledWith("account-deletion-v1", JSON.stringify(receipt))
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled()
})
it("rejects corrupt receipts instead of pretending no deletion exists", async () => {
  Platform.OS = "android"
  for (const value of ["{broken", JSON.stringify({ ...receipt, secret: "short" }), JSON.stringify({ ...receipt, status: "anything" })]) {
    ;(SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(value)
    await expect(deletionStorage.read()).rejects.toThrow()
  }
})
