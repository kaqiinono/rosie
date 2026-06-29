'use client'

import type { AnswerCheckResult, Problem } from '@rosie/core'

interface NumericAnswerPanelProps {
  problem: Problem
  answer: string
  onAnswerChange: (value: string) => void
  onCheck: () => void
  feedback: AnswerCheckResult | null
  buttonClassName: string
}

export default function NumericAnswerPanel({
  problem,
  answer,
  onAnswerChange,
  onCheck,
  feedback,
  buttonClassName,
}: NumericAnswerPanelProps) {
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-border-light" />
        <div className="whitespace-nowrap text-xs font-semibold text-text-muted">✏️ 写出答案</div>
        <div className="h-px flex-1 bg-border-light" />
      </div>
      <div className="mb-3 rounded-lg border border-dashed border-border-light bg-[#f9fafb] p-3.5">
        <div className="text-[13px] text-text-secondary">{problem.finalQ}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <input
            type="number"
            className="w-[72px] rounded-lg border border-border-light px-2 py-1.5 text-center text-sm"
            placeholder="？"
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onCheck()}
          />
          <span>{problem.finalUnit}</span>
          <button
            type="button"
            onClick={onCheck}
            className={`cursor-pointer rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-all active:translate-y-px ${buttonClassName}`}
          >
            检查答案
          </button>
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
