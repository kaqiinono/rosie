import { figStroke } from './shared'

const items: { outer: 'tri' | 'circ' | 'sq'; inner: 'tri' | 'circ' | 'sq'; down?: boolean; n: string | number }[] = [
  { outer: 'tri', inner: 'tri', n: 11 },
  { outer: 'circ', inner: 'sq', n: 23 },
  { outer: 'sq', inner: 'tri', n: 31 },
  { outer: 'tri', inner: 'sq', n: 13 },
  { outer: 'sq', inner: 'circ', n: '?' },
  { outer: 'circ', inner: 'circ', n: 22 },
  { outer: 'sq', inner: 'sq', n: 33 },
  { outer: 'tri', inner: 'circ', n: 12 },
  { outer: 'circ', inner: 'tri', n: 21 },
]

function Item({ x, outer, inner, down, n }: (typeof items)[0] & { x: number }) {
  const blank = n === '?'
  return (
    <g transform={`translate(${x},0)`}>
      {outer === 'tri' && (
        <polygon points={down ? '24,50 2,8 46,8' : '24,8 46,50 2,50'} fill="#fff" stroke={figStroke} strokeWidth={1.5} />
      )}
      {outer === 'circ' && <circle cx={24} cy={28} r={22} fill="#fff" stroke={figStroke} strokeWidth={1.5} />}
      {outer === 'sq' && <rect x={4} y={6} width={40} height={40} fill="#fff" stroke={figStroke} strokeWidth={1.5} />}
      {inner === 'tri' && <polygon points="24,18 32,32 16,32" fill="#eef2ff" stroke={figStroke} strokeWidth={1} />}
      {inner === 'circ' && <circle cx={24} cy={28} r={10} fill="#eef2ff" stroke={figStroke} strokeWidth={1} />}
      {inner === 'sq' && <rect x={16} y={20} width={16} height={16} fill="#eef2ff" stroke={figStroke} strokeWidth={1} />}
      <text x={24} y={62} textAnchor="middle" fontSize={12} fill={blank ? '#dc2626' : '#1e1b4b'} fontWeight={blank ? 'bold' : 'normal'}>
        {n}
      </text>
    </g>
  )
}

export default function LessonFig15Shapes() {
  return (
    <svg viewBox="0 0 480 80" className="mx-auto h-auto w-full max-w-2xl">
      {items.map((it, i) => (
        <Item key={i} x={(i % 5) * 92 + 8} {...it} />
      ))}
    </svg>
  )
}
