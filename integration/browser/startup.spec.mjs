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

test('gameplay and navigation remain usable while custom font downloads are stalled', async ({ page }) => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  let fontRequests = 0
  await page.route(/\.(ttf|otf|woff2?)(\?|$)/, async route => { fontRequests++; await gate; await route.continue() })
  try {
    await page.goto('/game', { waitUntil: 'domcontentloaded' })
    // Do not accept the old fallback that appeared only after a font timeout.
    await expect(page.getByRole('tab', { name: 'Play', exact: true })).toBeVisible({ timeout: 2000 })
    await expect(page.getByRole('searchbox')).toBeVisible()
    expect(fontRequests).toBeGreaterThan(0)
    await page.getByRole('tab', { name: 'Profile', exact: true }).click()
    await page.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(page.getByText('Account settings', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Play', exact: true }).click()
    await expect(page.getByRole('searchbox')).toBeVisible()
  } finally { release() }
  await page.evaluate(() => document.fonts.ready)
  // A fallback alone can look usable even when a font format fails to load.
  await expect.poll(() => page.evaluate(() =>
    [...document.fonts].some(font => font.family.replace(/["']/g, '') === 'PremiereClue' && font.status === 'loaded')
  )).toBe(true)
  const clueFonts = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter(entry => entry.name.includes('PremiereClue.')).map(entry => entry.name))
  expect(clueFonts.some(url => /\.woff2(?:\?|$)/.test(url))).toBe(true)
  expect(clueFonts.some(url => /\.ttf(?:\?|$)/.test(url))).toBe(false)
  await expect(page.getByRole('searchbox')).toBeVisible()
})

test('daily game retry preserves keyboard position through failure and recovery', async ({ page }) => {
  let fail = true
  let attempts = 0
  await page.route('**/startGame', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    attempts++
    if (fail) return route.fulfill({
      status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Game service temporarily unavailable' } }),
    })
    return route.continue()
  })
  await page.goto('/game')
  const retry = page.getByRole('button', { name: 'Retry', exact: true })
  const region = page.getByRole('group', { name: 'Daily game', exact: true })
  await expect(retry).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('game service')
  const beforeRetry = attempts
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => attempts).toBeGreaterThan(beforeRetry)
  await expect(retry).toBeVisible()
  await expect(region).toBeFocused()
  fail = false
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(region).toBeFocused()
  await page.keyboard.press('Tab')
  // Browsers may make the scrollable clue viewport a keyboard stop.
  if (await page.getByTestId('clue-viewport').evaluate(node => node === document.activeElement)) {
    await page.keyboard.press('Tab')
  }
  await expect(page.getByRole('searchbox')).toBeFocused()
})

test('daily game retry respects pointer activation and later keyboard navigation', async ({ page }) => {
  let fail = true
  let release
  let gate = Promise.resolve()
  await page.route('**/startGame', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    await gate
    if (fail) return route.fulfill({
      status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Game service temporarily unavailable' } }),
    })
    return route.continue()
  })
  for (const pointer of [true, false]) {
    fail = true
    await page.goto('/game')
    const retry = page.getByRole('button', { name: 'Retry', exact: true })
    await expect(retry).toBeVisible()
    gate = new Promise(resolve => { release = resolve })
    fail = false
    try {
      if (pointer) await retry.click()
      else { await retry.focus(); await page.keyboard.press('Enter') }
      await expect(page.getByText('Loading the daily movie…', { exact: true })).toHaveAttribute('aria-live', 'polite')
      const region = page.getByRole('group', { name: 'Daily game', exact: true })
      if (pointer) await expect(region).not.toBeFocused()
      else {
        await expect(region).toBeFocused()
        await page.getByRole('tab', { name: 'Profile', exact: true }).focus()
      }
    } finally { release() }
    await expect(page.getByRole('searchbox')).toBeVisible()
    if (pointer) await expect(page.getByRole('group', { name: 'Daily game', exact: true })).not.toBeFocused()
    else await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toBeFocused()
  }
})
