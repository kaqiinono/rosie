import type { TreeData, WorkStep } from '@/lib/time-tree/types'
import type { TreeController } from './useTimeTree'

export type FinishAndPopResult =
  | { ok: true; step: WorkStep; tree: TreeData; bloom: boolean }
  | { ok: false; finished: boolean }

/** 先记完成，进行中的空中泡泡再戳破。不在空中的作业 finish 时已经 popped，不再 pop。 */
export async function finishAndPop(
  run: TreeController['run'],
  step: WorkStep,
): Promise<FinishAndPopResult> {
  const inAir = step.slot !== null
  const finished = await run({ kind: 'finish', id: step.id })
  if (!finished) return { ok: false, finished: false }
  const done = finished.steps.find((item) => item.id === step.id)
  if (!done?.end) return { ok: false, finished: false }
  if (!inAir || done.popped) return { ok: true, step: done, tree: finished, bloom: false }
  const popped = await run({ kind: 'pop', id: step.id })
  if (!popped) return { ok: false, finished: true }
  return {
    ok: true,
    step: popped.steps.find((item) => item.id === step.id) ?? done,
    tree: popped,
    bloom: true,
  }
}
