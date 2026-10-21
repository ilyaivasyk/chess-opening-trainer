import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Chess } from 'chess.js'

const bundle = await build({ stdin: { contents: "export { buildTrainingReplies } from '../src/training-replies'; export { getCourses } from '../src/data/courses'", resolveDir: new URL('.', import.meta.url).pathname }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { buildTrainingReplies, getCourses } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const key = (position) => position.fen().split(' ').slice(0, 4).join(' ')
const play = (position, uci) => position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
const signatures = new Map()
let branches = 0

for (const locale of ['uk', 'en']) for (const course of getCourses(locale)) for (const color of ['w', 'b']) {
  const replies = buildTrainingReplies(course, color)
  const scenarios = color === 'w' ? course.scenarios : course.blackScenarios
  for (const scenario of scenarios) {
    const position = new Chess()
    if (scenario.initialMove) play(position, scenario.initialMove)
    for (const step of scenario.steps) {
      assert.equal(play(position, step.userMove).color, color, `${course.id}/${scenario.id}: user side`)
      if (!step.opponentMove) continue
      assert.ok(replies.get(key(position))?.some((choice) => choice.scenario.steps[choice.stepIndex].opponentMove === step.opponentMove), `${course.id}/${scenario.id}: missing course reply`)
      assert.notEqual(play(position, step.opponentMove).color, color)
    }
  }
  for (const [positionKey, choices] of replies) {
    assert.equal(new Set(choices.map(({ scenario, stepIndex }) => scenario.steps[stepIndex].opponentMove)).size, choices.length, 'duplicate responses must not bias random selection')
    for (const { scenario, stepIndex } of choices) {
      assert.ok(scenarios.includes(scenario), 'branch must belong to the selected course and color')
      const position = new Chess()
      if (scenario.initialMove) play(position, scenario.initialMove)
      for (const [index, step] of scenario.steps.entries()) {
        assert.equal(play(position, step.userMove).color, color)
        if (index === stepIndex) assert.equal(key(position), positionKey, 'branch index must match the position where its reply is offered')
        if (step.opponentMove) assert.notEqual(play(position, step.opponentMove).color, color)
      }
      branches++
    }
  }
  const signature = JSON.stringify([...replies].map(([positionKey, choices]) => [positionKey, choices.map(({ scenario, stepIndex }) => scenario.steps[stepIndex].opponentMove).sort()]).sort())
  const id = `${course.id}/${color}`
  if (locale === 'uk') signatures.set(id, signature)
  else assert.equal(signature, signatures.get(id), 'translation must preserve opponent choices')
}

const italian = getCourses('en').find((course) => course.id === 'italian')
const offered = (color, pgn) => {
  const position = new Chess()
  position.loadPgn(pgn)
  return buildTrainingReplies(italian, color).get(key(position)).map(({ scenario, stepIndex }) => scenario.steps[stepIndex].opponentMove)
}
for (const uci of ['f8c5', 'g8f6']) assert.ok(offered('w', '1. e4 e5 2. Nf3 Nc6 3. Bc4').includes(uci), `Italian White must offer ${uci}`)
for (const uci of ['f3g5', 'd2d3', 'd2d4']) assert.ok(offered('b', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6').includes(uci), `Italian Black must offer ${uci}`)
console.log(`✓ ${getCourses('en').length} public courses, both colors/languages: ${branches} legal continuation branches, matching indices, complete distinct replies; Italian Bc5/Nf6 and Ng5/d3/d4 alternatives`)
