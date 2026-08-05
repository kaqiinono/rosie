import { figStroke } from './shared'

const LAVENDER = '#e9d5ff'
const BOTTOM = [72, 27, 18, 21, null, 9, 13] as const
const TOP = [99, 45, 39, 36, 33, 31] as const

const R = 22
const GAP = 56
const X0 = 36
const Y_TOP = 38
const Y_BOT = 108

function bottomX(i: number) {
  return X0 + i * GAP
}

function topX(i: number) {
  return X0 + GAP * 0.5 + i * GAP
}

function FlowCircle({ cx, cy, value, blank }: { cx: number; cy: number; value: number | null; blank?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={R} fill={LAVENDER} stroke="#1e1b4b" strokeWidth={1.5} />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={value !== null && value >= 100 ? 12 : 13}
        fill={blank ? '#dc2626' : '#1e1b4b'}
        fontWeight={blank ? 'bold' : 'normal'}
      >
        {blank ? '?' : value}
      </text>
    </g>
  )
}

function HArrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <line
      x1={x1}
      y1={y}
      x2={x2 - 6}
      y2={y}
      stroke={figStroke}
      strokeWidth={1.5}
      markerEnd="url(#sup5-arrow)"
    />
  )
}

function DArrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  return (
    <line
      x1={x1 + ux * R}
      y1={y1 + uy * R}
      x2={x2 - ux * (R + 4)}
      y2={y2 - uy * (R + 4)}
      stroke={figStroke}
      strokeWidth={1.5}
      markerEnd="url(#sup5-arrow)"
    />
  )
}

/** 附加题5-2：上下两行圆圈 + 水平/斜向箭头 */
export default function SupplementFig5ArrowFlow() {
  const w = X0 * 2 + GAP * (BOTTOM.length - 1)
  const h = Y_BOT + R + 16

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto h-auto w-full max-w-2xl">
      <defs>
        <marker id="sup5-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill={figStroke} />
        </marker>
      </defs>

      {TOP.map((n, i) => (
        <DArrow key={`d-${i}`} x1={topX(i)} y1={Y_TOP} x2={bottomX(i + 1)} y2={Y_BOT} />
      ))}

      {BOTTOM.slice(0, -1).map((_, i) => (
        <HArrow key={`h-${i}`} x1={bottomX(i) + R} x2={bottomX(i + 1) - R} y={Y_BOT} />
      ))}

      {TOP.map((n, i) => (
        <FlowCircle key={`t-${i}`} cx={topX(i)} cy={Y_TOP} value={n} />
      ))}

      {BOTTOM.map((n, i) => (
        <FlowCircle key={`b-${i}`} cx={bottomX(i)} cy={Y_BOT} value={n} blank={n === null} />
      ))}
    </svg>
  )
}
