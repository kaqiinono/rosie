'use client'

const COUNT_OPTIONS = [10, 20, 30, 50, 100]
const TIME_OPTIONS = [
  { value: 0, label: '不限' },
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
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition-all"
      style={
        active
          ? {
              background: 'rgba(139,92,246,0.25)',
              border: '1.5px solid rgba(139,92,246,0.6)',
              color: '#c4b5fd',
              boxShadow: '0 0 12px rgba(139,92,246,0.25)',
            }
          : {
              background: 'rgba(255,255,255,0.04)',
              border: '1.5px solid rgba(255,255,255,0.1)',
              color: 'rgba(196,181,253,0.5)',
            }
      }
    >
      {children}
    </button>
  )
}

export default function CalcConfigBar({ count, timeLimit, onChange }: Props) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(139,92,246,0.12)',
      }}
    >
      <div className="mb-3">
        <div
          className="mb-2 text-[10px] font-extrabold tracking-widest uppercase"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          题量
        </div>
        <div className="flex flex-wrap gap-1.5">
          {COUNT_OPTIONS.map((n) => (
            <Chip key={n} active={count === n} onClick={() => onChange({ count: n })}>
              {n}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div
          className="mb-2 text-[10px] font-extrabold tracking-widest uppercase"
          style={{ color: 'rgba(196,181,253,0.5)' }}
        >
          限时
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TIME_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={timeLimit === opt.value}
              onClick={() => onChange({ timeLimit: opt.value })}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
