'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import { Button, TextField } from '@rosie/ui/themes'
import { useClaimSolutionToggle } from '@rosie/math-kit/components/shared/QuestionLayout'

interface NumericAnswerPanelProps {
  problem: Problem
  answer: string
  onAnswerChange: (value: string) => void
  onCheck: () => void
  feedback: AnswerCheckResult | null
  /** @deprecated 按钮外观由 Radix Button 统一提供，该参数不再生效，仅为兼容调用方保留。 */
  buttonClassName?: string
  /** Extra actions after 检查答案 (e.g. 不会); 查看题解 still comes from QuestionLayout. */
  trailingActions?: ReactNode
}

export default function NumericAnswerPanel({
  problem,
  answer,
  onAnswerChange,
  onCheck,
  feedback,
  trailingActions,
}: NumericAnswerPanelProps) {
  const contextToggle = useClaimSolutionToggle(true)
  const [pendingCheck, setPendingCheck] = useState<{
    problemId: string
    feedbackAtStart: AnswerCheckResult | null
  } | null>(null)
  const isCorrect = feedback?.ok === true
  const isChecking =
    pendingCheck?.problemId === problem.id && pendingCheck.feedbackAtStart === feedback

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
        <div className="bg-border-light h-px flex-1" />
        <div className="text-text-muted text-xs font-semibold whitespace-nowrap">✏️ 写出答案</div>
        <div className="bg-border-light h-px flex-1" />
      </div>
      <div className="border-border-light mb-3 rounded-lg border border-dashed bg-[#f9fafb] p-3.5">
        {questions.map((question, index) => (
          <div key={question.finalQ} className="mb-3">
            <div className="text-text-secondary text-[13px]">{question.finalQ}</div>

            <div className="mt-2 flex max-w-40 items-center gap-2">
              <TextField.Root
                type="number"
                size="3"
                aria-label={question.finalQ || '答案'}
                className="min-w-0 flex-1 text-center"
                placeholder="？"
                value={values[index] ?? ''}
                disabled={isChecking || isCorrect}
                onChange={(e) =>
                  onAnswerChange(
                    questions
                      .map((_, i) => (i === index ? e.target.value : (values[i] ?? '')))
                      .join('|'),
                  )
                }
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              />
              {question.finalUnit ? (
                <span className="text-text-secondary shrink-0 text-sm font-medium">
                  {question.finalUnit}
                </span>
              ) : null}
            </div>
          </div>
        ))}
        <div>
          <div className="grid min-w-0 grid-cols-2 gap-2 [&_.ql-toggle-btn]:h-11 [&_.ql-toggle-btn]:w-full [&_.ql-toggle-btn]:justify-center [&>button]:h-11 [&>button]:w-full [&>button]:justify-center">
            {isCorrect ? (
              contextToggle
            ) : (
              <Button
                type="button"
                size="3"
                radius="full"
                variant="solid"
                loading={isChecking}
                disabled={isChecking || incomplete}
                aria-busy={isChecking}
                onClick={handleCheck}
                className={isChecking ? 'col-span-2' : undefined}
              >
                {isChecking ? '检查中…' : '检查答案'}
              </Button>
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
