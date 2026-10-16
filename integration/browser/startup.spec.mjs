import { test, expect } from '@playwright/test'
import { allowedRequest } from './network-policy.mjs'

test.beforeEach(async ({ context }) => {
  await context.route('**/*', async route => {
    const request = route.request()
    if (allowedRequest(request.url(), request.resourceType())) return route.continue()
    await route.abort('blockedbyclient')
    throw new Error(`Unexpected startup network origin: ${new URL(request.url()).origin}`)
  })
  await context.routeWebSocket('**/*', socket => socket.close())
})

test('shows initial HTML while JavaScript downloads and removes it when the app starts', async ({ page }) => {
  await page.clock.install()
  let release
  const gate = new Promise(resolve => { release = resolve })
  await page.route('**/_expo/static/js/web/*.js', async route => { await gate; await route.continue() })
  try {
    await page.goto('/game', { waitUntil: 'commit' })
    await expect(page.getByRole('heading', { name: 'Talkie Trivia', exact: true })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('Opening your daily movies…')
    await expect(page.getByRole('button', { name: 'Reload game' })).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.clock.fastForward(20000)
    await expect(page.getByRole('status')).toHaveText('Taking longer than usual.')
    await expect(page.getByRole('button', { name: 'Reload game' })).toBeVisible()
  } finally { release() }
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.locator('#startup')).toHaveCount(0)
})

test('offers keyboard-accessible recovery when the startup script fails', async ({ page }) => {
  let fail = true
  await page.route('**/_expo/static/js/web/*.js', route => fail ? route.abort('failed') : route.continue())
  await page.goto('/game')
  await expect(page.getByRole('status')).toHaveText("Couldn't load the game.")
  await expect(page.getByRole('link', { name: 'Support', exact: true })).toHaveAttribute('href', '/support')
  const reload = page.getByRole('button', { name: 'Reload game', exact: true })
  await reload.focus()
  await expect(reload).toBeFocused()
  fail = false
  await page.keyboard.press('Enter')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.locator('#startup')).toHaveCount(0)
})

test('explains JavaScript-disabled browsing without an endless loading message', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4173/game')
    await expect(page.getByText('Enable JavaScript to play.', { exact: true })).toBeVisible()
    await expect(page.getByText('Opening your daily movies…', { exact: true })).toBeHidden()
  } finally { await context.close() }
})
