'use client'

import { useState } from 'react'

/** Shared preset choices for both the total and per-type question counts. */
export const COUNT_OPTIONS = [10, 20, 30, 50, 100]

interface Props {
  count: number
  onChange: (n: number) => void
  /** 'sm' for the per-type cards, 'md' for the prominent total bar. */
  size?: 'sm' | 'md'
}

/**
 * A free-text number field that sits alongside the preset count chips.
 * It is highlighted as "active" only when the current count is NOT one of the
 * presets, so a custom value is visually distinct from a chip selection.
 */
export default function CustomCountInput({ count, onChange, size = 'sm' }: Props) {
  const isCustom = count > 0 && !COUNT_OPTIONS.includes(count)
  // `draft` only drives what the user is actively typing. The displayed value is
  // derived: when the count is a preset (e.g. a chip was clicked) we show an empty
  // field regardless of any stale draft, so a preset selection isn't double-shown.
  const [draft, setDraft] = useState(isCustom ? String(count) : '')
  const value = isCustom ? draft : ''

  const sizeCls =
    size === 'md' ? 'w-20 rounded-xl px-3 py-2 text-[13px]' : 'w-14 rounded-md px-2 py-0.5 text-[11px]'

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={value}
      placeholder="自定义"
      aria-label="自定义题量"
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const v = Math.floor(Number(raw))
        if (Number.isFinite(v) && v > 0) onChange(v)
      }}
      onBlur={() => {
        // If left empty/invalid while a custom count is active, show it again.
        if (isCustom && !(Number(draft) > 0)) setDraft(String(count))
      }}
      className={`font-extrabold tabular-nums outline-none transition-all ${sizeCls}`}
      style={{
        background: isCustom ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${isCustom ? 'rgba(139,92,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
        color: isCustom ? '#c4b5fd' : 'rgba(196,181,253,0.6)',
      }}
    />
  )
}
