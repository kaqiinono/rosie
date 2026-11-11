'use client'

import './gong.css'
import { GONG_COLORS } from './utils/constants'
import React from 'react'
import { Button } from '@rosie/ui/themes'

interface ColorPaletteProps {
  items: { key: string | number; label: string | number; colorIndex: number }[]
  selected: string | number | null
  onSelect: (key: string | number) => void
}

export function ColorPalette({ items, selected, onSelect }: ColorPaletteProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--gong-text3)]">选择数字：</span>
      {items.map(({ key, label, colorIndex }) => {
        const col = GONG_COLORS[colorIndex % GONG_COLORS.length]
        const isSelected = selected === key
        return (
          <button // native-ok: 数字色块调色板：每个按钮是按数字配色的色块，选中时放大并换边框色，标准 Button 无法表达
            key={String(key)}
            type="button"
            onClick={() => onSelect(key)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border-2 text-base font-bold transition-transform"
            style={{
              background: col.bg,
              borderColor: isSelected ? 'var(--gong-text)' : col.border,
              color: col.text,
              transform: isSelected ? 'scale(1.12)' : undefined,
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function ResultMessage({ message, type }: { message: string; type?: 'ok' | 'err' | '' }) {
  if (!message) return <div className="mt-2 min-h-[18px]" />
  return (
    <p
      className={`mt-2 min-h-[18px] text-sm font-medium ${
        type === 'ok'
          ? 'text-[var(--gong-accent)]'
          : type === 'err'
            ? 'text-[var(--gong-coral)]'
            : ''
      }`}
    >
      {message}
    </p>
  )
}

export function ActionButton({
  children,
  onClick,
  variant = 'default',
  disabled = false,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      variant={variant === 'primary' ? 'solid' : variant === 'danger' ? 'soft' : 'outline'}
      color={variant === 'danger' ? 'red' : variant === 'primary' ? 'amber' : 'gray'}
      size="2"
      radius="full"
    >
      {children}
    </Button>
  )
}
