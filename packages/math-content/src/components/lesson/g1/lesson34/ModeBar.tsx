'use client'

import type { Lesson34Mode } from '@rosie/core'
import { Button } from '@rosie/ui/themes'

interface ModeBarProps {
  mode: Lesson34Mode
  onSwitch: (mode: Lesson34Mode) => void
}

export default function ModeBar({ mode, onSwitch }: ModeBarProps) {
  return (
    <div className="flex justify-center gap-2">
      <Button
        onClick={() => onSwitch('merge')}
        variant={mode === 'merge' ? 'solid' : 'outline'}
        color={mode === 'merge' ? 'red' : 'gray'}
        size="3"
      >
        合并：两袋 → 一袋
      </Button>
      <Button
        onClick={() => onSwitch('split')}
        variant={mode === 'split' ? 'solid' : 'outline'}
        color={mode === 'split' ? 'violet' : 'gray'}
        size="3"
      >
        拆分：一袋 → 两袋
      </Button>
    </div>
  )
}
