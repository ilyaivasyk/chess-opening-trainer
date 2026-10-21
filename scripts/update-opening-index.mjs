import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { Chess } from 'chess.js'
import { build } from 'esbuild'

// Public CC0 facts only. No private course files participate in this projection.
const revision = 'c67912be581f0793dbaa776be5ccf111e01f88d9'
const source = `https://raw.githubusercontent.com/lichess-org/chess-openings/${revision}`
const directory = process.argv[2]
// Specific catalog branches precede their parent families; names remain upstream facts.
const rules = [
  ['stafford', /^Petrov's Defense: Stafford Gambit/],
  ['stonewall-dutch', /^Dutch Defense: Stonewall Variation/],
  ['kings-indian-samisch', /^King's Indian Defense: Sämisch Variation/],
  ['nimzo-samisch', /^Nimzo-Indian Defense: Sämisch Variation/],
  ['grunfeld-exchange', /^Grünfeld Defense: Exchange/],
  ['catalan-open', /^Catalan Opening: Open Defense/],
  ['french-winawer', /^French Defense: Winawer Variation/],
  ['ragozin', /^Queen's Gambit Declined: Ragozin Defense/],
  ['meran', /^Semi-Slav Defense: Meran Variation/],
  ['berlin', /^Ruy Lopez: (?:Berlin Defense|Open Berlin Defense)/],
  ['marshall-attack', /^Ruy Lopez: Marshall Attack/],
  ['open-ruy', /^Ruy Lopez: Open(?:$|,)/],
  ['najdorf', /^Sicilian Defense: Najdorf Variation/],
  ['dragon', /^Sicilian Defense: Dragon Variation/],
  ['sveshnikov', /^Sicilian Defense: Lasker-Pelikan Variation.*Sveshnikov/],
  ['maroczy-bind', /^Sicilian Defense: Accelerated Dragon.*Maróczy Bind/],
  ['taimanov', /^Sicilian Defense: Taimanov Variation/],
  ['scheveningen', /^Sicilian Defense: Scheveningen Variation/],
  ['london', /^(?:London System|.*: (?:Accelerated )?London System)/],
  ['colle', /^(?:Colle System|.*: Colle System)/],
  ['torre', /^(?:Torre Attack|.*: Torre Attack)/],
  ['budapest', /^Indian Defense: Budapest Gambit/],
  ['danish', /^Danish Gambit/],
  ['italian', /^Italian Game/],
  ['queens-gambit', /^Queen's Gambit(?: Accepted)?(?:$|:)/],
  ['caro-kann', /^Caro-Kann Defense/],
  ['qgd', /^Queen's Gambit Declined/],
  ['scotch', /^Scotch Game/],
  ['vienna', /^Vienna Game/],
  ['four-knights', /^Four Knights Game/],
  ['french', /^French Defense/],
  ['scandinavian', /^Scandinavian Defense/],
  ['pirc', /^Pirc Defense/],
  ['alekhine', /^Alekhine Defense/],
  ['kings-gambit', /^King's Gambit/],
  ['center-game', /^Center Game/],
  ['bishops-opening', /^Bishop's Opening/],
  ['philidor', /^Philidor Defense/],
  ['petrov', /^Petrov's Defense/],
  ['slav', /^Slav Defense/],
  ['dutch', /^Dutch Defense/],
  ['queens-pawn', /^Queen's Pawn Game/],
  ['ruy-lopez', /^Ruy Lopez/],
  ['sicilian', /^Sicilian Defense/],
  ['english', /^English Opening/],
  ['reti', /^Réti Opening/],
  ['catalan', /^Catalan Opening/],
  ['trompowsky', /^Trompowsky Attack/],
  ['bird', /^Bird Opening/],
  ['grob', /^Grob Opening/],
  ['modern', /^Modern Defense/],
  ['owens', /^Owen Defense/],
  ['queens-indian', /^Queen's Indian Defense/],
  ['bogo-indian', /^Bogo-Indian Defense/],
  ['semi-slav', /^Semi-Slav Defense/],
  ['larsen', /^Nimzo-Larsen Attack/],
  ['polish', /^Polish Opening/],
  ['kings-indian-attack', /^King's Indian Attack/],
  ['benko-gambit', /^Benko Gambit/],
  ['kings-indian', /^King's Indian Defense/],
  ['nimzo-indian', /^Nimzo-Indian Defense/],
  ['grunfeld', /^Grünfeld Defense/],
  ['benoni', /^Benoni Defense/],
]
const positions = new Map()
const priorities = new Map()
const book = new Map()
let rows = 0
for (const volume of 'abcde') {
  const response = directory ? await readFile(`${directory}/${volume}.tsv`, 'utf8') : await fetch(`${source}/${volume}.tsv`).then(async (result) => {
    assert(result.ok, `Lichess ${volume}.tsv: HTTP ${result.status}`)
    return result.text()
  })
  const [header, ...lines] = response.trimEnd().split('\n')
  assert.equal(header.replace(/\r$/, ''), 'eco\tname\tpgn')
  for (const line of lines) {
    const [eco, name, pgn] = line.replace(/\r$/, '').split('\t')
    assert(eco && name && pgn && /^[A-E][0-9]{2}$/.test(eco))
    const game = new Chess()
    game.loadPgn(pgn)
    const history = game.history({ verbose: true })
    for (const move of history) {
      const key = move.before.split(' ').slice(0, 4).join(' ')
      if (!book.has(key)) book.set(key, new Set())
      book.get(key).add(`${move.from}${move.to}${move.promotion ?? ''}`)
    }
    const fen = game.fen().split(' ').slice(0, 4).join(' ')
    const priority = rules.findIndex(([, pattern]) => pattern.test(name))
    const id = rules[priority]?.[0] ?? ''
    // Named aliases can share one position; prefer the more specific catalog branch.
    if (!positions.has(fen) || (priority >= 0 && (priorities.get(fen) < 0 || priority < priorities.get(fen)))) {
      positions.set(fen, [fen, eco, name, id, pgn])
      priorities.set(fen, priority)
    }
    rows++
  }
}
const compiled = await build({ entryPoints: ['src/data/catalog.ts'], bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' })
const { getCatalog } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`)
const covered = new Set([...positions.values()].map(([, , , id]) => id))
for (const course of getCatalog('en')) assert(covered.has(course.id), `No upstream named position for ${course.id}`)
await writeFile('src/data/opening-index.json', JSON.stringify({
  source: `https://github.com/lichess-org/chess-openings/tree/${revision}`,
  revision, license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  positions: [...positions.values()],
  book: [...book].map(([fen, moves]) => [fen, [...moves]]),
}) + '\n')
console.log(`✓ ${rows} CC0 rows; ${positions.size} named positions; ${book.size} book positions; all ${getCatalog('en').length} catalog families mapped`)
