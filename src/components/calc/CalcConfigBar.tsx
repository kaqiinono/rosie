'use client'

import { timeLimitBonusPreview } from '@/utils/calc-helpers'

const COUNT_OPTIONS = [10, 20, 30, 50, 100]
const TIME_OPTIONS = [
  { value: 0, label: '不限' },
  { value: 60, label: '1分' },
  { value: 180, label: '3分' },
  { value: 300, label: '5分' },
  { value: 600, label: '10分' },
]

interface Props {
  count: number
  timeLimit: number
  onChange: (patch: { count?: number; timeLimit?: number }) => void
}

function Chip({
  active,
  onClick,
  label,
  subLabel,
  subLabelMuted,
}: {
  active: boolean
  onClick: () => void
  label: React.ReactNode
  subLabel: string
  subLabelMuted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer flex-col items-center rounded-xl px-3 py-2 transition-all duration-200"
      style={
        active
          ? {
              background: 'rgba(139,92,246,0.22)',
              border: '1.5px solid rgba(139,92,246,0.6)',
              boxShadow: '0 0 14px rgba(139,92,246,0.28), inset 0 1px 0 rgba(255,255,255,0.08)',
            }
          : {
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px solid rgba(255,255,255,0.1)',
            }
      }
    >
      <span
        className="text-[13px] font-extrabold leading-tight tabular-nums"
        style={{ color: active ? '#c4b5fd' : 'rgba(196,181,253,0.5)' }}
      >
        {label}
      </span>
      <span
        className="mt-0.5 text-[9px] font-bold leading-none tabular-nums"
        style={{
          color: subLabelMuted
            ? (active ? 'rgba(196,181,253,0.45)' : 'rgba(196,181,253,0.22)')
            : (active ? 'rgba(251,191,36,0.9)' : 'rgba(251,191,36,0.38)'),
        }}
      >
        {subLabel}
      </span>
    </button>
  )
}

export default function CalcConfigBar({ count, timeLimit, onChange }: Props) {
  function countSubLabel(n: number): string {
    const bonus = timeLimit > 0 ? timeLimitBonusPreview(n, timeLimit) : 0
    return `⭐${n + bonus}起`
  }

  function timeSubLabel(value: number): string {
    if (value === 0) return '无加成'
    const bonus = timeLimitBonusPreview(count, value)
    return `+${bonus}⭐`
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(139,92,246,0.12)',
      }}
    >
      {/* Count row */}
      <div className="mb-4">
        <div
          className="mb-2 text-[10px] font-extrabold tracking-widest uppercase"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          题量
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COUNT_OPTIONS.map((n) => (
            <Chip
              key={n}
              active={count === n}
              onClick={() => onChange({ count: n })}
              label={n}
              subLabel={countSubLabel(n)}
            />
          ))}
        </div>
      </div>

      {/* Time row */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span
            className="text-[10px] font-extrabold tracking-widest uppercase"
            style={{ color: 'rgba(196,181,253,0.5)' }}
          >
            限时
          </span>
          {timeLimit > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-extrabold"
              style={{
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.25)',
                color: 'rgba(251,191,36,0.7)',
              }}
            >
              ⚡ 越快星星越多
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TIME_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={timeLimit === opt.value}
              onClick={() => onChange({ timeLimit: opt.value })}
              label={opt.label}
              subLabel={timeSubLabel(opt.value)}
              subLabelMuted={opt.value === 0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
