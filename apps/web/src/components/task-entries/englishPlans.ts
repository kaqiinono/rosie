import { supabase, type WeeklyPlan, type WordEntry } from '@rosie/core'
import { ALL_CN_DAYS, fmtDate, formatPlanLessonLabel, parsePlanDataFromSupabase } from '@rosie/english'
import type { PracticeEntryRow } from '@rosie/tasks'
import { readAll } from './catalogData'

/** One row per plan day. Homework advances to the next date after each completion. */
export const weeklyPlanPracticePath = '/english/words/weekly/{planId}/practice?date={date}'

export function adaptivePlanPracticePath(planId: string): string {
  return `/english/words/adaptive/${encodeURIComponent(planId)}/practice`
}

export function isAdaptivePlanPath(path: string): boolean {
  return /^\/english\/words\/adaptive\/[^/]+\/practice\/?$/.test(path)
}

export function weeklyPlanTitle(plan: Pick<WeeklyPlan, 'unit' | 'lesson' | 'weekStart'>): string {
  return formatPlanLessonLabel(plan.unit, plan.lesson) || `多日计划 ${fmtDate(plan.weekStart)}`
}

function weekdayLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00`)
  return ALL_CN_DAYS[parsed.getDay()] ?? ''
}

function wordText(key: string, vocab: Array<Pick<WordEntry, 'unit' | 'lesson' | 'word'>>): string {
  return vocab.find((word) => `${word.unit}::${word.lesson}::${word.word}` === key)?.word ?? key.split('::').pop() ?? key
}

/** Ordered practice rows for a saved multi-day plan. Days without words are omitted. */
export function weeklyPlanRows(plan: WeeklyPlan, vocab: Array<Pick<WordEntry, 'unit' | 'lesson' | 'word'>>): PracticeEntryRow[] {
  if (!plan.id) return []
  const title = weeklyPlanTitle(plan)
  return [...plan.days]
    .filter((day) => day.newWordKeys.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const words = day.newWordKeys.map((key) => wordText(key, vocab))
      const shown = words.slice(0, 8).join('、')
      const when = `${fmtDate(day.date)} ${weekdayLabel(day.date)}`
      return {
        id: `english-plan:${plan.id}:${day.date}`,
        label: `${when} · ${shown}${words.length > 8 ? ` 等${words.length}个` : ''}`,
        selectionPath: [{ level: '计划', id: plan.id!, label: title }],
        values: { planId: plan.id!, date: day.date, contentType: 'english-plan' },
        content: [{ title: '单词', text: words.join('、') }],
      }
    })
}

/** Merge plan days chronologically; overlapping plans keep their separate practice rows. */
export function sortEnglishPlanRows(rows: PracticeEntryRow[]): PracticeEntryRow[] {
  return [...rows].sort((a, b) => (a.values.date ?? '').localeCompare(b.values.date ?? '') || a.id.localeCompare(b.id))
}

function planFromRow(row: {
  id: string
  week_start: string
  unit: string
  lesson: string
  week_start_day: number | null
  new_words_per_day: number | null
  plan_data: unknown
}): WeeklyPlan {
  const parsed = parsePlanDataFromSupabase(row.plan_data)
  return {
    id: row.id,
    weekStart: row.week_start,
    unit: row.unit,
    lesson: row.lesson,
    weekStartDay: row.week_start_day ?? 4,
    newWordsPerDay: row.new_words_per_day ?? 3,
    days: parsed.days,
    progress: {},
    ...(parsed.previewLessonKeys !== undefined ? { previewLessonKeys: parsed.previewLessonKeys } : {}),
    ...(parsed.wordKinds !== undefined ? { wordKinds: parsed.wordKinds } : {}),
    ...(parsed.focusLessonKey !== undefined ? { focusLessonKey: parsed.focusLessonKey } : {}),
    ...(parsed.batchMode !== undefined ? { batchMode: parsed.batchMode } : {}),
  }
}

/** Re-read every saved multi-day plan and rebuild the date list. Missing plans stay unchanged. */
export async function refreshEnglishPlanRows(rows: PracticeEntryRow[]): Promise<PracticeEntryRow[]> {
  const planIds = [...new Set(rows.filter((row) => row.values.contentType === 'english-plan').map((row) => row.values.planId).filter(Boolean))]
  if (!planIds.length) return rows
  const { data, error } = await supabase
    .from('weekly_plans')
    .select('id, week_start, unit, lesson, week_start_day, new_words_per_day, plan_data')
    .in('id', planIds)
  if (error) throw error
  if (!data?.length) return rows
  const words = await readAll<Pick<WordEntry, 'unit' | 'lesson' | 'word'>>('word_entries', 'unit,lesson,word', 'id')
  const refreshedIds = new Set(data.map((plan) => plan.id))
  const retained = rows.filter((row) => row.values.contentType !== 'english-plan' || !refreshedIds.has(row.values.planId))
  const built = data.flatMap((plan) => weeklyPlanRows(planFromRow(plan), words))
  const previous = new Map(rows.map((row) => [row.id, row]))
  return sortEnglishPlanRows([...retained, ...built.map((row) => {
    const saved = previous.get(row.id)
    return saved ? { ...row, resources: saved.resources, hiddenResourceIds: saved.hiddenResourceIds } : row
  })])
}
