import { figStroke } from './shared'

function Nested({ x, outer, inner, label }: { x: number; outer: 'sq' | 'tri' | 'circ'; inner: 'sq' | 'circ'; label: string }) {
  return (
    <g transform={`translate(${x},10)`}>
      {outer === 'sq' && <rect x={0} y={0} width={56} height={56} fill="#fff" stroke={figStroke} strokeWidth={2} />}
      {outer === 'tri' && <polygon points="28,4 54,52 2,52" fill="#fff" stroke={figStroke} strokeWidth={2} />}
      {outer === 'circ' && <circle cx={28} cy={28} r={28} fill="#fff" stroke={figStroke} strokeWidth={2} />}
      {inner === 'circ' && <circle cx={28} cy={28} r={12} fill="#eef2ff" stroke={figStroke} strokeWidth={1.5} />}
      {inner === 'sq' && <rect x={18} y={18} width={20} height={20} fill="#eef2ff" stroke={figStroke} strokeWidth={1.5} />}
      <text x={28} y={72} textAnchor="middle" fontSize={11} fill="#1e1b4b">{label}</text>
    </g>
  )
}

export default function LessonFig13Shapes() {
  return (
    <svg viewBox="0 0 240 90" className="mx-auto h-auto w-full max-w-sm">
      <Nested x={8} outer="sq" inner="circ" label="A*B" />
      <Nested x={88} outer="tri" inner="circ" label="C*B" />
      <Nested x={168} outer="circ" inner="sq" label="B*D" />
    </svg>
  )
}
