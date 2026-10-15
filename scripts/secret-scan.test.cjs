const test = require('node:test')
const assert = require('node:assert/strict')
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, resolve, sep } = require('node:path')
const { execFileSync, spawnSync } = require('node:child_process')
const { scanRange } = require('./secret-scan.cjs')
const base = 'a'.repeat(40)
const event = { pull_request: { base: { sha: base } } }

test('only PRs with valid ancestry and unchanged scanning policy use a range', () => {
  for (const name of ['push', 'schedule', 'workflow_dispatch', 'merge_group', undefined]) {
    assert.equal(scanRange(name, event, () => { throw Error('must not inspect git') }), null)
  }
  for (const value of [undefined, '', '0'.repeat(40), '--all', `${base};echo unsafe`]) {
    assert.equal(scanRange('pull_request', { pull_request: { base: { sha: value } } }, () => { throw Error('missing base') }), null)
  }
  assert.equal(scanRange('pull_request', event, () => ''), `${base}..HEAD`)
  assert.equal(scanRange('pull_request', event, () => { throw Error('not an ancestor') }), null)
  assert.equal(scanRange('pull_request', event, args => args[0] === 'diff' ? '.gitleaksignore' : ''), null)
})

test('range includes a removed intermediate value and merge-only changes', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'talkie-scan-'))
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const commit = message => { git(['add', '.']); git(['commit', '-m', message]) }
  try {
    git(['init']); git(['config', 'user.name', 'Fixture']); git(['config', 'user.email', 'fixture@example.invalid'])
    writeFileSync(join(cwd, 'file.txt'), 'base\n'); commit('base')
    const sha = git(['rev-parse', 'HEAD'])
    git(['switch', '-c', 'feature'])
    writeFileSync(join(cwd, 'file.txt'), 'temporary-sensitive-fixture\n'); commit('intermediate')
    writeFileSync(join(cwd, 'file.txt'), 'safe final text\n'); commit('remove intermediate')
    git(['switch', '-c', 'target', sha])
    writeFileSync(join(cwd, 'target.txt'), 'target\n'); commit('target work')
    git(['merge', '--no-ff', '--no-commit', 'feature'])
    writeFileSync(join(cwd, 'merge.txt'), 'merge-only-fixture\n'); commit('merge')
    const range = scanRange('pull_request', { pull_request: { base: { sha } } }, git)
    assert.equal(range, `${sha}..HEAD`)
    const patches = git(['log', '-p', '--full-history', '-m', range])
    assert.match(patches, /\+temporary-sensitive-fixture/)
    assert.match(patches, /\+merge-only-fixture/)
    if (process.env.TALKIE_TEST_GITLEAKS === '1') {
      writeFileSync(join(cwd, 'fixture.toml'), '[[rules]]\nid="fixture"\nregex="temporary-sensitive-fixture|merge-only-fixture"\n')
      const scan = spawnSync('go', ['run', 'github.com/zricethezav/gitleaks/v8@v8.30.1', 'git', '--redact',
        '--config', 'fixture.toml', '--report-format', 'json', '--report-path', 'report.json',
        `--log-opts=--full-history -m ${range}`, '.'], { cwd, encoding: 'utf8', windowsHide: true })
      assert.equal(scan.status, 1, 'pinned scanner must flag both fixture values')
      const findings = JSON.parse(readFileSync(join(cwd, 'report.json'), 'utf8'))
      assert.ok(findings.some(finding => finding.File === 'file.txt'))
      assert.ok(findings.some(finding => finding.File === 'merge.txt'))
    }
    writeFileSync(join(cwd, '.gitleaksignore'), 'policy fixture\n'); commit('policy changed')
    assert.equal(scanRange('pull_request', { pull_request: { base: { sha } } }, git), null)
  } finally {
    assert.ok(resolve(cwd).startsWith(resolve(tmpdir()) + sep), 'cleanup must stay inside the temporary directory')
    rmSync(cwd, { recursive: true, force: true })
  }
})
