'use client'

import { useScreenWakeLock } from './useScreenWakeLock'
import { useTimeTree } from './useTimeTree'

export default function HomeworkWakeLock({ stepId }: { stepId?: string }) {
  const { tree, clockOffsetMs } = useTimeTree()
  const timedHomework = tree?.steps.find(step => step.subject !== 'life' && step.start && !step.end && !step.skipped &&
    (stepId === undefined || step.id === stepId))
  const deadline = timedHomework?.start
    ? Date.parse(timedHomework.start) + timedHomework.minutes * 60_000 -
      (timedHomework.flowers?.elapsedMs ?? 0) - clockOffsetMs
    : null
  useScreenWakeLock(deadline)
  return null
}
