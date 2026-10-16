// WebKit misclassifies requests cancelled during document replacement:
// https://github.com/microsoft/playwright/issues/43120
// Keep this exception restricted to explicit reloads and local Firestore channels.
export function trackPageErrors(page, browserName) {
  const errors = []
  const reloadCancellations = []
  let reloading = false
  page.on('pageerror', error => {
    const message = error.message
    if (browserName === 'webkit' && reloading &&
      /^(?:Fetch API cannot load http:\/\/|\/)127\.0\.0\.2:8080\/google\.firestore\.v1\.Firestore\/(?:Listen|Write)\/channel\?[^\s]+ due to access control checks\.$/.test(message)) {
      reloadCancellations.push(message)
    } else errors.push(message)
  })
  return {
    errors,
    reloadCancellations,
    async reload() {
      reloading = true
      try { await page.reload() } finally { reloading = false }
    },
  }
}
