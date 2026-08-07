import type { Problem } from '@rosie/core'
import type { MathPracticeSource } from '@rosie/math-kit/utils/practice-queue-snapshot'

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
  /** Keep the original pool order (dedupe only, no solve-count sort). Respects initialProblemId. */
  preserveOrder?: boolean
  /**
   * Shown on the celebration screen: returns remaining undone count and a
   * callback to start a fresh session with only those problems.
   * Return `null` or `{ count: 0 }` to hide the button.
   */
  checkRemaining?: () => { count: number; onStart: () => void } | null
}
