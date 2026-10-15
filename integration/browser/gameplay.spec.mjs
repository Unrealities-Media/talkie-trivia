import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { allowedRequest } from './network-policy.mjs'
const require = createRequire(import.meta.url)
const fixtures = require('../../content/beta-movies.json')
const catalog = require('../../src/data/searchIndex.json')
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test.beforeEach(async ({ context }) => {
  await context.route('**/*', async route => {
    const request = route.request()
    if (allowedRequest(request.url(), request.resourceType())) return route.continue()
    await route.abort('blockedbyclient')
    throw new Error(`Browser test blocked unexpected network origin: ${new URL(request.url()).origin}`)
  })
  await context.routeWebSocket('**/*', socket => socket.close())
})

test('guest can start, guess, reload, reveal, win and share with saved history', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await page.getByRole('button', { name: /^Play Hard\./ }).click()
  await page.getByRole('button', { name: 'Keep browsing', exact: true }).click()
  await page.getByRole('button', { name: /^Play Hard\./ }).click()
  await page.getByRole('button', { name: 'Start challenge', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Play Hard\. In progress/ })).toBeVisible()
  await page.getByRole('searchbox').fill('star')
  const result = page.getByRole('button', { name: /^Select and guess:/ }).first()
  await expect(result).toBeVisible()
  await page.getByRole('searchbox').press('Enter')
  await expect(result).toBeFocused()
  await page.getByRole('searchbox').fill('')
  await page.reload()
  await expect(page.getByRole('button', { name: /^Play Hard\. In progress/ })).toBeVisible()
  await page.getByRole('button', { name: 'Give Up?', exact: true }).click()
  await page.getByRole('button', { name: 'Give Up', exact: true }).click()
  await expect(page.getByText('Answer revealed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Play Very Easy\./ }).click()
  await page.getByRole('button', { name: 'Start challenge', exact: true }).click()
  const day = Math.floor(Date.now() / 86400000)
  const fixture = fixtures[(day * 5) % fixtures.length]
  const answer = catalog.find(movie => movie.i === fixture.movieId)
  await page.getByRole('searchbox').fill(answer.t)
  await page.getByRole('button', { name: new RegExp(`^Select and guess: ${escape(answer.t)}`) }).first().click()
  await expect(page.getByText("That's a wrap!", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText("That's a wrap!", { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Share Your Result', exact: true }).click()
  await expect(page.getByText(/Result copied|Select and copy your result below/)).toBeVisible()
  await page.getByRole('tab', { name: 'Archive', exact: true }).click()
  await expect(page.getByText(answer.t, { exact: true }).first()).toBeVisible()
  await page.getByRole('tab', { name: 'Profile', exact: true }).click()
  await expect(page.getByText('Statistics', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('Easy hint purchase and a wrong guess survive reload', async ({ page }) => {
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await page.getByRole('button', { name: /^Play Easy\./ }).click()
  await page.getByRole('button', { name: 'Start challenge', exact: true }).click()
  await expect(page.getByText(/^3 hints left/)).toBeVisible()
  await page.getByRole('button', { name: /^Director: Reveal/ }).click()
  await expect(page.getByText(/^2 hints left/)).toBeVisible()
  const revealed = page.getByLabel(/^Director: (?!Reveal)/)
  await expect(revealed).toBeVisible()
  const directorLabel = await revealed.getAttribute('aria-label')
  const day = Math.floor(Date.now() / 86400000)
  const fixture = fixtures[(day * 5 + 1) % fixtures.length]
  const wrong = catalog.find(movie => movie.i !== fixture.movieId && movie.t.length < 30 &&
    catalog.filter(candidate => candidate.t === movie.t).length === 1)
  expect(wrong).toBeTruthy()
  await page.getByRole('searchbox').fill(wrong.t)
  await page.getByRole('button', { name: new RegExp(`^Select and guess: ${escape(wrong.t)}`) }).first().click()
  await expect(page.getByRole('searchbox')).toHaveValue('')
  await page.reload()
  await expect(page.getByText(/^2 hints left/)).toBeVisible()
  await expect(page.getByLabel(directorLabel, { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill(wrong.t)
  await expect(page.getByRole('button', { name: new RegExp(`^${escape(wrong.t)}.*Already guessed`) }).first()).toBeDisabled()
})

test('a throttled guess stays pending through retry and reload without becoming a new move', async ({ page }) => {
  const commands = []
  // Exercise the actual callable error contract without generating abusive traffic.
  // Only the first two attempts are intercepted; reload reaches the real emulator.
  await page.route('**/applyGameAction', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    commands.push(route.request().postDataJSON().data)
    if (commands.length <= 2) return route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED', message: 'Request limit reached', details: { retryAfterMs: 2000 } } }),
    })
    return route.continue()
  })
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  const day = Math.floor(Date.now() / 86400000)
  // The initial game is Medium (LEVEL_3).
  const fixture = fixtures[(day * 5 + 2) % fixtures.length]
  const wrong = catalog.find(movie => movie.i !== fixture.movieId && movie.t.length < 30 &&
    catalog.filter(candidate => candidate.t === movie.t).length === 1)
  expect(wrong).toBeTruthy()
  await page.getByRole('searchbox').fill(wrong.t)
  await page.getByRole('button', { name: new RegExp(`^Select and guess: ${escape(wrong.t)}`) }).first().click()
  await expect(page.getByText('Waiting to save', { exact: true })).toBeVisible()
  await expect(page.getByText('Please wait a few seconds before trying again. Your saved progress is safe.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Give Up?', exact: true })).toBeDisabled()
  await expect(page.getByText('5 GUESSES REMAINING', { exact: true })).toBeVisible()
  expect(commands).toHaveLength(1)
  await page.getByRole('button', { name: 'Retry save', exact: true }).click()
  await expect.poll(() => commands.length).toBe(2)
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
  expect(commands).toHaveLength(2)
  expect(commands[1]).toEqual(commands[0])
  await page.reload()
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.getByText('Waiting to save', { exact: true })).toHaveCount(0)
  await expect(page.getByText('4 GUESSES REMAINING', { exact: true })).toBeVisible()
  expect(commands).toHaveLength(3)
  expect(commands[2]).toEqual(commands[0])
  await page.getByRole('searchbox').fill(wrong.t)
  await expect(page.getByRole('button', { name: new RegExp(`^${escape(wrong.t)}.*Already guessed`) }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Give Up?', exact: true })).toBeEnabled()
})
