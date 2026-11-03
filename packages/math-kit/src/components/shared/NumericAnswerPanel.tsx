'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import { useClaimSolutionToggle } from '@rosie/math-kit/components/shared/QuestionLayout'

interface NumericAnswerPanelProps {
  problem: Problem
  answer: string
  onAnswerChange: (value: string) => void
  onCheck: () => void
  feedback: AnswerCheckResult | null
  buttonClassName: string
  /** Extra actions after 检查答案 (e.g. 不会); 查看题解 still comes from QuestionLayout. */
  trailingActions?: ReactNode
}

export default function NumericAnswerPanel({
  problem,
  answer,
  onAnswerChange,
  onCheck,
  feedback,
  buttonClassName,
  trailingActions,
}: NumericAnswerPanelProps) {
  const contextToggle = useClaimSolutionToggle(true)
  const [pendingCheck, setPendingCheck] = useState<{
    problemId: string
    feedbackAtStart: AnswerCheckResult | null
  } | null>(null)
  const isCorrect = feedback?.ok === true
  const isChecking =
    pendingCheck?.problemId === problem.id &&
    pendingCheck.feedbackAtStart === feedback

  const questions = [problem, ...(problem.additionalQuestions ?? [])]
  const values = answer.split('|')
  const incomplete = questions.length > 1 && questions.some((_, index) => !values[index]?.trim())

  const handleCheck = () => {
    if (isChecking || isCorrect || incomplete) return
    // Empty input is rejected synchronously and should not enter a loading state.
    if (answer.trim() !== '') {
      setPendingCheck({ problemId: problem.id, feedbackAtStart: feedback })
    }
    onCheck()
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-border-light" />
        <div className="whitespace-nowrap text-xs font-semibold text-text-muted">✏️ 写出答案</div>
        <div className="h-px flex-1 bg-border-light" />
      </div>
      <div className="mb-3 rounded-lg border border-dashed border-border-light bg-[#f9fafb] p-3.5">
        {questions.map((question, index) => (
          <div key={question.finalQ} className="mb-3">
            <div className="text-[13px] text-text-secondary">{question.finalQ}</div>

          <div className="mt-2 flex max-w-40 items-center gap-2">
            <input
              type="number"
              aria-label={question.finalQ || '答案'}
              className="h-11 min-w-0 flex-1 rounded-xl border border-border-light bg-white px-3 text-center text-base font-semibold text-text-primary shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow] focus:border-violet-400 focus:ring-3 focus:ring-violet-100"
              placeholder="？"
              value={values[index] ?? ''}
              disabled={isChecking || isCorrect}
              onChange={(e) => onAnswerChange(questions.map((_, i) =>
                i === index ? e.target.value : values[i] ?? '',
              ).join('|'))}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            />
            {question.finalUnit ? (
              <span className="shrink-0 text-sm font-medium text-text-secondary">
                {question.finalUnit}
              </span>
            ) : null}
          </div>
          </div>
        ))}
        <div>
          <div className="grid min-w-0 grid-cols-2 gap-2 [&_.ql-toggle-btn]:h-11 [&_.ql-toggle-btn]:w-full [&_.ql-toggle-btn]:justify-center [&>button]:h-11 [&>button]:w-full [&>button]:justify-center">
            {isCorrect ? contextToggle : (
              <button
                type="button"
                disabled={isChecking || incomplete}
                aria-busy={isChecking}
                onClick={handleCheck}
                className={`inline-flex cursor-pointer items-center rounded-xl px-4 text-[13px] font-semibold text-white transition-all active:translate-y-px disabled:cursor-wait disabled:opacity-80 ${isChecking ? 'col-span-2' : ''} ${buttonClassName}`}
              >
                {isChecking ? (
                  <>
                    <span
                      className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    <span>检查中…</span>
                  </>
                ) : '检查答案'}
              </button>
            )}
            {!isChecking ? trailingActions : null}
            {!isCorrect && !isChecking ? contextToggle : null}
          </div>
        </div>
        {feedback?.message && (
          <div
            className={`mt-2 text-[13px] ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </>
  )
}
