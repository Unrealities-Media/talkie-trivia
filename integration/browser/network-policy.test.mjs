import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowedRequest } from './network-policy.mjs'

test('browser isolation rejects live auth and functions before sending credentials', () => {
  for (const url of [
    'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
    'https://us-central1-talkie-trivia-beta.cloudfunctions.net/startGame',
    'https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel',
    'http://127.0.0.1:9099/accounts',
    'http://127.0.0.2:9999/accounts',
    'http://127.0.0.2.evil.example:9099/accounts',
  ]) assert.equal(allowedRequest(url, 'fetch'), false)
  assert.equal(allowedRequest('http://127.0.0.2:9099/accounts', 'fetch'), true)
  assert.equal(allowedRequest('http://127.0.0.1:4173/game', 'document'), true)
  assert.equal(allowedRequest('https://image.tmdb.org/t/p/w500/poster.jpg', 'image'), true)
  assert.equal(allowedRequest('https://image.tmdb.org/api', 'fetch'), false)
})
