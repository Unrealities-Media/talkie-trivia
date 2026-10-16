import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { trackPageErrors } from './page-errors.mjs'
const cancellation = '/127.0.0.2:8080/google.firestore.v1.Firestore/Listen/channel?RID=rpc due to access control checks.'

test('only exact WebKit emulator cancellations during reload are classified separately', async () => {
  const page = new EventEmitter()
  page.reload = async () => {
    page.emit('pageerror', new Error(cancellation))
    page.emit('pageerror', new Error('Application crashed'))
    page.emit('pageerror', new Error(cancellation.replace('127.0.0.2:8080', 'firestore.googleapis.com')))
  }
  const observed = trackPageErrors(page, 'webkit')
  page.emit('pageerror', new Error(cancellation))
  await observed.reload()
  page.emit('pageerror', new Error(cancellation))
  assert.deepEqual(observed.reloadCancellations, [cancellation])
  assert.equal(observed.errors.length, 4)
})

test('other engines and errors after a failed reload remain failures', async () => {
  const page = new EventEmitter()
  page.reload = async () => { page.emit('pageerror', new Error(cancellation)); throw new Error('Navigation failed') }
  const observed = trackPageErrors(page, 'firefox')
  await assert.rejects(observed.reload(), /Navigation failed/)
  page.emit('pageerror', new Error(cancellation))
  assert.deepEqual(observed.errors, [cancellation, cancellation])
  assert.deepEqual(observed.reloadCancellations, [])
})
