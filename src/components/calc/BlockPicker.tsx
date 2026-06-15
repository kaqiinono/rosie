'use client'

import { BLOCK_GROUPS, blocksByGroup, type CalcBlock } from '@/utils/calc-blocks'
import PerTypeTimeChips from './PerTypeTimeChips'
import type { BlockSel } from '@/utils/type'

interface Props {
  selected: BlockSel[]
  countMode: 'auto' | 'manual'
  onToggle: (id: string) => void
  onToggleGroup: (group: CalcBlock['group'], on: boolean) => void
  onPatch: (id: string, patch: Partial<BlockSel>) => void
}

const GROUP_ICONS: Record<CalcBlock['group'], string> = {
  add: '➕', sub: '➖', mul: '✖️', div: '➗', decimal: '🔢', fraction: '½',
}
const COUNT_OPTIONS = [10, 20, 30, 50, 100]

export default function BlockPicker({ selected, countMode, onToggle, onToggleGroup, onPatch }: Props) {
  const byId = new Map(selected.map((s) => [s.id, s]))

  return (
    <div className="space-y-3">
      {BLOCK_GROUPS.map(({ group, label }) => {
        const blocks = blocksByGroup(group)
        const allOn = blocks.length > 0 && blocks.every((b) => byId.has(b.id))
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
            <div className="space-y-1.5">
              {blocks.map((b) => {
                const sel = byId.get(b.id)
                const on = !!sel
                return (
                  <div key={b.id}>
                    <button
                      type="button"
                      onClick={() => onToggle(b.id)}
                      aria-pressed={on}
                      className="w-full rounded-lg px-3 py-2 text-left text-[12px] font-extrabold leading-tight transition-all active:scale-[0.99]"
                      style={{
                        background: on ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${on ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color: on ? '#c4b5fd' : 'rgba(245,243,255,0.5)',
                      }}
                    >
                      {b.label}
                    </button>
                    {on && sel && (
                      <div
                        className="mt-1 space-y-2 rounded-lg px-3 py-2"
                        style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)' }}
                      >
                        {countMode === 'manual' && (
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-1 text-[10px] font-extrabold uppercase" style={{ color: 'rgba(196,181,253,0.5)' }}>题量</span>
                            {COUNT_OPTIONS.map((n) => {
                              const co = sel.count === n
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => onPatch(b.id, { count: n })}
                                  className="rounded-md px-2 py-0.5 text-[11px] font-extrabold tabular-nums transition-all active:scale-95"
                                  style={{
                                    background: co ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${co ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                                    color: co ? '#c4b5fd' : 'rgba(196,181,253,0.5)',
                                  }}
                                >
                                  {n}
                                </button>
                              )
                            })}
                          </div>
                        )}
                        <PerTypeTimeChips
                          targetId={b.id}
                          value={sel.seconds}
                          onChange={(v) => onPatch(b.id, { seconds: v })}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
