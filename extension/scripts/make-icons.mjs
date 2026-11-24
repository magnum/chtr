import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'icons')
const source = readFileSync(
  join(root, 'node_modules/@heroicons/vue/24/outline/ChatBubbleBottomCenterIcon.js'),
  'utf8',
)
const glyph = source.match(/d: "([^"]+)"/)?.[1]
if (!glyph) {
  throw new Error('Icona chat-bubble-bottom-center non trovata in @heroicons/vue.')
}

function svg(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <path d="${glyph}" fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

mkdirSync(outDir, { recursive: true })
for (const size of [16, 32, 48, 128]) {
  const svgFile = join(tmpdir(), `chtr-icon-${size}.svg`)
  const file = join(outDir, `icon${size}.png`)
  writeFileSync(svgFile, svg(size))
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), svgFile, '-o', file])
  rmSync(svgFile)
  console.log(file)
}
