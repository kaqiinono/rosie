'use client'

import { Check, X } from 'lucide-react'
import { IconButton } from './themes'

type ChoiceAppearanceProps = {
  appearance?: 'default' | 'quiet'
  /** A non-interactive example retains the selected colors without looking disabled. */
  demonstration?: boolean
}

export function LetterChoiceButton({ letter, selected, label, disabled, onClick, appearance = 'default', demonstration = false }: {
  letter: string
  selected: boolean
  label: string
  disabled?: boolean
  onClick?: () => void
} & ChoiceAppearanceProps) {
  return <IconButton size="2" variant={selected ? 'solid' : 'soft'} color={selected ? appearance === 'quiet' ? 'blue' : 'amber' : 'gray'}
    className="rosie-JudgmentIconButton" data-appearance={appearance} data-demonstration={demonstration || undefined} disabled={disabled || demonstration} aria-label={label}
    title={label} aria-pressed={selected} onClick={onClick}>
    {letter}
  </IconButton>
}

export function JudgmentIconButton({ answer, selected, label, disabled, onClick, appearance = 'default', demonstration = false }: {
  answer: 'right' | 'wrong'
  selected: boolean
  label: string
  disabled?: boolean
  onClick?: () => void
} & ChoiceAppearanceProps) {
  const Icon = answer === 'right' ? Check : X
  return <IconButton size="2" variant={selected ? 'solid' : 'soft'} color={selected ? appearance === 'quiet' ? 'blue' : 'amber' : 'gray'}
    className="rosie-JudgmentIconButton" data-appearance={appearance} data-demonstration={demonstration || undefined} disabled={disabled || demonstration} aria-label={label}
    title={answer === 'right' ? '对' : '错'} aria-pressed={selected} onClick={onClick}>
    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
  </IconButton>
}
