const { readFileSync, appendFileSync } = require('node:fs')
const { execFileSync } = require('node:child_process')

const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const full = reason => ({ run: true, reason })

// An allowlist of presentation-only inputs, not a list of backend inputs that
// could silently become incomplete. Every new/unknown path runs the contracts.
function presentationOnly(file) {
  return /^(src\/(app|components|styles)\/|__tests__\/(app|components|styles)\/|integration\/browser\/|assets\/fonts\/)/.test(file)
    || /^docs\/.*\.md$/.test(file)
    || file === 'README.md'
}

function contractScope(eventName, event, runGit = git) {
  if (!['pull_request', 'push'].includes(eventName)) return full('Manual, merge-queue or unrecognized event: run all contracts.')
  const base = eventName === 'push' ? event?.before : event?.pull_request?.base?.sha
  if (typeof base !== 'string' || !/^[a-f0-9]{40}$/.test(base) || /^0+$/.test(base)) {
    return full('Missing or invalid comparison base: run all contracts.')
  }
  try {
    // PR HEAD is the synthetic merge, so merge-resolution changes are included.
    runGit(['merge-base', '--is-ancestor', base, 'HEAD'])
    // Disable rename detection so a backend file moved into a presentation
    // directory still contributes its old backend path to the decision.
    const output = runGit(['diff', '--no-renames', '--name-only', '-z', base, 'HEAD', '--'])
    const files = output.split('\0').filter(Boolean)
    if (!files.length || files.some(file => !presentationOnly(file))) {
      return full('Backend, shared, verification or unknown inputs may have changed: run all contracts.')
    }
    return { run: false, reason: 'Only presentation, browser-test or documentation files changed. Standalone Firebase contracts are not applicable; browser gameplay still runs against emulators.' }
  } catch {
    return full('Comparison history is unavailable or unexpected: run all contracts.')
  }
}

function main() {
  let event = {}
  try { event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) } catch { /* Full verification on missing metadata. */ }
  const result = contractScope(process.env.GITHUB_EVENT_NAME, event)
  console.log(result.reason)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${result.run}\n`)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Firebase contract scope\n\n${result.reason}\n`)
}

if (require.main === module) main()
module.exports = { contractScope }
