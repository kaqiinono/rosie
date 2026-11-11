import { dateAfter } from './time'

export type HomeworkSubject = 'chinese' | 'math' | 'english' | 'life'
export type HomeworkCycle = 'daily' | 'weekly' | 'biweekly' | 'three_weekly' | 'monthly' | 'custom'
export const HOMEWORK_PRIORITIES = ['P0', 'P1', 'P2', 'P3', 'P4'] as const
export type HomeworkPriority = (typeof HOMEWORK_PRIORITIES)[number]

export const HOMEWORK_SUBJECTS: Record<HomeworkSubject, string> = {
  chinese: '语文',
  math: '数学',
  english: '英语',
  life: '生活',
}
export const HOMEWORK_CYCLES: Record<HomeworkCycle, string> = {
  daily: '每天',
  weekly: '每周',
  biweekly: '每两周',
  three_weekly: '每三周',
  monthly: '每月',
  custom: '自定义',
}
export const HOMEWORK_SUBJECT_COLORS: Record<HomeworkSubject, 'red' | 'blue' | 'green' | 'amber'> =
  {
    chinese: 'red',
    math: 'blue',
    english: 'green',
    life: 'amber',
  }
export const MAX_HOMEWORK_MINUTES = 120
export const HOMEWORK_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
/** 周一排在前面，值沿用 0=周日 … 6=周六。 */
export const HOMEWORK_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export interface Homework {
  id: string
  user_id: string
  name: string
  subject: HomeworkSubject
  priority: HomeworkPriority
  cycle: HomeworkCycle
  times_per_week: number | null
  times_per_cycle: number | null
  start_weekday: number | null
  end_weekday: number | null
  start_date: string | null
  end_date: string | null
  estimated_minutes: number
  notes: string
  enabled: boolean
  created_at: string
  updated_at: string
}

/** 表单与写库共用的字段；id 存在表示编辑。 */
export type HomeworkInput = Omit<Homework, 'id' | 'user_id' | 'created_at' | 'updated_at'>

export const EMPTY_HOMEWORK: HomeworkInput = {
  name: '',
  subject: 'chinese',
  priority: 'P2',
  cycle: 'daily',
  times_per_week: null,
  times_per_cycle: null,
  start_weekday: null,
  end_weekday: null,
  start_date: null,
  end_date: null,
  estimated_minutes: 20,
  notes: '',
  enabled: true,
}

export function needsCycleStart(cycle: HomeworkCycle): boolean {
  return cycle === 'biweekly' || cycle === 'three_weekly'
}

export function usesCycleCount(cycle: HomeworkCycle): boolean {
  return needsCycleStart(cycle) || cycle === 'monthly'
}

export function describeNextHomeworkDates(
  item: Pick<Homework, 'cycle' | 'times_per_cycle' | 'start_date'>,
): string {
  if (!needsCycleStart(item.cycle) || item.times_per_cycle !== 1 || !item.start_date) return ''
  const cycleDays = item.cycle === 'biweekly' ? 14 : 21
  const generatedOn = dateAfter(item.start_date, cycleDays)
  const endsOn = dateAfter(item.start_date, cycleDays + 7)
  return `下次生成日期 ${generatedOn}，下次结束日期 ${endsOn}`
}

/** 周期切换后补齐/清理该周期对应的字段，保证与数据库约束一致。 */
export function withCycle(
  input: HomeworkInput,
  cycle: HomeworkCycle,
  today: string,
): HomeworkInput {
  const start = input.start_date || today
  return {
    ...input,
    cycle,
    times_per_week: cycle === 'weekly' || cycle === 'custom' ? input.times_per_week ?? 1 : null,
    times_per_cycle: usesCycleCount(cycle) ? input.times_per_cycle ?? 1 : null,
    start_weekday: cycle === 'weekly' ? input.start_weekday ?? 1 : null,
    end_weekday: cycle === 'weekly' ? input.end_weekday ?? 0 : null,
    start_date: needsCycleStart(cycle) || cycle === 'custom' ? start : null,
    end_date: cycle === 'custom' ? input.end_date ?? start : null,
  }
}

/** 每周窗口内可选的天数（支持跨周，如周五到周一）。 */
export function weekdaySpan(start: number, end: number): number {
  return ((end - start + 7) % 7) + 1
}

/** 返回第一条错误提示；通过校验返回空串。 */
export function validateHomework(input: HomeworkInput): string {
  if (!input.name.trim()) return '请填写作业名称。'
  if (!HOMEWORK_PRIORITIES.includes(input.priority)) return '请选择作业优先级。'
  if (input.name.trim().length > 120) return '作业名称最多 120 个字。'
  if (
    !Number.isInteger(input.estimated_minutes) ||
    input.estimated_minutes < 1 ||
    input.estimated_minutes > MAX_HOMEWORK_MINUTES
  ) {
    return `预计耗时应为 1–${MAX_HOMEWORK_MINUTES} 分钟。`
  }
  if (input.notes.length > 2000) return '备注最多 2000 个字。'
  if (input.cycle === 'daily') return ''
  if (usesCycleCount(input.cycle)) {
    const count = input.times_per_cycle
    if (count == null || !Number.isInteger(count) || count < 1 || count > 2147483647)
      return '每周期完成次数须为有效的正整数。'
    if (needsCycleStart(input.cycle) && !input.start_date) return '请选择周期开始日期。'
    return ''
  }
  if (
    !Number.isInteger(input.times_per_week) ||
    (input.times_per_week ?? 0) < 1 ||
    (input.times_per_week ?? 0) > 7
  ) {
    return '每周次数应为 1–7。'
  }
  if (input.cycle === 'weekly') {
    if (input.start_weekday == null || input.end_weekday == null)
      return '请选择开始星期和结束星期。'
    if ((input.times_per_week ?? 0) > weekdaySpan(input.start_weekday, input.end_weekday))
      return '每周次数不能超过生效时段内的天数。'
    return ''
  }
  if (!input.start_date || !input.end_date) return '请选择开始日期和结束日期。'
  if (input.end_date < input.start_date) return '结束日期不能早于开始日期。'
  return ''
}

/** 列表里的周期说明，如「每周 · 周一至周五 · 3 次」。 */
export function describeSchedule(
  item: Pick<
    Homework,
    'cycle' | 'times_per_week' | 'times_per_cycle' | 'start_weekday' | 'end_weekday' | 'start_date' | 'end_date'
  >,
): string {
  if (item.cycle === 'daily') return '每天'
  if (item.cycle === 'monthly') return `每个自然月完成 ${item.times_per_cycle} 次`
  if (needsCycleStart(item.cycle)) {
    const rule = `从 ${item.start_date} 起，${HOMEWORK_CYCLES[item.cycle]}完成 ${item.times_per_cycle} 次`
    const nextDates = describeNextHomeworkDates(item)
    return nextDates ? `${rule}。${nextDates}` : rule
  }
  const times = `每周 ${item.times_per_week ?? 1} 次`
  if (item.cycle === 'weekly' && item.start_weekday != null && item.end_weekday != null) {
    const range =
      item.start_weekday === item.end_weekday
        ? HOMEWORK_WEEKDAYS[item.start_weekday]
        : `${HOMEWORK_WEEKDAYS[item.start_weekday]}至${HOMEWORK_WEEKDAYS[item.end_weekday]}`
    return `每周 · ${range} · ${times}`
  }
  return `自定义 · ${item.start_date ?? ''} 至 ${item.end_date ?? ''} · ${times}`
}
