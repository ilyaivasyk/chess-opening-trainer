import assert from 'node:assert/strict'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { Chess } from 'chess.js'
import ts from 'typescript'

const runtimePath = new URL(`./.stockfish-review-test-${process.pid}.mjs`, import.meta.url)
const source = (await readFile(new URL('../src/stockfish.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.BASE_URL', "'/'")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
await writeFile(runtimePath, compiled)

const workers = []
let fairyScenario = 'auto'
class MockWorker {
  onmessage
  onerror
  messages = []
  terminated = false
  scenario = workers.length === 0 ? 'matched' : workers.length === 3 ? 'auto' : 'silent'

  constructor(url) {
    this.url = url
    if (url.includes('fairy-stockfish/')) this.scenario = fairyScenario
    workers.push(this)
  }
  postMessage(message) {
    this.messages.push(message)
    if (message === 'uci') queueMicrotask(() => this.onmessage?.({ data: 'uciok' }))
    if (message.startsWith('position fen ')) {
      const [fen, moves = ''] = message.slice('position fen '.length).split(' moves ')
      const position = new Chess(fen)
      for (const uci of moves.split(' ').filter(Boolean)) position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
      this.fen = position.fen()
    }
    if (message.startsWith('go ') && this.scenario === 'matched') queueMicrotask(() => {
      for (const line of [
        'info depth 12 multipv 2 score cp 900 pv d2d4 d7d5',
        'info depth 10 score cp -300 pv d2d4 d7d5',
        'info depth 11 score cp 34 pv f1b5 a7a6',
        'info depth 12 score cp -700 pv d2d4 d7d5',
        'bestmove f1b5',
      ]) this.onmessage?.({ data: line })
    })
    if (message.startsWith('go ') && this.scenario === 'auto') queueMicrotask(() => {
      const move = new Chess(this.fen).moves({ verbose: true })[0]
      const uci = `${move.from}${move.to}${move.promotion ?? ''}`
      this.onmessage?.({ data: `info depth 4 score cp 17 pv ${uci}` })
      this.onmessage?.({ data: `bestmove ${uci}` })
    })
    if (message.startsWith('go ') && ['bound', 'bound-only'].includes(this.scenario)) queueMicrotask(() => {
      if (message.includes('searchmoves') && this.scenario === 'bound') {
        this.onmessage?.({ data: 'info depth 12 score cp 40 pv b1c3 g8f6' })
      } else {
        this.onmessage?.({ data: 'info depth 12 score cp 7 upperbound pv b1c3 g8f6' })
      }
      this.onmessage?.({ data: 'bestmove b1c3 ponder g8f6' })
    })
    if (message.startsWith('go ') && this.scenario === 'no-move') queueMicrotask(() => {
      this.onmessage?.({ data: 'bestmove (none)' })
    })
  }
  terminate() { this.terminated = true }
}

globalThis.window = { setTimeout, clearTimeout }
globalThis.Worker = MockWorker

try {
  const { StockfishEngine, ENGINE_STRENGTHS } = await import(runtimePath.href)
  assert.deepEqual(ENGINE_STRENGTHS, [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2400, 3000])
  const game = new Chess()
  game.loadPgn('1. e4 e5 2. Nf3 Nc6 3. Bc4')
  game.undo()
  const fenBefore = game.fen()
  game.move('Bc4')
  const fenAfter = game.fen()

  const engine = new StockfishEngine()
  const analysis = await engine.analyse(fenBefore, 3000, 1)
  assert.equal(analysis.bestMove, 'f1b5')
  assert.equal(analysis.scoreCp, 34, 'score must match bestmove, not a later unrelated PV')
  assert.deepEqual(analysis.principalVariation, ['f1b5', 'a7a6'])
  const line = new Chess(fenBefore)
  const san = analysis.principalVariation.map((uci) => line.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) }).san)
  assert.deepEqual(san, ['Bb5', 'a6'])
  assert.throws(() => new Chess(fenAfter).move({ from: 'f1', to: 'b5' }), 'best line must start before the played move')
  engine.destroy()

  const timeoutEngine = new StockfishEngine()
  await assert.rejects(timeoutEngine.analyse(fenBefore, 3000, 1), /did not respond in time/)
  assert.ok(workers[1].messages.includes('stop'), 'timed-out search must be stopped')
  await assert.rejects(timeoutEngine.analyse(fenBefore, 3000, 1), /stopped/, 'late results must never finish another search on a timed-out worker')
  timeoutEngine.destroy()

  const cancelledEngine = new StockfishEngine()
  const pending = cancelledEngine.analyse(fenBefore, 3000, 1)
  await new Promise((resolve) => setTimeout(resolve, 0))
  cancelledEngine.destroy()
  await assert.rejects(pending, /stopped/)

  const longGame = new Chess()
  const positions = []
  let seed = 17
  for (let ply = 0; ply < 120; ply += 1) {
    assert.ok(!longGame.isGameOver(), 'sample game should reach 120 plies')
    positions.push(longGame.fen())
    const moves = longGame.moves({ verbose: true })
    seed = (seed * 1664525 + 1013904223) >>> 0
    longGame.move(moves[seed % moves.length])
  }
  const longEngine = new StockfishEngine()
  for (const fen of positions) {
    const result = await longEngine.analyse(fen, 3000, 1)
    assert.equal(result.scoreCp, 17)
    const move = result.principalVariation[0]
    new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] || 'q' })
  }
  longEngine.destroy()

  const boundEngine = new StockfishEngine()
  const boundWorker = workers.at(-1)
  boundWorker.scenario = 'bound'
  const historyPosition = new Chess()
  historyPosition.loadPgn('1. e4 e5 2. Nf3 Nc6')
  const history = { initialFen: new Chess().fen(), moves: historyPosition.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`) }
  const activeHistory = { ...history, moves: [...history.moves] }
  const recoveredSearch = boundEngine.analyse(fenBefore, 3000, 1, activeHistory)
  activeHistory.moves.push('quit')
  const recovered = await recoveredSearch
  assert.equal(recovered.bestMove, 'b1c3')
  assert.equal(recovered.scoreCp, 40, 'review must use the recovered exact score, never its earlier bound')
  assert.deepEqual(recovered.principalVariation, ['b1c3', 'g8f6'])
  assert.equal(boundWorker.messages.filter((message) => message.includes('searchmoves b1c3')).length, 1)
  assert.deepEqual(boundWorker.messages.filter((message) => message.startsWith('position ')), Array(2).fill(`position fen ${history.initialFen} moves ${history.moves.join(' ')}`), 'score recovery must preserve repetition history')
  boundEngine.destroy()

  const playingEngine = new StockfishEngine()
  const playingWorker = workers.at(-1)
  playingWorker.scenario = 'bound-only'
  assert.equal(await playingEngine.bestMove(fenBefore, 1400), 'b1c3', 'a legal opponent move does not need a review-quality score')
  assert.ok(!playingWorker.messages.some((message) => message.includes('searchmoves')), 'playing should not perform an extra scored search')
  playingEngine.destroy()

  const unscoredEngine = new StockfishEngine()
  const unscoredWorker = workers.at(-1)
  unscoredWorker.scenario = 'bound-only'
  await assert.rejects(unscoredEngine.analyse(fenBefore, 3000, 1), /exact score/, 'an unresolved score must fail, not create a false completed review')
  assert.equal(unscoredWorker.messages.filter((message) => message.includes('searchmoves')).length, 1, 'recovery must be bounded')
  unscoredEngine.destroy()

  const emptyEngine = new StockfishEngine()
  workers.at(-1).scenario = 'no-move'
  await assert.rejects(emptyEngine.analyse(fenBefore, 3000, 1), /unfinished position/, 'no move in a nonterminal position must not become a fake zero score')
  emptyEngine.destroy()

  const validationEngine = new StockfishEngine()
  const validationWorker = workers.at(-1)
  await assert.rejects(validationEngine.analyse(fenBefore, 3000, 1, { ...history, moves: ['e2e4\nquit'] }), /history/)
  await assert.rejects(validationEngine.analyse(fenBefore, 3000, 1, { ...history, moves: ['e2e5'] }), /Invalid move/)
  await assert.rejects(validationEngine.analyse(fenBefore, 3000, 1, { ...history, moves: [] }), /does not match/)
  await assert.rejects(validationEngine.analyse(fenBefore, 700, 1), /Unsupported Stockfish strength/)
  assert.ok(!validationWorker.messages.some((message) => message.startsWith('go ')), 'invalid history or an unsupported Elo must fail before engine commands')
  validationEngine.destroy()

  const lowEngine = new StockfishEngine()
  const mainWorker = workers.at(-1)
  mainWorker.scenario = 'auto'
  const lazyStart = workers.length
  await lowEngine.analyse(fenBefore, 3000, 1)
  assert.equal(workers.length, lazyStart, 'MAX analysis must never load the second engine')
  for (const strength of [600, 800, 1000, 1200]) {
    assert.ok(await lowEngine.bestMove(fenBefore, strength, history))
    const lowWorker = workers.at(-1)
    assert.equal(lowWorker.url, '/fairy-stockfish/worker.js')
    assert.ok(lowWorker.messages.includes(`setoption name UCI_Elo value ${strength}`))
    assert.ok(lowWorker.messages.includes(`position fen ${history.initialFen} moves ${history.moves.join(' ')}`))
  }
  assert.equal(workers.length, lazyStart + 1, 'low-strength searches must reuse the lazily loaded Fairy worker')
  assert.equal((await lowEngine.analyse(fenBefore, 600, 1, history)).scoreCp, 17, 'explicit low-strength analysis must also use Fairy')
  for (const strength of [1400, 1600, 1800, 2000, 2400, 3000]) await lowEngine.bestMove(fenBefore, strength)
  assert.ok(!mainWorker.messages.some((message) => /UCI_Elo value (600|800|1000|1200)$/.test(message)), 'Stockfish 19 must never receive unsupported low Elo')
  const fairyWorker = workers.at(-1)
  lowEngine.destroy()
  assert.ok(mainWorker.terminated && fairyWorker.terminated, 'destroy must dispose both engine workers')

  fairyScenario = 'silent'
  const cancelledLowEngine = new StockfishEngine()
  const cancelledMainWorker = workers.at(-1)
  const lowPending = cancelledLowEngine.bestMove(fenBefore, 600)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const cancelledFairyWorker = workers.at(-1)
  await assert.rejects(cancelledLowEngine.bestMove(fenBefore, 1400), /already searching/, 'two engines must not allow overlapping wrapper searches')
  cancelledLowEngine.destroy()
  await assert.rejects(lowPending, /stopped/)
  cancelledFairyWorker.onmessage?.({ data: 'bestmove f1b5' })
  assert.ok(cancelledMainWorker.terminated && cancelledFairyWorker.terminated)

  const failedLowEngine = new StockfishEngine()
  const failedMainWorker = workers.at(-1)
  failedMainWorker.scenario = 'auto'
  const failedPending = failedLowEngine.bestMove(fenBefore, 800)
  const failedFairyWorker = workers.at(-1)
  failedFairyWorker.onmessage?.({ data: { error: 'Could not load WASM' } })
  await assert.rejects(failedPending, /Could not load Stockfish/)
  assert.ok(failedFairyWorker.terminated, 'structured WASM-loading errors must clean up the Fairy worker')
  assert.ok(await failedLowEngine.bestMove(fenBefore, 1400), 'failure of the optional engine must not disable Stockfish 19')
  fairyScenario = 'auto'
  assert.ok(await failedLowEngine.bestMove(fenBefore, 800), 'a failed Fairy worker must be recreated on the next low search')
  assert.notEqual(workers.at(-1), failedFairyWorker)
  failedLowEngine.destroy()

  const originalSetTimeout = window.setTimeout
  let expireStartup
  window.setTimeout = (callback, delay) => {
    if (delay === 12_000) expireStartup = callback
    return originalSetTimeout(callback, delay)
  }
  try {
    const startupEngine = new StockfishEngine()
    const startupWorker = workers.at(-1)
    const pendingStartup = startupEngine.analyse(fenBefore, 3000, 1)
    expireStartup()
    await assert.rejects(pendingStartup, /did not start/)
    assert.equal(startupWorker.terminated, true, 'startup timeout must terminate its worker without waiting for another caller')
    startupEngine.destroy()
    assert.equal(startupWorker.messages.filter((message) => message === 'quit').length, 1, 'cleanup must be idempotent')
  } finally { window.setTimeout = originalSetTimeout }
  console.log('✓ Matched score/PV, legal pre-move replay, 120-ply search, startup/search timeout cleanup, cancellation, history-preserving exact-score recovery, lazy Fairy low-Elo routing/retry/disposal, validation, and separate playing API')
} finally {
  await unlink(runtimePath)
}
