'use client'

import type { AnswerCheckResult } from '@rosie/core'
import { useClaimSolutionToggle } from '@rosie/math/components/shared/QuestionLayout'

interface InteractiveAnswerFeedbackProps {
  feedback: AnswerCheckResult | null
  className?: string
  /** Claim 查看题解 under the interactive widget (no 检查答案 row). */
  claimSolutionToggle?: boolean
}

export default function InteractiveAnswerFeedback({
  feedback,
  className = '',
  claimSolutionToggle = true,
}: InteractiveAnswerFeedbackProps) {
  const solutionToggle = useClaimSolutionToggle(claimSolutionToggle)

  if (!feedback?.message && !solutionToggle) return null

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      {feedback?.message ? (
        <div
          className={`min-w-0 flex-1 text-[13px] font-medium ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'}`}
        >
          {feedback.message}
        </div>
      ) : null}
      {solutionToggle}
    </div>
  )
}
