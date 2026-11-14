'use client'

import { Save, X } from 'lucide-react'
import { IconButton } from './themes'

export function RegionEditActions({ tone, disabled, saving, onSave, onCancel }: {
  tone: 'text' | 'image' | 'question'
  disabled?: boolean
  saving?: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const color = tone === 'text' ? 'sky' : tone === 'image' ? 'green' : 'violet'
  return <div className="rosie-RegionEditActions" role="group" aria-label="编辑操作">
    <IconButton size="2" radius="none" variant="soft" color={color} disabled={disabled || saving} loading={saving}
      aria-label="保存修改" title="保存修改" onClick={onSave}><Save size={16} aria-hidden="true" /></IconButton>
    <IconButton size="2" radius="none" variant="soft" color={color} disabled={disabled || saving}
      aria-label="取消修改" title="取消修改" onClick={onCancel}><X size={16} aria-hidden="true" /></IconButton>
  </div>
}
