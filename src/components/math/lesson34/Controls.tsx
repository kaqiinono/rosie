'use client'

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
      <button
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[14px] border-2 border-slate-200 bg-white px-5 py-2.5 text-[15px] font-bold text-slate-500 shadow-[0_4px_14px_rgba(0,0,0,.1)] transition-all duration-200 hover:border-slate-400 hover:text-slate-700 active:scale-[.96]"
        onClick={onReset}
      >
        ↺ 重来
      </button>
      <button
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-[14px] bg-gradient-to-br from-emerald-500 to-emerald-600 px-5 py-2.5 text-[15px] font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,.1)] transition-all duration-200 hover:brightness-105 active:scale-[.96]"
        onClick={onRandom}
      >
        🎲 换一题
      </button>

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

      <button
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[14px] px-7 py-3 text-[17px] font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,.1)] transition-all duration-200 hover:brightness-105 active:scale-[.96] disabled:cursor-default disabled:opacity-40 disabled:brightness-100 ${
          mode === 'split'
            ? 'bg-gradient-to-br from-violet-500 to-indigo-500'
            : 'bg-gradient-to-br from-orange-500 to-red-500'
        }`}
        onClick={onNext}
        disabled={isLast}
      >
        {btnText}
      </button>
    </div>
  )
}
