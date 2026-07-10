'use client'

import { useEffect, useState } from 'react'
import {
  ADAPTIVE_PLAN_DEFAULTS,
  NEW_WORDS_PER_DAY_PRESETS,
  NEW_WORDS_PER_DAY_MAX,
  clampNewWordsPerDay,
} from '../../utils/adaptivePlanDefaults'

type NewWordsPerDayPickerProps = {
  value: number
  onChange: (n: number) => void
  disabled?: boolean
  savingLabel?: string
  wordCount?: number
  size?: 'sm' | 'md'
}

function chipClass(active: boolean, disabled: boolean, size: 'sm' | 'md'): string {
  const dim = size === 'md' ? 'h-10 min-w-10 px-3 text-[15px]' : 'h-8 min-w-8 px-2 text-[.8rem]'
  const base = `${dim} cursor-pointer rounded-full border-[1.5px] font-extrabold transition-all disabled:cursor-wait disabled:opacity-60`
  if (active) {
    return `${base} border-[#8b5cf6] bg-[rgba(139,92,246,.15)] text-[#c4b5fd]`
  }
  return `${base} border-[var(--wm-border)] bg-[var(--wm-surface2)] text-[var(--wm-text-dim)] hover:border-[#8b5cf6] hover:text-[#c4b5fd]`
}

function isPresetValue(n: number): boolean {
  return (NEW_WORDS_PER_DAY_PRESETS as readonly number[]).includes(n)
}

export default function NewWordsPerDayPicker({
  value,
  onChange,
  disabled = false,
  savingLabel,
  wordCount,
  size = 'sm',
}: NewWordsPerDayPickerProps) {
  const [customDraft, setCustomDraft] = useState(String(value))
  const usingCustom = !isPresetValue(value)

  useEffect(() => {
    setCustomDraft(String(value))
  }, [value])

  const commitCustom = () => {
    const parsed = Number.parseInt(customDraft, 10)
    const next = clampNewWordsPerDay(parsed)
    setCustomDraft(String(next))
    if (next !== value) onChange(next)
  }

  const inputClass =
    size === 'md'
      ? 'h-10 w-16 rounded-full border-[1.5px] bg-[var(--wm-surface2)] px-3 text-center text-[15px] font-extrabold outline-none'
      : 'h-8 w-14 rounded-full border-[1.5px] bg-[var(--wm-surface2)] px-2 text-center text-[.8rem] font-extrabold outline-none'

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
          每日新词数量
        </span>
        <span className="text-[.62rem] font-bold text-[var(--wm-text-dim)]">
          默认 {ADAPTIVE_PLAN_DEFAULTS.newWordsPerDay} · 范围 1–{NEW_WORDS_PER_DAY_MAX}
          {savingLabel ? ` · ${savingLabel}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {NEW_WORDS_PER_DAY_PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={chipClass(value === n, disabled, size)}
          >
            {n}
          </button>
        ))}
        <div className="flex items-center gap-1.5 pl-0.5">
          <input
            type="number"
            min={1}
            max={NEW_WORDS_PER_DAY_MAX}
            step={1}
            inputMode="numeric"
            disabled={disabled}
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onBlur={commitCustom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitCustom()
              }
            }}
            className={`${inputClass} ${
              usingCustom
                ? 'border-[#8b5cf6] text-[#c4b5fd]'
                : 'border-[var(--wm-border)] text-[var(--wm-text)]'
            } disabled:cursor-wait disabled:opacity-60`}
            aria-label="自定义每日新词数量"
          />
        </div>
      </div>
      <p className="mt-1.5 text-[.65rem] text-[var(--wm-text-dim)]">
        每天最多新拉入 {value} 个词；题型按熟悉度自动递进（认读 → 双向选择 →
        默写），无需手动选题型。
      </p>
      {wordCount != null && wordCount > 0 && (
        <p className="mt-1 text-[.65rem] text-[#c4b5fd]">
          约 {Math.ceil(wordCount / Math.max(1, value))} 天可全部引入（不含复习巩固天数）
        </p>
      )}
    </div>
  )
}
