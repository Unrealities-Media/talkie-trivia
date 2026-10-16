import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { allowedRequest } from './network-policy.mjs'
import { trackPageErrors } from './page-errors.mjs'

// Display fixture only: the gameplay contracts separately exercise real scores.
const summary = 'Dom Cobb steals secrets by entering other people’s dreams. When a powerful businessman offers him a way home to his children, the price is an almost impossible assignment: plant an idea in an heir’s mind and make him believe it is his own. Cobb assembles a team to build a dream inside a dream, turning a carefully planned heist into a descent through shifting realities. But memories of his late wife keep breaking into the mission, threatening everyone who follows him. To finish the job, Cobb must confront the guilt he has carried into this world—and decide what he is willing to leave behind.'
const names = ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page', 'Tom Hardy']
const files = ['leonardo', 'joseph', 'elliot', 'tom']

test('cinematic reward matches the selected composition and handles result variations', async ({ page, context, browserName }, testInfo) => {
  test.skip(testInfo.project.use.viewport?.width !== 1440, 'Explicit reference, phone and desktop widths are covered here.')
  const observed = trackPageErrors(page, browserName)
  let variant = 'reference'
  await context.route('**/*', async route => {
    const request = route.request()
    if (allowedRequest(request.url(), request.resourceType())) return route.continue()
    return route.abort('blockedbyclient')
  })
  await context.routeWebSocket('**/*', socket => socket.close())
  await page.addInitScript(() => localStorage.setItem('difficulty_setting', 'LEVEL_4'))
  await page.route('https://image.tmdb.org/**', async route => {
    if (variant === 'missing') return route.abort()
    const name = new URL(route.request().url()).pathname.split('/').pop()
    const file = [...files, 'backdrop', 'poster'].includes(name.replace('.jpg', '')) ? name : 'poster.jpg'
    await route.fulfill({ contentType: 'image/jpeg', body: await readFile(new URL(`../fixtures/reward/${file}`, import.meta.url)) })
  })
  await page.route('**/us-central1/startGame', async route => {
    if (route.request().method() !== 'POST') return route.continue()
    const response = await route.fetch()
    const body = await response.json()
    const result = body.result
    expect(result?.game).toBeTruthy()
    const game = result.game
    Object.assign(game, { correctAnswer: variant !== 'loss', gaveUp: variant === 'loss', statsProcessed: variant !== 'pending', score: variant === 'loss' ? 0 : 800, guesses: [{ itemId: 11324 }, { itemId: 27205 }], revision: 2 })
    game.triviaItem = { id: 27205, title: variant === 'long' ? 'A Very Long Movie Title: An Unexpected Journey Through Dreams and Memories' : 'Inception',
      description: 'A short clue for Hard mode.', posterPath: '/poster.jpg', releaseDate: '2010',
      metadata: { fullSummary: summary, backdrop_path: '/backdrop.jpg', tagline: 'Your mind is the scene of the crime.', imdb_id: 'tt1375666' },
      hints: [{ type: 'director', label: 'Director', value: 'Christopher Nolan' }, { type: 'genre', label: 'Genre', value: 'Sci-fi / Action / Thriller' },
        { type: 'decade', label: 'Decade', value: '2010s' }, { type: 'actors', label: 'Actors', value: names.map((name, i) => ({ name, profile_path: `/${files[i]}.jpg` })) }] }
    await route.fulfill({ response, json: body })
  })
  await page.setViewportSize({ width: 460, height: 900 })
  await page.goto('/game')
  const reward = page.getByTestId('cinematic-reward')
  // RN's ScrollView clips offscreen descendants. Temporarily grow the viewport
  // for the full reward capture, then restore the actual interaction viewport.
  const capture = async name => {
    const viewport = page.viewportSize()
    const bounds = await reward.boundingBox()
    await page.setViewportSize({ width: viewport.width, height: Math.ceil(bounds.height) + 400 })
    await reward.screenshot({ path: testInfo.outputPath(name) })
    await page.setViewportSize(viewport)
  }
  await expect(reward).toBeVisible()
  await expect(page.getByText(summary, { exact: true })).toBeVisible()
  await expect(page.getByText('A short clue for Hard mode.', { exact: true })).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="cinematic-reward"] img')].every(image => image.complete && image.naturalWidth > 0))
  await capture('cinematic-reward-460.png')
  const artwork = await page.getByTestId('reward-backdrop').boundingBox()
  const poster = await page.getByTestId('reward-poster').boundingBox()
  expect(artwork.height).toBe(224)
  expect(poster.y).toBeLessThan(artwork.y + artwork.height)
  const cast = await page.getByText('Starring', { exact: true }).boundingBox()
  const story = await page.getByText('The story', { exact: true }).boundingBox()
  expect(cast.y).toBeLessThan(story.y)
  await expect(page.getByRole('button', { name: /^Play Very Easy\./ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose another difficulty →' }).click()
  await expect(page.getByRole('button', { name: /^Play Very Easy\./ })).toBeVisible()
  await page.getByRole('button', { name: 'Hide difficulties' }).click()
  await page.getByRole('button', { name: /^View your guesses/ }).click()
  await page.getByRole('button', { name: /^Hide your guesses/ }).click()
  for (const width of [390, 320, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await capture(`cinematic-reward-${width}.png`)
  }
  for (const next of ['long', 'missing', 'loss', 'pending']) {
    variant = next
    await page.setViewportSize({ width: 320, height: 900 })
    await observed.reload()
    await expect(reward).toBeVisible()
    await expect(page.getByText(summary, { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (next === 'pending') await expect(page.getByRole('button', { name: 'Share Your Result' })).toBeDisabled()
    if (next === 'loss') await expect(page.getByRole('heading', { name: 'Answer revealed', exact: true })).toBeVisible()
    await capture(`cinematic-reward-${next}-320.png`)
  }
  variant = 'reference'
  await page.evaluate(() => localStorage.setItem('theme_preference', 'light'))
  await observed.reload()
  await expect(reward).toBeVisible()
  await expect(reward).toHaveCSS('background-color', 'rgb(250, 243, 232)')
  await capture('cinematic-reward-light-320.png')
  await testInfo.attach('reload-cancellations', { body: JSON.stringify(observed.reloadCancellations), contentType: 'application/json' })
  expect(observed.errors).toEqual([])
})
