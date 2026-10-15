const { test } = require('node:test')
const assert = require('node:assert/strict')
const { violations } = require('./check-architecture.cjs')

test('client cannot import admin SDK or server code through static or dynamic imports', () => {
  for (const source of ["import { getAuth } from 'firebase-admin/auth'", "export * from '../../functions/src/catalog'", "const db = require('firebase-admin/firestore')", "import('firebase-admin/app')"]) {
    assert.equal(violations('src/services/bad.ts', source).length, 1)
  }
})
test('UI and state access storage through services', () => {
  for (const file of ['src/app/game.tsx', 'src/components/game.tsx', 'src/state/game.ts']) {
    assert.equal(violations(file, "import { setDoc } from 'firebase/firestore'").length, 1)
    assert.equal(violations(file, "import { gameService } from '../services/gameService'").length, 0)
  }
})
test('dependency direction excludes UI in services and client in backend', () => {
  assert.equal(violations('src/services/test.ts', "import { useTheme } from '../contexts/themeContext'").length, 1)
  assert.equal(violations('functions/src/test.ts', "import { colors } from '../../src/styles/themes'").length, 1)
  assert.equal(violations('src/services/test.ts', "import { getDoc } from 'firebase/firestore'").length, 0)
})
