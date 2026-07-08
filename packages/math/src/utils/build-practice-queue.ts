import type { PracticeQueueItem } from '@rosie/math/utils/practice-queue-types'

/** Dedupe by problem.id, then sort by solve count ascending (stable tie-break). */
export function buildPracticeQueue(
  pool: PracticeQueueItem[],
  solveCount: Record<string, number>,
): PracticeQueueItem[] {
  const seen = new Set<string>()
  const unique: PracticeQueueItem[] = []
  for (const item of pool) {
    if (seen.has(item.problem.id)) continue
    seen.add(item.problem.id)
    unique.push(item)
  }

  return unique.sort((a, b) => {
    const ca = solveCount[a.problem.id] ?? 0
    const cb = solveCount[b.problem.id] ?? 0
    if (ca !== cb) return ca - cb
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
