import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
const courses = JSON.parse(await readFile('src/data/native-premium.json', 'utf8'))
const assets = await readdir('dist-owner-preview/assets')
const scripts = (await Promise.all(assets.filter((name) => name.endsWith('.js')).map((name) => readFile(`dist-owner-preview/assets/${name}`, 'utf8')))).join('\n')
for (const locale of ['uk', 'en']) for (const course of courses[locale]) {
  assert(scripts.includes(course.theory.summary), `${locale}/${course.id}: missing preview course`)
}
assert((await readFile('dist-owner-preview/sw.js','utf8')).includes("const RELEASE = 'v32-owner'"))
assert((await readFile('dist/sw.js','utf8')).includes("const RELEASE = 'v32'"))
console.log('✓ All 50 private courses in both languages are included only in the explicit owner preview; cache release is distinct')
