import { figStroke } from './shared'

function ShapeIcon({ x, y, kind }: { x: number; y: number; kind: 'tri' | 'arrow' | 'semi' | 'u' | 'empty' }) {
  if (kind === 'empty') return null
  const g = (
    <g transform={`translate(${x},${y})`}>
      {kind === 'tri' && <polygon points="4,22 22,4 22,22" fill="#1e1b4b" />}
      {kind === 'arrow' && <polygon points="12,4 20,20 4,20" fill="#1e1b4b" />}
      {kind === 'semi' && <path d="M4,18 A10,10 0 0 1 24,18 Z" fill="#1e1b4b" />}
      {kind === 'u' && <path d="M4,8 Q14,24 24,8" fill="none" stroke="#1e1b4b" strokeWidth={2.5} />}
    </g>
  )
  return g
}

const grids: ('tri' | 'arrow' | 'semi' | 'u' | 'empty')[][][] = [
  [
    ['tri', 'arrow'],
    ['semi', 'u'],
  ],
  [
    ['semi', 'tri'],
    ['empty', 'arrow'],
  ],
  [
    ['empty', 'semi'],
    ['arrow', 'tri'],
  ],
  [
    ['empty', 'empty'],
    ['tri', 'semi'],
  ],
]

export default function LessonFig11Shapes() {
  const w = 36
  const h = 32
  return (
    <svg viewBox="0 0 300 90" className="mx-auto h-auto w-full max-w-md">
      {grids.map((grid, gi) =>
        grid.map((row, ri) =>
          row.map((kind, ci) => (
            <g key={`${gi}-${ri}-${ci}`}>
              <rect x={gi * 72 + ci * w + 4} y={ri * h + 8} width={w} height={h} fill="#f8fafc" stroke={figStroke} strokeWidth={1} />
              <ShapeIcon x={gi * 72 + ci * w + 4} y={ri * h + 8} kind={kind} />
            </g>
          )),
        ),
      )}
    </svg>
  )
}
