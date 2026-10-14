import AsyncStorage from "@react-native-async-storage/async-storage"

// A continuity marker, never a credential or authority to read another account.
export interface SavedSession { uid: string; isAnonymous: boolean }
const key = "account-session-v1"
let writes: Promise<unknown> = Promise.resolve()

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const next = writes.then(operation, operation)
  writes = next.catch(() => undefined)
  return next
}

async function read(): Promise<SavedSession | null> {
  const raw = await AsyncStorage.getItem(key)
  if (raw === null) return null
  const value = JSON.parse(raw)
  if (!value || typeof value.uid !== "string" || !value.uid || typeof value.isAnonymous !== "boolean") {
    throw new Error("The saved account session could not be read.")
  }
  return { uid: value.uid, isAnonymous: value.isAnonymous }
}

export const sessionStorage = {
  read: () => serialize(read),
  write: (session: SavedSession) => serialize(() => AsyncStorage.setItem(key, JSON.stringify(session))),
  clearFor: (uid: string) => serialize(async () => {
    if ((await read())?.uid === uid) await AsyncStorage.removeItem(key)
  }),
}
