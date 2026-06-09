import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'
import {
  createStaticServer,
  projectRootFromImportMeta,
} from './lib/static-server.js'

const root = projectRootFromImportMeta(import.meta.url)
const publicDir = path.join(root, 'public')
const outputPath = path.join(publicDir, 'calling-card', 'rafael-pascual.png')

const CARD_WIDTH = 1050
const CARD_HEIGHT = 600

async function main() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  const { server, port } = await createStaticServer(publicDir)
  const url = `http://127.0.0.1:${port}/calling-card/`

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      deviceScaleFactor: 1,
    })

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 })
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
    })

    const card = await page.$('[aria-label="Calling card"]')
    if (!card) {
      throw new Error('Calling card element not found')
    }

    await card.screenshot({ path: outputPath, type: 'png' })
    console.log(`Wrote ${path.relative(root, outputPath)}`)
  } finally {
    await browser.close()
    server.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
