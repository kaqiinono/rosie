import type { PracticeQueueItem } from '@rosie/math-kit/utils/practice-queue-types'

export type DeferQueueResult<T> = {
  items: T[]
  result: 'moved' | 'only_remaining'
}

/** Move the current unanswered item behind every other unanswered item. */
export function deferQueueItem<T>(items: T[], currentIndex: number): DeferQueueResult<T> {
  if (currentIndex < 0 || currentIndex >= items.length - 1) {
    return { items, result: 'only_remaining' }
  }
  const nextItems = [...items]
  const [deferred] = nextItems.splice(currentIndex, 1)
  if (deferred === undefined) return { items, result: 'only_remaining' }
  nextItems.push(deferred)
  return { items: nextItems, result: 'moved' }
}

/** Dedupe by assignment occurrence for plan tasks, otherwise by problem.id. */
export function buildPracticeQueue(
  pool: PracticeQueueItem[],
  practiceCount: Record<string, number>,
  lastAttemptedAt: Record<string, string>,
  preserveOrder?: boolean,
): PracticeQueueItem[] {
  const seen = new Set<string>()
  const unique: PracticeQueueItem[] = []
  for (const item of pool) {
    const identity = item.planAssignment?.assignmentId ?? item.problem.id
    if (seen.has(identity)) continue
    seen.add(identity)
    unique.push(item)
  }

  if (preserveOrder) return unique

  return unique.sort((a, b) => {
    const ca = practiceCount[a.problem.id] ?? 0
    const cb = practiceCount[b.problem.id] ?? 0
    if (ca !== cb) return ca - cb
    const ta = lastAttemptedAt[a.problem.id] ?? ''
    const tb = lastAttemptedAt[b.problem.id] ?? ''
    if (ta !== tb) return ta.localeCompare(tb)
    return a.problem.id.localeCompare(b.problem.id)
  })
}

export function initialIndexForProblem(
  queue: PracticeQueueItem[],
  problemId?: string,
): number {
  if (!problemId || queue.length === 0) return 0
  const idx = queue.findIndex((item) => item.problem.id === problemId)
  return idx >= 0 ? idx : 0
}
