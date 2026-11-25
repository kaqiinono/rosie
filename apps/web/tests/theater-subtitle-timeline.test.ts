import { describe, expect, it } from 'vitest'
import { parseTheaterSubtitles, spliceTheaterSubtitle, theaterSubtitleShortcut } from '../src/lib/theater/subtitle-timeline'

describe('theater subtitle timeline edits', () => {
  it('splits at the current position with the timing precision of the selected track', () => {
    const cue = { startMs: 1000, endMs: 3000, text: 'Hello. Goodbye.' }
    expect(theaterSubtitleShortcut([cue], 'en', 0, 'split', 10, 1578)?.after).toEqual([
      { startMs: 1000, endMs: 1570, text: 'Hello.' },
      { startMs: 1570, endMs: 3000, text: 'Goodbye.' },
    ])
  })

  it('merges with the adjacent cue in the selected track and skips unavailable neighbors', () => {
    const first = { startMs: 1000, endMs: 2000, text: 'One' }
    const next = { startMs: 3000, endMs: 4000, text: 'Two\nThree' }
    const track = [first, next]
    expect(theaterSubtitleShortcut(track, 'en', 0, 'previous', 1, 0)).toBeNull()
    expect(theaterSubtitleShortcut(track, 'en', 1, 'previous', 1, 0)).toEqual({
      kind: 'timeline', language: 'en', index: 0, before: track,
      after: [{ startMs: 1000, endMs: 4000, text: 'One Two Three' }],
    })
  })

  it('splits and merges SRT cues and keeps sequential cue numbers', () => {
    const source = '1\r\n00:00:01,000 --> 00:00:03,000\r\nHello. Goodbye.\r\n\r\n2\r\n00:00:04,000 --> 00:00:05,000\r\nNext.\r\n'
    const parts = [
      { startMs: 1000, endMs: 2150, text: 'Hello.' },
      { startMs: 2150, endMs: 3000, text: 'Goodbye.' },
    ]
    const split = spliceTheaterSubtitle(source, 'test.srt', 0, 1, parts)
    expect(parseTheaterSubtitles(split, 'test.srt')).toEqual([
      ...parts, { startMs: 4000, endMs: 5000, text: 'Next.' },
    ])
    expect(split).toContain('3\r\n00:00:04,000')
    expect(spliceTheaterSubtitle(split, 'test.srt', 0, 2, parseTheaterSubtitles(source, 'test.srt').slice(0, 1)))
      .toContain('2\r\n00:00:04,000')
  })

  it('preserves WebVTT headers, cue settings, and metadata between removed cues', () => {
    const source = 'WEBVTT\n\nfirst\n00:01.000 --> 00:02.000 align:start\nOne\n\nNOTE keep me\n\nsecond\n00:02.000 --> 00:03.000\nTwo\n'
    const merged = spliceTheaterSubtitle(source, 'test.vtt', 0, 2, [{ startMs: 1000, endMs: 3000, text: 'One Two' }])
    expect(merged).toContain('first\n00:00:01.000 --> 00:00:03.000 align:start')
    expect(merged).toContain('NOTE keep me')
    expect(parseTheaterSubtitles(merged, 'test.vtt')).toEqual([{ startMs: 1000, endMs: 3000, text: 'One Two' }])
  })

  it('keeps overlapping cues when the split point is after the next cue starts', () => {
    const source = '1\n00:00:01,000 --> 00:00:05,000\nLong\n\n2\n00:00:02,000 --> 00:00:03,000\nOverlap\n'
    const output = spliceTheaterSubtitle(source, 'test.srt', 0, 1, [
      { startMs: 1000, endMs: 4000, text: 'First' }, { startMs: 4000, endMs: 5000, text: 'Second' },
    ])
    expect(parseTheaterSubtitles(output, 'test.srt').map(cue => cue.text)).toEqual(['First', 'Overlap', 'Second'])
  })

  it('preserves ASS event fields and supports inserting into a track after deleting its final cue', () => {
    const source = '[Events]\nFormat: Layer, Start, End, Style, Text\nDialogue: 0,0:00:01.00,0:00:02.00,Custom,Hello\n'
    const split = spliceTheaterSubtitle(source, 'test.ass', 0, 1, [
      { startMs: 1000, endMs: 1250, text: 'Hel' }, { startMs: 1250, endMs: 2000, text: 'lo' },
    ])
    expect(split).toContain('Dialogue: 0,0:00:01.25,0:00:02.00,Custom,lo')
    const empty = spliceTheaterSubtitle(source, 'test.ass', 0, 1, [])
    expect(parseTheaterSubtitles(empty, 'test.ass', true)).toEqual([])
    const cue = { startMs: 1000, endMs: 2000, text: 'Back' }
    expect(parseTheaterSubtitles(spliceTheaterSubtitle(empty, 'test.ass', 0, 0, [cue]), 'test.ass')).toEqual([cue])
  })
})
