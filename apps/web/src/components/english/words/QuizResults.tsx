'use client'

import { getResultEmoji, getResultMessage } from '@/utils/english-helpers'

interface QuizResultsProps {
  score: number
  total: number
  onRetry: () => void
}

export default function QuizResults({ score, total, onRetry }: QuizResultsProps) {
  const pct = Math.round(score / total * 100)
  const emoji = getResultEmoji(pct)
  const msg = getResultMessage(pct)

  return (
    <div className="text-center py-10 px-4">
      <div className="text-[3.5rem] mb-3">{emoji}</div>
      <div className="font-fredoka text-[3rem] bg-gradient-to-br from-[var(--wm-accent)] to-[var(--wm-accent2)] bg-clip-text text-transparent mb-1.5">
        {score} / {total}
      </div>
      <div className="text-[var(--wm-text-dim)] text-[.92rem] mb-5">
        正确率 {pct}%　{msg}
      </div>
      <button
        onClick={onRetry}
        className="px-7 py-3 bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] border-0 rounded-[10px] text-white font-nunito font-extrabold text-[.9rem] cursor-pointer"
      >
        🔄 再练一次
      </button>
    </div>
  )
}
