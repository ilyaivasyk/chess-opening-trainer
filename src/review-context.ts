import { Chess, type Square } from 'chess.js'

export type OpeningKey = `course:${string}`
  | 'openingUnknown' | 'openingKingPawn' | 'openingQueenPawn' | 'openingEnglish'
  | 'openingOpen' | 'openingOpenKnight' | 'openingItalian' | 'openingGiuocoPiano'
  | 'openingPianissimo' | 'openingTwoKnights' | 'openingLondon'
  | 'openingQueenGambit' | 'openingQgd' | 'openingCaroKann' | 'openingRuyLopez'
  | 'openingSicilian' | 'openingKingsIndian' | 'openingNimzo' | 'openingGrunfeld'

// Match positions, rather than one move order, and retain the last identified
// opening when the game leaves its starting position.
const anchors: [OpeningKey, number, string][] = [
  ['course:grob', 2, 'g4'],
  ['course:bird', 2, 'f4'],
  ['course:polish', 2, 'b4'],
  ['course:larsen', 2, 'b3'],
  ['course:reti', 2, 'Nf3'],
  ['course:french', 4, 'e4 e6'],
  ['course:scandinavian', 4, 'e4 d5'],
  ['course:modern', 4, 'e4 g6'],
  ['course:alekhine', 4, 'e4 Nf6'],
  ['course:owens', 4, 'e4 b6'],
  ['course:pirc', 6, 'e4 d6 d4 Nf6 Nc3 g6'],
  ['course:kings-gambit', 5, 'e4 e5 f4'],
  ['course:scotch', 5, 'e4 e5 Nf3 Nc6 d4'],
  ['course:vienna', 5, 'e4 e5 Nc3'],
  ['course:four-knights', 6, 'e4 e5 Nf3 Nc6 Nc3 Nf6'],
  ['course:petrov', 5, 'e4 e5 Nf3 Nf6'],
  ['course:philidor', 5, 'e4 e5 Nf3 d6'],
  ['course:bishops-opening', 4, 'e4 e5 Bc4'],
  ['course:center-game', 5, 'e4 e5 d4 exd4 Qxd4'],
  ['course:slav', 5, 'd4 d5 c4 c6'],
  ['course:dutch', 4, 'd4 f5'],
  ['course:budapest', 6, 'd4 Nf6 c4 e5'],
  ['course:benko-gambit', 6, 'd4 Nf6 c4 c5 d5 b5'],
  ['course:benoni', 6, 'd4 Nf6 c4 c5 d5 e6'],
  ['course:queens-indian', 6, 'd4 Nf6 c4 e6 Nf3 b6'],
  ['course:bogo-indian', 6, 'd4 Nf6 c4 e6 Nf3 Bb4+'],
  ['course:trompowsky', 5, 'd4 Nf6 Bg5'],
  ['course:catalan', 6, 'd4 Nf6 c4 e6 g3'],
  ['openingKingPawn', 1, 'e4'],
  ['openingQueenPawn', 1, 'd4'],
  ['openingEnglish', 2, 'c4'],
  ['openingOpen', 3, 'e4 e5'],
  ['openingOpenKnight', 4, 'e4 e5 Nf3 Nc6'],
  ['openingSicilian', 4, 'e4 c5'],
  ['openingCaroKann', 4, 'e4 c6'],
  ['openingQueenGambit', 4, 'd4 d5 c4'],
  ['openingQgd', 5, 'd4 d5 c4 e6'],
  ['openingLondon', 5, 'd4 d5 Bf4'],
  ['openingLondon', 5, 'd4 Nf6 Bf4'],
  ['openingLondon', 5, 'd4 f5 Bf4'],
  ['openingLondon', 5, 'd4 d5 Nf3 Nf6 Bf4'],
  ['openingLondon', 5, 'd4 Nf6 Nc3 d5 Bf4'],
  ['openingItalian', 5, 'e4 e5 Nf3 Nc6 Bc4'],
  ['openingRuyLopez', 6, 'e4 e5 Nf3 Nc6 Bb5'],
  ['openingGiuocoPiano', 6, 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
  ['openingTwoKnights', 6, 'e4 e5 Nf3 Nc6 Bc4 Nf6'],
  ['openingPianissimo', 7, 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3'],
  ['openingKingsIndian', 6, 'd4 Nf6 c4 g6 Nc3 Bg7'],
  ['openingNimzo', 6, 'd4 Nf6 c4 e6 Nc3 Bb4'],
  ['openingGrunfeld', 6, 'd4 Nf6 c4 g6 Nc3 d5'],
]

function positionKey(position: Chess) {
  return position.fen().split(' ').slice(0, 4).join(' ')
}

const knownPositions = new Map(anchors.map(([key, priority, line]) => {
  const position = new Chess()
  for (const san of line.split(' ')) position.move(san)
  return [positionKey(position), { key, priority }] as const
}))

export function detectOpeningKey(moves: string[]): OpeningKey {
  const position = new Chess()
  let identified: OpeningKey = 'openingUnknown'
  let priority = 0
  for (const uci of moves) {
    try {
      position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' })
    } catch { break }
    const match = knownPositions.get(positionKey(position))
    if (match && match.priority >= priority) {
      identified = match.key
      priority = match.priority
    }
  }
  return identified
}

function bishopRayToF7(square: Square): Square[] {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  if (Math.abs(5 - file) !== Math.abs(6 - rank)) return []
  const squares: Square[] = []
  const fileStep = Math.sign(5 - file)
  const rankStep = Math.sign(6 - rank)
  for (let f = file + fileStep, r = rank + rankStep; f !== 5; f += fileStep, r += rankStep) {
    squares.push(`${String.fromCharCode(97 + f)}${r + 1}` as Square)
  }
  return squares
}

// Warn only when a new friendly blocker closes an unchanged bishop's diagonal.
// Capturing f7, exchanging or deliberately moving that bishop is not blocking it.
export function hasLostF7Pressure(fenBefore: string, fenAfter: string) {
  const before = new Chess(fenBefore)
  const after = new Chess(fenAfter)
  if (before.get('f7')?.type !== 'p' || before.get('f7')?.color !== 'b'
    || after.get('f7')?.type !== 'p' || after.get('f7')?.color !== 'b') return false
  return before.board().flat().some((piece) => {
    if (piece?.color !== 'w' || piece.type !== 'b' || after.get(piece.square)?.type !== 'b'
      || after.get(piece.square)?.color !== 'w') return false
    const ray = bishopRayToF7(piece.square)
    if (!ray.length || ray.some((square) => before.get(square))) return false
    return ray.some((square) => after.get(square)?.color === 'w')
  })
}
