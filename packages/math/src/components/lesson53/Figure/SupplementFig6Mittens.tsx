const MITTEN_FILL = '#4a5568'
const SPOT = '#f8fafc'

function MittenShape({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* 手掌 */}
      <path
        d="M18 8 Q18 2 28 2 L52 2 Q62 2 62 14 L62 58 Q62 68 52 68 L28 68 Q18 68 18 58 Z"
        fill={MITTEN_FILL}
        stroke="#1e293b"
        strokeWidth={1.5}
      />
      {/* 拇指 */}
      <path
        d="M62 22 Q78 20 80 32 Q82 44 68 46 L62 42 Z"
        fill={MITTEN_FILL}
        stroke="#1e293b"
        strokeWidth={1.5}
      />
      {/* 袖口 */}
      <rect x={16} y={66} width={48} height={14} rx={3} fill={MITTEN_FILL} stroke="#1e293b" strokeWidth={1.5} />
      <line x1={18} y1={71} x2={62} y2={71} stroke={SPOT} strokeWidth={1.2} />
      <line x1={18} y1={76} x2={62} y2={76} stroke={SPOT} strokeWidth={1.2} />
      {/* 雪花点 */}
      {[
        [30, 22],
        [42, 18],
        [48, 32],
        [34, 40],
        [50, 48],
        [38, 52],
      ].map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={2.2} fill={SPOT} opacity={0.9} />
      ))}
    </g>
  )
}

function MittenLabel({ x, y, value, blank }: { x: number; y: number; value?: number; blank?: boolean }) {
  const fontSize = value !== undefined && value >= 1000 ? 11 : value !== undefined && value >= 100 ? 12 : 14
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={blank ? 18 : fontSize}
      fill={blank ? '#dc2626' : '#ffffff'}
      fontWeight={blank ? 'bold' : '600'}
    >
      {blank ? '?' : value}
    </text>
  )
}

const VALUES: (number | null)[] = [124, 3612, 51020, null]

/** 附加题6-1：四只手套形数字排列 */
export default function SupplementFig6Mittens() {
  const step = 92
  const w = 24 + step * 4
  const h = 100

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto h-auto w-full max-w-lg">
      {VALUES.map((v, i) => {
        const ox = 12 + i * step
        return (
          <g key={i}>
            <MittenShape x={ox} y={4} />
            <MittenLabel x={ox + 40} y={42} value={v ?? undefined} blank={v === null} />
          </g>
        )
      })}
    </svg>
  )
}
