'use client'

import { useEffect, useState } from 'react'
import { SKELETONS, skeletonMeta, isMixedOpValid } from '@/utils/calc-mixed'
import { blocksByGroup, blockById, BLOCK_GROUPS } from '@/utils/calc-blocks'
import type { MixedOp, CalcSkeletonId } from '@/utils/type'

interface Props {
  /** 编辑已有；缺省=新增 */
  initial?: MixedOp
  onSave: (op: MixedOp) => void
  onClose: () => void
}

const EXAMPLE: Record<CalcSkeletonId, string> = {
  as: '5 + 3 − 2',
  md: '6 ÷ 2 × 3',
  asm: '3 + 4 × 2',
  asmd: '3 + 4 × 2 − 6 ÷ 3',
  as_m_paren: '(3 + 4) × 2',
  md_paren: '8 ÷ (2 × 2)',
  asmd_paren: '(2 + 4) × 3 ÷ 2',
}

const GROUP_ICONS: { add: string; sub: string; mul: string; div: string } = {
  add: '➕',
  sub: '➖',
  mul: '✖️',
  div: '➗',
}

/** needs ('add'|'sub'|'mul'|'div') → 要展示的积木分组（去重，保持 BLOCK_GROUPS 顺序） */
function groupsForNeeds(needs: ('add' | 'sub' | 'mul' | 'div')[]): ('add' | 'sub' | 'mul' | 'div')[] {
  return BLOCK_GROUPS.map((g) => g.group).filter(
    (g): g is 'add' | 'sub' | 'mul' | 'div' => needs.includes(g as 'add' | 'sub' | 'mul' | 'div'),
  )
}

export default function MixedOpComposer({ initial, onSave, onClose }: Props) {
  const [skeleton, setSkeleton] = useState<CalcSkeletonId | null>(initial?.skeleton ?? null)
  const [blockIds, setBlockIds] = useState<string[]>(initial?.blockIds ?? [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const meta = skeleton ? skeletonMeta(skeleton) : null
  const groups = meta ? groupsForNeeds(meta.needs) : []

  const valid = skeleton !== null && isMixedOpValid({ id: '_', skeleton, blockIds, enabled: true })

  const toggleBlock = (id: string) => {
    setBlockIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  const buildLabel = (): string => {
    if (!meta) return ''
    const blockLabels = blockIds.map((id) => blockById(id)?.label).filter((l): l is string => !!l)
    if (blockLabels.length === 0) return meta.label
    return `${meta.label} · ${blockLabels.join('+')}`
  }

  const handleSave = () => {
    if (!skeleton || !valid) return
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      skeleton,
      blockIds,
      enabled: initial?.enabled ?? true,
      label: buildLabel(),
      count: initial?.count ?? 20,
      seconds: initial?.seconds ?? null,
    })
  }

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
          <span className="text-[18px]">🧩</span>
          <div
            className="font-fredoka text-[17px] leading-tight font-black"
            style={{
              background: 'linear-gradient(90deg, #c4b5fd, #f9a8d4)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {initial ? '编辑混合运算' : '新建混合运算'}
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
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {/* Step 1: skeleton */}
          <div className="mb-1.5 flex items-center gap-1.5">
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
              style={{ background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }}
            >
              1
            </span>
            <span
              className="text-[10px] font-extrabold tracking-wider uppercase"
              style={{ color: 'rgba(196,181,253,0.5)' }}
            >
              选一个骨架
            </span>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SKELETONS.map((s) => {
              const on = skeleton === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSkeleton(s.id)}
                  aria-pressed={on}
                  className="rounded-xl px-3 py-2.5 text-left transition-all active:scale-95"
                  style={{
                    background: on ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${on ? 'rgba(196,181,253,0.6)' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: on ? '0 0 16px rgba(139,92,246,0.25)' : 'none',
                  }}
                >
                  <div
                    className="text-[12px] leading-tight font-extrabold"
                    style={{ color: on ? '#e9d5ff' : 'rgba(245,243,255,0.6)' }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="font-fredoka mt-1 text-[14px] leading-none font-black tabular-nums"
                    style={{ color: on ? '#fbbf24' : 'rgba(245,243,255,0.3)' }}
                  >
                    {EXAMPLE[s.id]}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Step 2: blocks */}
          {meta && (
            <>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                  style={{ background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }}
                >
                  2
                </span>
                <span
                  className="text-[10px] font-extrabold tracking-wider uppercase"
                  style={{ color: 'rgba(196,181,253,0.5)' }}
                >
                  挑选积木（每种至少一个）
                </span>
              </div>

              <div className="space-y-3 pb-2">
                {groups.map((group) => {
                  const groupLabel = BLOCK_GROUPS.find((g) => g.group === group)?.label ?? group
                  const blocks = blocksByGroup(group)
                  return (
                    <div key={group}>
                      <div
                        className="mb-1.5 flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider uppercase"
                        style={{ color: 'rgba(196,181,253,0.45)' }}
                      >
                        <span aria-hidden className="text-[12px] leading-none">
                          {GROUP_ICONS[group]}
                        </span>
                        {groupLabel}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                        {blocks.map((b) => {
                          const on = blockIds.includes(b.id)
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => toggleBlock(b.id)}
                              aria-pressed={on}
                              className="rounded-lg px-2.5 py-2.5 text-left text-[11px] leading-tight font-extrabold transition-all active:scale-95"
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-2 pb-5 sm:pb-5">
          {!valid && skeleton && (
            <div
              className="mb-2 rounded-xl px-3 py-2 text-center text-[12px] font-extrabold"
              style={{
                background: 'rgba(251,191,36,0.1)',
                border: '1px solid rgba(251,191,36,0.25)',
                color: '#fbbf24',
              }}
            >
              🤔 每个运算至少选一个积木
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl py-3 text-[14px] font-extrabold transition-all active:scale-95"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(245,243,255,0.5)',
              }}
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid}
              className="flex-[2] rounded-2xl py-3 text-[15px] font-black text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                background: valid
                  ? 'linear-gradient(135deg, #8b5cf6, #ec4899)'
                  : 'rgba(255,255,255,0.06)',
                boxShadow: valid ? '0 6px 20px rgba(139,92,246,0.35)' : 'none',
              }}
            >
              {initial ? '保存修改' : '✨ 添加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
