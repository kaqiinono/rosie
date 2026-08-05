'use client'

import type { ProblemDifficulty } from '@rosie/core'
import { DIFFICULTY_LABELS } from '@rosie/core'

type Props = {
  level: ProblemDifficulty
  /** compact: list cards; default: detail page */
  size?: 'sm' | 'md'
  /** List cards: stars only, no 「难度」 label */
  compact?: boolean
}

const SIZE = {
  sm: 'text-[10px]',
  md: 'text-xs',
} as const

export default function DifficultyStars({ level, size = 'sm', compact = false }: Props) {
  if (compact) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-px text-[10px] leading-none"
        title={`难度 ${level}/5 · ${DIFFICULTY_LABELS[level]}`}
      >
        {([1, 2, 3, 4, 5] as const).map(n => (
          <span key={n} className={n <= level ? 'text-amber-500' : 'text-amber-200'}>
            ★
          </span>
        ))}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-px font-semibold text-amber-800 ${SIZE[size]}`}
      title={`难度 ${level}/5 · ${DIFFICULTY_LABELS[level]}`}
    >
      <span className="opacity-70">难度</span>
      {([1, 2, 3, 4, 5] as const).map(n => (
        <span key={n} className={n <= level ? 'text-amber-500' : 'text-amber-200'}>
          ★
        </span>
      ))}
    </span>
  )
}
