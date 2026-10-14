import type { Analytics } from "firebase/analytics"

// Optional telemetry is off for launch preparation. Nothing initializes the
// Analytics or Performance SDK at import time. Re-enabling collection requires
// an explicit user choice, matching disclosures, and tested withdrawal/deletion.
const analytics: Analytics | undefined = undefined
const perf: undefined = undefined

export { analytics, perf }
