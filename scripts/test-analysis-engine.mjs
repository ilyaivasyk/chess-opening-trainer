import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { Chess } from 'chess.js'
import ts from 'typescript'
import { build } from 'esbuild'

// Run the browser wrapper against the same bytes shipped in the PWA. The npm
// package lives in a CommonJS scope, which the engine's Node entry point needs.
const shipped = new URL('../public/stockfish/', import.meta.url)
const packageBuild = new URL('../node_modules/stockfish/bin/', import.meta.url)
const fairyBuild = new URL('../public/fairy-stockfish/', import.meta.url)
for (const name of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  assert.deepEqual(await readFile(new URL(name, shipped)), await readFile(new URL(name, packageBuild)), `${name}: test and PWA builds must be identical`)
}

const pipelinePath = new URL(`./.analysis-pipeline-real-${process.pid}.mjs`, import.meta.url)
const pipeline = await build({ entryPoints: [new URL('../src/game-analysis.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', target: 'es2022', external: ['chess.js'], write: false })
await writeFile(pipelinePath, pipeline.outputFiles[0].contents)

const runtimePath = new URL(`./.analysis-engine-test-${process.pid}.mjs`, import.meta.url)
const source = (await readFile(new URL('../src/stockfish.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.BASE_URL', "'/'")
await writeFile(runtimePath, ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)

const workers = []
// Execute the exact browser bridge and glue in an isolated process, with the
// browser-only globals and local fetch adapter. SAB/Atomics are absent, as on
// the GitHub Pages deployment; the synchronous search cannot block this runner.
const fairyBootstrap = String.raw`
  const fs = require('node:fs');
  const vm = require('node:vm');
  const path = require('node:path');
  const readline = require('node:readline');
  const { pathToFileURL, fileURLToPath } = require('node:url');
  const directory = process.argv[1];
  const scope = {
    console, URL, TextDecoder, TextEncoder, WebAssembly,
    setTimeout, clearTimeout, performance,
    SharedArrayBuffer: undefined, Atomics: undefined,
    WorkerGlobalScope: function WorkerGlobalScope() {},
    location: { href: pathToFileURL(path.join(directory, 'worker.js')).href },
    postMessage: (data) => process.stdout.write(JSON.stringify(data) + '\n'),
    fetch: async (url) => new Response(fs.readFileSync(fileURLToPath(url)), {
      headers: { 'Content-Type': 'application/wasm' },
    }),
  };
  scope.self = scope;
  const context = vm.createContext(scope);
  scope.importScripts = (url) => vm.runInContext(
    fs.readFileSync(fileURLToPath(new URL(url, scope.location.href)), 'utf8'), context,
  );
  vm.runInContext(fs.readFileSync(path.join(directory, 'worker.js'), 'utf8'), context);
  readline.createInterface({ input: process.stdin }).on('line', (data) => scope.onmessage({ data }));
`
class EngineWorker {
  onmessage
  onerror
  messages = []
  output = []
  terminated = false
  buffer = ''

  constructor(url) {
    this.url = url
    this.fairy = url.includes('fairy-stockfish/')
    workers.push(this)
    this.process = spawn(process.execPath, this.fairy
      ? ['--input-type=commonjs', '-e', fairyBootstrap, fairyBuild.pathname]
      : [new URL('stockfish-19-lite-single.js', packageBuild).pathname], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.process.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString()
      const lines = this.buffer.split(/\r?\n/)
      this.buffer = lines.pop() || ''
      for (const line of lines) {
        const data = this.fairy ? JSON.parse(line) : line.trim()
        if (typeof data === 'string') this.output.push(data)
        this.onmessage?.({ data })
      }
    })
    this.process.on('error', (error) => this.onerror?.(error))
    this.process.on('exit', (code) => {
      if (!this.terminated) this.onerror?.(new Error(`Real Stockfish exited: ${code}`))
    })
    this.process.stderr.on('data', (chunk) => {
      if (!this.terminated) this.onerror?.(new Error(chunk.toString()))
    })
  }

  postMessage(message) {
    this.messages.push(message)
    if (!this.terminated) this.process.stdin.write(`${message}\n`)
  }

  terminate() {
    this.terminated = true
    this.process.kill()
  }
}

globalThis.window = { setTimeout, clearTimeout }
globalThis.Worker = EngineWorker

function playUci(position, uci) {
  return position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' })
}

function verifyVariation(fen, result) {
  assert.ok(Number.isFinite(result.scoreCp), 'evaluation must be finite')
  if (!result.bestMove) {
    assert.equal(result.principalVariation.length, 0)
    return
  }
  assert.equal(result.principalVariation[0], result.bestMove, 'first PV move must be the returned best move')
  const position = new Chess(fen)
  for (const uci of result.principalVariation) playUci(position, uci)
}

try {
  const { StockfishEngine, ENGINE_STRENGTHS } = await import(runtimePath.href)
  const engine = new StockfishEngine()
  const worker = workers[0]
  const search = async (fen, strength = 3000, time = 200, history) => {
    const outputStart = worker.output.length
    let result
    try { result = await engine.analyse(fen, strength, time, history) }
    catch (error) {
      console.error({ fen, strength, output: worker.output.slice(outputStart) })
      throw error
    }
    verifyVariation(fen, result)
    if (result.bestMove) {
      const exactLines = worker.output.slice(outputStart).filter((line) => line.startsWith('info ')
        && !/\b(?:upperbound|lowerbound)\b/.test(line)
        && (!line.includes('multipv ') || line.includes('multipv 1 '))
        && line.includes(`pv ${result.bestMove}`))
      assert.ok(exactLines.length, 'returned score/PV must have a matching exact engine line in this search')
    }
    return result
  }

  // A known mate is deterministic and proves the line starts BEFORE the move,
  // on Black's turn; applying it from the post-move position must be illegal.
  const foolsMate = new Chess()
  foolsMate.loadPgn('1. f3 e5 2. g4')
  const mateBefore = foolsMate.fen()
  const blackMate = await search(mateBefore)
  assert.ok(worker.output.includes('option name UCI_Elo type spin default 1320 min 1320 max 3190'), 'configured Elo values must stay within the exact bundled engine range')
  assert.ok(worker.output.includes('option name Skill Level type spin default 20 min 0 max 20'))
  assert.equal(blackMate.bestMove, 'd8h4')
  assert.equal(blackMate.scoreCp, 10_000)
  playUci(foolsMate, blackMate.bestMove)
  assert.ok(foolsMate.isCheckmate())
  assert.throws(() => playUci(new Chess(foolsMate.fen()), blackMate.bestMove))
  const matedWhite = await search(foolsMate.fen())
  assert.equal(matedWhite.scoreCp, -10_000)
  assert.equal(blackMate.scoreCp + matedWhite.scoreCp, 0, 'a correct mate must have zero loss across the side-to-move sign change')

  const whiteTactic = '4k3/8/8/8/3q4/8/3R4/4K3 w - - 0 1'
  const blackTactic = '4k3/3r4/8/3Q4/8/8/8/4K3 b - - 0 1'
  for (const [fen, winningMove] of [[whiteTactic, 'd2d4'], [blackTactic, 'd7d5']]) {
    const before = await search(fen)
    assert.equal(before.bestMove, winningMove, 'both colors must find the hanging queen')
    assert.ok(before.scoreCp > 200, 'advantage is positive for the moving side')
    const played = new Chess(fen)
    playUci(played, winningMove)
    const after = await search(played.fen())
    assert.ok(after.scoreCp < -200, 'the same winning position is negative for the opponent to move')
    assert.ok(Math.max(0, before.scoreCp + after.scoreCp) < 150, 'a best tactic must not be reported as a major loss after switching sides')

    const missed = new Chess(fen)
    missed.move(fen.split(' ')[1] === 'w' ? 'Kf1' : 'Kf8')
    const missedAfter = await search(missed.fen())
    assert.ok(before.scoreCp + missedAfter.scoreCp > 300, 'missing the free queen must lose value, for White and Black')
  }

  // Run the actual strength changes on one worker, as rating and review do.
  const opening = new Chess()
  opening.loadPgn('1. e4 e5 2. Nf3 Nc6')
  assert.deepEqual(ENGINE_STRENGTHS, [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2400, 3000])
  assert.equal(workers.length, 1, 'MAX analysis must not load Fairy')
  const openingHistory = { initialFen: new Chess().fen(), moves: opening.history({ verbose: true }).map((move) => `${move.from}${move.to}${move.promotion ?? ''}`) }
  for (const strength of [600, 800, 1000, 1200]) {
    const move = await engine.bestMove(opening.fen(), strength, openingHistory)
    assert.ok(move)
    playUci(new Chess(opening.fen()), move)
    const fairy = workers.find((item) => item.fairy)
    assert.ok(fairy.output.includes('option name UCI_Elo type spin default 1350 min 500 max 2850'))
    assert.ok(fairy.output.includes('option name Skill Level type spin default 20 min -20 max 20'))
    assert.ok(fairy.messages.includes('setoption name UCI_LimitStrength value true'))
    assert.ok(fairy.messages.includes(`setoption name UCI_Elo value ${strength}`))
    assert.ok(fairy.messages.includes(`position fen ${openingHistory.initialFen} moves ${openingHistory.moves.join(' ')}`))
  }
  assert.equal(workers.length, 2, 'the real Fairy worker must be reused across low targets')
  assert.ok(!worker.messages.some((message) => /UCI_Elo value (600|800|1000|1200)$/.test(message)), 'low targets must never be clamped silently by Stockfish 19')
  const fairy = workers.find((item) => item.fairy)
  const lowAnalysis = await engine.analyse(opening.fen(), 600, 150, openingHistory)
  verifyVariation(opening.fen(), lowAnalysis)
  assert.ok(fairy.output.some((line) => line.includes(`pv ${lowAnalysis.bestMove}`) && !/\b(?:upperbound|lowerbound)\b/.test(line)), 'explicit low-strength analysis must return a matching exact Fairy line')
  for (const fen of [
    '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',
    'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',
  ]) playUci(new Chess(fen), await engine.bestMove(fen, 600))
  console.log('✓ Exact shipped Fairy bridge/JS/WASM without SharedArrayBuffer or Atomics: UCI_Elo 500..2850, legal 600/800/1000/1200 searches, both colors and special positions, history forwarding and exact low-strength analysis')

  for (const strength of ENGINE_STRENGTHS.filter((value) => value > 1200 && value !== 3000)) {
    const optionStart = worker.messages.length
    const move = await engine.bestMove(opening.fen(), strength)
    assert.ok(move)
    playUci(new Chess(opening.fen()), move)
    assert.deepEqual(worker.messages.slice(optionStart, optionStart + 2), [
      'setoption name UCI_LimitStrength value true',
      `setoption name UCI_Elo value ${strength}`,
    ], 'opponents must use Stockfish\'s calibrated UCI_Elo mode')
  }
  const maximumStart = worker.messages.length
  await search(opening.fen(), 3000, 150)
  assert.deepEqual(worker.messages.slice(maximumStart, maximumStart + 2), [
    'setoption name UCI_LimitStrength value false',
    'setoption name Skill Level value 20',
  ], 'review must restore unrestricted maximum strength after a weak opponent')

  const repetition = new Chess()
  const history = { initialFen: repetition.fen(), moves: [] }
  for (const san of 'e4 e5 Qh5 Nf6 Qxe5+ Be7 Qxe7+ Kxe7 Nh3 a6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8 Nf3 Nf6'.split(' ')) {
    assert.ok(!repetition.isGameOver())
    const move = repetition.move(san)
    history.moves.push(`${move.from}${move.to}${move.promotion ?? ''}`)
  }
  assert.ok(!repetition.isGameOver(), 'fixture must still be playable before the drawing move')
  const isolated = await search(repetition.fen(), 3000, 800)
  assert.ok(isolated.scoreCp < -200, 'FEN alone cannot recover the earlier repeated positions')
  const drawingLine = await search(repetition.fen(), 3000, 800, history)
  assert.equal(drawingLine.bestMove, 'f3g1', 'real bundled Stockfish must find the history-dependent saving draw')
  assert.equal(drawingLine.scoreCp, 0)
  assert.equal(await engine.bestMove(repetition.fen(), 3000, history), 'f3g1', 'playing and review must use the same repetition history')
  repetition.move('Ng1')
  history.moves.push('f3g1')
  assert.ok(repetition.isThreefoldRepetition())
  const terminalStart = worker.messages.length
  assert.deepEqual(await search(repetition.fen(), 3000, 100, history), { bestMove: null, scoreCp: 0, principalVariation: [] })
  assert.equal(worker.messages.length, terminalStart, 'history-confirmed terminal draws need no worker search')

  for (const fen of [
    '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
    '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1',
    '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
    '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2',
    'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
  ]) await search(fen)

  const stalemate = await search('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')
  assert.equal(stalemate.bestMove, null)
  assert.equal(stalemate.scoreCp, 0)
  const { analyseRecordedGame } = await import(pipelinePath.href)
  const longGame = new Chess()
  const records = []
  let seed = 17
  for (let ply = 1; ply <= 120; ply += 1) {
    assert.ok(!longGame.isGameOver(), 'long fixture must reach 120 plies')
    const fenBefore = longGame.fen()
    const moves = longGame.moves({ verbose: true })
    seed = (seed * 1664525 + 1013904223) >>> 0
    const move = longGame.move(moves[seed % moves.length])
    records.push({ ply, actor: move.color === 'w' ? 'player' : 'engine', color: move.color,
      san: move.san, uci: `${move.from}${move.to}${move.promotion ?? ''}`, from: move.from, to: move.to,
      captured: move.captured, fenBefore, fenAfter: longGame.fen(), bookMove: false, openingName: '' })
  }
  const results = new Map()
  const analyse = async (fen, strength, time, history) => {
    const key = `${fen}|${strength}|${time}|${history?.initialFen}|${history?.moves.join(' ')}`
    if (!results.has(key)) results.set(key, await search(fen, strength, time, history))
    return results.get(key)
  }
  for (const color of ['w', 'b']) {
    let lastProgress = 0
    const review = await analyseRecordedGame(records.map((record) => ({ ...record, actor: record.color === color ? 'player' : 'engine' })), analyse, {
      onProgress: (_, progress) => { lastProgress = progress },
    })
    assert.equal(review.length, 120)
    assert.equal(lastProgress, 100)
    assert.equal(review.filter((move) => move.actor === 'player').length, 60)
    assert.ok(review.every((move) => move.principalVariationFens[0] === move.fenBefore && move.principalVariationUci[0] === move.bestMove))
  }
  console.log('✓ Real bundled WASM + complete App analysis pipeline: 120 plies, both player colors, every legal pre-move first line, 100% completion')
  engine.destroy()
  assert.ok(worker.terminated && fairy.terminated, 'destroying the wrapper must terminate both real engine processes')
  console.log('✓ Bundled WASM: legal first lines, exact score/PV, both-color tactics, before/after signs, history-dependent saving draw, mate/stalemate, calibrated UCI_Elo strengths→MAX, promotion/en passant/castling positions')

  const cancelledEngine = new StockfishEngine()
  const cancelledStart = workers.length - 1
  const pendingLowSearch = cancelledEngine.analyse(opening.fen(), 600, 60_000)
  const cancelledFairy = workers.at(-1)
  const cancellationDeadline = Date.now() + 12_000
  while (!cancelledFairy.messages.some((message) => message === 'go movetime 60000')) {
    assert.ok(Date.now() < cancellationDeadline, 'real Fairy must start the search before cancellation')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  cancelledEngine.destroy()
  await assert.rejects(pendingLowSearch, /stopped/)
  assert.ok(workers.slice(cancelledStart).every((item) => item.terminated && item.process.killed), 'synchronous search cancellation must terminate every real worker process')
  await assert.rejects(cancelledEngine.bestMove(opening.fen(), 600), /stopped/)

  const restartedEngine = new StockfishEngine()
  const restartedStart = workers.length - 1
  playUci(new Chess(opening.fen()), await restartedEngine.bestMove(opening.fen(), 600))
  playUci(new Chess(opening.fen()), await restartedEngine.bestMove(opening.fen(), 3000))
  restartedEngine.destroy()
  assert.ok(workers.slice(restartedStart).every((item) => item.terminated && item.process.killed))
  console.log('✓ Real Fairy cancellation terminates synchronous search; fresh wrapper restarts 600 and MAX19 without stale results')
} finally {
  for (const worker of workers) worker.terminate()
  await unlink(runtimePath)
  await unlink(pipelinePath)
}
