'use client'

import { getResultEmoji, getResultMessage } from '../../utils/english-helpers'
import { Button } from '@rosie/ui/themes'

interface QuizResultsProps {
  score: number
  total: number
  onRetry: () => void
}

export default function QuizResults({ score, total, onRetry }: QuizResultsProps) {
  const pct = Math.round((score / total) * 100)
  const emoji = getResultEmoji(pct)
  const msg = getResultMessage(pct)

  return (
    <div className="px-4 py-10 text-center">
      <div className="mb-3 text-[3.5rem]">{emoji}</div>
      <div className="font-fredoka mb-1.5 text-[3rem] text-[var(--wm-accent)]">
        {score} / {total}
      </div>
      <div className="mb-5 text-[.92rem] text-[var(--wm-text-dim)]">
        正确率 {pct}%　{msg}
      </div>
      <Button onClick={onRetry} variant="solid" color="red" size="3">
        🔄 再练一次
      </Button>
    </div>
  )
}
