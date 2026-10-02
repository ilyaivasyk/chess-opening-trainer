import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { Chess } from 'chess.js'
import ts from 'typescript'

// Run the browser wrapper against the same bytes shipped in the PWA. The npm
// package lives in a CommonJS scope, which the engine's Node entry point needs.
const shipped = new URL('../public/stockfish/', import.meta.url)
const packageBuild = new URL('../node_modules/stockfish/bin/', import.meta.url)
for (const name of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  assert.deepEqual(await readFile(new URL(name, shipped)), await readFile(new URL(name, packageBuild)), `${name}: test and PWA builds must be identical`)
}

const pipelinePath = new URL(`./.analysis-pipeline-real-${process.pid}.mjs`, import.meta.url)
await writeFile(pipelinePath, ts.transpileModule(await readFile(new URL('../src/game-analysis.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)

const runtimePath = new URL(`./.analysis-engine-test-${process.pid}.mjs`, import.meta.url)
const source = (await readFile(new URL('../src/stockfish.ts', import.meta.url), 'utf8'))
  .replace('import.meta.env.BASE_URL', "'/'")
await writeFile(runtimePath, ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)

const workers = []
class EngineWorker {
  onmessage
  onerror
  messages = []
  output = []
  terminated = false
  buffer = ''

  constructor() {
    workers.push(this)
    this.process = spawn(process.execPath, [new URL('stockfish-19-lite-single.js', packageBuild).pathname], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.process.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString()
      const lines = this.buffer.split(/\r?\n/)
      this.buffer = lines.pop() || ''
      for (const line of lines) {
        this.output.push(line.trim())
        this.onmessage?.({ data: line.trim() })
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
  const { StockfishEngine } = await import(runtimePath.href)
  const engine = new StockfishEngine()
  const worker = workers[0]
  const search = async (fen, strength = 3000, time = 200) => {
    const outputStart = worker.output.length
    let result
    try { result = await engine.analyse(fen, strength, time) }
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
  for (const strength of [800, 1200, 1600, 1800, 2000]) {
    const move = await engine.bestMove(opening.fen(), strength)
    assert.ok(move)
    playUci(new Chess(opening.fen()), move)
  }
  const maximumStart = worker.messages.length
  await search(opening.fen(), 3000, 150)
  assert.deepEqual(worker.messages.slice(maximumStart, maximumStart + 2), [
    'setoption name UCI_LimitStrength value false',
    'setoption name Skill Level value 20',
  ], 'review must restore unrestricted maximum strength after a weak opponent')

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
  const analyse = async (fen, strength, time) => {
    const key = `${fen}|${strength}|${time}`
    if (!results.has(key)) results.set(key, await search(fen, strength, time))
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
  console.log('✓ Bundled WASM: legal first lines, exact score/PV, both-color tactics, before/after signs, mate/stalemate, strength→MAX, promotion/en passant/castling positions')
} finally {
  for (const worker of workers) worker.terminate()
  await unlink(runtimePath)
  await unlink(pipelinePath)
}
