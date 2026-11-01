'use client'

import { createUserSessionStore, supabase, useAuth } from '@rosie/core'
import type { TimetableData, TimetableCourse, CourseInput, RuleInput } from './types'

const tables = {
  preferences: 'task_timetable_preferences',
  courses: 'task_courses',
  rules: 'task_timetable_rules',
  exceptions: 'task_course_exceptions',
  calendars: 'task_calendars',
} as const
type DataKey = keyof typeof tables
type Row<K extends DataKey> = TimetableData[K][number]

async function loadRows<K extends DataKey>(key: K, userId: string): Promise<Row<K>[]> {
  const rows: Row<K>[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from(tables[key])
      .select('*')
      .eq('user_id', userId)
      .order('id')
      .range(offset, offset + 499)
    if (error) throw error
    rows.push(...((data ?? []) as Row<K>[]))
    if (!data || data.length < 500) break
  }
  return rows
}

const store = createUserSessionStore<TimetableData>('timetable', {
  empty: { preferences: [], courses: [], rules: [], exceptions: [], calendars: [] },
  fetch: async userId => {
    const [courses, rules, exceptions, calendars, preferences] = await Promise.all([
      loadRows('courses', userId), loadRows('rules', userId),
      loadRows('exceptions', userId), loadRows('calendars', userId), loadRows('preferences', userId),
    ])
    return { courses, rules, exceptions, calendars, preferences }
  },
})

export function useTimetableData() {
  const { user } = useAuth()
  const state = store.useSessionData(user)
  async function refresh() {
    if (user) await store.refreshInBackground(user.id)
  }
  function owner() {
    if (!user) throw new Error('请先登录。')
    return user.id
  }

  async function mutateRpc(name: string, args: Record<string, unknown>) {
    const userId = owner()
    const { data, error } = await supabase.rpc(name, args)
    if (error) throw new Error(error.message)
    // A committed mutation remains successful if the subsequent read fails.
    await store.refreshInBackground(userId).catch(() => {})
    return data
  }

  const saveCourse = (course: CourseInput, rules: RuleInput[], effective?: string) =>
    mutateRpc('task_save_course', { p_course: course, p_rules: rules, p_effective_from: effective ?? null })
  const setArchived = (course: TimetableCourse, archived: boolean) =>
    mutateRpc('task_set_course_archived', { p_course: course.id, p_revision: course.rules_revision, p_archived: archived })
  const copyCalendar = async (source: string, target: string, name: string, start: string, end: string | null) =>
    String(await mutateRpc('task_copy_calendar', { p_source: source, p_target: target, p_name: name, p_start: start, p_end: end }))

  async function save<K extends 'calendars' | 'preferences' | 'exceptions'>(
    key: K, input: Omit<Row<K>, 'id' | 'user_id' | 'created_at'> & { id?: string },
  ) {
    const userId = owner()
    const onConflict = { calendars: 'id', preferences: 'user_id', exceptions: 'user_id,rule_id,original_date' }[key]
    const { data, error } = await supabase.from(tables[key])
      .upsert({ ...input, user_id: userId }, { onConflict }).select('id').single()
    if (error) throw new Error(error.message)
    await store.refreshInBackground(userId).catch(() => {})
    return { id: String(data.id) }
  }

  async function removeException(id: string) {
    const userId = owner()
    const { error } = await supabase.from(tables.exceptions).delete().eq('user_id', userId).eq('id', id)
    if (error) throw new Error(error.message)
    await store.refreshInBackground(userId).catch(() => {})
  }

  return { ...state, user, refresh, save, saveCourse, setArchived, copyCalendar, removeException }
}
