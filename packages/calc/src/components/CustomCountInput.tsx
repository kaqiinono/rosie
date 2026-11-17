'use client'

import { useState } from 'react'

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

  const sizeCls =
    size === 'md' ? 'w-20 rounded-xl px-3 py-2 text-[13px]' : 'w-14 rounded-md px-2 py-0.5 text-[11px]'

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={max}
      value={value}
      placeholder="自定义"
      aria-label="自定义题量"
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const v = Math.floor(Number(raw))
        if (Number.isFinite(v) && v > 0) {
          const next = max == null ? v : Math.min(max, v)
          if (next !== v) setDraft(String(next))
          onChange(next)
        }
      }}
      onBlur={() => setDraft(null)}
      className={`${appearance === 'light' ? 'border-2 border-violet-300 bg-white text-violet-900 placeholder:text-violet-800 focus-visible:ring-2 focus-visible:ring-violet-700' : ''} font-extrabold tabular-nums outline-none transition-all ${sizeCls}`}
      style={appearance === 'light' ? undefined : {
        background: isCustom ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isCustom ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
        color: isCustom ? '#c4b5fd' : 'rgba(196,181,253,0.6)',
      }}
    />
  )
}
