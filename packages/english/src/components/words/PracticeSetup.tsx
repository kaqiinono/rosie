'use client'

import { useState } from 'react'
import type { SpellButtonStyle } from './SpellTiles'

interface PracticeSetupProps {
  scopeLabel: string
  onStart: (
    types: ('A' | 'B' | 'C' | 'D')[],
    preview: boolean,
    buttonStyle: SpellButtonStyle,
  ) => void
  onPrint: (types: ('A' | 'B' | 'C' | 'D')[]) => void
  /** When true, the Type D toggle (课文语境填空) is shown — set when at least one
   *  filtered word comes from the focus lesson and has a passage sentence. */
  typeDAvailable?: boolean
  /** Initial button style (typically from context). Defaults to 'candy'. */
  initialButtonStyle?: SpellButtonStyle
}

export default function PracticeSetup({
  scopeLabel,
  onStart,
  onPrint,
  typeDAvailable,
  initialButtonStyle = 'candy',
}: PracticeSetupProps) {
  const [typeA, setTypeA] = useState(true)
  const [typeB, setTypeB] = useState(false)
  const [typeC, setTypeC] = useState(true)
  const [typeD, setTypeD] = useState(true)
  const [preview, setPreview] = useState(false)
  const [buttonStyle, setButtonStyle] = useState<SpellButtonStyle>(initialButtonStyle)

  const collectTypes = (): ('A' | 'B' | 'C' | 'D')[] => {
    const types: ('A' | 'B' | 'C' | 'D')[] = []
    if (typeA) types.push('A')
    if (typeB) types.push('B')
    if (typeC) types.push('C')
    if (typeD && typeDAvailable) types.push('D')
    return types
  }

  const handleStart = () => {
    const types = collectTypes()
    if (!types.length) {
      alert('请至少选一种题型！')
      return
    }
    onStart(types, preview, buttonStyle)
  }

  const handlePrint = () => {
    const types = collectTypes()
    if (!types.length) {
      alert('请至少选一种题型！')
      return
    }
    onPrint(types)
  }

  const baseTypes = [
    { key: 'A', label: 'A. 释义→选单词', checked: typeA, toggle: setTypeA },
    { key: 'B', label: 'B. 单词→选释义', checked: typeB, toggle: setTypeB },
    { key: 'C', label: 'C. 释义→默写', checked: typeC, toggle: setTypeC },
  ] as const

  return (
    <div className="mb-5 rounded-[var(--wm-radius)] border border-[var(--wm-border)] bg-[var(--wm-surface)] p-6">
      <h2 className="font-fredoka mb-3.5 text-[1.35rem] text-[var(--wm-accent2)]">🎯 练习设置</h2>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="min-w-[60px] text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
          题型
        </span>
        <div className="flex flex-wrap gap-2">
          {baseTypes.map((t) => (
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
          {typeDAvailable && (
            <button
              key="D"
              onClick={() => setTypeD(!typeD)}
              title="本周重点课的词，挖空课文原句作答"
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-[0.875rem] font-bold transition-all select-none ${
                typeD
                  ? 'border-[#f59e0b] bg-[rgba(245,158,11,.15)] text-[#fbbf24]'
                  : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
              }`}
            >
              📖 D. 课文语境填空
            </button>
          )}
        </div>
      </div>

      {/* Spell tile style — only matters when Type C is in the mix, but we always show
          it here so the choice is visible at the entry. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className="min-w-[60px] text-[0.875rem] font-bold text-[var(--wm-text-dim)]"
          title="默写题字母池按钮样式"
        >
          字母砖
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setButtonStyle('candy')}
            title="SVG 水果造型（草莓 / 蓝莓 / 爱心 / 糖果 / 棉花糖）"
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-[0.875rem] font-bold transition-all select-none ${
              buttonStyle === 'candy'
                ? 'border-[#ec4899] bg-[rgba(236,72,153,.15)] text-[#f9a8d4]'
                : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
            }`}
          >
            🍓 糖果造型
          </button>
          <button
            onClick={() => setButtonStyle('jelly')}
            title="圆角果冻砖（5 色彩虹）"
            className={`flex cursor-pointer items-center gap-1.5 rounded-lg border-2 px-3 py-2 text-[0.875rem] font-bold transition-all select-none ${
              buttonStyle === 'jelly'
                ? 'border-[#a78bfa] bg-[rgba(167,139,250,.15)] text-[#c4b5fd]'
                : 'border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)]'
            }`}
          >
            💎 果冻砖
          </button>
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

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleStart}
          className="font-nunito cursor-pointer rounded-[10px] border-0 bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] px-7 py-3 text-[.95rem] font-extrabold text-white shadow-[0_4px_14px_rgba(233,69,96,.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(233,69,96,.5)]"
        >
          🚀 开始练习
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="font-nunito cursor-pointer rounded-[10px] border-2 border-[var(--wm-border)] bg-[var(--wm-surface2)] px-7 py-3 text-[.95rem] font-extrabold text-[var(--wm-text)] transition-all hover:-translate-y-0.5 hover:border-[var(--wm-accent2)] hover:text-[var(--wm-accent2)]"
        >
          🖨️ 打印
        </button>
      </div>
    </div>
  )
}
