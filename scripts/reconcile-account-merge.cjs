#!/usr/bin/env node
// Administrative CLI only; never loaded by the app or deployed function index.
const { readFile, writeFile } = require("node:fs/promises")
const { createRequire } = require("node:module")
const { resolve } = require("node:path")
class InputError extends Error {}
function argumentsFor(argv, env) {
  const [command, ...tokens] = argv
  if (!["inspect", "apply"].includes(command)) throw new InputError("Use inspect or apply; inspect is required before any mutation.")
  const args = {}
  for (let index = 0; index < tokens.length; index++) {
    const key = tokens[index]
    if (!/^--[a-z-]+$/.test(key) || Object.hasOwn(args, key)) throw new InputError("Invalid or repeated argument.")
    if (["--emulator", "--live"].includes(key)) args[key] = true
    else {
      const value = tokens[++index]
      if (!value || value.startsWith("--")) throw new InputError("Each option needs its explicit value.")
      args[key] = value
    }
  }
  const allowed = new Set(["--project", "--emulator", "--live", ...(command === "inspect" ?
    ["--source", "--operation", "--action", "--out"] : ["--plan", "--confirm-project", "--confirm-digest", "--reference"])])
  if (Object.keys(args).some(key => !allowed.has(key))) throw new InputError("Unknown option for this command.")
  const project = args["--project"]
  if (typeof project !== "string" || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project) || Boolean(args["--emulator"]) === Boolean(args["--live"])) {
    throw new InputError("Specify an exact project and exactly one of --emulator or --live.")
  }
  for (const name of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
    if (env[name] && env[name] !== project) throw new InputError("Environment project does not match --project.")
  }
  if (args["--emulator"]) {
    if (project !== "demo-talkie-trivia-test" || env.TALKIE_EMULATOR_TEST !== "1" ||
      env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8180" || env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9199") {
      throw new InputError("Emulator mode requires the isolated demo project and explicit test loopback hosts.")
    }
  } else if (project.startsWith("demo-") || Object.keys(env).some(key => key.endsWith("EMULATOR_HOST") && env[key]) || env.FUNCTIONS_EMULATOR === "true") {
    throw new InputError("Live mode rejects demo projects and emulator configuration.")
  }
  const required = command === "inspect" ? ["--source", "--operation", "--action", "--out"] : ["--plan", "--confirm-project", "--confirm-digest", "--reference"]
  if (required.some(key => typeof args[key] !== "string")) throw new InputError("Missing required command options.")
  if (command === "inspect" && (!args["--source"] || args["--source"].length > 128 || args["--source"].includes("/") ||
    !/^[a-zA-Z0-9_-]{16,80}$/.test(args["--operation"]) || !["retry", "cancel-before-copy"].includes(args["--action"]))) throw new InputError("Invalid source, operation or action.")
  if (command === "apply" && (args["--confirm-project"] !== project || !/^[a-f0-9]{64}$/.test(args["--confirm-digest"]) ||
    !/^[a-zA-Z0-9_-]{8,80}$/.test(args["--reference"]))) throw new InputError("Confirm the exact project/digest and a non-personal incident reference.")
  return { command, args, project }
}
async function main(argv, env = process.env) {
  const { command, args, project } = argumentsFor(argv, env)
  let plan
  if (command === "apply") {
    const bytes = await readFile(args["--plan"])
    if (bytes.length > 32768) throw new InputError("Plan is too large.")
    plan = JSON.parse(bytes.toString("utf8"))
    if (plan?.projectId !== project || plan?.digest !== args["--confirm-digest"]) throw new InputError("Plan does not match the explicit confirmation.")
  }
  // Parse/check environment before loading SDKs or acquiring any credentials.
  const functions = createRequire(resolve(__dirname, "../functions/package.json"))
  const { initializeApp, deleteApp } = functions("firebase-admin/app")
  const { getAuth } = functions("firebase-admin/auth")
  const { getFirestore } = functions("firebase-admin/firestore")
  const { accountMergeReconciliation } = functions("./lib/accountMergeReconciliation")
  const app = initializeApp({ projectId: project }, "merge-reconciliation")
  const db = getFirestore(app)
  try {
    const service = accountMergeReconciliation(db, getAuth(app), project)
    if (command === "inspect") {
      plan = await service.inspect({ projectId: project, sourceUid: args["--source"], operationId: args["--operation"], action: args["--action"] })
      await writeFile(args["--out"], JSON.stringify(plan, null, 2) + "\n", { flag: "wx", mode: 0o600 })
      console.log(JSON.stringify({ status: "inspected", digest: plan.digest, blockers: plan.blockers, expiresAt: plan.expiresAt }))
    } else {
      const result = await service.apply(plan, { projectId: project, digest: args["--confirm-digest"], reference: args["--reference"] })
      console.log(JSON.stringify(result))
    }
  } finally { await db.terminate(); await deleteApp(app) }
}
module.exports = { argumentsFor, main }
if (require.main === module) main(process.argv.slice(2)).catch(error => {
  console.error(error instanceof InputError ? error.message : "Reconciliation failed; no success is claimed. Inspect current state before retrying. Raw account/provider errors are withheld.")
  process.exitCode = 1
})
