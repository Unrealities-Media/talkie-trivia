import AsyncStorage from "@react-native-async-storage/async-storage"

export type MergeProgress = "submitting" | "pending" | "review" | "complete" | "cancelled"
export interface MergeReceipt {
  sourceUid: string
  targetUid: string
  operationId: string
  previousOperationId?: string
  status: MergeProgress
  imported?: number
  conflicts?: number
}
const key = "account-merge-v1"
const uid = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 128 && !value.includes("/")
const operation = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9_-]{16,80}$/.test(value)
let writes: Promise<unknown> = Promise.resolve()
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const next = writes.then(action, action)
  writes = next.catch(() => undefined)
  return next
}
function validate(value: MergeReceipt): MergeReceipt {
  if (!value || !uid(value.sourceUid) || !uid(value.targetUid) || value.sourceUid === value.targetUid ||
    !operation(value.operationId) || (value.previousOperationId !== undefined && !operation(value.previousOperationId)) ||
    !["submitting", "pending", "review", "complete", "cancelled"].includes(value.status) ||
    [value.imported, value.conflicts].some(count => count !== undefined && (!Number.isSafeInteger(count) || count < 0))) {
    throw new Error("The saved account operation could not be read.")
  }
  // Explicit allowlist: never serialize credentials, email, or a Firebase User.
  return { sourceUid: value.sourceUid, targetUid: value.targetUid, operationId: value.operationId, status: value.status,
    ...(value.previousOperationId ? { previousOperationId: value.previousOperationId } : {}),
    ...(value.imported !== undefined ? { imported: value.imported } : {}),
    ...(value.conflicts !== undefined ? { conflicts: value.conflicts } : {}) }
}
async function read(): Promise<MergeReceipt | null> {
  const raw = await AsyncStorage.getItem(key)
  return raw === null ? null : validate(JSON.parse(raw))
}
export const mergeStorage = {
  read: () => serialize(read),
  write: (receipt: MergeReceipt) => serialize(() => AsyncStorage.setItem(key, JSON.stringify(validate(receipt)))),
  clear: (operationId: string) => serialize(async () => {
    const receipt = await read()
    if (receipt && receipt.operationId !== operationId) throw new Error("The account operation changed.")
    await AsyncStorage.removeItem(key)
  }),
}
