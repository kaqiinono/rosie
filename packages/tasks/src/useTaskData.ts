'use client'

import { createUserSessionStore, supabase, useAuth } from '@rosie/core'
import { mergeTaskSnapshot } from './taskProgress'
import type { TaskInstance } from './types'
import { saveCourseWithCatchup } from './courseEvents'
import { builtInTemplates } from './defaults'
import type { CourseInput, RuleInput } from './types'
import type { CourseDomainData } from './courseTypes'

const tables = {
  courses: 'task_courses',
  rules: 'task_timetable_rules',
  exceptions: 'task_course_exceptions',
  occurrences: 'task_course_occurrences',
  templates: 'task_templates',
  tasks: 'task_instances',
  day_states: 'task_availability_day_states',
  windows: 'task_availability_windows',
  blocks: 'task_time_blocks',
  materials: 'task_materials',
  progress: 'task_lesson_progress',
  scopes: 'task_unit_scopes',
  reminders: 'task_reminders',
  calendars: 'task_calendars',
  exams: 'task_exams',
  preferences: 'task_timetable_preferences',
  snapshots: 'task_timetable_snapshots',
  course_rules: 'task_timetable_rules',
  events: 'task_course_events',
  catalog_snapshots: 'task_course_catalog_snapshots',
  bindings: 'task_course_pool_bindings',
  pool_items: 'task_templates',
} as const
export type DataKey = keyof typeof tables
type Row<K extends DataKey> = CourseDomainData[K][number]
const empty: CourseDomainData = {
  courses: [],
  rules: [],
  exceptions: [],
  occurrences: [],
  templates: [],
  tasks: [],
  day_states: [],
  windows: [],
  blocks: [],
  materials: [],
  progress: [],
  scopes: [],
  reminders: [],
  calendars: [],
  exams: [],
  preferences: [],
  snapshots: [],
  course_rules: [],
  events: [],
  catalog_snapshots: [],
  bindings: [],
  pool_items: [],
}

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
    // Legacy timetable consumers must never receive flexible rules with null times.
    const compatible =
      key === 'rules' ? (data ?? []).filter((row) => row.kind !== 'flexible') : (data ?? [])
    rows.push(...(compatible as Row<K>[]))
    if (!data || data.length < 500) break
  }
  return rows
}
const store = createUserSessionStore<CourseDomainData>('independent_tasks', {
  empty,
  fetch: async (userId) => {
    const { error: initError } = await supabase.rpc('task_initialize', {
      p_templates: builtInTemplates(),
    })
    if (initError) throw initError
    const { error } = await supabase.rpc('task_tick', { p_user: userId })
    if (error) throw error
    const entries = await Promise.all(
      (Object.keys(tables) as DataKey[])
        .filter((key) => key !== 'rules' && key !== 'templates')
        .map(async (key) => [key, await loadRows(key, userId)] as const),
    )
    const data: CourseDomainData = { ...empty, ...Object.fromEntries(entries) }
    data.rules = data.course_rules.filter((rule) => rule.kind === 'timetabled') as typeof data.rules
    data.templates = data.pool_items
    const current = store.getSessionData(userId)?.tasks ?? []
    // Tasks cannot be deleted by clients: current-only rows may be successful creations
    // committed after this fetch's task SELECT, while its other table reads were pending.
    const tasksById = new Map(current.map((task) => [task.id, task]))
    for (const task of data.tasks) {
      const cached = tasksById.get(task.id)
      tasksById.set(task.id, cached ? mergeTaskSnapshot(cached, task) : task)
    }
    data.tasks = [...tasksById.values()]
    return data
  },
})

function reconcileAliases(data: CourseDomainData, changed: DataKey): CourseDomainData {
  if (changed === 'templates') data.pool_items = data.templates as CourseDomainData['pool_items']
  if (changed === 'pool_items') data.templates = data.pool_items
  if (changed === 'rules') {
    const flexible = data.course_rules.filter((rule) => rule.kind === 'flexible')
    data.course_rules = [
      ...flexible,
      ...data.rules.map((rule) => ({ ...rule, kind: 'timetabled' as const })),
    ]
  }
  if (changed === 'course_rules')
    data.rules = data.course_rules.filter((rule) => rule.kind === 'timetabled') as typeof data.rules
  return data
}

export function useTaskData() {
  const { user } = useAuth()
  const state = store.useSessionData(user)
  async function refresh() {
    if (user) await store.refreshInBackground(user.id)
  }
  async function save<K extends DataKey>(key: K, row: Partial<Row<K>>) {
    if (!user) throw new Error('请先登录')
    if (key === 'tasks') {
      const task = row as Partial<TaskInstance>
      return (await execution('task_save_execution', {
        p_task: task,
        p_expected_revision: task.id
          ? (task.revision ?? state.data.tasks.find((t) => t.id === task.id)?.revision)
          : null,
      })) as Row<K>
    }
    const payload = { ...row, user_id: user.id }
    const query = row.id
      ? supabase.from(tables[key]).update(payload).eq('user_id', user.id).eq('id', row.id)
      : supabase.from(tables[key]).insert(payload)
    const { data, error } = await query.select().single()
    if (error) throw error
    const next = data as Row<K>
    store.patchSessionData(user.id, (prev) => {
      const updated = {
        ...prev,
        [key]: [...(prev[key] as Row<K>[]).filter((r) => r.id !== next.id), next],
      }
      if (key === 'templates' || key === 'pool_items' || key === 'rules' || key === 'course_rules')
        return reconcileAliases(updated, key)
      return updated
    })
    return next
  }
  async function execution(name: string, args: Record<string, unknown>): Promise<TaskInstance> {
    if (!user) throw new Error('请先登录')
    const { data, error } = await supabase.rpc(name, args)
    if (error) throw error
    const next = data as TaskInstance
    store.patchSessionData(user.id, (prev) => ({
      ...prev,
      tasks: prev.tasks.some((t) => t.id === next.id)
        ? prev.tasks.map((t) => (t.id === next.id ? mergeTaskSnapshot(t, next) : t))
        : [...prev.tasks, next],
    }))
    return next
  }
  async function remove(key: DataKey, id: string) {
    if (!user) throw new Error('请先登录')
    if (key === 'tasks') throw new Error('请取消任务以保留学习历史')
    if (key === 'courses') {
      await archiveCourse(id)
      return
    }
    if (key === 'rules' || key === 'course_rules')
      throw new Error('请通过课程编辑器停用时段，以保留历史')
    const { error } = await supabase.from(tables[key]).delete().eq('user_id', user.id).eq('id', id)
    if (error) throw error
    store.patchSessionData(user.id, (prev) => {
      const updated = { ...prev, [key]: prev[key].filter((r) => r.id !== id) }
      return key === 'templates' || key === 'pool_items' ? reconcileAliases(updated, key) : updated
    })
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    if (!user) throw new Error('请先登录')
    const { data, error } = await supabase.rpc(name, args)
    if (error) throw error
    await refresh()
    return data as unknown
  }
  async function saveCourse(
    course: CourseInput,
    rules: RuleInput[],
    effectiveFrom?: string,
  ): Promise<string> {
    return saveCourseWithCatchup(async () => {
      if (!user) throw new Error('请先登录')
      const { data, error } = await supabase.rpc('task_save_course', {
        p_course: course,
        p_rules: rules,
        p_effective_from: effectiveFrom || null,
      })
      if (error) throw error
      return data as string | null
    }, refresh)
  }
  async function archiveCourse(id: string) {
    await saveCourseWithCatchup(async () => {
      const result = (await rpc('task_archive_course_runtime', { p_course: id })) as {
        status: string
      }
      return result.status === 'updated' ? id : null
    }, refresh)
  }
  return {
    ...state,
    user,
    execution,
    setCompletion: (task: TaskInstance, percent: number) =>
      execution('task_set_completion', {
        p_task_id: task.id,
        p_percent: percent,
        p_expected_revision: task.revision,
      }),
    setItemDone: (task: TaskInstance, key: string, done: boolean) =>
      execution('task_set_item_done', { p_task_id: task.id, p_item_key: key, p_done: done }),
    setEstimate: (task: TaskInstance, minutes: number) =>
      execution('task_set_estimate', {
        p_task_id: task.id,
        p_minutes: minutes,
        p_expected_revision: task.revision,
      }),
    setAvailability: (
      weekday: number | null,
      date: string | null,
      configuration: string,
      start: string | null,
      end: string | null,
    ) =>
      rpc('task_set_availability', {
        p_weekday: weekday,
        p_date: date,
        p_state: configuration,
        p_start: start,
        p_end: end,
      }),
    save,
    remove,
    rpc,
    refresh,
    saveCourse,
    archiveCourse,
  }
}
export type TaskDataApi = ReturnType<typeof useTaskData>
