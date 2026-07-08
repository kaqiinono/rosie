'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import { checkProblemAnswer } from '@rosie/math/utils/check-problem-answer'
import {
  getProblemAnswerMode,
  isCustomAnswerWidget,
} from '@rosie/math/utils/problem-answer-mode'
import VerticalDigitPuzzlePanel from '@rosie/math/components/shared/VerticalDigitPuzzlePanel'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import ScratchPadCustomAnswerWidget from './ScratchPadCustomAnswerWidget'

type ScratchPadAnswerPanelProps = {
  problem: Problem
  mode: 'practice' | 'quiz'
  initialAnswer?: unknown
  onAnswerDraftChange: (snapshot: unknown) => void
  onSubmitResult?: (correct: boolean, snapshot: unknown) => void
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
  buttonClassName = 'bg-indigo-600 shadow-[0_3px_10px_rgba(79,70,229,0.3)]',
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
    (input: unknown) => {
      if (mode === 'quiz') return
      const result = checkProblemAnswer(problem, input)
      if (!result.message && !result.ok) return
      setFeedback(result)
      onSubmitResult?.(result.ok, input)
    },
    [mode, problem, onSubmitResult],
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
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">作答</div>
        <div className={mode === 'quiz' ? undefined : 'overflow-x-auto rounded-lg border border-slate-100 bg-slate-50/60 p-2'}>
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
          <button
            type="button"
            onClick={handleCheck}
            disabled={!interactiveTouched}
            className={`mt-2 w-full cursor-pointer rounded-full px-4 py-2 text-[12px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 ${buttonClassName}`}
          >
            检查答案
          </button>
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
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">竖式</div>
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
    <div className="mt-3 border-t border-slate-100 pt-3">
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
