'use client'

import { useState } from 'react'

type ScratchPadEdgeNavProps = {
  hasPrev: boolean
  hasNext: boolean
  positionLabel: string
  onPrev: () => void
  onNext: () => void
}

export default function ScratchPadEdgeNav({
  hasPrev,
  hasNext,
  positionLabel,
  onPrev,
  onNext,
}: ScratchPadEdgeNavProps) {
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  return (
    <>
      {/* Left */}
      <div
        className="absolute left-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-start"
        onMouseEnter={() => setLeftOpen(true)}
        onMouseLeave={() => setLeftOpen(false)}
      >
        <button
          type="button"
          disabled={!hasPrev}
          onClick={() => {
            if (!hasPrev) return
            onPrev()
            setLeftOpen(false)
          }}
          className={`flex items-center transition-all ${
            leftOpen && hasPrev
              ? 'translate-x-0 rounded-r-2xl bg-white/95 py-3 pl-2 pr-4 shadow-lg backdrop-blur-md'
              : 'h-16 w-3 rounded-r-full bg-indigo-200/50'
          } ${!hasPrev ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
          aria-label="上一题"
        >
          {leftOpen && hasPrev ? (
            <span className="text-[13px] font-bold text-indigo-700">‹ 上一题</span>
          ) : (
            <span className="sr-only">上一题</span>
          )}
        </button>
      </div>

      {/* Right */}
      <div
        className="absolute right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-end"
        onMouseEnter={() => setRightOpen(true)}
        onMouseLeave={() => setRightOpen(false)}
      >
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => {
            if (!hasNext) return
            onNext()
            setRightOpen(false)
          }}
          className={`flex items-center transition-all ${
            rightOpen && hasNext
              ? 'translate-x-0 rounded-l-2xl bg-white/95 py-3 pl-4 pr-2 shadow-lg backdrop-blur-md'
              : 'h-16 w-3 rounded-l-full bg-indigo-200/50'
          } ${!hasNext ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
          aria-label="下一题"
        >
          {rightOpen && hasNext ? (
            <span className="text-[13px] font-bold text-indigo-700">下一题 ›</span>
          ) : (
            <span className="sr-only">下一题</span>
          )}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
        {positionLabel}
      </div>
    </>
  )
}
