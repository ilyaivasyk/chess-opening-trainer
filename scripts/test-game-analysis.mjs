import assert from 'node:assert/strict'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { Chess } from 'chess.js'
import ts from 'typescript'

const runtimePath = new URL(`./.game-analysis-test-${process.pid}.mjs`, import.meta.url)
const source = await readFile(new URL('../src/game-analysis.ts', import.meta.url), 'utf8')
await writeFile(runtimePath, ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)

function recordMove(game, input, playerColor = 'w', bookMove = false) {
  const fenBefore = game.fen()
  const move = game.move(input)
  return {
    ply: game.history().length, actor: move.color === playerColor ? 'player' : 'engine', color: move.color,
    san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ''}`, from: move.from, to: move.to,
    captured: move.captured, fenBefore, fenAfter: game.fen(), bookMove, openingName: 'Fixture',
  }
}

function fromSan(moves, color = 'w') {
  const game = new Chess()
  return moves.split(' ').map((move) => recordMove(game, move, color))
}

function legalResult(fen, scoreCp, preferredLine) {
  const game = new Chess(fen)
  if (game.isGameOver()) return { bestMove: null, scoreCp: game.isCheckmate() ? -10_000 : 0, principalVariation: [] }
  const principalVariation = preferredLine ?? []
  if (!preferredLine) for (let index = 0; index < 8 && !game.isGameOver(); index += 1) {
    const move = game.moves({ verbose: true })[0]
    principalVariation.push(`${move.from}${move.to}${move.promotion ?? ''}`)
    game.move(move)
  }
  return { bestMove: principalVariation[0], scoreCp: scoreCp ?? (new Chess(fen).turn() === 'w' ? 40 : -40), principalVariation }
}

try {
  const { analyseRecordedGame, gameAccuracy, gamePerformance, materialBalance, winPercent, lichessMoveAccuracy } = await import(runtimePath.href)
  const checks = []

  const italian = fromSan('e4 e5 Nf3 Nc6 Bc4')
  const calls = []
  const review = await analyseRecordedGame(italian, async (fen, strength, time) => {
    calls.push({ fen, strength, time })
    return legalResult(fen, undefined, fen === italian.at(-1).fenBefore ? ['f1b5', 'a7a6'] : undefined)
  })
  assert.equal(review.length, italian.length)
  const alternative = review.at(-1)
  assert.deepEqual(alternative.principalVariationSan, ['Bb5', 'a6'])
  assert.equal(alternative.principalVariationFens[0], alternative.fenBefore)
  assert.equal(alternative.bestMoveSan, 'Bb5')
  assert.throws(() => new Chess(alternative.fenAfter).move({ from: 'f1', to: 'b5' }))
  assert.ok(calls.every((call) => call.strength === 3000 && call.time === 300))
  assert.ok(review.every((move) => move.principalVariationUci.length <= 6 && move.principalVariationFens.length === move.principalVariationUci.length + 1))
  checks.push('best line starts before the played move; strongest analysis; SAN and replay positions agree')

  const signs = fromSan('e4 e5', 'b')
  const scores = new Map([[signs[0].fenBefore, 80], [signs[0].fenAfter, -30], [signs[1].fenAfter, 120]])
  const signed = await analyseRecordedGame(signs, async (fen) => legalResult(fen, scores.get(fen)))
  assert.deepEqual(signed.map((move) => move.cpLoss), [50, 90])
  assert.deepEqual(signed.map((move) => move.beforeEvaluationCp), [80, 30])
  assert.deepEqual(signed.map((move) => move.evaluationCp), [30, 120])
  assert.equal(signed[0].winDrop, winPercent(80) - winPercent(30))
  assert.equal(signed[1].accuracy, lichessMoveAccuracy(winPercent(-30) - winPercent(-120)))
  checks.push('white and black scores use the correct point of view')

  let longRecords
  for (let seedStart = 1; seedStart <= 30; seedStart += 1) {
    const game = new Chess()
    const candidate = []
    let seed = seedStart
    while (candidate.length < 140 && !game.isGameOver()) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const moves = game.moves({ verbose: true })
      candidate.push(recordMove(game, moves[seed % moves.length]))
    }
    if (candidate.length === 140) { longRecords = candidate; break }
  }
  assert.ok(longRecords, 'fixture must exceed 120 plies')
  for (const playerColor of ['w', 'b']) {
    const records = longRecords.map((record) => ({ ...record, actor: record.color === playerColor ? 'player' : 'engine' }))
    const progress = []
    const items = await analyseRecordedGame(records, async (fen) => legalResult(fen), {
      onProgress: (partial, percent) => progress.push({ count: partial.length, percent }),
    })
    assert.equal(items.length, 140)
    assert.equal(items.filter((move) => move.actor === 'player').length, 70)
    assert.deepEqual(progress.at(-1), { count: 140, percent: 100 })
    assert.ok(items.every((move) => Number.isFinite(move.accuracy) && move.accuracy >= 0 && move.accuracy <= 100))
  }
  checks.push('140-ply games complete for both player colors, without a move cutoff')

  for (const property of ['fenBefore', 'fenAfter', 'san', 'from', 'to', 'color', 'captured', 'ply']) {
    const broken = structuredClone(italian)
    const record = broken.at(-1)
    record[property] = property === 'ply' ? 99 : property === 'color' ? 'b' : property === 'captured' ? 'q' : property === 'from' || property === 'to' ? 'a1' : 'invalid'
    let searches = 0
    await assert.rejects(analyseRecordedGame(broken, async (fen) => { searches += 1; return legalResult(fen) }))
    assert.equal(searches, 0, `invalid ${property} must fail before engine work`)
  }
  for (const badLine of [[], ['d2d4'], ['e2e4', 'e2e4']]) {
    await assert.rejects(analyseRecordedGame(italian, async () => ({ bestMove: 'e2e4', scoreCp: 20, principalVariation: badLine })))
  }
  await assert.rejects(analyseRecordedGame(italian, async () => ({ bestMove: 'e2e4', scoreCp: NaN, principalVariation: ['e2e4'] })))
  checks.push('invalid chronology, metadata, missing/mismatched/illegal PV, and nonfinite scores fail visibly')

  let cancelled = false
  let cancelSearches = 0
  await assert.rejects(analyseRecordedGame(italian, async (fen) => {
    cancelSearches += 1
    cancelled = true
    return legalResult(fen)
  }, { isCancelled: () => cancelled }), { name: 'AbortError' })
  assert.equal(cancelSearches, 1, 'cancellation after first await must not start an after-position search')
  for (const failure of ['timeout', 'cancel']) {
    cancelled = false
    let completed = false
    const progress = []
    const pending = analyseRecordedGame(italian, async (fen) => {
      if (fen === italian.at(-1).fenAfter) {
        if (failure === 'timeout') throw new Error('Stockfish timeout')
        cancelled = true
      }
      return legalResult(fen)
    }, { isCancelled: () => cancelled, onProgress: (_, percent) => progress.push(percent) }).then((value) => { completed = true; return value })
    await assert.rejects(pending, failure === 'cancel' ? { name: 'AbortError' } : /timeout/)
    assert.equal(completed, false)
    assert.ok(!progress.includes(100), 'last-move failure must not emit completed progress')
  }
  cancelled = false
  await assert.rejects(analyseRecordedGame(italian, async (fen) => legalResult(fen), {
    isCancelled: () => cancelled, onProgress: (_, percent) => { if (percent === 100) cancelled = true },
  }), { name: 'AbortError' })
  checks.push('cancellation after awaits and final-move failures never return a completed/partial review')

  const repetition = fromSan('Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8')
  const repetitionCalls = []
  const repeated = await analyseRecordedGame(repetition, async (fen) => { repetitionCalls.push(fen); return legalResult(fen, 75) })
  assert.equal(repeated.at(-1).evaluationCp, 0)
  assert.ok(!repetitionCalls.includes(repetition.at(-1).fenAfter), 'threefold draw requires actual game history')
  const afterDraw = new Chess()
  const continued = repetition.map((record) => { afterDraw.move(record.san); return record })
  continued.push(recordMove(afterDraw, 'e4'))
  await assert.rejects(analyseRecordedGame(continued, async (fen) => legalResult(fen)), /positions/)
  const mate = await analyseRecordedGame(fromSan('f3 e5 g4 Qh4#'), async (fen) => legalResult(fen))
  assert.equal(mate.at(-1).evaluationCp, -10_000)
  checks.push('history-dependent repetition and checkmate have exact terminal evaluations')

  for (const promotion of ['Q', 'N']) {
    const records = fromSan(`a4 h5 a5 h4 a6 h3 axb7 hxg2 bxa8=${promotion} gxh1=${promotion}`)
    const promoted = await analyseRecordedGame(records, async (fen) => {
      const record = records.find((item) => item.fenBefore === fen && item.uci.length === 5)
      return legalResult(fen, undefined, record ? [record.uci] : undefined)
    })
    assert.equal(promoted[8].bestMoveSan, `bxa8=${promotion}`)
    assert.equal(promoted[9].bestMoveSan, `gxh1=${promotion}`)
    assert.equal(new Chess(promoted[9].principalVariationFens[1]).get('h1').type, promotion.toLowerCase())
  }
  checks.push('queen promotion and knight underpromotion replay correctly for both colors')

  const gift = fromSan('e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Bd3 c5 Nf3 Nc6 O-O Be7 Re1 O-O Bxh7+')
  const giftMove = gift.at(-1)
  const accepted = new Chess(giftMove.fenAfter)
  accepted.move('Kxh7')
  assert.equal(materialBalance(accepted, 'w'), -2)
  for (const compensation of [40, -250]) {
    const deeper = []
    const reviewed = await analyseRecordedGame(gift, async (fen, strength, time) => {
      if (time === 1000) deeper.push({ fen, strength })
      return legalResult(fen, time === 1000 && fen === accepted.fen() ? compensation : undefined, fen === giftMove.fenBefore ? [giftMove.uci] : undefined)
    })
    assert.equal(reviewed.at(-1).label === 'brilliant', compensation >= -150)
    assert.ok(deeper.some((call) => call.fen === accepted.fen() && call.strength === 3000))
  }
  checks.push('brilliant requires an actual piece sacrifice and engine-confirmed compensation after capture')

  assert.equal(gameAccuracy([]), 0)
  assert.equal(gamePerformance(99, 1200, 0, 0), null)
  assert.equal(gamePerformance(99, 1200, 0, 9), null)
  assert.equal(typeof gamePerformance(88, 1200, .5, 10), 'number')
  checks.push('short/book-only samples cannot produce a misleading game-level estimate')

  for (const check of checks) console.log(`PASS ${check}`)
} finally {
  await unlink(runtimePath)
}
