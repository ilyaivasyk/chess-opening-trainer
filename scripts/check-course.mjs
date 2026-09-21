import fs from 'node:fs'
import { Chess } from 'chess.js'

const course = JSON.parse(fs.readFileSync(new URL('../src/data/italian.json', import.meta.url), 'utf8'))

for (const scenario of [...course.scenarios, ...course.blackScenarios]) {
  const game = new Chess()
  if (scenario.initialMove) {
    const uci = scenario.initialMove
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' })
    if (!move) throw new Error(`${scenario.id}: нелегальний початковий хід ${uci}`)
  }
  for (const [index, step] of scenario.steps.entries()) {
    for (const [side, uci] of [['user', step.userMove], ['opponent', step.opponentMove]]) {
      const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' })
      if (!move) throw new Error(`${scenario.id}, крок ${index + 1}: нелегальний ${side} хід ${uci}`)
    }
  }
  console.log(`✓ ${scenario.name}: ${scenario.steps.length} навчальних ходів`)
}
