'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PracticeQueueItem, PracticeQueuePhase } from '@rosie/math-kit/utils/practice-queue-types'
import type { PracticeQueueStartOpts } from '@rosie/math-kit/utils/practice-queue-types'
import type { DeferCurrentResult } from '@rosie/math-kit/components/shared/practice-queue/practice-queue-context'
import PracticeProblemBody from './PracticeProblemBody'
import PracticeCelebration from '@rosie/math-kit/components/shared/practice-queue/PracticeCelebration'
import ScratchPadSession from '@rosie/math-kit/components/shared/ScratchPad/ScratchPadSession'

type Props = {
  items: PracticeQueueItem[]
  currentIndex: number
  phase: PracticeQueuePhase
  sessionCorrect: number
  immersive: boolean
  title: string
  returnHref: string
  onExit: () => void
  onStash?: () => void
  onAnswerCorrect: () => void
  onAnswerWrong: () => void
  onAdvance: () => void
  onDeferCurrent: () => DeferCurrentResult
  onRestart: () => void
  onToggleImmersive: () => void
  onSetImmersive: (value: boolean) => void
  checkRemaining?: PracticeQueueStartOpts['checkRemaining']
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
  onStash,
  onAnswerCorrect,
  onAnswerWrong,
  onAdvance,
  onDeferCurrent,
  onRestart,
  onToggleImmersive,
  onSetImmersive,
  checkRemaining,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const current = items[currentIndex]
  const currentIdentity = current
    ? current.planAssignment?.assignmentId ?? current.problem.id
    : 'none'
  const total = items.length
  const progressPct = total > 0 ? Math.min(100, ((currentIndex + 1) / total) * 100) : 0
  const [deferMessage, setDeferMessage] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleWrong = useCallback(() => {
    onAnswerWrong()
  }, [onAnswerWrong])

  const handleCorrect = useCallback(() => {
    void Promise.resolve(onAnswerCorrect())
  }, [onAnswerCorrect])

  const handleAdvance = useCallback(() => {
    onAdvance()
  }, [onAdvance])

  const deferCurrent = useCallback(() => {
    const result = onDeferCurrent()
    setDeferMessage(
      result === 'moved'
        ? '已移到本次练习队尾'
        : '其他题已完成，请继续完成这道题',
    )
    window.setTimeout(() => setDeferMessage(null), 2200)
  }, [onDeferCurrent])

  const shell = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#f8fafc]">
      <header
        className="relative z-20 flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md"
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
          {phase === 'answering' && onStash && (
            <button
              type="button"
              onClick={onStash}
              title="暂存进度并返回"
              className="shrink-0 cursor-pointer rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 transition-all hover:bg-amber-100 active:scale-95"
            >
              💾 暂存
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-extrabold text-text-primary">{title}</div>
            {phase === 'answering' && total > 0 && (
              <div className="text-[11px] font-medium text-text-muted">
                第 {currentIndex + 1} / {total} 题 · 已对 {sessionCorrect} 题
              </div>
            )}
          </div>
          {phase === 'answering' && current && (
            <>
              <button
                type="button"
                onClick={deferCurrent}
                title="移到本次练习队尾"
                className="shrink-0 cursor-pointer rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 transition-all hover:bg-amber-100 active:scale-95"
              >
                ⏭ 稍后再做
              </button>
              {immersive && (
                <button
                  type="button"
                  onClick={onToggleImmersive}
                  className="shrink-0 cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 transition-all active:scale-95"
                  title="返回详情答题"
                >
                  📄 详情
                </button>
              )}
            </>
          )}
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

      {deferMessage && (
        <div className="pointer-events-none fixed top-20 left-1/2 z-[230] -translate-x-1/2 rounded-full bg-amber-800 px-4 py-2 text-[12px] font-bold text-white shadow-lg">
          {deferMessage}
        </div>
      )}

      <main className="relative min-h-0 flex-1 overflow-hidden">
        {phase === 'celebration' ? (
          <PracticeCelebration
            total={total}
            sessionCorrect={sessionCorrect}
            title={title}
            returnHref={returnHref}
            onExit={onExit}
            onRestart={onRestart}
            checkRemaining={checkRemaining}
          />
        ) : immersive && current ? (
          <ScratchPadSession
            key={`immersive-${currentIdentity}`}
            items={items.map((it) => ({ problem: it.problem, section: it.section }))}
            controlledIndex={currentIndex}
            mode="practice"
            disableEdgeNav
            embedded
            onAnswerCorrect={handleCorrect}
            onWrong={handleWrong}
            onClose={() => {
              // 「完成」只退出沉浸画板并落库，回到详情答题；退出整场练习用顶栏 ✕ / 暂存
              onSetImmersive(false)
            }}
          />
        ) : current ? (
          <div className="h-full overflow-y-auto px-4 py-5">
            <div className="mx-auto max-w-[700px]">
              <PracticeProblemBody
                key={currentIdentity}
                item={current}
                onAnswerCorrect={handleCorrect}
                onAnswerWrong={handleWrong}
                onAdvance={handleAdvance}
                onOpenScratch={() => onSetImmersive(true)}
                isLast={currentIndex >= total - 1}
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
