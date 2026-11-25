import { theaterProbedAudioCodecs } from './types'

type Box = { type: string; start: number; end: number }
type ReadRange = (offset: number, length: number) => Promise<Buffer>

function mp4Box(bytes: Buffer, offset: number, end: number): Box {
  if (offset + 8 > bytes.length) throw Error('Incomplete MP4 box')
  const shortSize = bytes.readUInt32BE(offset)
  const header = shortSize === 1 ? 16 : 8
  const size = shortSize === 0 ? end - offset : shortSize === 1
    ? Number(bytes.readBigUInt64BE(offset + 8)) : shortSize
  if (!Number.isSafeInteger(size) || size < header || size > end - offset) throw Error('Invalid MP4 box')
  return { type: bytes.toString('ascii', offset + 4, offset + 8), start: offset + header, end: offset + size }
}

function* mp4Children(bytes: Buffer, start: number, end: number) {
  for (let offset = start; offset < end;) {
    const child = mp4Box(bytes, offset, end)
    yield child
    offset = child.end
  }
}

export async function readMp4AudioCodecs(size: number, read: ReadRange): Promise<string[] | null> {
  let offset = 0
  for (let index = 0; offset < size && index < 12; index++) {
    const header = await read(offset, Math.min(16, size - offset))
    const box = mp4Box(header, 0, size - offset)
    if (box.type === 'moov') {
      const length = box.end - box.start
      if (length > 8 * 1024 * 1024) return null
      return parseMp4Movie(await read(offset + box.start, length))
    }
    offset += box.end
  }
  return null
}

function parseMp4Movie(bytes: Buffer): string[] | null {
  const child = (box: Box, type: string) => Array.from(mp4Children(bytes, box.start, box.end))
    .find(entry => entry.type === type)
  const codecs = new Set<string>()
  let tracks = 0
  for (const track of mp4Children(bytes, 0, bytes.length)) {
    if (track.type !== 'trak') continue
    tracks++
    const media = child(track, 'mdia')
    const handler = media && child(media, 'hdlr')
    if (!media || !handler || handler.end < handler.start + 12) return null
    if (bytes.toString('ascii', handler.start + 8, handler.start + 12) !== 'soun') continue
    const info = child(media, 'minf')
    const table = info && child(info, 'stbl')
    const descriptions = table && child(table, 'stsd')
    if (!descriptions || descriptions.end < descriptions.start + 8) return null
    const entries = Array.from(mp4Children(bytes, descriptions.start + 8, descriptions.end))
    if (!entries.length || entries.length !== bytes.readUInt32BE(descriptions.start + 4)) return null
    for (const entry of entries) codecs.add(theaterProbedAudioCodecs.has(entry.type) ? entry.type : 'unknown')
  }
  return tracks ? [...codecs] : null
}

function ebmlInteger(bytes: Buffer, offset: number, isSize: boolean) {
  const first = bytes[offset]
  if (!first) throw Error('Invalid EBML integer')
  const length = Math.clz32(first) - 23
  if (length > (isSize ? 8 : 4) || offset + length > bytes.length) throw Error('Incomplete EBML integer')
  const marker = 1 << (8 - length)
  let value = isSize ? first - marker : first
  let unknown = isSize && value === marker - 1
  for (let index = 1; index < length; index++) {
    const byte = bytes[offset + index]
    value = value * 256 + byte
    unknown = unknown && byte === 255
  }
  if (!unknown && !Number.isSafeInteger(value)) throw Error('EBML integer exceeds safe range')
  return { value: unknown ? Infinity : value, length }
}

function* ebmlChildren(bytes: Buffer, start: number, end: number) {
  for (let offset = start; offset < end && offset < bytes.length;) {
    const id = ebmlInteger(bytes, offset, false)
    const size = ebmlInteger(bytes, offset + id.length, true)
    const payload = offset + id.length + size.length
    const next = payload + size.value
    if (next > end) throw Error('Invalid EBML element size')
    yield { id: id.value, start: payload, end: next }
    offset = next
  }
}

const matroskaCodec = new Map([
  ['A_AC3', 'ac-3'], ['A_AC3/BSID9', 'ac-3'], ['A_AC3/BSID10', 'ac-3'], ['A_EAC3', 'ec-3'],
  ['A_DTS', 'dtsc'], ['A_DTS/EXPRESS', 'dtse'], ['A_DTS/LOSSLESS', 'dtsl'],
])

export function readMatroskaAudioCodecs(bytes: Buffer): string[] | null {
  try {
    const root = ebmlChildren(bytes, 0, Infinity)
    const first = root.next()
    if (first.done || first.value.id !== 0x1a45dfa3) return null
    for (const segment of root) {
      if (segment.id !== 0x18538067) continue
      for (const tracks of ebmlChildren(bytes, segment.start, segment.end)) {
        if (tracks.id !== 0x1654ae6b) continue
        if (tracks.end > bytes.length) return null
        const entries = Array.from(ebmlChildren(bytes, tracks.start, tracks.end)).filter(entry => entry.id === 0xae)
        if (!entries.length) return null
        const codecs = new Set<string>()
        for (const entry of entries) {
          const fields = Array.from(ebmlChildren(bytes, entry.start, entry.end))
          const type = fields.find(field => field.id === 0x83)
          if (!type || type.start === type.end) return null
          if (bytes.subarray(type.start, type.end - 1).some(byte => byte !== 0) || bytes[type.end - 1] !== 2) continue
          const codec = fields.find(field => field.id === 0x86)
          if (!codec || codec.start === codec.end) return null
          const name = bytes.toString('ascii', codec.start, codec.end)
          codecs.add(matroskaCodec.get(name) ?? 'unknown')
        }
        return [...codecs]
      }
    }
    return null
  } catch {
    return null
  }
}

