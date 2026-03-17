'use client'

import { useState } from 'react'

interface PracticeSetupProps {
  scopeLabel: string
  onStart: (types: ('A' | 'B' | 'C')[]) => void
}

export default function PracticeSetup({ scopeLabel, onStart }: PracticeSetupProps) {
  const [typeA, setTypeA] = useState(true)
  const [typeB, setTypeB] = useState(true)
  const [typeC, setTypeC] = useState(false)

  const handleStart = () => {
    const types: ('A' | 'B' | 'C')[] = []
    if (typeA) types.push('A')
    if (typeB) types.push('B')
    if (typeC) types.push('C')
    if (!types.length) {
      alert('请至少选一种题型！')
      return
    }
    onStart(types)
  }

  return (
    <div className="bg-[var(--wm-surface)] border border-[var(--wm-border)] rounded-[var(--wm-radius)] p-6 mb-5">
      <h2 className="font-fredoka text-[1.35rem] text-[var(--wm-accent2)] mb-3.5">🎯 练习设置</h2>

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <span className="text-[.78rem] font-bold text-[var(--wm-text-dim)] min-w-[60px]">题型</span>
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'A', label: 'A. 释义→选单词', checked: typeA, toggle: setTypeA },
            { key: 'B', label: 'B. 单词→选释义', checked: typeB, toggle: setTypeB },
            { key: 'C', label: 'C. 释义→默写', checked: typeC, toggle: setTypeC },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => t.toggle(!t.checked)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 cursor-pointer text-[.8rem] font-bold transition-all select-none ${
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

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <span className="text-[.78rem] text-[var(--wm-text-dim)]">
          范围：<span className="text-[var(--wm-accent2)] font-extrabold">{scopeLabel}</span>
        </span>
      </div>

      <button
        onClick={handleStart}
        className="px-7 py-3 bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.95rem] cursor-pointer transition-all shadow-[0_4px_14px_rgba(233,69,96,.35)] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(233,69,96,.5)]"
      >
        🚀 开始练习
      </button>
    </div>
  )
}
