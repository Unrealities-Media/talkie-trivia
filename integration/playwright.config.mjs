import { defineConfig } from '@playwright/test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const directory = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './browser',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 15000 },
  outputDir: '../.expo/browser-results',
  reporter: [['list'], ['html', { outputFolder: '../.expo/browser-report', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium',
    serviceWorkers: 'block', reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: { command: 'node browser/serve.mjs', cwd: directory,
    url: 'http://127.0.0.1:4173', reuseExistingServer: false,
    env: { TALKIE_BROWSER_BUILD: resolve(directory, '../.expo/browser-build') } },
})
