import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const publicDir = path.join(root, 'public')
const outDir = path.join(publicDir, 'brochure', 'png')

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

const EXPORTS = [
  { selector: '[aria-label="Brochure outside"]', file: 'brochure-outside.png' },
  { selector: '[aria-label="Brochure inside"]', file: 'brochure-inside.png' },
  { selector: '[aria-label="One-page flyer"]', file: 'brochure-flyer.png' },
]

function createStaticServer(dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname)
        let filePath = path.join(dir, pathname === '/' ? 'index.html' : pathname)

        if (pathname.endsWith('/')) {
          filePath = path.join(filePath, 'index.html')
        }

        const normalized = path.normalize(filePath)
        if (!normalized.startsWith(dir)) {
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

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  const { server, port } = await createStaticServer(publicDir)
  const url = `http://127.0.0.1:${port}/brochure/`

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: 1200,
      height: 900,
      deviceScaleFactor: 2,
    })

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 })
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
    })

    await page.addStyleTag({
      content: `
        .toolbar,
        .brochure-note,
        .sheet-label,
        .png-links {
          display: none !important;
        }
        body {
          background: #fff !important;
        }
        .brochure-wrap {
          margin: 0 !important;
          padding: 0 !important;
          max-width: none !important;
        }
        .sheet,
        .flyer {
          box-shadow: none !important;
          border-radius: 0 !important;
        }
      `,
    })

    for (const { selector, file } of EXPORTS) {
      const element = await page.$(selector)
      if (!element) {
        throw new Error(`Brochure section not found: ${selector}`)
      }
      const outputPath = path.join(outDir, file)
      await element.screenshot({ path: outputPath, type: 'png' })
      console.log(`Wrote ${path.relative(root, outputPath)}`)
    }

    const fullPath = path.join(outDir, 'brochure-full.png')
    await page.screenshot({ path: fullPath, fullPage: true, type: 'png' })
    console.log(`Wrote ${path.relative(root, fullPath)}`)
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`\nBrochure PNGs exported to public/brochure/png/`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
