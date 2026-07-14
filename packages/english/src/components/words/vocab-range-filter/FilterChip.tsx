'use client'

import type { ReactNode } from 'react'
import { filterChipClass, type FilterChipTone } from './filterChipStyles'

type FilterChipProps = {
  active: boolean
  tone?: FilterChipTone
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}

export default function FilterChip({
  active,
  tone = 'neutral',
  onClick,
  children,
  disabled = false,
  type = 'button',
  className = '',
}: FilterChipProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${filterChipClass(active, tone)} disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  )
}
