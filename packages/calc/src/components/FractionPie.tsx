'use client'

import { useState } from 'react'

interface Props {
  operands: [number, number]
  den: number
  op: '+' | '−'
  onSubmit: (numerator: number) => void
  disabled?: boolean
}

const PIE_SIZE = 76

function slicePath(i: number, den: number, cx: number, cy: number, r: number): string {
  const a0 = (i / den) * 2 * Math.PI - Math.PI / 2
  const a1 = ((i + 1) / den) * 2 * Math.PI - Math.PI / 2
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const large = 1 / den > 0.5 ? 1 : 0
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
}

function Pie({
  fillCount,
  den,
  fillColor,
  onSliceClick,
  size = PIE_SIZE,
}: {
  fillCount: number
  den: number
  fillColor: string
  onSliceClick?: (i: number) => void
  size?: number
}) {
  const r = size / 2 - 2
  const cx = size / 2
  const cy = size / 2
  const interactive = !!onSliceClick

  return (
    <svg width={size} height={size} className="shrink-0">
      {Array.from({ length: den }, (_, i) => (
        <path
          key={i}
          d={slicePath(i, den, cx, cy, r)}
          fill={i < fillCount ? fillColor : 'rgba(255,255,255,0.05)'}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          onClick={onSliceClick ? () => onSliceClick(i) : undefined}
          style={interactive ? { cursor: 'pointer', transition: 'fill 0.15s ease' } : undefined}
        />
      ))}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
    </svg>
  )
}

export default function FractionPie({ operands, den, op, onSubmit, disabled }: Props) {
  const [filled, setFilled] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const locked = disabled || submitted

  const tap = (i: number) => {
    if (locked) return
    setFilled((prev) => (prev === i + 1 ? i : i + 1))
  }

  const submit = () => {
    if (locked) return
    setSubmitted(true)
    onSubmit(filled)
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        className="flex w-full max-w-[320px] flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-5"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Pie fillCount={operands[0]} den={den} fillColor="#fbbf24" />

        <span className="font-fredoka text-[26px] font-black" style={{ color: '#c4b5fd' }}>
          {op}
        </span>

        <Pie fillCount={operands[1]} den={den} fillColor="#fbbf24" />

        <span className="font-fredoka text-[26px] font-black" style={{ color: '#c4b5fd' }}>
          =
        </span>

        <div className="flex flex-col items-center gap-1.5">
          <Pie fillCount={filled} den={den} fillColor="#a78bfa" onSliceClick={tap} size={120} />
          <span
            className="font-fredoka text-[15px] font-black tabular-nums"
            style={{ color: filled > 0 ? '#c4b5fd' : 'rgba(196,181,253,0.45)' }}
          >
            {filled}/{den}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={locked}
        className="h-14 w-full max-w-[320px] rounded-2xl font-fredoka text-[24px] font-black transition-all select-none active:scale-[0.97]"
        style={
          locked
            ? {
                background: 'rgba(16,185,129,0.15)',
                color: 'rgba(16,185,129,0.35)',
                border: '1px solid rgba(16,185,129,0.25)',
                cursor: 'not-allowed',
              }
            : {
                background: 'linear-gradient(135deg, #059669, #10b981)',
                color: '#ffffff',
                boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                border: '1px solid rgba(16,185,129,0.25)',
                cursor: 'pointer',
              }
        }
      >
        ✓
      </button>
    </div>
  )
}
