import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: [new URL('../src/board-appearance.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { BOARD_THEMES, getBoardTheme } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const luminance = (hex) => hex.slice(1).match(/../g).map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)

for (const theme of Object.keys(BOARD_THEMES)) {
  assert.equal(getBoardTheme(JSON.parse(JSON.stringify(theme))), theme, 'stored theme must survive a reload')
  assert.match(BOARD_THEMES[theme].light, /^#[\da-f]{6}$/)
  assert.match(BOARD_THEMES[theme].dark, /^#[\da-f]{6}$/)
  assert.notEqual(BOARD_THEMES[theme].light, BOARD_THEMES[theme].dark)
  assert.ok((luminance(BOARD_THEMES[theme].dark) + .05) / .05 >= 4.5, 'black coordinates must remain legible on dark squares')
}
for (const value of [null, undefined, '', 'green', '__proto__', 'constructor', {}, [], 1, true]) {
  assert.equal(getBoardTheme(value), 'classic', 'untrusted stored values must fall back to Classic')
}
console.log('✓ Board appearance: all three stored themes, coordinate contrast and invalid-value fallback')
