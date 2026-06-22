'use client'

import { useState } from 'react'
import MixedOpComposer from './MixedOpComposer'
import { skeletonMeta, isMixedOpValid } from '../utils/calc-mixed'
import type { MixedOp } from '@rosie/core'

interface Props {
  mixedOps: MixedOp[]
  onChange: (next: MixedOp[]) => void
}

export default function MixedOpList({ mixedOps, onChange }: Props) {
  const [editing, setEditing] = useState<MixedOp | 'new' | null>(null)

  const toggleEnabled = (id: string) => {
    onChange(mixedOps.map((op) => (op.id === id ? { ...op, enabled: !op.enabled } : op)))
  }

  const remove = (id: string) => {
    onChange(mixedOps.filter((op) => op.id !== id))
  }

  const handleSave = (op: MixedOp) => {
    const exists = mixedOps.some((m) => m.id === op.id)
    onChange(exists ? mixedOps.map((m) => (m.id === op.id ? op : m)) : [...mixedOps, op])
    setEditing(null)
  }

  return (
    <div className="space-y-2">
      {mixedOps.length === 0 && (
        <div
          className="rounded-2xl px-4 py-5 text-center text-[12px] font-bold"
          style={{
            background: 'rgba(139,92,246,0.06)',
            border: '1px dashed rgba(139,92,246,0.28)',
            color: 'rgba(245,243,255,0.4)',
          }}
        >
          还没有混合运算，点下面添加一个吧～
        </div>
      )}

      {mixedOps.map((op) => {
        const meta = skeletonMeta(op.skeleton)
        const valid = isMixedOpValid(op)
        const label = op.label || meta.label
        return (
          <div
            key={op.id}
            className="flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{
              background: op.enabled ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${op.enabled ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="truncate text-[13px] font-extrabold"
                  style={{ color: op.enabled ? '#c4b5fd' : 'rgba(245,243,255,0.6)' }}
                >
                  {label}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(196,181,253,0.5)',
                  }}
                >
                  {meta.label}
                </span>
                {!valid && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                    style={{
                      background: 'rgba(251,191,36,0.12)',
                      color: '#fbbf24',
                      border: '1px solid rgba(251,191,36,0.3)',
                    }}
                  >
                    ⚠️ 缺积木
                  </span>
                )}
              </div>
            </div>

            {/* edit */}
            <button
              type="button"
              onClick={() => setEditing(op)}
              aria-label="编辑"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(196,181,253,0.7)' }}
            >
              ✏️
            </button>

            {/* delete */}
            <button
              type="button"
              onClick={() => remove(op.id)}
              aria-label="删除"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px] transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(248,113,113,0.7)' }}
            >
              🗑️
            </button>

            {/* enable toggle */}
            <button
              type="button"
              onClick={() => toggleEnabled(op.id)}
              aria-label={op.enabled ? '关闭' : '开启'}
              aria-pressed={op.enabled}
              className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
              style={{ background: op.enabled ? '#7c3aed' : 'rgba(255,255,255,0.1)' }}
            >
              <span
                className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                style={{ transform: op.enabled ? 'translateX(22px)' : 'translateX(4px)' }}
              />
            </button>
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="w-full rounded-xl px-4 py-3 text-[13px] font-extrabold transition-all active:scale-[0.98]"
        style={{
          background: 'rgba(139,92,246,0.1)',
          border: '1px dashed rgba(139,92,246,0.35)',
          color: '#c4b5fd',
        }}
      >
        ＋ 添加混合运算
      </button>

      {editing !== null && (
        <MixedOpComposer
          initial={editing === 'new' ? undefined : editing}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
