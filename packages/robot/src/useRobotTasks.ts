'use client'

import { useState, useCallback, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@rosie/core'
import type { RobotTask, RobotTaskInput } from './robot-types'

const TABLE = 'robot_tasks'
const SELECT_COLS =
  'id, title, content, start_time, end_time, reward_coins, quick_link, completed_at, sort_order'

interface RobotTaskRow {
  id: string
  title: string
  content: string
  start_time: string
  end_time: string
  reward_coins: number
  quick_link: string
  completed_at: string | null
  sort_order: number
}

function rowToTask(r: RobotTaskRow): RobotTask {
  return {
    id: r.id,
    title: r.title,
    content: r.content,
    startTime: r.start_time,
    endTime: r.end_time,
    rewardCoins: r.reward_coins,
    quickLink: r.quick_link,
    completedAt: r.completed_at,
    sortOrder: r.sort_order,
  }
}

/** Next per-user sequential id: max existing task_<n> + 1, zero-padded to 3. */
function nextTaskId(tasks: RobotTask[]): string {
  let max = 0
  for (const t of tasks) {
    const m = /^task_(\d+)$/.exec(t.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `task_${String(max + 1).padStart(3, '0')}`
}

export function useRobotTasks(user: User | null) {
  const [tasks, setTasks] = useState<RobotTask[]>([])
  const [loading, setLoading] = useState<boolean>(user !== null)

  const refresh = useCallback(async () => {
    if (!user) {
      setTasks([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from(TABLE)
      .select(SELECT_COLS)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
    if (error) console.error('[robot] fetch failed', error)
    else setTasks((data as RobotTaskRow[]).map(rowToTask))
    setLoading(false)
  }, [user])

  // Initial / user-change load, guarded against setState after unmount.
  useEffect(() => {
    if (!user) {
      setTasks([])
      return
    }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select(SELECT_COLS)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
      if (cancelled) return
      if (error) console.error('[robot] fetch failed', error)
      else setTasks((data as RobotTaskRow[]).map(rowToTask))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const addTask = useCallback(
    async (input: RobotTaskInput) => {
      if (!user) return
      // id & sort_order derived from local state; acceptable for single-user admin use.
      const id = nextTaskId(tasks)
      const sortOrder = tasks.reduce((max, t) => Math.max(max, t.sortOrder), -1) + 1
      const { error } = await supabase.from(TABLE).insert({
        id,
        user_id: user.id,
        title: input.title,
        content: input.content,
        start_time: input.startTime,
        end_time: input.endTime,
        reward_coins: input.rewardCoins,
        quick_link: input.quickLink,
        sort_order: sortOrder,
      })
      if (error) {
        console.error('[robot] add failed', error)
        return
      }
      await refresh()
    },
    [user, tasks, refresh],
  )

  const updateTask = useCallback(
    async (id: string, patch: Partial<RobotTaskInput>) => {
      if (!user) return
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (patch.title !== undefined) row.title = patch.title
      if (patch.content !== undefined) row.content = patch.content
      if (patch.startTime !== undefined) row.start_time = patch.startTime
      if (patch.endTime !== undefined) row.end_time = patch.endTime
      if (patch.rewardCoins !== undefined) row.reward_coins = patch.rewardCoins
      if (patch.quickLink !== undefined) row.quick_link = patch.quickLink
      const { error } = await supabase
        .from(TABLE)
        .update(row)
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) {
        console.error('[robot] update failed', error)
        return
      }
      await refresh()
    },
    [user, refresh],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      if (!user) return
      const { error } = await supabase.from(TABLE).delete().eq('id', id).eq('user_id', user.id)
      if (error) {
        console.error('[robot] delete failed', error)
        return
      }
      await refresh()
    },
    [user, refresh],
  )

  const reorderTasks = useCallback(
    async (orderedIds: string[]) => {
      if (!user) return
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from(TABLE).update({ sort_order: i }).eq('id', id).eq('user_id', user.id),
        ),
      )
      const failed = results.filter((r) => r.error)
      if (failed.length) {
        console.error('[robot] reorder partial failure', failed)
        return
      }
      await refresh()
    },
    [user, refresh],
  )

  // completed_at is set here as a primitive; the coin write into star_sessions
  // (source:'robot') is layered in sub-project D.
  const completeTask = useCallback(
    async (id: string) => {
      if (!user) return
      const { error } = await supabase
        .from(TABLE)
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
      if (error) {
        console.error('[robot] complete failed', error)
        return
      }
      await refresh()
    },
    [user, refresh],
  )

  return { tasks, loading, addTask, updateTask, deleteTask, reorderTasks, completeTask, refresh }
}
