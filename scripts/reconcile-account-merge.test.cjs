const { test } = require("node:test")
const assert = require("node:assert/strict")
const { argumentsFor } = require("./reconcile-account-merge.cjs")
const env = { TALKIE_EMULATOR_TEST: "1", GCLOUD_PROJECT: "demo-talkie-trivia-test", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8180", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9199" }
const args = ["inspect", "--project", "demo-talkie-trivia-test", "--emulator", "--source", "guest", "--operation", "confirmed-operation-001", "--action", "retry", "--out", "plan.json"]
test("requires exact isolated emulator configuration", () => {
  assert.equal(argumentsFor(args, env).command, "inspect")
  for (const key of Object.keys(env)) assert.throws(() => argumentsFor(args, { ...env, [key]: "wrong" }))
})
test("rejects accidental mixed projects, live/emulator ambiguity and unknown flags", () => {
  for (const extra of [["--live"], ["--project", "another-project"], ["--force"], ["--out", "another.json"]]) assert.throws(() => argumentsFor([...args, ...extra], env))
  assert.throws(() => argumentsFor(args.filter(value => value !== "--emulator"), env))
  assert.throws(() => argumentsFor(["apply"], env))
})
test("live mode explicitly rejects emulator hosts and conflicting project environment", () => {
  const live = args.map(value => value === "demo-talkie-trivia-test" ? "talkie-staging-fixture" : value === "--emulator" ? "--live" : value)
  assert.equal(argumentsFor(live, {}).project, "talkie-staging-fixture")
  assert.throws(() => argumentsFor(live, { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8180" }))
  assert.throws(() => argumentsFor(live, { GOOGLE_CLOUD_PROJECT: "another-project" }))
  assert.throws(() => argumentsFor(live, { FUNCTIONS_EMULATOR: "true" }))
})
test("apply needs an exact project, digest and non-personal incident reference", () => {
  const apply = ["apply", "--project", env.GCLOUD_PROJECT, "--emulator", "--plan", "plan.json", "--confirm-project", env.GCLOUD_PROJECT, "--confirm-digest", "a".repeat(64), "--reference", "incident-001"]
  assert.equal(argumentsFor(apply, env).command, "apply")
  assert.throws(() => argumentsFor(apply.map(value => value === "a".repeat(64) ? "bad" : value), env))
  assert.throws(() => argumentsFor(apply.map(value => value === "incident-001" ? "name@example.test" : value), env))
  assert.throws(() => argumentsFor(apply.slice(0, -2), env))
})
