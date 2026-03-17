'use client'

import { getResultEmoji, getResultMessage } from '@/utils/english-helpers'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RotateCcw } from 'lucide-react'

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
    <Card className="bg-transparent border-0 shadow-none">
      <CardContent className="text-center py-10 px-4">
        <div className="text-[3.5rem] mb-3">{emoji}</div>
        <div className="font-fredoka text-[3rem] bg-gradient-to-br from-[var(--wm-accent)] to-[var(--wm-accent2)] bg-clip-text text-transparent mb-1.5">
          {score} / {total}
        </div>
        <div className="text-[var(--wm-text-dim)] text-[.92rem] mb-5">
          正确率 {pct}%　{msg}
        </div>
        <Button
          onClick={onRetry}
          variant="gradient"
          size="lg"
          className="bg-gradient-to-br from-[var(--wm-accent)] to-[#c0392b] font-nunito font-extrabold text-[.9rem]"
        >
          <RotateCcw className="h-4 w-4" />
          再练一次
        </Button>
      </CardContent>
    </Card>
  )
}
