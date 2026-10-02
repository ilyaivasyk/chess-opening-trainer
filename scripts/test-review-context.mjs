import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import { Chess } from 'chess.js'

const source = await readFile(new URL('../src/review-context.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source.replace(/^import .*\n/, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const context = vm.createContext({ Chess, exports: {} })
vm.runInContext(compiled, context)
const { detectOpeningKey, hasLostF7Pressure } = context.exports

function moves(san) {
  const game = new Chess()
  return san.split(' ').map((item) => {
    const move = game.move(item)
    return `${move.from}${move.to}${move.promotion ?? ''}`
  })
}

const openings = [
  ['course:grob', 'g4 d5 Bg2 c6'],
  ['course:bird', 'f4 d5 Nf3'],
  ['course:polish', 'b4 e5 Bb2'],
  ['course:larsen', 'b3 d5 Bb2'],
  ['course:petrov', 'e4 e5 Nf3 Nf6'],
  ['course:scotch', 'e4 e5 Nf3 Nc6 d4'],
  ['course:french', 'e4 e6 d4 d5'],
  ['openingItalian', 'e4 e5 Nf3 Nc6 Bc4'],
  ['openingGiuocoPiano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
  ['openingTwoKnights', 'e4 e5 Nf3 Nc6 Bc4 Nf6'],
  ['openingPianissimo', 'e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 c3'],
  ['openingLondon', 'd4 Nf6 Bf4 g6 Nf3 Bg7'],
  ['openingLondon', 'd4 Nf6 Nf3 d5 Bf4 e6'],
  ['openingLondon', 'd4 Nf6 Nc3 d5 Bf4'],
  ['openingLondon', 'd4 f5 Bf4 Nf6'],
  ['openingQueenGambit', 'd4 d5 c4 dxc4'],
  ['openingQgd', 'd4 e6 c4 d5'],
  ['openingCaroKann', 'e4 c6 d4 d5'],
  ['openingRuyLopez', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4'],
  ['openingSicilian', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4'],
  ['openingEnglish', 'c4 e5 Nc3 Nf6'],
  ['openingKingsIndian', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6'],
  ['openingNimzo', 'd4 e6 c4 Nf6 Nc3 Bb4'],
  ['openingGrunfeld', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7'],
  ['openingGrunfeld', 'c4 Nf6 d4 g6 Nc3 d5'],
  ['openingQueenPawn', 'd4 Nf6 Nf3'],
]
for (const [expected, san] of openings) assert.equal(detectOpeningKey(moves(san)), expected, san)
assert.equal(detectOpeningKey([]), 'openingUnknown')
assert.equal(detectOpeningKey(['e2e4', 'invalid']), 'openingKingPawn')

function pressureAfter(san, move) {
  const game = new Chess()
  game.loadPgn(san)
  const before = game.fen()
  game.move(move)
  return hasLostF7Pressure(before, game.fen())
}
assert.equal(pressureAfter('1. e4 e5 2. Bc4 Nc6', 'Bxf7+'), false, 'Capturing f7 must not be described as blocking the bishop')
assert.equal(pressureAfter('1. e4 e5 2. Bc4 Nc6', 'Bb3'), false, 'Moving the bishop is not adding a friendly blocker')
assert.equal(pressureAfter('1. e4 e5 2. Bc4 Nc6 3. d4 Nf6', 'd5'), true, 'The new d5 pawn closes the c4–f7 diagonal')
assert.equal(pressureAfter('1. e4 e5 2. Nf3 Nc6', 'Nxe5'), false, 'No bishop pressure existed before the move')
console.log('✓ All 11 free opening families, common transpositions, retained names, and safe f7 pressure explanations')
