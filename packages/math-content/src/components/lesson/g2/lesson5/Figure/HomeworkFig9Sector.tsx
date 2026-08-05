import { figStroke } from './shared'

const sectors: (number | '?')[] = [10, 2, 4, 3, 0, 8, '?', 7]

export default function HomeworkFig9Sector() {
  const cx = 80
  const cy = 80
  const r = 60
  return (
    <svg viewBox="0 0 160 170" className="mx-auto h-auto w-full max-w-xs">
      {sectors.map((n, i) => {
        const a0 = (i * 45 - 90) * (Math.PI / 180)
        const a1 = ((i + 1) * 45 - 90) * (Math.PI / 180)
        const x1 = cx + r * Math.cos(a0)
        const y1 = cy + r * Math.sin(a0)
        const x2 = cx + r * Math.cos(a1)
        const y2 = cy + r * Math.sin(a1)
        const mx = cx + (r * 0.65) * Math.cos((a0 + a1) / 2)
        const my = cy + (r * 0.65) * Math.sin((a0 + a1) / 2)
        return (
          <g key={i}>
            <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`} fill="#eef2ff" stroke={figStroke} strokeWidth={1.5} />
            <text x={mx} y={my + 4} textAnchor="middle" fontSize={13} fill={n === '?' ? '#dc2626' : '#1e1b4b'} fontWeight={n === '?' ? 'bold' : 'normal'}>
              {n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
