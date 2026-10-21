import { useEffect, useState, type CSSProperties } from 'react'
import type { PieceRenderObject } from 'react-chessboard'
import type { Chess, Color, PieceSymbol } from 'chess.js'
import readyIcons from './vendor/ready-icons.json'

const pieceImages = Object.fromEntries(Object.entries(readyIcons.pieces).map(([piece, svg]) => [piece, `data:image/svg+xml,${encodeURIComponent(svg)}`]))
export const BOARD_PIECES: PieceRenderObject = Object.fromEntries(Object.entries(pieceImages).map(([piece, src]) => [piece, (props?: { svgStyle?: CSSProperties }) => <img src={src} alt="" aria-hidden="true" draggable={false} style={{ display: 'block', width: '100%', height: '100%', ...props?.svgStyle }} />]))

export type UiIconName = keyof typeof readyIcons.ui
const uiContents = Object.fromEntries(Object.entries(readyIcons.ui).map(([name, svg]) => [name, svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))]))
export function UiIcon({ name }: { name: UiIconName }) {
  // Only pinned, hash-checked upstream SVG markup is rendered; no user HTML enters here.
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: uiContents[name] }} />
}

export function resultLoser(position: Chess, resigned: boolean, player: Color, finalBoard: boolean): Color | null {
  return position.isCheckmate() ? position.turn() : resigned && finalBoard ? player : null
}

export function MoveIcon({ symbol }: { symbol: string }) {
  const name = ({ '📖': 'book-open', '★': 'star', '✓': 'check', '↗': 'arrow-up-right' } as const)[symbol as '📖' | '★' | '✓' | '↗']
  if (name) return <UiIcon name={name} />
  return <span>{symbol}</span>
}

export function PieceIcon({ type, color }: { type: PieceSymbol; color: Color }) {
  const Piece = BOARD_PIECES[`${color}${type.toUpperCase()}`]
  return <span className="piece-icon" aria-hidden="true">{Piece && <Piece />}</span>
}

export function CapturedPieces({ pieces, advantage, locale = 'en' }: { pieces: { type: PieceSymbol; color: Color; count: number }[]; advantage: number; locale?: 'uk' | 'en' }) {
  const names = locale === 'uk' ? { p: 'Пішак', n: 'Кінь', b: 'Слон', r: 'Тура', q: 'Ферзь', k: 'Король' } : { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' }
  return <b className="captured-pieces">{pieces.map(({ type, color, count }) => {
    const Piece = BOARD_PIECES[`${color}${type.toUpperCase()}`]
    return <span className="captured-group" key={type} aria-label={`${names[type]}: ${count}`}><span className="captured-piece">{Piece && <Piece />}</span>{count > 1 && <small>×{count}</small>}</span>
  })}{advantage > 0 && <strong className="material-advantage" aria-label={`${locale === 'uk' ? 'Матеріальна перевага' : 'Material advantage'}: +${advantage}`}>+{advantage}</strong>}</b>
}

export function GameResultIcon({ kind }: { kind: 'loss' | 'win' | 'draw' }) {
  if (kind === 'loss') {
    return <svg viewBox="0 0 100 100" aria-hidden="true"><image href={pieceImages.wK} width="100" height="100" transform="rotate(70 50 50)" /></svg>
  }
  return <UiIcon name={kind === 'draw' ? 'equal' : 'crown'} />
}

export function KingResultBadge({ kind, label, style }: { kind: 'loss' | 'win' | 'draw'; label: string; style: CSSProperties }) {
  const [show, setShow] = useState(true)
  useEffect(() => { const timer = window.setTimeout(() => setShow(false), 2400); return () => window.clearTimeout(timer) }, [label])
  return <button className={`king-result-badge ${kind}`} style={style} aria-label={label} onClick={() => setShow(!show)}>
    <span className="result-circle"><GameResultIcon kind={kind} /></span>
    <span className={`result-label ${show ? 'visible' : ''}`}>{label}</span>
  </button>
}
