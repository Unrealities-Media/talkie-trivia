import "./tests/environment.mjs"
import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const directory = dirname(fileURLToPath(import.meta.url))
const root = resolve(directory, "..")
const tests = readdirSync(resolve(directory, "tests")).filter(name => name.endsWith(".test.mjs")).sort().map(name => resolve(directory, "tests", name))
const node = spawnSync(process.execPath, ["--test", "--test-concurrency=1", "--test-timeout=120000", ...tests], { cwd: root, stdio: "inherit", windowsHide: true })
if (node.error) throw node.error
if (node.status !== 0) process.exit(node.status ?? 1)
const go = spawnSync("go", ["test", "-tags=emulator", "-run", "^TestEmulator", "-count=1", "-timeout=120s", "./..."], { cwd: resolve(root, "utils/pipeline"), stdio: "inherit", windowsHide: true })
if (go.error) throw go.error
process.exitCode = go.status ?? 1
