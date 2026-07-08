'use client'

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
  const btnBase =
    'pointer-events-auto flex min-h-[64px] min-w-[44px] items-center justify-center rounded-2xl bg-white/95 px-3 py-3 text-[13px] font-bold text-indigo-700 shadow-lg backdrop-blur-md transition-transform active:scale-95'
  const btnDisabled = 'pointer-events-none cursor-not-allowed opacity-30'

  return (
    <>
      <button
        type="button"
        disabled={!hasPrev}
        onClick={() => {
          if (!hasPrev) return
          onPrev()
        }}
        className={`absolute left-0 top-1/2 z-40 -translate-y-1/2 rounded-l-none rounded-r-2xl ${btnBase} ${
          !hasPrev ? btnDisabled : 'cursor-pointer'
        }`}
        aria-label="上一题"
      >
        ‹ 上一题
      </button>

      <button
        type="button"
        disabled={!hasNext}
        onClick={() => {
          if (!hasNext) return
          onNext()
        }}
        className={`absolute right-0 top-1/2 z-40 -translate-y-1/2 rounded-l-2xl rounded-r-none ${btnBase} ${
          !hasNext ? btnDisabled : 'cursor-pointer'
        }`}
        aria-label="下一题"
      >
        下一题 ›
      </button>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
        {positionLabel}
      </div>
    </>
  )
}
