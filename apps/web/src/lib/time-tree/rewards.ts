import { dayOf, type TreeData, type WorkStep } from './types'

export function isEarly(step: WorkStep): boolean {
  return !step.flowers && !!step.start && !!step.end &&
    Date.parse(step.end) - Date.parse(step.start) < step.minutes * 60000
}

export function completionReward(tree: TreeData, step: WorkStep, day: string, early: boolean) {
  const count = tree.steps.filter((p) => p.id !== step.id && p.end && dayOf(p.end) === day).length + 1
  const baseSun = Math.max(1, step.stages.length)
  const baseWater = count === 3 ? 2 : 1
  const multiplier = early ? 2 : 1
  return { sun: baseSun * multiplier, water: baseWater * multiplier }
}
