'use client'

import type { Lesson34Mode } from '@/utils/type'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ModeBarProps {
  mode: Lesson34Mode
  onSwitch: (mode: Lesson34Mode) => void
}

export default function ModeBar({ mode, onSwitch }: ModeBarProps) {
  return (
    <div className="flex justify-center gap-2">
      <Button
        variant={mode === 'merge' ? 'gradient' : 'outline'}
        className={cn(
          mode === 'merge' && 'bg-gradient-to-br from-orange-500 to-red-500 shadow-[0_4px_16px_rgba(239,68,68,.3)]'
        )}
        onClick={() => onSwitch('merge')}
      >
        合并：两袋 → 一袋
      </Button>
      <Button
        variant={mode === 'split' ? 'gradient' : 'outline'}
        className={cn(
          mode === 'split' && 'bg-gradient-to-br from-violet-500 to-indigo-500 shadow-[0_4px_16px_rgba(99,102,241,.3)]'
        )}
        onClick={() => onSwitch('split')}
      >
        拆分：一袋 → 两袋
      </Button>
    </div>
  )
}
