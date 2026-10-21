import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { BOARD_PIECES, UiIcon } from './board-icons'
import { getCatalog } from './data/catalog'
import type { Locale } from './i18n/locale'
import { trapUi } from './trap-copy'
import { buildTrap, TRAPS, type TrapLesson } from './traps'

type Props = { courseId: string; locale: Locale; boardColors: { light: string; dark: string }; onBack: () => void }
type Stage = 'mistake' | 'punish' | 'avoid'

export function TrapLessons({ courseId, locale, boardColors, onBack }: Props) {
  const lessons = TRAPS.filter((lesson) => lesson.courseId === courseId)
  const [selected, setSelected] = useState(lessons[0]?.id)
  const lesson = lessons.find((item) => item.id === selected)
  const t = (key: keyof typeof trapUi) => trapUi[key][locale]
  return <main className="shell traps-screen">
    <header className="menu-header"><button className="icon-button" onClick={onBack} aria-label={t('trapBack')}><UiIcon name="arrow-left" /></button><h1>{t('traps')}</h1></header>
    <p className="trap-opening">{getCatalog(locale).find((entry) => entry.id === courseId)?.name}</p>
    {lessons.length > 1 && <div className="trap-selector">{lessons.map((item) => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.name[locale]}</button>)}</div>}
    {lesson && <TrapExercise key={lesson.id} lesson={lesson} locale={locale} boardColors={boardColors} onBack={onBack} />}
  </main>
}

function TrapExercise({ lesson, locale, boardColors, onBack }: Omit<Props, 'courseId'> & { lesson: TrapLesson }) {
  const prepared = useMemo(() => buildTrap(lesson), [lesson])
  const [stage, setStage] = useState<Stage>('mistake')
  const [mistakeShown, setMistakeShown] = useState(false)
  const [ply, setPly] = useState(0)
  const [selected, setSelected] = useState<Square | null>(null)
  const [hint, setHint] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [feedback, setFeedback] = useState<'trapCorrect' | 'trapTryLine' | null>(null)
  const t = (key: keyof typeof trapUi) => trapUi[key][locale]
  const line = stage === 'avoid' ? prepared.avoid : prepared.punish
  const learner = stage === 'avoid' ? prepared.mistake.color : prepared.mistake.color === 'w' ? 'b' : 'w'
  const color = locale === 'uk' ? learner === 'w' ? 'білих' : 'чорних' : learner === 'w' ? 'White' : 'Black'
  const complete = stage !== 'mistake' && ply === line.moves.length
  const next = line.moves[ply]
  const waiting = stage !== 'mistake' && !complete && !paused && (playing || next.color !== learner)
  const position = stage === 'mistake' ? mistakeShown ? prepared.mistake.after : prepared.beforeFen : line.fens[ply]
  const last = stage === 'mistake' ? mistakeShown ? prepared.mistake : null : line.moves[ply - 1]

  useEffect(() => {
    if (!waiting) return
    const timer = window.setTimeout(() => { setPly((value) => value + 1); setSelected(null); setHint(false); setFeedback(null) }, 950)
    return () => window.clearTimeout(timer)
  }, [waiting, stage, ply])
  useEffect(() => { if (complete) setPlaying(false) }, [complete])

  function changeStage(value: Stage) {
    setPlaying(false); setPaused(false); setStage(value); setPly(0); setSelected(null); setHint(false); setFeedback(null)
    if (value === 'mistake') setMistakeShown(false)
  }
  function play(from: Square, to: Square) {
    if (stage === 'mistake' || complete || waiting || next.color !== learner) return false
    if (next.from !== from || next.to !== to) { setFeedback('trapTryLine'); setSelected(null); return false }
    setPly(ply + 1); setPaused(false); setSelected(null); setHint(false); setFeedback('trapCorrect')
    return true
  }
  function choose(square: Square) {
    if (stage === 'mistake' || complete || waiting) return
    const piece = new Chess(position).get(square)
    if (piece?.color === learner) { setSelected(square === selected ? null : square); return }
    if (selected) play(selected, square)
  }
  const squareStyles: Record<string, CSSProperties> = {}
  if (last) {
    squareStyles[last.from] = { backgroundColor: stage === 'mistake' ? 'rgba(218,70,61,.5)' : 'rgba(112,180,85,.4)' }
    squareStyles[last.to] = { backgroundColor: stage === 'mistake' ? 'rgba(218,70,61,.6)' : 'rgba(112,180,85,.5)' }
  }
  if (selected) squareStyles[selected] = { boxShadow: 'inset 0 0 0 3px #d8b66a' }

  return <section className="trap-exercise">
    <h2>{lesson.name[locale]}</h2>
    <nav className="trap-stages" aria-label={t('learnTrap')}>
      {(['mistake', 'punish', 'avoid'] as const).map((value, index) => <button aria-current={stage === value ? 'step' : undefined} onClick={() => changeStage(value)} key={value}><span>{index + 1}</span>{t(value === 'mistake' ? 'trapMistake' : value === 'punish' ? 'trapPunish' : 'trapAvoid')}</button>)}
    </nav>
    <div className="trap-instructions" aria-live="polite">
      {stage === 'mistake' ? <><strong>{mistakeShown ? prepared.mistake.san : t('trapWatch')}</strong>{mistakeShown && <p>{lesson.why[locale]}</p>}</> : <>
        <strong>{complete ? t(stage === 'avoid' ? 'trapComplete' : 'trapLineComplete') : t(stage === 'avoid' ? 'trapDefendTurn' : 'trapYourTurn').replace('{color}', color).replace('{move}', prepared.mistake.san)}</strong>
        {(feedback || complete) && <p>{complete ? (stage === 'avoid' ? lesson.avoidanceIdea : lesson.punishmentIdea)[locale] : t(feedback!)}</p>}
      </>}
    </div>
    <div className="board-wrap trap-board" aria-label={t(stage === 'avoid' ? 'trapAvoid' : 'trapPunish')}>
      <Chessboard options={{
        id: `trap-${lesson.id}-${stage}`,
        pieces: BOARD_PIECES,
        position,
        boardOrientation: learner === 'w' ? 'white' : 'black',
        boardStyle: { borderRadius: '8px', overflow: 'hidden' },
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        squareStyles,
        arrows: hint && next ? [{ startSquare: next.from, endSquare: next.to, color: 'rgba(69,189,113,.9)' }] : [],
        animationDurationInMs: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160,
        allowDrawingArrows: false,
        canDragPiece: ({ piece }) => stage !== 'mistake' && !complete && !waiting && next.color === learner && !window.matchMedia('(pointer: coarse)').matches && piece.pieceType.startsWith(learner),
        onPieceDrop: ({ sourceSquare, targetSquare }) => Boolean(targetSquare && play(sourceSquare as Square, targetSquare as Square)),
        onSquareClick: ({ square }) => choose(square as Square),
      }} />
    </div>
    {stage === 'mistake' ? <button className="primary" onClick={() => mistakeShown ? changeStage('punish') : setMistakeShown(true)}>{t(mistakeShown ? 'startPunish' : 'showMistake')}<UiIcon name="arrow-right" /></button> : <>
      <nav className="trap-controls">
        <button aria-label={t('trapPrevious')} disabled={ply === 0} onClick={() => { setPlaying(false); setPaused(true); setPly(ply - 1); setHint(false); setSelected(null); setFeedback(null) }}><UiIcon name="arrow-left" /></button>
        <button onClick={() => { if (playing) { setPlaying(false); setPaused(true) } else { if (complete) setPly(0); setPlaying(true); setPaused(false); setSelected(null); setFeedback(null) } }}>{t(playing ? 'trapPause' : 'trapSolution')}</button>
        <button aria-label={t('trapNext')} disabled={complete} onClick={() => { setPlaying(false); setPaused(true); setPly(ply + 1); setHint(false); setSelected(null); setFeedback(null) }}><UiIcon name="arrow-right" /></button>
      </nav>
      <div className="trap-line" aria-label={t('trapLine')}><small>{t('trapIllustrative')} · {ply}/{line.moves.length}</small><p>{line.moves.slice(0, ply).map((move, index) => <span key={index}>{move.before.split(' ')[5]}{move.color === 'w' ? '.' : '…'} {move.san} </span>)}</p></div>
      {!complete && <><button className="secondary" disabled={waiting} onClick={() => setHint(!hint)} aria-pressed={hint}>{t('trapHint')}</button><p className="trap-note">{t('trapPracticeHint')}</p></>}
      {complete && <button className="primary" onClick={stage === 'punish' ? () => changeStage('avoid') : onBack}>{t(stage === 'punish' ? 'startAvoid' : 'trapBack')}<UiIcon name="arrow-right" /></button>}
    </>}
    <div className="trap-footer"><button onClick={() => changeStage('mistake')}><UiIcon name="rotate-ccw" />{t('trapRestart')}</button>{lesson.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`${t('trapSource')}: ${source.title}`}>{t('trapSource')}{lesson.sources.length > 1 ? ` ${index + 1}` : ''}<UiIcon name="arrow-up-right" /></a>)}</div>
  </section>
}
