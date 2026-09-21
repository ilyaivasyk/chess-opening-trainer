import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Chess, type Move, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import italian from './data/italian.json'
import { StockfishEngine, type EngineStrength } from './stockfish'

type Mode = 'coach' | 'practice' | 'exam'
type Screen = 'home' | 'theory' | 'train' | 'rating'
type Category = 'beginner' | 'intermediate' | 'advanced'
type ColorFilter = 'all' | 'white' | 'black'
type PlayerColor = 'w' | 'b'
type RatingStage = 'playing' | 'between' | 'complete'
type ManualOutcome = 'resigned' | 'draw-agreed' | null
type MoveActor = 'player' | 'engine' | 'course'

type MoveQuality = {
  cpLoss: number
  accuracy: number
  winDrop: number
}

type PlacementSample = {
  color: PlayerColor
  opponent: EngineStrength
  score: number
  accuracy: number
  moves: number
  seriousErrors: number
  blunders: number
}

type RatingResult = {
  low: number
  high: number
  center: number
  games: number
  accuracy: number
  seriousErrors: number
  blunders: number
}

type GameMoveRecord = {
  ply: number
  actor: MoveActor
  color: PlayerColor
  san: string
  uci: string
  from: Square
  to: Square
  fenBefore: string
  fenAfter: string
  bookMove: boolean
  openingName: string
  openingNote?: string
}

type MoveBadge = {
  square: Square
  symbol: string
  label: string
  tone: 'theory' | 'brilliant' | 'great' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'departure'
}

type AnalysedMove = GameMoveRecord & {
  cpLoss: number
  bestMove: string | null
  label: 'Блискучий' | 'Найкращий' | 'Чудовий' | 'Добрий' | 'Неточність' | 'Помилка' | 'Груба помилка'
}

type LessonStep = {
  userMove: string
  title: string
  explanation: string
  opponentMove: string
  opponentExplanation: string
}

type Scenario = {
  id: string
  name: string
  initialMove?: string
  initialExplanation?: string
  steps: LessonStep[]
}

const modes: { id: Mode; name: string; description: string }[] = [
  { id: 'coach', name: 'Тренер', description: 'Показує хід і пояснює кожне рішення' },
  { id: 'practice', name: 'Практика', description: 'Ти ходиш сам, перевірка — одразу' },
  { id: 'exam', name: 'Іспит', description: 'Без підказок, аналіз після дебюту' },
]

const openings = [
  { name: 'Італійська партія', tag: 'Доступно', active: true, side: 'both' },
  { name: 'Лондонська система', tag: 'Скоро', active: false, side: 'white' },
  { name: 'Ферзевий гамбіт', tag: 'Скоро', active: false, side: 'white' },
  { name: 'Захист Каро-Канн', tag: 'Скоро', active: false, side: 'black' },
  { name: 'Відхилений ферзевий гамбіт', tag: 'Скоро', active: false, side: 'black' },
]

const categories: { id: Category; name: string; note: string }[] = [
  { id: 'beginner', name: 'Початківець', note: '5 дебютів' },
  { id: 'intermediate', name: 'Середній', note: 'У розробці' },
  { id: 'advanced', name: 'Досвідчений', note: 'У розробці' },
]

const ratingKey = 'player-rating-v3'
const samplesKey = 'placement-pair-v3'

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

function winPercent(centipawns: number) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * centipawns)) - 1)
}

function lichessMoveAccuracy(winDrop: number) {
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * winDrop) - 3.1669))
}

function gameAccuracy(moves: MoveQuality[]) {
  const arithmetic = moves.reduce((sum, move) => sum + move.accuracy, 0) / moves.length
  const harmonic = moves.length / moves.reduce((sum, move) => sum + 1 / Math.max(1, move.accuracy), 0)
  return (arithmetic + harmonic) / 2
}

function estimateRange(accuracy: number, seriousErrors: number, blunders: number, totalMoves: number, samples: PlacementSample[]) {
  let quality = accuracy < 45 ? 400
    : accuracy < 58 ? 600
      : accuracy < 70 ? 850
        : accuracy < 80 ? 1100
          : accuracy < 88 ? 1400
            : accuracy < 93 ? 1750
              : accuracy < 96 ? 2000
                : 2300

  const seriousPer40 = seriousErrors * 40 / totalMoves
  const blundersPer40 = blunders * 40 / totalMoves
  if (seriousPer40 >= 8) quality -= 100
  else if (seriousPer40 >= 6) quality -= 50
  if (blundersPer40 >= 3) quality -= 100
  else if (blundersPer40 >= 2) quality -= 50

  const averageOpponent = samples.reduce((sum, item) => sum + (item.opponent === 3000 ? 2600 : item.opponent), 0) / samples.length
  const score = samples.reduce((sum, item) => sum + item.score, 0) / samples.length
  const performance = averageOpponent + (score >= .875 ? 300 : score >= .625 ? 150 : score >= .375 ? 0 : score >= .125 ? -150 : -300)
  const center = Math.round(((quality + performance) / 2) / 50) * 50
  return { low: Math.max(100, center - 250), high: Math.min(2800, center + 250), center }
}

function moveParts(uci: string) {
  return { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] }
}

function buildOpeningBook() {
  const book = new Set<string>()
  const scenarios = [...italian.scenarios, ...italian.blackScenarios] as Scenario[]
  for (const scenario of scenarios) {
    const position = new Chess()
    const add = (uci: string) => {
      book.add(`${position.fen()}|${uci}`)
      const move = moveParts(uci)
      position.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
    }
    if (scenario.initialMove) add(scenario.initialMove)
    for (const step of scenario.steps) {
      add(step.userMove)
      add(step.opponentMove)
    }
  }
  return book
}

const openingBook = buildOpeningBook()

function detectOpening(moves: string[]) {
  const starts = (...line: string[]) => line.every((move, index) => moves[index] === move)
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6')) return 'Італійська партія: захист двох коней'
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5')) {
    if (moves.includes('c2c3') && moves.includes('d2d3')) return 'Італійська партія: Джоко-Піанісимо'
    return 'Італійська партія: Джоко-Піано'
  }
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4')) return 'Італійська партія'
  if (starts('e2e4', 'e7e5', 'g1f3', 'b8c6')) return 'Відкрита гра: захист конем c6'
  if (starts('e2e4', 'e7e5')) return 'Відкрита гра'
  if (starts('e2e4')) return 'Дебют королівського пішака'
  return 'Дебют не визначено'
}

function badgeForAnalysis(move: AnalysedMove): MoveBadge {
  if (move.bookMove) return { square: move.to, symbol: '📖', label: 'Теорія', tone: 'theory' }
  const badges: Record<AnalysedMove['label'], Omit<MoveBadge, 'square'>> = {
    'Блискучий': { symbol: '!!', label: 'Блискучий', tone: 'brilliant' },
    'Найкращий': { symbol: '★', label: 'Найкращий', tone: 'great' },
    'Чудовий': { symbol: '!', label: 'Чудовий', tone: 'great' },
    'Добрий': { symbol: '✓', label: 'Добрий', tone: 'good' },
    'Неточність': { symbol: '?!', label: 'Неточність', tone: 'inaccuracy' },
    'Помилка': { symbol: '?', label: 'Помилка', tone: 'mistake' },
    'Груба помилка': { symbol: '??', label: 'Груба помилка', tone: 'blunder' },
  }
  return { square: move.to, ...badges[move.label] }
}

function badgePosition(square: Square, orientation: PlayerColor): CSSProperties {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1]) - 1
  const column = orientation === 'w' ? file : 7 - file
  const row = orientation === 'w' ? 7 - rank : rank
  return { left: `${column * 12.5 + 7.5}%`, top: `${row * 12.5 + .7}%` }
}

function moveLabel(cpLoss: number, bestMove: string | null, playedMove: string, san: string): AnalysedMove['label'] {
  if (cpLoss <= 5 && bestMove === playedMove && /[x+#]/.test(san)) return 'Блискучий'
  if (cpLoss <= 10) return 'Найкращий'
  if (cpLoss <= 25) return 'Чудовий'
  if (cpLoss <= 60) return 'Добрий'
  if (cpLoss <= 120) return 'Неточність'
  if (cpLoss <= 250) return 'Помилка'
  return 'Груба помилка'
}

function gameResultText(position: Chess, outcome: ManualOutcome) {
  if (outcome === 'resigned') return 'Ти здався. Партію завершено.'
  if (outcome === 'draw-agreed') return 'Нічия за згодою.'
  if (position.isCheckmate()) return position.turn() === 'w' ? 'Мат. Чорні перемогли.' : 'Мат. Білі перемогли.'
  if (position.isStalemate()) return 'Пат. Нічия.'
  if (position.isThreefoldRepetition()) return 'Триразове повторення позиції. Нічия.'
  if (position.isInsufficientMaterial()) return 'Недостатньо матеріалу. Нічия.'
  if (position.isDraw()) return 'Нічия.'
  return 'Партію завершено.'
}

function qualityClass(label: AnalysedMove['label']) {
  if (label === 'Блискучий') return 'brilliant'
  if (label === 'Найкращий' || label === 'Чудовий') return 'great'
  if (label === 'Добрий') return 'good'
  if (label === 'Неточність') return 'inaccuracy'
  if (label === 'Помилка') return 'mistake'
  return 'blunder'
}

function App() {
  const game = useRef(new Chess())
  const engine = useRef<StockfishEngine | null>(null)
  const gameHistory = useRef<GameMoveRecord[]>([])
  const gameSession = useRef(0)
  const lastDropAt = useRef(0)
  const [screen, setScreen] = useState<Screen>('home')
  const [category, setCategory] = useState<Category>('beginner')
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all')
  const [mode, setMode] = useState<Mode>('coach')
  const [surprises, setSurprises] = useState(true)
  const [strength, setStrength] = useState<EngineStrength>(1200)
  const [scenario, setScenario] = useState<Scenario>(italian.scenarios[0])
  const [trainingColor, setTrainingColor] = useState<PlayerColor>('w')
  const [step, setStep] = useState(0)
  const [fen, setFen] = useState(game.current.fen())
  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [moveBadge, setMoveBadge] = useState<MoveBadge | null>(null)
  const [feedback, setFeedback] = useState('')
  const [practiceCorrection, setPracticeCorrection] = useState(false)
  const [practiceDeviation, setPracticeDeviation] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [freePlay, setFreePlay] = useState(false)
  const [mistakes, setMistakes] = useState<string[]>([])
  const [manualOutcome, setManualOutcome] = useState<ManualOutcome>(null)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisBusy, setAnalysisBusy] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState(0)
  const [analysisItems, setAnalysisItems] = useState<AnalysedMove[]>([])
  const [analysisIndex, setAnalysisIndex] = useState(0)
  const [ratingMoves, setRatingMoves] = useState<MoveQuality[]>([])
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null)
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w')
  const [ratingStage, setRatingStage] = useState<RatingStage>('playing')
  const savedRating = readJson<RatingResult | null>(ratingKey, null)

  const current = scenario.steps[step]
  const progress = Math.min(100, Math.round((step / scenario.steps.length) * 100))
  const hint = screen === 'train' && current && (mode === 'coach' || practiceCorrection) ? moveParts(current.userMove) : null
  const playerSide = screen === 'rating' ? playerColor : trainingColor
  const gameFinished = Boolean(manualOutcome) || game.current.isGameOver()
  const analysedMove = analysisItems[analysisIndex]
  const displayedFen = analysisOpen && analysedMove ? analysedMove.fenAfter : fen
  const displayedBadge = analysisOpen && analysedMove ? badgeForAnalysis(analysedMove) : moveBadge

  useEffect(() => {
    engine.current = new StockfishEngine()
    return () => engine.current?.destroy()
  }, [])

  function restartEngine() {
    engine.current?.destroy()
    engine.current = new StockfishEngine()
  }

  async function analyseSafely(position: string, engineStrength: EngineStrength, moveTime: number) {
    if (!engine.current) throw new Error('Stockfish не запущений')
    try {
      return await engine.current.analyse(position, engineStrength, moveTime)
    } catch {
      restartEngine()
      return await engine.current.analyse(position, engineStrength, moveTime)
    }
  }

  function resetGameState() {
    gameSession.current += 1
    gameHistory.current = []
    setSelected(null)
    setLegalTargets([])
    setLastMove(null)
    setMoveBadge(null)
    setPracticeCorrection(false)
    setPracticeDeviation(false)
    setManualOutcome(null)
    setAnalysisOpen(false)
    setAnalysisBusy(false)
    setAnalysisProgress(0)
    setAnalysisItems([])
    setAnalysisIndex(0)
    setThinking(false)
  }

  function recordMove(beforeFen: string, played: Move, actor: MoveActor, openingNote?: string) {
    const uci = `${played.from}${played.to}${played.promotion ?? ''}`
    gameHistory.current.push({
      ply: gameHistory.current.length + 1,
      actor,
      color: played.color,
      san: played.san,
      uci,
      from: played.from,
      to: played.to,
      fenBefore: beforeFen,
      fenAfter: game.current.fen(),
      bookMove: openingBook.has(`${beforeFen}|${uci}`),
      openingName: detectOpening([...gameHistory.current.map((move) => move.uci), uci]),
      openingNote,
    })
  }

  function openingIdeaNote(beforeFen: string, afterFen: string, color: PlayerColor) {
    if (color !== 'w') return undefined
    const before = new Chess(beforeFen)
    const after = new Chess(afterFen)
    if (before.isAttacked('f7', 'w') && !after.isAttacked('f7', 'w')) {
      return 'Послаблено ідею дебюту: білі втратили тиск на поле f7. Перевір, чи це було виправдано.'
    }
    return undefined
  }

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (selected) styles[selected] = { boxShadow: 'inset 0 0 0 4px #efbe4d' }
    for (const square of legalTargets) styles[square] = { background: 'radial-gradient(circle, rgba(20,30,27,.38) 0 16%, transparent 18%)' }
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(236,198,85,.35)' }
      styles[lastMove.to] = { backgroundColor: 'rgba(236,198,85,.35)' }
    }
    if (practiceCorrection && hint) {
      styles[hint.from] = { boxShadow: 'inset 0 0 0 5px #efbe4d' }
      styles[hint.to] = { background: 'radial-gradient(circle, rgba(239,190,77,.95) 0 24%, rgba(239,190,77,.28) 26% 48%, transparent 50%)' }
    }
    return styles
  }, [selected, legalTargets, lastMove, practiceCorrection, hint])

  function start() {
    const source = trainingColor === 'w' ? italian.scenarios : italian.blackScenarios
    const choices = source as Scenario[]
    const selectedScenario = surprises ? choices[Math.floor(Math.random() * choices.length)] : choices[0]
    game.current.reset()
    resetGameState()
    setScenario(selectedScenario)
    setStep(0)
    setFen(game.current.fen())
    setMistakes([])
    setFreePlay(false)
    setRatingStage('playing')
    if (trainingColor === 'b' && selectedScenario.initialMove) {
      const initial = moveParts(selectedScenario.initialMove)
      const beforeFen = game.current.fen()
      const played = game.current.move({ from: initial.from, to: initial.to, promotion: initial.promotion || 'q' })
      recordMove(beforeFen, played, 'course')
      setFen(game.current.fen())
      setLastMove({ from: played.from, to: played.to })
    }
    setFeedback(mode === 'coach'
      ? trainingColor === 'w'
        ? 'Знайди підсвічений хід. Натисни фігуру, потім поле.'
        : `${selectedScenario.initialExplanation ?? 'Білі зробили перший хід.'} Тепер знайди відповідь чорних.`
      : '')
    setScreen('train')
  }

  function beginFromMenu() {
    if (localStorage.getItem(`theory-seen-italian-${trainingColor}`)) start()
    else setScreen('theory')
  }

  function finishTheory() {
    localStorage.setItem(`theory-seen-italian-${trainingColor}`, '1')
    start()
  }

  function startRating(color: PlayerColor = 'w') {
    if (color === 'w') localStorage.removeItem(samplesKey)
    game.current.reset()
    resetGameState()
    setFen(game.current.fen())
    setRatingMoves([])
    setRatingResult(null)
    setFreePlay(false)
    setPlayerColor(color)
    setRatingStage('playing')
    setFeedback(color === 'w'
      ? 'Перша партія: ти граєш білими. Дограй до завершення.'
      : 'Друга партія: ти граєш чорними. Stockfish робить перший хід.')
    setScreen('rating')
    const session = gameSession.current
    if (color === 'b') window.setTimeout(() => {
      if (session === gameSession.current) void requestEngineMove(strength, true)
    }, 0)
  }

  function chooseSquare(square: Square) {
    if (Date.now() - lastDropAt.current < 180 || analysisOpen) return
    const userColor = playerSide
    if (thinking || manualOutcome || (screen === 'rating' && ratingStage !== 'playing') || game.current.turn() !== userColor || game.current.isGameOver()) return

    if (!selected) {
      const piece = game.current.get(square)
      if (!piece || piece.color !== userColor) return
      setSelected(square)
      setLegalTargets(game.current.moves({ square, verbose: true }).map((move) => move.to))
      return
    }

    if (selected === square) {
      setSelected(null)
      setLegalTargets([])
      return
    }

    const piece = game.current.get(square)
    if (piece?.color === userColor) {
      setSelected(square)
      setLegalTargets(game.current.moves({ square, verbose: true }).map((move) => move.to))
      return
    }

    if (!legalTargets.includes(square)) {
      setFeedback('Обери одне з підсвічених полів.')
      return
    }

    playUserMove(selected, square)
  }

  function playUserMove(from: Square, to: Square): boolean {
    const userColor = playerSide
    if (thinking || manualOutcome || analysisOpen || game.current.isGameOver() || game.current.turn() !== userColor) return false
    const piece = game.current.get(from)
    if (!piece || piece.color !== userColor) return false
    const legalMove = game.current.moves({ square: from, verbose: true }).find((move) => move.to === to)
    if (!legalMove) {
      setFeedback('Ця фігура не може піти на це поле. Обери підсвічене поле.')
      return false
    }

    const beforeFen = game.current.fen()
    const played = game.current.move({ from, to, promotion: legalMove.promotion || 'q' })

    setSelected(null)
    setLegalTargets([])
    setLastMove({ from, to })
    setFen(game.current.fen())

    const uci = `${played.from}${played.to}${played.promotion ?? ''}`
    const isBookMove = openingBook.has(`${beforeFen}|${uci}`)
    if (screen === 'rating') {
      recordMove(beforeFen, played, 'player')
      void evaluateRatingMove(beforeFen, game.current.fen())
      return true
    }
    if (freePlay || !current) {
      setMoveBadge(null)
      recordMove(beforeFen, played, 'player', openingIdeaNote(beforeFen, game.current.fen(), trainingColor))
      if (game.current.isGameOver()) {
        setFeedback(gameResultText(game.current, null))
        return true
      }
      void requestEngineMove()
      return true
    }

    setMoveBadge(isBookMove
      ? { square: played.to, symbol: '📖', label: 'Теорія', tone: 'theory' }
      : { square: played.to, symbol: '↗', label: 'Поза варіантом', tone: 'departure' })

    if (uci !== current.userMove) {
      setMistakes((items) => [...items, `${played.san} замість ${current.userMove}`])
      if (mode === 'exam') {
        recordMove(beforeFen, played, 'player', `Відхилення від вивченого плану: очікувався хід ${current.userMove}. ${current.explanation}`)
        setFreePlay(true)
        setFeedback('↗ Це вихід із вивченого варіанта. Після партії Stockfish покаже, чи хід нормальний, чи він послабив дебютний план.')
        void requestEngineMove()
        return true
      }

      if (mode === 'practice') {
        recordMove(beforeFen, played, 'player', `Відхилення від вивченого плану: очікувався хід ${current.userMove}. ${current.explanation}`)
        setPracticeCorrection(false)
        setPracticeDeviation(true)
        setFeedback(`↗ ${played.san} — легальний хід, але він виходить із поточного дебютного варіанта.`)
        return true
      }

      game.current.undo()
      setFen(game.current.fen())
      setLastMove(null)
      setMoveBadge(null)
      setPracticeCorrection(false)
      setFeedback(mode === 'coach'
        ? `Спробуй інакше. Ідея зараз: ${current.explanation}`
        : `Хід повернуто. Правильний напрямок підсвічено на дошці. ${current.explanation}`)
      return false
    }

    setPracticeCorrection(false)
    recordMove(beforeFen, played, 'player')
    if (mode !== 'exam') setFeedback(`📖 Теорія · ${detectOpening(gameHistory.current.map((move) => move.uci))}. ${current.explanation}`)
    setThinking(true)
    const session = gameSession.current
    window.setTimeout(() => {
      if (session === gameSession.current) playCourseReply(current)
    }, mode === 'practice' ? 900 : 500)
    return true
  }

  async function evaluateRatingMove(beforeFen: string, afterFen: string) {
    if (!engine.current) return
    const session = gameSession.current
    setThinking(true)
    setFeedback('Оцінюємо хід…')
    try {
      const before = await analyseSafely(beforeFen, 3000, 360)
      const after = await analyseSafely(afterFen, 3000, 360)
      if (session !== gameSession.current) return
      const cpLoss = Math.max(0, Math.min(1000, before.scoreCp + after.scoreCp))
      const winDrop = Math.max(0, winPercent(before.scoreCp) - winPercent(-after.scoreCp))
      const quality = { cpLoss, winDrop, accuracy: lichessMoveAccuracy(winDrop) }
      const nextMoves = [...ratingMoves, quality]
      setRatingMoves(nextMoves)

      if (game.current.isGameOver()) {
        finishRating(nextMoves)
        return
      }
      await requestEngineMove(strength, true)
      if (game.current.isGameOver()) finishRating(nextMoves)
      else setFeedback('')
    } catch (error) {
      if (session !== gameSession.current) return
      setThinking(false)
      setFeedback(`Stockfish не зміг оцінити хід: ${error instanceof Error ? error.message : 'невідома помилка'}.`)
    }
  }

  function finishRating(moves = ratingMoves) {
    if (!moves.length) return
    const sample: PlacementSample = {
      color: playerColor,
      opponent: strength,
      score: game.current.isDraw() ? .5 : game.current.turn() === playerColor ? 0 : 1,
      accuracy: gameAccuracy(moves),
      moves: moves.length,
      seriousErrors: moves.filter((move) => move.winDrop >= 6 || move.cpLoss >= 100).length,
      blunders: moves.filter((move) => move.winDrop >= 12 || move.cpLoss >= 200).length,
    }
    if (playerColor === 'w') {
      localStorage.setItem(samplesKey, JSON.stringify([sample]))
      setRatingStage('between')
      setThinking(false)
      setFeedback('Партію білими завершено. Для оцінки обов’язково зіграй ще одну партію чорними.')
      return
    }

    const whiteSample = readJson<PlacementSample[]>(samplesKey, []).find((item) => item.color === 'w')
    const samples = whiteSample ? [whiteSample, sample] : [sample]
    const totalMoves = samples.reduce((sum, item) => sum + item.moves, 0)
    const accuracy = samples.reduce((sum, item) => sum + item.accuracy * item.moves, 0) / totalMoves
    const seriousErrors = samples.reduce((sum, item) => sum + item.seriousErrors, 0)
    const blunders = samples.reduce((sum, item) => sum + item.blunders, 0)
    const range = estimateRange(accuracy, seriousErrors, blunders, totalMoves, samples)
    const result: RatingResult = {
      ...range,
      games: samples.length,
      accuracy: Math.round(accuracy),
      seriousErrors,
      blunders,
    }
    localStorage.setItem(samplesKey, JSON.stringify(samples))
    localStorage.setItem(ratingKey, JSON.stringify(result))
    setRatingResult(result)
    setRatingStage('complete')
    setThinking(false)
    setFeedback('')
  }

  function playCourseReply(lesson: LessonStep) {
    const reply = moveParts(lesson.opponentMove)
    const beforeFen = game.current.fen()
    const played = game.current.move({ from: reply.from, to: reply.to, promotion: reply.promotion || 'q' })
    recordMove(beforeFen, played, 'course')
    setLastMove({ from: reply.from, to: reply.to })
    setMoveBadge(null)
    setFen(game.current.fen())
    setThinking(false)

    const next = step + 1
    if (next >= scenario.steps.length) {
      setStep(next)
      setFreePlay(true)
      setFeedback(mode === 'exam' ? '' : `Дебют завершено. ${lesson.opponentExplanation} Тепер гра продовжується проти Stockfish.`)
      saveResult()
      return
    }

    setStep(next)
    if (mode !== 'exam') setFeedback(lesson.opponentExplanation)
  }

  function undoPracticeDeviation() {
    if (mode !== 'practice' || !practiceDeviation || thinking) return
    game.current.undo()
    gameHistory.current.pop()
    setFen(game.current.fen())
    setLastMove(null)
    setMoveBadge(null)
    setPracticeDeviation(false)
    setPracticeCorrection(true)
    setSelected(null)
    setLegalTargets([])
    setFeedback(`Хід повернуто. Правильний маршрут підсвічено. ${current?.explanation ?? ''}`)
  }

  function continuePracticeDeviation() {
    if (mode !== 'practice' || !practiceDeviation || thinking) return
    setPracticeDeviation(false)
    setPracticeCorrection(false)
    setFreePlay(true)
    setFeedback('Гра продовжується нестандартно проти Stockfish.')
    void requestEngineMove()
  }

  async function requestEngineMove(engineStrength = strength, ratingGame = false) {
    if (!engine.current || game.current.isGameOver() || manualOutcome) return
    const session = gameSession.current
    setThinking(true)
    if (ratingGame || mode !== 'exam') setFeedback('Stockfish думає…')
    try {
      const result = await analyseSafely(game.current.fen(), engineStrength, engineStrength >= 2000 ? 700 : 350)
      if (session !== gameSession.current || manualOutcome) return
      if (result.bestMove) {
        const move = moveParts(result.bestMove)
        const beforeFen = game.current.fen()
        const played = game.current.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
        recordMove(beforeFen, played, 'engine')
        setLastMove({ from: move.from, to: move.to })
        setMoveBadge(null)
        setFen(game.current.fen())
      }
      setThinking(false)
      if (ratingGame) setFeedback(game.current.isGameOver() ? gameResultText(game.current, null) : '')
      else if (game.current.isGameOver()) setFeedback(gameResultText(game.current, null))
      else if (mode !== 'exam') setFeedback('Твій хід.')
    } catch (error) {
      if (session !== gameSession.current) return
      setThinking(false)
      setFeedback(`Stockfish не зміг зробити хід: ${error instanceof Error ? error.message : 'невідома помилка'}.`)
    }
  }

  function rewindLesson() {
    if (screen !== 'train' || mode === 'exam' || freePlay || thinking || step < 1) return
    gameSession.current += 1
    game.current.undo()
    game.current.undo()
    gameHistory.current.splice(-2)
    const previousStep = step - 1
    setStep(previousStep)
    setFen(game.current.fen())
    setSelected(null)
    setLegalTargets([])
    setLastMove(null)
    setMoveBadge(null)
    setPracticeCorrection(false)
    setPracticeDeviation(false)
    setFeedback(`Повтори ідею: ${scenario.steps[previousStep].explanation}`)
  }

  function resignGame() {
    if (screen === 'rating' || !freePlay || gameFinished || thinking) return
    gameSession.current += 1
    setThinking(false)
    setSelected(null)
    setLegalTargets([])
    setManualOutcome('resigned')
    setFeedback('Ти здався. Партію завершено — тепер можна переглянути повний аналіз.')
  }

  async function offerDraw() {
    if (screen === 'rating' || !freePlay || gameFinished || thinking || game.current.turn() !== trainingColor) return
    const session = gameSession.current
    setThinking(true)
    setFeedback('Stockfish оцінює пропозицію нічиєї…')
    try {
      const result = await analyseSafely(game.current.fen(), 3000, 300)
      if (session !== gameSession.current) return
      setThinking(false)
      if (game.current.isDraw() || Math.abs(result.scoreCp) <= 100) {
        gameSession.current += 1
        restartEngine()
        setManualOutcome('draw-agreed')
        setFeedback('Stockfish погодився на нічию. Можна перейти до аналізу партії.')
      } else {
        setFeedback('Stockfish відхилив нічию: у позиції ще є помітні шанси на перемогу. Твій хід.')
      }
    } catch (error) {
      if (session !== gameSession.current) return
      setThinking(false)
      setFeedback(`Не вдалося оцінити пропозицію: ${error instanceof Error ? error.message : 'невідома помилка'}.`)
    }
  }

  async function analyseGame() {
    const records = [...gameHistory.current]
    if (!records.length || analysisBusy) return
    const session = gameSession.current
    setAnalysisOpen(true)
    setAnalysisBusy(true)
    setAnalysisProgress(0)
    setAnalysisIndex(0)
    setAnalysisItems([])
    setSelected(null)
    setLegalTargets([])
    const cache = new Map<string, Awaited<ReturnType<typeof analyseSafely>>>()
    const analysed: AnalysedMove[] = []
    try {
      for (let index = 0; index < records.length; index += 1) {
        if (session !== gameSession.current) return
        const record = records[index]
        let before = cache.get(record.fenBefore)
        if (!before) {
          before = await analyseSafely(record.fenBefore, 3000, 180)
          cache.set(record.fenBefore, before)
        }
        let after = cache.get(record.fenAfter)
        if (!after) {
          after = await analyseSafely(record.fenAfter, 3000, 180)
          cache.set(record.fenAfter, after)
        }
        const cpLoss = Math.max(0, Math.min(1000, before.scoreCp + after.scoreCp))
        analysed.push({
          ...record,
          cpLoss,
          bestMove: before.bestMove,
          label: moveLabel(cpLoss, before.bestMove, record.uci, record.san),
        })
        setAnalysisItems([...analysed])
        setAnalysisProgress(Math.round(((index + 1) / records.length) * 100))
      }
    } catch (error) {
      setFeedback(`Аналіз зупинився: ${error instanceof Error ? error.message : 'невідома помилка'}.`)
    } finally {
      if (session === gameSession.current) setAnalysisBusy(false)
    }
  }

  function saveResult() {
    const previous = Number(localStorage.getItem('italian-best') || 0)
    const score = Math.round(((scenario.steps.length - mistakes.length) / scenario.steps.length) * 100)
    if (score > previous) localStorage.setItem('italian-best', String(score))
  }

  if (screen === 'home') {
    return (
      <main className="shell home">
        <header className="game-hero">
          <div className="brand-mark"><img src={`${import.meta.env.BASE_URL}icon-192-v4.png`} alt="" /></div>
          <div><span className="eyebrow">Шаховий тренер</span><h1>Дебют</h1></div>
          <div className="rating-badge"><small>Рівень</small><strong>{savedRating ? `≈${savedRating.center}` : '—'}</strong></div>
        </header>

        <section className="play-menu">
          <button className="play-card rating-play" onClick={() => startRating('w')}>
            <span className="play-icon">♟</span>
            <span><strong>{savedRating ? 'Повторити оцінювання' : 'Визначити мій рівень'}</strong><small>{savedRating ? 'Знову зіграти білими й чорними' : '2 повні партії: білими й чорними'}</small></span>
            <b>→</b>
          </button>
          <div className="play-card lesson-play">
            <span className="play-icon">♜</span>
            <span><strong>Тренування дебютів</strong><small>Підказки, практика та іспит</small></span>
          </div>
        </section>

        <section>
          <div className="section-title">
            <h2>Обери дебют</h2>
            <span>{category === 'beginner' ? '1 із 5 доступний' : 'Незабаром'}</span>
          </div>
          <div className="category-tabs">
            {categories.map((item) => <button className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)} key={item.id}><strong>{item.name}</strong><small>{item.note}</small></button>)}
          </div>
          {category === 'beginner' ? (
            <>
              <div className="color-filter">
                {([['all', 'Усі'], ['white', 'За білих'], ['black', 'За чорних']] as [ColorFilter, string][]).map(([id, label]) => <button className={colorFilter === id ? 'active' : ''} onClick={() => {
                  setColorFilter(id)
                  if (id !== 'all') setTrainingColor(id === 'white' ? 'w' : 'b')
                }} key={id}>{label}</button>)}
              </div>
              <div className="opening-list">
              {openings.filter((opening) => colorFilter === 'all' || opening.side === colorFilter || opening.side === 'both').map((opening) => {
                const index = openings.indexOf(opening)
                return (
                <button className={`opening-card ${opening.active ? 'active' : ''}`} disabled={!opening.active} onClick={() => opening.active && setScreen('theory')} key={opening.name}>
                  <span className="opening-number">0{index + 1}</span>
                  <span className="opening-copy"><strong>{opening.name}</strong><small>{opening.side === 'both' ? 'Навчання за білих і чорних' : opening.side === 'white' ? 'Гра білими' : 'Гра чорними'}</small></span>
                  <span className="opening-tag">{opening.tag}</span>
                </button>
                )
              })}
              </div>
              <div className={`side-choice ${colorFilter === 'all' ? '' : 'single'}`} aria-label="Сторона в дебюті">
                {colorFilter !== 'black' && <button aria-pressed={trainingColor === 'w'} className={trainingColor === 'w' ? 'active' : ''} onClick={() => { setTrainingColor('w'); setColorFilter('white') }}><span>♙</span><strong>Грати білими</strong><small>Будувати атаку</small></button>}
                {colorFilter !== 'white' && <button aria-pressed={trainingColor === 'b'} className={trainingColor === 'b' ? 'active' : ''} onClick={() => { setTrainingColor('b'); setColorFilter('black') }}><span>♟</span><strong>Захищатися чорними</strong><small>Нейтралізувати тиск</small></button>}
              </div>
            </>
          ) : <div className="empty-category"><span>♙</span><strong>Курси готуються</strong><p>Тут з’являться дебюти для цього рівня.</p></div>}
        </section>

        <section>
          <div className="section-title"><h2>Режим</h2></div>
          <div className="mode-grid">
            {modes.map((item, index) => (
              <button className={`mode-card ${mode === item.id ? 'selected' : ''}`} onClick={() => setMode(item.id)} key={item.id}>
                <span>{index + 1}</span><strong>{item.name}</strong><small>{item.description}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <label className="switch-row">
            <span><strong>Несподівані варіанти</strong><small>Stockfish перевірятиме різними продовженнями</small></span>
            <input type="checkbox" checked={surprises} onChange={(event) => setSurprises(event.target.checked)} />
          </label>
          <label className="strength-row">
            <span><strong>Сила суперника</strong><small>{strength === 3000 ? 'Максимальна' : `≈ ${strength} Elo`} · рейтинг і тренування</small></span>
            <select value={strength} onChange={(event) => setStrength(Number(event.target.value) as EngineStrength)}>
              <option value="800">Початківець</option>
              <option value="1200">Любитель</option>
              <option value="1600">Клубний</option>
              <option value="1800">Сильний клубний</option>
              <option value="2000">Сильний</option>
              <option value="3000">Максимум</option>
            </select>
          </label>
        </section>

        <button className="primary" onClick={beginFromMenu}>Почати тренування <span>→</span></button>
        <p className="install-note">На iPhone: Safari → Поділитися → На початковий екран</p>
      </main>
    )
  }

  if (screen === 'theory') {
    const theory = italian.theory
    return (
      <main className="shell theory-screen">
        <header className="theory-header">
          <button className="icon-button" onClick={() => setScreen('home')} aria-label="Назад">←</button>
          <div><span className="eyebrow">Перед грою · {trainingColor === 'w' ? 'білі' : 'чорні'}</span><h1>{italian.name}</h1></div>
          <button className="skip-button" onClick={finishTheory}>Пропустити</button>
        </header>
        <section className="theory-intro">
          <span className="move-sequence">1.e4 e5 2.Nf3 Nc6 3.Bc4</span>
          <h2>Про що цей дебют</h2>
          <p>{trainingColor === 'w' ? theory.summary : `${theory.summary} За чорних твоє завдання — нейтралізувати ранній тиск на f7, завершити розвиток і підготувати звільняючий удар ...d5.`}</p>
        </section>
        <section className="theory-block history-block"><span>Історія</span><p>{theory.history}</p></section>
        <section className="theory-columns">
          {(trainingColor === 'w' ? [
            <div className="theory-block" key="white"><span>Твоя мета · білі</span><ul>{theory.whiteGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
            <div className="theory-block dark-goals" key="black"><span>План суперника · чорні</span><ul>{theory.blackGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
          ] : [
            <div className="theory-block" key="black"><span>Твоя мета · чорні</span><ul>{theory.blackGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
            <div className="theory-block dark-goals" key="white"><span>План суперника · білі</span><ul>{theory.whiteGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>,
          ])}
        </section>
        <section>
          <div className="section-title"><h2>Ключові поля</h2></div>
          <div className="square-guide">{theory.keySquares.map((item) => <div key={item.square}><strong>{item.square}</strong><p>{item.idea}</p></div>)}</div>
        </section>
        <section className="warning-card"><strong>Не поспішай</strong><p>{theory.warning}</p></section>
        <button className="primary" onClick={finishTheory}>Почати тренування <span>→</span></button>
      </main>
    )
  }

  return (
    <main className="shell training">
      <header className="training-header">
        <button className="icon-button" onClick={() => setScreen('home')} aria-label="Назад">←</button>
        <div><strong>{screen === 'rating' ? 'Оціночна партія' : italian.name}</strong><small>{screen === 'rating' ? `Проти Stockfish · ${strength === 3000 ? 'MAX' : strength}` : scenario.name}</small></div>
        <button className="icon-button" onClick={screen === 'rating' ? () => startRating('w') : start} aria-label="Почати знову">↻</button>
      </header>

      {screen !== 'rating' && <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>}

      <section className={`coach-card ${screen !== 'rating' && mode === 'practice' ? 'practice-mode' : ''}`}>
        <span className="mode-pill">{screen === 'rating' ? `Суперник ${strength === 3000 ? 'MAX' : strength} · аналіз MAX · ${playerColor === 'w' ? 'білі' : 'чорні'}` : `${modes.find((item) => item.id === mode)?.name} · ${trainingColor === 'w' ? 'білі' : 'чорні'}`}</span>
        <h2>{analysisOpen ? 'Повний аналіз партії' : screen === 'rating' ? (ratingResult ? 'Рівень визначено' : ratingStage === 'between' ? 'Половина оцінювання готова' : 'Грай без підказок') : gameFinished ? gameResultText(game.current, manualOutcome) : freePlay ? 'Мітельшпіль' : current?.title ?? 'Дебют завершено'}</h2>
        <p className="feedback" aria-live="polite">{feedback || '\u00a0'}</p>
        <p className="coach-copy">
          {analysisOpen
            ? analysisBusy
              ? `Stockfish перевіряє кожну позицію: ${analysisProgress}%.`
              : 'Переглядай партію хід за ходом. Значок стоїть на фігурі, яка щойно зробила хід.'
            : screen === 'rating' && ratingStage === 'playing'
            ? 'Дограй партію до завершення. Оцінка з’явиться після двох повних партій: білими та чорними. Аналіз виконується на твоєму телефоні.'
            : screen !== 'rating' && mode === 'coach' && current && !freePlay
              ? current.explanation
              : screen !== 'rating' && mode === 'exam' && !freePlay
                ? 'Зіграй дебют самостійно. Результат побачиш після завершення.'
                : '\u00a0'}
        </p>
      </section>

      {screen === 'train' && mode === 'practice' && practiceDeviation && current && (
        <section className="practice-correction" aria-live="assertive">
          <strong>Відхилення від дебюту</strong>
          <p>Хід залишився на дошці. За вивченим варіантом очікувався хід <b>{current.userMove.slice(0, 2)}</b> → <b>{current.userMove.slice(2, 4)}</b>.</p>
          <small>{current.explanation}</small>
          <div className="deviation-actions">
            <button className="secondary" onClick={undoPracticeDeviation}>← Повернути хід</button>
            <button className="primary" onClick={continuePracticeDeviation}>Продовжити нестандартно</button>
          </div>
        </section>
      )}

      {screen === 'train' && mode === 'practice' && practiceCorrection && current && hint && (
        <section className="practice-correction" aria-live="assertive">
          <strong>Спробуй теоретичний хід</strong>
          <p>Зроби хід із <b>{hint.from}</b> на підсвічене поле <b>{hint.to}</b>.</p>
          <small>{current.explanation}</small>
        </section>
      )}

      <section className="board-wrap" aria-label="Шахова дошка">
        <Chessboard options={{
          id: 'training-board',
          position: displayedFen,
          boardOrientation: playerSide === 'b' ? 'black' : 'white',
          boardStyle: { borderRadius: '12px', boxShadow: '0 16px 38px rgba(0,0,0,.28)', overflow: 'hidden' },
          lightSquareStyle: { backgroundColor: '#d8cfb6' },
          darkSquareStyle: { backgroundColor: '#6f8b7e' },
          squareStyles,
          arrows: !analysisOpen && hint ? [{ startSquare: hint.from, endSquare: hint.to, color: 'rgba(239,190,77,.82)' }] : [],
          animationDurationInMs: 120,
          allowDrawingArrows: false,
          canDragPiece: ({ piece }) => {
            return !analysisOpen && !thinking && !gameFinished && (screen !== 'rating' || ratingStage === 'playing') && game.current.turn() === playerSide && piece.pieceType.startsWith(playerSide)
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            lastDropAt.current = Date.now()
            return Boolean(targetSquare && playUserMove(sourceSquare as Square, targetSquare as Square))
          },
          onSquareClick: ({ square }) => chooseSquare(square as Square),
        }} />
        {displayedBadge && (
          <div className={`move-badge ${displayedBadge.tone}`} style={badgePosition(displayedBadge.square, playerSide)} title={displayedBadge.label} aria-label={displayedBadge.label}>
            {displayedBadge.tone === 'theory'
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c3.2-.7 5.8 0 8 1.8v11c-2.2-1.8-4.8-2.5-8-1.8v-11Zm16 0c-3.2-.7-5.8 0-8 1.8v11c2.2-1.8 4.8-2.5 8-1.8v-11Z" /></svg>
              : displayedBadge.symbol}
          </div>
        )}
      </section>

      <section className="game-controls">
        <div><span className={thinking || analysisBusy ? 'status-dot thinking' : 'status-dot'} />{analysisOpen ? analysisBusy ? 'Аналізуємо' : 'Перегляд партії' : gameFinished ? 'Партію завершено' : thinking ? 'Stockfish думає' : game.current.turn() === playerSide ? 'Твій хід' : 'Хід Stockfish'}</div>
        <span>{analysisOpen && analysedMove ? `${analysisIndex + 1}/${analysisItems.length}` : screen === 'rating' ? 'Без підказок' : freePlay ? `${strength === 3000 ? 'MAX' : strength} Elo` : `${step}/${scenario.steps.length}`}</span>
      </section>

      {screen === 'train' && !freePlay && mode !== 'exam' && step > 0 && !thinking && (
        <button className="secondary lesson-back" onClick={rewindLesson}>← Повернути попередній хід і пояснення</button>
      )}

      {screen !== 'rating' && freePlay && !gameFinished && !analysisOpen && (
        <div className="end-controls">
          <button onClick={() => void offerDraw()} disabled={thinking || game.current.turn() !== trainingColor}>Запропонувати нічию</button>
          <button className="danger" onClick={resignGame} disabled={thinking}>Здатися</button>
        </div>
      )}

      {screen === 'rating' && ratingStage === 'between' && (
        <button className="primary" onClick={() => startRating('b')}>Зіграти другу партію чорними <span>→</span></button>
      )}

      {screen === 'rating' && ratingResult && (
        <section className="rating-result">
          <small>Приблизна оцінка гри</small>
          <strong>≈ {ratingResult.center}</strong>
          <p>Діапазон: {ratingResult.low}–{ratingResult.high}. Точність ходів: {ratingResult.accuracy}%. Серйозних помилок: {ratingResult.seriousErrors}, із них грубих: {ratingResult.blunders}. Завершено обидві партії: білими й чорними.</p>
          <button className="primary" onClick={() => startRating('w')}>Повторити оцінювання <span>→</span></button>
        </section>
      )}

      {gameFinished && !analysisOpen && gameHistory.current.length > 0 && (
        <button className="primary analysis-start" onClick={() => void analyseGame()}>Проаналізувати всю партію <span>→</span></button>
      )}

      {analysisOpen && (
        <section className="full-analysis">
          <div className="analysis-heading">
            <div><small>Від першого до останнього ходу</small><strong>{analysisBusy ? `Аналіз ${analysisProgress}%` : `${analysisItems.length} ходів перевірено`}</strong></div>
            <button className="icon-button" onClick={() => setAnalysisOpen(false)} aria-label="Закрити аналіз">×</button>
          </div>
          {analysisBusy && <div className="analysis-progress"><span style={{ width: `${analysisProgress}%` }} /></div>}
          {analysedMove && (
            <>
              <div className="move-timeline">
                {analysisItems.map((item, index) => (
                  <button className={`${analysisIndex === index ? 'active' : ''} ${item.bookMove ? 'theory' : qualityClass(item.label)}`} onClick={() => setAnalysisIndex(index)} key={`${item.ply}-${item.uci}`}>{item.san}</button>
                ))}
              </div>
              <div className="move-review">
                <div className="review-tags">
                  {analysedMove.bookMove && <span className="quality theory">📖 Теорія</span>}
                  {!analysedMove.bookMove && <span className={`quality ${qualityClass(analysedMove.label)}`}>{badgeForAnalysis(analysedMove).symbol} {analysedMove.label}</span>}
                </div>
                <h3>{Math.ceil(analysedMove.ply / 2)}{analysedMove.color === 'w' ? '.' : '...'} {analysedMove.san}</h3>
                <p className="opening-name">{analysedMove.openingName}</p>
                <p>{analysedMove.bookMove
                  ? 'Книжковий хід у цьому вивченому варіанті. Інший вибір Stockfish не робить його помилкою.'
                  : analysedMove.cpLoss <= 10
                  ? 'Хід зберігає найкращу оцінку позиції.'
                  : `Втрата оцінки: приблизно ${(analysedMove.cpLoss / 100).toFixed(1)} пішака.`}</p>
                {!analysedMove.bookMove && analysedMove.bestMove && analysedMove.bestMove !== analysedMove.uci && <p className="best-move">Stockfish радить: <strong>{analysedMove.bestMove}</strong></p>}
                {!analysedMove.bookMove && analysedMove.openingNote?.startsWith('Відхилення') && (
                  <p className={`departure-verdict ${analysedMove.cpLoss <= 60 ? 'safe' : 'harmful'}`}>
                    {analysedMove.cpLoss <= 60
                      ? '↗ Вихід із теорії, але хід не псує позицію.'
                      : '⚠ Вихід із теорії послабив дебютний план.'}
                  </p>
                )}
                {analysedMove.openingNote && <p className="opening-note">♟ {analysedMove.openingNote}</p>}
              </div>
              <div className="analysis-navigation">
                <button onClick={() => setAnalysisIndex((index) => Math.max(0, index - 1))} disabled={analysisIndex === 0}>← Попередній</button>
                <button onClick={() => setAnalysisIndex((index) => Math.min(analysisItems.length - 1, index + 1))} disabled={analysisIndex >= analysisItems.length - 1}>Наступний →</button>
              </div>
            </>
          )}
          {!analysisBusy && !analysedMove && <p className="analysis-empty">Не вдалося отримати аналіз цієї партії.</p>}
          <p className="analysis-disclaimer">Позначки визначає локальний Stockfish. «Блискучий» — наша сувора навчальна оцінка тактичного найкращого ходу, а не рейтинг Chess.com.</p>
        </section>
      )}
    </main>
  )
}

export default App
