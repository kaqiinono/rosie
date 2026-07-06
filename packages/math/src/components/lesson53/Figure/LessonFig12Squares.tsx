import { figStroke } from './shared'

const squares: { diag?: 'nw' | 'ne'; dot?: 'br' | 'tr' | 'bl' | 'tl'; empty?: boolean }[] = [
  { diag: 'ne', dot: 'br' },
  { diag: 'nw', dot: 'tr' },
  { diag: 'nw', dot: 'bl' },
  { empty: true },
]

export default function LessonFig12Squares() {
  return (
    <svg viewBox="0 0 280 80" className="mx-auto h-auto w-full max-w-md">
      {squares.map((sq, i) => {
        const x = i * 68 + 8
        return (
          <g key={i}>
            <rect x={x} y={8} width={56} height={56} fill="#fff" stroke={figStroke} strokeWidth={2} />
            {!sq.empty && (
              <>
                <line
                  x1={x}
                  y1={8 + (sq.diag === 'ne' ? 56 : 0)}
                  x2={x + 56}
                  y2={8 + (sq.diag === 'ne' ? 0 : 56)}
                  stroke={figStroke}
                  strokeWidth={1.5}
                />
                {sq.dot && (
                  <circle
                    cx={
                      sq.dot.includes('r') ? x + 42 : x + 14
                    }
                    cy={
                      sq.dot.includes('b') ? 8 + 42 : 8 + 14
                    }
                    r={4}
                    fill="#1e1b4b"
                  />
                )}
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}
