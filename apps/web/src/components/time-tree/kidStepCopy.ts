import { completionReward } from '@/lib/time-tree/rewards'
import { capacityOf, SUBJECTS } from '@/components/tree-demo/garden/model'
import { elapsed, type TreeData, type WorkStep } from '@/lib/time-tree/types'

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

export function kidReward(tree: TreeData, step: WorkStep, now: number): string {
  const flower = flowerPhrase(step)
  if (step.skipped) return ''
  if (step.end) {
    const gifts = [step.sun ? `☀️+${step.sun}` : '', step.water ? `💧+${step.water}` : ''].filter(
      Boolean,
    )
    if (gifts.length && flower) return `开出 ${flower}！获得 ${gifts.join(' ')}`
    if (gifts.length) return `拿到 ${gifts.join(' ')}！`
    if (flower) return `开出 ${flower}！本次没有阳光和水滴`
    return '做完啦！'
  }
  const base = completionReward(tree, step, tree.today, false)
  const early = !step.start || now - Date.parse(step.start) < step.minutes * 60000
  return `${flower ? `做完开出 ${flower}！` : ''}完成就得 ☀️+${base.sun} 💧+${base.water}。${early ? `提前完成奖励翻倍，额外得 ☀️+${base.sun} 💧+${base.water}！` : '坚持做完也有完整奖励！'}`
}

export function kidDayFits(tree: TreeData, step: WorkStep, day: string): boolean {
  const load = tree.steps
    .filter((p) => p.id !== step.id && !p.skipped && p.planned === day)
    .reduce((n, p) => n + p.stages.length, 0)
  return load + step.stages.length <= capacityOf(day)
}
