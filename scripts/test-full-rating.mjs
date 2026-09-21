import { spawn } from 'node:child_process'
import { Chess } from 'chess.js'

const enginePath = new URL('../node_modules/stockfish/bin/stockfish-19-asm.js', import.meta.url)

class UciEngine {
  constructor(elo) {
    this.process = spawn(process.execPath, [enginePath.pathname], { stdio: ['pipe', 'pipe', 'inherit'] })
    this.lines = []
    this.waiters = []
    this.buffer = ''
    this.lastScore = 0
    this.process.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString()
      const parts = this.buffer.split(/\r?\n/)
      this.buffer = parts.pop() || ''
      for (const line of parts) this.push(line.trim())
    })
    this.ready = this.start(elo)
  }

  push(line) {
    const cp = line.match(/\bscore cp (-?\d+)/)
    const mate = line.match(/\bscore mate (-?\d+)/)
    if (cp) this.lastScore = Number(cp[1])
    if (mate) this.lastScore = Number(mate[1]) > 0 ? 10_000 : -10_000
    const waiter = this.waiters[0]
    if (waiter?.match(line)) {
      this.waiters.shift()
      waiter.resolve(line)
    } else this.lines.push(line)
  }

  send(command) {
    this.process.stdin.write(`${command}\n`)
  }

  wait(match) {
    const found = this.lines.findIndex(match)
    if (found >= 0) return Promise.resolve(this.lines.splice(found, 1)[0])
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Stockfish timeout')), 30_000)
      this.waiters.push({ match, resolve: (line) => { clearTimeout(timer); resolve(line) } })
    })
  }

  async start(elo) {
    this.send('uci')
    await this.wait((line) => line === 'uciok')
    if (elo === 'max') {
      this.send('setoption name UCI_LimitStrength value false')
      this.send('setoption name Skill Level value 20')
    } else {
      this.send('setoption name UCI_LimitStrength value true')
      this.send(`setoption name UCI_Elo value ${elo}`)
    }
    this.send('isready')
    await this.wait((line) => line === 'readyok')
  }

  async search(fen, moveTime) {
    await this.ready
    this.lastScore = 0
    this.send(`position fen ${fen}`)
    this.send(`go movetime ${moveTime}`)
    const line = await this.wait((value) => value.startsWith('bestmove '))
    return { move: line.split(' ')[1], scoreCp: this.lastScore }
  }

  close() {
    this.send('quit')
    this.process.kill()
  }
}

function winPercent(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

function moveAccuracy(drop) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669))
}

function estimate(accuracy, serious, blunders, totalMoves, samples) {
  let quality = accuracy < 45 ? 400
    : accuracy < 58 ? 600
      : accuracy < 70 ? 850
        : accuracy < 80 ? 1100
          : accuracy < 88 ? 1400
            : accuracy < 93 ? 1750
              : accuracy < 96 ? 2000
                : 2300
  const seriousPer40 = serious * 40 / totalMoves
  const blundersPer40 = blunders * 40 / totalMoves
  if (seriousPer40 >= 8) quality -= 100
  else if (seriousPer40 >= 6) quality -= 50
  if (blundersPer40 >= 3) quality -= 100
  else if (blundersPer40 >= 2) quality -= 50
  const score = samples.reduce((sum, game) => sum + game.score, 0) / samples.length
  const performance = 1800 + (score >= .875 ? 300 : score >= .625 ? 150 : score >= .375 ? 0 : score >= .125 ? -150 : -300)
  const center = Math.round(((quality + performance) / 2) / 50) * 50
  return [Math.max(100, center - 250), Math.min(2800, center + 250), center]
}

const white = new UciEngine(1800)
const black = new UciEngine(1800)
const analyst = new UciEngine('max')
async function playFullGame(playerColor) {
  const game = new Chess()
  const qualities = []

  for (let ply = 0; ply < 300 && !game.isGameOver(); ply += 1) {
    const beforeFen = game.fen()
    const isPlayerMove = game.turn() === playerColor
    const player = game.turn() === 'w' ? white : black
    const before = isPlayerMove ? await analyst.search(beforeFen, 360) : null
    const choice = await player.search(beforeFen, 350)
    if (!choice.move || choice.move === '(none)') break
    const move = game.move({ from: choice.move.slice(0, 2), to: choice.move.slice(2, 4), promotion: choice.move[4] || 'q' })
    if (!move) throw new Error(`Illegal move: ${choice.move}`)
    if (before) {
      const after = await analyst.search(game.fen(), 360)
      const cpLoss = Math.max(0, Math.min(1000, before.scoreCp + after.scoreCp))
      const winDrop = Math.max(0, winPercent(before.scoreCp) - winPercent(-after.scoreCp))
      qualities.push({ cpLoss, winDrop, accuracy: moveAccuracy(winDrop) })
    }
  }

  if (!game.isGameOver()) throw new Error(`${playerColor}: game did not finish after ${game.history().length} plies`)
  const arithmetic = qualities.reduce((sum, move) => sum + move.accuracy, 0) / qualities.length
  const harmonic = qualities.length / qualities.reduce((sum, move) => sum + 1 / Math.max(1, move.accuracy), 0)
  return {
    color: playerColor,
    plies: game.history().length,
    result: game.isCheckmate() ? 'checkmate' : 'draw',
    score: game.isDraw() ? .5 : game.turn() === playerColor ? 0 : 1,
    moves: qualities.length,
    accuracy: (arithmetic + harmonic) / 2,
    serious: qualities.filter((move) => move.winDrop >= 6 || move.cpLoss >= 100).length,
    blunders: qualities.filter((move) => move.winDrop >= 12 || move.cpLoss >= 200).length,
  }
}

try {
  const samples = [await playFullGame('w'), await playFullGame('b')]
  const totalMoves = samples.reduce((sum, game) => sum + game.moves, 0)
  const accuracy = samples.reduce((sum, game) => sum + game.accuracy * game.moves, 0) / totalMoves
  const serious = samples.reduce((sum, game) => sum + game.serious, 0)
  const blunders = samples.reduce((sum, game) => sum + game.blunders, 0)
  const [low, high, center] = estimate(accuracy, serious, blunders, totalMoves, samples)
  for (const sample of samples) console.log(`✓ ${sample.color === 'w' ? 'White' : 'Black'} game: ${sample.plies} plies, ${sample.result}, score ${sample.score}, accuracy ${Math.round(sample.accuracy)}%`)
  console.log(`✓ Both colors analysed: ${totalMoves} player moves, serious: ${serious}, blunders: ${blunders}`)
  console.log(`✓ Estimated level: ≈${center}, range ${low}–${high}`)
} finally {
  white.close()
  black.close()
  analyst.close()
}
