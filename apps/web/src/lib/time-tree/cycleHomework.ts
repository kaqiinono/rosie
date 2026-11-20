import { dayOf, isExhaustedPendingStep, type TreeData, type WorkStep } from './types'

export function isMultiweekCycle(cycle: string | undefined): boolean {
  return cycle === 'biweekly' || cycle === 'three_weekly'
}

export function homeworkCycleKey(step: WorkStep): string | undefined {
  const [template, cycle, start] = step.occurrence.split('/')
  if (step.subject !== 'life' && isMultiweekCycle(cycle) && start) return `${template}/${cycle}/${start}`
}

export function cycleAvailableFrom(step: WorkStep): string {
  return [step.scheduled, step.planned, step.flowers?.availableFrom].reduce<string>(
    (latest, date) => date && date > latest ? date : latest, step.scheduled,
  )
}

export function isClosedHomeworkCycle(step: WorkStep, today: string): boolean {
  return !!homeworkCycleKey(step) && step.deadline < today
}

export function cycleHomeworkProgress(steps: WorkStep[]) {
  const cycles = new Map<string, { step: WorkStep; occurrences: Map<string, WorkStep[]>; target: number }>()
  for (const step of steps) {
    const key = homeworkCycleKey(step)
    if (!key) continue
    const cycle = cycles.get(key) ?? { step, occurrences: new Map<string, WorkStep[]>(), target: 0 }
    const occurrence = cycle.occurrences.get(step.occurrence) ?? []
    occurrence.push(step)
    cycle.occurrences.set(step.occurrence, occurrence)
    cycle.target = Math.max(cycle.target, step.cycleTarget ?? 0)
    cycles.set(key, cycle)
  }
  return new Map([...cycles].map(([key, { step, occurrences, target }]) => {
    const done = [...occurrences.values()].filter(parts =>
      parts.every(part => part.end && !part.skipped && dayOf(part.end) <= part.deadline) &&
      parts.some(part => !part.flowers || part.flowers.complete),
    ).length
    return [key, { step, done, total: target || occurrences.size }] as const
  }))
}

/** Choose one executable or upcoming occurrence per current cycle. */
export function cycleBubbleIds(tree: TreeData, progress = cycleHomeworkProgress(tree.steps)): Set<string> {
  const selected = new Map<string, WorkStep>()
  const rank = (step: WorkStep) => step.end ? 1 : step.start ? 0 : 2
  for (const step of tree.steps) {
    const key = homeworkCycleKey(step)
    if (!key || key.split('/')[2] > tree.today || isClosedHomeworkCycle(step, tree.today) || step.skipped ||
      isExhaustedPendingStep(tree, step) || (step.end && (step.popped || dayOf(step.end) !== tree.today))) continue
    const cycle = progress.get(key)
    if (cycle && cycle.done >= cycle.total && !step.end && !step.start) continue
    const current = selected.get(key)
    if (!current || rank(step) < rank(current) || (rank(step) === rank(current) &&
      (cycleAvailableFrom(step).localeCompare(cycleAvailableFrom(current)) || step.id.localeCompare(current.id)) < 0)) {
      selected.set(key, step)
    }
  }
  return new Set([...selected.values()].map(step => step.id))
}
