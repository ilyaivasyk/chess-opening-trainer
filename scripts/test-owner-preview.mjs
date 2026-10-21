import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { runtimeLicenses } from './runtime-licenses.mjs'
const courses = JSON.parse(await readFile('src/data/native-premium.json', 'utf8'))
const assets = await readdir('dist-owner-preview/assets')
const scripts = (await Promise.all(assets.filter((name) => name.endsWith('.js')).map((name) => readFile(`dist-owner-preview/assets/${name}`, 'utf8')))).join('\n')
for (const locale of ['uk', 'en']) for (const course of courses[locale]) {
  assert(scripts.includes(course.theory.summary), `${locale}/${course.id}: missing preview course`)
}
assert((await readFile('dist-owner-preview/sw.js','utf8')).includes("const RELEASE = 'v54-owner'"))
assert((await readFile('dist/sw.js','utf8')).includes("const RELEASE = 'v54'"))
for (const directory of ['dist', 'dist-owner-preview']) {
  assert.equal(await readFile(`${directory}/THIRD_PARTY_LICENSES.txt`, 'utf8'), runtimeLicenses(), `${directory}: incomplete runtime notices`)
}
console.log(`✓ All ${courses.uk.length} private courses in both languages are included in the explicit owner preview; cache release is distinct; runtime notices are complete`)
