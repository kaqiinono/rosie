import { capacityOf, SUBJECTS } from '@/components/tree-demo/garden/model'
import { dayOf, elapsed, type TreeData, type WorkStep } from '@/lib/time-tree/types'

/** 孩子卡片上的说明：这次备注优先，否则用作业说明。 */
export function kidNote(step: WorkStep): string {
  return step.planNote?.trim() || step.notes.trim()
}

export function kidTime(step: WorkStep, now: number): string {
  if (step.skipped) return '这次先休息，不用做啦'
  if (step.end) {
    if (!step.start) return '做完啦，这次没计时'
    const delta = elapsed(step.start, step.end) - step.minutes
    if (delta < 0) return `比预计少用了 ${-delta} 分钟，真棒！`
    if (delta === 0) return '时间刚好，真棒！'
    return `比预计多用了 ${delta} 分钟`
  }
  if (step.start) {
    const spent = Math.max(0, Math.floor((now - Date.parse(step.start)) / 60000))
    const left = step.minutes - spent
    if (spent === 0) return `刚刚开始，还剩 ${step.minutes} 分钟！`
    if (left > 0) return `已经做了 ${spent} 分钟，还剩 ${left} 分钟！`
    if (left === 0) return `已经做了 ${spent} 分钟，时间刚好！`
    return `已经做了 ${spent} 分钟，比预计多了 ${-left} 分钟`
  }
  return `预计 ${step.minutes} 分钟`
}

function flowerPhrase(step: WorkStep): string {
  if (!step.stages.length) return ''
  return `${step.stages.length} 朵${SUBJECTS[step.subject].label}小花`
}

/** 按当天已经按时完成的作业，估算这次按时做完能拿到的阳光和水滴。 */
function previewReward(tree: TreeData, step: WorkStep): { sun: number; water: number } {
  const peers = tree.steps.filter(
    (p) =>
      p.id !== step.id &&
      p.end &&
      p.start &&
      dayOf(p.end) === tree.today &&
      elapsed(p.start, p.end) <= p.minutes,
  )
  const sun = Math.max(
    0,
    Math.min(
      step.stages.length,
      10 - peers.reduce((sum, p) => sum + p.sun, 0),
      20 - tree.sun,
    ),
  )
  const water = Math.max(
    0,
    Math.min(peers.length + 1 > 5 ? 0 : peers.length + 1 === 3 ? 2 : 1, 12 - tree.water),
  )
  return { sun, water }
}

export function kidReward(tree: TreeData, step: WorkStep, now: number): string {
  const flower = flowerPhrase(step)
  if (step.skipped) return ''
  if (step.end) {
    if (!step.start) return flower ? `树上开出 ${flower}！` : '做完啦！'
    const gifts = [step.sun ? `☀️+${step.sun}` : '', step.water ? `💧+${step.water}` : ''].filter(
      Boolean,
    )
    if (gifts.length && flower) return `开出 ${flower}！获得 ${gifts.join(' ')}`
    if (gifts.length) return `拿到 ${gifts.join(' ')}！`
    if (flower) return `开出 ${flower}！本次没有阳光和水滴`
    return '做完啦！'
  }
  if (step.start) {
    const spent = Math.max(0, Math.floor((now - Date.parse(step.start)) / 60000))
    if (spent > step.minutes) {
      return flower
        ? `做完仍会开出 ${flower}。本次没有阳光和水滴`
        : '本次没有阳光和水滴'
    }
  }
  const today = (!!step.planned && step.planned <= tree.today) || !!step.start
  if (!today) {
    return flower
      ? `做完开 ${flower}。按时完成可得阳光和水滴`
      : '按时完成可得阳光和水滴'
  }
  const { sun, water } = previewReward(tree, step)
  const gifts = [sun ? `☀️+${sun}` : '', water ? `💧+${water}` : ''].filter(Boolean)
  if (gifts.length && flower)
    return `做完开 ${flower}。按时完成另得 ${gifts.join(' ')}`
  if (gifts.length) return `按时完成可得 ${gifts.join(' ')}`
  if (flower) return `做完开 ${flower}。今天的阳光和水滴已攒满`
  return '做完也会被大树记住哦'
}

export function kidDayFits(tree: TreeData, step: WorkStep, day: string): boolean {
  const load = tree.steps
    .filter((p) => p.id !== step.id && !p.skipped && p.planned === day)
    .reduce((n, p) => n + p.stages.length, 0)
  return load + step.stages.length <= capacityOf(day)
}
