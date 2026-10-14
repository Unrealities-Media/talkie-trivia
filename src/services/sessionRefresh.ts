/** Retry a read once with fresh credentials, without treating an outage as logout. */
export async function withSessionRefresh<T>(
  user: { getIdToken: (forceRefresh: boolean) => Promise<string> },
  isCurrent: () => boolean,
  read: () => Promise<T>,
): Promise<T> {
  const check = () => { if (!isCurrent()) throw new Error("Your signed-in account changed.") }
  check()
  try {
    return await read()
  } catch (failure) {
    if ((failure as { code?: string } | null)?.code !== "functions/unauthenticated") throw failure
    check()
    // Firebase signs out an invalidated session on a definitive refresh-token
    // rejection. Its ordinary auth listener then opens continuity recovery.
    // Network errors preserve the session; never sign out on a callable error.
    await user.getIdToken(true)
    check()
    return read() // Deliberately outside the catch: no recursive retry loop.
  }
}
