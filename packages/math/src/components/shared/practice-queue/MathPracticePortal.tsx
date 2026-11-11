'use client'

import { useCallback, useState } from 'react'
import { useHydrated } from '@rosie/core'
import { createPortal } from 'react-dom'
import type {
  PracticeQueueItem,
  PracticeQueuePhase,
} from '@rosie/math-kit/utils/practice-queue-types'
import type { PracticeQueueStartOpts } from '@rosie/math-kit/utils/practice-queue-types'
import type { DeferCurrentResult } from '@rosie/math-kit/components/shared/practice-queue/practice-queue-context'
import PracticeProblemBody from './PracticeProblemBody'
import PracticeCelebration from '@rosie/math-kit/components/shared/practice-queue/PracticeCelebration'
import ScratchPadSession from '@rosie/math-kit/components/shared/ScratchPad/ScratchPadSession'
import { Button, IconButton } from '@rosie/ui/themes'

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
  const mounted = useHydrated()
  const current = items[currentIndex]
  const currentIdentity = current
    ? (current.planAssignment?.assignmentId ?? current.problem.id)
    : 'none'
  const total = items.length
  const progressPct = total > 0 ? Math.min(100, ((currentIndex + 1) / total) * 100) : 0
  const [deferMessage, setDeferMessage] = useState<string | null>(null)

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
    setDeferMessage(result === 'moved' ? '已移到本次练习队尾' : '其他题已完成，请继续完成这道题')
    window.setTimeout(() => setDeferMessage(null), 2200)
  }, [onDeferCurrent])

  const shell = (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#f8fafc]">
      <header
        className="border-kid-line relative z-20 flex shrink-0 flex-col gap-2 border-b bg-white px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          <IconButton
            type="button"
            onClick={onExit}
            title="退出练习"
            variant="soft"
            color="gray"
            size="3"
            className="w-9 shrink-0"
          >
            ✕
          </IconButton>
          {phase === 'answering' && onStash && (
            <Button
              type="button"
              onClick={onStash}
              title="暂存进度并返回"
              variant="soft"
              color="amber"
              size="1"
              className="shrink-0"
            >
              💾 暂存
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-text-primary truncate text-[14px] font-extrabold">{title}</div>
            {phase === 'answering' && total > 0 && (
              <div className="text-text-muted text-[11px] font-medium">
                第 {currentIndex + 1} / {total} 题 · 已对 {sessionCorrect} 题
              </div>
            )}
          </div>
          {phase === 'answering' && current && (
            <>
              <Button
                type="button"
                onClick={deferCurrent}
                title="移到本次练习队尾"
                variant="soft"
                color="amber"
                size="1"
                className="shrink-0"
              >
                ⏭ 稍后再做
              </Button>
              {immersive && (
                <Button
                  type="button"
                  onClick={onToggleImmersive}
                  title="返回详情答题"
                  variant="soft"
                  color="gray"
                  size="1"
                  className="shrink-0"
                >
                  📄 详情
                </Button>
              )}
            </>
          )}
        </div>
        {phase === 'answering' && total > 0 && (
          <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="bg-app-blue absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}
      </header>

      {deferMessage && (
        <div className="shadow-sticker pointer-events-none fixed top-20 left-1/2 z-[230] -translate-x-1/2 rounded-full bg-amber-800 px-4 py-2 text-[12px] font-bold text-white">
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
