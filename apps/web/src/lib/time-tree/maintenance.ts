import type { SupabaseClient } from '@supabase/supabase-js'
import type { Homework } from '@rosie/tasks'
import { newTree, placeTodayBubbles, roll } from './engine'
import { hasRowChanges, rowChanges } from './rowChanges'
import { schedule } from './schedule'
import { dayOf, shift, PRACTICE_SCHEDULE_VERSION, WEEKLY_SCHEDULE_VERSION, type TreeData } from './types'

export async function loadHomeworkTemplates(db: SupabaseClient, userId: string): Promise<Homework[]> {
  const templates: Homework[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('task_homework').select('*')
      .eq('user_id', userId).eq('enabled', true).order('id').range(offset, offset + 499)
    if (error) throw error
    templates.push(...(data as Homework[]))
    if (data.length < 500) return templates
  }
}

export async function maintainTimeTree(db: SupabaseClient, userId: string): Promise<boolean> {
  const command = { kind: 'sync' }
  const operationId = crypto.randomUUID()
  for (let attempt = 0; attempt < 3; attempt++) {
    const today = dayOf(new Date())
    const { data, error } = await db.rpc('read_time_tree_command', {
      p_user: userId, p_command: command, p_operation: operationId, p_today: today, p_ids: [],
      p_known: null, p_known_day: null, p_known_homework: null,
      p_weekly: WEEKLY_SCHEDULE_VERSION, p_practice: PRACTICE_SCHEDULE_VERSION,
    })
    if (error) throw error

    const original = (data.saved?.tree ?? null) as TreeData | null
    const tree = original ? structuredClone(original) : newTree(today)
    const previousDay = tree.today
    roll(tree, today)
    if (data.schedule) {
      const templates = await loadHomeworkTemplates(db, userId)
      schedule(tree, templates, previousDay, shift(today, 6))
    }
    placeTodayBubbles(tree)
    const delta = rowChanges(original, tree)
    if (!data.schedule && !hasRowChanges(delta)) return false

    const result = await db.rpc('commit_time_tree_rows', {
      p_user: userId, p_base: Number(data.saved?.revision ?? 0), p_operation: operationId, p_command: command,
      p_delta: delta, p_homework: data.schedule ? data.homeworkRevision : null,
    })
    if (!result.error) return true
    if (result.error.message !== 'tree_changed') throw result.error
  }
  throw new Error('tree_changed')
}
