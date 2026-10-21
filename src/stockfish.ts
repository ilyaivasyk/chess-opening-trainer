import { Chess } from 'chess.js'

// Both engines use their built-in CCRL Elo calibration; 3000 is unrestricted MAX.
// Fairy-Stockfish's HCE engine supports the targets below Stockfish 19's 1320 minimum.
export const ENGINE_STRENGTHS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2400, 3000] as const
export type EngineStrength = typeof ENGINE_STRENGTHS[number]
export type EngineHistory = { initialFen: string; moves: string[] }

export type EngineAnalysis = { bestMove: string | null; scoreCp: number; principalVariation: string[] }

export class StockfishEngine {
  private worker: Worker
  private lowStrengthEngine?: StockfishEngine
  private delegatedSearch = false
  private ready: Promise<void>
  private rejectReady?: (error: Error) => void
  private readyTimer?: number
  private destroyed = false
  private resolveSearch?: (result: EngineAnalysis) => void
  private rejectSearch?: (error: Error) => void
  private searchTimer?: number
  private lines = new Map<string, { depth: number; scoreCp: number; principalVariation: string[] }>()
  private searchFen = ''
  private searchPosition = ''
  private searchMoveTime = 300
  private requireExactScore = true
  private recoveredSearch = false

  constructor(private readonly flavor: 'stockfish' | 'fairy' = 'stockfish') {
    this.worker = new Worker(`${import.meta.env.BASE_URL}${flavor === 'fairy' ? 'fairy-stockfish/worker.js' : 'stockfish/stockfish-19-lite-single.js'}`)
    this.ready = new Promise((resolve, reject) => {
      this.rejectReady = reject
      this.readyTimer = window.setTimeout(() => {
        reject(new Error('Stockfish did not start'))
        this.destroy()
      }, 12_000)
      const failWorker = () => {
        window.clearTimeout(this.readyTimer)
        const error = new Error('Could not load Stockfish')
        reject(error)
        this.failSearch(error)
        this.destroy()
      }
      this.worker.onerror = failWorker
      this.worker.onmessage = ({ data }) => {
        if (data && typeof data === 'object' && 'error' in data) {
          failWorker()
          return
        }
        if (this.destroyed || typeof data !== 'string') return
        for (const line of data.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
          if (line === 'uciok') {
            window.clearTimeout(this.readyTimer)
            this.rejectReady = undefined
            resolve()
          }
          const depth = line.match(/^info\b.*\bdepth (\d+)/)
          const cp = line.match(/\bscore cp (-?\d+)/)
          const mate = line.match(/\bscore mate (-?\d+)/)
          const multiPv = line.match(/\bmultipv (\d+)/)
          const pv = line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?(?:\s+[a-h][1-8][a-h][1-8][qrbn]?)*)\s*$/)
          if (this.resolveSearch && depth && (cp || mate) && pv && (!multiPv || multiPv[1] === '1') && !/\b(?:lowerbound|upperbound)\b/.test(line)) {
            const principalVariation = pv[1].split(' ')
            const bestMove = principalVariation[0]
            const previous = this.lines.get(bestMove)
            const currentDepth = Number(depth[1])
            if (!previous || currentDepth >= previous.depth) {
              this.lines.set(bestMove, {
                depth: currentDepth,
                scoreCp: cp ? Number(cp[1]) : Number(mate![1]) > 0 ? 10_000 : -10_000,
                principalVariation,
              })
            }
          }
          if (this.resolveSearch && line.startsWith('bestmove ')) {
            const move = line.split(' ')[1]
            const bestMove = move === '(none)' ? null : move
            const matched = bestMove ? this.lines.get(bestMove) : null
            if (!bestMove) {
              this.failSearch(new Error('Stockfish returned no move in an unfinished position'))
              continue
            } else {
              try {
                new Chess(this.searchFen).move({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove[4] || 'q' })
              } catch {
                this.failSearch(new Error('Stockfish returned an illegal move'))
                continue
              }
            }
            if (this.requireExactScore && bestMove && !matched) {
              // A timed search may finish on an aspiration-window bound for a
              // newly selected move. Evaluate that root move once more instead
              // of assigning another move's score to it in the review.
              if (!this.recoveredSearch) {
                this.recoveredSearch = true
                this.lines.clear()
                this.worker.postMessage(this.searchPosition)
                this.worker.postMessage(`go movetime ${Math.max(300, this.searchMoveTime)} searchmoves ${bestMove}`)
                continue
              }
              this.failSearch(new Error('Stockfish did not return an exact score for its best move'))
              continue
            }
            window.clearTimeout(this.searchTimer)
            this.resolveSearch({ bestMove, scoreCp: matched?.scoreCp ?? 0, principalVariation: matched?.principalVariation ?? (bestMove ? [bestMove] : []) })
            this.resolveSearch = undefined
            this.rejectSearch = undefined
          }
        }
      }
    })
    void this.ready.catch(() => {})
    this.worker.postMessage('uci')
  }

  async bestMove(fen: string, strength: EngineStrength, history?: EngineHistory): Promise<string | null> {
    return (await this.search(fen, strength, strength >= 2000 ? 700 : 350, false, history)).bestMove
  }

  async analyse(fen: string, strength: EngineStrength = 3000, moveTime = 300, history?: EngineHistory): Promise<EngineAnalysis> {
    return this.search(fen, strength, moveTime, true, history)
  }

  private async search(fen: string, strength: EngineStrength, moveTime: number, requireExactScore: boolean, history?: EngineHistory): Promise<EngineAnalysis> {
    if (this.destroyed) throw new Error('Stockfish is stopped')
    if (!ENGINE_STRENGTHS.includes(strength)) throw new Error('Unsupported Stockfish strength')
    const position = new Chess(history?.initialFen ?? fen)
    const initialFen = position.fen()
    for (const uci of history?.moves ?? []) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) || position.isGameOver()) throw new Error('Invalid engine move history')
      position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    }
    if (history && position.fen() !== fen) throw new Error('Engine history does not match position')
    const positionCommand = `position fen ${initialFen}${history?.moves.length ? ` moves ${history.moves.join(' ')}` : ''}`
    if (position.isCheckmate()) return { bestMove: null, scoreCp: -10_000, principalVariation: [] }
    if (position.isDraw()) return { bestMove: null, scoreCp: 0, principalVariation: [] }
    if (this.flavor === 'stockfish' && strength <= 1200) {
      if (this.resolveSearch || this.delegatedSearch) throw new Error('Stockfish is already searching')
      this.delegatedSearch = true
      try {
        this.lowStrengthEngine ??= new StockfishEngine('fairy')
        return await this.lowStrengthEngine.search(fen, strength, moveTime, requireExactScore, history)
      } finally {
        this.delegatedSearch = false
        if (this.lowStrengthEngine?.destroyed) this.lowStrengthEngine = undefined
      }
    }
    await this.ready
    if (this.destroyed) throw new Error('Stockfish is stopped')
    if (this.resolveSearch || this.delegatedSearch) throw new Error('Stockfish is already searching')
    this.configure(strength)
    this.lines.clear()
    this.searchFen = position.fen()
    this.searchPosition = positionCommand
    this.searchMoveTime = moveTime
    this.requireExactScore = requireExactScore
    this.recoveredSearch = false
    const result = new Promise<EngineAnalysis>((resolve, reject) => {
      this.resolveSearch = resolve
      this.rejectSearch = reject
      this.searchTimer = window.setTimeout(() => {
        this.failSearch(new Error('Stockfish did not respond in time'))
        // Do not reuse a timed-out worker: its late bestmove belongs to the old
        // search and could otherwise finish a new search with a stale result.
        this.worker.postMessage('stop')
        this.destroy()
      }, 8_000)
    })
    this.worker.postMessage(this.searchPosition)
    this.worker.postMessage(`go movetime ${moveTime}`)
    return result
  }

  private failSearch(error: Error) {
    window.clearTimeout(this.searchTimer)
    this.rejectSearch?.(error)
    this.resolveSearch = undefined
    this.rejectSearch = undefined
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    window.clearTimeout(this.readyTimer)
    window.clearTimeout(this.searchTimer)
    this.rejectReady?.(new Error('Stockfish is stopped'))
    this.rejectReady = undefined
    this.rejectSearch?.(new Error('Stockfish search was stopped'))
    this.resolveSearch = undefined
    this.rejectSearch = undefined
    this.lowStrengthEngine?.destroy()
    this.lowStrengthEngine = undefined
    this.worker.postMessage('quit')
    this.worker.terminate()
  }

  private configure(strength: EngineStrength) {
    if (strength === 3000) {
      this.worker.postMessage('setoption name UCI_LimitStrength value false')
      this.worker.postMessage('setoption name Skill Level value 20')
      return
    }

    this.worker.postMessage('setoption name UCI_LimitStrength value true')
    this.worker.postMessage(`setoption name UCI_Elo value ${strength}`)
  }
}
