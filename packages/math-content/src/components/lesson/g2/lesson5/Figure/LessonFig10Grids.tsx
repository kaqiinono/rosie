import { CellText } from './shared'

const grids: (string | number | '')[][][] = [
  [
    ['2', '5'],
    ['6', '3'],
  ],
  [
    ['4', '8'],
    ['16', '4'],
  ],
  [
    ['6', '11'],
    ['30', '5'],
  ],
  [
    ['', ''],
    ['', ''],
  ],
  [
    ['10', '17'],
    ['70', '7'],
  ],
]

export default function LessonFig10Grids() {
  const w = 32
  const h = 28
  return (
    <svg viewBox="0 0 360 80" className="mx-auto h-auto w-full max-w-lg">
      {grids.map((grid, gi) =>
        grid.map((row, ri) =>
          row.map((c, ci) => (
            <CellText
              key={`${gi}-${ri}-${ci}`}
              x={gi * 68 + ci * w + 4}
              y={ri * h + 8}
              w={w}
              h={h}
              text={c || undefined}
              blank={c === ''}
            />
          )),
        ),
      )}
    </svg>
  )
}
