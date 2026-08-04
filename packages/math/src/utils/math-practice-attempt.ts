import type { ScratchObject } from '@rosie/math/components/shared/ScratchPad/scratch-pad-types'

export function resolveAttemptCanvasObjects(
  attempt: { objects?: ScratchObject[]; draftId?: string | null },
  fallbackDraftObjects: ScratchObject[] | null,
): ScratchObject[] {
  if (attempt.objects && attempt.objects.length > 0) return attempt.objects
  if (fallbackDraftObjects && fallbackDraftObjects.length > 0) return fallbackDraftObjects
  return []
}

export function shouldInsertCompletedWithoutInProgress(hasInProgressAttempt: boolean): boolean {
  return !hasInProgressAttempt
}

export function attemptRowHasViewableCanvas(attempt: {
  objects?: ScratchObject[]
  draftId?: string | null
}): boolean {
  return (attempt.objects?.length ?? 0) > 0 || Boolean(attempt.draftId)
}

type PracticeAttemptPick = {
  id: string
  correct: boolean | null
  attemptedAt: string
  paperId?: string | null
}

const PRACTICE_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Bind a mastery / status row to one completed practice attempt (non-quiz).
 * Prefer time match within 24h; else newest. Does not care about canvas —
 * callers check attemptRowHasViewableCanvas for「该练习的草稿」.
 */
export function pickPracticeAttemptForRow<T extends PracticeAttemptPick>(
  attempts: T[],
  practiceTime: string | undefined,
  preferWrong: boolean,
): T | null {
  const practiceOnly = attempts.filter((a) => !a.paperId)
  if (practiceOnly.length === 0) return null

  const pool = preferWrong ? practiceOnly.filter((a) => a.correct === false) : practiceOnly
  const list = pool.length > 0 ? pool : practiceOnly

  if (practiceTime) {
    const t = Date.parse(practiceTime)
    if (!Number.isNaN(t)) {
      let best: T | null = null
      let bestDiff = Infinity
      for (const a of list) {
        const diff = Math.abs(Date.parse(a.attemptedAt) - t)
        if (diff < bestDiff) {
          bestDiff = diff
          best = a
        }
      }
      if (best && bestDiff <= PRACTICE_MATCH_WINDOW_MS) return best
    }
  }

  let newest = list[0]
  for (const a of list) {
    if (Date.parse(a.attemptedAt) > Date.parse(newest.attemptedAt)) newest = a
  }
  return newest ?? null
}
