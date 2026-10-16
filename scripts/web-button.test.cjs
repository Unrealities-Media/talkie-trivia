const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { transformFileSync } = require('@babel/core')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// Use the real web Pressable and DOM renderer: native test rendering translates
// ARIA props back into accessibilityState and cannot catch missing web attributes.
const { code } = transformFileSync(path.join(__dirname, '../src/components/ui/button.tsx'), {
  babelrc: false, configFile: false,
  presets: ['@babel/preset-typescript'],
  plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
})
const loaded = { exports: {} }
const componentRequire = name => {
  if (name === 'react-native') return require('react-native-web')
  if (name === '../../contexts/themeContext') return { useTheme: () => ({ colors: {} }) }
  if (name === '../../styles/global') return { getButtonStyles: () => ({}) }
  return require(name)
}
new Function('require', 'module', 'exports', code)(componentRequire, loaded, loaded.exports)
const { Button } = loaded.exports
const markup = props => renderToStaticMarkup(React.createElement(Button, { title: 'Help', ...props }))

test('web button exposes both collapsed and expanded help states', () => {
  assert.match(markup({ accessibilityState: { expanded: false } }), /aria-expanded="false"/)
  assert.match(markup({ accessibilityState: { expanded: true } }), /aria-expanded="true"/)
  assert.doesNotMatch(markup({}), /aria-expanded=/)
})

test('loading remains announced and disabled when callers supply another state', () => {
  const html = markup({ isLoading: true, accessibilityState: { expanded: true, disabled: false, busy: false } })
  assert.match(html, /aria-expanded="true"/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /aria-disabled="true"/)
})

test('explicit ARIA state takes precedence and false values survive rendering', () => {
  assert.match(markup({ 'aria-expanded': false, accessibilityState: { expanded: true } }), /aria-expanded="false"/)
  const html = markup({ accessibilityState: { checked: 'mixed', selected: false } })
  assert.match(html, /aria-checked="mixed"/)
  assert.match(html, /aria-selected="false"/)
})
