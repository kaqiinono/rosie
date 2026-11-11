'use client'

import { useRef, useState } from 'react'
import type { Problem } from '@rosie/core'
import ProblemFigureImage from '@rosie/math-kit/components/shared/ProblemFigureImage'
import { useProblemImageUrl } from '@rosie/math-kit/hooks/useProblemImageUrl'
import {
  getProblemAnswerMode,
  hasScratchExportableVisual,
} from '@rosie/math-kit/utils/problem-answer-mode'
import { sanitizeProblemText } from '@rosie/math-kit/utils/sanitize-problem-text'
import ScratchPadInsertFigureButton from './ScratchPadInsertFigureButton'
import ScratchPadAnswerPanel from './ScratchPadAnswerPanel'
import PracticeAttemptTimeline from './PracticeAttemptTimeline'
import { Button } from '@rosie/ui/themes'

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
  onSubmitResult?: (correct: boolean, snapshot: unknown) => void | Promise<void>
}

export default function ScratchPadQuestionFloat({
  problem,
  onInsertFigure,
  expandedDefault = false,
  mistakeHint,
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
      // native-ok: 画布左上角的题目悬浮胶囊，多段内容（图标 + 截断标题 + 展开提示）绝对定位，Radix Button 会挤压截断
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="shadow-sticker absolute top-3 left-3 z-20 flex max-w-[min(72vw,280px)] cursor-pointer items-center gap-2 rounded-2xl border border-white/60 bg-white px-3 py-2 text-left transition-transform active:scale-[0.98]"
        style={{ top: 'max(12px, env(safe-area-inset-top))' }}
      >
        <span className="text-base leading-none">📋</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-700">
          {problem.title}
        </span>
        <span className="shrink-0 text-[11px] font-medium text-indigo-500">展开</span>
      </button>
    )
  }

  return (
    <div
      className={`shadow-sticker absolute z-20 flex max-h-[min(70vh,540px)] w-[min(92vw,420px)] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white ${
        expandedDefault && !onInsertFigure ? 'relative top-auto left-auto mx-auto' : 'left-3'
      }`}
      style={onInsertFigure ? { top: 'max(12px, env(safe-area-inset-top))' } : undefined}
    >
      <div className="border-kid-line flex shrink-0 items-center gap-2 border-b px-3.5 py-2.5">
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
        <Button
          type="button"
          onClick={() => setExpanded(false)}
          variant="soft"
          color="gray"
          size="1"
          className="shrink-0"
        >
          收起
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {showPadFooter && (
          <div
            ref={setPadSlotEl}
            className="border-kid-line order-2 shrink-0 border-t bg-white px-3 py-2"
          />
        )}
        <div className="order-1 min-h-0 flex-1 overflow-x-auto overflow-y-auto px-3.5 py-3">
          <div
            className="text-[14px] leading-relaxed text-slate-600 [&>strong]:font-bold [&>strong]:text-slate-800"
            dangerouslySetInnerHTML={{ __html: sanitizeProblemText(problem.text) }}
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
            <PracticeAttemptTimeline problemId={problem.id} refreshKey={attemptRefreshKey} />
          )}
        </div>
      </div>
    </div>
  )
}
