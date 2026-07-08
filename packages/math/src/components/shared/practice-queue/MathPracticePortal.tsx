'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import type { PracticeQueueItem, PracticeQueuePhase } from '@rosie/math/utils/practice-queue-types'
import PracticeProblemBody from './PracticeProblemBody'
import PracticeCelebration from './PracticeCelebration'
import PracticeViewDraftButton from './PracticeViewDraftButton'
import ScratchPadSession from '@rosie/math/components/shared/ScratchPad/ScratchPadSession'

type Props = {
  items: PracticeQueueItem[]
  currentIndex: number
  phase: PracticeQueuePhase
  sessionCorrect: number
  immersive: boolean
  title: string
  returnHref: string
  onExit: () => void
  onAnswerCorrect: () => void
  onAnswerWrong: () => void
  onRestart: () => void
  onToggleImmersive: () => void
  onSetImmersive: (value: boolean) => void
}

export default function MathPracticePortal({
  items,
  currentIndex,
  phase,
  sessionCorrect,
  immersive,
  title,
  returnHref,
  onExit,
  onAnswerCorrect,
  onAnswerWrong,
  onRestart,
  onToggleImmersive,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const current = items[currentIndex]
  const total = items.length
  const progressPct = total > 0 ? Math.min(100, ((currentIndex + 1) / total) * 100) : 0
  const [draftRefreshKey, setDraftRefreshKey] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const bumpDraftRefresh = useCallback(() => {
    setDraftRefreshKey((k) => k + 1)
  }, [])

  const handleWrong = useCallback(() => {
    onAnswerWrong()
    bumpDraftRefresh()
  }, [onAnswerWrong, bumpDraftRefresh])

  const handleCorrect = useCallback(() => {
    void Promise.resolve(onAnswerCorrect()).then(() => bumpDraftRefresh())
  }, [onAnswerCorrect, bumpDraftRefresh])

  const shell = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#f8fafc]">
      <header
        className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            title="退出练习"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 transition-all hover:bg-slate-100 active:scale-95"
          >
            ✕
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-extrabold text-text-primary">{title}</div>
            {phase === 'answering' && total > 0 && (
              <div className="text-[11px] font-medium text-text-muted">
                第 {currentIndex + 1} / {total} 题 · 已对 {sessionCorrect} 题
              </div>
            )}
          </div>
          {phase === 'answering' && current && (
            <PracticeViewDraftButton problem={current.problem} refreshKey={draftRefreshKey} />
          )}
          <button
            type="button"
            onClick={onToggleImmersive}
            className={clsx(
              'shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95',
              immersive
                ? 'border-indigo-300 bg-indigo-100 text-indigo-800'
                : 'border-slate-200 bg-slate-50 text-slate-600',
            )}
            title="沉浸式草稿纸答题"
          >
            {immersive ? '📝 沉浸' : '📄 详情'}
          </button>
        </div>
        {phase === 'answering' && total > 0 && (
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-app-blue transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden">
        {phase === 'celebration' ? (
          <PracticeCelebration
            total={total}
            sessionCorrect={sessionCorrect}
            title={title}
            returnHref={returnHref}
            onExit={onExit}
            onRestart={onRestart}
          />
        ) : immersive && current ? (
          <ScratchPadSession
            key={`immersive-${current.problem.id}`}
            items={items.map((it) => ({ problem: it.problem, section: it.section }))}
            controlledIndex={currentIndex}
            mode="practice"
            blankCanvasOnLoad
            disableEdgeNav
            embedded
            closeEndsSession
            onAnswerCorrect={handleCorrect}
            onWrong={handleWrong}
            onClose={() => {
              bumpDraftRefresh()
              onExit()
            }}
          />
        ) : current ? (
          <div className="h-full overflow-y-auto px-4 py-5">
            <div className="mx-auto max-w-[700px]">
              <PracticeProblemBody
                key={current.problem.id}
                item={current}
                onAnswerCorrect={handleCorrect}
                onAnswerWrong={handleWrong}
              />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )

  if (!mounted) return null
  return createPortal(shell, document.body)
}
