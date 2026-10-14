import { Firestore } from "firebase-admin/firestore"

// Only the local demo runtime can use a test clock. Auth, deletion and merge
// security deadlines deliberately continue to use the real clock.
export function usesDemoClock(env: NodeJS.ProcessEnv): boolean {
  return env.FUNCTIONS_EMULATOR === "true" &&
    env.GCLOUD_PROJECT === "demo-talkie-trivia" &&
    /^(127\.0\.0\.1|localhost):8080$/.test(env.FIRESTORE_EMULATOR_HOST || "")
}

export async function gameNow(db: Firestore): Promise<Date> {
  if (!usesDemoClock(process.env)) return new Date()
  const clock = await db.doc("_development/clock").get()
  const offset = clock.data()?.offsetMs ?? 0
  if (!Number.isSafeInteger(offset) || Math.abs(offset) > 3660 * 86400000) {
    throw new Error("Invalid local demo clock; run npm run dev:day -- reset")
  }
  return new Date(Date.now() + offset)
}
