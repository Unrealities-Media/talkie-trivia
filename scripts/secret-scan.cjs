const { readFileSync } = require('node:fs')
const { execFileSync, spawnSync } = require('node:child_process')

const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

function scanRange(eventName, event, runGit = git) {
  // Main pushes, schedules, merge queues and manual runs retain full history.
  if (eventName !== 'pull_request') return null
  const base = event?.pull_request?.base?.sha
  if (typeof base !== 'string' || !/^[a-f0-9]{40}$/.test(base)) return null
  try {
    // Checkout's synthetic merge includes both the target and all PR commits.
    // Missing history or an unexpected checkout must fall back to a full scan.
    runGit(['merge-base', '--is-ancestor', base, 'HEAD'])
    const changedPolicy = runGit(['diff', '--name-only', base, 'HEAD', '--',
      '.gitleaks*', '.github/workflows/security.yml', 'scripts/secret-scan.cjs'])
    if (changedPolicy) return null
    return `${base}..HEAD`
  } catch { return null }
}

function main() {
  let event = {}
  try { event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) } catch { /* Full scan if metadata is unavailable. */ }
  const range = scanRange(process.env.GITHUB_EVENT_NAME, event)
  console.log(range ? 'Scanning every new PR commit, including intermediate and merge commits.' : 'Scanning full repository history.')
  const args = ['run', 'github.com/zricethezav/gitleaks/v8@v8.30.1', 'git', '--redact',
    '--report-format', 'json', '--report-path', 'secret-history.json']
  if (range) args.push(`--log-opts=--full-history -m ${range}`)
  args.push('.')
  const result = spawnSync('go', args, { stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

if (require.main === module) main()
module.exports = { scanRange }
