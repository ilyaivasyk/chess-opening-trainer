import { Chess, type Move, type Square } from 'chess.js'
import type { EngineAnalysis, EngineStrength, EngineHistory } from './stockfish'
import { classifyMove } from './vendor/brilliant-chess'

export type AnalysisLabel = 'brilliant' | 'best' | 'excellent' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'
export type MoveQuality = { cpLoss: number; accuracy: number; winDrop: number }

export type GameMoveRecord = {
  ply: number
  actor: 'player' | 'engine' | 'course'
  color: 'w' | 'b'
  san: string
  uci: string
  from: Square
  to: Square
  captured?: Move['captured']
  fenBefore: string
  fenAfter: string
  bookMove: boolean
  openingName: string
  openingExplanation?: string
  openingNote?: { kind: 'f7' } | { kind: 'deviation'; stepIndex: number }
}

export type AnalysedMove = GameMoveRecord & MoveQuality & {
  bestMove: string
  bestMoveSan: string
  principalVariationSan: string[]
  principalVariationFens: string[]
  principalVariationUci: string[]
  consequenceVariationSan: string[]
  consequenceVariationFens: string[]
  consequenceVariationUci: string[]
  mistakeExplanation: { uk: string; en: string }
  beforeEvaluationCp: number
  evaluationCp: number
  label: AnalysisLabel
}

type AnalysePosition = (fen: string, strength: EngineStrength, moveTime: number, history?: EngineHistory) => Promise<EngineAnalysis>
type AnalysisOptions = {
  isCancelled?: () => boolean
  onProgress?: (items: AnalysedMove[], progress: number) => void
}

export function winPercent(centipawns: number) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1000, Math.min(1000, centipawns)))) - 1)
}

export function lichessMoveAccuracy(winDrop: number) {
  if (winDrop <= 0) return 100
  return Math.max(0, Math.min(100, 103.1668100711649 * Math.exp(-0.04354415386753951 * winDrop) - 3.166924740191411 + 1))
}

function harmonicAccuracy(moves: MoveQuality[]) {
  return moves.length / moves.reduce((sum, move) => sum + 1 / Math.max(1, move.accuracy), 0)
}

// Placement samples contain only the human's moves, not the complete evaluation trace.
export function sampleAccuracy(moves: MoveQuality[]) {
  if (!moves.length) return 0
  const arithmetic = moves.reduce((sum, move) => sum + move.accuracy, 0) / moves.length
  return (arithmetic + harmonicAccuracy(moves)) / 2
}

// Published Lichess mathematics, implemented locally from its documented algorithm.
// Use all plies for volatility, then select a side. Our initial evaluation comes from
// this engine search rather than Lichess server's default 15 cp, so scores can differ.
export function gameAccuracy(moves: AnalysedMove[], color: 'w' | 'b' = 'w') {
  if (!moves.length) return 0
  const percentages = [moves[0].beforeEvaluationCp, ...moves.map((move) => move.evaluationCp)].map(winPercent)
  const windowSize = Math.max(2, Math.min(8, Math.floor(moves.length / 10)))
  const weights = moves.map((_, index) => {
    const start = Math.max(0, index - windowSize + 2)
    const window = percentages.slice(start, start + windowSize)
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length
    const deviation = Math.sqrt(window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length)
    return Math.max(.5, Math.min(12, deviation))
  })
  const side = moves.flatMap((move, index) => move.color === color ? [{ ...move, weight: weights[index] }] : [])
  if (!side.length) return 0
  const weighted = side.reduce((sum, move) => sum + move.accuracy * move.weight, 0) / side.reduce((sum, move) => sum + move.weight, 0)
  return (weighted + harmonicAccuracy(side)) / 2
}

export function materialBalance(position: Chess, color: 'w' | 'b') {
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
  return position.board().flat().reduce((total, piece) => total + (piece ? values[piece.type] * (piece.color === color ? 1 : -1) : 0), 0)
}

// ponytail: this uncalibrated game-level heuristic is not an Elo rating; replace it only after calibration against rated games.
// A game estimate needs actual decisions, not a few memorized opening moves.
export function gamePerformance(accuracy: number, opponent: EngineStrength, score: number, evidenceMoveCount: number) {
  if (evidenceMoveCount < 10 || !Number.isFinite(accuracy)) return null
  const quality = accuracy < 45 ? 400 : accuracy < 58 ? 600 : accuracy < 70 ? 850 : accuracy < 80 ? 1100 : accuracy < 88 ? 1400 : accuracy < 93 ? 1750 : accuracy < 96 ? 2000 : 2300
  const opponentRating = opponent === 3000 ? 2600 : opponent
  const resultRating = opponentRating + (score === 1 ? 200 : score === .5 ? 0 : -200)
  return Math.max(100, Math.min(2800, Math.round(((quality + resultRating) / 2) / 50) * 50))
}

function playUci(position: Chess, uci: string) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) throw new Error('Invalid UCI move')
  return position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
}

function principalLine(fen: string, result: EngineAnalysis) {
  if (!Number.isFinite(result.scoreCp) || !result.bestMove || result.principalVariation[0] !== result.bestMove) {
    throw new Error('Stockfish did not return a matching best line')
  }
  const position = new Chess(fen)
  const fens = [fen]
  const san: string[] = []
  for (const uci of result.principalVariation) {
    const move = playUci(position, uci)
    if (san.length < 6) {
      san.push(move.san)
      fens.push(position.fen())
    }
  }
  return { uci: result.principalVariation.slice(0, 6), san, fens }
}

function explainConsequence(record: GameMoveRecord, line: ReturnType<typeof principalLine>, cpLoss: number, terminal: boolean) {
  const position = new Chess(record.fenAfter)
  const opponent = record.color === 'w' ? 'b' : 'w'
  const names = { w: { uk: 'Білі', en: 'White', genitive: 'білих', dative: 'білим' }, b: { uk: 'Чорні', en: 'Black', genitive: 'чорних', dative: 'чорним' } }
  const pieces = { p: { uk: 'пішака', en: 'pawn' }, n: { uk: 'коня', en: 'knight' }, b: { uk: 'слона', en: 'bishop' }, r: { uk: 'туру', en: 'rook' }, q: { uk: 'ферзя', en: 'queen' }, k: { uk: 'короля', en: 'king' } }
  const captures: Move[] = []
  for (const uci of line.uci) {
    const move = playUci(position, uci)
    if (move.color === opponent && move.captured) captures.push(move)
  }
  if (position.isCheckmate()) {
    const winner = position.turn() === 'w' ? 'b' : 'w'
    const lastMove = line.san.at(-1) ?? record.san
    return {
      uk: `${names[winner].uk} ставлять мат після ${lastMove}. ${winner === record.color ? 'Це продовження завершує атаку матом.' : `Цей хід допускає мат ${names[record.color].dative} у показаній лінії.`}`,
      en: `${names[winner].en} delivers checkmate after ${lastMove}. ${winner === record.color ? 'This continuation finishes the attack with mate.' : `This move allows ${names[record.color].en} to be checkmated in the shown line.`}`,
    }
  }
  if (terminal) return { uk: 'Після цього ходу партія завершується нічиєю.', en: 'The game ends in a draw after this move.' }

  const lostMaterial = materialBalance(new Chess(record.fenBefore), record.color) - materialBalance(position, record.color)
  if (lostMaterial > 0 && captures.length) {
    const capture = captures.find((move) => move.to === record.to) ?? captures.find((move) => move.captured !== 'p') ?? captures[0]
    const piece = pieces[capture.captured!]
    const units = lostMaterial === 1 ? 'пункт' : lostMaterial < 5 ? 'пункти' : 'пунктів'
    return {
      uk: `Після ${capture.san} ${names[opponent].uk.toLowerCase()} забирають ${piece.uk} ${names[record.color].genitive} на ${capture.to}. Матеріальний баланс ${names[record.color].genitive} у показаній лінії погіршується на ${lostMaterial} ${units}.${cpLoss <= 10 ? ' Це саме по собі не робить хід помилкою: оцінка позиції зберігається.' : ''}`,
      en: `After ${capture.san}, ${names[opponent].en} captures ${names[record.color].en}'s ${piece.en} on ${capture.to}. ${names[record.color].en}'s material balance drops by ${lostMaterial} ${lostMaterial === 1 ? 'point' : 'points'} in the shown line.${cpLoss <= 10 ? ' This alone does not make the move a mistake: the position evaluation is preserved.' : ''}`,
    }
  }
  const reply = line.san[0]
  return cpLoss <= 10 ? {
    uk: `Хід зберігає оцінку позиції. Найсильніша відповідь ${names[opponent].genitive} — ${reply}.`,
    en: `The move preserves the position evaluation. ${names[opponent].en}'s strongest reply is ${reply}.`,
  } : {
    uk: `Найсильніша відповідь ${names[opponent].genitive} — ${reply}. У показаній короткій лінії конкретна втрата матеріалу чи мат не підтверджені; перегляньте продовження, щоб побачити відповідь на цей хід.`,
    en: `${names[opponent].en}'s strongest reply is ${reply}. The short line shown does not establish a specific material loss or checkmate; replay the continuation to see the response to this move.`,
  }
}

function classifiedLabel(record: GameMoveRecord, before: EngineAnalysis, after: EngineAnalysis, reviewed: AnalysedMove[], bestSan: string, soundSacrifice: boolean): AnalysisLabel {
  const score = (cp: number) => Math.abs(cp) >= 9000 ? ['mate', String(cp > 0 ? 1 : -1)] : ['cp', String(cp)]
  const previous = [score(before.scoreCp), ...reviewed.slice(-3).reverse().map((move) => score(move.beforeEvaluationCp * (move.color === 'w' ? 1 : -1)))]
  const result = classifyMove(score(after.scoreCp), previous, bestSan, record.san, record.fenAfter, record.color, soundSacrifice, reviewed.at(-1)?.label === 'brilliant', {})
  // Upstream classification is reused; only engine-confirmed piece sacrifices may earn !!.
  if (soundSacrifice && ['brilliant', 'best', 'excellent', 'great'].includes(result.moveRating)) return 'brilliant'
  if (result.moveRating === 'brilliant') return 'best'
  if (result.moveRating === 'great') return 'excellent'
  if (result.moveRating === 'miss') return 'mistake'
  if (result.moveRating === 'forced' || result.moveRating === 'book') return 'best'
  return result.moveRating
}

function sacrificeCaptures(record: GameMoveRecord, cpLoss: number, beforeScore: number, afterScore: number) {
  const before = new Chess(record.fenBefore)
  const piece = before.get(record.from)
  if (!piece || !['n', 'b', 'r', 'q'].includes(piece.type) || cpLoss > 25 || beforeScore >= 500 || -afterScore < -150) return []
  if (before.isAttacked(record.from, record.color === 'w' ? 'b' : 'w')) return []
  const balanceBefore = materialBalance(before, record.color)
  const after = new Chess(record.fenAfter)
  return after.moves({ verbose: true })
    .filter((reply) => reply.to === record.to && Boolean(reply.captured))
    .flatMap((reply) => {
      const accepted = new Chess(record.fenAfter)
      accepted.move(reply)
      if (materialBalance(accepted, record.color) > balanceBefore - 2) return []
      // An immediate equal-value recapture is a trade, not a piece sacrifice.
      const restoresMaterial = accepted.moves({ verbose: true }).some((recapture) => {
        if (recapture.to !== reply.to || !recapture.captured) return false
        const restored = new Chess(accepted.fen())
        restored.move(recapture)
        return materialBalance(restored, record.color) >= balanceBefore
      })
      return restoresMaterial ? [] : [accepted.fen()]
    })
}

/** Analyse the complete recorded game. A rejected or cancelled run never returns a partial review. */
export async function analyseRecordedGame(records: GameMoveRecord[], analyse: AnalysePosition, options: AnalysisOptions = {}): Promise<AnalysedMove[]> {
  const checkCancelled = () => {
    if (options.isCancelled?.()) {
      const error = new Error('Game analysis was cancelled')
      error.name = 'AbortError'
      throw error
    }
  }
  checkCancelled()
  if (!records.length) throw new Error('No recorded moves to analyse')

  // Validate every record before spending engine time or publishing progress.
  const replay = new Chess()
  const terminalResults = new Map<string, EngineAnalysis>()
  const histories: EngineHistory[] = [{ initialFen: replay.fen(), moves: [] }]
  for (const [index, record] of records.entries()) {
    checkCancelled()
    if (record.ply !== index + 1 || replay.isGameOver() || replay.fen() !== record.fenBefore) throw new Error('Recorded positions do not match')
    const move = playUci(replay, record.uci)
    if (replay.fen() !== record.fenAfter || move.san !== record.san || move.from !== record.from || move.to !== record.to || move.color !== record.color || move.captured !== record.captured) {
      throw new Error('Recorded move metadata does not match')
    }
    histories.push({ initialFen: histories[0].initialFen, moves: [...histories[index].moves, record.uci] })
    if (replay.isGameOver()) terminalResults.set(String(index + 1), { bestMove: null, scoreCp: replay.isCheckmate() ? -10_000 : 0, principalVariation: [] })
  }

  const cache = new Map<string, EngineAnalysis>()
  const search = async (fen: string, moveTime: number, history: EngineHistory) => {
    checkCancelled()
    const result = await analyse(fen, 3000, moveTime, history)
    checkCancelled()
    if (!Number.isFinite(result.scoreCp)) throw new Error('Stockfish returned an invalid evaluation')
    return result
  }
  const analyseCached = async (fen: string, ply: number) => {
    const key = String(ply)
    const cached = terminalResults.get(key) ?? cache.get(key)
    if (cached) return cached
    const result = await search(fen, 300, histories[ply])
    cache.set(key, result)
    return result
  }
  const reviewed: AnalysedMove[] = []
  for (const [index, record] of records.entries()) {
    checkCancelled()
    const before = await analyseCached(record.fenBefore, index)
    checkCancelled()
    const line = principalLine(record.fenBefore, before)
    const after = await analyseCached(record.fenAfter, index + 1)
    checkCancelled()
    const terminal = terminalResults.has(String(index + 1))
    const consequence = terminal
      ? { uci: [], san: [], fens: [record.fenAfter] }
      : principalLine(record.fenAfter, after)
    const cpLoss = Math.max(0, Math.min(1000, before.scoreCp + after.scoreCp))
    const winDrop = Math.max(0, winPercent(before.scoreCp) - winPercent(-after.scoreCp))
    let brilliant = false
    const captures = sacrificeCaptures(record, cpLoss, before.scoreCp, after.scoreCp)
    if (captures.length) {
      const deeperBefore = await search(record.fenBefore, 1000, histories[index])
      const deeperAfter = await search(record.fenAfter, 1000, histories[index + 1])
      brilliant = Math.max(0, deeperBefore.scoreCp + deeperAfter.scoreCp) <= 35 && -deeperAfter.scoreCp >= -150
      // Confirm compensation after accepting the sacrifice, not just an offered piece.
      for (const fen of captures) {
        if (!brilliant) break
        const acceptedPosition = new Chess(record.fenAfter)
        const reply = acceptedPosition.moves({ verbose: true }).find((move) => move.after === fen)!
        const accepted = await search(fen, 1000, { initialFen: histories[0].initialFen, moves: [...histories[index + 1].moves, `${reply.from}${reply.to}${reply.promotion ?? ''}`] })
        brilliant = accepted.scoreCp >= -150
      }
    }
    checkCancelled()
    const label = classifiedLabel(record, before, after, reviewed, line.san[0], brilliant)
    reviewed.push({
      ...record,
      // An opening name is historical context, not proof that its move is sound.
      bookMove: record.bookMove && label !== 'inaccuracy' && label !== 'mistake' && label !== 'blunder',
      cpLoss,
      winDrop,
      accuracy: lichessMoveAccuracy(winDrop),
      bestMove: before.bestMove!,
      bestMoveSan: line.san[0],
      principalVariationSan: line.san,
      principalVariationFens: line.fens,
      principalVariationUci: line.uci,
      consequenceVariationSan: consequence.san,
      consequenceVariationFens: consequence.fens,
      consequenceVariationUci: consequence.uci,
      mistakeExplanation: explainConsequence(record, consequence, cpLoss, terminal),
      beforeEvaluationCp: record.color === 'w' ? before.scoreCp : -before.scoreCp,
      evaluationCp: record.color === 'w' ? -after.scoreCp : after.scoreCp,
      label,
    })
    options.onProgress?.([...reviewed], index + 1 === records.length ? 100 : Math.min(99, Math.floor((index + 1) / records.length * 100)))
  }
  checkCancelled()
  return reviewed
}
