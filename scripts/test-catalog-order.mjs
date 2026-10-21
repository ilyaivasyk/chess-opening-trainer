import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/data/catalog.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { getCatalog } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const ids = (courses) => courses.map((course) => course.id)
const unconventional = new Set(['bird', 'grob', 'larsen', 'polish', 'kings-gambit', 'budapest', 'benko-gambit', 'danish', 'stafford', 'owens', 'alekhine', 'trompowsky', 'marshall-attack'])
const firstAvailable = { beginner: 'italian', intermediate: 'ruy-lopez', advanced: 'kings-indian' }

for (const locale of ['uk', 'en']) {
  const original = getCatalog(locale, true)
  assert.equal(original[0].id, 'danish', 'unlocked beginner catalog retains its source order')
  assert.equal(original.find((course) => course.category === 'intermediate').id, 'stafford', 'unlocked intermediate catalog retains its source order')
  for (const category of ['beginner', 'intermediate', 'advanced']) {
    for (const onlyUnconventional of [false, true]) {
      const matches = (course) => course.category === category && (!onlyUnconventional || unconventional.has(course.id))
      const available = original.filter((course) => matches(course) && course.access === 'free')
      const upcoming = original.filter((course) => matches(course) && course.access !== 'free')
      const visible = getCatalog(locale).filter(matches)
      assert.deepEqual(ids(visible), ids([...available, ...upcoming]), `${locale}/${category}: available first, stable order within each group`)
      assert.deepEqual(ids(getCatalog(locale, true).filter(matches)), ids(original.filter(matches)), 'unlocked catalogs retain their original order')
      if (!onlyUnconventional) assert.equal(visible[0].id, firstAvailable[category], 'category selection must start with a playable course')
    }
  }
  assert.deepEqual(ids(getCatalog(locale, true)), ids(original), 'sorting must not mutate the source order')
}
assert.deepEqual(ids(getCatalog('uk')), ids(getCatalog('en')), 'language changes must preserve course order')
console.log('✓ Catalog order: available-first, stable groups, category/filter selection, both languages and unlocked catalogs')
