import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Chess } from 'chess.js'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const result = await build({ entryPoints: ['src/board-icons.tsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', write: false, logLevel: 'silent' })
// Keep package resolution relative to the repository.
const { readFile, writeFile, unlink } = await import('node:fs/promises')
const readyIcons = JSON.parse(await readFile(new URL('../src/vendor/ready-icons.json', import.meta.url), 'utf8'))
const path = new URL('../.board-icons-test.mjs', import.meta.url)
await writeFile(path, result.outputFiles[0].text)
try {
  const { resultLoser, CapturedPieces, MoveIcon, KingResultBadge, PieceIcon, BOARD_PIECES, UiIcon } = await import(path.href)
  assert.deepEqual(Object.keys(BOARD_PIECES).sort(), ['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP'].sort())
  const imageSource = (markup) => markup.match(/<img[^>]+src="([^"]+)"/)[1]
  for (const [piece, Component] of Object.entries(BOARD_PIECES)) {
    const markup = renderToStaticMarkup(React.createElement(Component))
    const source = imageSource(markup)
    assert.equal(decodeURIComponent(source.slice('data:image/svg+xml,'.length)), readyIcons.pieces[piece], `${piece}: board must retain exact upstream artwork`)
    assert.equal(imageSource(renderToStaticMarkup(React.createElement(PieceIcon, { type: piece[1].toLowerCase(), color: piece[0] }))), source, `${piece}: side/promotion icon must match board`)
    assert.equal(imageSource(renderToStaticMarkup(React.createElement(CapturedPieces, { pieces: [{ type: piece[1].toLowerCase(), color: piece[0], count: 1 }], advantage: 0 }))), source, `${piece}: captures must match board`)
    assert(markup.includes('aria-hidden="true"') && markup.includes('draggable="false"'))
    assert(!/<(?:script|foreignObject)|\son\w+=|(?:href|src)=["'](?!data:|#)/i.test(readyIcons.pieces[piece]), `${piece}: piece contains active or external content`)
  }
  for (const [name, svg] of Object.entries(readyIcons.ui)) {
    assert(!/<(?:script|foreignObject)|\son\w+=|(?:href|src)=["'](?!data:|#)/i.test(svg), `${name}: immutable icon contains active or external content`)
    const markup = renderToStaticMarkup(React.createElement(UiIcon, { name }))
    assert(markup.includes('class="ui-icon"') && markup.includes('aria-hidden="true"'))
    assert(markup.includes(svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))), `${name}: glyph geometry must remain upstream`)
  }
  const game = new Chess()
  assert.equal(resultLoser(game, false, 'w', true), null)
  assert.equal(resultLoser(game, true, 'w', true), 'w')
  assert.equal(resultLoser(game, true, 'b', true), 'b')
  assert.equal(resultLoser(game, true, 'w', false), null)
  for (const san of ['f3','e5','g4','Qh4#']) game.move(san)
  assert.equal(resultLoser(game, false, 'b', false), 'w')
  const whiteWins = new Chess()
  for (const san of ['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7#']) whiteWins.move(san)
  assert.equal(resultLoser(whiteWins, false, 'w', true), 'b')
  const pieces = renderToStaticMarkup(React.createElement(CapturedPieces, {pieces:[{type:'p',color:'b',count:3}],advantage:2}))
  assert(pieces.includes('<img') && pieces.includes('×3') && pieces.includes('+2'))
  assert(renderToStaticMarkup(React.createElement(MoveIcon,{symbol:'📖'})).includes('<svg'))
  assert.equal(renderToStaticMarkup(React.createElement(MoveIcon,{symbol:'👍'})), renderToStaticMarkup(React.createElement(UiIcon,{name:'thumbs-up'})), 'Excellent move uses the ready thumbs-up glyph')
  assert.equal(renderToStaticMarkup(React.createElement(MoveIcon,{symbol:'↗'})), renderToStaticMarkup(React.createElement(UiIcon,{name:'arrow-up-right'})), 'Departure keeps its own arrow glyph')
  for (const kind of ['loss','win']) {
    const markup = renderToStaticMarkup(React.createElement(KingResultBadge,{kind,label:kind,style:{}}))
    assert(markup.includes('<svg') && markup.includes('result-label visible'))
    if (kind === 'loss') assert(markup.includes('<image ') && markup.includes('rotate(70 50 50)') && !markup.includes('<img'), 'Tipped king must use valid SVG image markup')
  }
  console.log('✓ Exact ready Cburnett pieces across board/captures/promotion, Lucide geometry/accessibility and checkmate/resignation result icons')
} finally { await unlink(path) }
