import fs from 'node:fs'
import { Chess } from 'chess.js'
import { build } from 'esbuild'

const built = await build({ entryPoints: ['src/data/courses.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { getCatalog, getCourses, freeCourseIds } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`)
const catalogUk = getCatalog('uk')
const catalogEn = getCatalog('en')
const freeUk = getCourses('uk')
const freeEn = getCourses('en')
const nativePath = 'src/data/native-premium.json'
const native = fs.existsSync(nativePath) ? JSON.parse(fs.readFileSync(nativePath, 'utf8')) : { uk: [], en: [] }

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
function textFilled(value, where) {
  assert(typeof value === 'string' && value.trim().length > 0, `${where}: empty text`)
}
function compareContent(uk, en, where) {
  assert(uk.length === en.length, `${where}: locale count differs`)
  const english = new Map(en.map((course) => [course.id, course]))
  for (const course of uk) {
    const other = english.get(course.id)
    assert(other && other.category === course.category, `${where}/${course.id}: missing English course`)
    assert(course.theory.whiteGoals.length === other.theory.whiteGoals.length, `${where}/${course.id}: white-goal count differs by locale`)
    assert(course.theory.blackGoals.length === other.theory.blackGoals.length, `${where}/${course.id}: black-goal count differs by locale`)
    assert(course.theory.keySquares.map((item) => item.square).join(',') === other.theory.keySquares.map((item) => item.square).join(','), `${where}/${course.id}: key-square coverage differs by locale`)
    assert(course.variants.map((item) => item.id).join(',') === other.variants.map((item) => item.id).join(','), `${where}/${course.id}: variant IDs differ by locale`)
    for (const localized of [course, other]) {
      textFilled(localized.name, `${where}/${course.id}/name`)
      const theory = localized.theory
      for (const field of ['history', 'summary', 'warning']) textFilled(theory[field], `${where}/${course.id}/${field}`)
      for (const field of ['whiteGoals', 'blackGoals']) {
        assert(theory[field].length >= 2, `${where}/${course.id}/${field}: too few goals`)
        theory[field].forEach((goal, i) => textFilled(goal, `${where}/${course.id}/${field}/${i}`))
      }
      assert(theory.keySquares.length > 0, `${where}/${course.id}: no key square`)
      for (const square of theory.keySquares) {
        assert(/^[a-h][1-8]$/.test(square.square), `${where}/${course.id}: invalid key square`)
        textFilled(square.idea, `${where}/${course.id}/key square`)
      }
      assert(localized.variants[0]?.id === 'all', `${where}/${course.id}: missing all variant`)
      for (const side of ['scenarios', 'blackScenarios']) {
        assert(localized[side].length > 0, `${where}/${course.id}: no ${side}`)
        for (const scenario of localized[side]) {
          textFilled(scenario.name, `${where}/${course.id}/${scenario.id}/name`)
          assert(scenario.steps.length >= 3, `${where}/${course.id}/${scenario.id}: too short`)
          assert(localized.variants.some((v) => v.id !== 'all' && scenario.id.includes(v.id)), `${where}/${course.id}/${scenario.id}: no variant`)
          if (side === 'blackScenarios') assert(scenario.initialMove, `${where}/${course.id}/${scenario.id}: no first white move`)
          const game = new Chess()
          const play = (uci, expected, index) => {
            assert(/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci), `${where}/${course.id}/${scenario.id}/${index}: invalid UCI ${uci}`)
            assert(game.turn() === expected, `${where}/${course.id}/${scenario.id}/${index}: wrong color`)
            try { game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' }) }
            catch { throw new Error(`${where}/${course.id}/${scenario.id}/${index}: illegal ${uci}`) }
          }
          if (scenario.initialMove) {
            play(scenario.initialMove, 'w', 'initial')
            textFilled(scenario.initialExplanation, `${where}/${course.id}/${scenario.id}/initial`)
          }
          for (const [i, step] of scenario.steps.entries()) {
            textFilled(step.title, `${where}/${course.id}/${scenario.id}/${i}/title`)
            textFilled(step.explanation, `${where}/${course.id}/${scenario.id}/${i}/explanation`)
            textFilled(step.opponentExplanation, `${where}/${course.id}/${scenario.id}/${i}/opponent`)
            play(step.userMove, side === 'scenarios' ? 'w' : 'b', i)
            play(step.opponentMove, side === 'scenarios' ? 'b' : 'w', i)
          }
        }
      }
    }
    for (const side of ['scenarios', 'blackScenarios']) {
      const otherScenarios = new Map(other[side].map((s) => [s.id, s]))
      assert(course[side].length === other[side].length, `${where}/${course.id}/${side}: locale scenario count differs`)
      for (const scenario of course[side]) {
        const matching = otherScenarios.get(scenario.id)
        assert(matching && matching.initialMove === scenario.initialMove, `${where}/${course.id}/${scenario.id}: locale initial move differs`)
        assert(matching.steps.length === scenario.steps.length, `${where}/${course.id}/${scenario.id}: locale step count differs`)
        scenario.steps.forEach((step, i) => {
          assert(step.userMove === matching.steps[i].userMove && step.opponentMove === matching.steps[i].opponentMove, `${where}/${course.id}/${scenario.id}/${i}: locale moves differ`)
        })
      }
    }
  }
}

assert(catalogUk.length === 60 && catalogEn.length === 60, 'Catalog must contain 60 entries in each locale')
const counts = { beginner: 0, intermediate: 0, advanced: 0 }
const ids = new Set()
for (const [i, entry] of catalogUk.entries()) {
  const other = catalogEn[i]
  assert(entry.id === other.id && entry.category === other.category && entry.eco === other.eco && entry.access === other.access, `Catalog locale parity: ${entry.id}`)
  assert(!ids.has(entry.id), `Duplicate catalog id ${entry.id}`)
  ids.add(entry.id)
  counts[entry.category]++
  assert(/^[A-E][0-9]{2}$/.test(entry.eco), `${entry.id}: invalid ECO`)
  assert(entry.source === `https://github.com/lichess-org/chess-openings/blob/master/${entry.eco[0].toLowerCase()}.tsv`, `${entry.id}: source mismatch`)
  textFilled(entry.name, `${entry.id}/uk name`)
  textFilled(other.name, `${entry.id}/en name`)
}
for (const category of Object.keys(counts)) assert(counts[category] === 20, `${category}: expected 20, got ${counts[category]}`)
assert(freeCourseIds.length === 11 && new Set(freeCourseIds).size === 11, 'Expected 11 unique free IDs')
assert(freeUk.length === 11 && freeEn.length === 11, 'Expected 11 free course lessons')
for (const id of freeCourseIds) assert(catalogUk.find((entry) => entry.id === id)?.access === 'free' && freeUk.some((course) => course.id === id), `Missing free course ${id}`)
for (const entry of catalogUk) assert((entry.access === 'free') === freeCourseIds.includes(entry.id), `${entry.id}: access mismatch`)
for (const [locale, lessons, catalog] of [['uk', freeUk, catalogUk], ['en', freeEn, catalogEn]]) {
  for (const lesson of lessons) assert(catalog.find((entry) => entry.id === lesson.id)?.name === lesson.name, `${locale}/${lesson.id}: catalog and lesson names differ`)
}
compareContent(freeUk, freeEn, 'free')

if (fs.existsSync(nativePath)) {
  assert(native.uk.length === 49 && native.en.length === 49, 'Expected 49 premium courses in native asset')
  for (const entry of catalogUk.filter((entry) => entry.access === 'premium')) assert(native.uk.some((course) => course.id === entry.id), `Missing native course ${entry.id}`)
  for (const [locale, lessons, catalog] of [['uk', native.uk, catalogUk], ['en', native.en, catalogEn]]) {
    for (const lesson of lessons) assert(catalog.find((entry) => entry.id === lesson.id)?.name === lesson.name, `${locale}/${lesson.id}: catalog and native names differ`)
  }
  compareContent(native.uk, native.en, 'premium')
  console.log('✓ 60 catalog entries; 11 free and 49 native courses; all UK/EN lines legal and aligned')
} else if (process.argv.includes('--require-native')) {
  throw new Error(`Missing private native asset ${nativePath}`)
} else {
  console.log('✓ 60 catalog entries and 11 free courses; private native asset absent (premium lesson audit skipped)')
}
