import type { LessonCharGroup } from './g1b/types'
import { charKey, getWeekStart } from '../utils/chinese-helpers'

export interface ChineseWeeklyPlanDay {
  date: string
  lessonKey: string
  newRecognizeKeys: string[]
  newWriteKeys: string[]
}

export interface ChineseWeekDayProgress {
  quizDone: boolean
  lastScore?: number
  completedAt?: string
  practiceCount?: number
  lastPracticedAt?: string
}

export interface ChineseWeeklyPlan {
  id?: string
  weekStart: string
  lessonKey: string
  weekStartDay: number
  newRecognizePerDay: number
  newWritePerDay: number
  days: ChineseWeeklyPlanDay[]
  progress: Record<string, ChineseWeekDayProgress>
}

export const CHINESE_PLAN_DEFAULTS: {
  weekStartDay: number
  newRecognizePerDay: number
  newWritePerDay: number
} = {
  weekStartDay: 4,
  newRecognizePerDay: 4,
  newWritePerDay: 3,
}

function addDays(isoDate: string, offset: number): string {
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function buildChineseWeeklyPlan(
  lessonGroups: LessonCharGroup[],
  lessonKey: string,
  weekStartDay = CHINESE_PLAN_DEFAULTS.weekStartDay,
  newRecognizePerDay = CHINESE_PLAN_DEFAULTS.newRecognizePerDay,
  newWritePerDay = CHINESE_PLAN_DEFAULTS.newWritePerDay,
  weekStart?: string,
  bookSlug = 'g1b',
): ChineseWeeklyPlan {
  const start = weekStart ?? getWeekStart(undefined, weekStartDay)
  const lessonIdx = Math.max(0, lessonGroups.findIndex((g) => g.lessonKey === lessonKey))
  const defaultLessonKey = lessonGroups[0]?.lessonKey ?? lessonKey

  const recognizeQueue: string[] = []
  const writeQueue: string[] = []
  for (let i = lessonIdx; i < lessonGroups.length; i++) {
    const group = lessonGroups[i]
    for (const ch of group.recognize) recognizeQueue.push(charKey(ch, bookSlug))
    for (const ch of group.write) writeQueue.push(charKey(ch, bookSlug))
  }

  const days: ChineseWeeklyPlanDay[] = []
  let activeLessonKey = lessonGroups[lessonIdx]?.lessonKey ?? lessonKey

  for (let d = 0; d < 7; d++) {
    const date = addDays(start, d)
    const newRecognizeKeys = recognizeQueue.splice(0, newRecognizePerDay)
    const newWriteKeys = writeQueue.splice(0, newWritePerDay)

    if (newRecognizeKeys.length === 0 && newWriteKeys.length === 0 && days.length > 0) {
      const prev = days[days.length - 1]
      days.push({
        date,
        lessonKey: prev.lessonKey,
        newRecognizeKeys: [],
        newWriteKeys: [],
      })
      continue
    }

    const groupForDay = lessonGroups.find((g) => g.lessonKey === activeLessonKey)
    if (groupForDay) {
      const nextIdx = lessonGroups.indexOf(groupForDay) + 1
      if (
        nextIdx < lessonGroups.length &&
        recognizeQueue.length === 0 &&
        writeQueue.length === 0
      ) {
        activeLessonKey = lessonGroups[nextIdx].lessonKey
      }
    }

    days.push({
      date,
      lessonKey: activeLessonKey,
      newRecognizeKeys,
      newWriteKeys,
    })
  }

  return {
    weekStart: start,
    lessonKey,
    weekStartDay,
    newRecognizePerDay,
    newWritePerDay,
    days,
    progress: {},
  }
}

export function parseChinesePlanFromRow(
  row: Record<string, unknown>,
  defaultLessonKey: string,
): ChineseWeeklyPlan {
  const days = (row.days as ChineseWeeklyPlanDay[] | null) ?? []
  const progress = (row.progress as Record<string, ChineseWeekDayProgress> | null) ?? {}
  return {
    id: row.id as string | undefined,
    weekStart: row.week_start as string,
    lessonKey: (row.lesson_key as string) ?? defaultLessonKey,
    weekStartDay: (row.week_start_day as number) ?? CHINESE_PLAN_DEFAULTS.weekStartDay,
    newRecognizePerDay:
      (row.new_recognize_per_day as number) ?? CHINESE_PLAN_DEFAULTS.newRecognizePerDay,
    newWritePerDay: (row.new_write_per_day as number) ?? CHINESE_PLAN_DEFAULTS.newWritePerDay,
    days,
    progress,
  }
}

export function serializeChinesePlanForSupabase(plan: ChineseWeeklyPlan) {
  return {
    user_id: '',
    week_start: plan.weekStart,
    lesson_key: plan.lessonKey,
    week_start_day: plan.weekStartDay,
    new_recognize_per_day: plan.newRecognizePerDay,
    new_write_per_day: plan.newWritePerDay,
    days: plan.days,
    progress: plan.progress,
    updated_at: new Date().toISOString(),
  }
}
