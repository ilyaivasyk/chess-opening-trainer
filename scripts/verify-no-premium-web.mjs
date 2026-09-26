import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const catalog = JSON.parse(await readFile(new URL('../src/data/native-premium.json', import.meta.url), 'utf8'))
const phrases = [...catalog.uk, ...catalog.en]
  .map((course) => course.theory?.summary)
  .filter((phrase) => typeof phrase === 'string' && phrase.length >= 48)
if (phrases.length !== 98 || new Set(phrases).size !== 98) {
  throw new Error('Expected 98 distinct premium summaries to verify the web bundle.')
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
      if (entry.name.includes('premium') || phrases.some((phrase) => text.includes(phrase))) {
        throw new Error(`Premium lesson content found in web assets: ${path}`)
      }
    }
  }
}

await check(root)
console.log(`Verified premium lesson content is absent from ${root}.`)
