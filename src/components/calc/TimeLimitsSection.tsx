'use client'

import { useState } from 'react'
import {
  DEFAULT_LIMIT_MS,
  type TimeLimitBucket,
} from '@/utils/calc-time-limits'

interface Props {
  overrides: Record<string, number>
  onChange: (next: Record<string, number>) => void
}

const BUCKET_LABELS: Record<TimeLimitBucket, string> = {
  add_10: '10 以内加减',
  add_20: '20 以内加减',
  add_100: '100 以内加减',
  mul_easy: '乘法（1/2/5、3/4）',
  mul_hard: '乘法（6/7/8/9）',
  mul_mix: '乘法 1-9 综合',
  div_easy: '除法（÷1/2/5、÷3/4）',
  div_hard: '除法（÷6-9）',
  muldiv_1_9: '乘除混合（1-9）',
  mixed_2op: '混合运算（两运算符）',
  muldiv_ext: '乘除拓展（×10-19）',
  challenge: '挑战（三运算符）',
}

const BUCKET_ORDER: TimeLimitBucket[] = [
  'add_10',
  'add_20',
  'add_100',
  'mul_easy',
  'mul_hard',
  'mul_mix',
  'div_easy',
  'div_hard',
  'muldiv_1_9',
  'mixed_2op',
  'muldiv_ext',
  'challenge',
]

export default function TimeLimitsSection({ overrides, onChange }: Props) {
  const [expanded, setExpanded] = useState(false)

  const setBucket = (bucket: TimeLimitBucket, ms: number | null) => {
    const next = { ...overrides }
    if (ms === null) delete next[bucket]
    else next[bucket] = ms
    onChange(next)
  }

  const overrideCount = Object.keys(overrides).length

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mb-2 flex w-full items-center justify-between text-[11px] font-extrabold tracking-widest uppercase"
        style={{ color: 'rgba(196,181,253,0.45)' }}
      >
        <span>
          答题时限
          {overrideCount > 0 && (
            <span
              className="ml-2 normal-case tracking-normal"
              style={{ color: 'rgba(196,181,253,0.3)' }}
            >
              · 已调整 {overrideCount}
            </span>
          )}
        </span>
        <span className="text-[14px]">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div
          className="space-y-2 rounded-xl p-3"
          style={{
            background: 'rgba(139,92,246,0.04)',
            border: '1px solid rgba(139,92,246,0.12)',
          }}
        >
          <div className="text-[11px]" style={{ color: 'rgba(245,243,255,0.4)' }}>
            限时内答对才能 +1 熟练度。建议先按默认练几次，再按孩子节奏微调。
          </div>
          {BUCKET_ORDER.map((bucket) => {
            const defaultMs = DEFAULT_LIMIT_MS[bucket]
            const current = overrides[bucket] ?? defaultMs
            const isOverride = overrides[bucket] !== undefined
            return (
              <div
                key={bucket}
                className="flex items-center gap-2 rounded-lg px-3 py-2"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold" style={{ color: '#e9d5ff' }}>
                    {BUCKET_LABELS[bucket]}
                  </div>
                  <div className="text-[10px]" style={{ color: 'rgba(245,243,255,0.35)' }}>
                    默认 {defaultMs} ms
                  </div>
                </div>
                <input
                  type="number"
                  min={500}
                  max={20000}
                  step={500}
                  value={current}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (!Number.isFinite(v) || v < 500) return
                    setBucket(bucket, v === defaultMs ? null : v)
                  }}
                  className="w-20 rounded-md px-2 py-1 text-right text-[12px] font-extrabold tabular-nums"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isOverride ? 'rgba(245,158,11,0.4)' : 'rgba(139,92,246,0.25)'}`,
                    color: isOverride ? '#fbbf24' : '#c4b5fd',
                    outline: 'none',
                  }}
                />
                <span className="text-[10px]" style={{ color: 'rgba(245,243,255,0.3)' }}>
                  ms
                </span>
                {isOverride && (
                  <button
                    type="button"
                    onClick={() => setBucket(bucket, null)}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(245,243,255,0.55)',
                    }}
                  >
                    复位
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
