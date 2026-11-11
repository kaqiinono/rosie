'use client'

import { useState } from 'react'
import type { SpellButtonStyle } from './SpellTiles'
import { Button } from '@rosie/ui/themes'

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
            <Button
              key={t.key}
              onClick={() => t.toggle(!t.checked)}
              variant="outline"
              color="gray"
              size="2"
            >
              {t.label}
            </Button>
          ))}
          {typeDAvailable && (
            <Button
              key="D"
              onClick={() => setTypeD(!typeD)}
              title="本周重点课的词，挖空课文原句作答"
              variant="outline"
              color="gray"
              size="2"
            >
              📖 D. 课文语境填空
            </Button>
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
          <Button
            onClick={() => setButtonStyle('candy')}
            title="SVG 水果造型（草莓 / 蓝莓 / 爱心 / 糖果 / 棉花糖）"
            variant="outline"
            color="gray"
            size="2"
          >
            🍓 糖果造型
          </Button>
          <Button
            onClick={() => setButtonStyle('jelly')}
            title="圆角果冻砖（5 色彩虹）"
            variant="outline"
            color="gray"
            size="2"
          >
            💎 果冻砖
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="min-w-[60px] text-[0.875rem] font-bold text-[var(--wm-text-dim)]">
          预览卡片
        </span>
        <button // native-ok: 整块可点击容器（内含多行内容），Radix Button 是 inline-flex 居中，不适用
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
        <Button onClick={handleStart} variant="solid" color="red" size="3">
          🚀 开始练习
        </Button>
        <Button type="button" onClick={handlePrint} variant="outline" color="gray" size="3">
          🖨️ 打印
        </Button>
      </div>
    </div>
  )
}
