import type { PracticeEntryRow } from '@rosie/tasks'

type PracticeItem = { row?: PracticeEntryRow | null; href?: string | null }

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
