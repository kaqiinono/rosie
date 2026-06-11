'use client'

import { useState } from 'react'

type FractionVisProps = {
  /** Operand fractions parsed from the question, e.g. [[1,5],[2,5]] */
  operands: { num: number; den: number }[]
  op: '+' | '−' | '-' | '×' | '÷'
  onSubmit: (numerator: number, denominator: number) => void
  disabled?: boolean
}

const DENOM_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12]

function Pie({ num, den, color = '#3b82f6' }: { num: number; den: number; color?: string }) {
  const size = 80
  const r = size / 2 - 2
  const cx = size / 2
  const cy = size / 2

  if (den === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
      </svg>
    )
  }

  const slices = []
  for (let i = 0; i < den; i++) {
    const startAngle = (i / den) * 2 * Math.PI - Math.PI / 2
    const endAngle = ((i + 1) / den) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = 1 / den > 0.5 ? 1 : 0
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    slices.push(
      <path
        key={i}
        d={path}
        fill={i < num ? color : 'rgba(255,255,255,0.05)'}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1"
      />,
    )
  }

  return (
    <svg width={size} height={size}>
      {slices}
    </svg>
  )
}

function FractionVis({ operands, op, onSubmit, disabled = false }: FractionVisProps) {
  const [numInput, setNumInput] = useState('')
  const [denInput, setDenInput] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleConfirm = () => {
    const n = parseInt(numInput)
    const d = parseInt(denInput)
    if (isNaN(n) || isNaN(d) || d === 0) return
    setSubmitted(true)
    onSubmit(n, d)
  }

  const previewNum = parseInt(numInput) || 0
  const previewDen = parseInt(denInput) || 0

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl bg-white/[0.06] p-4 w-full">
        {/* Operand pies */}
        <div className="flex items-center justify-center gap-3">
          {operands.map((f, i) => (
            <div key={i} className="flex items-center gap-3">
              {i > 0 && <span className="text-2xl font-bold text-white/70">{op}</span>}
              <div className="flex flex-col items-center gap-1">
                <Pie num={f.num} den={f.den} color="#60a5fa" />
                <div className="text-xs font-bold text-white">
                  {f.num}/{f.den}
                </div>
              </div>
            </div>
          ))}
          <span className="text-2xl font-bold text-white/70">=</span>
          <div className="flex flex-col items-center gap-1">
            <Pie num={previewNum} den={previewDen} color="#fbbf24" />
            <div className="text-xs font-bold text-amber-400">
              {previewNum || '?'}/{previewDen || '?'}
            </div>
          </div>
        </div>
      </div>

      {/* Input boxes */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-white/40">分子 ↑</span>
          <input
            type="number"
            inputMode="numeric"
            value={numInput}
            onChange={(e) => setNumInput(e.target.value)}
            disabled={disabled || submitted}
            className="h-12 w-16 rounded-xl border-2 border-white/20 bg-white/[0.05] text-center text-xl font-bold text-white outline-none focus:border-blue-400"
          />
        </div>
        <div className="h-px w-6 bg-white/40" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-white/40">分母 ↓</span>
          <select
            value={denInput}
            onChange={(e) => setDenInput(e.target.value)}
            disabled={disabled || submitted}
            className="h-12 w-16 rounded-xl border-2 border-white/20 bg-white/[0.05] text-center text-xl font-bold text-white outline-none focus:border-blue-400"
          >
            <option value="">?</option>
            {DENOM_OPTIONS.map((d) => (
              <option key={d} value={d} className="bg-[#1a1830]">
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!submitted && (
        <button
          type="button"
          onClick={handleConfirm}
          disabled={disabled || !numInput || !denInput}
          className="rounded-xl bg-blue-500 px-8 py-3 text-base font-bold text-white shadow transition-colors hover:bg-blue-600 disabled:opacity-40"
        >
          确认
        </button>
      )}
    </div>
  )
}

export default FractionVis
