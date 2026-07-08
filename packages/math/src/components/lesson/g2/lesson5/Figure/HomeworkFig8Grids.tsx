import { figStroke } from './shared'

const grids: { circle?: boolean; lines?: number; corner?: 'tr' | 'bl' }[] = [
  { circle: true, corner: 'tr', lines: 1 },
  { circle: true, corner: 'bl', lines: 2 },
  { circle: true, corner: 'tr', lines: 3 },
  {},
]

export default function HomeworkFig8Grids() {
  const s = 56
  return (
    <svg viewBox="0 0 280 80" className="mx-auto h-auto w-full max-w-md">
      {grids.map((g, i) => {
        const x = i * 68 + 8
        return (
          <g key={i}>
            <rect x={x} y={8} width={s} height={s} fill="#fff" stroke={figStroke} strokeWidth={2} />
            {g.lines && g.corner === 'tr' && (
              <>
                {Array.from({ length: g.lines }).map((_, li) => (
                  <line key={li} x1={x + 8 + li * 4} y1={8 + s - 8} x2={x + s - 8} y2={8 + 8 + li * 4} stroke={figStroke} strokeWidth={1.5} />
                ))}
                {g.circle && <circle cx={x + s - 14} cy={8 + 14} r={6} fill="#22c55e" />}
              </>
            )}
            {g.lines && g.corner === 'bl' && (
              <>
                {Array.from({ length: g.lines }).map((_, li) => (
                  <line key={li} x1={x + 8 + li * 4} y1={8 + 8} x2={x + s - 8} y2={8 + s - 8 - li * 4} stroke={figStroke} strokeWidth={1.5} />
                ))}
                {g.circle && <circle cx={x + 14} cy={8 + s - 14} r={6} fill="#22c55e" />}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
