import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

if (process.env.TALKIE_BROWSER_TEST !== '1') throw Error('Use npm --prefix integration run test:browser')
const root = resolve(process.env.TALKIE_BROWSER_BUILD)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json' }
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
    let file = resolve(root, `.${pathname}`)
    if (file !== root && !file.startsWith(root + sep)) { response.writeHead(403).end(); return }
    if (!(await stat(file).catch(() => null))?.isFile()) {
      if (extname(pathname)) { response.writeHead(404).end(); return }
      file = resolve(root, 'index.html')
    }
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(await readFile(file))
  } catch { response.writeHead(500).end() }
}).listen(4173, '127.0.0.1')
