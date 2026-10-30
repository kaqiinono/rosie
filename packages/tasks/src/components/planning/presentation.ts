import type { BatchStatus, TaskAllocation } from '../../planning/types'
export const riskLabels: Record<BatchStatus, string> = {
  weekday_feasible: '周中可完成',
  tight: '余量紧张',
  weekend_required: '需周末备用',
  adjustment_required: '需调整安排',
  insufficient: '容量不足',
  incomplete: '信息不完整',
  completed: '无剩余工作',
}
export const riskOrder: Record<BatchStatus, number> = {
  incomplete: 0,
  insufficient: 1,
  adjustment_required: 2,
  weekend_required: 3,
  tight: 4,
  weekday_feasible: 5,
  completed: 6,
}
export function planningTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
export function planningDay(value: string) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' })
}
export function allocationKey(a: TaskAllocation) {
  return JSON.stringify([a.demand_key, a.start, a.end, a.fixed])
}
