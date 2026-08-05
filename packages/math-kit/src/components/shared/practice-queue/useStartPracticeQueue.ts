'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { usePracticeQueue } from '@rosie/math-kit/components/shared/practice-queue/practice-queue-context'
import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'
import type { MathPracticeSource } from '@rosie/math-kit/utils/practice-queue-snapshot'

export function useStartPracticeQueue() {
  const pathname = usePathname()
  const { start } = usePracticeQueue()

  return useCallback(
    (opts: {
      pool: PracticeQueueItem[]
      source: MathPracticeSource
      title?: string
      initialProblemId?: string
      immersive?: boolean
      returnHref?: string
    }) => {
      start({
        pool: opts.pool,
        source: opts.source,
        title: opts.title,
        initialProblemId: opts.initialProblemId,
        immersive: opts.immersive,
        returnHref: opts.returnHref ?? pathname,
      })
    },
    [start, pathname],
  )
}
