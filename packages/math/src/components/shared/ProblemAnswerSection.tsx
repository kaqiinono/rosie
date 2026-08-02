'use client'

import type { ReactNode } from 'react'
import type { AnswerCheckResult, Problem } from '@rosie/core'
import NumericAnswerPanel from '@rosie/math/components/shared/NumericAnswerPanel'
import VerticalDigitPuzzlePanel from '@rosie/math/components/shared/VerticalDigitPuzzlePanel'
import ScratchPadCustomAnswerWidget from '@rosie/math/components/shared/ScratchPad/ScratchPadCustomAnswerWidget'
import { useClaimSolutionToggle } from '@rosie/math/components/shared/QuestionLayout'
import { getProblemAnswerMode } from '@rosie/math/utils/problem-answer-mode'

type ProblemAnswerSectionProps = {
  problem: Problem
  answer: string
  onAnswerChange: (value: string) => void
  feedback: AnswerCheckResult | null
  onSubmit: (input: unknown) => void
  onCheck: () => void
  onStateChange: () => void
  buttonClassName?: string
  tip?: ReactNode
  puzzleWrapperClassName?: string
  /** Shown after 检查答案 / under custom widgets (e.g. 不会). */
  trailingActions?: ReactNode
}

export default function ProblemAnswerSection({
  problem,
  answer,
  onAnswerChange,
  feedback,
  onSubmit,
  onCheck,
  onStateChange,
  buttonClassName = 'bg-sky-600 shadow-[0_3px_10px_rgba(14,165,233,0.3)]',
  tip,
  puzzleWrapperClassName = 'rounded-xl border border-sky-100 bg-white p-3 sm:p-4',
  trailingActions,
}: ProblemAnswerSectionProps) {
  const answerMode = getProblemAnswerMode(problem)
  const verticalPuzzle = problem.verticalPuzzle
  // Custom widgets have no 检查答案 row — claim toggle under the widget.
  // Numeric modes: NumericAnswerPanel claims beside 检查答案.
  const solutionToggle = useClaimSolutionToggle(answerMode === 'custom-widget')

  if (answerMode === 'custom-widget') {
    return (
      <>
        <div className={puzzleWrapperClassName}>
          <ScratchPadCustomAnswerWidget
            problem={problem}
            onSubmit={onSubmit}
            onStateChange={onStateChange}
            feedback={feedback}
          />
        </div>
        {trailingActions || solutionToggle ? (
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {trailingActions}
            {solutionToggle}
          </div>
        ) : null}
        {tip}
      </>
    )
  }

  if (answerMode === 'readonly-puzzle-numeric' && verticalPuzzle) {
    return (
      <>
        <div className={puzzleWrapperClassName}>
          <VerticalDigitPuzzlePanel spec={verticalPuzzle} embedded onSubmit={() => {}} />
        </div>
        <NumericAnswerPanel
          problem={problem}
          answer={answer}
          onAnswerChange={onAnswerChange}
          onCheck={onCheck}
          feedback={feedback}
          buttonClassName={buttonClassName}
          trailingActions={trailingActions}
        />
        {tip}
      </>
    )
  }

  return (
    <>
      <NumericAnswerPanel
        problem={problem}
        answer={answer}
        onAnswerChange={onAnswerChange}
        onCheck={onCheck}
        feedback={feedback}
        buttonClassName={buttonClassName}
        trailingActions={trailingActions}
      />
      {tip}
    </>
  )
}
