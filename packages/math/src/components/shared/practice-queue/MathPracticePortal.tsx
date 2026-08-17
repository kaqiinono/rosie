'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PracticeQueueItem, PracticeQueuePhase } from '@rosie/math-kit/utils/practice-queue-types'
import type { PracticeQueueStartOpts } from '@rosie/math-kit/utils/practice-queue-types'
import {
  MATH_SKIP_REASON_OPTIONS,
  type MathSkipReason,
} from '@rosie/math-kit/utils/math-skip-reasons'
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
  onSkip: (reason: MathSkipReason, note?: string) => void
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
  onSkip,
  onRestart,
  onToggleImmersive,
  onSetImmersive,
  checkRemaining,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const current = items[currentIndex]
  const total = items.length
  const progressPct = total > 0 ? Math.min(100, ((currentIndex + 1) / total) * 100) : 0
  const [skipMenuOpen, setSkipMenuOpen] = useState(false)
  const [otherNote, setOtherNote] = useState('')
  const [showOtherInput, setShowOtherInput] = useState(false)
  const skipMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setSkipMenuOpen(false)
    setShowOtherInput(false)
    setOtherNote('')
  }, [currentIndex])

  useEffect(() => {
    if (!skipMenuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (skipMenuRef.current && !skipMenuRef.current.contains(e.target as Node)) {
        setSkipMenuOpen(false)
        setShowOtherInput(false)
        setOtherNote('')
      }
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [skipMenuOpen])

  const handleWrong = useCallback(() => {
    onAnswerWrong()
  }, [onAnswerWrong])

  const handleCorrect = useCallback(() => {
    void Promise.resolve(onAnswerCorrect())
  }, [onAnswerCorrect])

  const handleAdvance = useCallback(() => {
    onAdvance()
  }, [onAdvance])

  const commitSkip = useCallback(
    (reason: MathSkipReason, note?: string) => {
      onSkip(reason, note)
      setSkipMenuOpen(false)
      setShowOtherInput(false)
      setOtherNote('')
    },
    [onSkip],
  )

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
              <div className="relative" ref={skipMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setSkipMenuOpen((o) => !o)
                    setShowOtherInput(false)
                    setOtherNote('')
                  }}
                  title="跳过当前题并选择原因"
                  className="shrink-0 cursor-pointer rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800 transition-all hover:bg-amber-100 active:scale-95"
                >
                  ⏭ 跳过
                </button>
                {skipMenuOpen && (
                  <div
                    className="absolute top-full right-0 z-30 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                    style={{ minWidth: 200 }}
                  >
                    <div className="mb-1.5 px-1 text-[10px] font-bold text-slate-400">
                      选择跳过原因
                    </div>
                    {!showOtherInput ? (
                      <div className="flex flex-col gap-1">
                        {MATH_SKIP_REASON_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              if (opt.key === 'other') {
                                setShowOtherInput(true)
                                return
                              }
                              commitSkip(opt.key)
                            }}
                            className="cursor-pointer rounded-lg px-2.5 py-2 text-left text-[12px] font-bold text-slate-700 transition-colors hover:bg-amber-50"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2 px-0.5">
                        <input
                          type="text"
                          value={otherNote}
                          onChange={(e) => setOtherNote(e.target.value)}
                          placeholder="简单说明（选填）"
                          maxLength={80}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12px] outline-none focus:border-amber-300"
                          autoFocus
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setShowOtherInput(false)
                              setOtherNote('')
                            }}
                            className="flex-1 cursor-pointer rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-500"
                          >
                            返回
                          </button>
                          <button
                            type="button"
                            onClick={() => commitSkip('other', otherNote)}
                            className="flex-1 cursor-pointer rounded-lg bg-amber-500 px-2 py-1.5 text-[11px] font-extrabold text-white"
                          >
                            确认跳过
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
            key={`immersive-${current.problem.id}`}
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
                key={current.problem.id}
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
