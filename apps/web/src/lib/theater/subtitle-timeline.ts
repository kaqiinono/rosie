import type { SubtitleCue, SubtitleTracks, TheaterCue } from './types'

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

type SubtitleEntry = SubtitleCue & { from: number; to: number }

function addCue(entries: SubtitleEntry[], start: string, end: string, value: string, from: number, to: number) {
  const startMs = clockMs(start)
  const endMs = clockMs(end)
  const text = plainText(value)
  if (!(startMs >= 0 && endMs > startMs && endMs <= maxMediaMs) || !text) return
  if (entries.length >= maxCueCount) throw Error('theater_subtitle_too_long')
  entries.push({ startMs, endMs, text, from, to })
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
    addCue(entries, values[startIndex].trim(), values[endIndex].trim(), dialogue,
      index + line.length - value.length + leadingTags, index + line.length)
  }
}

function subtitleEntries(input: string, ass: boolean) {
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
      const range = /^\s*(\S+)\s+-->\s+(\S+)/.exec(lines[index] ?? '')
      if (!range || lines.length <= index + 1) continue
      const value = lines.slice(index + 1).join('\n')
      const trailing = /\n+$/.exec(value)?.[0].length ?? 0
      addCue(entries, range[1], range[2], value, start + block.length - value.length,
        start + block.length - trailing)
    }
  }
  if (!entries.length) throw Error('theater_subtitle_empty')
  return entries.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs)
}

const normalizedSubtitle = (input: string) => input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')

export function parseTheaterSubtitles(input: string, filename: string): SubtitleCue[] {
  return subtitleEntries(normalizedSubtitle(input), /\.ass$/i.test(filename))
    .map(({ startMs, endMs, text }) => ({ startMs, endMs, text }))
}

export function reviseTheaterSubtitle(input: string, filename: string, changes: ReadonlyMap<number, string>) {
  const ass = /\.ass$/i.test(filename)
  const normalized = normalizedSubtitle(input)
  const entries = subtitleEntries(normalized, ass)
  const replacements = [...changes].map(([index, value]) => {
    const entry = entries[index]
    if (!entry) throw Error('theater_subtitle_source_conflict')
    const encoded = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
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
