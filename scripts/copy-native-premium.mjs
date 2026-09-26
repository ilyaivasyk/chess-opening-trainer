import { copyFile, readFile } from 'node:fs/promises'

const source = new URL('../src/data/native-premium.json', import.meta.url)
const destination = new URL('../ios/App/App/native-premium.json', import.meta.url)
let raw
try {
  raw = await readFile(source, 'utf8')
} catch {
  throw new Error('Missing private premium catalog at src/data/native-premium.json. Obtain it from the private content repository before running ios:sync.')
}
const catalog = JSON.parse(raw)

for (const locale of ['uk', 'en']) {
  if (!Array.isArray(catalog[locale]) || catalog[locale].length !== 49) {
    throw new Error(`Native premium catalog must contain 49 ${locale} courses.`)
  }
}

const ids = (locale) => catalog[locale].map(({ id }) => id).sort().join(',')
if (ids('uk') !== ids('en')) {
  throw new Error('Native premium course IDs differ between locales.')
}

await copyFile(source, destination)
console.log(`Copied ${catalog.uk.length} bilingual premium courses into the iOS app bundle.`)
