import assert from "node:assert/strict"

export const projectId = "demo-talkie-trivia-test"
// Checked before any SDK initialization or reset. Never accept arbitrary hosts or projects.
assert.equal(process.env.TALKIE_EMULATOR_TEST, "1", "Use npm --prefix integration test")
assert.equal(process.env.GCLOUD_PROJECT, projectId)
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, "127.0.0.1:8180")
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9199")
export const firestore = { host: "127.0.0.1", port: 8180 }
export const functionBase = `http://127.0.0.1:5101/${projectId}/us-central1`
