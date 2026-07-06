import { ArrowUnit } from './shared'

const units = [
  { arrow: 2, left: 6, right: 16, diamond: 5 },
  { arrow: 3, left: 10, right: 31, diamond: 7 },
  { arrow: 1, left: 5, right: 9, diamond: 4 },
  { arrow: 7, left: 8, right: '?', diamond: 2 },
]

export default function LessonFig9Arrow() {
  return (
    <svg viewBox="0 0 420 110" className="mx-auto h-auto w-full max-w-lg">
      {units.map((u, i) => (
        <ArrowUnit key={i} ox={55 + i * 100} oy={55} {...u} />
      ))}
    </svg>
  )
}
