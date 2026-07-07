'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import { checkProblemAnswer, isInteractiveProblem } from '@rosie/math/utils/check-problem-answer'
import { injectFigureGridCallbacks } from '@rosie/math/components/shared/injectFigureSubmit'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'

type ScratchPadAnswerPanelProps = {
  problem: Problem
  mode: 'practice' | 'quiz'
  initialAnswer?: unknown
  onAnswerDraftChange: (snapshot: unknown) => void
  onSubmitResult?: (correct: boolean, snapshot: unknown) => void
  buttonClassName?: string
}

export default function ScratchPadAnswerPanel({
  problem,
  mode,
  initialAnswer,
  onAnswerDraftChange,
  onSubmitResult,
  buttonClassName = 'bg-indigo-600 shadow-[0_3px_10px_rgba(79,70,229,0.3)]',
}: ScratchPadAnswerPanelProps) {
  const [answer, setAnswer] = useState('')
  const [interactiveState, setInteractiveState] = useState<unknown>(undefined)
  const [interactiveTouched, setInteractiveTouched] = useState(false)
  const [feedback, setFeedback] = useState<AnswerCheckResult | null>(null)

  useEffect(() => {
    setFeedback(null)
    if (isInteractiveProblem(problem)) {
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

  const handleCheck = useCallback(() => {
    if (mode === 'quiz') return
    const input = isInteractiveProblem(problem) ? interactiveState : answer
    const result = checkProblemAnswer(problem, input)
    if (!result.message && !result.ok) return
    setFeedback(result)
    onSubmitResult?.(result.ok, input)
  }, [mode, problem, interactiveState, answer, onSubmitResult])

  useEffect(() => {
    if (!isInteractiveProblem(problem)) {
      onAnswerDraftChange(answer)
    }
  }, [answer, problem, onAnswerDraftChange])

  if (isInteractiveProblem(problem)) {
    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">作答</div>
        <div className={mode === 'quiz' ? undefined : 'rounded-lg border border-slate-100 bg-slate-50/80 p-2'}>
          {injectFigureGridCallbacks(problem.figureNode, {
            initialState: interactiveState,
            onStateChange: recordInteractive,
            onSubmit: (state) => {
              recordInteractive(state)
              if (mode === 'practice') handleCheck()
            },
          })}
        </div>
        {mode === 'practice' && (
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
        {feedback?.message && (
          <p className={`mt-2 text-[12px] ${feedback.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {feedback.message}
          </p>
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
