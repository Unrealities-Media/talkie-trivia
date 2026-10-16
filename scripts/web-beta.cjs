const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { spawnSync } = require("node:child_process")
const { readEnvironment } = require("../config/appEnvironment.cjs")
const root = path.resolve(__dirname, "..")
const output = path.join(root, "web-build")
const receipt = path.join(root, ".expo/web-beta-build.json")

function betaConfig(env) {
  const config = readEnvironment({ ...env, APP_VARIANT: "preview", WEB_BETA: "true" })
  const site = new URL(config.publicSiteUrl || "invalid")
  if (site.protocol !== "https:" || site.username || site.password || site.pathname !== "/" || site.search || site.hash || site.hostname === "localhost") {
    throw new Error("PUBLIC_SITE_URL_PREVIEW must be the HTTPS origin of the beta site.")
  }
  const email = env.BETA_SUPPORT_EMAIL?.trim()
  const operator = env.BETA_OPERATOR?.trim()
  if (!email || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) throw new Error("Set BETA_SUPPORT_EMAIL.")
  if (!operator) throw new Error("Set BETA_OPERATOR to the public operator name.")
  return { ...config, site: site.origin, email, operator }
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

function publicPages(config) {
  const email = escape(config.email), operator = escape(config.operator)
  const contact = `<a href="mailto:${email}">${email}</a>`
  const sections = {
    privacy: ["Beta privacy notice", `<p>Talkie Trivia's beta is operated by ${operator}. Contact: ${contact}.</p>
<h2>Information used to run the game</h2><p>Firebase creates an account identifier even for guest play. We store your guesses, hints, game results, statistics and preferences to save progress. Linking Google adds a Google-authenticated account; Firebase Authentication processes your Google account information. Google login is optional.</p>
<p>Your browser stores your session, preferences, pending game actions and account recovery or deletion receipts. Clearing browser storage can permanently remove access to an unlinked guest. We do not combine guest progress with an existing Google account in this beta.</p>
<h2>Service providers</h2><p>Google Firebase provides hosting, authentication, database and backend processing. These services process technical request information, such as IP addresses, for delivery and security. Movie images may load from TMDB's image service, which receives the network information needed to serve them. External movie links open third-party sites with their own policies.</p>
<p>Optional app analytics, performance telemetry, Sentry crash collection and session replay are disabled. The beta has no paid features or advertising.</p>
<h2>Retention and deletion</h2><p>Account and game data remain until deletion is requested. <a href="/profile/settings">Account settings</a> provides account deletion for guests and Google accounts. Completed deletion removes your authentication account and player data. A minimal completion record is eligible for removal after 24 hours; the deletion-status receipt is eligible after 30 days. Pending requests remain until resolved. Scheduled cleanup and service outages can delay removal. Shared movie content is retained.</p>
<p>Operational logs, provider retention and any backups require separate handling; an account deletion does not promise instant removal from those systems. Contact us for details or a privacy request. Never send passwords, authentication tokens or deletion receipt secrets.</p>
<p>See <a href="/delete-account">account deletion</a> for instructions and support when you cannot sign in.</p>`],
    support: ["Beta support", `<p>Report problems or send feedback to ${contact}. The beta is operated by ${operator}.</p><p>Include your browser, device, the affected day, difficulty and what happened. Please remove account details from screenshots. Never send passwords, tokens or deletion receipt secrets.</p><p>Five new movie challenges appear each day at midnight UTC, one per difficulty. Play one or all five; each saves its own progress. Internet access is required to save play. Google linking is optional; unlinked guests cannot reliably recover progress after browser storage is cleared.</p>`],
    "delete-account": ["Delete your Talkie Trivia account", `<p>In the same browser where you play, <a href="/profile/settings">open Account settings</a>, find Account deletion, and confirm. You can also reach these controls from Profile &rarr; Settings. Linked Google accounts must verify their identity. Guests can delete without Google.</p><p>Deletion removes the account, games and statistics. Keep the browser's saved deletion receipt until the app confirms completion. Starting a new guest is optional.</p><h2>Cannot access the account?</h2><p>Email ${contact} with the subject "Talkie Trivia account deletion". Tell us whether you used Google or played as a guest. We will arrange verification before acting on an account; an email address alone does not authorize deletion. A guest whose browser session is lost may not be identifiable or recoverable.</p><p>Do not send a password, authentication token or deletion receipt secret. See the <a href="/privacy">privacy notice</a> for retained completion records and receipts.</p>`],
  }
  return Object.fromEntries(Object.entries(sections).map(([route, [title, body]]) => [route, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title} — Talkie Trivia</title><style>body{max-width:48rem;margin:3rem auto;padding:0 1.25rem;font:18px/1.6 system-ui;color:#18232b;background:#fff}a{color:#174f8a}nav{display:flex;gap:1rem;flex-wrap:wrap}h1,h2{line-height:1.2}</style></head><body><nav><a href="/">Play</a><a href="/privacy">Privacy</a><a href="/support">Support</a><a href="/delete-account">Delete account</a></nav><main><h1>${title}</h1>${body}</main></body></html>`]))
}
function digestTree(directory) {
  const hash = crypto.createHash("sha256")
  function visit(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = `${prefix}${entry.name}`
      if (entry.isSymbolicLink()) throw new Error("Build output must not contain symlinks.")
      if (entry.isDirectory()) visit(path.join(dir, entry.name), `${relative}/`)
      else hash.update(relative).update("\0").update(fs.readFileSync(path.join(dir, entry.name))).update("\0")
    }
  }
  visit(directory)
  return hash.digest("hex")
}
// Include uncommitted/new files, not just HEAD: local beta builds commonly
// include work awaiting review. Documentation and generated output are excluded.
const sourceInputs = ["src", "assets", "config", "plugins", "vendor", "data", "public", "patches",
  "index.tsx", "app.config.js", "babel.config.js", "metro.config.js", "tsconfig.json",
  "package.json", "package-lock.json", ".nvmrc", ".env.beta", "scripts/web-beta.cjs"]
function sourceDigest(directory = root) {
  const hash = crypto.createHash("sha256")
  for (const relative of sourceInputs) {
    const file = path.join(directory, relative)
    hash.update(relative).update("\0")
    if (!fs.existsSync(file)) { hash.update("absent\0"); continue }
    const stat = fs.lstatSync(file)
    if (stat.isSymbolicLink()) throw new Error("Beta build inputs must not contain symlinks.")
    hash.update(stat.isDirectory() ? digestTree(file) : fs.readFileSync(file)).update("\0")
  }
  return hash.digest("hex")
}
function verifyBuild(project, directory = output, manifestPath = receipt, sourceDirectory = root) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  if (!project || project.startsWith("demo-") || manifest.project !== project || manifest.variant !== "preview" || manifest.emulator !== false) throw new Error("Deployment project does not match a live beta build. Rebuild for the intended staging project.")
  if (digestTree(directory) !== manifest.sha256) throw new Error("Build output changed. Run npm run beta:build again.")
  if (manifest.sourceSha256 !== sourceDigest(sourceDirectory)) throw new Error("Build source changed or receipt predates source verification. Run npm run beta:build again.")
  return manifest
}
function run(file, args, env = process.env) {
  const child = spawnSync(process.execPath, [file, ...args], { cwd: root, env, stdio: "inherit" })
  if (child.error) throw child.error
  if (child.status !== 0) throw new Error(`Command failed (${child.status}): ${path.basename(file)}`)
}
function main() {
  require("dotenv").config({ path: path.join(root, ".env.beta"), quiet: true })
  const command = process.argv[2]
  if (command === "build") {
    const config = betaConfig(process.env)
    fs.mkdirSync(path.dirname(receipt), { recursive: true })
    fs.rmSync(receipt, { force: true })
    const sourceSha256 = sourceDigest()
    run(require.resolve("expo/bin/cli"), ["export", "--platform", "web", "--output-dir", "web-build", "--clear"], {
      ...process.env, APP_VARIANT: "preview", WEB_BETA: "true", EXPO_NO_DOTENV: "1",
    })
    for (const [route, html] of Object.entries(publicPages(config))) fs.writeFileSync(path.join(output, `${route}.html`), html)
    fs.writeFileSync(path.join(output, "robots.txt"), "User-agent: *\nDisallow: /\n")
    if (sourceDigest() !== sourceSha256) throw new Error("Build source changed during export. Run npm run beta:build again.")
    fs.writeFileSync(receipt, JSON.stringify({ project: config.firebase.projectId, site: config.site, variant: config.variant, emulator: config.emulator, sha256: digestTree(output), sourceSha256 }, null, 2))
    console.log(`Beta built for ${config.firebase.projectId}: ${config.site}. No deployment performed.`)
  } else if (command === "verify") {
    verifyBuild(process.env.GCLOUD_PROJECT)
    console.log("Verified live beta artifact and deployment project.")
  } else if (command === "deploy") {
    const project = process.argv[3]
    verifyBuild(project)
    run(path.join(root, "integration/node_modules/firebase-tools/lib/bin/firebase.js"), ["deploy", "--project", project, "--only", "hosting"])
  } else throw new Error("Use build, verify, or deploy <staging-project-id>.")
}
if (require.main === module) { try { main() } catch (error) { console.error(error.message); process.exitCode = 1 } }
module.exports = { betaConfig, publicPages, digestTree, sourceDigest, verifyBuild }
