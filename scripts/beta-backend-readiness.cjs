// These handlers reject anonymous HTTP requests before reading or writing data.
// A callable UNAUTHENTICATED response proves routing and browser access, not
// backend-version compatibility or successful authenticated gameplay.
const endpoints = ["startGame", "applyGameAction", "getPlayerStatistics"]

async function verifyBackend(project, site, request = fetch) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) || project.startsWith("demo-")) {
    throw new Error("Backend readiness requires a live Firebase project ID.")
  }
  const origin = new URL(site)
  if (origin.protocol !== "https:" || origin.origin !== site) throw new Error("Backend readiness requires the beta HTTPS origin.")
  for (const name of endpoints) {
    const url = `https://us-central1-${project}.cloudfunctions.net/${name}`
    try {
      const preflight = await request(url, {
        method: "OPTIONS", redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { Origin: site, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
      })
      const allowsOrigin = response => [site, "*"].includes(response.headers.get("access-control-allow-origin"))
      const allows = (response, header, value) => (response.headers.get(header) || "").toLowerCase().split(",").map(item => item.trim()).includes(value)
      if (!preflight.ok || !allowsOrigin(preflight)
        || !allows(preflight, "access-control-allow-methods", "post")
        || !allows(preflight, "access-control-allow-headers", "content-type")) throw new Error("browser preflight failed")
      const response = await request(url, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(30000),
        headers: { Origin: site, "Content-Type": "application/json" }, body: JSON.stringify({ data: {} }),
      })
      const body = await response.json()
      if (response.status !== 401 || !allowsOrigin(response) || body?.error?.status !== "UNAUTHENTICATED") {
        throw new Error("expected a reachable callable requiring Firebase authentication")
      }
    } catch (error) {
      throw new Error(`Backend readiness failed for ${name}: ${error.message}. Deploy or repair the beta backend before publishing Hosting.`)
    }
  }
  return endpoints
}

module.exports = { verifyBackend }
