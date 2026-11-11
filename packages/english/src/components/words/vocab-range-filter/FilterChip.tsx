'use client'

import type { ReactNode } from 'react'
import { Button } from '@rosie/ui/themes'
import type { FilterChipTone } from './filterChipStyles'

type FilterChipProps = {
  active: boolean
  tone?: FilterChipTone
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  type?: 'button' | 'submit'
  /** 仅用于布局（宽度、外边距），不覆盖外观。 */
  className?: string
}

const TONE_COLOR = {
  stage: 'purple',
  unit: 'red',
  lesson: 'blue',
  word: 'orange',
  mastery: 'green',
  neutral: 'blue',
} as const satisfies Record<FilterChipTone, 'purple' | 'red' | 'blue' | 'orange' | 'green'>

export default function FilterChip({
  active,
  tone = 'neutral',
  onClick,
  children,
  disabled = false,
  type = 'button',
  className,
}: FilterChipProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      variant={active ? 'solid' : 'soft'}
      color={active ? TONE_COLOR[tone] : 'gray'}
      size="2"
      radius="full"
      className={className}
    >
      {children}
    </Button>
  )
}
