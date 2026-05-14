import fsExtra from 'fs-extra'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const { copySync, removeSync } = fsExtra

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dest = join(root, 'public', 'tinymce')

removeSync(dest)
copySync(join(root, 'node_modules', 'tinymce'), dest)

console.log('TinyMCE copied to public/tinymce')
