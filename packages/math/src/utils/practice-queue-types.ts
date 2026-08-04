import type { Problem } from '@rosie/core'
import type { MathPracticeSource } from '@rosie/math/utils/practice-queue-snapshot'

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
  /** Isolates mid-exit stash per entry (plan / sea / lesson / …). */
  source: MathPracticeSource
  returnHref: string
  title?: string
  initialProblemId?: string
  immersive?: boolean
}
