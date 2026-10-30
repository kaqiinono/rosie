/** Epoch minute arithmetic. Subtract first, then conservatively round each free piece. */
export type Span = { start: number; end: number }
export const minute = 60000
export const iso = (value: number) => new Date(value).toISOString()
export function union(spans: Span[]): Span[] {
  const result: Span[] = []
  for (const span of spans
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start)) {
    const last = result[result.length - 1]
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end)
    else result.push({ ...span })
  }
  return result
}
export function subtract(spans: Span[], busy: Span[]): Span[] {
  return union(busy).reduce(
    (free, b) =>
      free.flatMap((s) =>
        b.end <= s.start || b.start >= s.end
          ? [s]
          : [
              { start: s.start, end: Math.min(s.end, b.start) },
              { start: Math.max(s.start, b.end), end: s.end },
            ].filter((x) => x.end > x.start),
      ),
    union(spans),
  )
}
export function wholeMinutes(spans: Span[]): Span[] {
  return spans
    .map((s) => ({
      start: Math.ceil(s.start / minute) * minute,
      end: Math.floor(s.end / minute) * minute,
    }))
    .filter((s) => s.end > s.start)
}
