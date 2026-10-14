import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { resolve, dirname } from "node:path"

const directory = dirname(fileURLToPath(import.meta.url))
const root = resolve(directory, "..")
const [major, minor] = process.versions.node.split(".").map(Number)
if (major !== 24 || minor < 12) {
  throw new Error("Run the emulator contract suite with Node 24.12 or later in the 24.x line, matching the Functions runtime and Firebase SDK requirements.")
}
// Always build the source under test; stale lib/ output must not produce a green run.
for (const args of [
  [resolve(root, "scripts/prepare-catalog.cjs")],
  [resolve(root, "functions/node_modules/typescript/bin/tsc"), "--project", resolve(root, "functions/tsconfig.json")],
]) {
  const build = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", windowsHide: true })
  if (build.error) throw build.error
  if (build.status !== 0) process.exit(build.status ?? 1)
}
const child = spawn(process.execPath, [
  resolve(directory, "node_modules/firebase-tools/lib/bin/firebase.js"),
  "emulators:exec", "--non-interactive", "--project", "demo-talkie-trivia-test",
  "--config", "firebase.integration.json", "--only", "auth,firestore,functions",
  "node integration/run-contracts.mjs",
], {
  cwd: root, stdio: "inherit", windowsHide: true,
  env: { ...process.env, PATH: `${dirname(process.execPath)}${process.platform === "win32" ? ";" : ":"}${process.env.PATH || ""}`,
    FIREBASE_EMULATORS_PATH: resolve(root, ".expo/firebase-emulators"),
    TALKIE_EMULATOR_TEST: "1", CI: "true" },
})
child.on("error", error => { console.error(error.message); process.exitCode = 1 })
child.on("exit", code => { process.exitCode = code ?? 1 })
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
