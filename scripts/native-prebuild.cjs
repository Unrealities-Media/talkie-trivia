const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { execFileSync } = require("node:child_process")
const { readEnvironment } = require("../config/appEnvironment.cjs")

const root = path.resolve(__dirname, "..")
const args = process.argv.slice(2)
if (args.length > 1 || (args.length && !["android", "ios", "all"].includes(args[0]))) {
  throw new Error("Usage: npm run native:generate -- [android|ios|all]")
}
const platform = args[0] || (process.platform === "darwin" ? "all" : "android")
if (platform !== "android" && process.platform !== "darwin") throw new Error("Generate and verify iOS on macOS; use 'android' on this host.")
require("dotenv").config({ quiet: true })
readEnvironment() // Validate before downloading or changing native projects.
// Refuse to erase maintained/tracked native sources. After the CNG migration is
// committed, only generated directories may be regenerated with --clean.
const nativePaths = platform === "all" ? ["android", "ios"] : [platform]
for (const name of nativePaths) {
  const target = path.resolve(root, name)
  if (path.dirname(target) !== root) throw new Error("Unsafe native generation target.")
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Refusing to regenerate linked ${name} directory.`)
    const tracked = execFileSync("git", ["ls-files", "--", name], { cwd: root, encoding: "utf8" })
    if (tracked.trim()) throw new Error(`The ${name} directory contains tracked native sources. Complete the documented CNG migration before regenerating it.`)
  }
}
const template = "expo-template-bare-minimum-57.0.30.tgz"
const integrity = "FpIZTYYk3zGAGRbzGZ+KxoR6luQRILHd7iAwfvphubo6/7a2hPLyob1f9KeT/Z3GSz+IIf+Ex5Px+yOznuJhWQ=="
const cache = path.join(root, ".expo", "native-template")
fs.mkdirSync(cache, { recursive: true })
const archive = path.join(cache, template)
if (!fs.existsSync(archive)) {
  if (!process.env.npm_execpath) throw new Error("Run native generation through npm run native:generate.")
  execFileSync(process.execPath, [process.env.npm_execpath, "pack", "expo-template-bare-minimum@57.0.30", "--ignore-scripts", "--silent", "--pack-destination", cache], { cwd: root, stdio: "inherit" })
}
if (crypto.createHash("sha512").update(fs.readFileSync(archive)).digest("base64") !== integrity) {
  throw new Error("Native template integrity mismatch. Review the downloaded archive before proceeding.")
}
const cli = require.resolve("expo/bin/cli")
execFileSync(process.execPath, [cli, "prebuild", "--clean", "--no-install", "--platform", platform, "--template", archive], {
  cwd: root, stdio: "inherit", env: { ...process.env, EXPO_NO_TELEMETRY: "1" },
})
