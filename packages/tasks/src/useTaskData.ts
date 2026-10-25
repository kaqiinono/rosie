'use client'

import { createUserSessionStore, supabase, useAuth } from '@rosie/core'
import { builtInTemplates } from './defaults'
import type { TaskData, CourseInput, RuleInput } from './types'

const tables = { courses: 'task_courses', rules: 'task_timetable_rules', exceptions: 'task_course_exceptions', occurrences: 'task_course_occurrences', templates: 'task_templates', tasks: 'task_instances', windows: 'task_availability_windows', blocks: 'task_time_blocks', materials: 'task_materials', progress: 'task_lesson_progress', scopes: 'task_unit_scopes', reminders: 'task_reminders', calendars: 'task_calendars', exams: 'task_exams', preferences: 'task_timetable_preferences', snapshots: 'task_timetable_snapshots' } as const
export type DataKey = keyof typeof tables
type Row<K extends DataKey> = TaskData[K][number]
const empty: TaskData = { courses: [], rules: [], exceptions: [], occurrences: [], templates: [], tasks: [], windows: [], blocks: [], materials: [], progress: [], scopes: [], reminders: [], calendars: [], exams: [], preferences: [], snapshots: [] }

async function loadRows<K extends DataKey>(key: K, userId: string): Promise<Row<K>[]> {
  const rows: Row<K>[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(tables[key]).select('*').eq('user_id', userId).order('id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...(data ?? []) as Row<K>[])
    if (!data || data.length < 500) break
  }
  return rows
}
const store = createUserSessionStore<TaskData>('independent_tasks', {
  empty,
  fetch: async userId => {
    const { error: initError } = await supabase.rpc('task_initialize', { p_templates: builtInTemplates() })
    if (initError) throw initError
    const { error } = await supabase.rpc('task_tick', { p_user: userId })
    if (error) throw error
    const entries = await Promise.all((Object.keys(tables) as DataKey[]).map(async key => [key, await loadRows(key, userId)] as const))
    return Object.fromEntries(entries) as TaskData
  },
})

export function useTaskData() {
  const { user } = useAuth()
  const state = store.useSessionData(user)
  async function refresh() { if (user) await store.refreshInBackground(user.id) }
  async function save<K extends DataKey>(key: K, row: Partial<Row<K>>) {
    if (!user) throw new Error('请先登录')
    const payload = { ...row, user_id: user.id }
    const query = row.id
      ? supabase.from(tables[key]).update(payload).eq('user_id', user.id).eq('id', row.id)
      : supabase.from(tables[key]).insert(payload)
    const { data, error } = await query.select().single()
    if (error) throw error
    const next = data as Row<K>
    store.patchSessionData(user.id, prev => ({ ...prev, [key]: [...(prev[key] as Row<K>[]).filter(r => r.id !== next.id), next] }))
    return next
  }
  async function remove(key: DataKey, id: string) {
    if (!user) throw new Error('请先登录')
    if (key === 'courses') { await archiveCourse(id); return }
    if (key === 'rules') throw new Error('请通过课程编辑器停用时段，以保留历史')
    const { error } = await supabase.from(tables[key]).delete().eq('user_id', user.id).eq('id', id)
    if (error) throw error
    store.patchSessionData(user.id, prev => ({ ...prev, [key]: prev[key].filter(r => r.id !== id) }))
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    if (!user) throw new Error('请先登录')
    const { data, error } = await supabase.rpc(name, args)
    if (error) throw error
    await refresh()
    return data as unknown
  }
  async function saveCourse(course: CourseInput, rules: RuleInput[], effectiveFrom?: string): Promise<string> {
    return await rpc('task_save_course', { p_course: course, p_rules: rules, p_effective_from: effectiveFrom || null }) as string
  }
  async function archiveCourse(id: string) { await rpc('task_archive_course', { p_course: id }) }
  return { ...state, user, save, remove, rpc, refresh, saveCourse, archiveCourse }
}
export type TaskDataApi = ReturnType<typeof useTaskData>
