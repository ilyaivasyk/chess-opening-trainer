import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setImmediate } from 'node:timers/promises'
import { build } from 'esbuild'

const assetRoot = new URL('../public/sounds/classic/', import.meta.url)
const source = await readFile(new URL('SOURCE.txt', assetRoot), 'utf8')
const inventory = [...source.matchAll(/^([a-f0-9]{64})  ([A-Za-z0-9_./-]+)$/gm)]
assert.deepEqual(inventory.map((match) => match[2]).sort(), ['move.wav', 'capture.wav', 'LICENSE.txt', 'KENNEY-LICENSE.txt', 'convert.mjs', 'decoder-package.json', 'decoder-lock.json', 'source/impactWood_light_000.ogg', 'source/impactWood_medium_000.ogg'].sort(), 'complete sound/source hash inventory')
let recordings = 0
for (const [, hash, name] of inventory) {
  const path = new URL(name, assetRoot)
  const bytes = await readFile(path)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash, `${name}: verified source or conversion bytes`)
  if (!name.endsWith('.wav')) continue
  recordings++
  assert.equal(bytes.subarray(0, 4).toString(), 'RIFF')
  assert.equal(bytes.subarray(8, 16).toString(), 'WAVEfmt ')
  assert.equal(bytes.readUInt32LE(4), bytes.length - 8)
  assert.equal(bytes.readUInt32LE(16), 16)
  assert.equal(bytes.readUInt16LE(20), 1, `${name}: uncompressed PCM`)
  assert.equal(bytes.readUInt16LE(22), 2, `${name}: original stereo channels`)
  assert.equal(bytes.readUInt32LE(24), 44100, `${name}: original sample rate`)
  assert.equal(bytes.readUInt16LE(32), 4)
  assert.equal(bytes.readUInt16LE(34), 16, `${name}: PCM16`)
  assert.equal(bytes.subarray(36, 40).toString(), 'data')
  assert.equal(bytes.readUInt32LE(40), bytes.length - 44)
  const frames = (bytes.length - 44) / 4
  assert.equal(frames, name === 'move.wav' ? 11713 : 14671, `${name}: all original frames preserved`)
  let peak = 0, energy = 0
  for (let offset = 44; offset < bytes.length; offset += 2) {
    const sample = bytes.readInt16LE(offset) / 32768
    peak = Math.max(peak, Math.abs(sample))
    energy += sample * sample
  }
  assert.ok(peak > 0.85 && peak < 0.90, `${name}: non-silent, unclipped wood impact`)
  const rms = Math.sqrt(energy / (frames * 2))
  assert.ok(rms > 0.07 && rms < 0.08, `${name}: bounded impact energy`)
  if (process.platform === 'darwin') {
    const info = execFileSync('/usr/bin/afinfo', [fileURLToPath(path)], { encoding: 'utf8' })
    assert.ok(Number(info.match(/estimated duration:\s*([\d.]+)/)?.[1]) > 0, `${name}: playable audio duration`)
    assert.match(info, /Data format:.*44100 Hz, Int16/, `${name}: system decoder confirms PCM WAV`)
  }
}
assert.equal(recordings, 2)
assert.match(await readFile(new URL('KENNEY-LICENSE.txt', assetRoot), 'utf8'), /License: \(Creative Commons Zero, CC0\)/)
assert.match(await readFile(new URL('LICENSE.txt', assetRoot), 'utf8'), /CC0 1\.0 Universal/)

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/sounds.ts', import.meta.url))], bundle: true, format: 'esm', write: false, define: { 'import.meta.env.BASE_URL': '"/trainer/"' }, logLevel: 'silent' })
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
const originalContext = globalThis.AudioContext
const originalFetch = globalThis.fetch
const originalStorage = globalThis.localStorage
let state
class MockAudioContext {
  state = 'suspended'
  destination = {}
  constructor() { state.contexts.push(this) }
  createGain() { const output = { gain: { value: 1 }, connect() {} }; state.outputs.push(output); return output }
  async resume() {
    state.resumeCalls++
    if (state.resumeGate) await state.resumeGate.promise
    if (state.failResume) throw new Error('Autoplay denied')
    this.state = 'running'
  }
  async decodeAudioData(bytes) {
    const file = Buffer.from(bytes).toString()
    if (state.failDecode.has(file)) throw new Error('Cannot decode')
    return { file }
  }
  createBufferSource() {
    const active = this
    return { buffer: null, connect() {}, start() { state.played.push({ context: active, file: this.buffer.file }) } }
  }
  async close() { this.state = 'closed'; state.closeCalls++ }
}
const fresh = async (name, stored = undefined) => {
  const preferences = new Map(stored === undefined ? [] : [['chess-sounds', stored]])
  globalThis.localStorage = { getItem(key) { return preferences.get(key) ?? null }, setItem(key, value) { preferences.set(key, value) } }
  state = { preferences, outputs: [], contexts: [], requested: [], played: [], resumeCalls: 0, closeCalls: 0, failFetch: new Set(), failDecode: new Set() }
  globalThis.AudioContext = MockAudioContext
  globalThis.fetch = async (url) => {
    state.requested.push(url)
    const file = url.split('/').at(-1)
    if (state.fetchGate) await state.fetchGate.promise
    return new Response(file, { status: state.failFetch.has(file) ? 503 : 200 })
  }
  return import(`${moduleUrl}#${name}`)
}
const flush = async () => { await setImmediate(); await setImmediate() }

try {
  const sounds = await fresh('gesture')
  sounds.playChessSound('move')
  await flush()
  assert.equal(state.contexts.length, 0, 'play must not create audio before a user gesture')
  assert.equal(state.requested.length, 0)
  state.resumeGate = Promise.withResolvers()
  sounds.unlockChessSounds()
  assert.equal(state.resumeCalls, 1, 'resume must be called synchronously inside the gesture')
  sounds.playChessSound('mate')
  await flush()
  assert.equal(state.played.length, 0, 'play must wait for AudioContext resume')
  state.resumeGate.resolve()
  await flush()
  assert.deepEqual(state.played.map(({ file }) => file), ['capture.wav'], 'mate uses the short capture click')
  assert.equal(new Set(state.requested).size, 2)
  assert.ok(state.requested.every((url) => url.startsWith('/trainer/sounds/classic/')), 'assets must respect deployment base URL')
  sounds.playChessSound('capture')
  await flush()
  assert.equal(state.requested.length, 2, 'decoded recordings are reused')
  assert.equal(state.played.at(-1).file, 'capture.wav')
  sounds.disposeChessSounds()
  sounds.disposeChessSounds()
  assert.equal(state.closeCalls, 1)

  const failures = await fresh('failures')
  state.failFetch.add('move.wav')
  state.failDecode.add('capture.wav')
  failures.unlockChessSounds()
  failures.playChessSound('move')
  failures.playChessSound('check')
  await flush()
  assert.equal(state.played.length, 0, 'HTTP and decoding failures must remain silent without unhandled rejection')
  state.failFetch.clear()
  state.failDecode.clear()
  failures.playChessSound('move')
  failures.playChessSound('check')
  await flush()
  assert.deepEqual(state.played.map(({ file }) => file).sort(), ['capture.wav', 'move.wav'], 'failed loads can recover')
  failures.disposeChessSounds()

  const stale = await fresh('disposed')
  state.fetchGate = Promise.withResolvers()
  stale.unlockChessSounds()
  stale.playChessSound('move')
  stale.disposeChessSounds()
  state.fetchGate.resolve()
  await flush()
  assert.equal(state.played.length, 0, 'a disposed pending request must never start playback')
  state.fetchGate = undefined
  stale.unlockChessSounds()
  stale.playChessSound('draw')
  await flush()
  assert.equal(state.contexts.length, 2)
  assert.equal(state.played.at(-1).context, state.contexts[1], 'new playback must use the new context')
  assert.equal(state.played.at(-1).file, 'move.wav')
  stale.disposeChessSounds()

  const blocked = await fresh('autoplay-denied')
  state.failResume = true
  blocked.unlockChessSounds()
  blocked.playChessSound('victory')
  await flush()
  assert.equal(state.played.length, 0, 'autoplay rejection must remain silent')
  state.failResume = false
  blocked.unlockChessSounds()
  blocked.playChessSound('victory')
  await flush()
  assert.equal(state.played.at(-1).file, 'capture.wav')
  blocked.disposeChessSounds()

  const muted = await fresh('muted', 'false')
  assert.equal(muted.getChessSoundsEnabled(), false)
  muted.unlockChessSounds()
  muted.playChessSound('move')
  await flush()
  assert.equal(state.contexts.length, 0, 'disabled sounds should not initialize audio or load recordings')
  assert.equal(state.requested.length, 0)
  muted.setChessSoundsEnabled(true)
  assert.equal(state.preferences.get('chess-sounds'), 'true')
  state.fetchGate = Promise.withResolvers()
  muted.unlockChessSounds()
  muted.playChessSound('capture')
  muted.setChessSoundsEnabled(false)
  assert.equal(state.outputs[0].gain.value, 0, 'muting silences sounds already playing')
  muted.setChessSoundsEnabled(true)
  state.fetchGate.resolve()
  await flush()
  assert.equal(state.played.length, 0, 'muted pending events must not reappear after re-enabling')
  assert.equal(state.outputs[0].gain.value, .4)
  muted.playChessSound('move')
  await flush()
  assert.equal(state.played.at(-1).file, 'move.wav')
  globalThis.localStorage = { setItem() { throw new Error('Storage denied') } }
  assert.doesNotThrow(() => muted.setChessSoundsEnabled(false), 'storage denial must not interrupt a game')
  assert.equal(muted.getChessSoundsEnabled(), false)
  muted.disposeChessSounds()

  const unsupported = await fresh('unavailable')
  globalThis.AudioContext = undefined
  assert.doesNotThrow(() => unsupported.unlockChessSounds())
  assert.doesNotThrow(() => unsupported.playChessSound('move'))
  assert.doesNotThrow(() => unsupported.disposeChessSounds())
} finally {
  globalThis.AudioContext = originalContext
  globalThis.fetch = originalFetch
  globalThis.localStorage = originalStorage
}
console.log('✓ Two licensed classic clips; gesture unlock, base URL, reuse, loading/autoplay failures, disposal, safe restart, persisted mute and cancelled pending playback')
