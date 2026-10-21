import assert from 'node:assert/strict'
import { build } from 'esbuild'

const bundle = await build({ entryPoints: [new URL('../src/dropdown-position.ts', import.meta.url).pathname], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { getDropdownPlacement } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
const viewport = { top: 0, left: 0, width: 375, height: 812 }

// Prefer below when the complete menu fits, even if there is more room above.
assert.deepEqual(getDropdownPlacement({ top: 500, bottom: 544, right: 355, width: 145 }, viewport, 132), { top: 551, left: 165, width: 190, maxHeight: 132 })
assert.deepEqual(getDropdownPlacement({ top: 740, bottom: 784, right: 355, width: 145 }, viewport, 480), { top: 253, left: 165, width: 190, maxHeight: 480 })
assert.equal(getDropdownPlacement({ top: 100, bottom: 144, right: 355, width: 250 }, viewport, 720).width, 250)
assert.equal(getDropdownPlacement({ top: 100, bottom: 144, right: 355, width: 145 }, viewport, 720).maxHeight, 480)

// The previous upward dropdown put the first option above this short viewport.
assert.deepEqual(getDropdownPlacement({ top: 166, bottom: 210, right: 792, width: 145 }, { top: 0, left: 0, width: 812, height: 375 }, 480), { top: 12, left: 602, width: 190, maxHeight: 147 })

const sizes = [
  [375, 812], [414, 896], [390, 844], [428, 926],
  [393, 852], [430, 932], [402, 874], [440, 956],
].flatMap(([width, height]) => [[width, height], [height, width]])
sizes.push([160, 240], [240, 160], [768, 1024], [1024, 768])
let cases = 0
for (const [width, height] of sizes) for (const [left, top] of [[0, 0], [37, 81]]) {
  const frame = { top, left, width, height }
  for (const triggerTop of [top - 70, top + 12, top + height / 2 - 22, top + height - 56, top + height + 30]) {
    for (const right of [left - 20, left + width / 2, left + width - 12, left + width + 80]) {
      for (const desiredHeight of [0, 132, 480, 720]) {
        const result = getDropdownPlacement({ top: triggerTop, bottom: triggerTop + 44, right, width: 145 }, frame, desiredHeight)
        assert.ok(Object.values(result).every(Number.isFinite), 'placement must stay finite')
        assert.ok(result.top >= top + 12 && result.top + result.maxHeight <= top + height - 12, 'menu must stay inside vertical viewport bounds')
        assert.ok(result.left >= left + 12 && result.left + result.width <= left + width - 12, 'menu must stay inside horizontal viewport bounds')
        assert.equal(result.width, Math.min(190, width - 24), 'narrow viewports must override the target width')
        assert.ok(result.maxHeight >= 0 && result.maxHeight <= Math.min(480, desiredHeight, height - 24), 'menu height must respect content, viewport and 480px limits')
        cases++
      }
    }
  }
}
console.log(`✓ Dropdown placement: below/above choice, short-landscape regression, width/height caps and ${cases} viewport/scroll bounds cases`)
