import { Mp3Encoder } from '@breezystack/lamejs'

const TARGET_SAMPLE_RATE = 32_000
const TARGET_BITRATE_KBPS = 64
const LAME_FRAME_SIZE = 1152

/**
 * Voice-grade compression target is mono 32 kHz 64 kbps mp3.
 * A 3-minute file at that profile is ~1.4 MB, so any mp3 already at or under
 * 1.5 MB is assumed to be pre-compressed (e.g. via the Python pipeline) and
 * passes through untouched. Files above the threshold or in other formats
 * (wav/m4a/ogg/...) get re-encoded.
 */
const RAW_PASSTHROUGH_MAX_BYTES = 1.5 * 1024 * 1024

export type CompressAudioResult = {
  blob: Blob
  contentType: string
  compressed: boolean
  filename: string
}

function isAlreadyMp3(file: File): boolean {
  if (file.type === 'audio/mpeg' || file.type === 'audio/mp3') return true
  return /\.mp3$/i.test(file.name)
}

function meetsUploadBaseline(file: File): boolean {
  return isAlreadyMp3(file) && file.size <= RAW_PASSTHROUGH_MAX_BYTES
}

type WebkitAudioContextWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext
}

function createAudioContext(): AudioContext {
  const w = window as WebkitAudioContextWindow
  const Ctor = window.AudioContext ?? w.webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API 不可用')
  return new Ctor()
}

async function decodeFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  const ctx = createAudioContext()
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    void ctx.close()
  }
}

async function resampleToMono(decoded: AudioBuffer): Promise<Float32Array> {
  const length = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, length, TARGET_SAMPLE_RATE)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

function floatToInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

function toArrayBuffer(view: { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer
}

function encodeMp3(pcm: Int16Array): Blob {
  const encoder = new Mp3Encoder(1, TARGET_SAMPLE_RATE, TARGET_BITRATE_KBPS)
  const chunks: ArrayBuffer[] = []
  for (let i = 0; i < pcm.length; i += LAME_FRAME_SIZE) {
    const frame = pcm.subarray(i, i + LAME_FRAME_SIZE)
    const buf = encoder.encodeBuffer(frame)
    if (buf.length > 0) chunks.push(toArrayBuffer(buf))
  }
  const tail = encoder.flush()
  if (tail.length > 0) chunks.push(toArrayBuffer(tail))
  return new Blob(chunks, { type: 'audio/mpeg' })
}

function renameToMp3(name: string): string {
  return name.replace(/\.[^.]+$/i, '') + '.mp3'
}

function fallback(file: File): CompressAudioResult {
  return {
    blob: file,
    contentType: file.type || 'audio/mpeg',
    compressed: false,
    filename: file.name,
  }
}

/**
 * Re-encode any audio file (mp3/m4a/wav/ogg/...) to voice-grade mono 32kHz 64 kbps mp3.
 *
 * Returns the original file unchanged when:
 * - it already meets the upload baseline (mp3 ≤ 1.5 MB — assumed pre-compressed); or
 * - the encoder output is not smaller than the input; or
 * - decoding fails (corrupt / unsupported format → let Supabase deal with it).
 */
export async function compressAudioToMp3(file: File): Promise<CompressAudioResult> {
  if (typeof window === 'undefined') return fallback(file)
  if (meetsUploadBaseline(file)) return fallback(file)
  try {
    const decoded = await decodeFile(file)
    const monoPcm = await resampleToMono(decoded)
    const int16 = floatToInt16(monoPcm)
    const blob = encodeMp3(int16)
    if (blob.size === 0 || blob.size >= file.size) return fallback(file)
    return {
      blob,
      contentType: 'audio/mpeg',
      compressed: true,
      filename: renameToMp3(file.name),
    }
  } catch {
    return fallback(file)
  }
}
