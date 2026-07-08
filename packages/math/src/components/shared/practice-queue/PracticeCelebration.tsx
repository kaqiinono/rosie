'use client'

import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'

type Props = {
  total: number
  sessionCorrect: number
  title: string
  returnHref: string
  onExit: () => void
  onRestart: () => void
}

export default function PracticeCelebration({
  total,
  sessionCorrect,
  title,
  returnHref,
  onExit,
  onRestart,
}: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 text-6xl">🎉</div>
      <h2 className="mb-2 text-2xl font-extrabold text-text-primary">全部完成！</h2>
      <p className="mb-1 text-sm text-text-secondary">
        {title} · 共 {total} 题
      </p>
      <p className="mb-8 text-sm font-semibold text-app-blue">
        本次做对 {sessionCorrect} 题
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer rounded-full bg-app-blue px-6 py-2.5 text-sm font-bold text-white shadow-md transition-transform active:scale-95"
        >
          返回
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="cursor-pointer rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-text-secondary transition-transform active:scale-95"
        >
          再练一遍
        </button>
      </div>
      <p className="mt-4 text-[11px] text-text-muted">返回至 {returnHref}</p>
    </div>
  )
}

export type { PracticeQueueItem }
