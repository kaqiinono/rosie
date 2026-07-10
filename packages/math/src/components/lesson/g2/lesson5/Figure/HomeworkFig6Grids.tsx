import { CellText } from './shared'

export default function HomeworkFig6Grids() {
  const w = 40
  const h = 32
  const g1: (string | number | '?')[][] = [
    ['1', '5', '9', '?'],
    ['3', '7', '11', '15'],
  ]
  const g2: (string | number | '?')[][] = [
    ['1', '3', '5', '21', '?'],
    ['1', '2', '8', '13', '55'],
  ]
  // 表①：标签 y=12，格子从 y=16 起共 2 行 → 底边 16+64=80
  // 表②：与表①留出间隙，标签 y=100，格子从 y=104 起 → 底边 104+64=168
  const g1StartY = 16
  const g2StartY = 104
  return (
    <svg viewBox="0 0 220 180" className="mx-auto h-auto w-full max-w-lg">
      <text x={8} y={12} fontSize={11} fill="#64748b">
        ①
      </text>
      {g1.map((row, ri) =>
        row.map((c, ci) => (
          <CellText
            key={`a-${ri}-${ci}`}
            x={ci * w + 8}
            y={ri * h + g1StartY}
            w={w}
            h={h}
            text={c}
            blank={c === '?'}
          />
        )),
      )}
      <text x={8} y={100} fontSize={11} fill="#64748b">
        ②
      </text>
      {g2.map((row, ri) =>
        row.map((c, ci) => (
          <CellText
            key={`b-${ri}-${ci}`}
            x={ci * w + 8}
            y={ri * h + g2StartY}
            w={w}
            h={h}
            text={c}
            blank={c === '?'}
          />
        )),
      )}
    </svg>
  )
}
