import type { TreeData, WorkStep } from '@/lib/time-tree/types'
import type { TreeController } from './useTimeTree'

export type FinishAndPopResult =
  | { ok: true; step: WorkStep; tree: TreeData; bloom: boolean }
  | { ok: false; finished: boolean }

export async function finishAndPop(
  run: TreeController['run'],
  step: WorkStep,
): Promise<FinishAndPopResult> {
  const bloom = step.slot !== null
  const tree = await run({ kind: 'finish', id: step.id, popOnFinish: bloom })
  const done = tree?.steps.find(item => item.id === step.id)
  if (!tree || !done?.end) return { ok: false, finished: false }
  return { ok: true, step: done, tree, bloom }
}
