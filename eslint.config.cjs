const js = require('@eslint/js')
const ts = require('typescript-eslint')
const hooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

module.exports = [
  { ignores: ['node_modules/**', '.expo/**', 'functions/lib/**', 'coverage/**', 'functions/coverage/**', 'android/**', 'ios/**', 'vendor/**', 'web-build/**', 'dist*/**'] },
  {
    files: ['src/**/*.{ts,tsx}', 'functions/src/**/*.ts', '__tests__/**/*.{ts,tsx}', 'index.tsx'],
    languageOptions: { parser: ts.parser, globals: { ...globals.browser, ...globals.node, ...globals.jest, __DEV__: 'readonly' } },
    plugins: { '@typescript-eslint': ts.plugin },
    rules: {
      ...js.configs.recommended.rules,
      // TypeScript checks names and declarations; use its scope-aware rule.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
]
