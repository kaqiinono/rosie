'use client'

import { suggestedTiers, TIER_LABEL, TIER_ORDER, type Tier } from '../utils/calc-time-targets'

export interface TierTargetItem {
  label: string
  /** block id 或 skeleton id（TIME_TARGETS 查询键）。 */
  targetId: string
  kind: 'block' | 'mixed'
  /** 可选分组标题（如 加法/减法），相邻同组项合并为一个标题。 */
  group?: string
}

interface Props {
  items: TierTargetItem[]
  onClose: () => void
}

// 与报告页 TIER_DARK 保持一致
const TIER_DARK: Record<Tier, { color: string; bg: string; border: string }> = {
  entry: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.18)' },
  stable: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.18)' },
  fluent: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.18)' },
  auto: { color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.18)' },
}

export default function TierTargetsSheet({ items, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full flex-col rounded-t-3xl sm:max-w-[480px] sm:rounded-3xl"
        style={{
          background: 'rgba(10,9,30,0.98)',
          border: '1px solid rgba(139,92,246,0.25)',
          boxShadow: '0 -8px 40px rgba(139,92,246,0.15), 0 0 80px rgba(139,92,246,0.12)',
          animation: 'slide-up 0.3s cubic-bezier(.34,1.56,.64,1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div
          className="mx-auto mt-3 mb-1 h-1 w-10 shrink-0 rounded-full sm:hidden"
          style={{ background: 'rgba(255,255,255,0.15)' }}
        />

        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 px-5 pt-3 pb-2 sm:pt-5">
          <span className="text-[18px]">🎯</span>
          <div
            className="font-fredoka text-[17px] leading-tight font-black"
            style={{
              background: 'linear-gradient(90deg, #c4b5fd, #f9a8d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            档位标准
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-[16px] font-black transition-all active:scale-90"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(245,243,255,0.5)',
            }}
          >
            ×
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-3">
          {items.length === 0 && (
            <div
              className="py-6 text-center text-[12px]"
              style={{ color: 'rgba(196,181,253,0.5)' }}
            >
              尚未选择任何运算
            </div>
          )}
          {items.map((item, idx) => {
            const tiers = suggestedTiers(item.targetId)
            const showGroup = item.group != null && item.group !== items[idx - 1]?.group
            return (
              <div key={`${item.kind}:${item.targetId}`}>
                {showGroup && (
                  <div
                    className="mt-1 mb-1.5 text-[10px] font-extrabold tracking-wider uppercase"
                    style={{ color: 'rgba(196,181,253,0.45)' }}
                  >
                    {item.group}
                  </div>
                )}
                <div
                  className="rounded-xl px-3 py-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="mb-1.5 text-[12px] font-extrabold" style={{ color: '#f5f3ff' }}>
                    {item.label}
                  </div>
                  {tiers ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {TIER_ORDER.map((tier) => {
                        const t = TIER_DARK[tier]
                        return (
                          <div
                            key={tier}
                            className="rounded-lg px-1 py-1.5 text-center"
                            style={{ background: t.bg, border: `1px solid ${t.border}` }}
                          >
                            <div className="text-[10px] leading-none font-extrabold">
                              <span style={{ color: t.color }}>
                                {TIER_LABEL[tier]}
                                {tier === 'fluent' ? '⭐' : ''}
                              </span>
                            </div>
                            <div
                              className="mt-1 text-[11px] leading-none font-black tabular-nums"
                              style={{ color: '#f5f3ff' }}
                            >
                              {tiers[tier][0]}–{tiers[tier][1]}s
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px]" style={{ color: '#fbbf24' }}>
                      ⚠️ 暂无建议耗时
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div
          className="shrink-0 px-5 pt-2 pb-4 text-[10px] leading-relaxed sm:pb-5"
          style={{ color: 'rgba(196,181,253,0.45)', borderTop: '1px solid rgba(139,92,246,0.12)' }}
        >
          报告按「平均秒/题 ≤ 档位上限」判定，且首答正确率 ≥ 80% 才参与升档；⭐ 高级为推荐目标。
        </div>
      </div>
    </div>
  )
}
