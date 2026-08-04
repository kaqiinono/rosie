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
