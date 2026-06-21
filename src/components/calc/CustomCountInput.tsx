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
  const [draft, setDraft] = useState(isCustom ? String(count) : '')

  // Keep the field in sync when the count changes elsewhere (e.g. a chip click):
  // empty (placeholder) for presets, the number itself for a custom value.
  // Adjusting state during render (the documented pattern) avoids an effect.
  const [prevCount, setPrevCount] = useState(count)
  if (count !== prevCount) {
    setPrevCount(count)
    setDraft(COUNT_OPTIONS.includes(count) ? '' : String(count))
  }

  const sizeCls =
    size === 'md' ? 'w-20 rounded-xl px-3 py-2 text-[13px]' : 'w-14 rounded-md px-2 py-0.5 text-[11px]'

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={draft}
      placeholder="自定义"
      aria-label="自定义题量"
      onChange={(e) => {
        const raw = e.target.value
        setDraft(raw)
        const v = Math.floor(Number(raw))
        if (Number.isFinite(v) && v > 0) onChange(v)
      }}
      onBlur={() => {
        // Revert an empty / invalid field back to the current count.
        if (!(Number(draft) > 0)) setDraft(COUNT_OPTIONS.includes(count) ? '' : String(count))
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
