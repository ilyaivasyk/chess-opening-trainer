import { Chess } from 'chess.js'

export type EngineStrength = 800 | 1200 | 1600 | 1800 | 2000 | 3000

export type EngineAnalysis = { bestMove: string | null; scoreCp: number; principalVariation: string[] }

export class StockfishEngine {
  private worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`)
  private ready: Promise<void>
  private rejectReady?: (error: Error) => void
  private readyTimer?: number
  private destroyed = false
  private resolveSearch?: (result: EngineAnalysis) => void
  private rejectSearch?: (error: Error) => void
  private searchTimer?: number
  private lines = new Map<string, { depth: number; scoreCp: number; principalVariation: string[] }>()

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      this.rejectReady = reject
      this.readyTimer = window.setTimeout(() => reject(new Error('Stockfish did not start')), 12_000)
      this.worker.onerror = () => {
        window.clearTimeout(this.readyTimer)
        const error = new Error('Could not load Stockfish')
        reject(error)
        this.rejectSearch?.(error)
      }
      this.worker.onmessage = ({ data }) => {
        if (typeof data !== 'string') return
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
          if (depth && (cp || mate) && pv && (!multiPv || multiPv[1] === '1') && !/\b(?:lowerbound|upperbound)\b/.test(line)) {
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
          if (line.startsWith('bestmove ')) {
            const move = line.split(' ')[1]
            window.clearTimeout(this.searchTimer)
            const bestMove = move === '(none)' ? null : move
            const matched = bestMove ? this.lines.get(bestMove) : null
            if (bestMove && !matched) this.rejectSearch?.(new Error('Stockfish did not return a score for its best move'))
            else this.resolveSearch?.({ bestMove, scoreCp: matched?.scoreCp ?? 0, principalVariation: matched?.principalVariation ?? [] })
            this.resolveSearch = undefined
            this.rejectSearch = undefined
          }
        }
      }
    })
    void this.ready.catch(() => {})
    this.worker.postMessage('uci')
  }

  async bestMove(fen: string, strength: EngineStrength): Promise<string | null> {
    return (await this.analyse(fen, strength, strength >= 2000 ? 700 : 350)).bestMove
  }

  async analyse(fen: string, strength: EngineStrength = 3000, moveTime = 300): Promise<EngineAnalysis> {
    if (this.destroyed) throw new Error('Stockfish is stopped')
    const position = new Chess(fen)
    if (position.isCheckmate()) return { bestMove: null, scoreCp: -10_000, principalVariation: [] }
    if (position.isDraw()) return { bestMove: null, scoreCp: 0, principalVariation: [] }
    await this.ready
    if (this.destroyed) throw new Error('Stockfish is stopped')
    if (this.resolveSearch) throw new Error('Stockfish is already searching')
    this.configure(strength)
    this.lines.clear()
    const result = new Promise<EngineAnalysis>((resolve, reject) => {
      this.resolveSearch = resolve
      this.rejectSearch = reject
      this.searchTimer = window.setTimeout(() => {
        this.worker.postMessage('stop')
        reject(new Error('Stockfish did not respond in time'))
        this.resolveSearch = undefined
        this.rejectSearch = undefined
      }, 8_000)
    })
    this.worker.postMessage(`position fen ${fen}`)
    this.worker.postMessage(`go movetime ${moveTime}`)
    return result
  }

  destroy() {
    this.destroyed = true
    window.clearTimeout(this.readyTimer)
    window.clearTimeout(this.searchTimer)
    this.rejectReady?.(new Error('Stockfish is stopped'))
    this.rejectReady = undefined
    this.rejectSearch?.(new Error('Stockfish search was stopped'))
    this.resolveSearch = undefined
    this.rejectSearch = undefined
    this.worker.postMessage('quit')
    this.worker.terminate()
  }

  private configure(strength: EngineStrength) {
    if (strength < 1600) {
      this.worker.postMessage('setoption name UCI_LimitStrength value false')
      this.worker.postMessage(`setoption name Skill Level value ${strength === 800 ? 0 : 4}`)
      return
    }

    if (strength === 3000) {
      this.worker.postMessage('setoption name UCI_LimitStrength value false')
      this.worker.postMessage('setoption name Skill Level value 20')
      return
    }

    this.worker.postMessage('setoption name UCI_LimitStrength value true')
    this.worker.postMessage(`setoption name UCI_Elo value ${strength}`)
  }
}
