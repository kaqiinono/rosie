import type {
  SubtitleCue, SubtitleTracks, TheaterCue, TheaterCueAction, TheaterCueShortcut, TheaterLanguage, TheaterSubtitleSplice,
} from './types'

export const maxSubtitleBytes = 2 * 1024 * 1024
const maxMediaMs = 24 * 60 * 60 * 1000
const maxCueCount = 12000

function clockMs(value: string): number {
  const match = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(value)
  if (!match) return NaN
  const [, hours = '0', minutes, seconds, fraction] = match
  if (Number(minutes) >= 60 || Number(seconds) >= 60) return NaN
  return (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000 +
    Number(fraction.padEnd(3, '0'))
}

function plainText(value: string) {
  return value.replace(/<[^>\n]*>/g, '').replace(/&(amp|lt|gt|nbsp|quot|apos);/g, (_, entity: string) =>
    ({ amp: '&', lt: '<', gt: '>', nbsp: ' ', quot: '"', apos: "'" } as Record<string, string>)[entity]
  ).trim().slice(0, 1800)
}

type CueFormat = {
  from: number
  to: number
  srtNumber?: number
  render: (cue: SubtitleCue, keepId: boolean, srt: boolean) => string
}
type SubtitleEntry = SubtitleCue & { from: number; to: number; format: CueFormat }

function addCue(entries: SubtitleEntry[], startMs: number, endMs: number, value: string,
  from: number, to: number, format: CueFormat) {
  const text = plainText(value)
  if (!(startMs >= 0 && endMs > startMs && endMs <= maxMediaMs) || !text) return
  if (entries.length >= maxCueCount) throw Error('theater_subtitle_too_long')
  entries.push({ startMs, endMs, text, from, to, format })
}

const encodeText = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function subtitleTimestamp(ms: number) {
  const hours = String(Math.floor(ms / 3_600_000)).padStart(2, '0')
  return hours + new Date(ms).toISOString().slice(13, 23)
}

export function parseSubtitleTimestamp(value: string) {
  return clockMs(value.trim())
}

function assDialogue(fields: string[], values: string[], cue: SubtitleCue, prefix = 'Dialogue: ', tags = '') {
  const time = (ms: number) => subtitleTimestamp(ms).slice(0, -1).replace(/^0/, '')
  return prefix + fields.map((field, index) => {
    if (field === 'start') return time(cue.startMs)
    if (field === 'end') return time(cue.endMs)
    if (field === 'text') return tags + encodeText(cue.text).replace(/\n/g, '\\N')
    return values[index]
  }).join(',')
}

function assEntries(input: string, entries: SubtitleEntry[]) {
  let inEvents = false
  let fields: string[] = []
  for (const { 0: line, index } of input.matchAll(/[^\n]+/g)) {
    const section = /^\s*\[([^\]]+)\]\s*$/.exec(line)
    if (section) {
      inEvents = section[1].toLowerCase() === 'events'
      fields = []
      continue
    }
    if (!inEvents) continue
    if (/^\s*format:/i.test(line)) {
      fields = line.slice(line.indexOf(':') + 1).split(',').map(field => field.trim().toLowerCase())
      continue
    }
    if (!/^\s*dialogue:/i.test(line) || fields.at(-1) !== 'text') continue
    const startIndex = fields.indexOf('start')
    const endIndex = fields.indexOf('end')
    if (startIndex < 0 || endIndex < 0) continue
    const prefix = line.indexOf(':') + 1
    const values = line.slice(prefix).split(',')
    if (values.length < fields.length) continue
    const value = values.slice(fields.length - 1).join(',')
    // Drawings and override tags are presentation data.
    const dialogue = value.replace(/\{[^}]*\\p[1-9][^}]*\}[^{}]*/gi, '')
      .replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ')
    const leadingTags = /^(?:\{[^}]*\})*/.exec(value)?.[0].length ?? 0
    const fieldsForCue = fields
    addCue(entries, clockMs(values[startIndex].trim()), clockMs(values[endIndex].trim()), dialogue,
      index + line.length - value.length + leadingTags, index + line.length, {
        from: index,
        to: index + line.length,
        render: cue => assDialogue(fieldsForCue, values, cue, line.slice(0, prefix), value.slice(0, leadingTags)),
      })
  }
}

function subtitleEntries(input: string, ass: boolean, allowEmpty = false) {
  const entries: SubtitleEntry[] = []
  if (ass) assEntries(input, entries)
  else {
    let offset = 0
    const separator = /\n[ \t]*\n+/g
    for (const block of input.split(separator)) {
      const start = offset
      offset += block.length + (separator.exec(input)?.[0].length ?? 0)
      const trimmed = block.trimStart()
      const lines = trimmed.split('\n')
      if (/^(WEBVTT|NOTE|STYLE|REGION)(?:$|\s)/.test(lines[0])) continue
      const index = lines[0].includes('-->') ? 0 : 1
      const range = /^\s*(\S+)\s+-->\s+(\S+)(.*)$/.exec(lines[index] ?? '')
      if (!range || lines.length <= index + 1) continue
      const value = lines.slice(index + 1).join('\n')
      const trailing = /\n+$/.exec(value)?.[0].length ?? 0
      const identifier = index === 1 ? lines[0] : ''
      const from = start + block.length - trimmed.length
      addCue(entries, clockMs(range[1]), clockMs(range[2]), value, start + block.length - value.length,
        start + block.length - trailing, {
          from, to: start + block.length - trailing,
          srtNumber: /^\d+$/.test(identifier) ? identifier.length : undefined,
          render: (cue, keepId, srt) => blockCue(cue, srt, srt ? '1' : keepId ? identifier : '', range[3]),
        })
    }
  }
  if (!allowEmpty && !entries.length) throw Error('theater_subtitle_empty')
  return entries.sort(compareCueTimes)
}

const normalizedSubtitle = (input: string) => input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')

function compareCueTimes(left: SubtitleCue, right: SubtitleCue) {
  return left.startMs - right.startMs || left.endMs - right.endMs
}

export function parseTheaterSubtitles(input: string, filename: string, allowEmpty = false): SubtitleCue[] {
  return subtitleEntries(normalizedSubtitle(input), /\.ass$/i.test(filename), allowEmpty)
    .map(({ startMs, endMs, text }) => ({ startMs, endMs, text }))
}

export function reviseTheaterSubtitle(input: string, filename: string, changes: ReadonlyMap<number, string>) {
  const ass = /\.ass$/i.test(filename)
  const normalized = normalizedSubtitle(input)
  const entries = subtitleEntries(normalized, ass)
  const replacements = [...changes].map(([index, value]) => {
    const entry = entries[index]
    if (!entry) throw Error('theater_subtitle_source_conflict')
    const encoded = encodeText(value)
    return { ...entry, value: ass ? encoded.replace(/\n/g, '\\N') : encoded }
  }).sort((a, b) => b.from - a.from)
  let result = normalized
  for (const { from, to, value } of replacements) result = result.slice(0, from) + value + result.slice(to)
  const parsed = parseTheaterSubtitles(result, filename)
  if (parsed.length !== entries.length || parsed.some((cue, index) =>
    cue.startMs !== entries[index].startMs || cue.endMs !== entries[index].endMs ||
    cue.text !== (changes.get(index) ?? entries[index].text))) throw Error('theater_subtitle_revision_invalid')
  return input.includes('\r\n') ? result.replace(/\n/g, '\r\n') : result
}

function blockCue(cue: SubtitleCue, srt: boolean, identifier: string, settings = '') {
  const time = (ms: number) => srt ? subtitleTimestamp(ms).replace('.', ',') : subtitleTimestamp(ms)
  return (identifier ? identifier + '\n' : '') + time(cue.startMs) + ' --> ' + time(cue.endMs) + settings +
    '\n' + encodeText(cue.text)
}

export function sameSubtitleCue(left: SubtitleCue, right: SubtitleCue) {
  return left.startMs === right.startMs && left.endMs === right.endMs && left.text === right.text
}

export function canApplyTheaterCueAction(track: SubtitleCue[] | undefined, index: number, step: number,
  action: TheaterCueAction) {
  const cue = track?.[index]
  if (!cue || !track) return false
  if (action === 'previous') return index > 0
  if (action === 'next') return index < track.length - 1
  if (action === 'split') return cue.endMs - cue.startMs > step && cue.startMs % step === 0 && cue.endMs % step === 0
  return true
}

export function theaterSubtitleShortcut(track: SubtitleCue[], language: TheaterLanguage, index: number,
  action: TheaterCueShortcut, step: number, playhead: number): TheaterSubtitleSplice | null {
  if (!canApplyTheaterCueAction(track, index, step, action)) return null
  const cue = track[index]
  const edit = { kind: 'timeline' as const, language, index }
  if (action === 'remove') return { ...edit, before: [cue], after: [] }
  if (action === 'split') {
    const position = Math.floor(playhead / step) * step
    const middle = Math.floor((cue.startMs + cue.endMs) / (2 * step)) * step
    const cut = position > cue.startMs && position < cue.endMs ? position : middle
    const letters = [...cue.text]
    const target = Math.round(letters.length / 2)
    const boundaries = letters.flatMap((letter, offset) => /[.!?。！？,，;；\s]/u.test(letter) ? [offset + 1] : [])
      .filter(offset => offset < letters.length)
    const boundary = boundaries.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0] ?? target
    return { ...edit, before: [cue], after: [
      { startMs: cue.startMs, endMs: cut, text: letters.slice(0, boundary).join('').trim() },
      { startMs: cut, endMs: cue.endMs, text: letters.slice(boundary).join('').trim() },
    ] }
  }
  const first = action === 'previous' ? index - 1 : index
  const before = track.slice(first, first + 2)
  return { ...edit, index: first, before, after: [{
    startMs: before[0].startMs, endMs: Math.max(before[0].endMs, before[1].endMs),
    text: before.map(entry => entry.text).join('\n').replace(/[ \t]*(?:[\r\n]+[ \t]*)+/g, language === 'en' ? ' ' : ''),
  }] }
}

function emptyAssEvent(input: string) {
  const events = /^[ \t]*\[events\][ \t]*\n/im.exec(input)
  if (!events) throw Error('theater_subtitle_revision_invalid')
  const start = events.index + events[0].length
  const section = input.slice(start).split(/^[ \t]*\[/m)[0]
  const format = /^[ \t]*format:[ \t]*([^\n]+)/im.exec(section)
  if (!format) throw Error('theater_subtitle_revision_invalid')
  const fields = format[1].split(',').map(field => field.trim().toLowerCase())
  if (fields.at(-1) !== 'text' || !fields.includes('start') || !fields.includes('end'))
    throw Error('theater_subtitle_revision_invalid')
  const values = fields.map(field => field === 'style' ? 'Default' : /^(layer|margin[lrvt])$/.test(field) ? '0' : '')
  return { position: start + format.index + format[0].length,
    render: (cue: SubtitleCue) => assDialogue(fields, values, cue) }
}

export function spliceTheaterSubtitle(input: string, filename: string, index: number, count: number, after: SubtitleCue[]) {
  const ass = /\.ass$/i.test(filename)
  const srt = /\.srt$/i.test(filename)
  const original = normalizedSubtitle(input)
  const entries = subtitleEntries(original, ass, true)
  if (index > entries.length || index + count > entries.length) throw Error('theater_subtitle_source_conflict')
  const removed = entries.slice(index, index + count)
  const next = entries[index]?.format
  const previous = entries[index - 1]?.format
  const template = next ?? previous
  const gap = ass ? '\n' : '\n\n'
  const emptyAss = ass && !template && after.length ? emptyAssEvent(original) : null
  const replacement = after.map((cue, offset) => {
    if (template) return template.render(cue, count > 0 && offset === 0, srt)
    return emptyAss ? emptyAss.render(cue) : blockCue(cue, srt, srt ? '1' : '')
  }).join(gap)

  let result = original
  if (removed.length) {
    const edits = removed.map(({ format }, offset) => ({ ...format, replacement: offset === 0 ? replacement : '' }))
    for (const edit of edits.sort((left, right) => right.from - left.from))
      result = result.slice(0, edit.from) + edit.replacement + result.slice(edit.to)
  } else if (next) {
    result = original.slice(0, next.from) + replacement + gap + original.slice(next.from)
  } else {
    const position = previous?.to ?? emptyAss?.position ?? original.trimEnd().length
    result = original.slice(0, position) + (position ? gap : '') + replacement + original.slice(position)
  }

  const parsed = subtitleEntries(result, ass, true)
  const expected = [...entries.slice(0, index), ...after, ...entries.slice(index + count)].sort(compareCueTimes)
  if (parsed.length !== expected.length || parsed.some((cue, position) => !sameSubtitleCue(cue, expected[position])))
    throw Error('theater_subtitle_revision_invalid')
  if (srt) {
    const numbered = parsed.map(({ format }) => format).sort((left, right) => right.from - left.from)
    for (const [offset, entry] of numbered.entries()) {
      if (entry.srtNumber)
        result = result.slice(0, entry.from) + (numbered.length - offset) + result.slice(entry.from + entry.srtNumber)
    }
  }
  if (!result) result = '\n'
  if (input.includes('\r\n')) result = result.replace(/\n/g, '\r\n')
  return input.startsWith('\uFEFF') ? '\uFEFF' + result : result
}

export function mergeTheaterTracks({ en = [], zh = [] }: SubtitleTracks): TheaterCue[] {
  const matched = new Set<number>()
  let first = 0
  const result: TheaterCue[] = en.map((cue, index) => {
    while (first < zh.length && zh[first].endMs <= cue.startMs) first++
    const translations: string[] = []
    const translationsAt: number[] = []
    for (let i = first; i < zh.length && zh[i].startMs < cue.endMs && translations.length < 6; i++) {
      if (zh[i].endMs <= cue.startMs) continue
      matched.add(i)
      translations.push(zh[i].text)
      translationsAt.push(i)
    }
    return {
      id: 'en-' + cue.startMs + '-' + cue.endMs + '-' + index,
      startMs: cue.startMs,
      endMs: cue.endMs,
      en: cue.text,
      sourceCues: { en: [index], zh: translationsAt },
      zh: [...new Set(translations)].join('\n') || undefined,
    }
  })
  zh.forEach((cue, index) => {
    if (!matched.has(index)) result.push({
      id: 'zh-' + cue.startMs + '-' + cue.endMs + '-' + index,
      startMs: cue.startMs,
      endMs: cue.endMs,
      zh: cue.text,
      sourceCues: { zh: [index] },
    })
  })
  return result.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
}

export function cueIndexAtOrBefore(cues: TheaterCue[], positionMs: number): number {
  let low = 0
  let high = cues.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (cues[middle].startMs <= positionMs) low = middle + 1
    else high = middle
  }
  return low - 1
}

export function activeTheaterCue(cues: TheaterCue[], positionMs: number): TheaterCue | undefined {
  for (let i = cueIndexAtOrBefore(cues, positionMs); i >= 0; i--) {
    if (cues[i].endMs > positionMs) return cues[i]
  }
}

export function theaterTime(positionMs: number): string {
  const total = Math.max(0, Math.floor(positionMs / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const seconds = String(total % 60).padStart(2, '0')
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + seconds : minutes + ':' + seconds
}
