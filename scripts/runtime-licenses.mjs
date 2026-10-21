import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const fairyFiles = ['worker.js', 'fairy-stockfish.js', 'fairy-stockfish.wasm', 'SOURCE.txt', 'SOURCE.md', 'COPYING.txt', 'AUTHORS', 'fairy-source.tar.gz', 'single-worker.patch', 'browser_main.cpp', 'Makefile.browser']
const soundFiles = ['move.wav', 'capture.wav', 'SOURCE.txt', 'LICENSE.txt', 'KENNEY-LICENSE.txt', 'convert.mjs', 'decoder-package.json', 'decoder-lock.json', 'source/impactWood_light_000.ogg', 'source/impactWood_medium_000.ogg']
const iconLicenseFiles = ['chessnut.txt', 'chessnut-copyright.txt', 'lucide.txt', 'feather.txt', 'ready-icons-source.json']

export function runtimeLicenses() {
  const lock = JSON.parse(readFileSync(resolve(projectRoot, 'package-lock.json'), 'utf8'))
  const notices = ['Third-party runtime licenses\n\nIncludes installed runtime dependencies and dependencies bundled inside their distributions.\n']
  for (const [path, dependency] of Object.entries(lock.packages)) {
    if (!path || dependency.dev) continue
    const directory = resolve(projectRoot, path)
    const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'))
    assert.equal(pkg.version, dependency.version, `${path}: install must match the lockfile`)
    const files = readdirSync(directory).filter((name) => /^(licen[cs]e|copying|notice|copyright)([.\-]|$|notice)/i.test(name)).sort()
    assert(files.length, `${pkg.name}: runtime license text is missing`)
    notices.push(`\n=== ${pkg.name}@${pkg.version} (${pkg.license}) ===\n`)
    for (const name of files) notices.push(`\n${name}\n\n${readFileSync(resolve(directory, name), 'utf8').trim()}\n`)
  }
  notices.push(`\n=== Brilliant-Chess classifier, commit 56e8c48696d3df874f4f1e0f26cb47bedff3231c (MIT) ===\n\n${readFileSync(resolve(projectRoot, 'public/licenses/brilliant-chess.txt'), 'utf8').trim()}\n`)
  const icons = JSON.parse(readFileSync(resolve(projectRoot, 'src/vendor/ready-icons.json'), 'utf8'))
  const iconSource = JSON.parse(readFileSync(resolve(projectRoot, 'public/licenses/ready-icons-source.json'), 'utf8'))
  const expectedIcons = [...Object.entries(icons).flatMap(([group, values]) => Object.keys(values).map((name) => `${group}/${name}`)), ...iconLicenseFiles.filter((name) => name !== 'ready-icons-source.json').map((name) => `license/${name}`)].sort()
  assert.deepEqual(iconSource.files.map(({ group, name }) => `${group}/${name}`).sort(), expectedIcons, 'Ready icon provenance inventory is incomplete')
  for (const { group, name, sha256 } of iconSource.files) {
    const raw = group === 'license' ? readFileSync(resolve(projectRoot, 'public/licenses', name)) : icons[group][name]
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256, `${group}/${name}: ready icon bytes differ from pinned upstream`)
  }
  for (const name of iconLicenseFiles) notices.push(`\n=== Chessnut (Apache-2.0) / Lucide (ISC + Feather MIT): ${name} ===\n\n${readFileSync(resolve(projectRoot, 'public/licenses', name), 'utf8').trim()}\n`)
  const soundSource = readFileSync(resolve(projectRoot, 'public/sounds/classic/SOURCE.txt'), 'utf8')
  const soundHashes = [...soundSource.matchAll(/^([a-f0-9]{64})  ([A-Za-z0-9_./-]+)$/gm)]
  assert.deepEqual(soundHashes.map((match) => match[2]).sort(), soundFiles.filter((name) => name !== 'SOURCE.txt').sort(), 'Kenney sound/source inventory is incomplete')
  for (const [, hash, name] of soundHashes) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(projectRoot, 'public/sounds/classic', name))).digest('hex'), hash, `${name}: sound bytes do not match the provenance record`)
  }
  for (const name of ['SOURCE.txt', 'KENNEY-LICENSE.txt', 'LICENSE.txt']) {
    notices.push(`\n=== Kenney Impact Sounds 1.0 (CC0-1.0): ${name} ===\n\n${readFileSync(resolve(projectRoot, 'public/sounds/classic', name), 'utf8').trim()}\n`)
  }
  const fairySource = readFileSync(resolve(projectRoot, 'public/fairy-stockfish/SOURCE.txt'), 'utf8')
  const fairyHashes = [...fairySource.matchAll(/^([a-f0-9]{64})  ([A-Za-z0-9_.-]+)$/gm)]
  assert.deepEqual(fairyHashes.map((match) => match[2]).sort(), fairyFiles.filter((name) => name !== 'SOURCE.txt' && name !== 'worker.js').sort(), 'Fairy publisher source inventory is incomplete')
  for (const [, hash, name] of fairyHashes) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(projectRoot, 'public/fairy-stockfish', name))).digest('hex'), hash, `${name}: Fairy publisher bytes do not match the source record`)
  }
  for (const name of ['SOURCE.txt', 'SOURCE.md', 'COPYING.txt', 'AUTHORS']) {
    notices.push(`\n=== Fairy-Stockfish single-worker opponent engine: ${name} ===\n\n${readFileSync(resolve(projectRoot, 'public/fairy-stockfish', name), 'utf8').trim()}\n`)
  }
  return notices.join('')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length > 2, 'Usage: node scripts/runtime-licenses.mjs <build-directory> [...]')
  const expected = runtimeLicenses()
  for (const directory of process.argv.slice(2)) {
    assert.equal(readFileSync(resolve(directory, 'THIRD_PARTY_LICENSES.txt'), 'utf8'), expected, `${directory}: incomplete runtime notices`)
    assert(readFileSync(resolve(directory, 'sw.js'), 'utf8').includes("'./THIRD_PARTY_LICENSES.txt'"), `${directory}: notices must be available offline`)
    assert.equal(readFileSync(resolve(directory, 'licenses/brilliant-chess.txt'), 'utf8'), readFileSync(resolve(projectRoot, 'public/licenses/brilliant-chess.txt'), 'utf8'), `${directory}: vendored classifier attribution is missing`)
    for (const name of iconLicenseFiles) {
      assert(readFileSync(resolve(directory, 'licenses', name)).equals(readFileSync(resolve(projectRoot, 'public/licenses', name))), `${directory}: ready icon license/source record differs`)
      assert(readFileSync(resolve(directory, 'sw.js'), 'utf8').includes(`'./licenses/${name}'`), `${directory}: ready icon attribution must be available offline`)
    }
    for (const name of soundFiles) {
      assert(readFileSync(resolve(directory, 'sounds/classic', name)).equals(readFileSync(resolve(projectRoot, 'public/sounds/classic', name))), `${directory}: Kenney sound/source bytes differ from the verified asset`)
      assert(readFileSync(resolve(directory, 'sw.js'), 'utf8').includes(`'./sounds/classic/${name}'`), `${directory}: sounds and provenance must be available offline`)
    }
    for (const name of fairyFiles) {
      assert(readFileSync(resolve(directory, 'fairy-stockfish', name)).equals(readFileSync(resolve(projectRoot, 'public/fairy-stockfish', name))), `${directory}: Fairy engine or corresponding source differs from the verified public asset`)
      assert(readFileSync(resolve(directory, 'sw.js'), 'utf8').includes(`'./fairy-stockfish/${name}'`), `${directory}: Fairy engine and corresponding source must be available offline`)
    }
  }
  console.log('✓ Complete runtime notices match installed lockfile dependencies and are precached')
}
