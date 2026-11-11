'use client'

import { Button } from '@rosie/ui/themes'

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

export default function Controls({
  mode,
  step,
  totalSteps,
  btnText,
  isLast,
  onNext,
  onReset,
  onRandom,
}: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      <Button onClick={onReset} variant="outline" color="gray" size="3">
        ↺ 重来
      </Button>
      <Button onClick={onRandom} variant="solid" color="jade" size="3">
        🎲 换一题
      </Button>

      {/* Step dots */}
      <div className="flex items-center gap-[5px]">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
              i < step
                ? 'bg-emerald-500'
                : i === step
                  ? `scale-120 ${mode === 'split' ? 'bg-violet-500' : 'bg-orange-500'}`
                  : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      <Button
        onClick={onNext}
        disabled={isLast}
        variant="solid"
        color={mode === 'split' ? 'indigo' : 'orange'}
        size="3"
      >
        {btnText}
      </Button>
    </div>
  )
}
