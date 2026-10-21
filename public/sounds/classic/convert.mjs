// Offline development tool. The decoder is installed in a separate temporary directory.
// Usage: node convert.mjs <decoder-directory> [output-directory]
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

assert(process.argv[2], 'Provide the isolated decoder directory; see SOURCE.txt')
const decoderRoot = resolve(process.argv[2], 'node_modules/@wasm-audio-decoders/ogg-vorbis')
const decoderPackage = JSON.parse(await readFile(resolve(decoderRoot, 'package.json'), 'utf8'))
assert.equal(decoderPackage.version, '0.1.20', 'Use the pinned decoder toolchain')
const { OggVorbisDecoder } = await import(pathToFileURL(resolve(decoderRoot, 'index.js')).href)
const outputRoot = process.argv[3] ? resolve(process.argv[3]) : fileURLToPath(new URL('./', import.meta.url))
await mkdir(outputRoot, { recursive: true })

for (const [source, target, hash] of [
  ['impactWood_light_000.ogg', 'move.wav', 'eb45e35b4bed784d3f120de4afec4b0d6ac09d9e143cce8cfcb7d739e1b1f3c3'],
  ['impactWood_medium_000.ogg', 'capture.wav', '1723a9fd25103ed41af06054814e84e65f4a772bac86ab2dc927da93d9592ff5'],
]) {
  const decoder = new OggVorbisDecoder()
  await decoder.ready
  try {
    const original = await readFile(new URL(`./source/${source}`, import.meta.url))
    assert.equal(createHash('sha256').update(original).digest('hex'), hash, `${source}: original Kenney bytes`)
    const { channelData, sampleRate, samplesDecoded, errors } = await decoder.decodeFile(original)
    assert.deepEqual(errors, [], `${source}: decoding errors`)
    assert.equal(sampleRate, 44100)
    assert.equal(channelData.length, 2)
    const channels = channelData.length
    const dataBytes = samplesDecoded * channels * 2
    const wav = Buffer.alloc(44 + dataBytes)
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataBytes, 4); wav.write('WAVE', 8)
    wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(channels, 22); wav.writeUInt32LE(sampleRate, 24)
    wav.writeUInt32LE(sampleRate * channels * 2, 28); wav.writeUInt16LE(channels * 2, 32)
    wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataBytes, 40)
    let peak = 0, energy = 0
    for (let frame = 0; frame < samplesDecoded; frame++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = channelData[channel][frame]
        assert(Number.isFinite(sample) && Math.abs(sample) < 1, `${source}: invalid or clipping sample`)
        // Preserve every decoded frame and channel, with no gain, trim, resampling or dithering.
        const pcm = Math.round(sample * 32767)
        wav.writeInt16LE(pcm, 44 + (frame * channels + channel) * 2)
        peak = Math.max(peak, Math.abs(pcm) / 32768)
        energy += (pcm / 32768) ** 2
      }
    }
    await writeFile(resolve(outputRoot, target), wav)
    console.log(JSON.stringify({ target, bytes: wav.length, samples: samplesDecoded, sampleRate, channels, seconds: samplesDecoded / sampleRate, peak, rms: Math.sqrt(energy / (samplesDecoded * channels)), sha256: createHash('sha256').update(wav).digest('hex') }))
  } finally {
    decoder.free()
  }
}
