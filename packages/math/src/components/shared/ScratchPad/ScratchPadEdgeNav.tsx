'use client'

import type { ReactNode } from 'react'

type ScratchPadEdgeNavProps = {
  hasPrev: boolean
  hasNext: boolean
  positionLabel: string
  onPrev: () => void
  onNext: () => void
}

function VerticalNavLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="select-none text-[12px] font-bold leading-none tracking-[0.2em]"
      style={{ writingMode: 'vertical-rl', textOrientation: 'upright' }}
    >
      {children}
    </span>
  )
}

export default function ScratchPadEdgeNav({
  hasPrev,
  hasNext,
  positionLabel,
  onPrev,
  onNext,
}: ScratchPadEdgeNavProps) {
  const btnBase =
    'pointer-events-auto flex w-9 shrink-0 items-center justify-center rounded-r-xl bg-white/90 py-5 shadow-md backdrop-blur-sm transition-all hover:bg-white active:scale-95'
  const btnRight =
    'pointer-events-auto flex w-9 shrink-0 items-center justify-center rounded-l-xl bg-white/90 py-5 shadow-md backdrop-blur-sm transition-all hover:bg-white active:scale-95'
  const btnDisabled = 'pointer-events-none cursor-not-allowed opacity-25'

  return (
    <>
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => {
          if (!hasPrev) return
          onPrev()
        }}
        className={`absolute left-0 top-1/2 z-40 -translate-y-1/2 ${btnBase} ${
          !hasPrev ? btnDisabled : 'cursor-pointer text-indigo-700'
        }`}
        style={{ paddingLeft: 'max(0px, env(safe-area-inset-left))' }}
        aria-label="上一题"
      >
        <VerticalNavLabel>‹上一题</VerticalNavLabel>
      </button>

      <button
        type="button"
        disabled={!hasNext}
        onClick={() => {
          if (!hasNext) return
          onNext()
        }}
        className={`absolute right-0 top-1/2 z-40 -translate-y-1/2 ${btnRight} ${
          !hasNext ? btnDisabled : 'cursor-pointer text-indigo-700'
        }`}
        style={{ paddingRight: 'max(0px, env(safe-area-inset-right))' }}
        aria-label="下一题"
      >
        <VerticalNavLabel>下一题›</VerticalNavLabel>
      </button>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
        {positionLabel}
      </div>
    </>
  )
}
