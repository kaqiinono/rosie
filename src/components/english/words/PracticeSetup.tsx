'use client'

import { useState } from 'react'

interface PracticeSetupProps {
  scopeLabel: string
  onStart: (types: ('A' | 'B' | 'C')[], preview: boolean) => void
}

export default function PracticeSetup({ scopeLabel, onStart }: PracticeSetupProps) {
  const [typeA, setTypeA] = useState(true)
  const [typeB, setTypeB] = useState(false)
  const [typeC, setTypeC] = useState(true)
  const [preview, setPreview] = useState(false)

  const handleStart = () => {
    const types: ('A' | 'B' | 'C')[] = []
    if (typeA) types.push('A')
    if (typeB) types.push('B')
    if (typeC) types.push('C')
    if (!types.length) {
      alert('请至少选一种题型！')
      return
    }
    onStart(types, preview)
  }

  return (
    <div className="mb-5 rounded-[var(--wm-radius)] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6">
      <h2 className="font-fredoka mb-3.5 text-[1.35rem] text-[var(--wm-accent2)]">🎯 练习设置</h2>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="min-w-[60px] text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
          题型
        </span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'A', label: 'A. 释义→选单词', checked: typeA, toggle: setTypeA },
              { key: 'B', label: 'B. 单词→选释义', checked: typeB, toggle: setTypeB },
              { key: 'C', label: 'C. 释义→默写', checked: typeC, toggle: setTypeC },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => t.toggle(!t.checked)}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-[0.875rem] font-bold transition-all select-none ${
                t.checked
                  ? 'border-[var(--wm-accent)] bg-[rgba(233,69,96,.15)] text-[var(--wm-accent)]'
                  : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="min-w-[60px] text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
          预览卡片
        </span>
        <button
          onClick={() => setPreview(!preview)}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-[0.875rem] font-bold transition-all select-none ${
            preview
              ? 'border-[var(--wm-accent2)] bg-[rgba(100,160,255,.12)] text-[var(--wm-accent2)]'
              : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
          }`}
        >
          <div
            className={`relative h-3.5 w-7 rounded-[7px] transition-colors ${preview ? 'bg-[rgba(100,160,255,.45)]' : 'bg-[var(--wm-border)]'}`}
          >
            <div
              className={`absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full transition-all ${preview ? 'translate-x-3.5 bg-[var(--wm-accent2)]' : 'bg-[var(--wm-text-dim)]'}`}
            />
          </div>
          {preview ? '开' : '关'}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[0.875rem] text-[var(--wm-text-dim)]">
          范围：<span className="font-extrabold text-[var(--wm-accent2)]">{scopeLabel}</span>
        </span>
      </div>

      <button
        onClick={handleStart}
        className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] px-7 py-3 text-[.95rem] font-extrabold text-white shadow-[0_4px_14px_rgba(233,69,96,.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(233,69,96,.5)]"
      >
        🚀 开始练习
      </button>
    </div>
  )
}
