import { Chess } from 'chess.js'
import { ENGINE_STRENGTHS, type EngineStrength } from './stockfish'

export const GAME_HISTORY_KEY = 'debut-game-history-v1'
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*'
export type SavedGameOutcome = 'resigned' | 'draw-agreed' | null
export type GameDetails = {
  id: string
  createdAt: string
  playerColor: 'w' | 'b'
  mode: 'coach' | 'practice' | 'exam' | 'rating'
  strength: EngineStrength
  courseId?: string
  outcome?: SavedGameOutcome
}
export type SavedGame = Omit<GameDetails, 'outcome'> & {
  updatedAt: string
  outcome: SavedGameOutcome
  result: GameResult
  pgn: string
  plyCount: number
}
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>
let historyCache: { storage: HistoryStorage; raw: string; entries: SavedGame[] } | undefined

function resultFor(position: Chess, playerColor: 'w' | 'b', outcome: SavedGameOutcome): GameResult {
  if (outcome === 'resigned') return playerColor === 'w' ? '0-1' : '1-0'
  if (outcome === 'draw-agreed' || position.isDraw()) return '1/2-1/2'
  if (position.isCheckmate()) return position.turn() === 'w' ? '0-1' : '1-0'
  return '*'
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
}

function validateGame(value: unknown): asserts value is SavedGame {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid saved game')
  const entry = value as SavedGame
  if (typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id)
    || !isTimestamp(entry.createdAt) || !isTimestamp(entry.updatedAt) || entry.updatedAt < entry.createdAt
    || !['w', 'b'].includes(entry.playerColor) || !['coach', 'practice', 'exam', 'rating'].includes(entry.mode)
    || !ENGINE_STRENGTHS.includes(entry.strength)
    || (entry.courseId !== undefined && (typeof entry.courseId !== 'string' || !/^[a-z0-9-]{1,100}$/.test(entry.courseId)))
    || ![null, 'resigned', 'draw-agreed'].includes(entry.outcome)
    || !['1-0', '0-1', '1/2-1/2', '*'].includes(entry.result)
    || typeof entry.pgn !== 'string' || !Number.isInteger(entry.plyCount) || entry.plyCount < 0) {
    throw new Error('Invalid saved game')
  }
  const position = new Chess()
  position.loadPgn(entry.pgn, { strict: true })
  const headers = position.getHeaders()
  if (['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'].some((tag) => !headers[tag])
    || headers.Result !== entry.result || position.history().length !== entry.plyCount
    || resultFor(position, entry.playerColor, entry.outcome) !== entry.result) {
    throw new Error('Saved game does not match its PGN')
  }
}

export function createSavedGame(position: Chess, details: GameDetails, now = new Date()): SavedGame {
  const moves = position.history({ verbose: true })
  const copy = new Chess(moves[0]?.before ?? position.fen())
  for (const move of moves) copy.move({ from: move.from, to: move.to, promotion: move.promotion })
  const outcome = details.outcome ?? null
  const result = resultFor(copy, details.playerColor, outcome)
  const headers = {
    Event: 'Debut training', Site: 'Offline', Date: details.createdAt.slice(0, 10).replaceAll('-', '.'), Round: '-',
    White: details.playerColor === 'w' ? 'Player' : `Stockfish ${details.strength}`,
    Black: details.playerColor === 'b' ? 'Player' : `Stockfish ${details.strength}`,
    Result: result,
  }
  for (const [tag, value] of Object.entries(headers)) copy.setHeader(tag, value)
  const saved: SavedGame = { ...details, outcome, updatedAt: now.toISOString(), result, pgn: copy.pgn(), plyCount: moves.length }
  validateGame(saved)
  return saved
}

export function readGameHistory(storage: HistoryStorage = localStorage): SavedGame[] {
  const raw = storage.getItem(GAME_HISTORY_KEY)
  if (raw === null) return []
  if (historyCache?.storage === storage && historyCache.raw === raw) return historyCache.entries.map((entry) => ({ ...entry }))
  const entries: unknown = JSON.parse(raw)
  if (!Array.isArray(entries)) throw new Error('Invalid game history')
  const ids = new Set<string>()
  for (const entry of entries) {
    validateGame(entry)
    if (ids.has(entry.id)) throw new Error('Duplicate saved game')
    ids.add(entry.id)
  }
  entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  historyCache = { storage, raw, entries: entries.map((entry) => ({ ...entry })) }
  return entries
}

export function saveGame(game: SavedGame, storage: HistoryStorage = localStorage): SavedGame[] {
  validateGame(game)
  const entries = readGameHistory(storage)
  const index = entries.findIndex((entry) => entry.id === game.id)
  if (index >= 0) {
    if (entries[index].createdAt !== game.createdAt || entries[index].updatedAt > game.updatedAt) throw new Error('Saved game is newer than this update')
    entries[index] = { ...game }
  } else entries.push({ ...game })
  entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const raw = JSON.stringify(entries)
  storage.setItem(GAME_HISTORY_KEY, raw)
  historyCache = { storage, raw, entries: entries.map((entry) => ({ ...entry })) }
  return entries
}
