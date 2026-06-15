'use client'

const COUNT_OPTIONS = [10, 20, 30, 50, 100]

interface Props {
  count: number
  onChange: (count: number) => void
}

export default function CalcConfigBar({ count, onChange }: Props) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(139,92,246,0.12)' }}
    >
      <div
        className="mb-2 text-[10px] font-extrabold tracking-widest uppercase"
        style={{ color: 'rgba(196,181,253,0.5)' }}
      >
        总题量
      </div>
      <div className="flex flex-wrap gap-1.5">
        {COUNT_OPTIONS.map((n) => {
          const on = count === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className="flex cursor-pointer items-center rounded-xl px-3 py-2 text-[13px] font-extrabold tabular-nums transition-all duration-200"
              style={
                on
                  ? { background: 'rgba(139,92,246,0.22)', border: '1.5px solid rgba(139,92,246,0.6)', color: '#c4b5fd' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.1)', color: 'rgba(196,181,253,0.5)' }
              }
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
