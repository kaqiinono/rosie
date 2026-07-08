import { CloverUnit } from './shared'

const units = [
  { top: 15, left: 3, right: 5, bottom: 7 },
  { top: 5, left: 1, right: 2, bottom: 2 },
  { top: 24, left: 10, right: 4, bottom: 10 },
  { top: 35, left: 12, right: '?', bottom: 11 },
]

const R = 20
const D = R * Math.SQRT2
const EXTENT = D + R
const STEP = EXTENT * 2 + 16

export default function LessonFig9Clover() {
  const w = 24 + STEP * (units.length - 1) + EXTENT * 2
  const h = EXTENT * 2 + 16
  const cy = EXTENT + 8

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto h-auto w-full max-w-2xl">
      {units.map((u, i) => (
        <CloverUnit key={i} ox={24 + EXTENT + i * STEP} oy={cy} r={R} {...u} />
      ))}
    </svg>
  )
}
