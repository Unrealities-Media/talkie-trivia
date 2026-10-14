import AsyncStorage from "@react-native-async-storage/async-storage"
import { mergeStorage, MergeReceipt } from "../../src/services/mergeStorage"
const receipt: MergeReceipt = { sourceUid: "guest", targetUid: "saved", operationId: "confirmation-00001", status: "submitting" }
beforeEach(async () => { jest.clearAllMocks(); await AsyncStorage.clear() })
it("persists continuity metadata and strips credentials and provider details", async () => {
  await mergeStorage.write({ ...receipt, targetIdToken: "secret", email: "private@example.test" } as MergeReceipt)
  expect(await mergeStorage.read()).toEqual(receipt)
  expect(await AsyncStorage.getItem("account-merge-v1")).not.toContain("secret")
})
it.each(["null", "{}", "[]", JSON.stringify({ ...receipt, sourceUid: "bad/path" }), JSON.stringify({ ...receipt, operationId: "" })])("fails closed on corrupt persisted intent %s", async value => {
  await AsyncStorage.setItem("account-merge-v1", value)
  await expect(mergeStorage.read()).rejects.toThrow()
  expect(await AsyncStorage.getItem("account-merge-v1")).toBe(value)
})
it("does not let stale cleanup erase a newer confirmation", async () => {
  await mergeStorage.write(receipt)
  await expect(mergeStorage.clear("another-confirmation")).rejects.toThrow("changed")
  expect(await mergeStorage.read()).toEqual(receipt)
  await mergeStorage.clear(receipt.operationId)
  expect(await mergeStorage.read()).toBeNull()
})
