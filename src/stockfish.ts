export type EngineStrength = 800 | 1200 | 1600 | 1800 | 2000 | 3000

export type EngineAnalysis = { bestMove: string | null; scoreCp: number; principalVariation: string[] }

export class StockfishEngine {
  private worker = new Worker(`${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`)
  private ready: Promise<void>
  private resolveSearch?: (result: EngineAnalysis) => void
  private rejectSearch?: (error: Error) => void
  private searchTimer?: number
  private lastScore = 0
  private lastPrincipalVariation: string[] = []
  private principalVariations = new Map<string, string[]>()

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('Stockfish не запустився')), 12_000)
      this.worker.onerror = () => {
        window.clearTimeout(timer)
        const error = new Error('Не вдалося завантажити Stockfish')
        reject(error)
        this.rejectSearch?.(error)
      }
      this.worker.onmessage = ({ data }) => {
        if (typeof data !== 'string') return
        for (const line of data.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
          if (line === 'uciok') {
            window.clearTimeout(timer)
            resolve()
          }
          const cp = line.match(/\bscore cp (-?\d+)/)
          const mate = line.match(/\bscore mate (-?\d+)/)
          const principalVariation = line.match(/\bpv (.+)$/)
          if (cp) this.lastScore = Number(cp[1])
          if (mate) this.lastScore = Number(mate[1]) > 0 ? 10_000 : -10_000
          if (principalVariation) {
            const candidate = principalVariation[1].trim().split(/\s+/)
            const previous = this.principalVariations.get(candidate[0]) ?? []
            if (candidate.length >= previous.length) this.principalVariations.set(candidate[0], candidate)
            if (candidate.length >= this.lastPrincipalVariation.length) this.lastPrincipalVariation = candidate
          }
          if (line.startsWith('bestmove ')) {
            const move = line.split(' ')[1]
            window.clearTimeout(this.searchTimer)
            const bestMove = move === '(none)' ? null : move
            this.resolveSearch?.({ bestMove, scoreCp: this.lastScore, principalVariation: bestMove ? this.principalVariations.get(bestMove) ?? [bestMove] : [] })
            this.resolveSearch = undefined
            this.rejectSearch = undefined
          }
        }
      }
    })
    this.worker.postMessage('uci')
  }

  async bestMove(fen: string, strength: EngineStrength): Promise<string | null> {
    return (await this.analyse(fen, strength, strength >= 2000 ? 700 : 350)).bestMove
  }

  async analyse(fen: string, strength: EngineStrength = 3000, moveTime = 300): Promise<EngineAnalysis> {
    await this.ready
    this.configure(strength)
    this.lastScore = 0
    this.lastPrincipalVariation = []
    this.principalVariations.clear()
    const result = new Promise<EngineAnalysis>((resolve, reject) => {
      this.resolveSearch = resolve
      this.rejectSearch = reject
      this.searchTimer = window.setTimeout(() => {
        this.worker.postMessage('stop')
        reject(new Error('Stockfish не відповів вчасно'))
        this.resolveSearch = undefined
        this.rejectSearch = undefined
      }, 8_000)
    })
    this.worker.postMessage(`position fen ${fen}`)
    this.worker.postMessage(`go movetime ${moveTime}`)
    return result
  }

  destroy() {
    window.clearTimeout(this.searchTimer)
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
