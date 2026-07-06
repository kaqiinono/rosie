import { figStroke } from './shared'

/** 三横条编码：true=灰条，false=白条 */
type Bars = [boolean, boolean, boolean]

const GRID: Bars[][] = [
  [[false, true, true], [false, true, false], [true, false, true]],
  [[true, true, true], [false, true, true], [false, false, false]],
  [[true, false, true], [true, true, false], [true, true, true]],
  [[true, true, true], [false, false, true], [false, true, false]],
]

const GREY = '#9ca3af'
const WHITE = '#ffffff'

function BarBlock({ x, y, w, h, bars }: { x: number; y: number; w: number; h: number; bars: Bars }) {
  const sh = h / 3
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={WHITE} stroke={figStroke} strokeWidth={1.5} />
      {bars.map((grey, i) => (
        <rect
          key={i}
          x={x + 1}
          y={y + i * sh + 1}
          width={w - 2}
          height={sh - (i < 2 ? 0 : 1)}
          fill={grey ? GREY : WHITE}
          stroke={figStroke}
          strokeWidth={0.75}
        />
      ))}
    </g>
  )
}

/** 附加题4：4×3 三横条数码图 */
export default function SupplementFig4Bars() {
  const bw = 36
  const bh = 48
  const gapX = 10
  const gapY = 12
  const pad = 8

  return (
    <svg
      viewBox={`0 0 ${pad * 2 + 3 * bw + 2 * gapX} ${pad * 2 + 4 * bh + 3 * gapY}`}
      className="mx-auto h-auto w-full max-w-md"
    >
      {GRID.map((row, ri) =>
        row.map((bars, ci) => (
          <BarBlock
            key={`${ri}-${ci}`}
            x={pad + ci * (bw + gapX)}
            y={pad + ri * (bh + gapY)}
            w={bw}
            h={bh}
            bars={bars}
          />
        )),
      )}
    </svg>
  )
}
