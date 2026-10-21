import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { Chess } from 'chess.js'

const result = await build({ entryPoints: ['src/review-context.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { detectOpeningKey, detectOpening, detectOpeningName, isBookMove, hasLostF7Pressure } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)

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
  ['course:grunfeld-exchange', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7'],
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
const index = JSON.parse(await readFile(new URL('../src/data/opening-index.json', import.meta.url), 'utf8'))
assert.equal(index.license, 'CC0-1.0')
assert.match(index.revision, /^[a-f0-9]{40}$/)
const families = new Set()
for (const [fen, eco, name, courseId, pgn] of index.positions) {
  const game = new Chess()
  game.loadPgn(pgn)
  assert.equal(game.fen().split(' ').slice(0,4).join(' '),fen,`Upstream position: ${name}`)
  const line = game.history({verbose:true}).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`)
  assert.deepEqual(detectOpening(line),{eco,name,courseId:courseId||null},`Upstream recognition: ${name}`)
  if (courseId) families.add(courseId)
  for (const move of game.history({verbose:true})) assert(isBookMove(move.before,`${move.from}${move.to}${move.promotion??''}`),`${name}/${move.san}: missing public book move`)
}
assert.equal(families.size,63)
for (const [fen, choices] of index.book) for (const uci of choices) {
  const game = new Chess(`${fen} 0 1`)
  assert(game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'}),`${fen}/${uci}: illegal public book edge`)
}
assert.equal(detectOpening(moves('e4 e5 Nf3 Nf6 Nxe5 Nc6 Nxc6 dxc6 d3 Bc5')).courseId,'stafford')
assert.equal(detectOpening(moves('e4 e5 d4 exd4 c3 dxc3 Bc4 cxb2 Bxb2 Nf6')).courseId,'danish')
assert.equal(detectOpening(moves('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6')).courseId,'najdorf')
assert.equal(detectOpening(moves('c4 Nf6 d4 g6 Nc3 d5')).courseId,'grunfeld')
assert.match(detectOpeningName(moves('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'),'en'),/Najdorf.*B90/)
assert.match(detectOpeningName(moves('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'),'uk'),/Найдорфа.*B90/)
assert.equal(detectOpeningName([], 'uk'),null)
const najdorf = new Chess()
najdorf.loadPgn('1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6')
assert.equal(isBookMove(najdorf.fen(),'h1g1'),true,'6.Rg1 is the upstream Petronić Attack')
assert(najdorf.moves({verbose:true}).some((move) => move.from==='e1'&&move.to==='e2'))
assert.equal(isBookMove(najdorf.fen(),'e1e2'),false,'Legal 6.Ke2 is absent from the pinned public PGNs')
console.log(`✓ ${index.positions.length} upstream named positions, all ${families.size} catalog families, legal offline book edges, UK/EN names, transpositions, and safe f7 explanations`)
