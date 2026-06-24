'use client'

import type { AnswerCheckResult } from '@rosie/core'

interface InteractiveAnswerFeedbackProps {
  feedback: AnswerCheckResult | null
  className?: string
}

export default function InteractiveAnswerFeedback({
  feedback,
  className = '',
}: InteractiveAnswerFeedbackProps) {
  if (!feedback?.message) return null

  return (
    <div
      className={`text-[13px] font-medium ${feedback.ok ? 'text-app-green-dark' : 'text-app-red'} ${className}`}
    >
      {feedback.message}
    </div>
  )
}
