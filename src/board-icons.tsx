import { useEffect, useState, type CSSProperties } from 'react'
import { defaultPieces } from 'react-chessboard'
import type { Chess, Color, PieceSymbol } from 'chess.js'

export function resultLoser(position: Chess, resigned: boolean, player: Color, finalBoard: boolean): Color | null {
  return position.isCheckmate() ? position.turn() : resigned && finalBoard ? player : null
}

export function MoveIcon({ symbol }: { symbol: string }) {
  if (symbol === '📖') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
  const path = symbol === '★' ? 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z' : symbol === '✓' ? 'm4 12 5 5L20 6' : symbol === '↗' ? 'M5 19 19 5M7 5h12v12' : null
  if (path) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} fill={symbol === '★' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  return <span>{symbol}</span>
}

export function PieceIcon({ type, color }: { type: PieceSymbol; color: Color }) {
  const Piece = defaultPieces[`${color}${type.toUpperCase()}`]
  return <span className="piece-icon" aria-hidden="true">{Piece && <Piece />}</span>
}

export function CapturedPieces({ pieces, advantage, locale = 'en' }: { pieces: { type: PieceSymbol; color: Color; count: number }[]; advantage: number; locale?: 'uk' | 'en' }) {
  const names = locale === 'uk' ? { p: 'Пішак', n: 'Кінь', b: 'Слон', r: 'Тура', q: 'Ферзь', k: 'Король' } : { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' }
  return <b className="captured-pieces">{pieces.map(({ type, color, count }) => {
    const Piece = defaultPieces[`${color}${type.toUpperCase()}`]
    return <span className="captured-group" key={type} aria-label={`${names[type]}: ${count}`}><span className="captured-piece">{Piece && <Piece />}</span>{count > 1 && <small>×{count}</small>}</span>
  })}{advantage > 0 && <strong className="material-advantage" aria-label={`${locale === 'uk' ? 'Матеріальна перевага' : 'Material advantage'}: +${advantage}`}>+{advantage}</strong>}</b>
}

export function KingResultBadge({ kind, label, style }: { kind: 'loss' | 'win' | 'draw'; label: string; style: CSSProperties }) {
  const [show, setShow] = useState(true)
  useEffect(() => { const timer = window.setTimeout(() => setShow(false), 2400); return () => window.clearTimeout(timer) }, [label])
  return <button className={`king-result-badge ${kind}`} style={style} aria-label={label} onClick={() => setShow(!show)}>
    <span className="result-circle">{kind === 'draw' ? '½' : <svg viewBox="0 0 24 24" aria-hidden="true">{kind === 'win'
      ? <path d="m3 6 5 4 4-7 4 7 5-4-2 13H5Z" fill="currentColor" />
      : <g transform="rotate(70 12 12)"><path d="M12 2v6M9 5h6" stroke="currentColor" strokeWidth="2.5" /><path d="M7 9h10l-2 6 3 5H6l3-5Z" fill="currentColor" /></g>}</svg>}</span>
    <span className={`result-label ${show ? 'visible' : ''}`}>{label}</span>
  </button>
}
