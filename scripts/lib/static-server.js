import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

export function createStaticServer(dir) {
  const root = path.resolve(dir)

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname)
        let filePath = path.join(root, pathname === '/' ? 'index.html' : pathname)

        if (pathname.endsWith('/')) {
          filePath = path.join(filePath, 'index.html')
        }

        const normalized = path.normalize(filePath)
        if (!normalized.startsWith(root)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        if (!fs.existsSync(normalized) || fs.statSync(normalized).isDirectory()) {
          res.writeHead(404)
          res.end('Not found')
          return
        }

        const ext = path.extname(normalized).toLowerCase()
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream',
        })
        fs.createReadStream(normalized).pipe(res)
      } catch (error) {
        res.writeHead(500)
        res.end(String(error))
      }
    })

    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, port: address.port })
    })
  })
}

export function projectRootFromImportMeta(importMetaUrl) {
  return path.join(path.dirname(fileURLToPath(importMetaUrl)), '..')
}
