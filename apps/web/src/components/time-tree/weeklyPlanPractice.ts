import type { WeeklyPlan } from '@rosie/core'
import type { PracticeEntryRow } from '@rosie/tasks'

type PracticeItem = { row?: PracticeEntryRow | null; href?: string | null }

export function isDailyEnglishPlanPath(href?: string | null): boolean {
  return /^\/english\/words\/daily\/?(?:[?#]|$)/.test(href ?? '')
}

export function weeklyPlanForDate<Plan extends Pick<WeeklyPlan, 'id' | 'weekStart' | 'days'>>(
  plans: readonly Plan[],
  date: string,
): Plan | undefined {
  let match: Plan | undefined
  for (const plan of plans) {
    if (!plan.id || (match && plan.weekStart <= match.weekStart)) continue
    if (plan.days.some(day => day.date === date && day.newWordKeys.length > 0)) match = plan
  }
  return match
}

export function weeklyPlanPracticeTarget({ row, href }: PracticeItem): { planId: string; date: string } | null {
  if (row?.values.contentType === 'english-plan' && row.values.planId && /^\d{4}-\d{2}-\d{2}$/.test(row.values.date ?? '')) {
    return { planId: row.values.planId, date: row.values.date }
  }
  const match = href?.match(/^\/english\/words\/weekly\/([^/?#]+)\/practice\/?\?([^#]*)/)
  if (!match) return null
  const date = new URLSearchParams(match[2]).get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  try { return { planId: decodeURIComponent(match[1]), date } } catch { return null }
}

export function hasWeeklyPlanPractice(content?: (PracticeItem & { items?: PracticeItem[] }) | null): boolean {
  return !!content && (content.items?.length ? content.items : [content]).some(item => weeklyPlanPracticeTarget(item) !== null)
}
