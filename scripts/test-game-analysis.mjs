import assert from 'node:assert/strict'
import { unlink } from 'node:fs/promises'
import { Chess } from 'chess.js'
import { build } from 'esbuild'

const runtimePath = new URL(`./.game-analysis-test-${process.pid}.mjs`, import.meta.url)
await build({ entryPoints: [new URL('../src/game-analysis.ts', import.meta.url).pathname], outfile: runtimePath.pathname, bundle: true, platform: 'node', format: 'esm', external: ['chess.js'] })

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
  const review = await analyseRecordedGame(italian, async (fen, strength, time, history) => {
    calls.push({ fen, strength, time, history })
    const replay = new Chess(history.initialFen)
    for (const uci of history.moves) replay.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    assert.equal(replay.fen(), fen, 'every analysis search must include the matching complete history')
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

  assert.equal(calls.length, italian.length + 1, 'saving consequences must reuse the existing paired analysis, without extra searches')
  for (const item of review) {
    assert.equal(item.consequenceVariationFens[0], item.fenAfter)
    assert.ok(item.consequenceVariationUci.length <= 6)
    const position = new Chess(item.fenAfter)
    for (const [index, uci] of item.consequenceVariationUci.entries()) {
      const move = position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      assert.equal(move.san, item.consequenceVariationSan[index])
      assert.equal(position.fen(), item.consequenceVariationFens[index + 1])
    }
    assert.ok(item.mistakeExplanation.uk && item.mistakeExplanation.en)
  }
  const consequenceFixtures = [
    { moves: 'e4 e5 Bc4 Nc6 d3 Nf6 Nf3 h6 O-O d6 Nc3 Be7 Be3 O-O Bxh6', line: ['g7h6', 'h2h3'], captured: 'bishop', target: 'h6', color: 'White' },
    { moves: 'h3 e5 e4 Bc5 Nf3 d6 Nc3 Nf6 Be2 O-O O-O Be6 d3 Bxh3', line: ['g2h3', 'a7a6'], captured: 'bishop', target: 'h3', color: 'Black' },
  ]
  for (const fixture of consequenceFixtures) {
    const records = fromSan(fixture.moves)
    const played = records.at(-1)
    const items = await analyseRecordedGame(records, async (fen) => legalResult(fen, fen === played.fenAfter ? 450 : undefined, fen === played.fenAfter ? fixture.line : undefined))
    const item = items.at(-1)
    assert.deepEqual(item.consequenceVariationUci, fixture.line)
    assert.equal(item.consequenceVariationSan[0], fixture.target === 'h6' ? 'gxh6' : 'gxh3')
    assert.ok(item.mistakeExplanation.en.includes(`${fixture.color}'s ${fixture.captured} on ${fixture.target}`))
    assert.ok(item.mistakeExplanation.en.includes('drops by 2 points'))
    assert.ok(item.mistakeExplanation.uk.includes('погіршується на 2 пункти'))
    assert.ok(!item.mistakeExplanation.en.includes('fork') && !item.mistakeExplanation.en.includes('pin'))
    assert.equal(item.principalVariationFens[0], played.fenBefore, 'saving the consequences must not overwrite the best alternative')
  }
  const beforeMate = fromSan('f3 e5 g4')
  const losingMove = beforeMate.at(-1)
  const matingReply = await analyseRecordedGame(beforeMate, async (fen) => legalResult(fen, fen === losingMove.fenAfter ? 10_000 : undefined, fen === losingMove.fenAfter ? ['d8h4'] : undefined))
  assert.deepEqual(matingReply.at(-1).consequenceVariationSan, ['Qh4#'])
  assert.ok(matingReply.at(-1).mistakeExplanation.en.includes('Black delivers checkmate after Qh4#'))
  assert.ok(matingReply.at(-1).mistakeExplanation.uk.includes('допускає мат білим'))
  const beforeBlackMate = fromSan('e4 e5 Qh5 Nc6 Bc4 Nf6')
  const losingBlackMove = beforeBlackMate.at(-1)
  const whiteMateReply = await analyseRecordedGame(beforeBlackMate, async (fen) => legalResult(fen, fen === losingBlackMove.fenAfter ? 10_000 : undefined, fen === losingBlackMove.fenAfter ? ['h5f7'] : undefined))
  assert.deepEqual(whiteMateReply.at(-1).consequenceVariationSan, ['Qxf7#'])
  assert.ok(whiteMateReply.at(-1).mistakeExplanation.en.includes('White delivers checkmate after Qxf7#'))
  assert.ok(whiteMateReply.at(-1).mistakeExplanation.uk.includes('допускає мат чорним'))
  await assert.rejects(analyseRecordedGame(italian, async (fen) => fen === italian.at(-1).fenAfter
    ? { bestMove: 'a7a6', scoreCp: 10, principalVariation: ['a7a6', 'a7a6'] }
    : legalResult(fen)), /Invalid move/)
  checks.push('post-move consequences reuse engine results, replay legally, explain confirmed bishop loss/mate for both colors, and reject invalid final PV')

  const signs = fromSan('e4 e5', 'b')
  const scores = new Map([[signs[0].fenBefore, 80], [signs[0].fenAfter, -30], [signs[1].fenAfter, 120]])
  const signed = await analyseRecordedGame(signs, async (fen) => legalResult(fen, scores.get(fen)))
  assert.deepEqual(signed.map((move) => move.cpLoss), [50, 90])
  assert.deepEqual(signed.map((move) => move.beforeEvaluationCp), [80, 30])
  assert.deepEqual(signed.map((move) => move.evaluationCp), [30, 120])
  assert.equal(signed[0].winDrop, winPercent(80) - winPercent(30))
  assert.equal(signed[1].accuracy, lichessMoveAccuracy(winPercent(-30) - winPercent(-120)))
  checks.push('white and black scores use the correct point of view')

  const namedMistake = fromSan('e4').map((record) => ({ ...record, bookMove: true }))
  const mistakenBook = await analyseRecordedGame(namedMistake, async (fen) => legalResult(fen, fen === namedMistake[0].fenBefore ? 0 : 500))
  assert.equal(mistakenBook[0].label, 'blunder')
  assert.equal(mistakenBook[0].bookMove, false, 'known opening names must not hide losing moves behind a Theory badge')
  assert.equal(mistakenBook[0].openingName, 'Fixture')
  const inaccurateBook = await analyseRecordedGame(namedMistake, async (fen) => legalResult(fen, fen === namedMistake[0].fenBefore ? 0 : 150))
  assert.equal(inaccurateBook[0].label, 'inaccuracy')
  assert.equal(inaccurateBook[0].bookMove, false)
  checks.push('known opening context does not override engine-confirmed mistakes with a book badge')

  let longRecords
  for (let seedStart = 1; seedStart <= 30; seedStart += 1) {
    const game = new Chess()
    const candidate = []
    let seed = seedStart
    while (candidate.length < 220 && !game.isGameOver()) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      const moves = game.moves({ verbose: true })
      candidate.push(recordMove(game, moves[seed % moves.length]))
    }
    if (candidate.length === 220) { longRecords = candidate; break }
  }
  assert.ok(longRecords, 'fixture must exceed 120 plies')
  for (const playerColor of ['w', 'b']) {
    const records = longRecords.map((record) => ({ ...record, actor: record.color === playerColor ? 'player' : 'engine' }))
    const progress = []
    const items = await analyseRecordedGame(records, async (fen) => legalResult(fen), {
      onProgress: (partial, percent) => progress.push({ count: partial.length, percent }),
    })
    assert.equal(items.length, 220)
    assert.equal(items.filter((move) => move.actor === 'player').length, 110)
    assert.deepEqual(progress.at(-1), { count: 220, percent: 100 })
    assert.ok(progress.slice(0, -1).every(({ percent }) => percent < 100), '220-ply analysis must never round unfinished progress to 100%')
    assert.ok(items.every((move) => Number.isFinite(move.accuracy) && move.accuracy >= 0 && move.accuracy <= 100))
  }
  checks.push('220-ply games complete for both colors; progress stays below 100% until the final move')

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
  const repeated = await analyseRecordedGame(repetition, async (fen, _, __, history) => {
    repetitionCalls.push(fen)
    return legalResult(fen, history.moves.length)
  })
  assert.notEqual(repeated[0].beforeEvaluationCp, repeated[4].beforeEvaluationCp, 'repeated positions must not share evaluations across different histories')
  assert.equal(repeated.at(-1).evaluationCp, 0)
  assert.ok(!repetitionCalls.includes(repetition.at(-1).fenAfter), 'threefold draw requires actual game history')
  const afterDraw = new Chess()
  const continued = repetition.map((record) => { afterDraw.move(record.san); return record })
  continued.push(recordMove(afterDraw, 'e4'))
  await assert.rejects(analyseRecordedGame(continued, async (fen) => legalResult(fen)), /positions/)
  const mate = await analyseRecordedGame(fromSan('f3 e5 g4 Qh4#'), async (fen) => legalResult(fen))
  assert.equal(mate.at(-1).evaluationCp, -10_000)
  assert.deepEqual(mate.at(-1).consequenceVariationUci, [])
  assert.deepEqual(mate.at(-1).consequenceVariationFens, [mate.at(-1).fenAfter])
  assert.ok(mate.at(-1).mistakeExplanation.en.includes('Black delivers checkmate'))
  assert.deepEqual(repeated.at(-1).consequenceVariationUci, [])
  assert.equal(repeated.at(-1).mistakeExplanation.en, 'The game ends in a draw after this move.')
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
  const trade = fromSan('e4 e5 Nf3 Nc6 Bb5 Nf6 Bxc6')
  const tradeReview = await analyseRecordedGame(trade, async (fen) => legalResult(fen, undefined, fen === trade.at(-1).fenBefore ? [trade.at(-1).uci] : undefined))
  assert.notEqual(tradeReview.at(-1).label, 'brilliant')
  checks.push('ordinary bishop-for-knight trades with an immediate recapture are not brilliant')


  assert.equal(gameAccuracy([]), 0)
  assert.equal(lichessMoveAccuracy(0), 100)
  assert.equal(lichessMoveAccuracy(-1), 100)
  assert.equal(winPercent(10_000), winPercent(1000))
  assert.equal(winPercent(-10_000), winPercent(-1000))
  // Independently calculated reference values from the pinned Lichess algorithm.
  // Trace values are White-point-of-view post-move centipawns, starting at 15 cp.
  const accuracyTraces = [
    { cps: [...Array(20).fill(15), -900], white: 46.85340283303506, black: 100 },
    { cps: [...Array(21).fill(15), 900], white: 100, black: 49.387960289369005 },
    { cps: [...Array(16).fill(15), ...Array(6).fill(-900), ...Array(18).fill(0)], white: 75.66773321916853, black: 100 },
    { cps: Array.from({ length: 100 }, (_, index) => index % 2 ? 15 : -135), white: 55.00066213346548, black: 55.00066213346548 },
    { cps: Array.from({ length: 32 }, (_, index) => [5, 20, 10, 30, 25, 0, 15, 10][index % 8]), white: 98.68565362329005, black: 97.15543740425468 },
    { cps: Array.from({ length: 86 }, (_, index) => [-200, 150, -300, 400, 700, -600, 10_000, -10_000][index % 8]), white: 60.711975083570074, black: 37.7045530285869 },
    { cps: [...Array.from({ length: 40 }, (_, index) => [5, 20, 10, 30, 25, 0, 15, 10][index % 8]), ...Array.from({ length: 46 }, (_, index) => [-200, 150, -300, 400, 700, -600, 10_000, -10_000][index % 8])], white: 68.16445296754918, black: 44.13319615890589 },
    { cps: [10_000, 10_000, -10_000, -10_000], white: 25.99009900990099, black: 100 },
  ]
  for (const { cps, white, black } of accuracyTraces) {
    const moves = cps.map((cp, index) => {
      const before = index ? cps[index - 1] : 15
      const sign = index % 2 ? -1 : 1
      return { color: sign === 1 ? 'w' : 'b', beforeEvaluationCp: before, evaluationCp: cp,
        accuracy: lichessMoveAccuracy(winPercent(before * sign) - winPercent(cp * sign)) }
    })
    assert.ok(Math.abs(gameAccuracy(moves, 'w') - white) < 1e-9)
    assert.ok(Math.abs(gameAccuracy(moves, 'b') - black) < 1e-9)
  }
  checks.push('Lichess reference accuracy: both colors, volatility weighting, windows of 2/3/4/8, CP/mate clamp and uncertainty bonus')
  assert.equal(gamePerformance(99, 1400, 0, 0), null)
  assert.equal(gamePerformance(99, 1400, 0, 9), null)
  assert.equal(typeof gamePerformance(88, 1400, .5, 10), 'number')
  checks.push('short/book-only samples cannot produce a misleading game-level estimate')

  for (const check of checks) console.log(`PASS ${check}`)
} finally {
  await unlink(runtimePath)
}
