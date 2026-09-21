import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import italian from './data/italian.json'
import { StockfishEngine, type EngineStrength } from './stockfish'

type Mode = 'coach' | 'practice' | 'exam'
type Screen = 'home' | 'theory' | 'train' | 'rating'
type Category = 'beginner' | 'intermediate' | 'advanced'
type ColorFilter = 'all' | 'white' | 'black'
type PlayerColor = 'w' | 'b'
type RatingStage = 'playing' | 'between' | 'complete'

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
  steps: LessonStep[]
}

const modes: { id: Mode; name: string; description: string }[] = [
  { id: 'coach', name: 'Тренер', description: 'Показує хід і пояснює кожне рішення' },
  { id: 'practice', name: 'Практика', description: 'Ти ходиш сам, перевірка — одразу' },
  { id: 'exam', name: 'Іспит', description: 'Без підказок, аналіз після дебюту' },
]

const openings = [
  { name: 'Італійська партія', tag: 'Доступно', active: true, side: 'white' },
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

function App() {
  const game = useRef(new Chess())
  const engine = useRef<StockfishEngine | null>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [category, setCategory] = useState<Category>('beginner')
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all')
  const [mode, setMode] = useState<Mode>('coach')
  const [surprises, setSurprises] = useState(true)
  const [strength, setStrength] = useState<EngineStrength>(1200)
  const [scenario, setScenario] = useState<Scenario>(italian.scenarios[0])
  const [step, setStep] = useState(0)
  const [fen, setFen] = useState(game.current.fen())
  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null)
  const [feedback, setFeedback] = useState('')
  const [thinking, setThinking] = useState(false)
  const [freePlay, setFreePlay] = useState(false)
  const [mistakes, setMistakes] = useState<string[]>([])
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [ratingMoves, setRatingMoves] = useState<MoveQuality[]>([])
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(null)
  const [playerColor, setPlayerColor] = useState<PlayerColor>('w')
  const [ratingStage, setRatingStage] = useState<RatingStage>('playing')
  const savedRating = readJson<RatingResult | null>(ratingKey, null)

  const current = scenario.steps[step]
  const progress = Math.min(100, Math.round((step / scenario.steps.length) * 100))
  const hint = screen === 'train' && mode === 'coach' && current ? moveParts(current.userMove) : null

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

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {}
    if (selected) styles[selected] = { boxShadow: 'inset 0 0 0 4px #efbe4d' }
    for (const square of legalTargets) styles[square] = { background: 'radial-gradient(circle, rgba(20,30,27,.38) 0 16%, transparent 18%)' }
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: 'rgba(236,198,85,.35)' }
      styles[lastMove.to] = { backgroundColor: 'rgba(236,198,85,.35)' }
    }
    return styles
  }, [selected, legalTargets, lastMove])

  function start() {
    const choices = italian.scenarios as Scenario[]
    const selectedScenario = surprises ? choices[Math.floor(Math.random() * choices.length)] : choices[0]
    game.current.reset()
    setScenario(selectedScenario)
    setStep(0)
    setFen(game.current.fen())
    setSelected(null)
    setLegalTargets([])
    setLastMove(null)
    setMistakes([])
    setFreePlay(false)
    setShowAnalysis(false)
    setPlayerColor('w')
    setRatingStage('playing')
    setFeedback(mode === 'coach' ? 'Знайди підсвічений хід. Натисни фігуру, потім поле.' : '')
    setScreen('train')
  }

  function beginFromMenu() {
    if (localStorage.getItem('theory-seen-italian')) start()
    else setScreen('theory')
  }

  function finishTheory() {
    localStorage.setItem('theory-seen-italian', '1')
    start()
  }

  function startRating(color: PlayerColor = 'w') {
    if (color === 'w') localStorage.removeItem(samplesKey)
    game.current.reset()
    setFen(game.current.fen())
    setSelected(null)
    setLegalTargets([])
    setLastMove(null)
    setRatingMoves([])
    setRatingResult(null)
    setPlayerColor(color)
    setRatingStage('playing')
    setFeedback(color === 'w'
      ? 'Перша партія: ти граєш білими. Дограй до завершення.'
      : 'Друга партія: ти граєш чорними. Stockfish робить перший хід.')
    setThinking(false)
    setScreen('rating')
    if (color === 'b') window.setTimeout(() => void requestEngineMove(strength, true), 0)
  }

  function chooseSquare(square: Square) {
    const userColor = screen === 'rating' ? playerColor : 'w'
    if (thinking || (screen === 'rating' && ratingStage !== 'playing') || game.current.turn() !== userColor || game.current.isGameOver()) return

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

    playUserMove(selected, square)
  }

  function playUserMove(from: Square, to: Square): boolean {
    const beforeFen = game.current.fen()
    let played
    try {
      played = game.current.move({ from, to, promotion: 'q' })
    } catch {
      setSelected(null)
      setLegalTargets([])
      setFeedback('Цей хід неможливий у поточній позиції.')
      return false
    }

    setSelected(null)
    setLegalTargets([])
    setLastMove({ from, to })
    setFen(game.current.fen())

    const uci = `${played.from}${played.to}${played.promotion ?? ''}`
    if (screen === 'rating') {
      void evaluateRatingMove(beforeFen, game.current.fen())
      return true
    }
    if (freePlay || !current) {
      void requestEngineMove()
      return true
    }

    if (uci !== current.userMove) {
      setMistakes((items) => [...items, `${played.san} замість ${current.userMove}`])
      if (mode === 'exam') {
        setFreePlay(true)
        setFeedback('')
        void requestEngineMove()
        return true
      }

      game.current.undo()
      setFen(game.current.fen())
      setLastMove(null)
      setFeedback(mode === 'coach'
        ? `Спробуй інакше. Ідея зараз: ${current.explanation}`
        : 'Це легальний хід, але він відхиляється від поточного дебютного варіанта.')
      return false
    }

    if (mode !== 'exam') setFeedback(`Правильно. ${current.explanation}`)
    setThinking(true)
    window.setTimeout(() => playCourseReply(current), 500)
    return true
  }

  async function evaluateRatingMove(beforeFen: string, afterFen: string) {
    if (!engine.current) return
    setThinking(true)
    setFeedback('Оцінюємо хід…')
    try {
      const before = await analyseSafely(beforeFen, 3000, 360)
      const after = await analyseSafely(afterFen, 3000, 360)
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
    game.current.move({ from: reply.from, to: reply.to, promotion: reply.promotion || 'q' })
    setLastMove({ from: reply.from, to: reply.to })
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
    if (mode === 'coach') setFeedback(lesson.opponentExplanation)
  }

  async function requestEngineMove(engineStrength = strength, ratingGame = false) {
    if (!engine.current || game.current.isGameOver()) return
    setThinking(true)
    if (ratingGame || mode !== 'exam') setFeedback('Stockfish думає…')
    try {
      const result = await analyseSafely(game.current.fen(), engineStrength, engineStrength >= 2000 ? 700 : 350)
      if (result.bestMove) {
        const move = moveParts(result.bestMove)
        game.current.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' })
        setLastMove({ from: move.from, to: move.to })
        setFen(game.current.fen())
      }
      setThinking(false)
      if (ratingGame) setFeedback(game.current.isGameOver() ? 'Партію завершено.' : '')
      else if (mode !== 'exam') setFeedback(game.current.isGameOver() ? 'Партію завершено.' : 'Твій хід.')
    } catch (error) {
      setThinking(false)
      setFeedback(`Stockfish не зміг зробити хід: ${error instanceof Error ? error.message : 'невідома помилка'}.`)
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
          <div className="brand-mark">♞</div>
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
                {([['all', 'Усі'], ['white', 'За білих'], ['black', 'За чорних']] as [ColorFilter, string][]).map(([id, label]) => <button className={colorFilter === id ? 'active' : ''} onClick={() => setColorFilter(id)} key={id}>{label}</button>)}
              </div>
              <div className="opening-list">
              {openings.filter((opening) => colorFilter === 'all' || opening.side === colorFilter).map((opening) => {
                const index = openings.indexOf(opening)
                return (
                <button className={`opening-card ${opening.active ? 'active' : ''}`} disabled={!opening.active} onClick={() => opening.active && setScreen('theory')} key={opening.name}>
                  <span className="opening-number">0{index + 1}</span>
                  <span className="opening-copy"><strong>{opening.name}</strong><small>{opening.side === 'white' ? 'Гра білими' : 'Гра чорними'}</small></span>
                  <span className="opening-tag">{opening.tag}</span>
                </button>
                )
              })}
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
          <div><span className="eyebrow">Перед грою</span><h1>{italian.name}</h1></div>
          <button className="skip-button" onClick={finishTheory}>Пропустити</button>
        </header>
        <section className="theory-intro">
          <span className="move-sequence">1.e4 e5 2.Nf3 Nc6 3.Bc4</span>
          <h2>Про що цей дебют</h2>
          <p>{theory.summary}</p>
        </section>
        <section className="theory-block history-block"><span>Історія</span><p>{theory.history}</p></section>
        <section className="theory-columns">
          <div className="theory-block"><span>Мета білих</span><ul>{theory.whiteGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>
          <div className="theory-block dark-goals"><span>Мета чорних</span><ul>{theory.blackGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul></div>
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

      <section className="coach-card">
        <span className="mode-pill">{screen === 'rating' ? `Суперник ${strength === 3000 ? 'MAX' : strength} · аналіз MAX · ${playerColor === 'w' ? 'білі' : 'чорні'}` : modes.find((item) => item.id === mode)?.name}</span>
        <h2>{screen === 'rating' ? (ratingResult ? 'Рівень визначено' : ratingStage === 'between' ? 'Половина оцінювання готова' : 'Грай без підказок') : freePlay ? 'Мітельшпіль' : current?.title ?? 'Дебют завершено'}</h2>
        <p className="coach-copy">
          {screen === 'rating' && ratingStage === 'playing'
            ? 'Дограй партію до завершення. Оцінка з’явиться після двох повних партій: білими та чорними. Аналіз виконується на твоєму телефоні.'
            : screen !== 'rating' && mode === 'coach' && current && !freePlay
              ? current.explanation
              : screen !== 'rating' && mode === 'exam' && !freePlay
                ? 'Зіграй дебют самостійно. Результат побачиш після завершення.'
                : '\u00a0'}
        </p>
        <p className="feedback" aria-live="polite">{feedback || '\u00a0'}</p>
      </section>

      <section className="board-wrap" aria-label="Шахова дошка">
        <Chessboard options={{
          id: 'training-board',
          position: fen,
          boardOrientation: screen === 'rating' && playerColor === 'b' ? 'black' : 'white',
          boardStyle: { borderRadius: '12px', boxShadow: '0 16px 38px rgba(0,0,0,.28)', overflow: 'hidden' },
          lightSquareStyle: { backgroundColor: '#d8cfb6' },
          darkSquareStyle: { backgroundColor: '#6f8b7e' },
          squareStyles,
          arrows: hint ? [{ startSquare: hint.from, endSquare: hint.to, color: 'rgba(239,190,77,.82)' }] : [],
          animationDurationInMs: 180,
          allowDrawingArrows: false,
          canDragPiece: ({ piece }) => {
            const userColor = screen === 'rating' ? playerColor : 'w'
            return !thinking && (screen !== 'rating' || ratingStage === 'playing') && game.current.turn() === userColor && piece.pieceType.startsWith(userColor)
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => Boolean(targetSquare && playUserMove(sourceSquare as Square, targetSquare as Square)),
          onSquareClick: ({ square }) => chooseSquare(square as Square),
        }} />
      </section>

      <section className="game-controls">
        <div><span className={thinking ? 'status-dot thinking' : 'status-dot'} />{thinking ? 'Stockfish думає' : game.current.turn() === (screen === 'rating' ? playerColor : 'w') ? 'Твій хід' : 'Хід Stockfish'}</div>
        <span>{screen === 'rating' ? 'Без підказок' : freePlay ? `${strength === 3000 ? 'MAX' : strength} Elo` : `${step}/${scenario.steps.length}`}</span>
      </section>

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

      {screen !== 'rating' && freePlay && mode === 'exam' && (
        <button className="secondary" onClick={() => setShowAnalysis(!showAnalysis)}>Аналіз дебюту</button>
      )}

      {showAnalysis && (
        <section className="analysis-card">
          <span className="score">{Math.max(0, Math.round(((scenario.steps.length - mistakes.length) / scenario.steps.length) * 100))}%</span>
          <div><strong>{mistakes.length ? 'Є що повторити' : 'Дебют зіграно точно'}</strong><p>{mistakes.length ? `Відхилень: ${mistakes.length}. Вони будуть додані до повторення.` : 'Ти пройшов підготовлений варіант без помилок.'}</p></div>
        </section>
      )}
    </main>
  )
}

export default App
