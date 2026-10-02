import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'

const privatePath = new URL('../src/data/native-premium.json', import.meta.url)
const catalog = existsSync(privatePath) ? JSON.parse(await readFile(privatePath, 'utf8')) : null
const phrases = catalog ? [...catalog.uk, ...catalog.en]
  .map((course) => course.theory?.summary)
  .filter((phrase) => typeof phrase === 'string' && phrase.length >= 48) : []
if (catalog && (phrases.length !== 98 || new Set(phrases).size !== 98)) {
  throw new Error('Expected 98 distinct premium summaries to verify the web bundle.')
}

const graph = await build({ entryPoints: ['src/App.tsx'], bundle: true, format: 'esm', write: false, metafile: true, logLevel: 'silent' })
if (Object.keys(graph.metafile.inputs).some((path) => /native-premium|generate-premium/.test(path))) {
  throw new Error('Private lessons are imported into the web app.')
}

const root = process.argv[2]
if (!root) throw new Error('Usage: node scripts/verify-no-premium-web.mjs <web-directory>')

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await check(path)
    } else if (/\.(js|json|html|map)$/.test(entry.name)) {
      const text = await readFile(path, 'utf8')
      if (entry.name.includes('premium') || text.includes('native-premium.json') || phrases.some((phrase) => text.includes(phrase))) {
        throw new Error(`Premium lesson content found in web assets: ${path}`)
      }
    }
  }
}

await check(root)
console.log(`Verified private-content imports and assets are absent from ${root}${catalog ? '; checked all 98 private summaries.' : '; private-summary comparison skipped (private repository not present).'}`)
