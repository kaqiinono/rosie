'use client'

import { useMemo } from 'react'
import type {
  PracticeQueueItem,
  PracticeQueueStartOpts,
} from '@rosie/math-kit/utils/practice-queue-types'
import { Button } from '@rosie/ui/themes'

type Props = {
  total: number
  sessionCorrect: number
  title: string
  returnHref: string
  onExit: () => void
  onRestart: () => void
  checkRemaining?: PracticeQueueStartOpts['checkRemaining']
}

export default function PracticeCelebration({
  total,
  sessionCorrect,
  title,
  returnHref,
  onExit,
  onRestart,
  checkRemaining,
}: Props) {
  const remaining = useMemo(() => checkRemaining?.() ?? null, [checkRemaining])
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 text-6xl">🎉</div>
      <h2 className="text-text-primary mb-2 text-2xl font-extrabold">全部完成！</h2>
      <p className="text-text-secondary mb-1 text-sm">
        {title} · 共 {total} 题
      </p>
      <p className="text-app-blue mb-8 text-sm font-semibold">本次做对 {sessionCorrect} 题</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" onClick={onExit} variant="solid" color="blue" size="2">
          返回
        </Button>
        {remaining && remaining.count > 0 && (
          <Button type="button" onClick={remaining.onStart} variant="solid" color="orange" size="2">
            继续练习（还有 {remaining.count} 题）
          </Button>
        )}
        <Button type="button" onClick={onRestart} variant="outline" color="gray" size="2">
          再练一遍
        </Button>
      </div>
      <p className="text-text-muted mt-4 text-[11px]">返回至 {returnHref}</p>
    </div>
  )
}

export type { PracticeQueueItem }
