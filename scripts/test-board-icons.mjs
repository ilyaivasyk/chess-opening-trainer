import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Chess } from 'chess.js'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const result = await build({ entryPoints: ['src/board-icons.tsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', write: false, logLevel: 'silent' })
// Keep package resolution relative to the repository.
const { writeFile, unlink } = await import('node:fs/promises')
const path = new URL('../.board-icons-test.mjs', import.meta.url)
await writeFile(path, result.outputFiles[0].text)
try {
  const { resultLoser, CapturedPieces, MoveIcon, KingResultBadge } = await import(path.href)
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
  assert(pieces.includes('<svg') && pieces.includes('×3') && pieces.includes('+2'))
  assert(renderToStaticMarkup(React.createElement(MoveIcon,{symbol:'📖'})).includes('<svg'))
  for (const kind of ['loss','win']) {
    const markup = renderToStaticMarkup(React.createElement(KingResultBadge,{kind,label:kind,style:{}}))
    assert(markup.includes('<svg') && markup.includes('result-label visible'))
  }
  console.log('✓ Checkmate/resignation/review result mapping, SVG book/result icons and grouped captures')
} finally { await unlink(path) }
