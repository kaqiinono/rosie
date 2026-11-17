'use client'

import { useState, type ChangeEvent } from 'react'
import { TextField } from '@rosie/ui/themes'

/** Shared preset choices for both the total and per-type question counts. */
export const COUNT_OPTIONS = [10, 20, 30, 50, 100]

interface Props {
  count: number
  onChange: (n: number) => void
  max?: number
  appearance?: 'light' | 'dark'
  /** 'sm' for the per-type cards, 'md' for the prominent total bar. */
  size?: 'sm' | 'md'
}

/**
 * A free-text number field that sits alongside the preset count chips.
 * It is highlighted as "active" only when the current count is NOT one of the
 * presets, so a custom value is visually distinct from a chip selection.
 */
export default function CustomCountInput({ count, onChange, max, appearance = 'dark', size = 'sm' }: Props) {
  const isCustom = count > 0 && !COUNT_OPTIONS.includes(count)
  // Preserve the text while editing, even when a partial value matches a preset.
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? (isCustom ? String(count) : '')

  const inputProps = {
    type: 'number' as const,
    inputMode: 'numeric' as const,
    min: 1,
    max,
    value,
    placeholder: '自定义',
    'aria-label': '自定义题量',
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value
      setDraft(raw)
      const number = Math.floor(Number(raw))
      if (Number.isFinite(number) && number > 0) {
        const next = max == null ? number : Math.min(max, number)
        if (next !== number) setDraft(String(next))
        onChange(next)
      }
    },
    onBlur: () => setDraft(null),
  }

  if (appearance === 'light') {
    return <TextField.Root {...inputProps} size={size === 'md' ? '3' : '2'} color="violet" variant="soft"
      className="min-h-11 min-w-0 text-center text-sm font-semibold tabular-nums [--text-field-padding:0px] [&_input::placeholder]:opacity-100" />
  }

  const sizeCls = size === 'md' ? 'w-20 rounded-xl px-3 py-2 text-[13px]' : 'w-14 rounded-md px-2 py-0.5 text-[11px]'

  return (
    <input {...inputProps}
      className={`font-extrabold tabular-nums outline-none transition-all ${sizeCls}`}
      style={{
        background: isCustom ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isCustom ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
        color: isCustom ? '#c4b5fd' : 'rgba(196,181,253,0.6)',
      }}
    />
  )
}
