import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { allowedRequest } from './network-policy.mjs'
import { trackPageErrors } from './page-errors.mjs'
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

test('result navigation keeps keyboard position from reveal into the next challenge', async ({ page }) => {
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await page.getByRole('button', { name: /^Play Very Easy\./ }).click()
  const day = Math.floor(Date.now() / 86400000)
  const answer = catalog.find(movie => movie.i === fixtures[(day * 5) % fixtures.length].movieId)
  await page.getByRole('searchbox').fill(answer.t)
  const guess = page.getByRole('button', { name: new RegExp(`^Select and guess: ${escape(answer.t)}`) }).first()
  await guess.focus()
  await page.keyboard.press('Enter')
  const skip = page.getByRole('button', { name: 'Skip reveal and view results', exact: true })
  await expect(skip).toBeVisible()
  await skip.focus()
  await page.keyboard.press('Enter')
  await expect(skip).toHaveCount(0)
  await expect(page.getByRole('heading', { name: "That's a wrap!", exact: true })).toBeFocused()
  const next = page.getByRole('button', { name: 'Continue Medium', exact: true })
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Daily game', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  if (await page.getByTestId('clue-viewport').evaluate(node => node === document.activeElement)) {
    await page.keyboard.press('Tab')
  }
  await expect(page.getByRole('searchbox')).toBeFocused()
  for (const pointer of [true, false]) {
    const completed = page.getByRole('button', { name: /^Play Very Easy\./ })
    await completed.focus()
    await page.keyboard.press('Enter')
    await expect(next).toBeVisible()
    // Opening a saved result keeps the navigation handoff, without moving
    // focus to its heading as though a fresh reveal had just finished.
    await expect(page.getByRole('group', { name: 'Daily game', exact: true })).toBeFocused()
    let release
    const gate = new Promise(resolve => { release = resolve })
    const waitForLoad = async route => {
      if (route.request().method() === 'POST') await gate
      await route.continue()
    }
    await page.route('**/startGame', waitForLoad)
    try {
      if (pointer) await next.click()
      else { await next.focus(); await page.keyboard.press('Enter') }
      await expect(page.getByText('Loading the daily movie…', { exact: true })).toBeVisible()
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
    await page.unroute('**/startGame', waitForLoad)
  }
})

test('guest can start, guess, reload, reveal, win and share with saved history', async ({ page, browserName }, testInfo) => {
  const observed = trackPageErrors(page, browserName)
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  const searchStatus = page.getByTestId('search-status')
  await expect(searchStatus).toHaveAttribute('role', 'status')
  await expect(searchStatus).toHaveAttribute('aria-live', 'polite')
  await expect(searchStatus).toHaveAttribute('aria-atomic', 'true')
  await expect(searchStatus).toBeEmpty()
  await page.getByRole('button', { name: /^Play Hard\./ }).click()
  await expect(page.getByRole('button', { name: /^Play Hard\. In progress/ })).toBeVisible()
  await page.getByRole('searchbox').fill('the')
  await expect(page.getByRole('button', { name: /^Select and guess:/ })).toHaveCount(12)
  await expect(searchStatus).toHaveText(/^\d+ titles found for "the"\.$/)
  await expect(page.getByRole('searchbox')).toBeFocused()
  await page.getByRole('button', { name: /^Show more titles/ }).click()
  await expect(page.getByRole('button', { name: /^Select and guess:/ })).toHaveCount(24)
  await expect(page.getByRole('button', { name: /^Select and guess:/ }).nth(12)).toBeFocused()
  await page.getByRole('searchbox').fill('the ')
  await expect(page.getByRole('button', { name: /^Select and guess:/ })).toHaveCount(12)
  await page.getByRole('searchbox').fill('star')
  const result = page.getByRole('button', { name: /^Select and guess:/ }).first()
  await expect(result).toBeVisible()
  await page.getByRole('searchbox').press('Enter')
  await expect(result).toBeFocused()
  // The next keyboard stop previews this movie without submitting the row.
  await page.keyboard.press('Tab')
  const preview = page.getByRole('button', { name: /^Preview:/ }).first()
  await expect(preview).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(preview).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('Release Year:', { exact: false })).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveValue('star')
  await page.keyboard.press('Space')
  await expect(preview).toHaveAttribute('aria-expanded', 'false')
  await expect(result).toBeEnabled()
  await page.getByRole('searchbox').fill('')
  await expect(searchStatus).toBeEmpty()
  await page.getByRole('searchbox').fill('zzzznomovietitlezzzz')
  await expect(searchStatus).toHaveText('No titles found for "zzzznomovietitlezzzz". Try another spelling or omit the year.')
  await expect(page.getByRole('searchbox')).toBeFocused()
  await page.getByRole('searchbox').fill('')
  await expect(searchStatus).toBeEmpty()
  await observed.reload()
  await expect(page.getByRole('button', { name: /^Play Hard\. In progress/ })).toBeVisible()
  await page.getByRole('button', { name: 'Give Up?', exact: true }).click()
  await page.getByRole('button', { name: 'Give Up', exact: true }).click()
  await expect(page.getByText('Answer revealed', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Play Very Easy\./ })).toBeInViewport()
  await page.getByRole('button', { name: /^Play Very Easy\./ }).click()
  const day = Math.floor(Date.now() / 86400000)
  const fixture = fixtures[(day * 5) % fixtures.length]
  const answer = catalog.find(movie => movie.i === fixture.movieId)
  await page.getByRole('searchbox').fill(answer.t)
  await page.getByRole('button', { name: new RegExp(`^Select and guess: ${escape(answer.t)}`) }).first().click()
  await expect(page.getByText("That's a wrap!", { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: "That's a wrap!", exact: true })).toBeFocused()
  await observed.reload()
  await expect(page.getByText("That's a wrap!", { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Share Your Result', exact: true }).click()
  await expect(page.getByText(/Result copied|Select and copy your result below/)).toBeVisible()
  // Some browsers expose sharing but cannot open an OS share sheet. Keep the
  // result usable even when both the sheet and clipboard are unavailable.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Unavailable', 'NotAllowedError') } })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError') } } })
  })
  await page.getByRole('button', { name: 'Share Your Result', exact: true }).click()
  await expect(page.getByText('Select and copy your result below.', { exact: true })).toBeVisible()
  const shareText = page.getByRole('textbox', { name: 'Your result to copy', exact: true })
  await expect(shareText).toBeVisible()
  const resultToCopy = await shareText.inputValue()
  expect(resultToCopy).toMatch(/^Talkie Trivia /)
  expect(resultToCopy).not.toContain(answer.t)
  expect(await shareText.evaluate(node => node.scrollHeight <= node.clientHeight)).toBe(true)
  await expect(shareText).toHaveAttribute('readonly', '')
  await page.getByRole('button', { name: 'Share Your Result', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(shareText).toBeFocused()
  // React Native Web defers selection one event-loop turn for Safari.
  await expect.poll(() => shareText.evaluate(node => node.value.slice(node.selectionStart, node.selectionEnd))).toBe(resultToCopy)
  await page.keyboard.type('accidental edit')
  await expect(shareText).toHaveValue(resultToCopy)
  for (const dismissed of [false, true]) {
    await page.evaluate(dismissed => {
      Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {
        if (dismissed) throw new DOMException('Share dismissed', 'AbortError')
      } })
    }, dismissed)
    await page.getByRole('button', { name: 'Share Your Result', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Share Your Result', exact: true })).toBeEnabled()
    await expect(page.getByText(/Result copied|Select and copy|Could not share/)).toHaveCount(0)
    await expect(shareText).toHaveCount(0)
  }
  await expect(page.getByText(/^Daily reset in /)).toBeVisible()
  await page.getByRole('button', { name: 'Continue Medium', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Play Medium\. In progress/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('searchbox')).toBeInViewport()
  await page.getByRole('button', { name: /^Play Very Easy\./ }).click()
  await expect(page.getByText("That's a wrap!", { exact: true })).toBeVisible()
  await page.route('https://image.tmdb.org/**', route => route.abort())
  await page.getByRole('tab', { name: 'Archive', exact: true }).click()
  await expect(page.getByText(answer.t, { exact: true }).first()).toBeVisible()
  const savedResult = page.getByRole('button', { name: new RegExp(`^View ${escape(answer.t)} result\\. .*\\. Very Easy\\. Solved in 1 guess\\. \\d+ points\\.$`) })
  await expect.poll(() => savedResult.getByTestId('history-poster').locator('img').evaluateAll(images =>
    images.some(image => image.src.includes('movie_default') && image.complete && image.naturalWidth > 0)
  )).toBe(true)
  await savedResult.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Synopsis', exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new DOMException('Unavailable', 'NotAllowedError') } })
  })
  const viewport = page.viewportSize()
  await page.setViewportSize({ width: 320, height: 480 })
  const archivedShare = page.getByRole('button', { name: 'Share Your Result', exact: true })
  await archivedShare.click()
  const archivedCopy = page.getByRole('textbox', { name: 'Your result to copy', exact: true })
  await expect(archivedCopy).toHaveValue(resultToCopy)
  await archivedShare.focus()
  await page.keyboard.press('Tab')
  await expect(archivedCopy).toBeFocused()
  await expect.poll(() => archivedCopy.evaluate(node => node.value.slice(node.selectionStart, node.selectionEnd))).toBe(resultToCopy)
  const close = page.getByRole('button', { name: 'Close', exact: true })
  await expect(close).toBeInViewport({ ratio: 1 })
  const copyBounds = await archivedCopy.boundingBox()
  const closeBounds = await close.boundingBox()
  expect(copyBounds.y + copyBounds.height).toBeLessThanOrEqual(closeBounds.y)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.setViewportSize(viewport)
  await page.getByRole('tab', { name: 'Profile', exact: true }).click()
  await expect(page.getByText('Recent movies', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'All stats ↗', exact: true }).click()
  await expect(page.getByText('Your statistics', { exact: true })).toBeVisible()
  await expect(page.getByText('Win distribution', { exact: true })).toBeVisible()
  await expect(page.getByText('Very Easy win distribution', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to profile', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByText('Account settings', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await testInfo.attach('reload-cancellations', { body: JSON.stringify(observed.reloadCancellations), contentType: 'application/json' })
  expect(observed.errors).toEqual([])
})

test('short-screen challenge chooser keeps every choice clear of Close', async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.use.viewport?.width !== 1440, 'Explicit short viewports need one run per engine.')
  const observed = trackPageErrors(page, browserName)
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  for (const viewport of [{ width: 844, height: 390 }, { width: 320, height: 480 }]) {
    await page.setViewportSize(viewport)
    await page.getByRole('tab', { name: 'Profile', exact: true }).click()
    await page.getByRole('button', { name: /^Choose your next challenge/ }).click()
    const close = page.getByRole('button', { name: 'Close', exact: true })
    await expect(close).toBeInViewport({ ratio: 1 })
    for (const difficulty of ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard']) {
      const choice = page.getByRole('button', { name: new RegExp(`^${difficulty} ·`) })
      await choice.focus()
      await expect(choice).toBeFocused()
      await expect(choice).toBeInViewport({ ratio: 1 })
      const bounds = await choice.boundingBox()
      const closeBounds = await close.boundingBox()
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(closeBounds.y)
      expect(await choice.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
      })).toBe(true)
    }
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: /^Play Very Hard\./ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('searchbox')).toBeVisible()
  }
  expect(observed.errors).toEqual([])
})

test('saved hints and guesses survive offline navigation, reconnection and reload', async ({ page }) => {
  // WebChannel probes this image after a connection failure. Keep the test
  // isolated: simulate its network failure without allowing a Google request.
  await page.route(url => url.origin === 'https://www.google.com' && url.pathname === '/images/cleardot.gif', route => {
    if (route.request().resourceType() === 'image') return route.abort('internetdisconnected')
    return route.fallback()
  })
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  await page.getByRole('button', { name: /^Play Easy\./ }).click()
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
  const wrongResult = page.getByRole('button', { name: new RegExp(`^Select and guess: ${escape(wrong.t)}`) }).first()
  await expect(wrongResult).toBeVisible()
  await page.getByRole('searchbox').press('Enter')
  await expect(wrongResult).toBeFocused()
  expect(await wrongResult.evaluate(element => element.matches(':focus-visible'))).toBe(true)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('searchbox')).toHaveValue('')
  await expect(page.getByRole('searchbox')).toBeEditable()
  await expect(page.getByRole('searchbox')).toBeFocused()
  await page.context().setOffline(true)
  await expect(page.getByText(/You’re offline/)).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await page.getByRole('tab', { name: 'Profile', exact: true }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(page.getByText('Account settings', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Play', exact: true }).click()
  await expect(page.getByText(/You’re offline/)).toBeVisible()
  await page.context().setOffline(false)
  await expect(page.getByRole('searchbox')).toBeVisible()
  await expect(page.getByText(/^2 hints left/)).toBeVisible()
  await expect(page.getByLabel(directorLabel, { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText(/^2 hints left/)).toBeVisible()
  await expect(page.getByLabel(directorLabel, { exact: true })).toBeVisible()
  await page.getByRole('searchbox').fill(wrong.t)
  await expect(page.getByRole('button', { name: new RegExp(`^${escape(wrong.t)}.*Already guessed`) }).first()).toBeDisabled()
})

test('narrow-screen keyboard play switches modes directly and keeps help optional', async ({ page }, testInfo) => {
  test.skip(testInfo.project.use.viewport?.width !== 1440, 'One explicit 320px viewport per engine is sufficient.')
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/game')
  await expect(page.getByRole('searchbox')).toBeVisible()
  const hard = page.getByRole('button', { name: /^Play Hard\./ })
  await page.screenshot({ path: testInfo.outputPath('play-320.png'), fullPage: true })
  const tabTo = async (target, key = 'Tab') => {
    for (let attempt = 0; attempt < 40; attempt++) {
      if (await target.evaluate(element => element === document.activeElement)) return
      await page.keyboard.press(key)
    }
    await expect(target).toBeFocused()
  }
  const fitsWidth = async target => {
    const box = await target.boundingBox()
    expect(box).not.toBeNull()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(321)
  }
  await tabTo(hard)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /^Play Hard\. In progress/ })).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Guess the movie', { exact: true })).toHaveCount(0)
  const help = page.getByRole('button', { name: 'How to play', exact: true })
  // Help precedes the modes. Reverse traversal avoids leaving the document
  // through browser chrome when a browser does not wrap forward tab order.
  await tabTo(help, 'Shift+Tab')
  await fitsWidth(help)
  await page.keyboard.press('Enter')
  await expect(page.getByText('Guess the movie', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('help-320.png'), fullPage: true })
  await page.keyboard.press('Enter')
  await expect(page.getByText('Guess the movie', { exact: true })).toHaveCount(0)
  await tabTo(page.getByRole('searchbox'))
  await page.keyboard.type('star')
  const result = page.getByRole('button', { name: /^Select and guess:/ }).first()
  await expect(result).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(result).toBeFocused()
  await fitsWidth(result)
  await page.keyboard.press('Tab')
  const preview = page.getByRole('button', { name: /^Preview:/ }).first()
  await expect(preview).toBeFocused()
  await fitsWidth(preview)
  await page.keyboard.press('Space')
  await expect(preview).toHaveAttribute('aria-expanded', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('enabling reduced motion during play keeps search and the next result still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/game')
  const input = page.getByRole('searchbox')
  await expect(input).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await input.fill('zzzznomovietitlezzzz')
  const movement = await input.evaluate(async element => {
    const positions = []
    const until = performance.now() + 800
    do {
      positions.push(element.getBoundingClientRect().x)
      await new Promise(requestAnimationFrame)
    } while (performance.now() < until)
    return Math.max(...positions) - Math.min(...positions)
  })
  expect(movement).toBeLessThan(0.1)
  await expect(page.getByTestId('search-status')).toContainText('No titles found')
  await page.evaluate(() => {
    window.rewardAnimations = []
    document.addEventListener('animationstart', event => {
      if (event.target.getAttribute('data-testid') === 'cinematic-reward') window.rewardAnimations.push(event.animationName)
    })
  })
  await page.getByRole('button', { name: 'Give Up?', exact: true }).click()
  await page.getByRole('button', { name: 'Give Up', exact: true }).click()
  await expect(page.getByTestId('cinematic-reward')).toBeVisible()
  await expect(page.getByText('Answer revealed', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.rewardAnimations)).toEqual([])
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
  await page.getByRole('button', { name: 'Retry save', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect.poll(() => commands.length).toBe(2)
  await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible()
  expect(commands).toHaveLength(2)
  expect(commands[1]).toEqual(commands[0])
  // A failed retry must not send keyboard navigation back to the page start.
  await expect(page.getByRole('status').filter({ hasText: 'Waiting to save' })).toBeFocused()
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

test('save recovery returns keyboard players to guessing without stealing a later focus change', async ({ page }) => {
  const commands = []
  let reject = true
  let release
  let gate = Promise.resolve()
  await page.route('**/applyGameAction', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    commands.push(route.request().postDataJSON().data)
    await gate
    if (reject) return route.fulfill({
      status: 503, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: { status: 'UNAVAILABLE', message: 'Service unavailable' } }),
    })
    return route.continue()
  })
  await page.goto('/game')
  const search = page.getByRole('searchbox')
  await expect(search).toBeVisible()
  const day = Math.floor(Date.now() / 86400000)
  const fixture = fixtures[(day * 5 + 2) % fixtures.length]
  const wrong = catalog.filter(movie => movie.i !== fixture.movieId && movie.t.length < 30 &&
    catalog.filter(candidate => candidate.t === movie.t).length === 1).slice(0, 3)
  const guess = async title => {
    await search.fill(title)
    await page.getByRole('button', { name: new RegExp(`^Select and guess: ${escape(title)}`) }).first().click()
    await expect(page.getByText('Waiting to save', { exact: true })).toBeVisible()
  }
  const retry = page.getByRole('button', { name: 'Retry save', exact: true })
  for (const [index, behavior] of ['keyboard', 'moved-focus', 'pointer'].entries()) {
    reject = true
    await guess(wrong[index].t)
    gate = new Promise(resolve => { release = resolve })
    reject = false
    try {
      if (behavior === 'pointer') await retry.click()
      else { await retry.focus(); await page.keyboard.press('Enter') }
      const status = page.getByRole('status').filter({ hasText: 'Saving your move' })
      await expect(status).toBeVisible()
      if (behavior === 'pointer') await expect(status).not.toBeFocused()
      else await expect(status).toBeFocused()
      if (behavior === 'moved-focus') await page.getByRole('tab', { name: 'Profile', exact: true }).focus()
    } finally { release() }
    await expect(search).toBeEditable()
    if (behavior === 'keyboard') await expect(search).toBeFocused()
    if (behavior === 'moved-focus') await expect(page.getByRole('tab', { name: 'Profile', exact: true })).toBeFocused()
    if (behavior === 'pointer') await expect(search).not.toBeFocused()
    expect(commands[index * 2 + 1]).toEqual(commands[index * 2])
    await expect(page.getByText(`${4 - index} GUESSES REMAINING`, { exact: true })).toBeVisible()
  }
  expect(commands).toHaveLength(6)
})
