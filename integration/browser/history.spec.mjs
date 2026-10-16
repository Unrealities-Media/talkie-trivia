import { test, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { allowedRequest } from './network-policy.mjs'
import { trackPageErrors } from './page-errors.mjs'

async function seedHistory(uid) {
  // Never write fixtures to a live project or an interactive development emulator.
  assert.equal(process.env.TALKIE_BROWSER_TEST, '1')
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-talkie-web-test')
  assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.2:8080')
  const require = createRequire(new URL('../../functions/package.json', import.meta.url))
  const { initializeApp, deleteApp } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  const app = initializeApp({ projectId: 'demo-talkie-web-test' }, `history-${uid}`)
  const db = getFirestore(app)
  try {
    const batch = db.batch()
    for (let index = 0; index < 45; index++) {
      const dateId = new Date(Date.UTC(2026, 8, 30) - index * 86400000).toISOString().slice(0, 10)
      const challengeId = `${dateId}_LEVEL_3`
      batch.set(db.doc(`players/${uid}/gameHistoryV2/${challengeId}`), {
        dateId, challengeId, itemId: index + 1, itemTitle: `History fixture ${String(index + 1).padStart(2, '0')}`,
        posterPath: '', wasCorrect: false, gaveUp: true, guessCount: 0, guessesMax: 5,
        difficulty: 'LEVEL_3', score: 0, gameMode: 'movies',
      })
    }
    await batch.commit()
  } finally { await db.terminate(); await deleteApp(app) }
}

test('keyboard history paging keeps its position through older, newer and refresh', async ({ page, context, browserName }) => {
  await context.route('**/*', async route => {
    const request = route.request()
    if (allowedRequest(request.url(), request.resourceType())) return route.continue()
    await route.abort('blockedbyclient')
    throw new Error(`History test blocked unexpected origin: ${new URL(request.url()).origin}`)
  })
  await context.routeWebSocket('**/*', socket => socket.close())
  const observed = trackPageErrors(page, browserName)
  const signup = page.waitForResponse(response => response.url().includes('accounts:signUp') && response.request().method() === 'POST')
  await page.goto('/game')
  const { localId: uid } = await (await signup).json()
  assert.ok(typeof uid === 'string' && uid.length > 0 && !uid.includes('/'))
  await expect(page.getByRole('searchbox')).toBeVisible()
  await seedHistory(uid)
  await page.getByRole('tab', { name: 'Profile', exact: true }).click()
  await page.getByRole('button', { name: 'View all movies', exact: true }).click()
  const row = number => page.getByRole('button', { name: new RegExp(`^View History fixture ${number} result\\.`) })
  await expect(row('01')).toBeVisible()
  await row('20').scrollIntoViewIfNeeded()
  await expect(row('20')).toBeInViewport()
  const older = page.getByRole('button', { name: 'Older games', exact: true })
  const status = page.getByRole('status').filter({ hasText: /History page|Loading history page/ })
  const tabTo = async target => {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (await target.evaluate(element => element === document.activeElement)) return
      await page.keyboard.press('Tab')
    }
    await expect(target).toBeFocused()
  }
  await older.focus()
  await page.keyboard.press('Enter')
  await expect(row('21')).toBeVisible()
  await expect(status).toBeFocused()
  await tabTo(older)
  await page.keyboard.press('Enter')
  await expect(row('41')).toBeVisible()
  await expect(older).toHaveCount(0)
  await expect(status).toBeFocused()
  await row('45').scrollIntoViewIfNeeded()
  await expect(row('45')).toBeInViewport()
  const newer = page.getByRole('button', { name: 'Newer games', exact: true })
  await newer.focus()
  await page.keyboard.press('Enter')
  await expect(row('21')).toBeVisible()
  await expect(status).toBeFocused()
  await tabTo(newer)
  await page.keyboard.press('Enter')
  await expect(row('01')).toBeVisible()
  await expect(newer).toHaveCount(0)
  await expect(status).toBeFocused()
  const refresh = page.getByRole('button', { name: 'Refresh history', exact: true })
  await refresh.focus()
  await page.keyboard.press('Enter')
  await expect(row('01')).toBeVisible()
  await expect(status).toBeFocused()
  await refresh.click()
  await expect(row('01')).toBeVisible()
  await expect(status).not.toBeFocused()
  // These history-only fixtures intentionally have no saved game document.
  // A failed detail fetch must still leave retry and dismissal usable.
  await page.setViewportSize({ width: 320, height: 480 })
  await row('01').click()
  await expect(page.getByText('Could not load this result. Please try again.', { exact: true })).toBeVisible()
  const retry = page.getByRole('button', { name: 'Retry', exact: true })
  const close = page.getByRole('button', { name: 'Close', exact: true })
  await retry.scrollIntoViewIfNeeded()
  await expect(retry).toBeInViewport({ ratio: 1 })
  await expect(close).toBeInViewport({ ratio: 1 })
  const retryBox = await retry.boundingBox()
  const closeBox = await close.boundingBox()
  expect(retryBox.y + retryBox.height).toBeLessThanOrEqual(closeBox.y)
  await retry.focus()
  await page.keyboard.press('Enter')
  await expect(retry).toBeVisible()
  await expect(page.getByRole('group', { name: 'Saved result', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(retry).toBeFocused()
  await retry.click()
  await expect(retry).toBeVisible()
  await expect(page.getByRole('group', { name: 'Saved result', exact: true })).not.toBeFocused()
  await close.click()
  await expect(row('01')).toBeVisible()
  expect(observed.errors).toEqual([])
})
