import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import AsyncStorage from "@react-native-async-storage/async-storage"

export type DeletionStatus = "prepared" | "submitting" | "pending" | "complete" | "unknown"
export interface DeletionReceipt { uid: string; secret: string; status: DeletionStatus }
const key = "account-deletion-v1"
export const deletionStorage = {
  async read(): Promise<DeletionReceipt | null> {
    const raw = Platform.OS === "web" ? await AsyncStorage.getItem(key) : await SecureStore.getItemAsync(key)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (typeof value.uid !== "string" || !value.uid || !/^[a-f0-9]{64}$/.test(value.secret) || !["prepared", "submitting", "pending", "complete", "unknown"].includes(value.status)) throw new Error("The saved deletion receipt could not be read.")
    return value
  },
  async write(receipt: DeletionReceipt): Promise<void> {
    const value = JSON.stringify(receipt)
    if (Platform.OS === "web") await AsyncStorage.setItem(key, value)
    else await SecureStore.setItemAsync(key, value)
  },
  async clear(): Promise<void> {
    if (Platform.OS === "web") await AsyncStorage.removeItem(key)
    else await SecureStore.deleteItemAsync(key)
  },
}
