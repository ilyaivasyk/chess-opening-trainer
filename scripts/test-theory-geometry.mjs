import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { build } from 'esbuild'
import { Chess } from 'chess.js'
const result = await build({entryPoints:['src/data/courses.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'})
const { getCourses } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)
const courses = getCourses('en')
if (!process.argv.includes('--public-only') && existsSync('src/data/native-premium.json')) courses.push(...JSON.parse(readFileSync('src/data/native-premium.json','utf8')).en)
let checked = 0
function rayAttacks(position, from, target) {
  const piece = position.get(from)
  const df = target.charCodeAt(0) - from.charCodeAt(0), dr = +target[1] - +from[1]
  if (!df && !dr) return false
  if (piece.type === 'n') return Math.abs(df)*Math.abs(dr) === 2
  if (piece.type === 'p') return Math.abs(df) === 1 && dr === (piece.color === 'w' ? 1 : -1)
  if (piece.type === 'k') return Math.max(Math.abs(df),Math.abs(dr)) === 1
  if (!((piece.type !== 'r' && Math.abs(df) === Math.abs(dr)) || (piece.type !== 'b' && (!df || !dr)))) return false
  for (let f=from.charCodeAt(0)+Math.sign(df),r=+from[1]+Math.sign(dr);f!==target.charCodeAt(0)||r!==+target[1];f+=Math.sign(df),r+=Math.sign(dr)) {
    if (position.get(`${String.fromCharCode(f)}${r}`)) return false
  }
  return true
}
for (const course of courses) for (const scenario of [...course.scenarios,...course.blackScenarios]) {
  const game = new Chess()
  const play = (uci, explanation) => {
    const move = game.move({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]||'q'})
    if (!explanation) return
    const match = explanation.match(/^(?:The |Black’s |White’s )?(knight|bishop|queen|rook|pawn) (?:develops and )?(attacks|protects|controls|pressures|supports) (?:the )?([a-h][1-8])\b/i)
    if (match) {
      const types = {knight:'n',bishop:'b',queen:'q',rook:'r',pawn:'p'}
      assert.equal(move.piece,types[match[1].toLowerCase()],`${course.id}/${uci}: explanation describes a different piece`)
      assert(rayAttacks(game,move.to,match[3]),`${course.id}/${uci}: ${explanation}`)
      const second = explanation.slice(match[0].length).match(/^ and ([a-h][1-8])\b/)
      if (second) { assert(rayAttacks(game,move.to,second[1]),`${course.id}/${uci}: ${explanation}`); checked++ }
      checked++
    }
    const pin = explanation.match(/\bpins the ([a-h][1-8]) knight\b/)
    if (pin && !/may|when|or pressures/.test(explanation)) {
      const target = pin[1]
      assert(rayAttacks(game,move.to,target),`${course.id}: pin target not attacked`)
      const df=Math.sign(target.charCodeAt(0)-move.to.charCodeAt(0)),dr=Math.sign(+target[1]-+move.to[1])
      let victim
      for(let f=target.charCodeAt(0)+df,r=+target[1]+dr;f>=97&&f<=104&&r>=1&&r<=8;f+=df,r+=dr) {
        const piece=game.get(`${String.fromCharCode(f)}${r}`)
        if(piece){victim=piece;break}
      }
      assert(victim && victim.color!==move.color && ['k','q'].includes(victim.type),`${course.id}/${uci}: no king/queen pin behind ${target}`)
      checked++
    }
  }
  if(scenario.initialMove) play(scenario.initialMove,scenario.initialExplanation)
  for(const step of scenario.steps){play(step.userMove,step.explanation);if(step.opponentMove)play(step.opponentMove,step.opponentExplanation)}
}
assert(checked > 20)
console.log(`✓ ${checked} explicit piece-target and pin claims agree with board geometry (${courses.length} English course texts); strategic and conditional prose still requires editorial review`)
