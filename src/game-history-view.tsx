import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { BOARD_PIECES, UiIcon } from './board-icons'
import { getCatalog } from './data/catalog'
import type { Locale } from './i18n/locale'
import type { SavedGame } from './game-history'
import { historyUi } from './history-copy'
import { PgnExport } from './pgn-export'

type HistoryProps = {
  games: SavedGame[]
  locale: Locale
  boardColors: { light: string; dark: string }
  onBack: () => void
  storageError: boolean
}
const modeLabels = { coach: 'historyCoach', practice: 'historyPractice', exam: 'historyExam', rating: 'historyAssessment' } as const

export function GameHistoryView({ games, locale, boardColors, onBack, storageError }: HistoryProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedGame = games.find((game) => game.id === selectedId)
  const catalog = getCatalog(locale)
  const t = (key: keyof typeof historyUi) => historyUi[key][locale]
  const title = (game: SavedGame) => catalog.find((entry) => entry.id === game.courseId)?.name ?? t(modeLabels[game.mode])
  const metadata = (game: SavedGame) => `${t(modeLabels[game.mode])} · ${t(game.playerColor === 'w' ? 'historyWhite' : 'historyBlack')} · Stockfish ${game.strength === 3000 ? 'MAX' : game.strength}`
  const date = (game: SavedGame) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(game.createdAt))
  const result = (game: SavedGame) => game.result === '*' ? t('unfinishedGame') : game.result

  return <main className="shell history-screen">
    <header className="menu-header">
      <button className="icon-button" onClick={selectedGame ? () => setSelectedId(null) : onBack} aria-label={t('historyBack')}><UiIcon name="arrow-left" /></button>
      <h1>{selectedGame ? t('openSavedGame') : t('gameHistory')}</h1>
    </header>
    {storageError && <p className="history-warning" role="alert">{t('historyReadFailed')}</p>}
    {selectedGame ? <>
      <div className="history-game-heading"><h2>{title(selectedGame)}</h2><time dateTime={selectedGame.createdAt}>{date(selectedGame)}</time><p>{metadata(selectedGame)}</p><strong>{result(selectedGame)}</strong></div>
      <SavedGameReplay key={selectedGame.id} game={selectedGame} locale={locale} boardColors={boardColors} />
      <PgnExport pgn={selectedGame.pgn} locale={locale} />
    </> : <>
      {!games.length && !storageError && <p className="history-empty">{t('emptyHistory')}</p>}
      <div className="history-list">{games.map((game) => <button className="history-entry" key={game.id} onClick={() => setSelectedId(game.id)}>
        <span><strong>{title(game)}</strong><time dateTime={game.createdAt}>{date(game)}</time><small>{metadata(game)}</small></span>
        <b>{result(game)}</b><UiIcon name="arrow-right" />
      </button>)}</div>
    </>}
    <p className="history-local-note">{t('historyLocalOnly')}</p>
  </main>
}

function SavedGameReplay({ game, locale, boardColors }: Pick<HistoryProps, 'locale' | 'boardColors'> & { game: SavedGame }) {
  const replay = useMemo(() => {
    try {
      const position = new Chess()
      position.loadPgn(game.pgn, { strict: true })
      const moves = position.history({ verbose: true })
      return { moves, fens: [moves[0]?.before ?? position.fen(), ...moves.map((move) => move.after)] }
    } catch { return null }
  }, [game.pgn])
  const [ply, setPly] = useState(0)
  const movesRef = useRef<HTMLDivElement>(null)
  const t = (key: keyof typeof historyUi) => historyUi[key][locale]
  useEffect(() => {
    const list = movesRef.current
    const active = list?.children[ply] as HTMLElement | undefined
    if (list && active) list.scrollTo({ left: active.offsetLeft - list.clientWidth / 2 + active.clientWidth / 2 })
  }, [ply])
  if (!replay) return game.pgn.trim() ? <p className="history-warning" role="alert">{t('historyUnavailable')}</p> : null
  const lastMove = replay.moves[ply - 1]
  const squareStyles = lastMove ? {
    [lastMove.from]: { backgroundColor: 'rgba(236,198,85,.35)' },
    [lastMove.to]: { backgroundColor: 'rgba(236,198,85,.35)' },
  } : {}

  return <section className="history-replay">
    <div className="board-wrap" aria-label={t('openSavedGame')}>
      <Chessboard options={{
        id: `saved-game-${game.id}`,
        pieces: BOARD_PIECES,
        position: replay.fens[ply],
        boardOrientation: game.playerColor === 'b' ? 'black' : 'white',
        boardStyle: { borderRadius: '8px', overflow: 'hidden' },
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        squareStyles,
        animationDurationInMs: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 120,
        allowDrawingArrows: false,
        canDragPiece: () => false,
      }} />
    </div>
    <nav className="history-navigation">
      <button onClick={() => setPly(0)} disabled={ply === 0} aria-label={t('historyFirstMove')}><span className="history-double-arrow"><UiIcon name="arrow-left" /><UiIcon name="arrow-left" /></span></button>
      <button onClick={() => setPly(ply - 1)} disabled={ply === 0} aria-label={t('historyPreviousMove')}><UiIcon name="arrow-left" /></button>
      <span aria-live="polite">{ply} / {replay.moves.length}</span>
      <button onClick={() => setPly(ply + 1)} disabled={ply === replay.moves.length} aria-label={t('historyNextMove')}><UiIcon name="arrow-right" /></button>
      <button onClick={() => setPly(replay.moves.length)} disabled={ply === replay.moves.length} aria-label={t('historyLastMove')}><span className="history-double-arrow"><UiIcon name="arrow-right" /><UiIcon name="arrow-right" /></span></button>
    </nav>
    <div className="history-moves" ref={movesRef}>
      <button className={ply === 0 ? 'active' : ''} aria-current={ply === 0 ? 'step' : undefined} onClick={() => setPly(0)}>{t('historyInitialPosition')}</button>
      {replay.moves.map((move, index) => <button className={ply === index + 1 ? 'active' : ''} aria-current={ply === index + 1 ? 'step' : undefined} onClick={() => setPly(index + 1)} key={index}>{move.before.split(' ')[5]}{move.color === 'w' ? '.' : '…'} {move.san}</button>)}
    </div>
  </section>
}
