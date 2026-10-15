import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('../../node_modules/typescript')

export function verifyBrowserBuild(directory) {
  let configs = 0
  function inspect(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name)
      if (entry.isDirectory()) { inspect(file); continue }
      if (!entry.name.endsWith('.js')) continue
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
      function visit(node) {
        if (ts.isStringLiteral(node) && node.text.includes('firebaseProjectId')) {
          let config
          try { config = JSON.parse(node.text) } catch { /* Ordinary application string. */ }
          if (config?.extra?.firebaseProjectId) {
            const extra = config.extra
            if (extra.firebaseProjectId !== 'demo-talkie-web-test' ||
                extra.firebaseUseEmulators !== true || extra.firebaseEmulatorHost !== '127.0.0.2' ||
                extra.appVariant !== 'development') {
              throw Error('Browser artifact contains a non-isolated Firebase configuration. Refusing to launch.')
            }
            configs++
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  inspect(directory)
  if (!configs) throw Error('No verifiable embedded Expo configuration found. Refusing to launch.')
}
