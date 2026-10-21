export type ChessSound = 'move' | 'capture' | 'check' | 'mate' | 'draw' | 'victory' | 'defeat'

// Ready-made Kenney wood recordings, CC0. See the bundled SOURCE.txt.
const soundFiles: Record<ChessSound, string> = {
  move: 'move.wav', capture: 'capture.wav', check: 'capture.wav', mate: 'capture.wav',
  draw: 'move.wav', victory: 'capture.wav', defeat: 'move.wav',
}

let enabled = true
try { enabled = localStorage.getItem('chess-sounds') !== 'false' } catch { /* Storage can be unavailable. */ }
let context: AudioContext | null = null
let output: GainNode | null = null
let ready = Promise.resolve()
let playbackGeneration = 0
const buffers = new Map<string, Promise<AudioBuffer>>()

export function getChessSoundsEnabled() { return enabled }

export function setChessSoundsEnabled(next: boolean) {
  enabled = next
  playbackGeneration += 1
  if (output) output.gain.value = next ? .4 : 0
  try { localStorage.setItem('chess-sounds', String(next)) } catch { /* Keep the in-memory preference. */ }
}

function loadSound(activeContext: AudioContext, file: string) {
  const cached = buffers.get(file)
  if (cached) return cached
  const pending = fetch(`${import.meta.env.BASE_URL}sounds/classic/${file}`)
    .then(async (response) => {
      if (!response.ok) throw new Error('Could not load chess sound')
      return activeContext.decodeAudioData(await response.arrayBuffer())
    })
    .catch((error: unknown) => {
      if (buffers.get(file) === pending) buffers.delete(file)
      throw error
    })
  buffers.set(file, pending)
  return pending
}

// Call directly from a user gesture so iOS can unlock Web Audio before loading files.
export function unlockChessSounds() {
  if (!enabled) return
  try {
    if (!context) {
      context = new AudioContext()
      output = context.createGain()
      output.gain.value = .4
      output.connect(context.destination)
    }
    if (context.state !== 'running') ready = context.resume().catch(() => {})
    for (const file of new Set(Object.values(soundFiles))) void loadSound(context, file).catch(() => {})
  } catch {
    // Sound stays optional on devices that cannot start Web Audio.
  }
}

export function playChessSound(kind: ChessSound) {
  const activeContext = context
  const generation = playbackGeneration
  if (!enabled || !activeContext || !output) return
  void Promise.all([loadSound(activeContext, soundFiles[kind]), ready]).then(([buffer]) => {
    if (!enabled || generation !== playbackGeneration || context !== activeContext || activeContext.state !== 'running' || !output) return
    const source = activeContext.createBufferSource()
    source.buffer = buffer
    source.connect(output)
    source.start()
  }).catch(() => {})
}

export function disposeChessSounds() {
  const previous = context
  context = null
  output = null
  ready = Promise.resolve()
  buffers.clear()
  if (previous && previous.state !== 'closed') void previous.close().catch(() => {})
}
