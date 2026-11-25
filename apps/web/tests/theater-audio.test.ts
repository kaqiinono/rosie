import { describe, expect, it } from 'vitest'
import { readMatroskaAudioCodecs, readMp4AudioCodecs } from '../src/lib/theater/audio-metadata'
import { matchTheaterAudio, theaterInternalAudioUnavailable } from '../src/lib/theater/types'

function box(type: string, ...payload: Buffer[]) {
  const header = Buffer.alloc(8)
  header.writeUInt32BE(8 + payload.reduce((sum, part) => sum + part.length, 0))
  header.write(type, 4, 'ascii')
  return Buffer.concat([header, ...payload])
}

describe('theater audio metadata', () => {
  it('distinguishes a Matroska AC-3 track from an unreadable Tracks element', () => {
    const file = Buffer.from('1a45dfa38018538067ff1654ae6b8cae8a8381028685415f4143', 'hex')
    const complete = Buffer.concat([file, Buffer.from('3')])
    expect(readMatroskaAudioCodecs(complete)).toEqual(['ac-3'])
    expect(readMatroskaAudioCodecs(file)).toBeNull()
  })

  it('finds MP4 audio sample entries and distinguishes a video-only file', async () => {
    const handler = (type: string) => box('hdlr', Buffer.alloc(8), Buffer.from(type))
    const video = box('trak', box('mdia', handler('vide')))
    const descriptions = box('stsd', Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), box('ac-3'))
    const audio = box('trak', box('mdia', handler('soun'), box('minf', box('stbl', descriptions))))
    const read = (file: Buffer) => readMp4AudioCodecs(file.length, async (offset, length) => file.subarray(offset, offset + length))
    expect(await read(box('moov', video, audio))).toEqual(['ac-3'])
    expect(await read(box('moov', video))).toEqual([])
  })

  it('selects only a unique normalized same-name audio file', () => {
    const mp3 = { fileId: '1', name: 'Film.MP3', folder: '' }
    expect(matchTheaterAudio('Ｆｉｌｍ.mkv', [mp3])).toBe('1')
    expect(matchTheaterAudio('Film.mkv', [mp3, { ...mp3, fileId: '2', name: 'Film.m4a' }])).toBe('')
  })

  it('automatically falls back for confirmed absent or unsupported internal audio', () => {
    const unsupported = () => ''
    expect(theaterInternalAudioUnavailable([], undefined, unsupported)).toBe(true)
    expect(theaterInternalAudioUnavailable(null, 0, unsupported)).toBe(true)
    expect(theaterInternalAudioUnavailable(['ac-3'], undefined, unsupported)).toBe(true)
    expect(theaterInternalAudioUnavailable(['ac-3'], 1, () => 'probably')).toBe(false)
    expect(theaterInternalAudioUnavailable(['ac-3', 'unknown'], undefined, unsupported)).toBe(false)
    expect(theaterInternalAudioUnavailable(null, undefined, unsupported)).toBe(false)
  })
})
