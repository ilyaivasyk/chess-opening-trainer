import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: ['src/game-history.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { GAME_HISTORY_KEY, createSavedGame, readGameHistory, saveGame } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const createdAt = '2026-10-21T10:00:00.000Z'
const now = new Date('2026-10-21T10:05:00.000Z')
const details = { id: 'test-game-1', createdAt, playerColor: 'w', mode: 'practice', strength: 1200, courseId: 'italian' }
const storage = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}
const game = (moves, fen) => {
  const position = new Chess(fen)
  for (const move of moves) position.move(move)
  return position
}
const roundTrip = (position, meta = details) => {
  const originalFen = position.fen()
  const originalHeaders = position.getHeaders()
  const saved = createSavedGame(position, meta, now)
  const restored = new Chess()
  restored.loadPgn(saved.pgn, { strict: true })
  assert.equal(restored.fen(), originalFen)
  assert.deepEqual(restored.history(), position.history())
  assert.equal(position.fen(), originalFen, 'export must not mutate the playing position')
  assert.deepEqual(position.getHeaders(), originalHeaders, 'export must not mutate original headers')
  for (const tag of ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result']) assert.ok(saved.pgn.includes(`[${tag} "`), `missing ${tag}`)
  assert.equal(restored.getHeaders().Result, saved.result)
  assert.equal(saved.pgn.trim().split(/\s/).at(-1), saved.result, 'PGN must end with its actual result')
  assert.equal(saved.plyCount, position.history().length)
  assert.deepEqual(readGameHistory({ getItem: () => JSON.stringify([saved]) }), [saved])
  return saved
}

const opening = game(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'])
assert.equal(roundTrip(opening).result, '*')
assert.equal(roundTrip(opening, { ...details, playerColor: 'b', mode: 'exam' }).result, '*')
assert.equal(roundTrip(opening, { ...details, outcome: 'resigned' }).result, '0-1')
assert.equal(roundTrip(opening, { ...details, playerColor: 'b', outcome: 'resigned' }).result, '1-0')
assert.equal(roundTrip(opening, { ...details, outcome: 'draw-agreed' }).result, '1/2-1/2')
assert.equal(roundTrip(game(['f3', 'e5', 'g4', 'Qh4#'])).result, '0-1')
assert.equal(roundTrip(game(['e4', 'f6', 'd4', 'g5', 'Qh5#'])).result, '1-0')
assert.equal(roundTrip(game(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'])).result, '1/2-1/2')
assert.equal(roundTrip(new Chess('k7/8/8/8/8/8/8/K7 w - - 0 1')).result, '1/2-1/2')
const promotion = roundTrip(game(['g8=Q+'], 'k7/6P1/8/8/8/8/8/K7 w - - 0 1'))
assert.match(promotion.pgn, /\[SetUp "1"\]/)
assert.match(promotion.pgn, /\[FEN "k7\/6P1/)
assert.match(promotion.pgn, /g8=Q\+/)
const blackStart = roundTrip(game(['e5', 'Nf3'], 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 17'))
assert.match(blackStart.pgn, /17\. \.\.\. e5 18\. Nf3/)
opening.setHeader('White', 'unsafe"\\name\n[Result "1-0"]')
const safe = roundTrip(opening)
assert.equal(new Chess().getHeaders().White, '?')
assert.ok(!safe.pgn.includes('unsafe'), 'export must not copy arbitrary unsafe source headers')
assert.throws(() => createSavedGame(opening, { ...details, courseId: 'bad"\\name' }, now))

const memory = storage()
assert.deepEqual(readGameHistory(memory), [])
saveGame(safe, memory)
const longer = game(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3'])
const update = createSavedGame(longer, details, new Date('2026-10-21T10:06:00.000Z'))
assert.equal(saveGame(update, memory).length, 1, 'same game ID updates instead of duplicating')
const next = createSavedGame(new Chess(), { ...details, id: 'next-game' }, new Date('2026-10-21T10:07:00.000Z'))
assert.deepEqual(saveGame(next, memory).map(({ id }) => id), ['next-game', details.id], 'newest updates first')
assert.equal(readGameHistory(memory)[1].plyCount, 7)
const untouched = memory.getItem(GAME_HISTORY_KEY)
assert.throws(() => saveGame(safe, memory), /newer/, 'stale tab must not overwrite a newer saved position')
assert.equal(memory.getItem(GAME_HISTORY_KEY), untouched)
const fromCache = readGameHistory(memory)
fromCache[0].pgn = 'corrupted by caller'
fromCache.pop()
assert.equal(readGameHistory(memory).length, 2)
assert.notEqual(readGameHistory(memory)[0].pgn, 'corrupted by caller', 'callers must not mutate cached records')
const returned = saveGame(next, memory)
returned[0].pgn = 'mutated save result'
assert.notEqual(readGameHistory(memory)[0].pgn, 'mutated save result')
assert.notEqual(next.pgn, 'mutated save result', 'saving must not alias the input record')
const concurrent = createSavedGame(new Chess(), { ...details, id: 'another-tab' }, new Date('2026-10-21T10:08:00.000Z'))
memory.setItem(GAME_HISTORY_KEY, JSON.stringify([...readGameHistory(memory), concurrent]))
assert.equal(saveGame(next, memory).length, 3, 'saving must merge the latest valid storage written by another tab')
assert.throws(() => saveGame({ ...next, createdAt: '2026-10-21T09:00:00.000Z' }, memory), /newer/, 'a game ID cannot change its creation date')

for (const corrupt of ['bad JSON', '{}', '[null]', JSON.stringify([{ ...safe, strength: 1234 }]), JSON.stringify([{ ...safe, result: '1-0' }]), JSON.stringify([{ ...safe, pgn: '1. e5' }]), JSON.stringify([{ ...safe, plyCount: 999 }]), JSON.stringify([safe, safe])]) {
  const broken = storage()
  broken.setItem(GAME_HISTORY_KEY, corrupt)
  assert.throws(() => readGameHistory(broken), 'corrupt storage must be reported')
  assert.throws(() => saveGame(next, broken), 'saving must not erase corrupt or unrecognized old history')
  assert.equal(broken.getItem(GAME_HISTORY_KEY), corrupt)
}
memory.setItem(GAME_HISTORY_KEY, 'bad JSON from another tab')
assert.throws(() => readGameHistory(memory), 'external raw storage changes must invalidate the cache')
const unavailable = { getItem: () => { throw new DOMException('denied', 'SecurityError') }, setItem: () => assert.fail('must not write') }
assert.throws(() => readGameHistory(unavailable), { name: 'SecurityError' })
const full = storage()
saveGame(safe, full)
const beforeQuota = full.getItem(GAME_HISTORY_KEY)
full.setItem = () => { throw new DOMException('full', 'QuotaExceededError') }
assert.throws(() => saveGame(next, full), { name: 'QuotaExceededError' })
assert.equal(full.getItem(GAME_HISTORY_KEY), beforeQuota, 'quota failure must preserve previous history')
assert.deepEqual(readGameHistory(full), [safe], 'quota failure must not update the in-memory cache')

const many = storage()
many.setItem(GAME_HISTORY_KEY, JSON.stringify(Array.from({ length: 301 }, (_, index) => ({ ...safe, id: `retained-${index}` }))))
assert.equal(saveGame(next, many).length, 302, 'saving never silently truncates older games')
console.log('✓ Game history: legal PGN round trips, colors/results/FEN/promotion, safe headers, stable IDs, cache isolation, corrupt storage, quota, no truncation')
