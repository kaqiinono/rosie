'use client'

import { BLOCK_GROUPS, blocksByGroup, type CalcBlock } from '@/utils/calc-blocks'

interface Props {
  selected: string[]
  onToggle: (id: string) => void
  onToggleGroup: (group: CalcBlock['group'], on: boolean) => void
}

const GROUP_ICONS: Record<CalcBlock['group'], string> = {
  add: '➕',
  sub: '➖',
  mul: '✖️',
  div: '➗',
  decimal: '🔢',
  fraction: '½',
}

export default function BlockPicker({ selected, onToggle, onToggleGroup }: Props) {
  const set = new Set(selected)

  return (
    <div className="space-y-3">
      {BLOCK_GROUPS.map(({ group, label }) => {
        const blocks = blocksByGroup(group)
        const allOn = blocks.length > 0 && blocks.every((b) => set.has(b.id))
        return (
          <div key={group}>
            <div className="mb-1.5 flex items-center justify-between">
              <span
                className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider"
                style={{ color: 'rgba(196,181,253,0.45)' }}
              >
                <span aria-hidden className="text-[12px] leading-none">{GROUP_ICONS[group]}</span>
                {label}
              </span>
              <button
                type="button"
                onClick={() => onToggleGroup(group, !allOn)}
                className="rounded-md px-2.5 py-1 text-[10px] font-extrabold transition-all active:scale-95"
                style={{
                  background: allOn ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.15)',
                  border: `1px solid ${allOn ? 'rgba(255,255,255,0.1)' : 'rgba(139,92,246,0.3)'}`,
                  color: allOn ? 'rgba(245,243,255,0.55)' : '#c4b5fd',
                }}
              >
                {allOn ? '取消' : '全选'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {blocks.map((b) => {
                const on = set.has(b.id)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onToggle(b.id)}
                    aria-pressed={on}
                    className="rounded-lg px-2.5 py-2.5 text-left text-[11px] font-extrabold leading-tight transition-all active:scale-95"
                    style={{
                      background: on ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${on ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      color: on ? '#c4b5fd' : 'rgba(245,243,255,0.5)',
                    }}
                  >
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
