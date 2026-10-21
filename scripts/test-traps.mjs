import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Chess } from 'chess.js'

const bundle = await build({ entryPoints: ['src/traps.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { TRAPS, buildTrap } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const balance = (fen) => new Chess(fen).board().flat().reduce((sum, piece) => sum + (piece ? ({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[piece.type]) * (piece.color === 'w' ? 1 : -1) : 0), 0)
const freeCourses = ['italian', 'london', 'queens-gambit', 'caro-kann', 'qgd', 'ruy-lopez', 'sicilian', 'english', 'kings-indian', 'nimzo-indian', 'grunfeld']
assert.equal(TRAPS.length, 11)
assert.equal(new Set(TRAPS.map((lesson) => lesson.id)).size, TRAPS.length)
assert.deepEqual(TRAPS.map((lesson) => lesson.courseId).sort(), freeCourses.sort(), 'every publicly available course has one trap lesson')
for (const lesson of TRAPS) {
  for (const key of ['name', 'why', 'punishmentIdea', 'avoidanceIdea']) for (const locale of ['uk', 'en']) assert.ok(lesson[key][locale].trim(), `${lesson.id} ${key} ${locale}`)
  assert.ok(lesson.sources.length)
  for (const source of lesson.sources) { assert.ok(source.title); assert.equal(new URL(source.url).protocol, 'https:') }
  const trap = buildTrap(lesson)
  assert.equal(trap.avoid.fens[0], trap.beforeFen, 'avoidance starts before the opponent mistake, with the roles switched')
  assert.equal(trap.punish.fens[0], trap.mistake.after)
  assert.equal(trap.mistake.before, trap.beforeFen)
  assert.equal(trap.punish.moves[0].color, trap.mistake.color === 'w' ? 'b' : 'w')
  assert.equal(trap.avoid.moves[0].color, trap.mistake.color)
  assert.notEqual(trap.avoid.moves[0].san, trap.mistake.san)
  for (const line of [trap.punish, trap.avoid]) {
    assert.equal(line.fens.length, line.moves.length + 1)
    assert.ok(line.moves.length >= 1)
    const game = new Chess(line.fens[0])
    for (const [index, move] of line.moves.entries()) {
      game.move(move.san, { strict: true })
      assert.equal(game.fen(), line.fens[index + 1])
    }
  }
  const final = new Chess(trap.punish.fens.at(-1))
  if (lesson.payoff === 'mate') { assert.ok(final.isCheckmate(), lesson.id); assert.equal(final.turn(), trap.mistake.color) }
  else {
    const gain = (balance(final.fen()) - balance(trap.beforeFen)) * (trap.mistake.color === 'w' ? -1 : 1)
    assert.equal(gain, lesson.materialGain, `${lesson.id}: gain measured from before the mistake`)
    assert.ok(gain > 0)
  }
  assert.ok(!new Chess(trap.avoid.fens.at(-1)).isCheckmate(), 'the safe alternative must not end in checkmate')
}
console.log('✓ 11 bilingual trap lessons: strict SAN, both roles, correct starting positions, mate/material outcomes and source links')
