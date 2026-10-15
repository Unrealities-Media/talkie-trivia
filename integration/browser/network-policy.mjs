const origins = new Set([
  'http://127.0.0.1:4173',
  'http://127.0.0.2:9099',
  'http://127.0.0.2:8080',
  'http://127.0.0.2:5001',
])

export function allowedRequest(url, resourceType) {
  const parsed = new URL(url)
  return origins.has(parsed.origin) ||
    (resourceType === 'image' && parsed.origin === 'https://image.tmdb.org')
}
