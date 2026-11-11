'use client'

import { useEffect, useState } from 'react'
import { Button, TextField } from '@rosie/ui/themes'
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

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[.68rem] font-extrabold tracking-widest text-[var(--wm-text-dim)] uppercase">
          每批新词
        </span>
        <span className="text-[.62rem] font-bold text-[var(--wm-text-dim)]">
          每轮批量 / 今日目标 · 默认 {ADAPTIVE_PLAN_DEFAULTS.newWordsPerDay} · 范围 1–
          {NEW_WORDS_PER_DAY_MAX}
          {savingLabel ? ` · ${savingLabel}` : ''}· 完成后可提前继续学
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {NEW_WORDS_PER_DAY_PRESETS.map((n) => (
          <Button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            variant={value === n ? 'solid' : 'soft'}
            color={value === n ? 'violet' : 'gray'}
            size={size === 'md' ? '2' : '1'}
            radius="full"
          >
            {n}
          </Button>
        ))}
        <div className="flex items-center gap-1.5 pl-0.5">
          <TextField.Root
            size={size === 'md' ? '2' : '1'}
            color={usingCustom ? 'violet' : 'gray'}
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
            className={size === 'md' ? 'w-20' : 'w-16'}
            aria-label="自定义每批新词数量"
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
