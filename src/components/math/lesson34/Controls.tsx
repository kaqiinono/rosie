'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RotateCcw, Dices } from 'lucide-react'

interface ControlsProps {
  mode: 'merge' | 'split'
  step: number
  totalSteps: number
  btnText: string
  isLast: boolean
  onNext: () => void
  onReset: () => void
  onRandom: () => void
}

export default function Controls({ mode, step, totalSteps, btnText, isLast, onNext, onReset, onRandom }: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <Button variant="outline" onClick={onReset}>
        <RotateCcw className="h-4 w-4" /> 重来
      </Button>

      <Button
        variant="gradient"
        className="bg-gradient-to-br from-emerald-500 to-emerald-600"
        onClick={onRandom}
      >
        <Dices className="h-4 w-4" /> 换一题
      </Button>

      {/* Step dots */}
      <div className="flex items-center gap-[5px]">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-all duration-300',
              i < step
                ? 'bg-emerald-500'
                : i === step
                  ? cn('scale-120', mode === 'split' ? 'bg-violet-500' : 'bg-orange-500')
                  : 'bg-slate-200'
            )}
          />
        ))}
      </div>

      <Button
        variant="gradient"
        size="lg"
        className={cn(
          mode === 'split'
            ? 'bg-gradient-to-br from-violet-500 to-indigo-500'
            : 'bg-gradient-to-br from-orange-500 to-red-500'
        )}
        onClick={onNext}
        disabled={isLast}
      >
        {btnText}
      </Button>
    </div>
  )
}
