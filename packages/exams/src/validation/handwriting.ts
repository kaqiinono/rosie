import type { ExamInk } from '../types/attempts'

/** Same bounds as the SQL guard; never accept SVG, paths, URLs or recognized text. */
export function isExamInk(value: unknown): value is ExamInk {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const ink = value as Record<string, unknown>
  if (Object.keys(ink).length !== 1 || !Array.isArray(ink.strokes) || !ink.strokes.length || ink.strokes.length > 250) return false
  let count = 0
  for (const stroke of ink.strokes) {
    if (!Array.isArray(stroke) || !stroke.length) return false
    count += stroke.length
    if (count > 10000) return false
    for (const raw of stroke) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
      const point = raw as Record<string, unknown>
      if (Object.keys(point).length !== 2 || typeof point.x !== 'number' || typeof point.y !== 'number'
        || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 600 || point.y < 0 || point.y > 440) return false
    }
  }
  return true
}
