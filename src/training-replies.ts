import { Chess } from 'chess.js'
import type { Course } from './data/courses'

/** Reuse the course's legal position tree for alternative opponent replies. */
export function buildTrainingReplies(course: Course, color: 'w' | 'b') {
  const replies = new Map<string, { scenario: Course['scenarios'][number]; stepIndex: number }[]>()
  for (const scenario of color === 'w' ? course.scenarios : course.blackScenarios) {
    const position = new Chess()
    const play = (uci: string) => position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    if (scenario.initialMove) play(scenario.initialMove)
    scenario.steps.forEach((step, stepIndex) => {
      play(step.userMove)
      if (!step.opponentMove) return
      const key = position.fen().split(' ').slice(0, 4).join(' ')
      const choices = replies.get(key) ?? []
      if (!choices.some((choice) => choice.scenario.steps[choice.stepIndex].opponentMove === step.opponentMove)) {
        choices.push({ scenario, stepIndex })
        replies.set(key, choices)
      }
      play(step.opponentMove)
    })
  }
  return replies
}
