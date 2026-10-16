const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, renameSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join, dirname, resolve } = require('node:path')
const { contractScope } = require('./emulator-contract-scope.cjs')
const sha = 'a'.repeat(40)
const event = { pull_request: { base: { sha } } }
const changed = files => args => args[0] === 'diff' ? files.join('\0') + '\0' : ''

test('only known presentation changes omit standalone contracts', () => {
  for (const file of ['src/components/picker.tsx', 'src/app/(tabs)/game.tsx', 'src/styles/global.ts',
    '__tests__/components/gameplayView.test.tsx', 'integration/browser/gameplay.spec.mjs',
    'assets/fonts/PremiereClue.woff2', 'docs/CONTINUING.md', 'README.md']) {
    assert.equal(contractScope('pull_request', event, changed([file])).run, false, file)
  }
})

test('backend, shared, dependency, workflow and unknown changes always run', () => {
  for (const file of ['functions/src/index.ts', 'firestore.rules', 'firebase.integration.json',
    'src/data/searchIndex.json', 'src/models/trivia.ts', 'src/services/gameService.ts',
    'src/state/slices/gameSlice.ts', 'src/contexts/authContext.tsx', 'utils/pipeline/main.go',
    'package-lock.json', 'functions/package-lock.json', 'integration/package-lock.json',
    'integration/run-contracts.mjs', 'integration/tests/game.test.mjs', '.nvmrc',
    '.github/workflows/unit-tests.yml', 'scripts/emulator-contract-scope.cjs', 'new-input.json']) {
    assert.equal(contractScope('pull_request', event, changed(['src/components/picker.tsx', file])).run, true, file)
  }
})

test('missing metadata, empty diffs and comparison failures run everything', () => {
  for (const name of ['workflow_dispatch', 'merge_group', 'schedule', 'unexpected']) {
    assert.equal(contractScope(name, event, changed(['README.md'])).run, true)
  }
  for (const base of [undefined, '', '0'.repeat(40), '--help', 'HEAD']) {
    assert.equal(contractScope('push', { before: base }, changed(['README.md'])).run, true)
  }
  assert.equal(contractScope('pull_request', event, changed([])).run, true)
  assert.equal(contractScope('pull_request', event, () => { throw Error('missing history') }).run, true)
})

test('real Git comparison includes prior commits, deletions and renamed backend files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'talkie-contract-scope-'))
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const write = (file, text) => { mkdirSync(dirname(join(directory, file)), { recursive: true }); writeFileSync(join(directory, file), text) }
  const commit = () => { git(['add', '.']); git(['commit', '-qm', 'fixture']); return git(['rev-parse', 'HEAD']).trim() }
  try {
    git(['init', '-q']); git(['config', 'user.email', 'test@example.invalid']); git(['config', 'user.name', 'Fixture'])
    write('functions/backend.ts', 'original'); const base = commit()
    write('src/components/view.tsx', 'view'); commit()
    assert.equal(contractScope('push', { before: base }, git).run, false)
    const metadata = join(directory, '.git/event.json')
    const output = join(directory, '.git/output')
    const summary = join(directory, '.git/summary')
    writeFileSync(metadata, JSON.stringify({ before: base }))
    execFileSync(process.execPath, [join(__dirname, 'emulator-contract-scope.cjs')], {
      cwd: directory, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_NAME: 'push',
        GITHUB_EVENT_PATH: metadata, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    })
    assert.equal(readFileSync(output, 'utf8'), 'run=false\n')
    assert.match(readFileSync(summary, 'utf8'), /not applicable/)
    write('functions/backend.ts', 'changed'); commit()
    write('docs/notes.md', 'notes'); commit()
    assert.equal(contractScope('pull_request', { pull_request: { base: { sha: base } } }, git).run, true)
    writeFileSync(output, '')
    execFileSync(process.execPath, [join(__dirname, 'emulator-contract-scope.cjs')], {
      cwd: directory, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_NAME: 'push',
        GITHUB_EVENT_PATH: metadata, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    })
    assert.equal(readFileSync(output, 'utf8'), 'run=true\n')
    const beforeRename = git(['rev-parse', 'HEAD']).trim()
    renameSync(join(directory, 'functions/backend.ts'), join(directory, 'src/components/moved.ts'))
    commit()
    assert.equal(contractScope('push', { before: beforeRename }, git).run, true)
    git(['checkout', '--orphan', 'unrelated']); write('README.md', 'unrelated'); commit()
    assert.equal(contractScope('push', { before: base }, git).run, true)
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
    rmSync(directory, { recursive: true, force: true })
  }
})
