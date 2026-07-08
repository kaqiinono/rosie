import type { Problem } from '@rosie/core'

export type PracticeQueueItem = {
  problem: Problem
  section: string
  lessonId: string
  detailHref: string
}

export type PracticeQueuePhase = 'answering' | 'celebration'

export type PracticeQueueStartOpts = {
  /** Raw pool from current scene; will be deduped and sorted by solve count. */
  pool: PracticeQueueItem[]
  returnHref: string
  title?: string
  initialProblemId?: string
  immersive?: boolean
}
