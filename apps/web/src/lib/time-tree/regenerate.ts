import type { Homework } from '@rosie/tasks'
import { schedule } from './schedule'
import { isExhaustedPendingStep, type TreeData, type WorkStep } from './types'

export function regenerationTargets(tree: TreeData, from: string, through: string) {
  const groups = new Map<string, WorkStep[]>()
  for (const step of [...tree.steps, ...(tree.weekendExcludedSteps ?? [])]) {
    if (step.crown || isExhaustedPendingStep(tree, step)) continue
    const group = groups.get(step.occurrence) ?? []
    group.push(step)
    groups.set(step.occurrence, group)
  }
  const occurrences = new Set<string>()
  let count = 0
  for (const [key, steps] of groups) {
    if (!steps.every(step => {
      const date = step.planned ?? step.scheduled
      return date >= tree.today && date >= from && date <= through && step.scheduled >= tree.today &&
        !step.start && !step.end && !step.skipped && !step.settled && !step.audit.length &&
        !step.flowers?.availableFrom &&
        !step.practice?.questions && !step.returned && !step.stages.some(stage => stage > 0)
    })) continue
    occurrences.add(key)
    count += steps.length
  }
  return { occurrences, count }
}

export function regenerateHomework(tree: TreeData, templates: Homework[], from: string, through: string) {
  const { occurrences } = regenerationTargets(tree, from, through)
  const retained = structuredClone(tree.steps.filter(step => !occurrences.has(step.occurrence)))
  const retainedIds = new Set(retained.map(step => step.id))
  tree.steps = structuredClone(retained)
  tree.weekendExcludedSteps = tree.weekendExcludedSteps?.filter(step => !occurrences.has(step.occurrence))
  for (const progress of Object.values(tree.practiceProgress ?? {})) {
    if (progress.activeOccurrence && occurrences.has(progress.activeOccurrence)) progress.activeOccurrence = null
  }
  // Include a weekly/monthly window already in progress at the selected start date.
  schedule(tree, templates, from, through, true)
  // Scheduling also refreshes template labels; preserve out-of-range/protected records exactly.
  tree.steps = [...retained, ...tree.steps.filter(step => !retainedIds.has(step.id))]
}
