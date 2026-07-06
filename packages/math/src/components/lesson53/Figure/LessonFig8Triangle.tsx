import { CircleNum } from './shared'

const rows: (string | number | '?')[][] = [
  ['1'],
  ['2', '2'],
  ['3', '4', '3'],
  ['4', '7', '7', '4'],
  ['5', '11', '14', '11', '5'],
  ['6', '?', '25', '25', '?', '?'],
]

export default function LessonFig8Triangle() {
  let y = 20
  return (
    <svg viewBox="0 0 320 200" className="mx-auto h-auto w-full max-w-md">
      {rows.map((row, ri) => {
        const startX = 160 - ((row.length - 1) * 36) / 2
        const rowY = y
        y += 28
        return row.map((n, ci) => (
          <CircleNum
            key={`${ri}-${ci}`}
            cx={startX + ci * 36}
            cy={rowY}
            r={14}
            n={n}
            blank={n === '?'}
          />
        ))
      })}
    </svg>
  )
}
