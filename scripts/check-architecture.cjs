const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

function violations(file, source) {
  const errors = []
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  function check(specifier) {
    const target = specifier.startsWith('.')
      ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier)) : specifier
    if (file.startsWith('src/') && (/^firebase-admin(?:\/|$)/.test(target) || target.startsWith('functions/'))) {
      errors.push(`${file}: client must not import server code (${specifier})`)
    }
    if (/^src\/(app|components|state)\//.test(file) && /^firebase\/(firestore|functions)(?:\/|$)/.test(target)) {
      errors.push(`${file}: use a service for database/callable access (${specifier})`)
    }
    if (file.startsWith('src/services/') && /^src\/(app|components|contexts|state)\//.test(target)) {
      errors.push(`${file}: services must not depend on UI or state (${specifier})`)
    }
    if (file.startsWith('functions/src/') && target.startsWith('src/')) {
      errors.push(`${file}: backend must not depend on client code (${specifier})`)
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) check(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require')) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) check(node.arguments[0].text)
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return errors
}

if (require.main === module) {
  const errors = []
  function walk(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`
      if (entry.isDirectory()) walk(file)
      else if (/\.[cm]?[jt]sx?$/.test(file) && !/\.test\./.test(file)) errors.push(...violations(file, fs.readFileSync(path.join(root, file), 'utf8')))
    }
  }
  walk('src')
  walk('functions/src')
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('Client/server and UI/service import boundaries pass.')
}
module.exports = { violations }
