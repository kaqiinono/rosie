import { completionReward } from '@/lib/time-tree/rewards'
import { elapsed, type TreeData, type WorkStep } from '@/lib/time-tree/types'

/** 孩子卡片上的说明：这次备注优先，否则用作业说明。 */
export function kidNote(step: WorkStep): string {
  return step.planNote?.trim() || step.notes.trim()
}

export function kidTime(step: WorkStep, now: number): string {
  if (step.skipped) return '这次先休息，不用做啦'
  if (step.flowers) {
    if (step.end) return step.flowers.complete ? '整份做完啦' : '本次已收工'
    if (step.start) return `本次已做 ${Math.max(0, Math.floor((now - Date.parse(step.start)) / 60000))} 分钟`
    return `整份预计 ${step.minutes} 分钟`
  }
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

export function kidReward(tree: TreeData, step: WorkStep, now: number) {
  if (step.skipped) return null
  if (step.end) {
    return { flowers: step.stages.length, sun: step.sun, water: step.water }
  }
  const early = !step.start || now - Date.parse(step.start) < step.minutes * 60000
  return { flowers: step.stages.length, ...completionReward(tree, step, tree.today, early) }
}

