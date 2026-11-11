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
      className="text-[12px] leading-none font-bold tracking-[0.2em] select-none"
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
    'pointer-events-auto flex w-9 shrink-0 items-center justify-center rounded-r-xl bg-white py-5 shadow-sticker transition-all hover:bg-white active:scale-95'
  const btnRight =
    'pointer-events-auto flex w-9 shrink-0 items-center justify-center rounded-l-xl bg-white py-5 shadow-sticker transition-all hover:bg-white active:scale-95'
  const btnDisabled = 'pointer-events-none cursor-not-allowed opacity-25'

  return (
    <>
      {/* native-ok: 画布左缘贴边的竖排文字导航，绝对定位 + 竖排书写，Radix Button 无法承载 */}
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => {
          if (!hasPrev) return
          onPrev()
        }}
        className={`absolute top-1/2 left-0 z-40 -translate-y-1/2 ${btnBase} ${
          !hasPrev ? btnDisabled : 'cursor-pointer text-indigo-700'
        }`}
        style={{ paddingLeft: 'max(0px, env(safe-area-inset-left))' }}
        aria-label="上一题"
      >
        <VerticalNavLabel>‹上一题</VerticalNavLabel>
      </button>

      {/* native-ok: 画布右缘贴边的竖排文字导航，绝对定位 + 竖排书写，Radix Button 无法承载 */}
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => {
          if (!hasNext) return
          onNext()
        }}
        className={`absolute top-1/2 right-0 z-40 -translate-y-1/2 ${btnRight} ${
          !hasNext ? btnDisabled : 'cursor-pointer text-indigo-700'
        }`}
        style={{ paddingRight: 'max(0px, env(safe-area-inset-right))' }}
        aria-label="下一题"
      >
        <VerticalNavLabel>下一题›</VerticalNavLabel>
      </button>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90">
        {positionLabel}
      </div>
    </>
  )
}
