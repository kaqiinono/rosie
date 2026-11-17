import { CORE_SUBJECTS } from '@/components/tree-demo/garden/model'
import { dayOf, defaultRules, type TreeData, type WorkStep } from './types'

/** Settle each flower receipt exactly once, both at midnight and on a perfect day. */
export function harvestSteps(tree: TreeData, steps: WorkStep[]) {
  const due = steps.filter(step => step.end && !step.settled).sort((a, b) =>
    dayOf(a.end!).localeCompare(dayOf(b.end!)) ||
    CORE_SUBJECTS.findIndex(key => key === a.subject) - CORE_SUBJECTS.findIndex(key => key === b.subject) ||
    a.id.localeCompare(b.id),
  )
  for (const step of due) {
    const dateKey = dayOf(step.end!)
    step.settled = step.popped = true
    step.slot = null
    if (step.subject === 'life') {
      if (step.stages.length) tree.apples.push({ id: crypto.randomUUID(), kind: 'life', dateKey })
      continue
    }
    const rules = [...tree.ruleHistory].reverse().find(rule => rule.day <= dateKey)?.rules ?? defaultRules
    tree.remainder[step.subject] += step.stages.length
    while (tree.remainder[step.subject] >= rules[step.subject]) {
      tree.remainder[step.subject] -= rules[step.subject]
      tree.appleCount++
      tree.apples.push({
        id: crypto.randomUUID(), kind: tree.appleCount % 12 === 0 ? 'rainbow' : step.subject,
        from: step.subject, dateKey,
      })
    }
  }
}

export function awardDailyRainbow(tree: TreeData, step: WorkStep): boolean {
  const today = tree.today
  if (tree.dailyRainbowDay === today || step.subject === 'life' || step.planned !== today ||
    !step.end || dayOf(step.end) !== today || (step.flowers && !step.flowers.complete)) return false
  const academic = tree.steps.filter(item => item.subject !== 'life' && !item.skipped && item.planned === today)
  if (!academic.length || academic.some(item => !item.end || (item.flowers && !item.flowers.complete))) return false

  // Settle today's flowers now so the reward can be seen and picked immediately.
  harvestSteps(tree, tree.steps.filter(item => item.subject !== 'life' && item.end && dayOf(item.end) === today))
  const last = [...tree.apples].reverse().find(apple => apple.dateKey === today && apple.kind !== 'life')
  if (last) last.kind = 'rainbow'
  else {
    // A short day still earns its promised rainbow; unspent flowers remain carried forward.
    tree.appleCount++
    tree.apples.push({ id: crypto.randomUUID(), kind: 'rainbow', from: step.subject, dateKey: today })
  }
  tree.dailyRainbowDay = today
  step.dailyRainbow = true
  return true
}
