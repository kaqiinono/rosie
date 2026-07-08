'use client'

import { useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { usePracticeQueue } from '@rosie/math/components/shared/practice-queue/PracticeQueueContext'
import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'

export function useStartPracticeQueue() {
  const pathname = usePathname()
  const { start } = usePracticeQueue()

  return useCallback(
    (opts: {
      pool: PracticeQueueItem[]
      title?: string
      initialProblemId?: string
      immersive?: boolean
      returnHref?: string
    }) => {
      start({
        pool: opts.pool,
        title: opts.title,
        initialProblemId: opts.initialProblemId,
        immersive: opts.immersive,
        returnHref: opts.returnHref ?? pathname,
      })
    },
    [start, pathname],
  )
}
