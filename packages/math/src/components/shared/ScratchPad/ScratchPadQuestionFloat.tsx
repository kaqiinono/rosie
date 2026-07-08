'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import ProblemFigureImage from '@rosie/math/components/shared/ProblemFigureImage'
import { useProblemImageUrl } from '@rosie/math/hooks/useProblemImageUrl'
import {
  getProblemAnswerMode,
  hasScratchExportableVisual,
} from '@rosie/math/utils/problem-answer-mode'
import ScratchPadInsertFigureButton from './ScratchPadInsertFigureButton'
import ScratchPadAnswerPanel from './ScratchPadAnswerPanel'
import PracticeAttemptTimeline from './PracticeAttemptTimeline'

type ScratchPadQuestionFloatProps = {
  problem: Problem
  onInsertFigure?: (src: string, naturalW: number, naturalH: number) => void
  expandedDefault?: boolean
  mistakeHint?: string
  section?: string
  attemptRefreshKey?: number
  showAnswerPanel?: boolean
  answerMode?: 'practice' | 'quiz'
  initialAnswer?: unknown
  onAnswerDraftChange?: (snapshot: unknown) => void
  onSubmitResult?: (correct: boolean, snapshot: unknown) => void
}

export default function ScratchPadQuestionFloat({
  problem,
  onInsertFigure,
  expandedDefault = false,
  mistakeHint,
  section = '',
  attemptRefreshKey = 0,
  showAnswerPanel = true,
  answerMode = 'practice',
  initialAnswer,
  onAnswerDraftChange,
  onSubmitResult,
}: ScratchPadQuestionFloatProps) {
  const [expanded, setExpanded] = useState(expandedDefault)
  const figureHostRef = useRef<HTMLDivElement>(null)
  const answerExportRef = useRef<HTMLDivElement>(null)
  const [padSlotEl, setPadSlotEl] = useState<HTMLDivElement | null>(null)
  const figureUrl = useProblemImageUrl(problem, 'figure')
  const hasQuestionFigure = Boolean(figureUrl || problem.figureNode)
  const showPadFooter =
    showAnswerPanel &&
    getProblemAnswerMode(problem) === 'custom-widget' &&
    Boolean(problem.verticalPuzzle && !problem.verticalPuzzle.readonly)
  const canInsertToCanvas = Boolean(onInsertFigure && hasScratchExportableVisual(problem))

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="absolute left-3 top-3 z-20 flex max-w-[min(72vw,280px)] cursor-pointer items-center gap-2 rounded-2xl border border-white/60 bg-white/85 px-3 py-2 text-left shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-md transition-transform active:scale-[0.98]"
        style={{ top: 'max(12px, env(safe-area-inset-top))' }}
      >
        <span className="text-base leading-none">📋</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-700">{problem.title}</span>
        <span className="shrink-0 text-[11px] font-medium text-indigo-500">展开</span>
      </button>
    )
  }

  return (
    <div
      className={`absolute z-20 flex max-h-[min(70vh,540px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/92 shadow-[0_12px_40px_rgba(15,23,42,0.16)] backdrop-blur-md ${
        expandedDefault && !onInsertFigure ? 'relative left-auto top-auto mx-auto' : 'left-3'
      }`}
      style={onInsertFigure ? { top: 'max(12px, env(safe-area-inset-top))' } : undefined}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
        <span className="text-base">📋</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-slate-800">{problem.title}</div>
          {mistakeHint && (
            <div className="truncate text-[10px] font-medium text-rose-500">{mistakeHint}</div>
          )}
        </div>
        {canInsertToCanvas && (
          <ScratchPadInsertFigureButton
            problem={problem}
            onInsertFigure={onInsertFigure!}
            figureHostRef={figureHostRef}
            answerExportRef={answerExportRef}
            header
          />
        )}
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="shrink-0 cursor-pointer rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-200"
        >
          收起
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {showPadFooter && (
          <div
            ref={setPadSlotEl}
            className="order-2 shrink-0 border-t border-slate-100 bg-white/95 px-3 py-2 backdrop-blur-sm"
          />
        )}
        <div className="order-1 min-h-0 flex-1 overflow-x-auto overflow-y-auto px-3.5 py-3">
          <div
            className="text-[14px] leading-relaxed text-slate-600 [&>strong]:font-bold [&>strong]:text-slate-800"
            dangerouslySetInnerHTML={{ __html: problem.text }}
          />
          {hasQuestionFigure && (
            <div ref={figureHostRef} className="mt-3">
              <ProblemFigureImage problem={problem} />
            </div>
          )}
          {showAnswerPanel && onAnswerDraftChange && (
            <ScratchPadAnswerPanel
              problem={problem}
              mode={answerMode}
              initialAnswer={initialAnswer}
              onAnswerDraftChange={onAnswerDraftChange}
              onSubmitResult={onSubmitResult}
              exportHostRef={answerExportRef}
              padSlot={showPadFooter ? padSlotEl : undefined}
            />
          )}
          {answerMode === 'practice' && (
            <PracticeAttemptTimeline
              problemId={problem.id}
              refreshKey={attemptRefreshKey}
            />
          )}
        </div>
      </div>
    </div>
  )
}
