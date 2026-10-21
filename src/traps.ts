import { Chess } from 'chess.js'
import type { Locale } from './i18n/locale'
import lessons from './data/traps.json'

type Text = Record<Locale, string>
export type TrapLesson = {
  id: string
  courseId: string
  name: Text
  setup: string[]
  mistake: string
  punish: string[]
  avoid: string[]
  why: Text
  punishmentIdea: Text
  avoidanceIdea: Text
  payoff: 'mate' | 'material'
  materialGain: number
  sources: { title: string; url: string }[]
}

export const TRAPS = lessons as TrapLesson[]

function lineFrom(fen: string, san: string[]) {
  const position = new Chess(fen)
  const fens = [fen]
  const moves = san.map((move) => {
    const played = position.move(move, { strict: true })
    fens.push(position.fen())
    return played
  })
  return { moves, fens }
}

export function buildTrap(trap: TrapLesson) {
  const position = new Chess()
  for (const move of trap.setup) position.move(move, { strict: true })
  const beforeFen = position.fen()
  const mistake = position.move(trap.mistake, { strict: true })
  return {
    beforeFen, mistake,
    punish: lineFrom(position.fen(), trap.punish),
    avoid: lineFrom(beforeFen, trap.avoid),
  }
}
