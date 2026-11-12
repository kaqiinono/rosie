import type { TreeData } from '@/lib/time-tree/types'
import { dayOf } from '@/lib/time-tree/types'
import type { GardenState, Bud, Flower } from '@/components/tree-demo/garden/model'

export function sceneBud(s: TreeData['steps'][number], today: string): Bud {
  return {
    id: s.id,
    name: s.name,
    subject: s.subject,
    minutes: s.minutes,
    dateKey: s.planned,
    overdue: !!s.planned && s.planned < today,
  }
}

export function sceneState(tree: TreeData): GardenState {
  const buds = tree.steps.filter((s) => !s.skipped && (!s.end || !s.popped)).map((s) => sceneBud(s, tree.today))
  const flowers: Flower[] = tree.steps.flatMap((s) =>
    s.end && !s.settled && s.popped
      ? s.stages.map((stage, i) => ({
          id: s.id + '#' + i,
          subject: s.subject,
          name: s.name,
          dateKey: dayOf(s.end!),
          stage,
          makeup: dayOf(s.end!) !== s.planned,
        }))
      : [],
  )
  const air = tree.steps.filter((s) => s.slot !== null)
  const history = new Set(
    [...buds.map((b) => b.dateKey), ...tree.apples.map((a) => a.dateKey)].filter(
      (d): d is string => !!d && d < tree.today,
    ),
  )
  return {
    today: tree.today,
    buds,
    flowers,
    apples: tree.apples,
    stones: tree.stones,
    remainder: tree.remainder,
    afterSchool: tree.afterSchool,
    sun: tree.sun,
    water: tree.water,
    aliveHistory: [...history],
    rings: Math.max(
      0,
      Math.round((Date.parse(tree.today) - Date.parse(tree.firstDay)) / 86400000) - history.size,
    ),
    bubbles: air.map((s) => s.id),
    bubbleSlots: Object.fromEntries(air.map((s) => [s.id, s.slot!])),
    stoneTotal: tree.appleCount,
    pity: tree.appleCount % 12,
    exchanges: tree.exchanges.length,
    settings: { k: tree.rules.chinese, n: tree.rules.wish },
    diary: [],
    streak: 0,
    lastPopDay: null,
    popsToday: 0,
    goalGiven: false,
    lastPopAt: 0,
    combo: 0,
    totalPops: 0,
  }
}
