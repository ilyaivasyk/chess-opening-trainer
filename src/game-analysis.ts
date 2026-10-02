import { Chess, type Move, type Square } from 'chess.js'
import type { EngineAnalysis, EngineStrength } from './stockfish'

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
  beforeEvaluationCp: number
  evaluationCp: number
  label: AnalysisLabel
}

type AnalysePosition = (fen: string, strength: EngineStrength, moveTime: number) => Promise<EngineAnalysis>
type AnalysisOptions = {
  isCancelled?: () => boolean
  onProgress?: (items: AnalysedMove[], progress: number) => void
}

export function winPercent(centipawns: number) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1)
}

export function lichessMoveAccuracy(winDrop: number) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * winDrop) - 3.1669))
}

export function gameAccuracy(moves: MoveQuality[]) {
  if (!moves.length) return 0
  const arithmetic = moves.reduce((sum, move) => sum + move.accuracy, 0) / moves.length
  const harmonic = moves.length / moves.reduce((sum, move) => sum + 1 / Math.max(1, move.accuracy), 0)
  return (arithmetic + harmonic) / 2
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

function moveLabel(winDrop: number, bestMove: string, playedMove: string, brilliant: boolean): AnalysisLabel {
  if (brilliant) return 'brilliant'
  if (bestMove === playedMove || winDrop <= .5) return 'best'
  if (winDrop <= 2) return 'excellent'
  if (winDrop <= 5) return 'good'
  if (winDrop <= 10) return 'inaccuracy'
  if (winDrop <= 20) return 'mistake'
  return 'blunder'
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
      return materialBalance(accepted, record.color) <= balanceBefore - 2 ? [accepted.fen()] : []
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
  for (const [index, record] of records.entries()) {
    checkCancelled()
    if (record.ply !== index + 1 || replay.isGameOver() || replay.fen() !== record.fenBefore) throw new Error('Recorded positions do not match')
    const move = playUci(replay, record.uci)
    if (replay.fen() !== record.fenAfter || move.san !== record.san || move.from !== record.from || move.to !== record.to || move.color !== record.color || move.captured !== record.captured) {
      throw new Error('Recorded move metadata does not match')
    }
    if (replay.isGameOver()) terminalResults.set(record.fenAfter, { bestMove: null, scoreCp: replay.isCheckmate() ? -10_000 : 0, principalVariation: [] })
  }

  const cache = new Map<string, EngineAnalysis>()
  const search = async (fen: string, moveTime: number) => {
    checkCancelled()
    const result = await analyse(fen, 3000, moveTime)
    checkCancelled()
    if (!Number.isFinite(result.scoreCp)) throw new Error('Stockfish returned an invalid evaluation')
    return result
  }
  const analyseCached = async (fen: string) => {
    const cached = terminalResults.get(fen) ?? cache.get(fen)
    if (cached) return cached
    const result = await search(fen, 300)
    cache.set(fen, result)
    return result
  }
  const reviewed: AnalysedMove[] = []
  for (const [index, record] of records.entries()) {
    checkCancelled()
    const before = await analyseCached(record.fenBefore)
    checkCancelled()
    const line = principalLine(record.fenBefore, before)
    const after = await analyseCached(record.fenAfter)
    checkCancelled()
    const cpLoss = Math.max(0, Math.min(1000, before.scoreCp + after.scoreCp))
    const winDrop = Math.max(0, winPercent(before.scoreCp) - winPercent(-after.scoreCp))
    let brilliant = false
    const captures = sacrificeCaptures(record, cpLoss, before.scoreCp, after.scoreCp)
    if (captures.length) {
      const deeperBefore = await search(record.fenBefore, 1000)
      const deeperAfter = await search(record.fenAfter, 1000)
      brilliant = Math.max(0, deeperBefore.scoreCp + deeperAfter.scoreCp) <= 35 && -deeperAfter.scoreCp >= -150
      // Confirm compensation after accepting the sacrifice, not just an offered piece.
      for (const fen of captures) {
        if (!brilliant) break
        const accepted = await search(fen, 1000)
        brilliant = accepted.scoreCp >= -150
      }
    }
    checkCancelled()
    reviewed.push({
      ...record,
      cpLoss,
      winDrop,
      accuracy: lichessMoveAccuracy(winDrop),
      bestMove: before.bestMove!,
      bestMoveSan: line.san[0],
      principalVariationSan: line.san,
      principalVariationFens: line.fens,
      principalVariationUci: line.uci,
      beforeEvaluationCp: record.color === 'w' ? before.scoreCp : -before.scoreCp,
      evaluationCp: record.color === 'w' ? -after.scoreCp : after.scoreCp,
      label: moveLabel(winDrop, before.bestMove!, record.uci, brilliant),
    })
    options.onProgress?.([...reviewed], Math.round((index + 1) / records.length * 100))
  }
  checkCancelled()
  return reviewed
}
