/** Internal marker in quiz display strings — rendered visually, not shown as text. */
export const BLANK_MARKER = '□'

export type BlankDisplaySegment =
  | { kind: 'text'; text: string }
  | { kind: 'blank'; charCount: number }

/** Split a display string like "小□找妈妈" into text + blank runs. */
export function parseBlankDisplay(display: string): BlankDisplaySegment[] {
  const segments: BlankDisplaySegment[] = []
  let i = 0

  while (i < display.length) {
    if (display[i] === BLANK_MARKER) {
      let charCount = 0
      while (i < display.length && display[i] === BLANK_MARKER) {
        charCount++
        i++
      }
      segments.push({ kind: 'blank', charCount })
    } else {
      const start = i
      while (i < display.length && display[i] !== BLANK_MARKER) i++
      segments.push({ kind: 'text', text: display.slice(start, i) })
    }
  }

  return segments
}
