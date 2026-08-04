'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { usePracticeQueue } from '@rosie/math/components/shared/practice-queue/PracticeQueueContext'
import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'
import type { MathPracticeSource } from '@rosie/math/utils/practice-queue-snapshot'

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
