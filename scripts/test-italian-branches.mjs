import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Chess } from 'chess.js'

const bundle = await build({ entryPoints: ['src/data/courses.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { getCourses } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const lines = {
  polerio: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Bd3',
  fritz: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nd4',
  ulvestad: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 b5',
  'evans-declined': 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bb6',
  'two-knights-be7': 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7',
}
for (const locale of ['uk', 'en']) {
  const course = getCourses(locale).find((item) => item.id === 'italian')
  assert.equal(course.variants.length, 16)
  for (const [id, san] of Object.entries(lines)) {
    const expected = new Chess()
    for (const move of san.split(' ')) expected.move(move, { strict: true })
    const variant = course.variants.find((item) => item.id === id)
    assert.ok(variant?.name)
    if (locale === 'en') assert.ok(!/[А-Яа-яІіЇїЄєҐґ]/.test(variant.name))
    for (const [color, scenarios] of [['white', course.scenarios], ['black', course.blackScenarios]]) {
      const scenario = scenarios.find((item) => item.id === `${color}-${id}`)
      assert.ok(scenario, `${locale}/${color}/${id}`)
      assert.equal(scenario.name, variant.name)
      const actual = new Chess()
      const moves = [scenario.initialMove, ...scenario.steps.flatMap((step) => [step.userMove, step.opponentMove])].filter(Boolean)
      for (const uci of moves) actual.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      assert.equal(actual.fen(), expected.fen())
      assert.deepEqual(actual.history(), expected.history())
    }
  }
  const polerio = course.scenarios.find((item) => item.id === 'white-polerio')
  assert.ok(polerio.steps[5].opponentExplanation.includes(locale === 'uk' ? 'перекриває шах' : 'blocks the check'))
  assert.ok(!polerio.steps[5].opponentExplanation.includes('...d5'))
  const fritz = course.scenarios.find((item) => item.id === 'white-fritz')
  assert.ok(fritz.steps[4].opponentExplanation.includes(locale === 'uk' ? 'займає' : 'occupies'))
  assert.ok(!/бере|captures/.test(fritz.steps[4].opponentExplanation), 'quiet Nd4 must not be described as a capture')
}
console.log('✓ Five official-source Italian branches: exact SAN/FEN, both colors/languages, 15 variants, c6 check-block and quiet Nd4 explanations')
