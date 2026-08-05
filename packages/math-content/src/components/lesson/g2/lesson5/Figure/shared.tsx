import type { ReactNode } from 'react'

const stroke = '#4f46e5'
const fill = '#eef2ff'

export function Cell({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number
  y: number
  w: number
  h: number
  children?: ReactNode
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {children}
    </g>
  )
}

export function CellText({
  x,
  y,
  w,
  h,
  text,
  blank,
}: {
  x: number
  y: number
  w: number
  h: number
  text?: string | number
  blank?: boolean
}) {
  return (
    <Cell x={x} y={y} w={w} h={h}>
      <text
        x={x + w / 2}
        y={y + h / 2 + 5}
        textAnchor="middle"
        fontSize={blank ? 16 : 14}
        fill={blank ? '#dc2626' : '#1e1b4b'}
        fontWeight={blank ? 'bold' : 'normal'}
      >
        {blank ? '?' : text}
      </text>
    </Cell>
  )
}

export function CircleNum({ cx, cy, r, n, blank }: { cx: number; cy: number; r: number; n?: string | number; blank?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#fff" stroke={stroke} strokeWidth={1.5} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={13} fill={blank ? '#dc2626' : '#1e1b4b'} fontWeight={blank ? 'bold' : 'normal'}>
        {blank ? '?' : n}
      </text>
    </g>
  )
}

export function CloverUnit({
  ox,
  oy,
  top,
  left,
  right,
  bottom,
  r = 22,
}: {
  ox: number
  oy: number
  top: string | number
  left: string | number
  right: string | number
  bottom: string | number
  r?: number
}) {
  const blank = (v: string | number) => v === '?' || v === ''
  // 相邻圆外切：圆心距 = 2r → 偏移量 r√2
  const d = r * Math.SQRT2
  return (
    <g transform={`translate(${ox},${oy})`}>
      <CircleNum cx={0} cy={-d} r={r} n={top} blank={blank(top)} />
      <CircleNum cx={-d} cy={0} r={r} n={left} blank={blank(left)} />
      <CircleNum cx={d} cy={0} r={r} n={right} blank={blank(right)} />
      <CircleNum cx={0} cy={d} r={r} n={bottom} blank={blank(bottom)} />
    </g>
  )
}

export function ArrowUnit({
  ox,
  oy,
  arrow,
  left,
  right,
  diamond,
}: {
  ox: number
  oy: number
  arrow: string | number
  left: string | number
  right: string | number
  diamond: string | number
}) {
  const blank = (v: string | number) => v === '?' || v === ''
  return (
    <g transform={`translate(${ox},${oy})`}>
      <polygon points="0,-38 14,-14 -14,-14" fill="#fff" stroke={stroke} strokeWidth={1.5} />
      <text x={0} y={-22} textAnchor="middle" fontSize={12} fill="#1e1b4b">{arrow}</text>
      <CircleNum cx={-24} cy={4} r={18} n={left} />
      <CircleNum cx={24} cy={4} r={18} n={right} blank={blank(right)} />
      <polygon points="0,38 16,18 -16,18" fill="#fff" stroke={stroke} strokeWidth={1.5} transform="rotate(180 0 28)" />
      <text x={0} y={32} textAnchor="middle" fontSize={12} fill={blank(diamond) ? '#dc2626' : '#1e1b4b'} fontWeight={blank(diamond) ? 'bold' : 'normal'}>
        {diamond}
      </text>
    </g>
  )
}

export const figStroke = stroke
