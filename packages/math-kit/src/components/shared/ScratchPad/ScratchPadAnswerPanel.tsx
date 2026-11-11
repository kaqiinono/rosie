'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import { Button } from '@rosie/ui/themes'
import { checkProblemAnswer } from '@rosie/math-kit/utils/check-problem-answer'
import {
  getProblemAnswerMode,
  isCustomAnswerWidget,
} from '@rosie/math-kit/utils/problem-answer-mode'
import VerticalDigitPuzzlePanel from '@rosie/math-kit/components/shared/VerticalDigitPuzzlePanel'
import NumericAnswerPanel from '@rosie/math-kit/components/shared/NumericAnswerPanel'
import ScratchPadCustomAnswerWidget from './ScratchPadCustomAnswerWidget'

type ScratchPadAnswerPanelProps = {
  problem: Problem
  mode: 'practice' | 'quiz'
  initialAnswer?: unknown
  onAnswerDraftChange: (snapshot: unknown) => void
  onSubmitResult?: (correct: boolean, snapshot: unknown) => void | Promise<void>
  /** @deprecated 按钮外观由 Radix Button 统一提供，该参数不再生效，仅为兼容调用方保留。 */
  buttonClassName?: string
  /** 答题区导出容器（由浮层顶栏「加入画布」使用） */
  exportHostRef?: RefObject<HTMLDivElement | null>
  /** 竖式键盘固定底栏槽位；`undefined` 表示键盘跟网格内联 */
  padSlot?: HTMLElement | null
}

export default function ScratchPadAnswerPanel({
  problem,
  mode,
  initialAnswer,
  onAnswerDraftChange,
  onSubmitResult,
  buttonClassName,
  exportHostRef: exportHostRefProp,
  padSlot,
}: ScratchPadAnswerPanelProps) {
  const answerMode = getProblemAnswerMode(problem)
  const internalExportRef = useRef<HTMLDivElement>(null)
  const exportHostRef = exportHostRefProp ?? internalExportRef
  const [answer, setAnswer] = useState('')
  const [interactiveState, setInteractiveState] = useState<unknown>(undefined)
  const [interactiveTouched, setInteractiveTouched] = useState(false)
  const [feedback, setFeedback] = useState<AnswerCheckResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setFeedback(null)
    if (isCustomAnswerWidget(problem)) {
      setInteractiveState(initialAnswer)
      setInteractiveTouched(initialAnswer != null && initialAnswer !== undefined)
    } else if (typeof initialAnswer === 'string' || typeof initialAnswer === 'number') {
      setAnswer(String(initialAnswer))
    } else {
      setAnswer('')
    }
  }, [problem.id, initialAnswer, problem])

  const recordInteractive = useCallback(
    (state: unknown) => {
      setInteractiveState(state)
      setInteractiveTouched(true)
      onAnswerDraftChange(state)
    },
    [onAnswerDraftChange],
  )

  const runCheck = useCallback(
    async (input: unknown) => {
      if (mode === 'quiz' || submitting) return
      const result = checkProblemAnswer(problem, input)
      if (!result.message && !result.ok) return
      if (!onSubmitResult) {
        setFeedback(result)
        return
      }
      setSubmitting(true)
      setFeedback(null)
      try {
        await onSubmitResult(result.ok, input)
        setFeedback(result)
      } catch {
        setFeedback({ ok: false, message: '记录失败，请稍后重试' })
      } finally {
        setSubmitting(false)
      }
    },
    [mode, problem, onSubmitResult, submitting],
  )

  const handleCheck = useCallback(() => {
    runCheck(isCustomAnswerWidget(problem) ? interactiveState : answer)
  }, [runCheck, problem, interactiveState, answer])

  const handleWidgetSubmit = useCallback(
    (state: unknown) => {
      recordInteractive(state)
      runCheck(state)
    },
    [recordInteractive, runCheck],
  )

  useEffect(() => {
    if (answerMode === 'numeric') {
      onAnswerDraftChange(answer)
    }
  }, [answer, answerMode, onAnswerDraftChange])

  if (answerMode === 'custom-widget') {
    const hasBuiltInCheck = Boolean(problem.verticalPuzzle)
    return (
      <div className="border-kid-line mt-3 border-t pt-3">
        <div className="mb-2 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
          作答
        </div>
        <div
          className={
            mode === 'quiz'
              ? undefined
              : 'border-kid-line overflow-x-auto rounded-lg border-2 bg-slate-50/60 p-2'
          }
        >
          <ScratchPadCustomAnswerWidget
            problem={problem}
            initialState={interactiveState ?? initialAnswer}
            feedback={mode === 'practice' ? feedback : null}
            exportHostRef={exportHostRef}
            padSlot={padSlot}
            onStateChange={recordInteractive}
            onSubmit={handleWidgetSubmit}
          />
        </div>
        {mode === 'practice' && !hasBuiltInCheck && (
          <Button
            type="button"
            size="2"
            radius="full"
            variant="solid"
            color="indigo"
            className="mt-2 w-full"
            loading={submitting}
            onClick={handleCheck}
            disabled={!interactiveTouched || submitting}
          >
            {submitting ? '记录中…' : '检查答案'}
          </Button>
        )}
        {mode === 'quiz' && interactiveTouched && (
          <p className="mt-2 text-[11px] font-medium text-indigo-600">已记录作答，交卷后批阅</p>
        )}
        {feedback?.message && !problem.verticalPuzzle && (
          <p className={`mt-2 text-[12px] ${feedback.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {feedback.message}
          </p>
        )}
      </div>
    )
  }

  if (answerMode === 'readonly-puzzle-numeric') {
    const puzzle = problem.verticalPuzzle!
    return (
      <div className="border-kid-line mt-3 border-t pt-3">
        <div className="mb-2 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
          竖式
        </div>
        <VerticalDigitPuzzlePanel
          spec={puzzle}
          embedded
          exportGridRef={exportHostRef}
          onSubmit={() => {}}
        />
        <NumericAnswerPanel
          problem={problem}
          answer={answer}
          onAnswerChange={setAnswer}
          onCheck={mode === 'practice' ? handleCheck : () => {}}
          feedback={mode === 'practice' ? feedback : null}
          buttonClassName={buttonClassName}
        />
        {mode === 'quiz' && answer.trim() !== '' && (
          <p className="mt-1 text-[11px] font-medium text-indigo-600">已记录作答，交卷后批阅</p>
        )}
      </div>
    )
  }

  return (
    <div className="border-kid-line mt-3 border-t pt-3">
      <NumericAnswerPanel
        problem={problem}
        answer={answer}
        onAnswerChange={setAnswer}
        onCheck={mode === 'practice' ? handleCheck : () => {}}
        feedback={mode === 'practice' ? feedback : null}
        buttonClassName={buttonClassName}
      />
      {mode === 'quiz' && answer.trim() !== '' && (
        <p className="mt-1 text-[11px] font-medium text-indigo-600">已记录作答，交卷后批阅</p>
      )}
    </div>
  )
}
