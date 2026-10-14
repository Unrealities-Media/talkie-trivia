// Regression tests replacing the original vulnerable-behavior probes.
// Run from the repository root; no network or production database writes.
const { spawnSync } = require("node:child_process")
const tasks = [
  ["--prefix", "functions", "test", "--", "--ci", "--runInBand", "--coverage=false"],
  ["test", "--", "--ci", "--runInBand", "--coverage=false", "--runTestsByPath", "__tests__/services/gameService.test.ts", "__tests__/state/slices/gameSlice.test.ts", "__tests__/state/slices/settingsSlice.test.ts", "__tests__/utils/guessFeedbackUtils.test.tsx"],
]
for (const args of tasks) {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", args, { stdio: "inherit", shell: process.platform === "win32" })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
