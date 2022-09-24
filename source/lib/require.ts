import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)   // <pkg>/lib/require.js
const __dirname  = path.dirname(__filename)         // <pkg>/lib
const __pkgpath  = path.dirname(__dirname)          // <pkg>

export const require = createRequire(path.join(__pkgpath, 'package.json'))
