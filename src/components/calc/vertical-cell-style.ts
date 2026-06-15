import type { CSSProperties } from 'react'

/** Shared editable-cell chrome for all 竖式 surfaces. */
export function editableCellStyle(opts: {
  isActive: boolean
  graded: boolean
  val: number | null
  correctVal: number
}): Pick<CSSProperties, 'borderColor' | 'background' | 'color' | 'boxShadow'> {
  const wrong = opts.graded && opts.val !== null && opts.val !== opts.correctVal
  const right = opts.graded && opts.val !== null && opts.val === opts.correctVal

  if (wrong) {
    return {
      borderColor: opts.isActive ? 'rgba(248,113,113,0.95)' : 'rgba(248,113,113,0.55)',
      background: opts.isActive ? 'rgba(248,113,113,0.25)' : 'rgba(248,113,113,0.15)',
      color: '#f87171',
      boxShadow: opts.isActive
        ? '0 0 16px rgba(248,113,113,0.5), 0 0 6px rgba(248,113,113,0.35)'
        : undefined,
    }
  }
  if (right) {
    return {
      borderColor: opts.isActive ? 'rgba(74,222,128,0.7)' : 'rgba(74,222,128,0.5)',
      background: opts.isActive ? 'rgba(74,222,128,0.22)' : 'rgba(74,222,128,0.15)',
      color: '#4ade80',
      boxShadow: opts.isActive ? '0 0 12px rgba(74,222,128,0.35)' : undefined,
    }
  }
  if (opts.isActive) {
    return {
      borderColor: 'rgba(139,92,246,0.7)',
      background: 'rgba(139,92,246,0.2)',
      color: '#c4b5fd',
      boxShadow: '0 0 16px rgba(139,92,246,0.45), 0 0 6px rgba(139,92,246,0.35)',
    }
  }
  return {
    borderColor: 'rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    color: '#f5f3ff',
    boxShadow: undefined,
  }
}

/** Keypad row: stay in layout when locked; only dim + block input. */
export const VERTICAL_KEYPAD_LOCKED_CLASS = 'pointer-events-none opacity-40'
